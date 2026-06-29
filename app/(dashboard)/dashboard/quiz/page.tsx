"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useProfile } from "@/hooks/useProfile"
import Link from "next/link"

const CATEGORIES = [
  { id: "all", name: "All Topics", icon: "📚", desc: "Test across all product details, policies, and pricing tables." },
  { id: "products", name: "Products & Services", icon: "🏠", desc: "Lekki Smart Haven developments, build specs, and site layout details." },
  { id: "pricing", name: "Pricing & Plans", icon: "💰", desc: "Outright discounts, installment schedules, and initial deposits." },
  { id: "objections", name: "Objection Handling", icon: "🛡️", desc: "Handling client hesitations, title questions, and warranty queries." },
  { id: "policies", name: "Policies & Terms", icon: "📝", desc: "Client inspection protocols, documentation parameters, and refunds." },
  { id: "faq", name: "FAQs", icon: "❓", desc: "Common questions asked by Diaspora real estate investors." }
]

const DIFFICULTIES = [
  { id: "beginner", name: "Beginner", icon: "🟢", desc: "Foundation facts, basic prices, and standard property guidelines." },
  { id: "intermediate", name: "Intermediate", icon: "🟡", desc: "Detailed payment terms, competitor comparisons, and build specs." },
  { id: "advanced", name: "Advanced", icon: "🔴", desc: "Complex legal clauses, refund exclusions, and structural calculations." }
]

const COUNTS = [5, 10, 20]

export default function QuizStartPage() {
  const router = useRouter()
  const { company, loading: profileLoading } = useProfile()
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedDifficulty, setSelectedDifficulty] = useState("intermediate")
  const [selectedCount, setSelectedCount] = useState(10)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStartQuiz = async () => {
    if (!company?.id) {
      setError("No company workspace detected. Join or create a company first.")
      return
    }

    setError(null)
    setGenerating(true)

    try {
      const res = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          companyId: company.id,
          category: selectedCategory,
          difficulty: selectedDifficulty,
          count: selectedCount
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate training quiz")
      }

      router.push(`/dashboard/quiz/${data.sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  if (profileLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-10 h-10 border-4 border-t-[#00D68F] border-gray-800 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 font-body">
      
      {/* Title block */}
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-extrabold text-white">
          Test Your <span className="text-[#00D68F]">Business Knowledge</span>
        </h1>
        <p className="text-sm text-gray-400">
          Generate custom testing quizzes powered by your uploaded company knowledge. Verify details, pricing, and rules.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/25 text-red-200 text-sm space-y-2">
          <p className="font-semibold">Generation Failed</p>
          <p className="text-xs text-red-300 leading-relaxed">{error}</p>
          {error.includes("Upload company knowledge") && (
            <Link
              href="/dashboard/knowledge"
              className="inline-block mt-1 text-xs font-bold text-[#00D68F] underline hover:text-[#00b378] transition-colors"
            >
              Go to Knowledge Base to upload documents &rarr;
            </Link>
          )}
        </div>
      )}

      {/* STEP A: Category Selector */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">1. Select Quiz Topic Focus</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id
            return (
              <div
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`cursor-pointer p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 hover:border-gray-700 ${
                  isSelected
                    ? "bg-[#00D68F]/5 border-[#00D68F] shadow-[0_0_12px_rgba(0,214,143,0.1)]"
                    : "bg-[#12121E] border-gray-800/80"
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="text-2xl">{cat.icon}</span>
                  <div className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center ${
                    isSelected ? "border-[#00D68F] bg-[#00D68F]" : "border-gray-700"
                  }`}>
                    {isSelected && <span className="text-[9px] text-[#080810] font-bold">✓</span>}
                  </div>
                </div>
                <div>
                  <h3 className={`font-display font-bold text-sm ${isSelected ? "text-[#00D68F]" : "text-white"}`}>
                    {cat.name}
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{cat.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* STEP B: Difficulty Selector & Count */}
      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Difficulty Choice */}
        <section className="md:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">2. Select Difficulty</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {DIFFICULTIES.map((diff) => {
              const isSelected = selectedDifficulty === diff.id
              return (
                <div
                  key={diff.id}
                  onClick={() => setSelectedDifficulty(diff.id)}
                  className={`cursor-pointer p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-3 hover:border-gray-700 ${
                    isSelected
                      ? "bg-[#00D68F]/5 border-[#00D68F] shadow-[0_0_12px_rgba(0,214,143,0.1)]"
                      : "bg-[#12121E] border-gray-800/80"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs">{diff.icon}</span>
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
                      {diff.id}
                    </span>
                  </div>
                  <div>
                    <h3 className={`font-display font-bold text-sm ${isSelected ? "text-[#00D68F]" : "text-white"}`}>
                      {diff.name}
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{diff.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Count Choice */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">3. Question Count</h2>
          <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-5 flex flex-col justify-between h-[135px]">
            <span className="text-[11px] text-gray-400 leading-relaxed">
              How many challenge questions do you want to tackle in this session?
            </span>
            <div className="grid grid-cols-3 gap-2">
              {COUNTS.map((cnt) => {
                const isSelected = selectedCount === cnt
                return (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setSelectedCount(cnt)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold font-mono transition-all border ${
                      isSelected
                        ? "bg-[#00D68F] text-[#080810] border-[#00D68F] shadow-lg"
                        : "bg-[#080810] border-gray-800 hover:border-gray-700 text-gray-300"
                    }`}
                  >
                    {cnt} Qs
                  </button>
                )
              })}
            </div>
          </div>
        </section>

      </div>

      {/* Action Button */}
      <div className="pt-4">
        <button
          onClick={handleStartQuiz}
          disabled={generating}
          className="w-full py-4 bg-[#00D68F] hover:bg-[#00b378] text-[#080810] font-bold font-display rounded-2xl text-base transition-all disabled:opacity-50 shadow-xl flex items-center justify-center space-x-2"
        >
          {generating ? (
            <>
              <div className="w-5 h-5 border-2 border-t-transparent border-[#080810] rounded-full animate-spin"></div>
              <span>Analyzing Knowledge Base & Generating Quiz...</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>Generate Quiz Challenge</span>
            </>
          )}
        </button>
      </div>

    </div>
  )
}
