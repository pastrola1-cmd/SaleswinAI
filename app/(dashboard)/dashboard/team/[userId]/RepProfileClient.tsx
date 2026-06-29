"use client"

import { useState } from "react"

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
}

interface WeakArea {
  category: string
  avgScore: number
}

interface RepProfileClientProps {
  member: Profile
  progress: Progress
  sessions: Session[]
  weakAreas: WeakArea[]
}

export default function RepProfileClient({
  member,
  progress,
  sessions,
  weakAreas
}: RepProfileClientProps) {
  const [nudgeLoading, setNudgeLoading] = useState(false)
  const [nudgeStatus, setNudgeStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)

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
        message: `Nudge email sent successfully to ${member.full_name || member.email}!`
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

  return (
    <div className="space-y-8 font-body">
      
      {/* Rep Overview Header */}
      <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full bg-[#00D68F] text-[#080810] flex items-center justify-center font-bold font-display text-2xl shrink-0">
            {getInitials(member.full_name)}
          </div>
          <div>
            <h2 className="text-2xl font-display font-extrabold text-white">{member.full_name || "Sales Rep"}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="px-2 py-0.5 text-xs font-bold bg-[#00D68F]/10 text-[#00D68F] rounded uppercase tracking-wider border border-[#00D68F]/20">
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
          {/* Nudge Notification Status */}
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

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        
        {/* Metric 1 */}
        <div className="bg-[#12121E] border border-gray-800/80 rounded-xl p-5 space-y-2">
          <div className="flex justify-between items-center text-xs text-gray-400 font-semibold tracking-wider uppercase">
            <span>Knowledge</span>
            <span>🧠</span>
          </div>
          <p className="text-3xl font-mono font-black text-white">{progress.knowledge_score}%</p>
          <div className="w-full bg-[#1C1C35] h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#00D68F] h-full" style={{ width: `${progress.knowledge_score}%` }}></div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-[#12121E] border border-gray-800/80 rounded-xl p-5 space-y-2">
          <div className="flex justify-between items-center text-xs text-gray-400 font-semibold tracking-wider uppercase">
            <span>Confidence</span>
            <span>⭐</span>
          </div>
          <p className="text-3xl font-mono font-black text-white">{progress.confidence_score}%</p>
          <div className="w-full bg-[#1C1C35] h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#00D68F] h-full" style={{ width: `${progress.confidence_score}%` }}></div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-[#12121E] border border-gray-800/80 rounded-xl p-5 space-y-2">
          <div className="flex justify-between items-center text-xs text-gray-400 font-semibold tracking-wider uppercase">
            <span>Conversion</span>
            <span>🔥</span>
          </div>
          <p className="text-3xl font-mono font-black text-white">{progress.conversion_score}%</p>
          <div className="w-full bg-[#1C1C35] h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#00D68F] h-full" style={{ width: `${progress.conversion_score}%` }}></div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-[#12121E] border border-gray-800/80 rounded-xl p-5 space-y-2">
          <div className="flex justify-between items-center text-xs text-gray-400 font-semibold tracking-wider uppercase">
            <span>Objection</span>
            <span>🛡️</span>
          </div>
          <p className="text-3xl font-mono font-black text-white">{progress.objection_score}%</p>
          <div className="w-full bg-[#1C1C35] h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#00D68F] h-full" style={{ width: `${progress.objection_score}%` }}></div>
          </div>
        </div>

        {/* Metric 5 */}
        <div className="bg-[#12121E] border border-gray-800/80 rounded-xl p-5 space-y-2">
          <div className="flex justify-between items-center text-xs text-gray-400 font-semibold tracking-wider uppercase">
            <span>Closing</span>
            <span>🎯</span>
          </div>
          <p className="text-3xl font-mono font-black text-white">{progress.closing_score}%</p>
          <div className="w-full bg-[#1C1C35] h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#00D68F] h-full" style={{ width: `${progress.closing_score}%` }}></div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Left Column: Weak Areas & Streaks */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Level & Streak Stats Card */}
          <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-6 space-y-4">
            <h3 className="font-display font-bold text-white text-lg">Training Profile</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-gray-800/40 pb-2">
                <span className="text-gray-400">XP Total</span>
                <span className="text-white font-mono font-bold">{progress.xp_total} XP</span>
              </div>
              <div className="flex justify-between border-b border-gray-800/40 pb-2">
                <span className="text-gray-400">Current Level</span>
                <span className="text-[#00D68F] font-bold">Lvl {progress.level} ({progress.level_title})</span>
              </div>
              <div className="flex justify-between border-b border-gray-800/40 pb-2">
                <span className="text-gray-400">Activity Streak</span>
                <span className="text-amber-500 font-bold">🔥 {progress.streak_days} days</span>
              </div>
              <div className="flex justify-between border-b border-gray-800/40 pb-2">
                <span className="text-gray-400">Simulations Completed</span>
                <span className="text-white font-bold">{progress.simulations_completed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Objections Drilled</span>
                <span className="text-white font-bold">{progress.objections_drilled}</span>
              </div>
            </div>
          </div>

          {/* Section: Weak Areas */}
          <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-6 space-y-4">
            <h3 className="font-display font-bold text-white text-lg">Focus Areas (Weaknesses)</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Quiz categories where the representative scored below 60% average. Priority practice is recommended.
            </p>

            <div className="space-y-3">
              {weakAreas.length > 0 ? (
                weakAreas.map((area, index) => (
                  <div key={index} className="flex justify-between items-center p-3 rounded-lg bg-red-950/20 border border-red-500/10">
                    <span className="text-red-200 font-semibold text-sm capitalize">{area.category}</span>
                    <span className="text-red-400 font-mono font-bold text-xs bg-red-500/10 px-2 py-0.5 rounded">
                      {area.avgScore}% avg
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-500/10 text-center text-emerald-400 text-xs">
                  ✨ No weak areas detected! Representative scoring above 60% average.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Sessions log */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-gray-800/80">
              <h3 className="font-display font-bold text-white text-lg">Recent Simulation Training Sessions</h3>
              <p className="text-xs text-gray-400 mt-1">Logs of the representative&apos;s last 10 simulated property objection runs.</p>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-800/80 bg-[#080810]/30 text-gray-400 font-semibold">
                    <th className="p-4">Scenario</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Closing Score</th>
                    <th className="p-4">XP Gained</th>
                    <th className="p-4">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.length > 0 ? (
                    sessions.map((session) => (
                      <tr key={session.id} className="border-b border-gray-800/30 hover:bg-[#080810]/20 transition-colors">
                        <td className="p-4 font-bold text-white">{session.scenarioName || "Property Pitch"}</td>
                        <td className="p-4 text-xs text-gray-400">
                          {session.createdAt ? new Date(session.createdAt).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="p-4 font-mono font-bold text-white">{session.score || 0}%</td>
                        <td className="p-4 font-mono font-bold text-[#00D68F] font-semibold">+{session.xpEarned || 0} XP</td>
                        <td className="p-4 text-xs text-gray-400">
                          {session.durationSeconds 
                            ? `${Math.floor(session.durationSeconds / 60)}m ${session.durationSeconds % 60}s` 
                            : "N/A"
                          }
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500">
                        No simulation sessions logged yet.
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
