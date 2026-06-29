import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"

interface QuizResultsPageProps {
  params: {
    sessionId: string
  }
}

interface Question {
  question: string
  options: { A: string; B: string; C: string; D: string }
  correct: "A" | "B" | "C" | "D"
  explanation: string
  category: string
}

interface Answer {
  index: number
  selected: "A" | "B" | "C" | "D" | null
  isCorrect: boolean
  timeSeconds: number
}

export default async function QuizResultsPage({ params }: QuizResultsPageProps) {
  const { sessionId } = params

  const sessionCookie = cookies().get("session")?.value
  if (!sessionCookie) {
    redirect("/login")
  }

  let uid: string
  try {
    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie)
    uid = decodedToken.uid
  } catch {
    redirect("/login")
  }

  // Fetch session
  const docRef = adminDb.collection("quiz_sessions").doc(sessionId)
  const docSnap = await docRef.get()

  if (!docSnap.exists) {
    notFound()
  }

  const sessionData = docSnap.data()
  if (!sessionData || sessionData.userId !== uid) {
    notFound()
  }

  // Redirect to active quiz if not finished
  if (!sessionData.completedAt) {
    redirect(`/dashboard/quiz/${sessionId}`)
  }

  const score = sessionData.score || 0
  const xpEarned = sessionData.xpEarned || 0
  const questions = (sessionData.questions || []) as Question[]
  const answers = (sessionData.answers || []) as Answer[]

  // Determine Grade
  let grade = "Needs Work"
  let gradeColor = "text-red-400 bg-red-950/20 border-red-500/20"
  if (score >= 90) {
    grade = "Outstanding"
    gradeColor = "text-[#00D68F] bg-[#00D68F]/10 border-[#00D68F]/20"
  } else if (score >= 75) {
    grade = "Strong"
    gradeColor = "text-emerald-400 bg-emerald-950/20 border-emerald-500/20"
  } else if (score >= 50) {
    grade = "Developing"
    gradeColor = "text-amber-400 bg-amber-950/20 border-amber-500/20"
  }

  // Compute category performance
  const categoryStats: { [key: string]: { total: number; correct: number } } = {}
  questions.forEach((q, idx) => {
    const ans = answers.find((a) => a.index === idx)
    const isCorrect = ans ? ans.isCorrect : false
    const cat = q.category || "General"

    if (!categoryStats[cat]) {
      categoryStats[cat] = { total: 0, correct: 0 }
    }
    categoryStats[cat].total++
    if (isCorrect) {
      categoryStats[cat].correct++
    }
  })

  // Filter missed questions
  const missedQuestions = questions
    .map((q, idx) => {
      const ans = answers.find((a) => a.index === idx)
      return { question: q, answer: ans, idx }
    })
    .filter((item) => !item.answer || !item.answer.isCorrect)

  const ringCircumference = 2 * Math.PI * 70 // ~439.82

  return (
    <div className="max-w-4xl mx-auto space-y-8 font-body">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest font-mono text-gray-500">Evaluation Report</span>
          <h1 className="text-3xl font-display font-extrabold text-white">Quiz Challenge Results</h1>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/quiz"
            className="px-4 py-2.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-300 text-xs font-bold rounded-xl transition-all"
          >
            Retake Quiz
          </Link>
          <Link
            href="/dashboard"
            className="px-4 py-2.5 bg-[#00D68F] hover:bg-[#00b378] text-[#080810] text-xs font-bold rounded-xl transition-all"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {/* Row 1: Summary Performance Panel */}
      <div className="grid md:grid-cols-3 gap-6">
        
        {/* Animated Score Ring Card */}
        <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-6 shadow-xl flex flex-col items-center justify-center space-y-4">
          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Overall Accuracy</span>
          
          <div className="relative w-44 h-44 flex items-center justify-center">
            <svg width="176" height="176" className="transform -rotate-90">
              <circle
                cx="88"
                cy="88"
                r="70"
                fill="transparent"
                stroke="#1C1C35"
                strokeWidth="10"
              />
              <circle
                cx="88"
                cy="88"
                r="70"
                fill="transparent"
                stroke="#00D68F"
                strokeWidth="10"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringCircumference - (ringCircumference * score) / 100}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-black font-data text-white font-mono">{score}%</span>
              <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">Correct Rate</span>
            </div>
          </div>

          <div className={`px-4 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${gradeColor}`}>
            Grade: {grade}
          </div>
        </div>

        {/* Training XP & Stats Card */}
        <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6">
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block mb-4">Rewards & Metrics</span>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3 bg-[#080810]/40 border border-gray-800 p-3 rounded-xl">
                <span className="text-2xl">💎</span>
                <div>
                  <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest block">XP Earned</span>
                  <span className="text-lg font-bold text-white font-data">+{xpEarned} XP Awarded</span>
                </div>
              </div>
              <div className="flex items-center space-x-3 bg-[#080810]/40 border border-gray-800 p-3 rounded-xl">
                <span className="text-2xl">🎯</span>
                <div>
                  <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest block">Accuracy Stats</span>
                  <span className="text-sm font-bold text-white">
                    {answers.filter((a) => a.isCorrect).length} / {questions.length} Questions Correct
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-gray-400 leading-relaxed border-t border-gray-800/40 pt-4">
            This quiz score updates your rolling 5-session knowledge index displayed on the manager leaderboard.
          </div>
        </div>

        {/* Category Breakdown list */}
        <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-4">
          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">Topic Performance</span>
          
          <div className="space-y-4">
            {Object.keys(categoryStats).map((cat) => {
              const stats = categoryStats[cat]
              const ratio = Math.round((stats.correct / stats.total) * 100)
              
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="capitalize text-gray-300">{cat}</span>
                    <span className="text-white font-mono">{stats.correct}/{stats.total} ({ratio}%)</span>
                  </div>
                  <div className="w-full bg-[#1C1C35] h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${ratio >= 75 ? "bg-[#00D68F]" : ratio >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${ratio}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* Row 2: Missed Questions Review */}
      <section className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-6">
        <div>
          <h3 className="font-display font-bold text-white text-lg">Question-by-Question Analysis</h3>
          <p className="text-xs text-gray-400 mt-1">Review areas that need additional study or pitch adjustments.</p>
        </div>

        <div className="space-y-4">
          {missedQuestions.length > 0 ? (
            missedQuestions.map((item, index) => {
              const q = item.question
              const ans = item.answer
              
              return (
                <div key={index} className="p-5 rounded-2xl bg-[#080810]/55 border border-gray-800 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span className="px-2 py-0.5 text-[9px] font-bold bg-red-950/20 text-red-400 border border-red-500/10 rounded uppercase font-mono">
                        Question {item.idx + 1} • {q.category}
                      </span>
                      <h4 className="font-display font-extrabold text-white text-base leading-relaxed mt-1">
                        {q.question}
                      </h4>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-2 text-xs">
                    {(["A", "B", "C", "D"] as const).map((opt) => {
                      const isCorrect = q.correct === opt
                      const isSelected = ans?.selected === opt
                      
                      let badgeStyle = "bg-[#12121E] border-gray-800/50 text-gray-400"
                      if (isCorrect) {
                        badgeStyle = "bg-green-950/25 border-green-500/50 text-green-300"
                      } else if (isSelected) {
                        badgeStyle = "bg-red-950/25 border-red-500/50 text-red-300"
                      }

                      return (
                        <div key={opt} className={`p-3 rounded-xl border flex items-center space-x-2 ${badgeStyle}`}>
                          <span className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] ${
                            isCorrect ? "bg-green-500 text-[#080810]" : isSelected ? "bg-red-500 text-[#080810]" : "bg-gray-800"
                          }`}>
                            {opt}
                          </span>
                          <span className="font-medium truncate">{q.options[opt]}</span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-1 text-xs">
                    <div className="flex items-center space-x-2 text-amber-400 font-bold uppercase tracking-wider text-[10px]">
                      <span>💡</span>
                      <span>Explanation Review</span>
                    </div>
                    <p className="text-gray-300 leading-relaxed">{q.explanation}</p>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="p-8 rounded-2xl bg-[#00D68F]/5 border border-[#00D68F]/20 text-center space-y-3">
              <div className="text-3xl">🎉</div>
              <h4 className="font-display font-bold text-white text-lg">Perfect Score Checklist!</h4>
              <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                Outstanding job! You answered every question correctly in this session. Your knowledge index is at peak capability.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Row 3: Call to Action suggestions */}
      <div className="bg-[#1C1C35] border border-gray-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="space-y-1 text-center md:text-left">
          <h4 className="font-display font-bold text-white text-base">Keep Improving Your Pitch</h4>
          <p className="text-xs text-gray-400 leading-relaxed">
            Practice handling realistic property objections or complete interactive customer scenarios to boost your confidence.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/objections"
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-gray-200 text-xs font-bold rounded-xl transition-all border border-gray-800 hover:border-gray-700"
          >
            Objection Simulator
          </Link>
          <Link
            href="/dashboard/practice"
            className="px-4 py-2 bg-[#00D68F] hover:bg-[#00b378] text-[#080810] text-xs font-bold rounded-xl transition-all shadow-lg"
          >
            AI Roleplay Simulator
          </Link>
        </div>
      </div>

    </div>
  )
}
