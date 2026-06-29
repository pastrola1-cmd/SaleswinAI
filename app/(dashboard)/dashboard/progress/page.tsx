"use client"

import { useState, useEffect } from "react"
import { useProfile } from "@/hooks/useProfile"
import { db } from "@/utils/firebase/client"
import { collection, query, where, getDocs, limit, orderBy } from "firebase/firestore"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts"

const ALL_BADGES = [
  { key: "first_session",  name: "First Step",       icon: "👟", desc: "Completed your first practice simulation" },
  { key: "first_close",    name: "First Blood",      icon: "🎯", desc: "Successfully converted your first customer" },
  { key: "quiz_ace",       name: "Quiz Ace",         icon: "🧠", desc: "Scored 100% on a product knowledge quiz" },
  { key: "streak_3",       name: "On Fire",          icon: "🔥", desc: "Maintained a 3-day active practice streak" },
  { key: "streak_7",       name: "Unstoppable",      icon: "⚡", desc: "Maintained a 7-day active practice streak" },
  { key: "streak_30",      name: "Iron Rep",         icon: "💪", desc: "Maintained a 30-day active practice streak" },
  { key: "objection_50",   name: "Objection Master", icon: "🛡️", desc: "Drilled 50 objections in the simulator" },
  { key: "objection_100",  name: "Bulletproof",      icon: "🔰", desc: "Drilled 100 objections in the simulator" },
  { key: "knowledge_90",   name: "Product Expert",   icon: "📚", desc: "Maintained a product knowledge score of 90+" },
  { key: "conversion_90",  name: "Elite Closer",     icon: "💎", desc: "Maintained a simulation conversion score of 90+" },
  { key: "sim_10",         name: "Rep",              icon: "🎪", xp: 200, desc: "Completed 10 full practice simulations" },
  { key: "sim_50",         name: "Veteran",          icon: "🏆", xp: 1000, desc: "Completed 50 full practice simulations" },
  { key: "comeback",       name: "Comeback",         icon: "📈", xp: 300, desc: "Scored 80+ after a previous low score (<50)" }
]

export default function ProgressPage() {
  const { profile } = useProfile()
  const [loading, setLoading] = useState(true)
  const [userProgress, setUserProgress] = useState<any>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [activeChart, setActiveChart] = useState<"overall" | "discovery" | "trust" | "objection" | "closing">("overall")
  const [earnedBadges, setEarnedBadges] = useState<Record<string, any>>({})
  const [activityData, setActivityData] = useState<Record<string, number>>({})

  // Activity Calendar Grid Dates
  const [calendarGrid, setCalendarGrid] = useState<string[][]>([])

  useEffect(() => {
    // Generate YYYY-MM-DD grid for 52 weeks (7 rows: Sunday -> Saturday)
    const grid: string[][] = []
    const today = new Date()
    const dayOfWeek = today.getDay()
    
    // Find Sunday of the week 52 weeks ago
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - 364 - dayOfWeek)

    for (let r = 0; r < 7; r++) {
      grid[r] = []
      const rowStartDate = new Date(startDate)
      rowStartDate.setDate(startDate.getDate() + r)
      for (let c = 0; c < 52; c++) {
        const d = new Date(rowStartDate)
        d.setDate(rowStartDate.getDate() + c * 7)
        grid[r][c] = d.toISOString().split("T")[0]
      }
    }
    setCalendarGrid(grid)
  }, [])

  useEffect(() => {
    if (!profile?.id) return

    const uid = profile.id

    const fetchData = async () => {
      try {
        // 1. Fetch user progress doc
        const progressSnap = await getDocs(
          query(collection(db, "user_progress"), where("userId", "==", uid))
        )
        if (!progressSnap.empty) {
          setUserProgress(progressSnap.docs[0].data())
        }

        // 2. Fetch last 10 simulation sessions for Charts
        const simsSnap = await getDocs(
          query(
            collection(db, "simulation_sessions"),
            where("userId", "==", uid),
            where("status", "==", "completed"),
            orderBy("completedAt", "desc"),
            limit(10)
          )
        )
        const sims = simsSnap.docs.map((docSnap) => docSnap.data()).reverse()
        const formattedChart = sims.map((s, idx) => ({
          name: `Sim ${idx + 1}`,
          overall: s.scores?.overall || 0,
          discovery: s.scores?.discovery || 0,
          trust: s.scores?.trust || 0,
          objection: s.scores?.objection || 0,
          closing: s.scores?.closing || 0
        }))
        setChartData(formattedChart)

        // 3. Fetch Earned Badges
        const badgesSnap = await getDocs(
          query(collection(db, "badges"), where("userId", "==", uid))
        )
        const badgeMap: Record<string, any> = {}
        badgesSnap.forEach((d) => {
          const b = d.data()
          badgeMap[b.badgeKey] = b
        })
        setEarnedBadges(badgeMap)

        // 4. Fetch Activity dates for Activity Calendar
        const dateMap: Record<string, number> = {}

        // Helper to parse Firestore Timestamps or ISO strings
        const addDate = (dateVal: any) => {
          if (!dateVal) return
          let dateStr = ""
          if (dateVal.toDate) {
            dateStr = dateVal.toDate().toISOString().split("T")[0]
          } else {
            dateStr = new Date(dateVal).toISOString().split("T")[0]
          }
          dateMap[dateStr] = (dateMap[dateStr] || 0) + 1
        }

        // Add from all completed simulations
        const allSimsSnap = await getDocs(
          query(collection(db, "simulation_sessions"), where("userId", "==", uid))
        )
        allSimsSnap.forEach((d) => addDate(d.data().startedAt || d.data().createdAt))

        // Add from objection drills
        const allObjSnap = await getDocs(
          query(collection(db, "objection_sessions"), where("userId", "==", uid))
        )
        allObjSnap.forEach((d) => addDate(d.data().createdAt))

        // Add from quizzes
        const allQuizSnap = await getDocs(
          query(collection(db, "quiz_sessions"), where("userId", "==", uid))
        )
        allQuizSnap.forEach((d) => addDate(d.data().completedAt || d.data().createdAt))

        setActivityData(dateMap)

      } catch (err) {
        console.error("Error loading progress page data:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [profile?.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-t-[#00D68F] border-gray-800 rounded-full animate-spin"></div>
      </div>
    )
  }

  // Fallbacks if progress doesn't exist
  const progress = userProgress || {
    xpTotal: 0,
    level: 1,
    levelTitle: "Rookie",
    streakDays: 0,
    simulationsCompleted: 0,
    quizzesCompleted: 0,
    objectionsDrilled: 0
  }

  const xpTotal = progress.xpTotal !== undefined ? progress.xpTotal : (progress.xp_total || 0)
  const currentLvl = progress.level || 1
  const levelTitle = progress.levelTitle || progress.level_title || "Rookie"
  const streak = progress.streakDays !== undefined ? progress.streakDays : (progress.streak_days || 0)
  const simsCompleted = progress.simulationsCompleted !== undefined ? progress.simulationsCompleted : (progress.simulations_completed || 0)
  const quizzesCompleted = progress.quizzesCompleted !== undefined ? progress.quizzesCompleted : (progress.quizzes_completed || 0)
  const objectionsDrilled = progress.objectionsDrilled !== undefined ? progress.objectionsDrilled : (progress.objections_drilled || 0)

  // Find next level limits
  const currentLvlLimit = 1000 * (currentLvl - 1)
  const nextLvlLimit = 1000 * currentLvl
  const progressPercent = Math.min(100, Math.max(0, ((xpTotal - currentLvlLimit) / 1000) * 100))

  // Calendar cell color mapping
  const getCellColor = (dateStr: string) => {
    const count = activityData[dateStr] || 0
    if (count === 0) return "bg-[#1C1C35] hover:bg-gray-800"
    if (count === 1) return "bg-[#00D68F]/30 hover:bg-[#00D68F]/40 border border-[#00D68F]/20"
    if (count === 2) return "bg-[#00D68F]/60 hover:bg-[#00D68F]/75 border border-[#00D68F]/40"
    return "bg-[#00D68F] border border-[#00D68F]/80"
  }

  // Chart options configs
  const CHART_TYPES = [
    { key: "overall", label: "Overall Score", color: "#00D68F" },
    { key: "discovery", label: "Discovery", color: "#3B82F6" },
    { key: "trust", label: "Trust Building", color: "#EC4899" },
    { key: "objection", label: "Objection Handling", color: "#F59E0B" },
    { key: "closing", label: "Closing Capacity", color: "#8B5CF6" }
  ]

  const activeColor = CHART_TYPES.find((t) => t.key === activeChart)?.color || "#00D68F"

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16 font-body">
      <div>
        <h1 className="text-3xl font-display font-black text-white">My Progress</h1>
        <p className="text-gray-400 mt-2 text-sm">
          Track your skill improvement timeline, activity metrics, and unlocked Close badges.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Practice Simulations", value: simsCompleted, icon: "🎪" },
          { label: "Objections Drilled", value: objectionsDrilled, icon: "🛡️" },
          { label: "Knowledge Quizzes", value: quizzesCompleted, icon: "🧠" },
          { label: "Total XP Earned", value: `${xpTotal} XP`, icon: "🎯" }
        ].map((s, idx) => (
          <div key={idx} className="p-5 rounded-2xl bg-[#121225] border border-gray-800/40 flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">{s.label}</span>
              <span className="text-2xl font-display font-black text-white block mt-2">{s.value}</span>
            </div>
            <span className="text-3xl bg-[#1C1C35]/50 p-2.5 rounded-xl border border-gray-800/30">{s.icon}</span>
          </div>
        ))}
      </div>

      {/* Level and Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Section B: Level & XP Card */}
        <div className="p-6 rounded-2xl bg-[#121225] border border-gray-800/40 flex flex-col justify-between space-y-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Level Status</h2>
            
            {/* Hexagon level indicator */}
            <div className="relative w-28 h-28 flex items-center justify-center">
              <div className="absolute inset-0 bg-[#00D68F]/10 border border-[#00D68F]/30 clip-hex transform rotate-30 rotate-hex-animate" />
              <div className="absolute inset-2 bg-[#1C1C35] border border-gray-850 clip-hex transform rotate-30" />
              <div className="relative z-10 flex flex-col items-center">
                <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">LEVEL</span>
                <span className="text-4xl font-display font-black text-[#00D68F]">{currentLvl}</span>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-display font-black text-white uppercase tracking-wide">
                {levelTitle}
              </h3>
              <p className="text-xs text-gray-500">Next level requires {nextLvlLimit} XP</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold text-gray-400">
                <span>{xpTotal} XP</span>
                <span>{nextLvlLimit} XP</span>
              </div>
              <div className="h-2 rounded-full bg-[#1C1C35] overflow-hidden border border-gray-850">
                <div
                  className="h-full bg-[#00D68F] transition-all duration-1000 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Streak widget */}
            <div className="p-3 rounded-xl bg-orange-950/10 border border-orange-500/20 flex items-center justify-between">
              <span className="text-xs text-orange-200 font-bold flex items-center space-x-2">
                <span>🔥</span>
                <span>Practice Streak</span>
              </span>
              <span className="text-sm font-display font-black text-orange-400">{streak} Days</span>
            </div>
          </div>
        </div>

        {/* Section A: Score History Charts */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-[#121225] border border-gray-800/40 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center space-y-3 sm:space-y-0 border-b border-gray-850 pb-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Simulation History</h2>
            <div className="flex flex-wrap gap-1.5">
              {CHART_TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveChart(t.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                    activeChart === t.key
                      ? "bg-[#1C1C35] border-gray-700 text-white"
                      : "bg-[#080810]/40 text-gray-500 border-transparent hover:text-gray-300"
                  }`}
                >
                  {t.label.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                    dataKey={activeChart}
                    stroke={activeColor}
                    strokeWidth={3}
                    dot={{ fill: activeColor, r: 4 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-2 text-gray-500">
                <span className="text-3xl">📈</span>
                <p className="text-xs">Complete practice simulations to view historical curves.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Section C: Activity Calendar */}
      <div className="p-6 rounded-2xl bg-[#121225] border border-gray-800/40 space-y-6">
        <div>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Activity Grid</h2>
          <p className="text-[11px] text-gray-500 mt-1">Consistency maps closing records. Highlights simulation, quiz, and objection sessions completed daily.</p>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="flex flex-col space-y-1.5 min-w-[700px]">
            {calendarGrid.map((row, rIdx) => (
              <div key={rIdx} className="flex space-x-1.5 items-center">
                {/* Day label */}
                <span className="w-6 text-[9px] text-gray-600 font-bold uppercase">
                  {rIdx === 1 ? "Mon" : rIdx === 3 ? "Wed" : rIdx === 5 ? "Fri" : ""}
                </span>
                
                {/* 52 Columns */}
                {row.map((dateStr, cIdx) => {
                  const count = activityData[dateStr] || 0
                  return (
                    <div
                      key={cIdx}
                      className={`w-3 h-3 rounded-xs transition-colors shrink-0 ${getCellColor(dateStr)}`}
                      title={`${dateStr}: ${count} activity commits`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex justify-end items-center space-x-2 text-[10px] text-gray-600 font-bold uppercase">
          <span>Less</span>
          <div className="w-3 h-3 rounded-xs bg-[#1C1C35]" />
          <div className="w-3 h-3 rounded-xs bg-[#00D68F]/30" />
          <div className="w-3 h-3 rounded-xs bg-[#00D68F]/60" />
          <div className="w-3 h-3 rounded-xs bg-[#00D68F]" />
          <span>More</span>
        </div>
      </div>

      {/* Section E: Badges Wall */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          Unlocked Sales Badges
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {ALL_BADGES.map((b) => {
            const earned = earnedBadges[b.key]
            return (
              <div
                key={b.key}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                  earned
                    ? "bg-amber-950/10 border-amber-500/20 text-white"
                    : "bg-[#121225]/40 border-gray-850 grayscale opacity-40 text-gray-500"
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-3xl">{b.icon}</span>
                  {earned ? (
                    <span className="text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded uppercase">
                      Unlocked
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold bg-gray-900 text-gray-500 border border-gray-800 px-2 py-0.5 rounded uppercase">
                      Locked
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-none">{b.name}</h3>
                  <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">{b.desc}</p>
                </div>
                {earned && (
                  <span className="text-[9px] text-amber-500 font-semibold uppercase tracking-wider block pt-2 border-t border-amber-500/10">
                    Earned: {earned.earnedAt ? (earned.earnedAt.toDate ? earned.earnedAt.toDate().toLocaleDateString() : new Date(earned.earnedAt).toLocaleDateString()) : new Date(earned.earned_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
