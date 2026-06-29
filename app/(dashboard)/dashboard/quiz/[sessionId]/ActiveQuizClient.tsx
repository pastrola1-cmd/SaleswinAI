"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { completeQuizSession } from "../actions"

interface Question {
  question: string
  options: { A: string; B: string; C: string; D: string }
  correct: "A" | "B" | "C" | "D"
  explanation: string
  category: string
}

interface QuizSession {
  id: string
  userId: string
  companyId: string
  category: string
  difficulty: string
  questions: Question[]
  answers: AnswerRecord[]
  score: number
  xpEarned: number
  completedAt: string | null
  createdAt: string
}

interface ActiveQuizClientProps {
  session: QuizSession
}

interface AnswerRecord {
  index: number
  selected: "A" | "B" | "C" | "D" | null
  isCorrect: boolean
  timeSeconds: number
}

export default function ActiveQuizClient({ session }: ActiveQuizClientProps) {
  const router = useRouter()
  const { questions } = session

  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<"A" | "B" | "C" | "D" | null>(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [timeLeft, setTimeLeft] = useState(30) // 30 seconds per question
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const [showExitModal, setShowExitModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const currentQuestion = questions[currentIndex]

  const handleTimeout = useCallback(() => {
    // Treat timeout as wrong answer with null selection
    recordAnswer(null, 30)
  // recordAnswer is stable (defined in same scope), intentionally omitted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Timer tick effect
  useEffect(() => {
    if (isAnswered || isSubmitting) return

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          handleTimeout()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [currentIndex, isAnswered, isSubmitting, handleTimeout])

  const recordAnswer = (option: "A" | "B" | "C" | "D" | null, duration: number) => {
    setIsAnswered(true)
    if (timerRef.current) clearInterval(timerRef.current)

    const isCorrect = option === currentQuestion.correct
    const newAnswer: AnswerRecord = {
      index: currentIndex,
      selected: option,
      isCorrect,
      timeSeconds: duration
    }

    const updatedAnswers = [...answers, newAnswer]
    setAnswers(updatedAnswers)
    setSelectedOption(option)

    // Wait 2 seconds to show confirmation/explanation before moving on
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex((prev) => prev + 1)
        setSelectedOption(null)
        setIsAnswered(false)
        setTimeLeft(30)
      } else {
        // Last question answered - submit session
        submitQuiz(updatedAnswers)
      }
    }, 2500)
  }

  const handleSelectOption = (option: "A" | "B" | "C" | "D") => {
    if (isAnswered || isSubmitting) return
    const duration = 30 - timeLeft
    recordAnswer(option, duration)
  }

  const submitQuiz = async (finalAnswers: AnswerRecord[]) => {
    setIsSubmitting(true)
    try {
      // Calculate final score percentage
      const correctCount = finalAnswers.filter((a) => a.isCorrect).length
      const finalScore = Math.round((correctCount / questions.length) * 100)

      await completeQuizSession(session.id, finalAnswers, finalScore)
      router.push(`/dashboard/quiz/${session.id}/results`)
      router.refresh()
    } catch (err) {
      console.error("Failed to complete quiz:", err)
      alert("Failed to submit quiz results. Please try again.")
      setIsSubmitting(false)
    }
  }

  const handleExit = () => {
    setShowExitModal(true)
  }

  const confirmExit = () => {
    router.push("/dashboard/quiz")
  }

  if (isSubmitting) {
    return (
      <div className="min-h-screen bg-[#080810] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-t-[#00D68F] border-gray-800 rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-gray-400">Submitting your scorecards and recalculating average...</p>
      </div>
    )
  }

  const timerPercentage = (timeLeft / 30) * 100

  // Timer colors
  let timerBarColor = "bg-[#00D68F]"
  if (timeLeft <= 5) {
    timerBarColor = "bg-red-500 animate-pulse"
  } else if (timeLeft <= 15) {
    timerBarColor = "bg-amber-500"
  }

  return (
    <div className="min-h-screen bg-[#080810] text-[#F2F2F7] font-body flex flex-col justify-between max-w-4xl mx-auto py-8 px-6">
      
      {/* Top Header Row */}
      <header className="flex justify-between items-center pb-6 border-b border-gray-800/40">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] uppercase font-bold tracking-widest font-mono text-gray-500">Active Challenge</span>
            <span className="px-2 py-0.5 text-[9px] font-bold bg-[#00D68F]/10 text-[#00D68F] rounded uppercase tracking-wider border border-[#00D68F]/20">
              {session.category}
            </span>
          </div>
          <h2 className="text-sm font-bold text-white">
            Question <span className="text-[#00D68F]">{currentIndex + 1}</span> of {questions.length}
          </h2>
        </div>
        <button
          onClick={handleExit}
          className="px-4 py-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-300 text-xs font-bold rounded-xl transition-all"
        >
          Exit Quiz
        </button>
      </header>

      {/* Timer Bar */}
      <div className="mt-4 space-y-1.5">
        <div className="w-full bg-[#1C1C35] h-2 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${timerBarColor}`} 
            style={{ width: `${timerPercentage}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-[10px] font-mono text-gray-500">
          <span>Time Remaining</span>
          <span className={timeLeft <= 5 ? "text-red-400 font-bold" : ""}>{timeLeft}s</span>
        </div>
      </div>

      {/* Main Question Display */}
      <main className="flex-1 my-12 flex flex-col justify-center space-y-8">
        
        {/* Large Question Header */}
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-white leading-snug">
            {currentQuestion.question}
          </h1>
        </div>

        {/* Options Selection Panels */}
        <div className="grid md:grid-cols-2 gap-4">
          {(["A", "B", "C", "D"] as const).map((opt) => {
            const isSelected = selectedOption === opt
            const isCorrectOption = currentQuestion.correct === opt
            const optionText = currentQuestion.options[opt]

            let optionStyle = "bg-[#12121E] border-gray-800/80 hover:border-gray-700"
            
            if (isAnswered) {
              if (isSelected) {
                optionStyle = isCorrectOption 
                  ? "bg-green-950/20 border-green-500 shadow-[0_0_12px_rgba(34,197,94,0.15)]" 
                  : "bg-red-950/20 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
              } else if (isCorrectOption) {
                optionStyle = "bg-green-950/10 border-green-500/50"
              } else {
                optionStyle = "bg-[#12121E]/50 border-gray-800/40 opacity-40"
              }
            }

            return (
              <button
                key={opt}
                disabled={isAnswered}
                onClick={() => handleSelectOption(opt)}
                className={`w-full p-5 rounded-2xl border text-left flex items-start space-x-4 transition-all duration-300 ${optionStyle}`}
              >
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                  isAnswered && isCorrectOption 
                    ? "bg-green-500 text-[#080810]" 
                    : isAnswered && isSelected && !isCorrectOption
                      ? "bg-red-500 text-[#080810]"
                      : "bg-[#1C1C35] text-gray-400"
                }`}>
                  {opt}
                </span>
                <span className="text-sm font-semibold text-white leading-relaxed">{optionText}</span>
              </button>
            )
          })}
        </div>

        {/* Explanation Card */}
        <div className={`transition-all duration-500 ${isAnswered ? "opacity-100 transform translate-y-0" : "opacity-0 pointer-events-none transform translate-y-2 h-0"}`}>
          {isAnswered && (
            <div className={`p-5 rounded-2xl border ${
              selectedOption === currentQuestion.correct 
                ? "bg-green-950/10 border-green-500/20" 
                : "bg-red-950/10 border-red-500/20"
            } space-y-2`}>
              <div className="flex items-center space-x-2">
                <span className="text-base">{selectedOption === currentQuestion.correct ? "🎉" : "💡"}</span>
                <h4 className={`text-xs font-bold uppercase tracking-wider ${
                  selectedOption === currentQuestion.correct ? "text-green-400" : "text-red-400"
                }`}>
                  {selectedOption === currentQuestion.correct ? "Correct Answer!" : `Incorrect. Correct Option: ${currentQuestion.correct}`}
                </h4>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                {currentQuestion.explanation}
              </p>
            </div>
          )}
        </div>

      </main>

      {/* Footer Info */}
      <footer className="text-center text-[10px] text-gray-500 tracking-wider">
        SaleswinAI Knowledge testing system • 30 seconds timer • Auto advance
      </footer>

      {/* Exit Warning Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-[#080810]/75 backdrop-blur-xs" onClick={() => setShowExitModal(false)}></div>
          <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-6 max-w-md w-full relative z-10 space-y-6">
            <div>
              <h3 className="font-display font-bold text-white text-lg">Quit Quiz Session?</h3>
              <p className="text-sm text-gray-400 mt-2">
                Are you sure you want to exit? Your progress in this session will not be saved and no XP will be awarded.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowExitModal(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-lg text-sm transition-colors"
              >
                Continue Quiz
              </button>
              <button
                onClick={confirmExit}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm transition-colors"
              >
                Exit Session
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
