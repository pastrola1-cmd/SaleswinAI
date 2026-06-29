"use client"

import { useState, useEffect } from "react"
import { useProfile } from "@/hooks/useProfile"
import { db } from "@/utils/firebase/client"
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore"

interface LeaderboardUser {
  userId: string
  name: string
  initials: string
  role: string
  level: number
  levelTitle: string
  xp: number
  conversionScore: number
  objectionScore: number
  knowledgeScore: number
  sessionsCount: number
  trend: string
}

export default function LeaderboardPage() {
  const { profile } = useProfile()
  const [timeframe, setTimeframe] = useState<"week" | "month" | "all">("all")
  const [metric, setMetric] = useState<"xp" | "conversion" | "objection" | "knowledge">("xp")
  const [loading, setLoading] = useState(true)
  const [rankings, setRankings] = useState<LeaderboardUser[]>([])

  useEffect(() => {
    if (!profile?.company_id) return

    const companyId = profile.company_id
    const currentUserId = profile.id

    const fetchLeaderboard = async () => {
      setLoading(true)
      try {
        // 1. Fetch all profiles in the same company
        const profilesSnap = await getDocs(
          query(collection(db, "profiles"), where("company_id", "==", companyId))
        )
        const profileMap: Record<string, any> = {}
        profilesSnap.forEach((d) => {
          const data = d.data()
          profileMap[d.id] = data
        })

        // 2. Fetch all user progress docs
        const progressSnap = await getDocs(
          query(collection(db, "user_progress"), where("companyId", "==", companyId))
        )

        // Self-heal: check if current user's progress has companyId set.
        // If not, update it in Firestore.
        const userProgressDoc = progressSnap.docs.find((d) => d.id === currentUserId)
        if (!userProgressDoc) {
          // If progress doc exists but doesn't have companyId, update it.
          const myProgressSnap = await getDocs(
            query(collection(db, "user_progress"), where("userId", "==", currentUserId))
          )
          if (!myProgressSnap.empty) {
            await updateDoc(doc(db, "user_progress", currentUserId), {
              companyId: companyId,
              company_id: companyId
            })
          }
        }

        const progressMap: Record<string, any> = {}
        progressSnap.forEach((d) => {
          progressMap[d.id] = d.data()
        })

        // 3. For "week" or "month", query the xp_log collection
        const xpSumMap: Record<string, number> = {}
        if (timeframe !== "all") {
          const cutOffDate = new Date()
          if (timeframe === "week") {
            // Start of current week (Sunday)
            cutOffDate.setDate(cutOffDate.getDate() - cutOffDate.getDay())
          } else {
            // Start of current month
            cutOffDate.setDate(1)
          }
          cutOffDate.setHours(0, 0, 0, 0)

          const xpLogSnap = await getDocs(collection(db, "xp_log"))
          xpLogSnap.forEach((d) => {
            const data = d.data()
            const dateVal = data.createdAt || data.created_at
            if (dateVal) {
              const dateMs = dateVal.toMillis ? dateVal.toMillis() : new Date(dateVal).getTime()
              if (dateMs >= cutOffDate.getTime()) {
                xpSumMap[data.userId] = (xpSumMap[data.userId] || 0) + (data.amount || 0)
              }
            }
          })
        }

        // 4. Assemble rankings data in-memory
        const assembledList: LeaderboardUser[] = Object.keys(profileMap).map((uid) => {
          const p = profileMap[uid]
          const prog = progressMap[uid] || {}

          const xp = timeframe === "all"
            ? (prog.xpTotal !== undefined ? prog.xpTotal : (prog.xp_total || 0))
            : (xpSumMap[uid] || 0)

          const conversion = prog.conversionScore || prog.conversion_score || 0
          const objection = prog.objectionScore || prog.objection_score || 0
          const knowledge = prog.knowledgeScore || prog.knowledge_score || 0
          const level = prog.level || 1
          const levelTitle = prog.levelTitle || prog.level_title || "Rookie"

          const sims = prog.simulationsCompleted || prog.simulations_completed || 0
          const quizzes = prog.quizzesCompleted || prog.quizzes_completed || 0
          const drills = prog.objectionsDrilled || prog.objections_drilled || 0
          const sessionsCount = sims + quizzes + drills

          // Initials for avatar
          const initials = p.full_name
            ? p.full_name
                .split(" ")
                .map((n: string) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()
            : "U"

          // Simulate random stable trend for visuals
          const trends = ["up", "down", "stable"]
          const randIdx = (uid.charCodeAt(0) + uid.charCodeAt(uid.length - 1)) % 3
          const trend = trends[randIdx]

          return {
            userId: uid,
            name: p.full_name || "Anonymous User",
            initials,
            role: p.role || "salesperson",
            level,
            levelTitle,
            xp,
            conversionScore: conversion,
            objectionScore: objection,
            knowledgeScore: knowledge,
            sessionsCount,
            trend
          }
        })

        // 5. Sort list in-memory based on selected metric
        assembledList.sort((a, b) => {
          if (metric === "xp") return b.xp - a.xp
          if (metric === "conversion") return b.conversionScore - a.conversionScore
          if (metric === "objection") return b.objectionScore - a.objectionScore
          return b.knowledgeScore - a.knowledgeScore
        })

        setRankings(assembledList)

      } catch (err) {
        console.error("Failed to load leaderboard:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [profile?.company_id, timeframe, metric, profile?.id])

  // Get score cell formatter
  const formatMetricValue = (user: LeaderboardUser) => {
    if (metric === "xp") return `${user.xp} XP`
    if (metric === "conversion") return `${user.conversionScore}%`
    if (metric === "objection") return `${user.objectionScore}%`
    return `${user.knowledgeScore}%`
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16 font-body">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-display font-black text-white">Leaderboard</h1>
          <p className="text-gray-400 mt-2 text-sm">
            Compete with teammates. Rankings update in real-time based on simulation conversions.
          </p>
        </div>

        {/* Timeframe selector */}
        <div className="flex p-1 bg-[#121225] border border-gray-800/40 rounded-xl max-w-xs">
          {[
            { key: "week", label: "This Week" },
            { key: "month", label: "This Month" },
            { key: "all", label: "All Time" }
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTimeframe(t.key as any)}
              className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                timeframe === t.key
                  ? "bg-[#00D68F] text-[#080810]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter metrics selector row */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "xp", label: "🎯 XP Leader" },
          { key: "conversion", label: "💎 Conversion Rate" },
          { key: "objection", label: "🛡️ Objection Handling" },
          { key: "knowledge", label: "🧠 Product Knowledge" }
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key as any)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
              metric === m.key
                ? "bg-[#1C1C35] text-white border-gray-700 shadow-md"
                : "bg-[#121225] text-gray-500 border-transparent hover:text-gray-300"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Rankings List Card */}
      <div className="bg-[#121225] border border-gray-800/40 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-t-[#00D68F] border-gray-850 rounded-full animate-spin"></div>
          </div>
        ) : rankings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-850 text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-4 px-6 text-center w-16">Rank</th>
                  <th className="py-4 px-6">Sales Representative</th>
                  <th className="py-4 px-6 text-center w-24">Level</th>
                  <th className="py-4 px-6 text-center w-36">
                    {metric === "xp" ? "XP Gained" : metric === "conversion" ? "Closing Ratio" : metric === "objection" ? "Drill score" : "Quiz score"}
                  </th>
                  <th className="py-4 px-6 text-center w-28">Practice Runs</th>
                  <th className="py-4 px-6 text-center w-20">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-850 text-sm">
                {rankings.map((user, index) => {
                  const rank = index + 1
                  const isSelf = user.userId === profile?.id

                  let rankCell = <span>#{rank}</span>
                  if (rank === 1) rankCell = <span className="text-2xl">🥇</span>
                  if (rank === 2) rankCell = <span className="text-2xl">🥈</span>
                  if (rank === 3) rankCell = <span className="text-2xl">🥉</span>

                  return (
                    <tr
                      key={user.userId}
                      className={`transition-colors hover:bg-white/2 ${
                        isSelf ? "bg-[#00D68F]/5 border-l-4 border-l-[#00D68F]" : ""
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-4 px-6 text-center font-display font-black text-gray-400">
                        {rankCell}
                      </td>

                      {/* User Info */}
                      <td className="py-4 px-6 flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-xl bg-[#1C1C35] border border-gray-800 flex items-center justify-center font-display font-black text-sm text-[#00D68F] shrink-0">
                          {user.initials}
                        </div>
                        <div>
                          <p className="font-bold text-white leading-none">
                            {user.name} {isSelf && <span className="text-[9px] bg-[#00D68F]/10 text-[#00D68F] px-1.5 py-0.5 rounded ml-1.5 border border-[#00D68F]/20 uppercase">You</span>}
                          </p>
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider mt-1 block">
                            {user.role.replace("_", " ")}
                          </span>
                        </div>
                      </td>

                      {/* Level */}
                      <td className="py-4 px-6 text-center">
                        <span className="inline-block px-2.5 py-0.5 text-xs font-bold bg-[#1C1C35] border border-gray-850 rounded text-gray-300">
                          Lvl {user.level}
                        </span>
                      </td>

                      {/* Value */}
                      <td className="py-4 px-6 text-center font-display font-black text-[#00D68F]">
                        {formatMetricValue(user)}
                      </td>

                      {/* Sessions */}
                      <td className="py-4 px-6 text-center text-gray-400 font-semibold">
                        {user.sessionsCount} runs
                      </td>

                      {/* Trend */}
                      <td className="py-4 px-6 text-center">
                        {user.trend === "up" ? (
                          <span className="text-emerald-500 font-bold">▲</span>
                        ) : user.trend === "down" ? (
                          <span className="text-rose-500 font-bold">▼</span>
                        ) : (
                          <span className="text-gray-600 font-bold">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500 space-y-2">
            <span className="text-4xl">👥</span>
            <h3 className="font-bold text-white">No Team Rankings</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              There are no sales reps registered in your company yet. Invite your colleagues to compete!
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
