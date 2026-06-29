"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useProfile } from "@/hooks/useProfile"
import { db } from "@/utils/firebase/client"
import { collection, addDoc } from "firebase/firestore"

interface Persona {
  key: string
  name: string
  title: string
  description: string
  avatar: string
  color: string
}

const PERSONAS: Persona[] = [
  {
    key: "sarah_m",
    name: "Sarah M.",
    title: "First-time Buyer",
    description: "Budget ₦8M. Excited but nervous. Needs guidance and reassurance on documentation.",
    avatar: "SM",
    color: "from-pink-500/20 to-rose-500/20 border-pink-500/30 text-pink-400"
  },
  {
    key: "alhaji_musa",
    name: "Alhaji Musa",
    title: "Busy Investor",
    description: "Needs hard ROI numbers, development timelines, and yield projections. Zero small talk.",
    avatar: "AM",
    color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400"
  },
  {
    key: "mrs_okonkwo",
    name: "Mrs. Okonkwo",
    title: "The Skeptic",
    description: "Had a bad experience with a fraudulent developer. Extremely cautious, needs deep trust-building.",
    avatar: "MO",
    color: "from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400"
  },
  {
    key: "david_a",
    name: "David A.",
    title: "The Comparator",
    description: "Comparing 3 estates along the same Lekki axis. Needs strong USPs and value differentiation.",
    avatar: "DA",
    color: "from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-400"
  },
  {
    key: "bola_tunde",
    name: "Bola & Tunde",
    title: "The Couple",
    description: "She is ready to buy; he is highly skeptical of the location's future growth. Must close both.",
    avatar: "BT",
    color: "from-purple-500/20 to-violet-500/20 border-purple-500/30 text-purple-400"
  },
  {
    key: "lagos_corporate",
    name: "Lagos Corporate Ltd",
    title: "Corporate Buyer",
    description: "Looking for 5 units for staff housing. Expecting bulk discount, commercial terms, and official invoices.",
    avatar: "LC",
    color: "from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-400"
  }
]

const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp", icon: "📱", desc: "Green chat bubble interface", color: "hover:border-[#00D68F]/60" },
  { key: "phone", label: "Phone Call", icon: "📞", desc: "Call transcript dialogue style", color: "hover:border-blue-500/60" },
  { key: "face_to_face", label: "Face-to-Face", icon: "🤝", desc: "Clean dialogue presentation", color: "hover:border-purple-500/60" },
  { key: "email", label: "Email", icon: "✉️", desc: "Professional nested email thread", color: "hover:border-amber-500/60" }
]

const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced", "Expert"]

export default function PracticeSetupPage() {
  const router = useRouter()
  const { profile, company } = useProfile()
  const [selectedChannel, setSelectedChannel] = useState("whatsapp")
  const [selectedDifficulty, setSelectedDifficulty] = useState("Beginner")
  const [selectedPersona, setSelectedPersona] = useState("sarah_m")
  const [loading, setLoading] = useState(false)

  const handleStartSimulation = async () => {
    if (!profile?.id || !company?.id) return
    setLoading(true)

    const persona = PERSONAS.find(p => p.key === selectedPersona)!

    try {
      const docRef = await addDoc(collection(db, "simulation_sessions"), {
        userId: profile.id,
        companyId: company.id,
        personaKey: selectedPersona,
        personaName: persona.name,
        channel: selectedChannel,
        difficulty: selectedDifficulty.toLowerCase(),
        messages: [],
        status: "active",
        scores: {
          overall: 0,
          discovery: 0,
          trust: 0,
          objection: 0,
          closing: 0,
          communication: 0,
          productKnowledge: 0
        },
        outcome: "pending",
        outcomeReason: "",
        aiDebrief: "",
        topStrengths: [],
        criticalMistakes: [],
        xpEarned: 0,
        messageCount: 0,
        startedAt: new Date(),
        completedAt: null
      })

      // Trigger the opening message — await it but navigate regardless
      // (the session page has retry logic if __START__ fails)
      try {
        const startRes = await fetch("/api/simulate-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: docRef.id,
            userMessage: "__START__"
          })
        })
        if (!startRes.ok) {
          console.error("__START__ returned non-OK:", startRes.status)
        }
      } catch (err) {
        console.error("Failed to start simulation conversation:", err)
      }

      router.push(`/dashboard/practice/${docRef.id}`)
    } catch (err) {
      console.error("Error creating session:", err)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 font-body">
      <div>
        <h1 className="text-3xl font-display font-black text-white">
          Choose Your Sales Scenario
        </h1>
        <p className="text-gray-400 mt-2 text-sm">
          Test your conversion skills in real-time, channel-specific sales simulation sessions.
        </p>
      </div>

      {/* 1. Channel Selector */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          1. Select Communication Channel
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {CHANNELS.map(c => (
            <div
              key={c.key}
              onClick={() => setSelectedChannel(c.key)}
              className={`p-5 rounded-xl bg-[#121225] border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 ${c.color} ${
                selectedChannel === c.key
                  ? "border-[#00D68F] ring-1 ring-[#00D68F] bg-[#121225]/80"
                  : "border-gray-800/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl">{c.icon}</span>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  selectedChannel === c.key ? "border-[#00D68F] bg-[#00D68F]/10" : "border-gray-700"
                }`}>
                  {selectedChannel === c.key && <div className="w-2 h-2 rounded-full bg-[#00D68F]" />}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{c.label}</h3>
                <p className="text-xs text-gray-500 mt-1">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Difficulty Selection */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          2. Difficulty Level
        </h2>
        <div className="flex flex-wrap gap-2">
          {DIFFICULTIES.map(d => (
            <button
              key={d}
              onClick={() => setSelectedDifficulty(d)}
              className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 border ${
                selectedDifficulty === d
                  ? "bg-[#00D68F] text-[#080810] border-[#00D68F] shadow-lg shadow-[#00D68F]/10"
                  : "bg-[#121225] text-gray-400 border-gray-800/40 hover:text-white hover:border-gray-700"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Persona Selector */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          3. Select Buyer Persona
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PERSONAS.map(p => (
            <div
              key={p.key}
              onClick={() => setSelectedPersona(p.key)}
              className={`p-5 rounded-xl bg-[#121225] border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 hover:bg-[#121225]/80 ${
                selectedPersona === p.key
                  ? "border-[#00D68F] ring-1 ring-[#00D68F]"
                  : "border-gray-800/40"
              }`}
            >
              <div className="flex items-start space-x-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.color} border flex items-center justify-center font-display font-black text-lg`}>
                  {p.avatar}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{p.name}</h3>
                  <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-[#1C1C35] rounded-md text-gray-400 border border-gray-800 mt-1 uppercase tracking-wider">
                    {p.title}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed min-h-[48px]">
                {p.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Action */}
      <div className="pt-4 flex justify-end">
        <button
          onClick={handleStartSimulation}
          disabled={loading || !profile?.id}
          className="w-full md:w-auto px-8 py-4 rounded-xl font-bold bg-[#00D68F] text-[#080810] hover:bg-[#00b378] disabled:opacity-50 transition-all text-sm tracking-wider uppercase shadow-lg shadow-[#00D68F]/10 flex items-center justify-center space-x-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-t-transparent border-[#080810] rounded-full animate-spin"></div>
              <span>Initializing Simulator...</span>
            </>
          ) : (
            <span>Start Practice Session</span>
          )}
        </button>
      </div>
    </div>
  )
}
