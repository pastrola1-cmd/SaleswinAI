"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { db } from "@/utils/firebase/client"
import { doc, onSnapshot } from "firebase/firestore"

interface Message {
  role: "customer" | "salesperson"
  content: string
  timestamp: string
}

export default function PracticeSessionPage() {
  const router = useRouter()
  const { sessionId } = useParams() as { sessionId: string }

  const [session, setSession] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [userMessage, setUserMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [typing, setTyping] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [hintLoading, setHintLoading] = useState(false)
  const [hintError, setHintError] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 1. Real-time Firestore session listener
  useEffect(() => {
    if (!sessionId) return

    const unsubscribe = onSnapshot(doc(db, "simulation_sessions", sessionId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data()
        setSession(data)
        setMessages(data?.messages || [])

        // If completed already, redirect to debrief
        if (data?.status === "completed") {
          router.push(`/dashboard/practice/${sessionId}/debrief`)
        }
      } else {
        router.push("/dashboard/practice")
      }
    })

    return () => unsubscribe()
  }, [sessionId, router])

  // 2. Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, typing])

  // Trigger customer typing simulation on user message
  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].role === "salesperson") {
      setTyping(true)
    } else {
      setTyping(false)
    }
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userMessage.trim() || loading) return

    const messageText = userMessage
    setUserMessage("")
    setLoading(true)
    setHint(null) // Clear hint on new message
    setHintError(null)

    try {
      const res = await fetch("/api/simulate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userMessage: messageText
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to send message")
      }
    } catch (err) {
      console.error("Failed to send message:", err)
      // Restore user message in case of error
      setUserMessage(messageText)
    } finally {
      setLoading(false)
    }
  }

  const handleGetHint = async () => {
    if (hintLoading) return
    setHintLoading(true)
    setHint(null)
    setHintError(null)

    try {
      const res = await fetch("/api/simulate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userMessage: "__HINT__"
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch hint")
      }

      setHint(data.hint)
    } catch (err: any) {
      console.error("Hint error:", err)
      setHintError(err.message || "Failed to fetch hint.")
    } finally {
      setHintLoading(false)
    }
  }

  const handleEndSession = async () => {
    if (ending) return
    setEnding(true)

    try {
      const res = await fetch("/api/end-simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      })

      if (res.ok) {
        router.push(`/dashboard/practice/${sessionId}/debrief`)
      } else {
        const data = await res.json()
        alert(data.error || "Failed to end simulation")
        setEnding(false)
      }
    } catch (err) {
      console.error("End session error:", err)
      setEnding(false)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-t-[#00D68F] border-gray-800 rounded-full animate-spin"></div>
      </div>
    )
  }

  const channel = session.channel || "whatsapp"

  // Channel specific styling
  let containerBg = "bg-[#080810]"
  let chatAreaBg = "bg-[#0c0c16]/50"
  let bubbleCustomer = "bg-[#1C1C35] text-[#F2F2F7] rounded-2xl rounded-tl-none border border-gray-800/40"
  let bubbleSales = "bg-[#004D38] text-white rounded-2xl rounded-tr-none border border-[#00D68F]/10"

  if (channel === "whatsapp") {
    containerBg = "bg-[#0B141A]"
    chatAreaBg = "bg-[#0B141A] bg-[radial-gradient(#153028_1px,transparent_1px)] [background-size:16px_16px]"
    bubbleCustomer = "bg-[#202C33] text-[#E9EDEF] rounded-lg rounded-tl-none border-none shadow-sm"
    bubbleSales = "bg-[#005C4B] text-[#E9EDEF] rounded-lg rounded-tr-none border-none shadow-sm"
  } else if (channel === "phone") {
    containerBg = "bg-[#080810]"
    chatAreaBg = "bg-[#080810] border-x border-gray-800/20"
    bubbleCustomer = "bg-[#121225] border-l-4 border-blue-500 text-gray-300 rounded-lg rounded-tl-none px-4 py-3"
    bubbleSales = "bg-[#121225] border-l-4 border-[#00D68F] text-gray-300 rounded-lg rounded-tr-none px-4 py-3"
  } else if (channel === "email") {
    containerBg = "bg-[#0E0E18]"
    chatAreaBg = "bg-[#121225] border border-gray-800/40 rounded-xl"
    bubbleCustomer = "bg-[#1C1C35] border border-gray-800 text-gray-200 rounded-lg p-5 shadow-md w-full"
    bubbleSales = "bg-[#07241A] border border-[#00D68F]/20 text-gray-200 rounded-lg p-5 shadow-md w-full"
  }

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${containerBg} font-body text-[#F2F2F7]`}>
      
      {/* 1. Header */}
      <header className="h-16 border-b border-gray-800/40 bg-[#080810]/95 backdrop-blur-md flex items-center justify-between px-6 z-10 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-purple-500/30 flex items-center justify-center font-display font-black text-sm text-[#00D68F]">
            {session.personaName.split(" ").map((n: string) => n[0]).join("")}
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">{session.personaName}</h1>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-[10px] font-bold bg-[#1C1C35] text-gray-400 border border-gray-800 rounded px-1.5 py-0.2 uppercase tracking-wider">
                {channel.replace("_", " ")}
              </span>
              <span className="text-[10px] font-bold bg-[#00D68F]/10 text-[#00D68F] border border-[#00D68F]/20 rounded px-1.5 py-0.2 uppercase tracking-wider">
                {session.difficulty}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <span className="text-xs text-gray-500 font-semibold tracking-wider uppercase">
            Messages: {session.messageCount || 0}
          </span>
          <button
            onClick={handleEndSession}
            disabled={ending}
            className="px-4 py-2 rounded-lg bg-red-950/40 hover:bg-red-950/80 border border-red-500/30 text-red-200 text-xs font-bold transition-all disabled:opacity-50"
          >
            {ending ? "Ending..." : "End Session"}
          </button>
        </div>
      </header>

      {/* 2. Messages List */}
      <div className={`flex-1 overflow-y-auto p-6 space-y-6 ${chatAreaBg}`}>
        {messages.length === 0 && !typing && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto">
            <span className="text-4xl animate-bounce">💬</span>
            <h2 className="text-sm font-bold text-white">Starting conversation...</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              Waiting for the customer to open the conversation.
            </p>
          </div>
        )}

        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((m, index) => {
            const isCustomer = m.role === "customer"

            if (channel === "email") {
              return (
                <div
                  key={index}
                  className={`flex flex-col space-y-2 max-w-3xl ${isCustomer ? "mr-auto" : "ml-auto"}`}
                >
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider px-2">
                    {isCustomer ? `From: ${session.personaName}` : "From: You (Salesperson)"}
                  </span>
                  <div className={isCustomer ? bubbleCustomer : bubbleSales}>
                    <p className="text-sm leading-relaxed whitespace-pre-line">{m.content}</p>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={index}
                className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}
              >
                <div className={`max-w-xl px-4 py-3 shadow-md ${isCustomer ? bubbleCustomer : bubbleSales}`}>
                  {channel === "phone" && (
                    <span className={`text-[10px] font-bold block uppercase tracking-wider mb-1 ${
                      isCustomer ? "text-blue-400" : "text-[#00D68F]"
                    }`}>
                      {isCustomer ? session.personaName : "You"}
                    </span>
                  )}
                  <p className="text-sm leading-relaxed">{m.content}</p>
                </div>
              </div>
            )
          })}

          {/* Typing Indicator */}
          {typing && (
            <div className="flex justify-start">
              <div className={`px-4 py-3 rounded-2xl rounded-tl-none flex items-center space-x-1.5 ${bubbleCustomer}`}>
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 3. Hint Display */}
      {hint && (
        <div className="border-t border-gray-800/40 bg-[#121225] shrink-0">
          <div className="max-w-4xl mx-auto p-4 flex items-start space-x-3">
            <span className="text-xl">💡</span>
            <div className="flex-1">
              <h4 className="text-xs font-bold text-[#00D68F] uppercase tracking-wider">Coach Hint</h4>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">{hint}</p>
            </div>
            <button
              onClick={() => setHint(null)}
              className="text-gray-500 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {hintError && (
        <div className="border-t border-red-500/20 bg-red-950/20 shrink-0">
          <div className="max-w-4xl mx-auto p-4 flex items-center justify-between text-xs text-red-200">
            <span>⚠️ {hintError}</span>
            <button onClick={() => setHintError(null)} className="text-gray-500 hover:text-white">✕</button>
          </div>
        </div>
      )}

      {/* 4. Input Area */}
      <footer className="border-t border-gray-800/40 bg-[#080810]/95 p-4 shrink-0">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-stretch md:items-center space-y-3 md:space-y-0 md:space-x-3">
          
          {/* Hint button */}
          <button
            onClick={handleGetHint}
            disabled={hintLoading || loading}
            className="px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 hover:border-[#00D68F]/30 text-xs font-bold text-gray-300 hover:text-white flex items-center justify-center space-x-2 shrink-0 transition-colors disabled:opacity-50"
          >
            {hintLoading ? (
              <div className="w-3.5 h-3.5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
            ) : (
              <span>💡 Need a hint? (50 XP)</span>
            )}
          </button>

          {/* Form */}
          <form onSubmit={handleSendMessage} className="flex-1 flex items-center space-x-2">
            <input
              type="text"
              required
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              placeholder={`Type your response to ${session.personaName}...`}
              className="flex-1 px-4 py-3 rounded-xl bg-[#121225] border border-gray-800 text-sm focus:outline-none focus:border-[#00D68F] focus:ring-1 focus:ring-[#00D68F] placeholder-gray-600 transition-all"
            />
            <button
              type="submit"
              disabled={loading || !userMessage.trim()}
              className="w-12 h-12 rounded-xl bg-[#00D68F] hover:bg-[#00b378] text-[#080810] flex items-center justify-center transition-all disabled:opacity-50 shrink-0 shadow-lg shadow-[#00D68F]/10"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-t-transparent border-[#080810] rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              )}
            </button>
          </form>

        </div>
      </footer>

    </div>
  )
}
