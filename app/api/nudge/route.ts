import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { Resend } from "resend"

export async function POST(request: Request) {
  // Get current user session from HTTP-only cookie
  const session = cookies().get("session")?.value
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  }

  let uid: string
  try {
    const decodedToken = await adminAuth.verifySessionCookie(session)
    uid = decodedToken.uid
  } catch {
    return NextResponse.json({ error: "Session expired or invalid" }, { status: 401 })
  }

  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    // 1. Fetch manager profile to verify authorization
    const managerDoc = await adminDb.collection("profiles").doc(uid).get()
    const manager = managerDoc.data()

    if (!manager || !manager.company_id) {
      return NextResponse.json({ error: "Manager profile not found" }, { status: 403 })
    }

    if (!["owner", "manager", "admin", "super_admin"].includes(manager.role || "")) {
      return NextResponse.json({ error: "Unauthorized access to nudge system" }, { status: 403 })
    }

    // 2. Fetch target user profile
    const targetUserDoc = await adminDb.collection("profiles").doc(userId).get()
    if (!targetUserDoc.exists) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 })
    }

    const targetUser = targetUserDoc.data()
    if (!targetUser || targetUser.company_id !== manager.company_id) {
      return NextResponse.json({ error: "Cross-workspace nudges are not allowed" }, { status: 403 })
    }

    // 3. Create real-time notification doc in Firestore subcollection notifications/{userId}/items
    const notifRef = adminDb.collection("notifications").doc(userId).collection("items").doc()
    await notifRef.set({
      title: "Training Reminder",
      message: `${manager.full_name || "Your Manager"} sent you a reminder to complete your practice sessions today.`,
      isRead: false,
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString()
    })

    // 4. Send email via Resend
    const resendApiKey = process.env.RESEND_API_KEY
    if (resendApiKey && targetUser.email) {
      const resend = new Resend(resendApiKey)
      const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard`

      await resend.emails.send({
        from: "SaleswinAI <training@onboarding.dev>",
        to: [targetUser.email],
        subject: `[SaleswinAI] ${manager.full_name || "Your Manager"} sent you a training reminder`,
        html: `
          <div style="font-family: sans-serif; background-color: #080810; color: #F2F2F7; padding: 24px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2937;">
            <h2 style="font-size: 24px; color: #ffffff; font-weight: bold; margin-bottom: 16px;">Saleswin<span style="color: #00D68F;">AI</span> training nudge</h2>
            <p style="font-size: 16px; line-height: 1.5; color: #9ca3af;">Hi ${targetUser.full_name || "there"},</p>
            <p style="font-size: 16px; line-height: 1.5; color: #9ca3af;">
              Your manager <strong>${manager.full_name || "Workspace Admin"}</strong> noticed you haven't completed your Property Simulator practice or Objection drills today and has sent you a nudge.
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #9ca3af; margin-bottom: 24px;">Regular training helps maintain your active closing streak and prepares you for real estate objections.</p>
            <p style="margin-top: 24px; margin-bottom: 24px;">
              <a href="${dashboardUrl}" style="display: inline-block; background-color: #00D68F; color: #080810; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 16px;">Open Dashboard</a>
            </p>
          </div>
        `
      })
    } else {
      console.warn("RESEND_API_KEY is not defined. Skipping nudge email. Target:", targetUser.email)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Nudge API error:", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to send nudge notification" }, { status: 500 })
  }
}
