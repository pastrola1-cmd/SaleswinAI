"use client"

import React from "react"
import { useProfile } from "@/hooks/useProfile"
import Link from "next/link"

const PLAN_LEVELS: Record<string, number> = {
  free: 1,
  pro: 2,
  starter: 3,
  growth: 4,
  enterprise: 5
}

interface PaywallGateProps {
  children: React.ReactNode
  requiredPlan: "free" | "pro" | "starter" | "growth" | "enterprise"
  featureName?: string
}

export default function PaywallGate({
  children,
  requiredPlan,
  featureName = "this premium feature"
}: PaywallGateProps) {
  const { company, loading } = useProfile()

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-t-[#00D68F] border-gray-800 rounded-full animate-spin"></div>
      </div>
    )
  }

  const currentPlan = (company?.plan || "free").toLowerCase()
  const currentLevel = PLAN_LEVELS[currentPlan] || 1
  const requiredLevel = PLAN_LEVELS[requiredPlan] || 1

  if (currentLevel >= requiredLevel) {
    return <>{children}</>
  }

  const capitalizedRequired = requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)

  return (
    <div className="relative rounded-2xl overflow-hidden border border-gray-850 p-1">
      {/* Blurred background layout of children */}
      <div className="blur-md opacity-25 select-none pointer-events-none">
        {children}
      </div>

      {/* Paywall Overlay */}
      <div className="absolute inset-0 flex items-center justify-center p-6 bg-[#080810]/70 backdrop-blur-xs">
        <div className="max-w-md w-full p-8 rounded-2xl bg-[#121225]/90 border border-[#00D68F]/30 text-center space-y-6 shadow-2xl shadow-[#00D68F]/5">
          <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto text-2xl animate-pulse">
            🔒
          </div>

          <div className="space-y-2">
            <span className="inline-block px-2.5 py-0.5 text-[9px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded uppercase tracking-widest">
              Plan Upgrade Required
            </span>
            <h3 className="font-display font-black text-white text-xl">
              Available on {capitalizedRequired} Plan
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Access to {featureName} is locked on your current {company?.plan || "Free"} plan.
              Upgrade your company workspace to unlock manager dashboards, analytics, and custom real estate drills.
            </p>
          </div>

          <Link
            href="/dashboard/billing"
            className="inline-block w-full py-3 bg-[#00D68F] hover:bg-[#00b378] text-[#080810] font-bold rounded-xl text-xs uppercase tracking-wider transition-colors shadow-lg shadow-[#00D68F]/10"
          >
            Upgrade Company Plan
          </Link>
        </div>
      </div>
    </div>
  )
}
