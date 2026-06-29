import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"

const PLAN_PRICING: Record<string, { price: number; label: string }> = {
  pro:     { price: 990000,   label: "Pro" },
  starter: { price: 4900000,  label: "Starter" },
  growth:  { price: 14900000, label: "Growth" }
}

export async function POST(request: Request) {
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
    const { reference, plan } = await request.json()
    if (!reference) {
      return NextResponse.json({ error: "Reference is required" }, { status: 400 })
    }

    // Fetch user profile to verify company and manager permissions
    const profileDoc = await adminDb.collection("profiles").doc(uid).get()
    const profile = profileDoc.data()

    if (!profile || !profile.company_id) {
      return NextResponse.json({ error: "Profile company not found" }, { status: 404 })
    }

    if (!["owner", "manager", "admin", "super_admin"].includes(profile.role || "")) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 })
    }

    const companyId = profile.company_id
    const targetPlan = plan || "pro"
    const planConfig = PLAN_PRICING[targetPlan]

    // MOCK VERIFICATION
    if (reference.startsWith("mock_ref_")) {
      const now = new Date()
      const endPeriod = new Date()
      endPeriod.setMonth(now.getMonth() + 1)

      // Update company document
      await adminDb.collection("companies").doc(companyId).update({
        plan: targetPlan,
        planStatus: "active",
        updatedAt: FieldValue.serverTimestamp()
      })

      // Write to billing history
      await adminDb.collection("billing_history").add({
        companyId,
        amount: planConfig.price,
        currency: "NGN",
        plan: targetPlan,
        status: "success",
        paystackReference: reference,
        paystackTransactionId: "mock_tx_" + Math.random().toString(36).substring(2, 9),
        periodStart: now.toISOString(),
        periodEnd: endPeriod.toISOString(),
        createdAt: FieldValue.serverTimestamp()
      })

      return NextResponse.json({ success: true, mock: true })
    }

    // REAL PAYSTACK VERIFICATION
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY
    if (!paystackSecret) {
      return NextResponse.json({ error: "Paystack API key not configured" }, { status: 500 })
    }

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${paystackSecret}`
      }
    })

    if (!response.ok) {
      const errTxt = await response.text()
      console.error("Paystack transaction verify failed:", errTxt)
      throw new Error(`Paystack verification failed: ${errTxt}`)
    }

    const data = await response.json()
    const tx = data.data

    if (tx.status !== "success") {
      return NextResponse.json({ success: false, status: tx.status, message: "Transaction was not successful" })
    }

    const metadata = tx.metadata || {}
    const companyPlan = metadata.plan || targetPlan
    const paystackCustomerCode = tx.customer?.customer_code || ""
    const paystackSubscriptionCode = tx.subscription || ""

    const now = new Date()
    const endPeriod = new Date()
    endPeriod.setMonth(now.getMonth() + 1)

    // Update company document
    await adminDb.collection("companies").doc(companyId).update({
      plan: companyPlan,
      planStatus: "active",
      paystackCustomerCode,
      paystackSubscriptionCode,
      updatedAt: FieldValue.serverTimestamp()
    })

    // Write to billing history
    await adminDb.collection("billing_history").add({
      companyId,
      amount: tx.amount,
      currency: tx.currency || "NGN",
      plan: companyPlan,
      status: "success",
      paystackReference: reference,
      paystackTransactionId: tx.id ? String(tx.id) : "",
      periodStart: now.toISOString(),
      periodEnd: endPeriod.toISOString(),
      createdAt: FieldValue.serverTimestamp()
    })

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error("Verification endpoint error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to verify transaction status" },
      { status: 500 }
    )
  }
}
