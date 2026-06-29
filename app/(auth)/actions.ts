"use server"

import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { Resend } from "resend"
import { v4 as uuidv4 } from "uuid"

export async function createAndSendInvite(
  prevState: { error?: string; success?: boolean; message?: string } | undefined,
  formData: FormData
): Promise<{ error?: string; success?: boolean; message?: string }> {
  const email = formData.get("email") as string
  const role = formData.get("role") as string

  if (!email || !role) {
    return { error: "Email and role are required" }
  }

  // Get current user session from HTTP-only cookie
  const session = cookies().get("session")?.value
  if (!session) {
    return { error: "Not authenticated" }
  }

  let uid: string
  try {
    const decodedToken = await adminAuth.verifySessionCookie(session)
    uid = decodedToken.uid
  } catch (authErr) {
    console.error("Auth session validation failure:", authErr)
    return { error: "Session expired or invalid. Please sign in again." }
  }

  // Get profile from Firestore to verify authorization
  const profileDoc = await adminDb.collection("profiles").doc(uid).get()
  if (!profileDoc.exists) {
    return { error: "Your profile could not be found." }
  }

  const profile = profileDoc.data()
  if (!profile || !profile.company_id) {
    return { error: "You must belong to a company to invite users" }
  }

  // Allow only owners, managers or admins to invite
  if (!['owner', 'manager', 'admin', 'super_admin'].includes(profile.role || '')) {
    return { error: "Unauthorized. Only owners, managers and admins can invite team members." }
  }

  const token = uuidv4()

  // Retrieve company details
  const companyDoc = await adminDb.collection("companies").doc(profile.company_id).get()
  const companyName = companyDoc.exists ? companyDoc.data()?.name || "Saleswin Partner" : "Saleswin Partner"

  try {
    // Insert invite in Firestore
    await adminDb.collection("invites").add({
      company_id: profile.company_id,
      email,
      role,
      token,
      invited_by: uid,
      status: "pending",
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(), // 7 days
      created_at: new Date().toISOString()
    })
  } catch (dbErr) {
    console.error("Failed to save invite doc:", dbErr)
    return { error: dbErr instanceof Error ? dbErr.message : "Failed to generate invite in database" }
  }

  // Send email with Resend
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    return {
      success: true,
      message: `Invite generated (Direct Link: /invite?token=${token})`
    }
  }

  const resend = new Resend(resendApiKey)
  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite?token=${token}`

  try {
    const { error: emailError } = await resend.emails.send({
      from: 'SaleswinAI <onboarding@resend.dev>',
      to: [email],
      subject: `Join ${companyName} on SaleswinAI`,
      html: `
        <div style="font-family: sans-serif; background-color: #080810; color: #F2F2F7; padding: 24px; border-radius: 8px; max-width: 600px; margin: 0 auto; border: 1px solid #1f2937;">
          <h2 style="font-size: 24px; color: #ffffff; font-weight: bold; margin-bottom: 16px;">Saleswin<span style="color: #00D68F;">AI</span> Workspace Invitation</h2>
          <p style="font-size: 16px; line-height: 1.5; color: #9ca3af;">You have been invited to join <strong>${companyName}</strong> as a <strong>${role.toUpperCase()}</strong>.</p>
          <p style="font-size: 16px; line-height: 1.5; color: #9ca3af; margin-bottom: 24px;">With SaleswinAI, you will engage in interactive AI-powered simulation training to handle property objections and master real estate sales conversion in Nigeria.</p>
          <a href="${inviteLink}" style="display: inline-block; background-color: #00D68F; color: #080810; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; margin-bottom: 16px;">Accept Invitation & Setup Account</a>
          <p style="font-size: 12px; color: #4b5563; margin-top: 24px;">If you did not expect this invitation, please ignore this email. The link will expire in 7 days.</p>
        </div>
      `,
    })

    if (emailError) {
      console.error("Resend email send error:", emailError)
      return {
        success: true,
        message: `Invite generated (Direct Link: /invite?token=${token}) but email delivery had error: ${emailError.message}`
      }
    }

    return { success: true, message: `Invitation email sent successfully to ${email}!` }
  } catch (err) {
    console.error("Resend send catch error:", err)
    return {
      success: true,
      message: `Invite generated (Direct Link: /invite?token=${token}) but email delivery failed.`
    }
  }
}
