"use client"

import { useState, useEffect } from "react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts"

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
  created_at?: string
}

interface Progress {
  xp_total: number
  level: number
  level_title: string
  streak_days: number
  knowledge_score: number
  confidence_score: number
  conversion_score: number
  objection_score: number
  closing_score: number
  simulations_completed: number
  quizzes_completed: number
  objections_drilled: number
}

interface Session {
  id: string
  scenarioName?: string
  createdAt?: string
  score?: number
  xpEarned?: number
  durationSeconds?: number
  outcome?: string
}

interface WeakArea {
  category: string
  avgScore: number
}

interface CoachingItem {
  action: string
  reason: string
  priority: "high" | "medium" | "low"
}

interface RepProfileClientProps {
  member: Profile
  progress: Progress
  sessions: Session[]
  weakAreas: WeakArea[]
  sparklines: {
    conversion: any[]
    objection: any[]
    closing: any[]
    confidence: any[]
    knowledge: any[]
  }
  trendData: any[]
}

export default function RepProfileClient({
  member,
  progress,
  sessions,
  weakAreas,
  sparklines,
  trendData
}: RepProfileClientProps) {
  const [nudgeLoading, setNudgeLoading] = useState(false)
  const [nudgeStatus, setNudgeStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)
  
  // AI Coaching recommendations states
  const [coachingData, setCoachingData] = useState<CoachingItem[]>([])
  const [coachingLoading, setCoachingLoading] = useState(true)
  const [coachingError, setCoachingError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCoaching = async () => {
      setCoachingLoading(true)
      setCoachingError(null)
      try {
        const res = await fetch("/api/coaching-recommendation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: member.id })
        })

        if (!res.ok) {
          throw new Error("Failed to load coaching recommendation")
        }

        const data = await res.json()
        setCoachingData(data.recommendations || [])
      } catch (err) {
        console.error(err)
        setCoachingError("AI coaching insights temporarily unavailable.")
      } finally {
        setCoachingLoading(false)
      }
    }

    fetchCoaching()
  }, [member.id])

  const handleSendNudge = async () => {
    setNudgeLoading(true)
    setNudgeStatus(null)

    try {
      const res = await fetch("/api/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.id })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to send nudge")
      }

      setNudgeStatus({
        type: "success",
        message: `Nudge email sent to ${member.full_name || member.email}!`
      })
    } catch (err) {
      setNudgeStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to dispatch nudge reminder"
      })
    } finally {
      setNudgeLoading(false)
    }
  }

  const getInitials = (name: string | null) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase()
  }

  // Sparkline rendering helper
  const renderSparkline = (data: any[], strokeColor = "#00D68F") => {
    if (data.length === 0) return <div className="h-6" />
    return (
      <div className="h-6 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line type="monotone" dataKey="value" stroke={strokeColor} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className="space-y-8 font-body text-[#F2F2F7]">
      
      {/* Rep Overview Header */}
      <div className="bg-[#121225] border border-gray-800/40 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full bg-[#00D68F] text-[#080810] flex items-center justify-center font-black font-display text-2xl shrink-0">
            {getInitials(member.full_name)}
          </div>
          <div>
            <h2 className="text-2xl font-display font-black text-white">{member.full_name || "Sales Rep"}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="px-2 py-0.5 text-[10px] font-bold bg-[#00D68F]/10 text-[#00D68F] rounded uppercase tracking-wider border border-[#00D68F]/20">
                {member.role}
              </span>
              <span className="text-xs text-gray-500">•</span>
              <span className="text-xs text-gray-400">{member.email}</span>
              <span className="text-xs text-gray-500">•</span>
              <span className="text-xs text-gray-400">Joined: {member.created_at ? new Date(member.created_at).toLocaleDateString() : "N/A"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          {nudgeStatus && (
            <div className={`px-4 py-2 rounded-lg text-xs font-semibold ${
              nudgeStatus.type === "success" 
                ? "bg-emerald-950/40 border border-emerald-500/20 text-emerald-400" 
                : "bg-red-950/40 border border-red-500/20 text-red-400"
            }`}>
              {nudgeStatus.message}
            </div>
          )}

          <button
            onClick={handleSendNudge}
            disabled={nudgeLoading}
            className="px-5 py-2.5 bg-[#00D68F] hover:bg-[#00b378] text-[#080810] font-bold rounded-xl text-sm transition-all disabled:opacity-50 inline-flex items-center gap-2"
          >
            <span>💬</span>
            {nudgeLoading ? "Sending..." : "Send Nudge"}
          </button>
        </div>
      </div>

      {/* Metrics Row with Sparklines */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Knowledge", value: `${progress.knowledge_score}%`, color: "#00D68F", data: sparklines.knowledge, icon: "🧠" },
          { label: "Confidence", value: `${progress.confidence_score}%`, color: "#3B82F6", data: sparklines.confidence, icon: "⭐" },
          { label: "Conversion", value: `${progress.conversion_score}%`, color: "#EC4899", data: sparklines.conversion, icon: "🔥" },
          { label: "Objection", value: `${progress.objection_score}%`, color: "#F59E0B", data: sparklines.objection, icon: "🛡️" },
          { label: "Closing", value: `${progress.closing_score}%`, color: "#8B5CF6", data: sparklines.closing, icon: "🎯" }
        ].map((m, idx) => (
          <div key={idx} className="bg-[#121225] border border-gray-800/40 rounded-xl p-5 space-y-2 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold tracking-wider uppercase">
                <span>{m.label}</span>
                <span>{m.icon}</span>
              </div>
              <p className="text-3xl font-display font-black text-white mt-1">{m.value}</p>
            </div>
            <div>
              {renderSparkline(m.data, m.color)}
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Left Column: Weak Areas & AI Coaching */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Level & Streak Stats Card */}
          <div className="bg-[#121225] border border-gray-800/40 rounded-2xl p-6 space-y-4">
            <h3 className="font-display font-bold text-white text-lg">Training Profile</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-gray-850 pb-2">
                <span className="text-gray-400 font-medium">XP Total</span>
                <span className="text-white font-mono font-bold">{progress.xp_total} XP</span>
              </div>
              <div className="flex justify-between border-b border-gray-850 pb-2">
                <span className="text-gray-400 font-medium">Current Level</span>
                <span className="text-[#00D68F] font-bold">Lvl {progress.level} ({progress.level_title})</span>
              </div>
              <div className="flex justify-between border-b border-gray-850 pb-2">
                <span className="text-gray-400 font-medium">Activity Streak</span>
                <span className="text-orange-500 font-bold">🔥 {progress.streak_days} days</span>
              </div>
              <div className="flex justify-between border-b border-gray-850 pb-2">
                <span className="text-gray-400 font-medium">Simulations Completed</span>
                <span className="text-white font-bold">{progress.simulations_completed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 font-medium">Objections Drilled</span>
                <span className="text-white font-bold">{progress.objections_drilled}</span>
              </div>
            </div>
          </div>

          {/* Section: Weak Areas */}
          <div className="bg-[#121225] border border-gray-800/40 rounded-2xl p-6 space-y-4">
            <h3 className="font-display font-bold text-white text-lg">Focus Areas (Weaknesses)</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Quiz categories where the representative scored below 60% average. Priority practice is recommended.
            </p>

            <div className="space-y-3">
              {weakAreas.length > 0 ? (
                weakAreas.map((area, index) => (
                  <div key={index} className="flex justify-between items-center p-3 rounded-lg bg-red-950/10 border border-red-500/10">
                    <span className="text-red-200 font-semibold text-sm capitalize">{area.category}</span>
                    <span className="text-red-400 font-mono font-bold text-xs bg-red-500/10 px-2 py-0.5 rounded">
                      {area.avgScore}% avg
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-lg bg-emerald-950/10 border border-emerald-500/10 text-center text-emerald-400 text-xs font-semibold">
                  ✨ No weak areas detected! Representative scoring above 60% average.
                </div>
              )}
            </div>
          </div>

          {/* Section: AI Coaching Recommendation */}
          <div className="bg-[#121225] border border-gray-800/40 rounded-2xl p-6 space-y-4">
            <h3 className="font-display font-bold text-white text-lg flex items-center gap-2">
              <span>🤖</span> AI Coaching Recommendations
            </h3>

            {coachingLoading ? (
              <div className="py-8 text-center text-xs text-gray-500 space-y-2">
                <div className="w-5 h-5 border-2 border-t-[#00D68F] border-gray-800 rounded-full animate-spin mx-auto"></div>
                <p>Generating AI coaching recommendations...</p>
              </div>
            ) : coachingError ? (
              <div className="p-4 rounded-lg bg-red-950/15 border border-red-500/10 text-center text-red-400 text-xs font-semibold">
                {coachingError}
              </div>
            ) : coachingData.length > 0 ? (
              <div className="space-y-3">
                {coachingData.map((item, idx) => {
                  const borderCol =
                    item.priority === "high"
                      ? "border-red-500/25 bg-red-950/5 text-red-200"
                      : item.priority === "medium"
                      ? "border-amber-500/25 bg-amber-950/5 text-amber-200"
                      : "border-emerald-500/25 bg-emerald-950/5 text-emerald-250"

                  const badgeCol =
                    item.priority === "high"
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : item.priority === "medium"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"

                  return (
                    <div key={idx} className={`p-4 rounded-xl border flex flex-col space-y-2 ${borderCol}`}>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold uppercase tracking-wider text-white capitalize">
                          {item.action}
                        </span>
                        <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded uppercase tracking-wider ${badgeCol}`}>
                          {item.priority}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 leading-relaxed">{item.reason}</p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-gray-500">
                Complete more sessions to receive AI recommendations.
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Sessions log & Charts */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Performance curve LineChart */}
          <div className="p-6 rounded-2xl bg-[#121225] border border-gray-800/40 space-y-6">
            <div>
              <h3 className="font-display font-bold text-white text-lg">Performance Trend</h3>
              <p className="text-xs text-gray-500 mt-1">Timeline of overall closing scores across the last 8 practice runs.</p>
            </div>

            <div className="h-60 w-full">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1c1c35" />
                    <XAxis dataKey="name" stroke="#4b5563" fontSize={10} tickLine={false} />
                    <YAxis stroke="#4b5563" fontSize={10} domain={[0, 100]} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#121225", borderColor: "#1c1c35", borderRadius: "12px" }}
                      itemStyle={{ fontSize: "12px", color: "#F2F2F7" }}
                      labelStyle={{ fontSize: "10px", color: "#4b5563" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#00D68F"
                      strokeWidth={3}
                      dot={{ fill: "#00D68F", r: 4 }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 space-y-2">
                  <span className="text-3xl">📈</span>
                  <p className="text-xs">Timeline will populate once simulations are completed.</p>
                </div>
              )}
            </div>
          </div>

          {/* Sessions logs table */}
          <div className="bg-[#121225] border border-gray-800/40 rounded-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-850">
              <h3 className="font-display font-bold text-white text-lg">Practice History Log</h3>
              <p className="text-xs text-gray-500 mt-1">Full activity index of target representative&apos;s simulation runs.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-850 bg-[#080810]/30 text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                    <th className="p-4">Scenario</th>
                    <th className="p-4">Date</th>
                    <th className="p-4 text-center">Outcome</th>
                    <th className="p-4 text-center">Closing Score</th>
                    <th className="p-4 text-center">XP Gained</th>
                    <th className="p-4 text-center">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.length > 0 ? (
                    sessions.map((session) => (
                      <tr key={session.id} className="border-b border-gray-850/50 hover:bg-[#080810]/20 transition-colors">
                        <td className="p-4 font-bold text-white">{session.scenarioName || "Property Pitch"}</td>
                        <td className="p-4 text-xs text-gray-400 font-medium">
                          {session.createdAt ? new Date(session.createdAt).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            session.outcome === "converted"
                              ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-400"
                              : "bg-red-950/20 border-red-500/20 text-red-400"
                          }`}>
                            {session.outcome}
                          </span>
                        </td>
                        <td className="p-4 text-center font-display font-black text-white">{session.score || 0}%</td>
                        <td className="p-4 text-center font-display font-black text-[#00D68F]">+{session.xpEarned || 0} XP</td>
                        <td className="p-4 text-center text-xs text-gray-400 font-semibold">
                          {session.durationSeconds 
                            ? `${Math.floor(session.durationSeconds / 60)}m ${session.durationSeconds % 60}s` 
                            : "N/A"
                          }
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500">
                        No training sessions completed yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
