import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

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
    const { plan } = await request.json()
    if (!plan || !PLAN_PRICING[plan]) {
      return NextResponse.json({ error: "Invalid plan selected" }, { status: 400 })
    }

    // 1. Fetch user profile to verify company and manager permissions
    const profileDoc = await adminDb.collection("profiles").doc(uid).get()
    const profile = profileDoc.data()

    if (!profile || !profile.company_id) {
      return NextResponse.json({ error: "Profile company not found" }, { status: 404 })
    }

    if (!["owner", "manager", "admin", "super_admin"].includes(profile.role || "")) {
      return NextResponse.json({ error: "Unauthorized. Billing actions require manager rights." }, { status: 403 })
    }

    const companyId = profile.company_id
    const userEmail = profile.email || "billing@saleswinai.com"
    const planConfig = PLAN_PRICING[plan]

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY

    // MOCK MODE FALLBACK
    if (!paystackSecret || paystackSecret === "mock" || paystackSecret.startsWith("sk_test_mock")) {
      const ref = "mock_ref_" + Math.random().toString(36).substring(2, 10)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      const mockUrl = `${appUrl}/dashboard/billing?mock_payment=success&reference=${ref}&plan=${plan}`

      return NextResponse.json({
        authorizationUrl: mockUrl,
        accessCode: "mock_access_code",
        reference: ref
      })
    }

    // REAL PAYSTACK INITIALIZATION
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://saleswin-ai-woad.vercel.app"
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: userEmail,
        amount: planConfig.price,
        callback_url: `${appUrl}/dashboard/billing`,
        metadata: {
          companyId,
          plan
        }
      })
    })

    if (!response.ok) {
      const errTxt = await response.text()
      console.error("Paystack API initialize error:", errTxt)
      throw new Error(`Paystack failed: ${errTxt}`)
    }

    const data = await response.json()
    return NextResponse.json({
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference
    })

  } catch (err) {
    console.error("Initialize billing error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to initialize payment gateway" },
      { status: 500 }
    )
  }
}
