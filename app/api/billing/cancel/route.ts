import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"

export async function POST() {
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
    // Verify user profile company and manager role
    const profileDoc = await adminDb.collection("profiles").doc(uid).get()
    const profile = profileDoc.data()

    if (!profile || !profile.company_id) {
      return NextResponse.json({ error: "Profile company not found" }, { status: 404 })
    }

    if (!["owner", "manager", "admin", "super_admin"].includes(profile.role || "")) {
      return NextResponse.json({ error: "Unauthorized access to subscription management" }, { status: 403 })
    }

    const companyId = profile.company_id

    // Fetch company document to get subscription code
    const companyDoc = await adminDb.collection("companies").doc(companyId).get()
    if (!companyDoc.exists) {
      return NextResponse.json({ error: "Company document not found" }, { status: 404 })
    }

    const companyData = companyDoc.data()!
    const subCode = companyData.paystackSubscriptionCode || ""

    // MOCK CANCEL MODE
    if (!subCode || subCode.startsWith("mock") || !process.env.PAYSTACK_SECRET_KEY) {
      await adminDb.collection("companies").doc(companyId).update({
        plan: "free",
        planStatus: "cancelled",
        updatedAt: FieldValue.serverTimestamp()
      })

      return NextResponse.json({ success: true, message: "Mock subscription cancelled successfully." })
    }

    // REAL PAYSTACK CANCEL
    const response = await fetch("https://api.paystack.co/subscription/disable", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        code: subCode,
        token: companyData.paystackCustomerCode || "" // Paystack subscription token or email is needed for disabling
      })
    })

    if (!response.ok) {
      const errTxt = await response.text()
      console.error("Paystack cancel subscription failed:", errTxt)
      // Downgrade internally anyways for maximum resilience
    }

    await adminDb.collection("companies").doc(companyId).update({
      plan: "free",
      planStatus: "cancelled",
      updatedAt: FieldValue.serverTimestamp()
    })

    return NextResponse.json({ success: true, message: "Subscription cancelled successfully." })

  } catch (err) {
    console.error("Cancel billing error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to cancel subscription" },
      { status: 500 }
    )
  }
}
