import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { checkLimit } from "@/lib/plan-limits"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { Resend } from "resend"
import { v4 as uuidv4 } from "uuid"

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
    const { email, role, companyId } = await request.json()

    if (!email || !role || !companyId) {
      return NextResponse.json({ error: "Email, role, and companyId are required" }, { status: 400 })
    }

    // 1. Fetch profile to check authorization
    const profileDoc = await adminDb.collection("profiles").doc(uid).get()
    if (!profileDoc.exists) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 })
    }

    const profile = profileDoc.data()
    if (!profile || !profile.company_id || profile.company_id !== companyId) {
      return NextResponse.json({ error: "Unauthorized access to company workspace" }, { status: 403 })
    }

    if (!["owner", "manager", "admin", "super_admin"].includes(profile.role || "")) {
      return NextResponse.json({ error: "Only owners and managers can invite team members" }, { status: 403 })
    }

    // 2. Check plan limits
    const limitCheck = await checkLimit(companyId, "users")
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.reason }, { status: 403 })
    }

    // 3. Fetch company name
    const companyDoc = await adminDb.collection("companies").doc(companyId).get()
    const companyName = companyDoc.exists ? companyDoc.data()?.name || "Partner Company" : "Partner Company"

    const token = uuidv4()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7) // 7 days

    // 4. Create invite document in Firestore
    const inviteData = {
      companyId,
      company_id: companyId, // for snake_case compatibility
      email,
      role,
      token,
      status: "pending",
      invitedBy: uid,
      invited_by: uid, // for snake_case compatibility
      companyName,
      inviterName: profile.full_name || "Workspace Admin",
      expiresAt: expiresAt.toISOString(),
      expires_at: expiresAt.toISOString(), // for snake_case compatibility
      createdAt: now.toISOString(),
      created_at: now.toISOString() // for snake_case compatibility
    }

    const inviteRef = await adminDb.collection("invites").add(inviteData)

    // 5. Send email via Resend
    const resendApiKey = process.env.RESEND_API_KEY
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/invite?token=${token}`

    if (resendApiKey) {
      const resend = new Resend(resendApiKey)
      await resend.emails.send({
        from: "SaleswinAI <onboarding@resend.dev>",
        to: [email],
        subject: `[${companyName}] invited you to train on SaleswinAI`,
        html: `
          <div style="font-family: sans-serif; background-color: #080810; color: #F2F2F7; padding: 24px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2937;">
            <h2 style="font-size: 24px; color: #ffffff; font-weight: bold; margin-bottom: 16px;">Saleswin<span style="color: #00D68F;">AI</span> workspace</h2>
            <p style="font-size: 16px; line-height: 1.5; color: #9ca3af;">Hi there,</p>
            <p style="font-size: 16px; line-height: 1.5; color: #9ca3af;">
              <strong>${profile.full_name || "Workspace Admin"}</strong> has invited you to join <strong>${companyName}</strong> on SaleswinAI.
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #9ca3af;">Your assigned role is: <strong style="color: #00D68F; text-transform: uppercase;">${role}</strong>.</p>
            <p style="margin-top: 24px; margin-bottom: 24px;">
              <a href="${inviteLink}" style="display: inline-block; background-color: #00D68F; color: #080810; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 16px;">Accept Invitation</a>
            </p>
            <p style="font-size: 12px; color: #4b5563;">This invitation link will expire in 7 days.</p>
          </div>
        `
      })
    } else {
      console.warn("RESEND_API_KEY is not defined. Skipping email sending. Direct acceptance link:", inviteLink)
    }

    return NextResponse.json({ success: true, inviteId: inviteRef.id, token })
  } catch (err) {
    console.error("Invite API error:", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create invitation" }, { status: 500 })
  }
}
