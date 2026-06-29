"use client"

import { useState, useEffect, useRef } from "react"
import { useProfile } from "@/hooks/useProfile"
import { db } from "@/utils/firebase/client"
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  orderBy,
  limit
} from "firebase/firestore"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Objection {
  id: string
  objection: string
  category: string
  difficulty: "beginner" | "intermediate" | "advanced"
  isCustom?: boolean
  companyId?: string
}

interface EvalResult {
  score: number
  verdict: "Excellent" | "Good" | "Developing" | "Weak"
  feedback: string
  strengths: string[]
  weaknesses: string[]
  missed_points: string[]
  better_response: string
  xp_earned: number
}

interface WeakAreaGroup {
  objectionText: string
  objectionId: string
  category: string
  avgScore: number
  count: number
}

// ─── Static built-in objection library (fallback) ────────────────────────────

const BUILT_IN_OBJECTIONS: Omit<Objection, "id">[] = [
  { objection: "The price is too high. I've seen cheaper properties in Lekki.", category: "pricing", difficulty: "intermediate" },
  { objection: "I don't trust off-plan properties. What if construction never finishes?", category: "objections", difficulty: "advanced" },
  { objection: "I need to think about it. Can you call me next month?", category: "objections", difficulty: "beginner" },
  { objection: "My lawyer said the C of O in that area is problematic.", category: "policies", difficulty: "advanced" },
  { objection: "I can get a better return putting my money in dollar fixed deposits right now.", category: "pricing", difficulty: "intermediate" },
  { objection: "I'm in the UK. How do I manage a property in Nigeria from abroad?", category: "faq", difficulty: "intermediate" },
  { objection: "What happens if I lose my job during the installment payment period?", category: "policies", difficulty: "intermediate" },
  { objection: "Landwey is offering something similar for less. Why should I choose you?", category: "competitors", difficulty: "advanced" },
  { objection: "I've heard stories about developers abandoning projects in Lekki. How are you different?", category: "objections", difficulty: "advanced" },
  { objection: "Can I resell the property if I change my mind before completion?", category: "policies", difficulty: "beginner" },
  { objection: "My family thinks real estate in Nigeria is too risky right now.", category: "objections", difficulty: "beginner" },
  { objection: "20% initial deposit is still a lot of money. Can you reduce it?", category: "pricing", difficulty: "intermediate" }
]

const CATEGORY_COLORS: Record<string, string> = {
  pricing: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  objections: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  policies: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  faq: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  competitors: "bg-red-500/10 text-red-400 border-red-500/20",
  general: "bg-gray-500/10 text-gray-400 border-gray-500/20"
}

const SCORE_COLOR = (score: number) => {
  if (score >= 90) return { text: "text-[#00D68F]", bg: "bg-[#00D68F]", border: "border-[#00D68F]", ring: "#00D68F" }
  if (score >= 70) return { text: "text-blue-400", bg: "bg-blue-500", border: "border-blue-500", ring: "#3B82F6" }
  if (score >= 50) return { text: "text-amber-400", bg: "bg-amber-500", border: "border-amber-500", ring: "#FFB800" }
  return { text: "text-red-400", bg: "bg-red-500", border: "border-red-500", ring: "#FF3B30" }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ObjectionsPage() {
  const { profile, company } = useProfile()

  // Tab / mode
  const [activeTab, setActiveTab] = useState<"random" | "browse" | "weak">("random")

  // Objection library
  const [allObjections, setAllObjections] = useState<Objection[]>([])
  const [weakAreas, setWeakAreas] = useState<WeakAreaGroup[]>([])
  const [loadingObjections, setLoadingObjections] = useState(true)

  // Active drill
  const [currentObjection, setCurrentObjection] = useState<Objection | null>(null)
  const [userResponse, setUserResponse] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Results
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null)

  // Custom objection modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [customObjText, setCustomObjText] = useState("")
  const [customObjCategory, setCustomObjCategory] = useState("objections")
  const [addingCustom, setAddingCustom] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Load objections ──────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoadingObjections(true)
      let firestoreObjections: Objection[] = []

      try {
        // Fetch global objection library
        const globalSnap = await getDocs(
          query(collection(db, "objection_library"), where("isCustom", "==", false))
        )
        globalSnap.forEach((docSnap) => {
          const d = docSnap.data()
          firestoreObjections.push({
            id: docSnap.id,
            objection: d.objection || d.text || "",
            category: d.category || "general",
            difficulty: d.difficulty || "beginner"
          })
        })

        // Fetch company-specific custom objections
        if (company?.id) {
          const customSnap = await getDocs(
            query(
              collection(db, "objection_library"),
              where("companyId", "==", company.id),
              where("isCustom", "==", true)
            )
          )
          customSnap.forEach((docSnap) => {
            const d = docSnap.data()
            firestoreObjections.unshift({
              id: docSnap.id,
              objection: d.objection || d.text || "",
              category: d.category || "general",
              difficulty: d.difficulty || "beginner",
              isCustom: true,
              companyId: d.companyId
            })
          })
        }
      } catch (err) {
        console.error("Error loading objection library:", err)
      }

      // Merge with built-ins if Firestore returned nothing
      if (firestoreObjections.length === 0) {
        firestoreObjections = BUILT_IN_OBJECTIONS.map((o, i) => ({ ...o, id: `builtin-${i}` }))
      }

      setAllObjections(firestoreObjections)
      setLoadingObjections(false)

      // Pick a random objection for the default tab
      if (firestoreObjections.length > 0) {
        const rand = firestoreObjections[Math.floor(Math.random() * firestoreObjections.length)]
        setCurrentObjection(rand)
      }
    }

    load()
  }, [company?.id])

  // ── Load weak areas ──────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== "weak" || !profile?.id) return

    async function loadWeakAreas() {
      try {
        const snap = await getDocs(
          query(
            collection(db, "objection_sessions"),
            where("userId", "==", profile!.id),
            orderBy("createdAt", "desc"),
            limit(50)
          )
        )

        const grouped: Record<string, { scores: number[]; id: string; category: string }> = {}
        snap.forEach((docSnap) => {
          const d = docSnap.data()
          const key = d.objectionId || d.objectionText?.slice(0, 60) || docSnap.id
          if (!grouped[key]) {
            grouped[key] = { scores: [], id: d.objectionId || docSnap.id, category: d.category || "general" }
          }
          grouped[key].scores.push(d.aiScore || 0)
        })

        const weakList: WeakAreaGroup[] = Object.entries(grouped)
          .map(([text, data]) => ({
            objectionText: text,
            objectionId: data.id,
            category: data.category,
            avgScore: Math.round(data.scores.reduce((s, v) => s + v, 0) / data.scores.length),
            count: data.scores.length
          }))
          .filter((w) => w.avgScore < 60)
          .sort((a, b) => a.avgScore - b.avgScore)

        setWeakAreas(weakList)
      } catch (err) {
        console.error("Error loading weak areas:", err)
      }
    }

    loadWeakAreas()
  }, [activeTab, profile?.id, profile])

  // ── Select an objection to drill ─────────────────────────────────────────
  const selectObjection = (obj: Objection) => {
    setCurrentObjection(obj)
    setUserResponse("")
    setEvalResult(null)
    setSubmitError(null)
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  const pickRandom = () => {
    if (allObjections.length === 0) return
    const rand = allObjections[Math.floor(Math.random() * allObjections.length)]
    selectObjection(rand)
  }

  // ── Submit response for evaluation ───────────────────────────────────────
  const handleSubmit = async () => {
    if (!currentObjection || !company?.id || userResponse.trim().length < 80) return

    setSubmitting(true)
    setSubmitError(null)
    setEvalResult(null)

    try {
      const res = await fetch("/api/evaluate-objection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectionText: currentObjection.objection,
          userResponse: userResponse.trim(),
          companyId: company.id,
          objectionId: currentObjection.id
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Evaluation failed")

      setEvalResult(data.evaluation)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Add custom objection ──────────────────────────────────────────────────
  const handleAddCustom = async () => {
    if (!customObjText.trim() || !company?.id) return
    setAddingCustom(true)
    try {
      const docRef = await addDoc(collection(db, "objection_library"), {
        objection: customObjText.trim(),
        category: customObjCategory,
        difficulty: "intermediate",
        isCustom: true,
        companyId: company.id,
        createdAt: new Date().toISOString()
      })
      const newObj: Objection = {
        id: docRef.id,
        objection: customObjText.trim(),
        category: customObjCategory,
        difficulty: "intermediate",
        isCustom: true,
        companyId: company.id
      }
      setAllObjections((prev) => [newObj, ...prev])
      setCustomObjText("")
      setShowAddModal(false)
    } catch (err) {
      console.error("Failed to add custom objection:", err)
    } finally {
      setAddingCustom(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  const charCount = userResponse.length
  const canSubmit = charCount >= 80 && !submitting

  // ── RESULTS VIEW ──────────────────────────────────────────────────────────
  if (evalResult && currentObjection) {
    const colors = SCORE_COLOR(evalResult.score)
    const circumference = 2 * Math.PI * 52

    return (
      <div className="max-w-4xl mx-auto space-y-8 font-body">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest font-mono text-gray-500">Coaching Evaluation</span>
            <h1 className="text-2xl font-display font-extrabold text-white mt-0.5">Objection Response Analysis</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setEvalResult(null); setUserResponse("") }}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 text-xs font-bold rounded-xl transition-all"
            >
              Retry This Objection
            </button>
            <button
              onClick={() => { setEvalResult(null); setUserResponse(""); pickRandom() }}
              className="px-4 py-2 bg-[#00D68F] hover:bg-[#00b378] text-[#080810] text-xs font-bold rounded-xl transition-all"
            >
              Drill Another
            </button>
          </div>
        </div>

        {/* Score + Verdict Banner */}
        <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-center">
          {/* Score ring */}
          <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
            <svg width="136" height="136" className="transform -rotate-90">
              <circle cx="68" cy="68" r="52" fill="transparent" stroke="#1C1C35" strokeWidth="8" />
              <circle
                cx="68" cy="68" r="52" fill="transparent"
                stroke={colors.ring} strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (circumference * evalResult.score) / 100}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-black font-mono ${colors.text}`}>{evalResult.score}</span>
              <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">/ 100</span>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${colors.text} ${colors.border} bg-transparent border`}>
                {evalResult.verdict}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#00D68F]/10 text-[#00D68F] border border-[#00D68F]/20">
                +{evalResult.xp_earned} XP Awarded
              </span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed italic border-l-2 border-[#00D68F]/40 pl-4">
              &ldquo;{evalResult.feedback}&rdquo;
            </p>
          </div>
        </div>

        {/* Objection shown / Response comparison */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-5 space-y-3">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">Customer Objection</span>
            <p className="text-sm text-gray-200 leading-relaxed italic">&ldquo;{currentObjection.objection}&rdquo;</p>
          </div>
          <div className="bg-[#12121E] border border-[#00D68F]/30 rounded-2xl p-5 space-y-3">
            <span className="text-[10px] uppercase font-bold text-[#00D68F]/70 tracking-wider block">Better Response (AI Model)</span>
            <p className="text-sm text-gray-200 leading-relaxed">{evalResult.better_response}</p>
          </div>
        </div>

        {/* Strengths / Weaknesses */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-5 space-y-4">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">✅ Strengths</span>
            <div className="flex flex-wrap gap-2">
              {evalResult.strengths.map((s, i) => (
                <span key={i} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-green-950/20 text-green-300 border border-green-500/20">
                  {s}
                </span>
              ))}
              {evalResult.strengths.length === 0 && (
                <span className="text-xs text-gray-500 italic">No clear strengths detected — keep practicing!</span>
              )}
            </div>
          </div>
          <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-5 space-y-4">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">❌ Weaknesses</span>
            <div className="flex flex-wrap gap-2">
              {evalResult.weaknesses.map((w, i) => (
                <span key={i} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-red-950/20 text-red-300 border border-red-500/20">
                  {w}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Missed Points */}
        {evalResult.missed_points.length > 0 && (
          <div className="bg-[#12121E] border border-amber-500/20 rounded-2xl p-5 space-y-4">
            <span className="text-[10px] uppercase font-bold text-amber-500/70 tracking-wider block">⚡ Missed Points — You Should Have Said</span>
            <ul className="space-y-2">
              {evalResult.missed_points.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-amber-500 mt-0.5 shrink-0">▸</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA bottom */}
        <div className="bg-[#1C1C35] border border-gray-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <p className="text-white font-display font-bold text-sm">Keep sharpening your pitch</p>
            <p className="text-xs text-gray-400 mt-1">Each drill updates your Objection Score on the home dashboard in real-time.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setEvalResult(null); setUserResponse(""); pickRandom() }}
              className="px-5 py-2.5 bg-[#00D68F] hover:bg-[#00b378] text-[#080810] font-bold text-xs rounded-xl transition-all"
            >
              Drill Another →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── DRILL VIEW ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-8 font-body">

      {/* Page header */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold text-white">
            Objection <span className="text-[#00D68F]">Drill Engine</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Practice responding to real customer objections. AI coaches score you and give model answers.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-200 text-xs font-bold rounded-xl transition-all flex items-center gap-2"
        >
          <span>＋</span> Add Custom Objection
        </button>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-1 bg-[#12121E] border border-gray-800/80 rounded-2xl p-1.5 max-w-md">
        {(["random", "browse", "weak"] as const).map((tab) => {
          const labels = { random: "🎲 Random Drill", browse: "📋 Browse & Pick", weak: "⚠️ My Weak Areas" }
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab
                  ? "bg-[#00D68F] text-[#080810] shadow-lg"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {labels[tab]}
            </button>
          )
        })}
      </div>

      {/* ─ TAB: BROWSE & PICK ─ */}
      {activeTab === "browse" && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Select an Objection to Drill</h2>
          {loadingObjections ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-t-[#00D68F] border-gray-800 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {allObjections.map((obj) => (
                <button
                  key={obj.id}
                  onClick={() => selectObjection(obj)}
                  className={`text-left p-4 rounded-2xl border transition-all hover:border-[#00D68F]/40 hover:bg-[#00D68F]/5 ${
                    currentObjection?.id === obj.id
                      ? "border-[#00D68F] bg-[#00D68F]/5"
                      : "border-gray-800/80 bg-[#12121E]"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded border uppercase tracking-wider ${CATEGORY_COLORS[obj.category] || CATEGORY_COLORS.general}`}>
                      {obj.category}
                    </span>
                    {obj.isCustom && (
                      <span className="px-2 py-0.5 text-[9px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded uppercase">
                        Custom
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-200 leading-relaxed line-clamp-3 italic">
                    &ldquo;{obj.objection}&rdquo;
                  </p>
                  <div className="mt-2">
                    <span className="text-[10px] text-gray-500 capitalize font-mono">{obj.difficulty}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─ TAB: WEAK AREAS ─ */}
      {activeTab === "weak" && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Objections Averaging Below 60%</h2>
          {weakAreas.length === 0 ? (
            <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-8 text-center space-y-3">
              <div className="text-2xl">🏆</div>
              <h3 className="font-display font-bold text-white">No Weak Areas Detected!</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                You&apos;re scoring above 60% on all drilled objections. Keep drilling to maintain peak performance or try harder objections.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {weakAreas.map((area, i) => (
                <div key={i} className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-5 flex justify-between items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-gray-200 italic line-clamp-2">&ldquo;{area.objectionText}&rdquo;</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`px-2 py-0.5 text-[9px] font-bold rounded border uppercase tracking-wider ${CATEGORY_COLORS[area.category] || CATEGORY_COLORS.general}`}>
                        {area.category}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">{area.count} attempt{area.count !== 1 ? "s" : ""}</span>
                      <span className="text-xs font-bold text-red-400 font-mono">{area.avgScore}% avg</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const found = allObjections.find((o) => o.id === area.objectionId)
                      if (found) selectObjection(found)
                      else selectObjection({ id: area.objectionId, objection: area.objectionText, category: area.category, difficulty: "intermediate" })
                      setActiveTab("random")
                    }}
                    className="px-4 py-2 bg-red-950/30 hover:bg-red-950/60 border border-red-500/20 text-red-200 text-xs font-bold rounded-xl transition-all shrink-0"
                  >
                    Re-Drill →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─ DRILL PANEL (shown for Random + Browse if objection selected) ─ */}
      {(activeTab === "random" || (activeTab === "browse" && currentObjection)) && (
        <div className="space-y-6">
          {activeTab === "random" && (
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Current Objection</h2>
              <button
                onClick={pickRandom}
                className="text-xs font-bold text-[#00D68F] hover:text-[#00b378] transition-colors flex items-center gap-1"
              >
                🔀 New Random
              </button>
            </div>
          )}

          {currentObjection ? (
            <>
              {/* Customer Speech Bubble */}
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-[#1C1C35] border border-gray-700 flex items-center justify-center text-lg shrink-0 mt-1">
                  👤
                </div>
                <div className="flex-1 bg-[#1C1C35] border border-gray-700/80 rounded-2xl rounded-tl-sm p-5 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Customer says:</span>
                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded border uppercase tracking-wider ${CATEGORY_COLORS[currentObjection.category] || CATEGORY_COLORS.general}`}>
                      {currentObjection.category}
                    </span>
                    <span className="text-[10px] font-mono text-gray-600 capitalize">{currentObjection.difficulty}</span>
                  </div>
                  <p className="text-xl font-display font-bold text-white leading-snug">
                    &ldquo;{currentObjection.objection}&rdquo;
                  </p>
                </div>
              </div>

              {/* Response textarea */}
              <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Your Response</span>
                  <span className={`text-xs font-mono font-bold ${charCount >= 80 ? "text-[#00D68F]" : "text-gray-500"}`}>
                    {charCount} / 80 min
                  </span>
                </div>

                <textarea
                  ref={textareaRef}
                  value={userResponse}
                  onChange={(e) => setUserResponse(e.target.value)}
                  placeholder="Type your response exactly as you would say it to the client..."
                  rows={5}
                  className="w-full bg-[#080810] border border-gray-800 rounded-xl px-4 py-3 text-sm text-[#F2F2F7] placeholder-gray-600 focus:outline-none focus:border-[#00D68F] focus:ring-1 focus:ring-[#00D68F] resize-none transition-all leading-relaxed"
                />

                <div className="flex items-center gap-2 p-3 bg-[#080810]/50 rounded-xl border border-gray-800/50">
                  <span className="text-amber-500 text-sm">💡</span>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    <strong className="text-gray-300">Coach tip:</strong> Acknowledge their concern first, then address it with a specific fact or number, and redirect to a next step.
                  </p>
                </div>

                {submitError && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/25 text-red-200 text-xs">
                    {submitError}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="w-full py-3.5 bg-[#00D68F] hover:bg-[#00b378] text-[#080810] font-bold font-display rounded-xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-t-transparent border-[#080810] rounded-full animate-spin"></div>
                      AI Coach is evaluating your response...
                    </>
                  ) : (
                    <>
                      <span>🧠</span>
                      Submit Response for AI Coaching
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-t-[#00D68F] border-gray-800 rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      )}

      {/* ─ ADD CUSTOM OBJECTION MODAL ─ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-[#080810]/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)}></div>
          <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-6 max-w-md w-full relative z-10 space-y-5">
            <div>
              <h3 className="font-display font-bold text-white text-lg">Add Custom Objection</h3>
              <p className="text-xs text-gray-400 mt-1">
                Add a real objection your customers frequently raise. It will appear in your company&apos;s drill library.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Objection Text
                </label>
                <textarea
                  value={customObjText}
                  onChange={(e) => setCustomObjText(e.target.value)}
                  placeholder="e.g. The estate doesn't have 24-hour power supply yet, why should I buy now?"
                  rows={3}
                  className="w-full bg-[#080810] border border-gray-800 rounded-xl px-4 py-3 text-sm text-[#F2F2F7] placeholder-gray-600 focus:outline-none focus:border-[#00D68F] focus:ring-1 focus:ring-[#00D68F] resize-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Category
                </label>
                <select
                  value={customObjCategory}
                  onChange={(e) => setCustomObjCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#080810] border border-gray-800 text-[#F2F2F7] focus:outline-none focus:border-[#00D68F] transition-all text-sm cursor-pointer"
                >
                  <option value="objections">Objections</option>
                  <option value="pricing">Pricing</option>
                  <option value="policies">Policies</option>
                  <option value="faq">FAQ</option>
                  <option value="competitors">Competitors</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustom}
                disabled={!customObjText.trim() || addingCustom}
                className="px-4 py-2 bg-[#00D68F] hover:bg-[#00b378] text-[#080810] font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {addingCustom ? "Adding..." : "Add to Library"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
