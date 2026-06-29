"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useProfile } from "@/hooks/useProfile"
import { db } from "@/utils/firebase/client"
import { collection, query, where, onSnapshot, doc } from "firebase/firestore"

interface ProgressData {
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

interface Activity {
  id: string
  type: string
  scenarioName: string
  createdAt: string
  score: number
  xpEarned: number
  durationSeconds: number
}

interface HomeDashboardClientProps {
  fullName: string
  progress: ProgressData
}

export default function HomeDashboardClient({ fullName, progress: initialProgress }: HomeDashboardClientProps) {
  const { profile } = useProfile()
  const [progress, setProgress] = useState<ProgressData>(initialProgress)
  const [activities, setActivities] = useState<Activity[]>([])
  const [challengeState, setChallengeState] = useState<"idle" | "accepted" | "completed">("idle")

  const handleAcceptChallenge = () => {
    setChallengeState("accepted")
  }

  const handleCompleteChallenge = () => {
    setChallengeState("completed")
    // Add XP reward for demo purposes
    setProgress((prev) => ({
      ...prev,
      xp_total: prev.xp_total + 200,
    }))
  }

  // 1. Real-time listener for user progress scores
  useEffect(() => {
    if (!profile?.id) return

    const unsubscribe = onSnapshot(doc(db, "user_progress", profile.id), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data()
        setProgress({
          xp_total: data.xp_total || data.xpTotal || 0,
          level: data.level || 1,
          level_title: data.level_title || data.levelTitle || "Rookie",
          streak_days: data.streak_days || data.streakDays || 0,
          knowledge_score: data.knowledge_score || data.knowledgeScore || 0,
          confidence_score: data.confidence_score || data.confidenceScore || 0,
          conversion_score: data.conversion_score || data.conversionScore || 0,
          objection_score: data.objection_score || data.objectionScore || 0,
          closing_score: data.closing_score || data.closingScore || 0,
          simulations_completed: data.simulations_completed || data.simulationsCompleted || 0,
          quizzes_completed: data.quizzes_completed || data.quizzesCompleted || 0,
          objections_drilled: data.objections_drilled || data.objectionsDrilled || 0
        })
      }
    })

    return () => unsubscribe()
  }, [profile?.id])

  // 2. Real-time listener combining activities from three collections
  useEffect(() => {
    if (!profile?.id) return

    const qSim = query(collection(db, "simulation_sessions"), where("userId", "==", profile.id))
    const qQuiz = query(collection(db, "quiz_sessions"), where("userId", "==", profile.id))
    const qObj = query(collection(db, "objection_sessions"), where("userId", "==", profile.id))

    let simList: Activity[] = []
    let quizList: Activity[] = []
    let objList: Activity[] = []

    const combineAndSet = () => {
      const merged = [...simList, ...quizList, ...objList]
      merged.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime()
        const dateB = new Date(b.createdAt || 0).getTime()
        return dateB - dateA
      })
      setActivities(merged.slice(0, 5))
    }

    const unsubSim = onSnapshot(qSim, (snap) => {
      simList = snap.docs.map(d => ({
        id: d.id,
        type: "AI Simulator",
        scenarioName: d.data().scenarioName || d.data().scenario_name || "Lekki Smart Haven Simulation",
        createdAt: d.data().createdAt || d.data().created_at || "",
        score: d.data().score !== undefined ? d.data().score : 0,
        xpEarned: d.data().xpEarned || d.data().xp_earned || 0,
        durationSeconds: d.data().durationSeconds || d.data().duration_seconds || 0
      }))
      combineAndSet()
    })

    const unsubQuiz = onSnapshot(qQuiz, (snap) => {
      quizList = snap.docs.map(d => ({
        id: d.id,
        type: "Knowledge Quiz",
        scenarioName: d.data().quizName || d.data().quiz_name || "Company Policies Quiz",
        createdAt: d.data().createdAt || d.data().created_at || "",
        score: d.data().score !== undefined ? d.data().score : 0,
        xpEarned: d.data().xpEarned || d.data().xp_earned || 0,
        durationSeconds: d.data().durationSeconds || d.data().duration_seconds || 0
      }))
      combineAndSet()
    })

    const unsubObj = onSnapshot(qObj, (snap) => {
      objList = snap.docs.map(d => ({
        id: d.id,
        type: "Objection Drill",
        scenarioName: d.data().drillName || d.data().drill_name || "Pricing Objections",
        createdAt: d.data().createdAt || d.data().created_at || "",
        score: d.data().score !== undefined ? d.data().score : 0,
        xpEarned: d.data().xpEarned || d.data().xp_earned || 0,
        durationSeconds: d.data().durationSeconds || d.data().duration_seconds || 0
      }))
      combineAndSet()
    })

    return () => {
      unsubSim()
      unsubQuiz()
      unsubObj()
    }
  }, [profile?.id])

  // Check if user is a brand new user (all scores are 0)
  const isNewUser =
    progress.knowledge_score === 0 &&
    progress.confidence_score === 0 &&
    progress.conversion_score === 0 &&
    progress.objection_score === 0 &&
    progress.closing_score === 0

  const conversionCircumference = 2 * Math.PI * 50 // ~314.16

  return (
    <div className="space-y-8 font-body">
      {/* Self-contained styling for animated Win Ring */}
      <style>{`
        @keyframes pulseGlow {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 4px rgba(0, 214, 143, 0.25));
          }
          50% {
            transform: scale(1.03);
            filter: drop-shadow(0 0 12px rgba(0, 214, 143, 0.5));
          }
        }
        .win-ring-pulse {
          animation: pulseGlow 3s infinite ease-in-out;
          transform-origin: center;
        }
      `}</style>

      {/* Row 1: Welcome Banner */}
      <section className="bg-gradient-to-r from-[#1C1C35] to-[#12121E] border border-gray-800/80 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-white">
            Good morning, <span className="text-[#00D68F]">{fullName}</span>.
          </h1>
          <p className="text-sm text-gray-400 mt-1">Ready to win today? Your sales simulation sandbox is configured.</p>
        </div>
        <div className="flex items-center space-x-6">
          <div className="text-xs bg-[#080810]/50 border border-gray-800 rounded-xl px-4 py-2 flex items-center space-x-2">
            <span className="text-lg">🔥</span>
            <div>
              <span className="text-gray-500 font-semibold block uppercase tracking-wider text-[9px]">Active Streak</span>
              <span className="text-white font-bold font-display">{progress.streak_days} day{progress.streak_days !== 1 && "s"}</span>
            </div>
          </div>
          <div className="text-xs bg-[#080810]/50 border border-gray-800 rounded-xl px-4 py-2 flex items-center space-x-2">
            <span className="text-lg">⭐</span>
            <div>
              <span className="text-gray-500 font-semibold block uppercase tracking-wider text-[9px]">Rank / Level</span>
              <span className="text-white font-bold font-display">Lvl {progress.level} ({progress.level_title})</span>
            </div>
          </div>
          <div className="text-xs bg-[#080810]/50 border border-gray-800 rounded-xl px-4 py-2 flex items-center space-x-2">
            <span className="text-lg">💎</span>
            <div>
              <span className="text-gray-500 font-semibold block uppercase tracking-wider text-[9px]">Total XP</span>
              <span className="text-white font-bold font-display font-data">{progress.xp_total} XP</span>
            </div>
          </div>
        </div>
      </section>

      {/* Row 2: Score Cards */}
      <section className="space-y-4">
        <h2 className="text-lg font-display font-bold text-white">Your Core Sales Metrics</h2>
        
        {isNewUser ? (
          /* Empty State for New Users */
          <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-8 text-center max-w-xl mx-auto space-y-4">
            <div className="w-16 h-16 bg-[#00D68F]/10 border border-[#00D68F]/20 rounded-full flex items-center justify-center mx-auto text-2xl">
              🎯
            </div>
            <h3 className="font-display font-bold text-white text-lg">Metrics Locked</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
              Complete your first Practice Session to analyze your pitch structure, objection responses, and unlock your live training scores.
            </p>
            <Link
              href="/dashboard/practice"
              className="inline-block px-5 py-2.5 bg-[#00D68F] hover:bg-[#00b378] text-[#080810] font-bold rounded-lg text-xs transition-colors shadow-lg"
            >
              Start First Session
            </Link>
          </div>
        ) : (
          /* Live Score Cards Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            
            {/* Card 1: Knowledge Score */}
            <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-gray-700/80 transition-colors">
              <div className="flex justify-between items-start">
                <span className="text-gray-500 uppercase tracking-wider font-bold text-[10px]">Knowledge Score</span>
                <span className="text-xl">🧠</span>
              </div>
              <div>
                <span className="text-4xl font-extrabold font-data text-white">{progress.knowledge_score}</span>
                <span className="text-xs text-gray-400 ml-1">/100</span>
              </div>
              <div className="space-y-1.5">
                <div className="w-full bg-[#1C1C35] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#00D68F] h-full rounded-full" style={{ width: `${progress.knowledge_score}%` }}></div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Progress</span>
                  <span className="text-[#00D68F] font-semibold">Ready</span>
                </div>
              </div>
            </div>

            {/* Card 2: Confidence Score */}
            <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-gray-700/80 transition-colors">
              <div className="flex justify-between items-start">
                <span className="text-gray-500 uppercase tracking-wider font-bold text-[10px]">Confidence Score</span>
                <span className="text-xl">⭐</span>
              </div>
              <div>
                <span className="text-4xl font-extrabold font-data text-white">{progress.confidence_score}</span>
                <span className="text-xs text-gray-400 ml-1">/100</span>
              </div>
              <div className="space-y-1.5">
                <div className="w-full bg-[#1C1C35] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#00D68F] h-full rounded-full" style={{ width: `${progress.confidence_score}%` }}></div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Stableness</span>
                  <span className="text-gray-400 font-semibold">+4% vs last week</span>
                </div>
              </div>
            </div>

            {/* Card 3: Conversion Score (Win Ring Card) */}
            <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-5 shadow-lg flex flex-col items-center justify-center space-y-4 hover:border-gray-700/80 transition-colors">
              <span className="text-gray-500 uppercase tracking-wider font-bold text-[10px]">Conversion Score</span>
              <div className="relative w-[120px] h-[120px] flex items-center justify-center">
                <svg width="120" height="120" className="win-ring-pulse transform -rotate-90">
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="transparent"
                    stroke="#1C1C35"
                    strokeWidth="7"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="transparent"
                    stroke="#00D68F"
                    strokeWidth="7"
                    strokeDasharray={conversionCircumference}
                    strokeDashoffset={conversionCircumference - (conversionCircumference * progress.conversion_score) / 100}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 1.5s ease-in-out" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black font-data text-white">{progress.conversion_score}%</span>
                  <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">Win Rate</span>
                </div>
              </div>
            </div>

            {/* Card 4: Objection Score */}
            <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-gray-700/80 transition-colors">
              <div className="flex justify-between items-start">
                <span className="text-gray-500 uppercase tracking-wider font-bold text-[10px]">Objection Score</span>
                <span className="text-xl">🛡️</span>
              </div>
              <div>
                <span className="text-4xl font-extrabold font-data text-white">{progress.objection_score}</span>
                <span className="text-xs text-gray-400 ml-1">/100</span>
              </div>
              <div className="space-y-1.5">
                <div className="w-full bg-[#1C1C35] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#00D68F] h-full rounded-full" style={{ width: `${progress.objection_score}%` }}></div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Defended</span>
                  <span className="text-gray-400 font-semibold">+1.2% vs last week</span>
                </div>
              </div>
            </div>

            {/* Card 5: Closing Score */}
            <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4 hover:border-gray-700/80 transition-colors">
              <div className="flex justify-between items-start">
                <span className="text-gray-500 uppercase tracking-wider font-bold text-[10px]">Closing Score</span>
                <span className="text-xl">🎯</span>
              </div>
              <div>
                <span className="text-4xl font-extrabold font-data text-white">{progress.closing_score}</span>
                <span className="text-xs text-gray-400 ml-1">/100</span>
              </div>
              <div className="space-y-1.5">
                <div className="w-full bg-[#1C1C35] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#00D68F] h-full rounded-full" style={{ width: `${progress.closing_score}%` }}></div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Completed</span>
                  <span className="text-[#00D68F] font-semibold">Target Hit</span>
                </div>
              </div>
            </div>

          </div>
        )}
      </section>

      {/* Row 3: Quick Actions */}
      <section className="space-y-4">
        <h2 className="text-lg font-display font-bold text-white">Quick Actions</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Link
            href="/dashboard/practice"
            className="group bg-[#12121E] border border-gray-800/80 hover:border-[#00D68F]/30 p-6 rounded-2xl shadow-lg transition-all flex flex-col justify-between min-h-[140px]"
          >
            <div>
              <span className="text-2xl mb-2 block">💬</span>
              <h3 className="font-display font-bold text-white text-base group-hover:text-[#00D68F] transition-colors">Start Practice &rarr;</h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">Enter the AI Roleplay Simulator to practice sales pitches with local Nigerian customer personas.</p>
            </div>
          </Link>
          <Link
            href="/dashboard/objections"
            className="group bg-[#12121E] border border-gray-800/80 hover:border-[#00D68F]/30 p-6 rounded-2xl shadow-lg transition-all flex flex-col justify-between min-h-[140px]"
          >
            <div>
              <span className="text-2xl mb-2 block">🛡️</span>
              <h3 className="font-display font-bold text-white text-base group-hover:text-[#00D68F] transition-colors">Drill Objections &rarr;</h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">Practice reframing common customer objections regarding C of O, payment plans, and build quality.</p>
            </div>
          </Link>
          <Link
            href="/dashboard/quiz"
            className="group bg-[#12121E] border border-gray-800/80 hover:border-[#00D68F]/30 p-6 rounded-2xl shadow-lg transition-all flex flex-col justify-between min-h-[140px]"
          >
            <div>
              <span className="text-2xl mb-2 block">📝</span>
              <h3 className="font-display font-bold text-white text-base group-hover:text-[#00D68F] transition-colors">Take a Quiz &rarr;</h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">Test your memory regarding company documents, payment terms, and project specifications.</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Row 4 & Row 5: Recent Activity & Daily Challenge */}
      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* Recent Activity */}
        <section className="lg:col-span-2 bg-[#12121E] border border-gray-800/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-gray-800/80">
            <h3 className="font-display font-bold text-white text-base">Recent Activity</h3>
          </div>
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 bg-[#080810]/30 text-gray-400 font-semibold">
                  <th className="p-4">Type</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Score</th>
                  <th className="p-4">XP Earned</th>
                  <th className="p-4 text-right">Duration</th>
                </tr>
              </thead>
              <tbody>
                {activities.length > 0 ? (
                  activities.map((act) => (
                    <tr key={act.id} className="border-b border-gray-800/30 hover:bg-[#080810]/20 transition-colors">
                      <td className="p-4 font-semibold text-white">
                        {act.type} ({act.scenarioName})
                      </td>
                      <td className="p-4 text-gray-400">
                        {act.createdAt ? new Date(act.createdAt).toLocaleDateString() : "N/A"}
                      </td>
                      <td className="p-4 font-bold text-[#00D68F]">{act.score}%</td>
                      <td className="p-4 font-data text-white">+{act.xpEarned} XP</td>
                      <td className="p-4 text-right text-gray-400">
                        {act.durationSeconds 
                          ? `${Math.floor(act.durationSeconds / 60)}m ${act.durationSeconds % 60}s` 
                          : "N/A"
                        }
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500 font-medium">
                      No sessions yet. Your history will appear here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Daily Challenge Card */}
        <section className="bg-gradient-to-br from-[#12121E] to-[#1C1C35] border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🏆</span>
            <h3 className="font-display font-bold text-white text-base">Daily Challenge</h3>
          </div>
          
          <div className="bg-[#080810]/50 border border-gray-800 p-4 rounded-xl space-y-2">
            <p className="text-xs font-semibold text-white">
              Handle 3 pricing objections without flinching
            </p>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Accept this challenge and complete three perfect pricing drills in the Objection Simulator to earn bonus points.
            </p>
          </div>

          {challengeState === "idle" && (
            <button
              onClick={handleAcceptChallenge}
              className="w-full py-2.5 bg-[#00D68F] hover:bg-[#00b378] text-[#080810] font-bold rounded-lg text-xs transition-colors shadow-lg"
            >
              Accept Challenge
            </button>
          )}

          {challengeState === "accepted" && (
            <div className="space-y-2">
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded text-center text-[10px] font-semibold">
                Challenge Accepted! Go to Objection Drill.
              </div>
              <button
                onClick={handleCompleteChallenge}
                className="w-full py-2.5 bg-[#1C1C35] hover:bg-gray-800 border border-gray-700 text-white font-bold rounded-lg text-xs transition-colors"
              >
                Complete Challenge (Demo)
              </button>
            </div>
          )}

          {challengeState === "completed" && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-300 rounded-lg text-center text-xs font-semibold flex items-center justify-center space-x-2">
              <span>✓ Completed</span>
              <span className="text-[10px] font-data bg-green-500/20 px-2 py-0.5 rounded text-white">+200 XP earned</span>
            </div>
          )}
        </section>
      </div>

    </div>
  )
}
