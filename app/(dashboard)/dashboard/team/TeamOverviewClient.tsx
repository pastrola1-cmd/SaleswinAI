"use client"

import { useState, useMemo } from "react"
import Link from "next/link"

interface Profile {
  id: string
  full_name: string
  email: string
  role: string
  is_active: boolean
  lastSeenAt: string
}

interface ProgressRecord {
  userId: string
  xpTotal: number
  level: number
  streakDays: number
  conversionScore: number
  knowledgeScore: number
  objectionScore: number
  simulationsCompleted: number
  quizzesCompleted: number
  objectionsDrilled: number
  lastActiveDate: string
}

interface TeamOverviewClientProps {
  profiles: Profile[]
  progressRecords: ProgressRecord[]
  weeklySessionsCount: number
}

type SortField = "rank" | "name" | "level" | "conversion" | "knowledge" | "objection" | "sessions" | "lastActive"
type SortOrder = "asc" | "desc"

export default function TeamOverviewClient({
  profiles,
  progressRecords,
  weeklySessionsCount
}: TeamOverviewClientProps) {
  const [sortField, setSortField] = useState<SortField>("conversion")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")
  const [nudgingIds, setNudgingIds] = useState<string[]>([])
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Map progress records to profile items
  const joinedMembers = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0]
    return profiles.map((p) => {
      const prog = progressRecords.find((r) => r.userId === p.id) || {
        xpTotal: 0,
        level: 1,
        streakDays: 0,
        conversionScore: 0,
        knowledgeScore: 0,
        objectionScore: 0,
        simulationsCompleted: 0,
        quizzesCompleted: 0,
        objectionsDrilled: 0,
        lastActiveDate: ""
      }

      const totalRuns = prog.simulationsCompleted + prog.quizzesCompleted + prog.objectionsDrilled
      
      // Determine if active today
      const isActiveToday = p.lastSeenAt?.startsWith(todayStr) || prog.lastActiveDate === todayStr

      return {
        ...p,
        ...prog,
        totalRuns,
        isActiveToday
      }
    })
  }, [profiles, progressRecords])

  // Top cards values
  const totalActive = useMemo(() => profiles.filter((p) => p.is_active).length, [profiles])
  const activeTodayCount = useMemo(() => joinedMembers.filter((m) => m.isActiveToday).length, [joinedMembers])
  const teamAvgConversion = useMemo(() => {
    const validScores = progressRecords.map((r) => r.conversionScore).filter((s) => s > 0)
    if (validScores.length === 0) return 0
    return Math.round(validScores.reduce((sum, s) => sum + s, 0) / validScores.length)
  }, [progressRecords])

  // Sorting
  const sortedMembers = useMemo(() => {
    const list = [...joinedMembers]
    list.sort((a, b) => {
      let valA: any = ""
      let valB: any = ""

      if (sortField === "rank" || sortField === "conversion") {
        valA = a.conversionScore
        valB = b.conversionScore
      } else if (sortField === "name") {
        valA = a.full_name.toLowerCase()
        valB = b.full_name.toLowerCase()
      } else if (sortField === "level") {
        valA = a.level
        valB = b.level
      } else if (sortField === "knowledge") {
        valA = a.knowledgeScore
        valB = b.knowledgeScore
      } else if (sortField === "objection") {
        valA = a.objectionScore
        valB = b.objectionScore
      } else if (sortField === "sessions") {
        valA = a.totalRuns
        valB = b.totalRuns
      } else if (sortField === "lastActive") {
        valA = a.lastActiveDate || "0000-00-00"
        valB = b.lastActiveDate || "0000-00-00"
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1
      if (valA > valB) return sortOrder === "asc" ? 1 : -1
      return 0
    })
    return list
  }, [joinedMembers, sortField, sortOrder])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("desc")
    }
  }

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ["Rank", "Name", "Email", "Role", "Level", "Conversion Score", "Knowledge Score", "Objections Drilled", "Total Runs", "Last Active Date"]
    const rows = sortedMembers.map((m, idx) => [
      idx + 1,
      m.full_name,
      m.email,
      m.role,
      m.level,
      `${m.conversionScore}%`,
      `${m.knowledgeScore}%`,
      m.objectionsDrilled,
      m.totalRuns,
      m.lastActiveDate || "Never"
    ])

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Saleswin_Team_Report_${new Date().toISOString().split("T")[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Send Nudge
  const handleSendNudge = async (userId: string, name: string) => {
    setNudgingIds((prev) => [...prev, userId])
    setAlertMsg(null)

    try {
      const res = await fetch("/api/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      })

      if (!res.ok) {
        throw new Error("Failed to dispatch nudge")
      }

      setAlertMsg({
        type: "success",
        text: `Nudge email sent successfully to ${name}!`
      })
    } catch {
      setAlertMsg({
        type: "error",
        text: `Failed to nudge ${name}. Verify Resend integration configuration.`
      })
    } finally {
      setNudgingIds((prev) => prev.filter((id) => id !== userId))
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase()
  }

  return (
    <div className="space-y-8 font-body">
      
      {/* Top summary row (4 cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Members", value: totalActive, icon: "👥", color: "text-[#00D68F]" },
          { label: "Team Avg Conversion", value: `${teamAvgConversion}%`, icon: "💎", color: "text-[#3B82F6]" },
          { label: "Sessions (Last 7 Days)", value: weeklySessionsCount, icon: "📈", color: "text-[#EC4899]" },
          { label: "Active Today", value: activeTodayCount, icon: "🔥", color: "text-[#F59E0B]" }
        ].map((c, idx) => (
          <div key={idx} className="p-5 rounded-2xl bg-[#121225] border border-gray-800/40 flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">{c.label}</span>
              <span className="text-2xl font-display font-black text-white mt-2 block">{c.value}</span>
            </div>
            <span className={`text-3xl bg-[#1C1C35]/50 p-2.5 rounded-xl border border-gray-850 ${c.color}`}>{c.icon}</span>
          </div>
        ))}
      </div>

      {/* Alert Banner */}
      {alertMsg && (
        <div className={`p-4 rounded-xl border text-xs font-semibold flex justify-between items-center ${
          alertMsg.type === "success" 
            ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-400" 
            : "bg-red-950/20 border-red-500/20 text-red-400"
        }`}>
          <span>{alertMsg.text}</span>
          <button onClick={() => setAlertMsg(null)} className="text-gray-500 hover:text-gray-300 ml-4">✕</button>
        </div>
      )}

      {/* Table Section */}
      <div className="bg-[#121225] border border-gray-800/40 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-gray-850 flex justify-between items-center">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Representative Standings</h2>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-300 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5"
          >
            <span>📥</span> Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-850 text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                <th onClick={() => handleSort("rank")} className="py-4 px-6 text-center w-16 cursor-pointer hover:text-white select-none">
                  Rank {sortField === "rank" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th onClick={() => handleSort("name")} className="py-4 px-6 cursor-pointer hover:text-white select-none">
                  Representative {sortField === "name" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th className="py-4 px-6 text-center">Role</th>
                <th onClick={() => handleSort("level")} className="py-4 px-6 text-center cursor-pointer hover:text-white select-none">
                  Level {sortField === "level" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th onClick={() => handleSort("conversion")} className="py-4 px-6 text-center cursor-pointer hover:text-white select-none">
                  Conv. Score {sortField === "conversion" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th onClick={() => handleSort("knowledge")} className="py-4 px-6 text-center cursor-pointer hover:text-white select-none">
                  Knowledge {sortField === "knowledge" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th onClick={() => handleSort("objection")} className="py-4 px-6 text-center cursor-pointer hover:text-white select-none">
                  Objections {sortField === "objection" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th onClick={() => handleSort("sessions")} className="py-4 px-6 text-center cursor-pointer hover:text-white select-none">
                  Sessions {sortField === "sessions" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th onClick={() => handleSort("lastActive")} className="py-4 px-6 text-center cursor-pointer hover:text-white select-none">
                  Last Active {sortField === "lastActive" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                </th>
                <th className="py-4 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-850">
              {sortedMembers.map((member, index) => {
                const rank = index + 1
                return (
                  <tr key={member.id} className="transition-colors hover:bg-white/2">
                    <td className="py-4 px-6 text-center font-display font-black text-gray-400">
                      {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
                    </td>

                    <td className="py-4 px-6 flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-lg bg-[#1C1C35] border border-gray-800 text-[#00D68F] flex items-center justify-center font-display font-black text-xs shrink-0 relative">
                        {getInitials(member.full_name)}
                        {member.isActiveToday && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-500 animate-pulse border border-[#121225]" />
                        )}
                      </div>
                      <div>
                        <span className="font-bold text-white block">{member.full_name}</span>
                        <span className="text-[10px] text-gray-500 block">{member.email}</span>
                      </div>
                    </td>

                    <td className="py-4 px-6 text-center">
                      <span className="px-2 py-0.5 text-[9px] font-bold bg-[#1C1C35] text-gray-400 border border-gray-850 rounded uppercase tracking-wider">
                        {member.role}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-center text-gray-300 font-semibold">
                      Lvl {member.level}
                    </td>

                    <td className="py-4 px-6 text-center font-display font-black text-[#00D68F]">
                      {member.conversionScore}%
                    </td>

                    <td className="py-4 px-6 text-center font-semibold text-gray-300">
                      {member.knowledgeScore}%
                    </td>

                    <td className="py-4 px-6 text-center font-semibold text-gray-300">
                      {member.objectionScore}%
                    </td>

                    <td className="py-4 px-6 text-center text-gray-400 font-semibold">
                      {member.totalRuns} runs
                    </td>

                    <td className="py-4 px-6 text-center text-xs text-gray-400 font-medium">
                      {member.lastActiveDate ? new Date(member.lastActiveDate).toLocaleDateString() : "Never"}
                    </td>

                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/dashboard/team/${member.id}`}
                          className="px-2.5 py-1 bg-gray-900 border border-gray-800 hover:border-gray-700 hover:text-white text-gray-400 font-semibold rounded-md text-xs transition-colors"
                        >
                          Profile
                        </Link>
                        <button
                          onClick={() => handleSendNudge(member.id, member.full_name)}
                          disabled={nudgingIds.includes(member.id)}
                          className="px-2.5 py-1 bg-[#00D68F]/10 hover:bg-[#00D68F]/20 text-[#00D68F] border border-[#00D68F]/20 hover:border-[#00D68F]/30 font-semibold rounded-md text-xs transition-colors disabled:opacity-50"
                        >
                          {nudgingIds.includes(member.id) ? "..." : "Nudge"}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
