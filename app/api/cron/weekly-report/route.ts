import { adminDb } from "@/utils/firebase/admin"
import { NextResponse } from "next/server"
import { createNotification } from "@/lib/notifications"
import { Resend } from "resend"

export async function GET(request: Request) {
  // 1. Secure verification check
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (process.env.NODE_ENV === "production") {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const resendApiKey = process.env.RESEND_API_KEY
    const resend = resendApiKey ? new Resend(resendApiKey) : null
    const geminiApiKey = process.env.GEMINI_API_KEY

    // 2. Fetch all active salespeople
    const usersSnap = await adminDb
      .collection("profiles")
      .where("role", "==", "salesperson")
      .get()

    const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any))
    console.log(`Processing weekly progress report cron for ${users.length} salespeople...`)

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    for (const u of users) {
      if (!u.id) continue

      // Query simulations from last 7 days
      const simsSnap = await adminDb
        .collection("simulation_sessions")
        .where("userId", "==", u.id)
        .where("status", "==", "completed")
        .get()

      const weeklySims = simsSnap.docs.filter((d) => {
        const cAt = d.data().completedAt || d.data().createdAt
        if (!cAt) return false
        const ms = cAt.toMillis ? cAt.toMillis() : new Date(cAt).getTime()
        return ms >= sevenDaysAgo.getTime()
      })

      const simCount = weeklySims.length
      const avgScore = simCount > 0 
        ? Math.round(weeklySims.reduce((sum, d) => sum + (d.data().scores?.overall || 0), 0) / simCount)
        : 0

      // Query quizzes from last 7 days
      const quizSnap = await adminDb
        .collection("quiz_sessions")
        .where("userId", "==", u.id)
        .get()

      const weeklyQuizzes = quizSnap.docs.filter((d) => {
        const cAt = d.data().completedAt || d.data().createdAt
        if (!cAt) return false
        const ms = cAt.toMillis ? cAt.toMillis() : new Date(cAt).getTime()
        return ms >= sevenDaysAgo.getTime()
      }).length

      // Query objection drills from last 7 days
      const objSnap = await adminDb
        .collection("objection_sessions")
        .where("userId", "==", u.id)
        .get()

      const weeklyDrills = objSnap.docs.filter((d) => {
        const cAt = d.data().createdAt
        if (!cAt) return false
        const ms = cAt.toMillis ? cAt.toMillis() : new Date(cAt).getTime()
        return ms >= sevenDaysAgo.getTime()
      }).length

      // Retrieve user progress
      const progDoc = await adminDb.collection("user_progress").doc(u.id).get()
      const prog = progDoc.exists ? progDoc.data() : {}
      const streak = prog?.streakDays || prog?.streak_days || 0
      const totalXp = prog?.xpTotal || prog?.xp_total || 0

      // Call Gemini for a personalized training tip
      let coachingTip = "Keep practicing simulations and objection drills to build confidence and product knowledge."
      if (geminiApiKey && (simCount > 0 || weeklyQuizzes > 0 || weeklyDrills > 0)) {
        try {
          const prompt = `You are a professional real estate sales coach.
Analyze this salesperson's performance over the last 7 days:
- Completed simulations: ${simCount} drills (average overall score: ${avgScore}/100)
- Quizzes completed: ${weeklyQuizzes}
- Objection drills completed: ${weeklyDrills}

Write a concise, encouraging, 1-2 sentence coaching tip addressing the salesperson directly as 'you', suggesting what specific areas of real estate negotiation they should focus on next based on this activity.`

          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                systemInstruction: { parts: [{ text: "You are a professional real estate sales coach." }] }
              })
            }
          )

          if (geminiRes.ok) {
            const gd = await geminiRes.json()
            coachingTip = gd.candidates?.[0]?.content?.parts?.[0]?.text || coachingTip
          }
        } catch (e) {
          console.error("Gemini weekly tip error:", e)
        }
      }

      // Dispatch Database Notification
      await createNotification(
        u.id,
        "xp_earned",
        "Weekly Training Summary",
        `Weekly report ready. You completed ${simCount} sims, ${weeklyQuizzes} quizzes, and earned +${simCount * 200 + weeklyQuizzes * 100} base XP.`,
        "/dashboard/progress"
      )

      // Send Email via Resend
      if (resend && u.email) {
        try {
          await resend.emails.send({
            from: "SaleswinAI <training@onboarding.dev>",
            to: [u.email],
            subject: `[SaleswinAI] Your Weekly Sales Training Report`,
            html: `
              <div style="font-family: sans-serif; background-color: #080810; color: #F2F2F7; padding: 24px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2937;">
                <h2 style="font-size: 24px; color: #ffffff; margin-bottom: 16px;">Weekly Progress <span style="color: #00D68F;">Report</span></h2>
                <p style="color: #9ca3af; font-size: 16px;">Hi ${u.full_name || "there"},</p>
                <p style="color: #9ca3af; font-size: 16px;">Here is your SaleswinAI performance summary for the last 7 days:</p>
                
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; text-align: left;">
                  <tr style="border-bottom: 1px solid #1f2937; color: #9ca3af;">
                    <th style="padding: 8px;">Activity Metrics</th>
                    <th style="padding: 8px; text-align: right;">Count</th>
                  </tr>
                  <tr style="border-bottom: 1px solid #1f2937; color: #ffffff;">
                    <td style="padding: 8px;">Customer Simulations</td>
                    <td style="padding: 8px; text-align: right;">${simCount} (Avg: ${avgScore}%)</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #1f2937; color: #ffffff;">
                    <td style="padding: 8px;">Product Quizzes</td>
                    <td style="padding: 8px; text-align: right;">${weeklyQuizzes} completed</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #1f2937; color: #ffffff;">
                    <td style="padding: 8px;">Objections Handled</td>
                    <td style="padding: 8px; text-align: right;">${weeklyDrills} drilled</td>
                  </tr>
                  <tr style="color: #ffffff;">
                    <td style="padding: 8px;">Current Streak</td>
                    <td style="padding: 8px; text-align: right; color: #00D68F;">🔥 ${streak} Days</td>
                  </tr>
                </table>

                <div style="background-color: #121225; border: 1px solid #00D68F; border-radius: 8px; padding: 16px; margin: 24px 0;">
                  <h4 style="margin-top: 0; color: #00D68F; font-size: 14px; font-weight: bold; text-transform: uppercase;">Coaching Insights:</h4>
                  <p style="margin-bottom: 0; color: #ffffff; font-size: 13px; line-height: 1.5; font-style: italic;">
                    "${coachingTip.trim()}"
                  </p>
                </div>

                <p style="font-size: 12px; color: #4b5563; margin-top: 32px; border-t: 1px solid #1f2937; padding-top: 16px;">
                  SaleswinAI Scheduled Reports. To configure notification profiles, access your settings panel.
                </p>
              </div>
            `
          })
        } catch (mailErr) {
          console.error("Resend weekly email fail:", mailErr)
        }
      }
    }

    return NextResponse.json({ success: true, processed: users.length })

  } catch (err) {
    console.error("Weekly report cron error:", err)
    return NextResponse.json({ error: "Failed to compile weekly reports" }, { status: 500 })
  }
}
