import { adminDb } from "@/utils/firebase/admin"
import { NextResponse } from "next/server"
import crypto from "crypto"
import { FieldValue } from "firebase-admin/firestore"

export async function POST(request: Request) {
  const bodyText = await request.text()
  const signature = request.headers.get("x-paystack-signature") || ""
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY

  if (!paystackSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })
  }

  // 1. Verify Paystack Signature
  const hash = crypto.createHmac("sha512", paystackSecret).update(bodyText).digest("hex")
  if (hash !== signature) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 })
  }

  try {
    const event = JSON.parse(bodyText)
    const eventType = event.event
    const data = event.data

    console.log(`Received Paystack Webhook event: ${eventType}`)

    // 2. Handle Event Types
    if (eventType === "charge.success") {
      const metadata = data.metadata || {}
      const companyId = metadata.companyId
      const plan = metadata.plan || "pro"

      if (companyId) {
        const now = new Date()
        const endPeriod = new Date()
        endPeriod.setMonth(now.getMonth() + 1)

        // Update company
        await adminDb.collection("companies").doc(companyId).update({
          plan,
          planStatus: "active",
          updatedAt: FieldValue.serverTimestamp()
        })

        // Log to billing history
        await adminDb.collection("billing_history").add({
          companyId,
          amount: data.amount,
          currency: data.currency || "NGN",
          plan,
          status: "success",
          paystackReference: data.reference || "",
          paystackTransactionId: data.id ? String(data.id) : "",
          periodStart: now.toISOString(),
          periodEnd: endPeriod.toISOString(),
          createdAt: FieldValue.serverTimestamp()
        })
      }
    } 
    else if (eventType === "subscription.disable") {
      const customerEmail = data.customer?.email
      if (customerEmail) {
        // Query company where customer email matches or subscription matches
        const companySnap = await adminDb
          .collection("companies")
          .where("paystackSubscriptionCode", "==", data.subscription_code || "")
          .get()

        if (!companySnap.empty) {
          const companyId = companySnap.docs[0].id
          await adminDb.collection("companies").doc(companyId).update({
            plan: "free",
            planStatus: "cancelled",
            updatedAt: FieldValue.serverTimestamp()
          })
        }
      }
    } 
    else if (eventType === "invoice.payment_failed") {
      const customerEmail = data.customer?.email
      if (customerEmail) {
        const companySnap = await adminDb
          .collection("companies")
          .where("paystackCustomerCode", "==", data.customer?.customer_code || "")
          .get()

        if (!companySnap.empty) {
          const companyId = companySnap.docs[0].id
          await adminDb.collection("companies").doc(companyId).update({
            planStatus: "past_due",
            updatedAt: FieldValue.serverTimestamp()
          })
        }
      }
    }

    return NextResponse.json({ received: true })

  } catch (err) {
    console.error("Webhook processing error:", err)
    return NextResponse.json({ error: "Failed to process webhook event" }, { status: 500 })
  }
}
