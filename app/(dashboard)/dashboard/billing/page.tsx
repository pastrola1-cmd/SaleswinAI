"use client"

import { useState, useEffect, useTransition } from "react"
import { useProfile } from "@/hooks/useProfile"
import { db } from "@/utils/firebase/client"
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore"
import { useSearchParams, useRouter } from "next/navigation"

const PLAN_PRICING: Record<string, { price: number; label: string; naira: string; users: string; sims: string; quizzes: string; docs: string; manager: boolean; analytics: boolean }> = {
  free: {
    price: 0,
    label: "Free",
    naira: "₦0/mo",
    users: "1 Seat",
    sims: "3 Simulations",
    quizzes: "5 Quizzes",
    docs: "3 Uploads",
    manager: false,
    analytics: false
  },
  pro: {
    price: 990000,
    label: "Pro",
    naira: "₦9,900/mo",
    users: "1 Seat",
    sims: "Unlimited",
    quizzes: "Unlimited",
    docs: "10 Uploads",
    manager: false,
    analytics: false
  },
  starter: {
    price: 4900000,
    label: "Starter",
    naira: "₦49,000/mo",
    users: "10 Seats",
    sims: "Unlimited",
    quizzes: "Unlimited",
    docs: "50 Uploads",
    manager: true,
    analytics: true
  },
  growth: {
    price: 14900000,
    label: "Growth",
    naira: "₦149,000/mo",
    users: "25 Seats",
    sims: "Unlimited",
    quizzes: "Unlimited",
    docs: "Unlimited",
    manager: true,
    analytics: true
  },
  enterprise: {
    price: -1,
    label: "Enterprise",
    naira: "Custom",
    users: "Unlimited",
    sims: "Unlimited",
    quizzes: "Unlimited",
    docs: "Unlimited",
    manager: true,
    analytics: true
  }
}

export default function BillingPage() {
  const { profile, company, refresh } = useProfile()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [verificationLoading, setVerificationLoading] = useState(false)
  const [invoices, setInvoices] = useState<any[]>([])
  
  // Feedback alerts
  const [alert, setAlert] = useState<{ type: "success" | "error"; text: string } | null>(null)
  
  // Limits indicators
  const [teamCount, setTeamCount] = useState(1)
  const [simsCount, setSimsCount] = useState(0)
  const [quizzesCount, setQuizzesCount] = useState(0)

  const isPending = useTransition()[0]

  // Parse URL callbacks for verification
  useEffect(() => {
    const reference = searchParams.get("reference")
    const plan = searchParams.get("plan")
    
    if (reference && plan) {
      const verifyPayment = async () => {
        setVerificationLoading(true)
        try {
          const res = await fetch("/api/billing/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference, plan })
          })
          const data = await res.json()
          
          if (!res.ok) {
            throw new Error(data.error || "Failed to verify transaction status")
          }
          
          setAlert({
            type: "success",
            text: `Workspace successfully upgraded to ${PLAN_PRICING[plan]?.label || plan} plan!`
          })
          
          await refresh()
          // Clear query params from address bar
          router.replace("/dashboard/billing")
        } catch (err: any) {
          setAlert({
            type: "error",
            text: err.message || "Payment verification failed."
          })
        } finally {
          setVerificationLoading(false)
        }
      }
      
      verifyPayment()
    }
  }, [searchParams, refresh, router])

  // Fetch invoices & limits usage
  useEffect(() => {
    if (!profile?.company_id) return

    const companyId = profile.company_id
    const uid = profile.id

    const fetchBillingDetails = async () => {
      try {
        // 1. Fetch Invoices
        const invoicesSnap = await getDocs(
          query(
            collection(db, "billing_history"),
            where("companyId", "==", companyId),
            orderBy("createdAt", "desc"),
            limit(15)
          )
        )
        const invoiceList = invoicesSnap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            plan: data.plan || "pro",
            amount: data.amount || 0,
            status: data.status || "success",
            ref: data.paystackReference || "",
            date: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toLocaleDateString() : new Date(data.createdAt).toLocaleDateString()) : ""
          }
        })
        setInvoices(invoiceList)

        // 2. Fetch company team size
        const teamSnap = await getDocs(
          query(collection(db, "profiles"), where("company_id", "==", companyId))
        )
        setTeamCount(teamSnap.size)

        // 3. Fetch monthly simulation sessions count
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0,0,0,0)

        const simsSnap = await getDocs(
          query(collection(db, "simulation_sessions"), where("userId", "==", uid))
        )
        const monthlySims = simsSnap.docs.filter((d) => {
          const data = d.data()
          const crAt = data.createdAt || data.startedAt
          if (!crAt) return false
          const sMs = crAt.toMillis ? crAt.toMillis() : new Date(crAt).getTime()
          return sMs >= startOfMonth.getTime()
        }).length
        setSimsCount(monthlySims)

        // 4. Fetch monthly quiz counts
        const quizSnap = await getDocs(
          query(collection(db, "quiz_sessions"), where("userId", "==", uid))
        )
        const monthlyQuizzes = quizSnap.docs.filter((d) => {
          const data = d.data()
          const crAt = data.completedAt || data.createdAt
          if (!crAt) return false
          const sMs = crAt.toMillis ? crAt.toMillis() : new Date(crAt).getTime()
          return sMs >= startOfMonth.getTime()
        }).length
        setQuizzesCount(monthlyQuizzes)

      } catch (err) {
        console.error("Failed to load invoice history:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchBillingDetails()
  }, [profile?.company_id, profile?.id])

  // Subscribe Action
  const handleUpgrade = async (planKey: string) => {
    setActionLoading(planKey)
    setAlert(null)
    
    try {
      const res = await fetch("/api/billing/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey })
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Initialization failed")
      }

      if (data.authorizationUrl) {
        // Redirect user to Paystack checkout (or mock callback handler)
        router.push(data.authorizationUrl)
      } else {
        throw new Error("Paystack did not return an checkout URL.")
      }
    } catch (err: any) {
      setAlert({
        type: "error",
        text: err.message || "Failed to trigger checkout popup."
      })
      setActionLoading(null)
    }
  }

  // Cancel Action
  const handleCancel = async () => {
    setActionLoading("cancel")
    setAlert(null)
    
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Deactivation failed")
      }

      setAlert({
        type: "success",
        text: data.message || "Subscription cancelled. Company reverted to Free plan."
      })
      await refresh()
    } catch (err: any) {
      setAlert({
        type: "error",
        text: err.message || "Failed to cancel subscription."
      })
    } finally {
      setActionLoading(null)
    }
  }

  if (loading || verificationLoading) {
    return (
      <div className="min-h-screen bg-[#080810] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-t-[#00D68F] border-gray-800 rounded-full animate-spin"></div>
        {verificationLoading && <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Verifying payment status...</p>}
      </div>
    )
  }

  const activePlan = (company?.plan || "free").toLowerCase()
  const activePlanConfig = PLAN_PRICING[activePlan] || PLAN_PRICING.free

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16 font-body text-[#F2F2F7]">
      
      {/* Title */}
      <div>
        <h1 className="text-3xl font-display font-black text-white">Billing & Subscriptions</h1>
        <p className="text-gray-400 mt-2 text-sm">
          Upgrade your company plan, monitor training limits, and manage invoice reports.
        </p>
      </div>

      {/* Alert Banner */}
      {alert && (
        <div className={`p-4 rounded-xl border text-xs font-semibold flex justify-between items-center ${
          alert.type === "success" 
            ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-400" 
            : "bg-red-950/20 border-red-500/20 text-red-400"
        }`}>
          <span>{alert.text}</span>
          <button onClick={() => setAlert(null)} className="text-gray-500 hover:text-gray-300">✕</button>
        </div>
      )}

      {/* Current Subscription Card & Usage Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Current Plan Card */}
        <div className="p-6 rounded-2xl bg-[#121225] border border-gray-800/40 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Current Plan</span>
            
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-3xl font-display font-black text-white uppercase tracking-wide">
                  {activePlanConfig.label}
                </h2>
                <span className="px-2 py-0.5 text-[9px] font-bold bg-[#00D68F]/10 text-[#00D68F] border border-[#00D68F]/20 rounded uppercase tracking-wider">
                  {company?.planStatus || "Active"}
                </span>
              </div>
              <p className="text-sm font-bold text-gray-400 mt-1">{activePlanConfig.naira}</p>
            </div>

            <p className="text-xs text-gray-500">
              {activePlan === "free" 
                ? "Reverted to Free limits. Upgrade below to scale your real estate team training." 
                : "Your company subscription is active. Direct invoice queries to billing support."
              }
            </p>
          </div>

          {activePlan !== "free" && (
            <button
              onClick={handleCancel}
              disabled={actionLoading !== null}
              className="w-full py-2.5 bg-red-950/15 border border-red-500/20 hover:border-red-500/30 text-red-400 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {actionLoading === "cancel" ? "Cancelling..." : "Cancel Subscription"}
            </button>
          )}
        </div>

        {/* Workspace Usage Stats */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-[#121225] border border-gray-800/40 space-y-6">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Workspace Usage limits</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Limit 1: Team Seats */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-400 font-semibold uppercase">
                <span>Team Seats</span>
                <span>{teamCount} / {activePlan === "free" || activePlan === "pro" ? "1" : activePlan === "starter" ? "10" : activePlan === "growth" ? "25" : "∞"}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#1C1C35] overflow-hidden">
                <div
                  className="h-full bg-[#3B82F6]"
                  style={{ width: `${Math.min(100, (teamCount / (activePlan === "free" || activePlan === "pro" ? 1 : activePlan === "starter" ? 10 : activePlan === "growth" ? 25 : 100)) * 100)}%` }}
                />
              </div>
            </div>

            {/* Limit 2: Simulations */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-400 font-semibold uppercase">
                <span>Simulations / mo</span>
                <span>{simsCount} / {activePlan === "free" ? "3" : "∞"}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#1C1C35] overflow-hidden">
                <div
                  className="h-full bg-[#EC4899]"
                  style={{ width: `${Math.min(100, (simsCount / (activePlan === "free" ? 3 : 10)) * 100)}%` }}
                />
              </div>
            </div>

            {/* Limit 3: Quizzes */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-400 font-semibold uppercase">
                <span>Quizzes / mo</span>
                <span>{quizzesCount} / {activePlan === "free" ? "5" : "∞"}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#1C1C35] overflow-hidden">
                <div
                  className="h-full bg-[#8B5CF6]"
                  style={{ width: `${Math.min(100, (quizzesCount / (activePlan === "free" ? 5 : 10)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Plans comparison list */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Upgrade Your Workspace</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { key: "pro", name: "Pro Plan", price: "₦9,900/mo", desc: "For individual real estate agents seeking unlimited customer simulations." },
            { key: "starter", name: "Starter Plan", price: "₦49,000/mo", desc: "For small teams (up to 10 reps). Includes team leaderboard, manager dashboards and ROI analytics." },
            { key: "growth", name: "Growth Plan", price: "₦149,000/mo", desc: "For scaling agencies (up to 25 reps) seeking custom objection builders and unlimited documents uploads." },
            { key: "enterprise", name: "Enterprise Plan", price: "Custom", desc: "For large brokerages. Contact saleswin support for customized licensing and SSO configurations." }
          ].map((p) => {
            const isCurrent = activePlan === p.key
            return (
              <div
                key={p.key}
                className={`p-6 rounded-2xl border flex flex-col justify-between space-y-6 ${
                  isCurrent
                    ? "bg-[#121225] border-[#00D68F]/40 shadow-lg shadow-[#00D68F]/5"
                    : "bg-[#121225]/40 border-gray-850"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-display font-black text-white text-md uppercase tracking-wide">{p.name}</h4>
                    {isCurrent && (
                      <span className="text-[8px] font-bold bg-[#00D68F]/10 text-[#00D68F] border border-[#00D68F]/20 px-1.5 py-0.5 rounded uppercase">Current</span>
                    )}
                  </div>
                  <p className="text-xl font-display font-black text-white">{p.price}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{p.desc}</p>
                </div>

                {p.key === "enterprise" ? (
                  <a
                    href="mailto:support@saleswinai.com"
                    className="block text-center w-full py-2.5 bg-gray-900 hover:bg-gray-850 text-gray-300 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors"
                  >
                    Contact Support
                  </a>
                ) : (
                  <button
                    onClick={() => handleUpgrade(p.key)}
                    disabled={isCurrent || actionLoading !== null}
                    className={`w-full py-2.5 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors disabled:opacity-40 ${
                      isCurrent
                        ? "bg-[#1C1C35] text-gray-500 border border-gray-850"
                        : "bg-[#00D68F] hover:bg-[#00b378] text-[#080810] shadow-md shadow-[#00D68F]/10"
                    }`}
                  >
                    {actionLoading === p.key ? "Initializing..." : isCurrent ? "Active Plan" : `Upgrade to ${p.name.split(" ")[0]}`}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Feature comparison table */}
      <div className="bg-[#121225] border border-gray-800/40 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-gray-850">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Plan Details Comparison</h4>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-850 text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                <th className="py-4 px-6">Feature Capability</th>
                <th className="py-4 px-6 text-center">Free</th>
                <th className="py-4 px-6 text-center">Pro</th>
                <th className="py-4 px-6 text-center">Starter</th>
                <th className="py-4 px-6 text-center">Growth</th>
                <th className="py-4 px-6 text-center">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-850">
              {[
                { label: "Team Seats", val: ["1 Seat", "1 Seat", "10 Seats", "25 Seats", "Unlimited"] },
                { label: "Simulator Runs / mo", val: ["3 runs", "Unlimited", "Unlimited", "Unlimited", "Unlimited"] },
                { label: "Knowledge Quizzes / mo", val: ["5 runs", "Unlimited", "Unlimited", "Unlimited", "Unlimited"] },
                { label: "Manager Overview Dash", val: ["✗", "✗", "✓", "✓", "✓"] },
                { label: "Team ROI Analytics", val: ["✗", "✗", "✓", "✓", "✓"] },
                { label: "AI Upload Docs Limit", val: ["3 uploads", "10 uploads", "50 uploads", "Unlimited", "Unlimited"] }
              ].map((row, idx) => (
                <tr key={idx} className="hover:bg-white/2 transition-colors">
                  <td className="py-4 px-6 font-bold text-gray-300">{row.label}</td>
                  {row.val.map((v, vIdx) => (
                    <td
                      key={vIdx}
                      className={`py-4 px-6 text-center font-semibold ${
                        v === "✓" ? "text-[#00D68F]" : v === "✗" ? "text-gray-600" : "text-gray-400"
                      }`}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice history */}
      <div className="bg-[#121225] border border-gray-800/40 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-gray-850">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Payment Invoice logs</h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-850 text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                <th className="py-4 px-6">Date</th>
                <th className="py-4 px-6">Plan Key</th>
                <th className="py-4 px-6 text-center">Amount Paid</th>
                <th className="py-4 px-6 text-center">Reference</th>
                <th className="py-4 px-6 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-850">
              {invoices.length > 0 ? (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-white/2 transition-colors">
                    <td className="py-4 px-6 font-medium text-gray-400">{inv.date}</td>
                    <td className="py-4 px-6 font-bold text-white capitalize">{inv.plan}</td>
                    <td className="py-4 px-6 text-center font-display font-black text-white">
                      ₦{(inv.amount / 100).toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-center font-mono text-xs text-gray-500">{inv.ref}</td>
                    <td className="py-4 px-6 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-emerald-950/20 border-emerald-500/20 text-emerald-400">
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    No payment invoices logged.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
