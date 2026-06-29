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

    // Get today's date in YYYY-MM-DD format (UTC)
    const todayStr = new Date().toISOString().split("T")[0]

    // 2. Fetch progress records with active streaks (streakDays > 0)
    const progressSnap = await adminDb
      .collection("user_progress")
      .where("streakDays", ">", 0)
      .get()

    const progressRecords = progressSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any))
    console.log(`Processing daily streak reminders for ${progressRecords.length} reps...`)

    let remindedCount = 0

    for (const p of progressRecords) {
      // Check if they practiced today
      if (p.lastActiveDate === todayStr) {
        continue // Already active today, streak is safe!
      }

      const userId = p.id || p.userId
      if (!userId) continue

      // Fetch user profile to get email and details
      const profileDoc = await adminDb.collection("profiles").doc(userId).get()
      if (!profileDoc.exists) continue

      const user = profileDoc.data()!
      const streak = p.streakDays || p.streak_days || 1

      // Send Database Notification to protect streak
      await createNotification(
        userId,
        "streak_reminder",
        "Keep the Streak Alive!",
        `🔥 You haven't completed any drills today! Practice now to protect your active ${streak}-day closing streak.`,
        "/dashboard/practice"
      )

      remindedCount++

      // Send Email Reminder via Resend
      if (resend && user.email) {
        try {
          await resend.emails.send({
            from: "SaleswinAI <streaks@onboarding.dev>",
            to: [user.email],
            subject: `🔥 Don't break your ${streak}-day SaleswinAI streak!`,
            html: `
              <div style="font-family: sans-serif; background-color: #080810; color: #F2F2F7; padding: 24px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2937; text-align: center;">
                <span style="font-size: 48px; display: block; margin-bottom: 16px;">🔥</span>
                <h2 style="font-size: 24px; color: #ffffff; font-weight: bold; margin-bottom: 8px;">Keep Your Streak Burning!</h2>
                <p style="color: #9ca3af; font-size: 16px; margin-bottom: 24px;">
                  Hi ${user.full_name || "there"}, you haven't completed any Objection drills or Customer simulations today.
                  Practice now to protect your active <strong>${streak}-day closing streak</strong>!
                </p>
                
                <p style="margin-top: 24px; margin-bottom: 24px;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/practice" style="display: inline-block; background-color: #ea580c; color: #ffffff; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; text-transform: uppercase; tracking-wider: 1px;">Start Training Session</a>
                </p>

                <p style="font-size: 12px; color: #4b5563; margin-top: 32px; border-t: 1px solid #1f2937; padding-top: 16px; text-align: left;">
                  SaleswinAI Streaks Engine. Practice daily to earn bonus XP rewards.
                </p>
              </div>
            `
          })
        } catch (mailErr) {
          console.error("Resend streak email fail:", mailErr)
        }
      }
    }

    return NextResponse.json({ success: true, reminded: remindedCount })

  } catch (err) {
    console.error("Streak reminder cron error:", err)
    return NextResponse.json({ error: "Failed to compile streak reminders" }, { status: 500 })
  }
}
