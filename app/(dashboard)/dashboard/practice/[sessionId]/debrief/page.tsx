"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { db } from "@/utils/firebase/client"
import { doc, getDoc } from "firebase/firestore"

interface TurningPoint {
  messageIndex: number
  type: "strong" | "mistake" | "missed"
  quote: string
  explanation: string
}

export default function PracticeDebriefPage() {
  const router = useRouter()
  const { sessionId } = useParams() as { sessionId: string }
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showReplay, setShowReplay] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    const fetchSession = async () => {
      try {
        const docRef = doc(db, "simulation_sessions", sessionId)
        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
          setSession(docSnap.data())
        } else {
          router.push("/dashboard/practice")
        }
      } catch (err) {
        console.error("Failed to load debrief session:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchSession()
  }, [sessionId, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-t-[#00D68F] border-gray-800 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <p className="text-gray-400">Failed to load session details.</p>
        <Link href="/dashboard/practice" className="mt-4 inline-block text-[#00D68F] hover:underline">
          Back to practice setup
        </Link>
      </div>
    )
  }

  const scores = session.scores || {}
  const overall = scores.overall || 0
  const isWon = session.outcome === "converted"
  const messages = session.messages || []
  const turningPoints: TurningPoint[] = session.turningPoints || []

  // Create lookup for turning points by message index
  const turningPointLookup = turningPoints.reduce((acc, curr) => {
    acc[curr.messageIndex] = curr
    return acc
  }, {} as Record<number, TurningPoint>)

  // Score color helper
  const getScoreColor = (val: number) => {
    if (val >= 90) return "text-emerald-400"
    if (val >= 70) return "text-blue-400"
    if (val >= 50) return "text-amber-400"
    return "text-rose-400"
  }

  const getScoreBg = (val: number) => {
    if (val >= 90) return "bg-emerald-950/20 border-emerald-500/20"
    if (val >= 70) return "bg-blue-950/20 border-blue-500/20"
    if (val >= 50) return "bg-amber-950/20 border-amber-500/20"
    return "bg-rose-950/20 border-rose-500/20"
  }

  const ringColor = isWon ? "#00D68F" : "#FF3B30"

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16 font-body">
      
      {/* 1. Outcome Banner */}
      <div className={`p-6 rounded-2xl border flex flex-col md:flex-row items-center md:justify-between space-y-4 md:space-y-0 ${
        isWon ? "bg-[#00D68F]/10 border-[#00D68F]/30" : "bg-rose-500/10 border-rose-500/30"
      }`}>
        <div>
          <span className={`inline-block px-3 py-1 text-xs font-black uppercase tracking-wider rounded-full ${
            isWon ? "bg-[#00D68F]/20 text-[#00D68F]" : "bg-rose-500/20 text-rose-400"
          }`}>
            {isWon ? "✓ DEAL CLOSED" : "✗ DEAL LOST"}
          </span>
          <h1 className="text-2xl font-display font-black text-white mt-2">
            Practice Debrief: {session.personaName}
          </h1>
          <p className="text-sm text-gray-300 mt-2 leading-relaxed max-w-xl">
            {session.outcomeReason || "Evaluation complete."}
          </p>
        </div>
        <div className="flex items-center space-x-3 shrink-0">
          <div className="w-16 h-16 rounded-xl bg-[#1C1C35] border border-gray-800 flex flex-col items-center justify-center">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">XP</span>
            <span className="text-lg font-black text-[#00D68F]">+{session.xpEarned || 0}</span>
          </div>
        </div>
      </div>

      {/* 2. Top Section (Score Ring & Coach Debrief) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Animated Score Ring Card */}
        <div className="p-6 rounded-2xl bg-[#121225] border border-gray-800/40 flex flex-col items-center justify-center text-center space-y-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Overall Performance</h2>
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="54"
                stroke="#1c1c35"
                strokeWidth="10"
                fill="transparent"
              />
              <circle
                cx="64"
                cy="64"
                r="54"
                stroke={ringColor}
                strokeWidth="10"
                fill="transparent"
                strokeDasharray={339.29}
                strokeDashoffset={339.29 - (339.29 * overall) / 100}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-display font-black text-white">{overall}</span>
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">SCORE</span>
            </div>
          </div>
          <span className={`text-sm font-bold uppercase tracking-wider ${getScoreColor(overall)}`}>
            {overall >= 90 ? "Excellent Closer" : overall >= 70 ? "Good Progress" : overall >= 50 ? "Needs Practice" : "Weak Pitch"}
          </span>
        </div>

        {/* Coach Debrief Card */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-[#121225] border border-gray-800/40 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">AI Sales Coach Assessment</h2>
            <p className="text-sm text-gray-300 leading-relaxed italic mt-4">
              &ldquo;{session.aiDebrief || "Coaching summary is not generated."}&rdquo;
            </p>
          </div>
          {session.coachingFocus && (
            <div className="pt-4 border-t border-gray-800/40">
              <span className="text-xs text-gray-500 font-bold uppercase">Focus Area for Improvement: </span>
              <span className="text-xs font-bold text-[#00D68F] uppercase tracking-wider bg-[#00D68F]/10 border border-[#00D68F]/20 px-2 py-0.5 rounded ml-1">
                {session.coachingFocus.replace("_", " ")}
              </span>
            </div>
          )}
        </div>

      </div>

      {/* 3. Dimension Scores Grid */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          Performance Breakdown
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Discovery", value: scores.discovery || 0 },
            { label: "Trust Building", value: scores.trust || 0 },
            { label: "Objections", value: scores.objection || 0 },
            { label: "Closing", value: scores.closing || 0 },
            { label: "Communication", value: scores.communication || 0 },
            { label: "Product Info", value: scores.productKnowledge || 0 }
          ].map((dim, i) => (
            <div
              key={i}
              className={`p-4 rounded-xl border flex flex-col justify-between h-24 ${getScoreBg(dim.value)}`}
            >
              <span className="text-xs text-gray-400 font-semibold truncate">{dim.label}</span>
              <div className="flex items-baseline space-x-1">
                <span className={`text-2xl font-display font-black ${getScoreColor(dim.value)}`}>
                  {dim.value}
                </span>
                <span className="text-[10px] text-gray-600 font-bold">/100</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Strengths & Mistakes lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Top Strengths */}
        <div className="p-6 rounded-2xl bg-[#121225] border border-gray-800/40 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <span className="text-emerald-400">✓</span>
            <span>Top Strengths</span>
          </h3>
          <ul className="space-y-2">
            {(session.topStrengths || []).map((s: string, idx: number) => (
              <li key={idx} className="flex items-start space-x-3 p-3 rounded-xl bg-emerald-950/15 border border-emerald-500/10 text-xs text-gray-300 leading-relaxed">
                <span className="text-emerald-400 font-bold mt-0.5 shrink-0">+</span>
                <span>{s}</span>
              </li>
            ))}
            {(!session.topStrengths || session.topStrengths.length === 0) && (
              <li className="text-xs text-gray-500 italic">No specific strengths captured.</li>
            )}
          </ul>
        </div>

        {/* Critical Mistakes */}
        <div className="p-6 rounded-2xl bg-[#121225] border border-gray-800/40 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <span className="text-rose-400">✗</span>
            <span>Critical Mistakes</span>
          </h3>
          <ul className="space-y-2">
            {(session.criticalMistakes || []).map((m: string, idx: number) => (
              <li key={idx} className="flex items-start space-x-3 p-3 rounded-xl bg-rose-950/15 border border-rose-500/10 text-xs text-gray-300 leading-relaxed">
                <span className="text-rose-400 font-bold mt-0.5 shrink-0">-</span>
                <span>{m}</span>
              </li>
            ))}
            {(!session.criticalMistakes || session.criticalMistakes.length === 0) && (
              <li className="text-xs text-gray-500 italic">Excellent! No critical mistakes reported.</li>
            )}
          </ul>
        </div>

      </div>

      {/* 5. Turning Points (Warning List) */}
      {turningPoints.length > 0 && (
        <div className="p-6 rounded-2xl bg-[#121225] border border-gray-800/40 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <span>✨</span>
            <span>Key Turning Points</span>
          </h3>
          <div className="space-y-3">
            {turningPoints.map((tp, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border text-xs leading-relaxed space-y-2 ${
                  tp.type === "strong"
                    ? "bg-emerald-950/10 border-emerald-500/20"
                    : tp.type === "mistake"
                    ? "bg-rose-950/10 border-rose-500/20"
                    : "bg-amber-950/10 border-amber-500/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-bold uppercase tracking-wider text-[9px] px-2 py-0.5 rounded ${
                    tp.type === "strong"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : tp.type === "mistake"
                      ? "bg-rose-500/10 text-rose-400"
                      : "bg-amber-500/10 text-amber-400"
                  }`}>
                    {tp.type === "strong" ? "Strong Move" : tp.type === "mistake" ? "Fumble / Mistake" : "Missed Opportunity"}
                  </span>
                  <span className="text-[10px] text-gray-500 font-bold">Message #{tp.messageIndex}</span>
                </div>
                <p className="italic text-gray-400">&ldquo;{tp.quote}&rdquo;</p>
                <p className="text-gray-300 font-semibold">{tp.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Conversation Replay */}
      <div className="p-6 rounded-2xl bg-[#121225] border border-gray-800/40 space-y-4">
        <button
          onClick={() => setShowReplay(!showReplay)}
          className="w-full flex items-center justify-between font-bold text-sm text-white"
        >
          <span>💬 Conversation Replay</span>
          <span>{showReplay ? "Hide" : "Show"}</span>
        </button>

        {showReplay && (
          <div className="space-y-4 pt-4 border-t border-gray-850">
            {messages.map((m: any, idx: number) => {
              const tp = turningPointLookup[idx]
              let highlightClass = ""

              if (tp) {
                if (tp.type === "strong") highlightClass = "border-b-2 border-emerald-500 pb-0.5"
                if (tp.type === "mistake") highlightClass = "border-b-2 border-rose-500 pb-0.5"
                if (tp.type === "missed") highlightClass = "border-b-2 border-amber-500 pb-0.5"
              }

              return (
                <div
                  key={idx}
                  className={`flex flex-col space-y-1 ${m.role === "customer" ? "items-start text-left" : "items-end text-right"}`}
                >
                  <span className="text-[10px] text-gray-500 font-bold">
                    {m.role === "customer" ? session.personaName : "You"}
                  </span>
                  <div className={`p-3 rounded-xl text-xs max-w-xl ${
                    m.role === "customer" ? "bg-[#1C1C35]" : "bg-[#07241A] border border-[#00D68F]/10"
                  }`}>
                    <span className={highlightClass}>{m.content}</span>
                  </div>
                  {tp && (
                    <span className={`text-[10px] font-bold ${
                      tp.type === "strong" ? "text-emerald-400" : tp.type === "mistake" ? "text-rose-400" : "text-amber-400"
                    }`}>
                      {tp.explanation}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 7. Action CTAs */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-6 border-t border-gray-800/40">
        <Link
          href="/dashboard/practice"
          className="w-full sm:w-auto px-6 py-3 text-xs font-bold text-center uppercase tracking-wider bg-[#00D68F] text-[#080810] rounded-xl hover:bg-[#00b378] transition-colors"
        >
          Run Another
        </Link>
        <Link
          href="/dashboard/objections"
          className="w-full sm:w-auto px-6 py-3 text-xs font-bold text-center uppercase tracking-wider bg-gray-900 border border-gray-800 text-gray-300 hover:text-white rounded-xl transition-colors"
        >
          Drill Weak Areas
        </Link>
        <Link
          href="/dashboard/progress"
          className="w-full sm:w-auto px-6 py-3 text-xs font-bold text-center uppercase tracking-wider bg-gray-900 border border-gray-800 text-gray-300 hover:text-white rounded-xl transition-colors"
        >
          View My Progress
        </Link>
      </div>

    </div>
  )
}
