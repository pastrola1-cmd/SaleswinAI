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

    // 2. Query all companies
    const companiesSnap = await adminDb.collection("companies").get()
    const companies = companiesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any))
    console.log(`Processing inactivity alert cron for ${companies.length} workspaces...`)

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    for (const c of companies) {
      if (!c.id) continue

      // Find all reps in company
      const repsSnap = await adminDb
        .collection("profiles")
        .where("company_id", "==", c.id)
        .where("role", "==", "salesperson")
        .get()

      const reps = repsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any))
      const inactiveReps: any[] = []

      for (const r of reps) {
        // Query user_progress to find last active date
        const progDoc = await adminDb.collection("user_progress").doc(r.id).get()
        const prog = progDoc.exists ? progDoc.data() : null
        
        let lastActiveTime = 0
        if (prog && prog.lastActiveDate) {
          lastActiveTime = new Date(prog.lastActiveDate).getTime()
        } else if (r.lastSeenAt || r.last_seen_at) {
          lastActiveTime = new Date(r.lastSeenAt || r.last_seen_at).getTime()
        }

        if (lastActiveTime === 0 || lastActiveTime < sevenDaysAgo.getTime()) {
          inactiveReps.push(r)
        }
      }

      // If there are inactive representatives, alert managers
      if (inactiveReps.length > 0) {
        const managersSnap = await adminDb
          .collection("profiles")
          .where("company_id", "==", c.id)
          .get()

        const managers = managersSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as any))
          .filter((m) => ["owner", "manager", "admin", "super_admin"].includes(m.role || ""))

        for (const m of managers) {
          // Send Database Notification to Manager
          await createNotification(
            m.id,
            "team_alert",
            "Roster Inactivity Alert",
            `There are ${inactiveReps.length} reps inactive for more than 7 days: ${inactiveReps.map((r) => r.full_name).join(", ")}.`,
            "/dashboard/team"
          )

          // Send Email to Manager
          if (resend && m.email) {
            try {
              await resend.emails.send({
                from: "SaleswinAI <compliance@onboarding.dev>",
                to: [m.email],
                subject: `[SaleswinAI] Team Training Inactivity Alert`,
                html: `
                  <div style="font-family: sans-serif; background-color: #080810; color: #F2F2F7; padding: 24px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2937;">
                    <h2 style="font-size: 24px; color: #ffffff; margin-bottom: 16px;">Team Inactivity <span style="color: #ea580c;">Alert</span></h2>
                    <p style="color: #9ca3af; font-size: 16px;">Hi ${m.full_name || "Manager"},</p>
                    <p style="color: #9ca3af; font-size: 16px;">
                      The following representatives in your company workspace have not completed any practice simulations or quizzes in the last 7 days:
                    </p>
                    
                    <ul style="color: #ffffff; font-size: 14px; line-height: 1.6; margin: 20px 0; padding-left: 20px;">
                      ${inactiveReps.map((r) => `<li><strong>${r.full_name || "Anonymous Rep"}</strong> (${r.email || "No email"})</li>`).join("")}
                    </ul>

                    <p style="color: #9ca3af; font-size: 16px; margin-bottom: 24px;">
                      You can send manual nudge reminders directly to their inbox from the dashboard.
                    </p>
                    <p style="margin-top: 24px; margin-bottom: 24px;">
                      <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/team" style="display: inline-block; background-color: #ea580c; color: #ffffff; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 16px;">View Team Standings</a>
                    </p>
                  </div>
                `
              })
            } catch (mailErr) {
              console.error("Resend inactivity alert email fail:", mailErr)
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, workspacesAlerted: companies.length })

  } catch (err) {
    console.error("Inactivity alert cron error:", err)
    return NextResponse.json({ error: "Failed to compile inactivity alerts" }, { status: 500 })
  }
}
