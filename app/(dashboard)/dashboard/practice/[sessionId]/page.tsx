"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { db } from "@/utils/firebase/client"
import { doc, onSnapshot } from "firebase/firestore"

interface Message {
  role: "customer" | "salesperson"
  content: string
  timestamp: string
}

const PERSONA_GENDERS: Record<string, "female" | "male"> = {
  sarah_m: "female",
  mrs_okonkwo: "female",
  alhaji_musa: "male",
  david_a: "male",
  bola_tunde: "female", // Bola is female
  lagos_corporate: "female"
}

export default function PracticeSessionPage() {
  const router = useRouter()
  const { sessionId } = useParams() as { sessionId: string }

  const [session, setSession] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [userMessage, setUserMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [apiPending, setApiPending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [startFailed, setStartFailed] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [hintLoading, setHintLoading] = useState(false)
  const [hintError, setHintError] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)

  // Voice Call / Speech specific states
  const [isMuted, setIsMuted] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [showTranscript, setShowTranscript] = useState(false)
  const [micPermission, setMicPermission] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recognitionRef = useRef<any>(null)
  const latestTranscriptRef = useRef("")

  // Microphone permission query
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return
    navigator.permissions.query({ name: "microphone" as PermissionName }).then((status) => {
      setMicPermission(status.state)
      status.onchange = () => {
        setMicPermission(status.state)
      }
    }).catch(err => {
      console.warn("Permissions API not supported:", err)
    })
  }, [])

  // 1. Real-time Firestore session listener
  useEffect(() => {
    if (!sessionId) return

    const unsubscribe = onSnapshot(doc(db, "simulation_sessions", sessionId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data()
        setSession(data)
        const newMessages: Message[] = data?.messages || []
        setMessages(newMessages)

        // Default mute configuration depending on channel
        // For phone & face-to-face, auto-unmute voice synthesis by default
        if (data?.channel === "phone" || data?.channel === "face_to_face") {
          setIsMuted(false)
        } else {
          setIsMuted(true)
        }

        // Once we receive messages, clear the start-failed state and pending indicator
        if (newMessages.length > 0) {
          setStartFailed(false)
          setApiPending(false)
        }

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

  // 2. Call Timer for Phone/Face-to-Face Channels
  useEffect(() => {
    if (!session || (session.channel !== "phone" && session.channel !== "face_to_face") || session.status !== "active") return
    const interval = setInterval(() => {
      setCallDuration(prev => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [session])

  // 3. Detect __START__ failure: if no messages arrive within 15s, show retry
  useEffect(() => {
    if (messages.length === 0 && session && session.status === "active") {
      startTimerRef.current = setTimeout(() => {
        setStartFailed(true)
        setApiPending(false)
      }, 15000)
    } else {
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current)
        startTimerRef.current = null
      }
    }

    return () => {
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current)
      }
    }
  }, [messages.length, session])

  // 4. Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, apiPending])

  // 5. Voice output (Text-to-Speech) - matches gender of target persona
  const speakText = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return
    window.speechSynthesis.cancel()

    // Strip score tags and hidden content if any
    const cleanText = text.replace(/<!--.*?-->/g, "").trim()
    const utterance = new SpeechSynthesisUtterance(cleanText)
    
    // Determine target gender for this session's persona
    const gender = session?.personaKey ? (PERSONA_GENDERS[session.personaKey] || "female") : "female"
    
    const voices = window.speechSynthesis.getVoices()
    const englishVoices = voices.filter(v => v.lang.startsWith("en"))
    
    // Prioritize natural online voices (like Microsoft Natural/Online or Google Online)
    const onlineEnglishVoices = englishVoices.filter(v => 
      v.name.toLowerCase().includes("online") || v.name.toLowerCase().includes("natural") || v.name.toLowerCase().includes("premium")
    )
    
    let selectedVoice = null
    const femaleKeywords = ["female", "zira", "hazel", "susan", "samantha", "karen", "moira", "tessa", "veena", "fiona", "heera", "daria", "luna", "aurelie", "charlotte", "elsa", "joana", "sara", "yalda", "zuri", "aria", "jenny", "sally", "en-us-neural", "en-gb-neural"]
    const maleKeywords = ["male", "david", "george", "ravi", "mark", "richard", "thomas", "oliver", "daniel", "james", "william", "alex", "guy", "en-us-neural", "en-gb-neural"]

    if (gender === "female") {
      selectedVoice = onlineEnglishVoices.find(v => 
        femaleKeywords.some(kw => v.name.toLowerCase().includes(kw))
      )
      if (!selectedVoice) {
        selectedVoice = englishVoices.find(v => 
          femaleKeywords.some(kw => v.name.toLowerCase().includes(kw))
        )
      }
    } else {
      selectedVoice = onlineEnglishVoices.find(v => 
        maleKeywords.some(kw => v.name.toLowerCase().includes(kw))
      )
      if (!selectedVoice) {
        selectedVoice = englishVoices.find(v => 
          maleKeywords.some(kw => v.name.toLowerCase().includes(kw))
        )
      }
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice
    } else if (englishVoices.length > 0) {
      utterance.voice = englishVoices[0]
    }

    // Adjust rate and pitch slightly to make the cadence sound more conversational
    utterance.rate = 0.95
    utterance.pitch = 1.0

    window.speechSynthesis.speak(utterance)
  }, [session])

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  }, [])

  // Auto-play TTS on new customer messages
  useEffect(() => {
    if (messages.length > 0 && !isMuted) {
      const lastMsg = messages[messages.length - 1]
      if (lastMsg.role === "customer") {
        speakText(lastMsg.content)
      }
    }
  }, [messages, isMuted, speakText])

  // Fix async voice loading in some browsers
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return
    const handleVoicesChanged = () => {
      window.speechSynthesis.getVoices()
    }
    window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged)
    return () => window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged)
  }, [])

  const handleSendMessageText = useCallback(async (messageText: string) => {
    if (loading || !messageText.trim()) return

    const tempText = messageText
    setUserMessage("")
    latestTranscriptRef.current = "" // clear ref to avoid double submits
    setLoading(true)
    setApiPending(true)
    setChatError(null)
    setHint(null)
    setHintError(null)

    try {
      const res = await fetch("/api/simulate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userMessage: tempText
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to send message")
      }
    } catch (err: any) {
      console.error("Failed to send message:", err)
      setChatError(err.message || "Failed to send message. Please try again.")
      setUserMessage(tempText)
      setApiPending(false)
    } finally {
      setLoading(false)
    }
  }, [sessionId, loading])

  // 6. Voice Input (Speech-to-Text) - Auto-send on silence
  const startListening = () => {
    if (typeof window === "undefined") return
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please use Chrome, Safari or Edge.")
      return
    }

    stopSpeaking() // stop the AI voice so it doesn't transcribe itself

    if (!recognitionRef.current) {
      const rec = new SpeechRecognition()
      rec.continuous = false; // fires onend as soon as speaker pauses
      rec.interimResults = true;
      rec.lang = "en-NG"; // Locale targeting Nigerian english

      rec.onstart = () => {
        setIsListening(true)
      }

      rec.onresult = (event: any) => {
        let interimTranscript = ""
        let finalTranscript = ""

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript
          } else {
            interimTranscript += event.results[i][0].transcript
          }
        }

        const transcript = finalTranscript || interimTranscript
        if (transcript) {
          setUserMessage(transcript)
          latestTranscriptRef.current = transcript
        }
      }

      rec.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error)
        setIsListening(false)
      }

      rec.onend = () => {
        setIsListening(false)
        const finalMsg = latestTranscriptRef.current.trim()
        if (finalMsg && finalMsg !== "__START__") {
          handleSendMessageText(finalMsg)
        }
      }

      recognitionRef.current = rec
    }

    try {
      recognitionRef.current.start()
    } catch (e) {
      console.error(e)
    }
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) {
        console.error(e)
      }
    }
    setIsListening(false)
  }

  // Retry the __START__ call
  const handleRetryStart = useCallback(async () => {
    setStartFailed(false)
    setChatError(null)
    setApiPending(true)

    try {
      const res = await fetch("/api/simulate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userMessage: "__START__"
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to start conversation")
      }
    } catch (err: any) {
      console.error("Retry start failed:", err)
      setChatError(err.message || "Failed to start conversation. Please try again.")
      setApiPending(false)
      setStartFailed(true)
    }
  }, [sessionId])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userMessage.trim() || loading) return
    stopSpeaking()
    stopListening()
    handleSendMessageText(userMessage)
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
    stopSpeaking()
    stopListening()

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

  // Formatting Call Timer
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Calculate dynamic client mood based on rolling metrics
  const getClientMood = () => {
    if (!session || !session.scores) return "Attentive"
    const { overall = 50, trust = 50, discovery = 50 } = session.scores
    const avg = (overall + trust + discovery) / 3
    if (avg >= 70) return "Warm & Receptive 🟢"
    if (avg < 45) return "Skeptical & Reserved 🔴"
    return "Professional & Attentive 🟡"
  }

  // Dial / Immersive Voice Call Layout
  if (channel === "phone") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[#07070E] font-body text-[#F2F2F7]">
        {/* Calling Header */}
        <header className="h-16 border-b border-gray-900/60 bg-[#080810]/40 backdrop-blur-md flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center space-x-2 text-xs font-semibold text-gray-500 uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-[#00D68F] animate-ping"></span>
            <span>Live Phone Simulation</span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                showTranscript
                  ? "bg-[#00D68F] text-[#080810] border-[#00D68F]"
                  : "bg-gray-900 border-gray-800 text-gray-300 hover:text-white"
              }`}
            >
              {showTranscript ? "Hide Transcript" : "Show Transcript"}
            </button>
            <button
              onClick={handleEndSession}
              disabled={ending}
              className="px-4 py-2 rounded-lg bg-red-950/40 hover:bg-red-950/80 border border-red-500/30 text-red-200 text-xs font-bold transition-all"
            >
              {ending ? "Ending..." : "End Call"}
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 flex relative overflow-hidden">
          
          {/* Active Call UI (Left / Center) */}
          <div className={`flex-1 flex flex-col items-center justify-center p-6 transition-all duration-300 ${showTranscript ? "lg:mr-[380px]" : ""}`}>
            
            {/* Caller Profile */}
            <div className="flex flex-col items-center text-center space-y-6">
              
              {/* Pulsating Avatar */}
              <div className="relative">
                <div className={`absolute inset-0 rounded-full bg-blue-500/10 border border-blue-500/20 scale-150 ${apiPending || isListening ? "animate-pulse" : ""}`}></div>
                <div className={`absolute inset-0 rounded-full bg-[#00D68F]/5 border border-[#00D68F]/15 scale-125 ${apiPending ? "animate-ping" : ""}`}></div>
                
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#1C1C35] to-[#121225] border-2 border-[#00D68F]/30 flex items-center justify-center font-display font-black text-4xl text-[#00D68F] shadow-2xl relative z-10">
                  {session.personaName.split(" ").map((n: string) => n[0]).join("")}
                </div>
              </div>

              {/* Caller Meta */}
              <div className="space-y-2 relative z-10">
                <h2 className="text-2xl font-display font-bold text-white">{session.personaName}</h2>
                <div className="flex items-center justify-center space-x-2 mt-1">
                  <span className="text-xs font-bold text-gray-500 tracking-widest uppercase bg-gray-950/40 px-3 py-1 rounded-full border border-gray-900 inline-block">
                    {session.difficulty} level buyer
                  </span>
                  <span className="text-xs font-bold text-blue-400 tracking-widest uppercase bg-blue-950/40 px-3 py-1 rounded-full border border-blue-900 inline-block">
                    {PERSONA_GENDERS[session.personaKey] || "female"} Voice
                  </span>
                </div>
                <p className="text-xl font-mono text-emerald-400 font-bold tracking-wider mt-2">
                  {formatDuration(callDuration)}
                </p>
              </div>

              {/* Call Status Subtitle */}
              <div className="min-h-[64px] max-w-xl px-6 py-4 rounded-xl bg-gray-950/40 border border-gray-900 text-center space-y-1 relative z-10">
                <span className="text-[10px] text-[#00D68F] font-bold uppercase tracking-wider block animate-pulse">
                  {apiPending ? `${session.personaName} is speaking...` : isListening ? "Listening to you... Speak now" : "Connected"}
                </span>
                <p className="text-sm text-gray-300 leading-relaxed italic">
                  {apiPending 
                    ? "Generating voice response..." 
                    : isListening 
                    ? (userMessage || "Speak your response...") 
                    : "Audio Active. Listen to the buyer and speak."
                  }
                </p>
              </div>

            </div>

            {/* Audio Waveform Animation (Simulated) */}
            <div className="h-16 flex items-center justify-center space-x-1.5 mt-10">
              {[...Array(12)].map((_, i) => {
                let animationClass = "h-3"
                if (apiPending) {
                  animationClass = i % 2 === 0 ? "animate-pulse h-10" : "animate-pulse h-6"
                } else if (isListening) {
                  animationClass = i % 3 === 0 ? "animate-bounce h-12" : "animate-bounce h-8"
                }
                return (
                  <div
                    key={i}
                    className={`w-1 rounded-full bg-gradient-to-t from-blue-500 to-[#00D68F] transition-all duration-300 ${animationClass}`}
                    style={{ animationDelay: `${i * 100}ms` }}
                  ></div>
                )
              })}
            </div>

            {/* Dial / Call Controls */}
            <div className="mt-12 flex items-center justify-center space-x-6">
              
              {/* Speaker / Mute synthesis */}
              <button
                type="button"
                onClick={() => {
                  const newMute = !isMuted
                  setIsMuted(newMute)
                  if (newMute) stopSpeaking()
                }}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all border shadow-lg ${
                  isMuted
                    ? "bg-rose-950/20 border-rose-500/30 text-rose-400 hover:bg-rose-950/40"
                    : "bg-emerald-950/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/40"
                }`}
                title={isMuted ? "Unmute voice" : "Mute voice"}
              >
                {isMuted ? "🔇" : "🔊"}
              </button>

              {/* Mic / STT trigger */}
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all border shadow-2xl scale-110 ${
                  isListening
                    ? "bg-red-600 border-red-500 text-white animate-pulse"
                    : "bg-[#00D68F] border-[#00d68f] text-[#080810] hover:bg-[#00b378]"
                }`}
                title={isListening ? "Pause microphone" : "Speak now"}
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>

              {/* Red End Call button */}
              <button
                type="button"
                onClick={handleEndSession}
                className="w-14 h-14 rounded-full bg-red-600 border border-red-500 flex items-center justify-center text-white hover:bg-red-700 transition-all shadow-lg"
                title="End Call"
              >
                <svg className="w-6 h-6 transform rotate-[135deg]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </button>

            </div>

            {/* Mic Permission Alert */}
            {micPermission === "denied" && (
              <div className="mt-4 px-4 py-2 bg-red-950/40 border border-red-500/30 rounded-lg text-xs text-red-200 text-center animate-pulse">
                ⚠️ Microphone access is blocked. Click the camera/microphone icon in your browser's search bar (or the lock icon) to allow access.
              </div>
            )}

            {/* Subtext display or input box for corrections */}
            <div className="w-full max-w-lg mt-6">
              <form onSubmit={handleSendMessage} className="flex items-center space-x-2 bg-gray-950/40 p-2.5 rounded-xl border border-gray-900">
                <input
                  type="text"
                  required
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  placeholder={isListening ? "Speak now... Auto-sends on pause" : "Review spoken text or type directly..."}
                  className="flex-1 bg-transparent px-3 py-1.5 text-sm focus:outline-none text-gray-200 placeholder-gray-600"
                />
                <button
                  type="submit"
                  disabled={loading || !userMessage.trim()}
                  className="px-4 py-1.5 rounded-lg bg-[#00D68F] hover:bg-[#00b378] text-[#080810] text-xs font-bold uppercase transition-all disabled:opacity-50 shrink-0"
                >
                  Send
                </button>
              </form>
            </div>

          </div>

          {/* Collapsible Transcript Panel (Right Side overlay) */}
          {showTranscript && (
            <div className="absolute right-0 top-0 bottom-0 w-full lg:w-[380px] bg-[#121225] border-l border-gray-850/80 flex flex-col z-20 shadow-2xl animate-slideLeft">
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Live Call Log</h3>
                <button onClick={() => setShowTranscript(false)} className="text-gray-500 hover:text-white text-sm">
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {messages.map((m, index) => {
                  const isCustomer = m.role === "customer"
                  return (
                    <div key={index} className="border-b border-gray-900/60 pb-3 last:border-0">
                      <div className="flex items-center space-x-2 text-[9px] font-bold tracking-wider mb-1">
                        <span className={isCustomer ? "text-[#00D68F]" : "text-blue-400"}>
                          {isCustomer ? session.personaName.toUpperCase() : "YOU"}
                        </span>
                        <span className="text-gray-600">•</span>
                        <span className="text-gray-500 font-mono">
                          {m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ""}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed pl-1">
                        {m.content}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    )
  }

  // Immersive Boardroom / Face-to-Face layout
  if (channel === "face_to_face") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-[#05050B] font-body text-[#F2F2F7]">
        {/* Boardroom Header */}
        <header className="h-16 border-b border-gray-900 bg-[#080814]/50 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center space-x-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <span>🤝 In-Person Meeting</span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                showTranscript
                  ? "bg-[#00D68F] text-[#080810] border-[#00D68F]"
                  : "bg-gray-900 border-gray-800 text-gray-300 hover:text-white"
              }`}
            >
              {showTranscript ? "Hide Meeting Minutes" : "Show Meeting Minutes"}
            </button>
            <button
              onClick={handleEndSession}
              disabled={ending}
              className="px-4 py-2 rounded-lg bg-red-950/40 hover:bg-red-950/80 border border-red-500/30 text-red-200 text-xs font-bold transition-all"
            >
              {ending ? "Ending..." : "End Meeting"}
            </button>
          </div>
        </header>

        {/* Boardroom Main Body */}
        <div className="flex-1 flex relative overflow-hidden bg-gradient-to-b from-[#080814] via-[#05050B] to-[#030307]">
          
          {/* Main Visual Boardroom Area */}
          <div className={`flex-1 flex flex-col items-center justify-between p-8 transition-all duration-300 ${showTranscript ? "lg:mr-[380px]" : ""}`}>
            
            {/* Top Area: Meeting Room Context */}
            <div className="w-full max-w-2xl flex items-center justify-between text-xs text-gray-500 uppercase tracking-widest border-b border-gray-900 pb-3">
              <span>Location: Executive Boardroom</span>
              <span className="font-mono">{formatDuration(callDuration)} elapsed</span>
            </div>

            {/* Center Area: Corporate Portrait Card */}
            <div className="flex flex-col items-center justify-center space-y-6 max-w-xl w-full">
              
              {/* Glassmorphic Persona Card */}
              <div className="w-full bg-[#121225]/40 border border-gray-850/60 rounded-3xl p-6 shadow-2xl backdrop-blur-md flex flex-col items-center text-center space-y-4">
                
                {/* Avatar */}
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-purple-500/20 flex items-center justify-center font-display font-black text-3xl text-[#00D68F] shadow-lg">
                  {session.personaName.split(" ").map((n: string) => n[0]).join("")}
                </div>

                {/* Meta details */}
                <div className="space-y-1">
                  <h2 className="text-xl font-display font-bold text-white leading-none">{session.personaName}</h2>
                  <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider">Prospective Real Estate Buyer</p>
                </div>

                {/* Mood Badge & Status Indicators */}
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-bold bg-gray-950/60 px-3 py-1 border border-gray-900 rounded-full text-gray-400">
                    Difficulty: {session.difficulty}
                  </span>
                  <span className="text-[11px] font-bold bg-gray-950/60 px-3 py-1 border border-gray-900 rounded-full text-gray-300">
                    Client Mood: <span className="font-extrabold">{getClientMood()}</span>
                  </span>
                </div>

              </div>

              {/* Dialogue Subtitle Bubble */}
              <div className="w-full relative">
                {/* Visual quote indicator */}
                <span className="absolute -top-3 left-4 text-4xl text-[#00D68F]/20 font-serif">“</span>
                <div className="bg-[#1C1C35]/50 border border-gray-800/40 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
                  <p className="text-sm text-gray-200 leading-relaxed text-center">
                    {apiPending 
                      ? <span className="text-gray-500 italic animate-pulse">Thinking...</span> 
                      : messages.length > 0 
                      ? messages[messages.length - 1].content 
                      : "Meeting started. The client is waiting for you to introduce yourself."
                    }
                  </p>
                </div>
              </div>

            </div>

            {/* Bottom Area: Controls & Text Input */}
            <div className="w-full max-w-2xl flex flex-col items-center space-y-4">
              
              {/* Voice waves */}
              <div className="h-6 flex items-center space-x-1">
                {[...Array(8)].map((_, i) => {
                  let barClass = "h-1"
                  if (apiPending) barClass = i % 2 === 0 ? "h-4 animate-pulse" : "h-2 animate-pulse"
                  else if (isListening) barClass = "h-5 animate-bounce"
                  return (
                    <div key={i} className={`w-0.8 rounded-full bg-[#00D68F] transition-all duration-300 ${barClass}`} style={{ animationDelay: `${i * 120}ms` }}></div>
                  )
                })}
              </div>

              {/* Speech & Form Controls */}
              <form onSubmit={handleSendMessage} className="w-full flex items-center space-x-2 bg-[#121225]/60 border border-gray-850/60 p-3 rounded-2xl shadow-xl backdrop-blur-md">
                
                {/* Voice button */}
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all border shrink-0 ${
                    isListening
                      ? "bg-red-500/20 border-red-500 text-red-500 animate-pulse"
                      : "bg-[#00D68F]/10 border-[#00D68F]/20 text-[#00D68F] hover:bg-[#00D68F]/20"
                  }`}
                  title={isListening ? "Stop listening" : "Speak to Client"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>

                {/* Speaker button */}
                <button
                  type="button"
                  onClick={() => {
                    const newMute = !isMuted
                    setIsMuted(newMute)
                    if (newMute) stopSpeaking()
                  }}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all border shrink-0 ${
                    isMuted
                      ? "bg-rose-950/20 border-rose-500/30 text-rose-400"
                      : "bg-emerald-950/20 border-emerald-500/30 text-emerald-400"
                  }`}
                  title={isMuted ? "Unmute voice" : "Mute voice"}
                >
                  {isMuted ? "🔇" : "🔊"}
                </button>

                {/* Input Text Box */}
                <input
                  type="text"
                  required
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  placeholder={isListening ? "Speaking... pauses automatically submit" : "Review spoken text or type directly..."}
                  className="flex-1 bg-transparent px-3 text-sm focus:outline-none text-gray-200 placeholder-gray-600"
                />

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={loading || !userMessage.trim()}
                  className="w-12 h-12 rounded-xl bg-[#00D68F] hover:bg-[#00b378] text-[#080810] flex items-center justify-center transition-all disabled:opacity-50 shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>

              </form>

              {/* Mic Permission Alert */}
              {micPermission === "denied" && (
                <div className="w-full px-4 py-2 bg-red-950/30 border border-red-500/20 rounded-xl text-center text-[11px] text-red-200">
                  ⚠️ Mic Blocked: Click camera/microphone icon in the search bar to allow meeting speech.
                </div>
              )}

            </div>

          </div>

          {/* Right Side Transcript Drawer (Meeting Minutes style) */}
          {showTranscript && (
            <div className="absolute right-0 top-0 bottom-0 w-full lg:w-[380px] bg-[#0c0c16] border-l border-gray-900 flex flex-col z-20 shadow-2xl animate-slideLeft">
              <div className="p-4 border-b border-gray-900 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Meeting Minutes</h3>
                <button onClick={() => setShowTranscript(false)} className="text-gray-500 hover:text-white text-sm">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {messages.map((m, index) => {
                  const isCustomer = m.role === "customer"
                  return (
                    <div key={index} className="border-b border-gray-900/60 pb-3 last:border-0">
                      <div className="flex items-center space-x-2 text-[9px] font-bold tracking-wider mb-1">
                        <span className={isCustomer ? "text-[#00D68F]" : "text-blue-400"}>
                          {isCustomer ? session.personaName.toUpperCase() : "YOU (SALESPERSON)"}
                        </span>
                        <span className="text-gray-600">•</span>
                        <span className="text-gray-500 font-mono">
                          {m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ""}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed pl-1">
                        {m.content}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    )
  }

  // Default layout (WhatsApp, Email)
  let containerBg = "bg-[#080810]"
  let chatAreaBg = "bg-[#0c0c16]/50"
  let bubbleCustomer = "bg-[#1C1C35] text-[#F2F2F7] rounded-2xl rounded-tl-none border border-gray-800/40"
  let bubbleSales = "bg-[#004D38] text-white rounded-2xl rounded-tr-none border border-[#00D68F]/10"

  if (channel === "whatsapp") {
    containerBg = "bg-[#0B141A]"
    chatAreaBg = "bg-[#0B141A] bg-[radial-gradient(#153028_1px,transparent_1px)] [background-size:16px_16px]"
    bubbleCustomer = "bg-[#202C33] text-[#E9EDEF] rounded-lg rounded-tl-none border-none shadow-sm"
    bubbleSales = "bg-[#005C4B] text-[#E9EDEF] rounded-lg rounded-tr-none border-none shadow-sm"
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
          <button
            onClick={() => {
              const newMute = !isMuted
              setIsMuted(newMute)
              if (newMute) stopSpeaking()
            }}
            className="p-2 rounded-lg bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white transition-colors"
            title={isMuted ? "Unmute client voice" : "Mute client voice"}
          >
            {isMuted ? (
              <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
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

      {/* Error Banner */}
      {chatError && (
        <div className="border-b border-red-500/30 bg-red-950/30 shrink-0 z-10">
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-red-200">
              <span>⚠️</span>
              <span>{chatError}</span>
            </div>
            <button
              onClick={() => setChatError(null)}
              className="text-red-300 hover:text-white text-xs font-bold px-2 py-1 rounded hover:bg-red-900/30 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 2. Messages List */}
      <div className={`flex-1 overflow-y-auto p-6 space-y-6 ${chatAreaBg}`}>
        {messages.length === 0 && !apiPending && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto">
            <span className="text-4xl animate-bounce">💬</span>
            <h2 className="text-sm font-bold text-white">
              {startFailed ? "Failed to start conversation" : "Starting conversation..."}
            </h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              {startFailed
                ? "The customer didn't respond. This could be a temporary issue."
                : "Waiting for the customer to open the conversation."
              }
            </p>
            {startFailed && (
              <button
                onClick={handleRetryStart}
                className="mt-2 px-6 py-2.5 rounded-lg bg-[#00D68F] hover:bg-[#00b378] text-[#080810] text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-[#00D68F]/10"
              >
                🔄 Retry
              </button>
            )}
          </div>
        )}

        {messages.length === 0 && apiPending && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto">
            <div className="w-8 h-8 border-4 border-t-[#00D68F] border-gray-800 rounded-full animate-spin"></div>
            <h2 className="text-sm font-bold text-white">Starting conversation...</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              Waiting for the customer to open the conversation.
            </p>
          </div>
        )}

        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((m, index) => {
            const isCustomer = m.role === "customer"

            return (
              <div
                key={index}
                className={`flex ${isCustomer ? "justify-start" : "justify-end"} items-start space-x-2`}
              >
                <div className={`max-w-xl px-4 py-3 shadow-md ${isCustomer ? bubbleCustomer : bubbleSales}`}>
                  <p className="text-sm leading-relaxed">{m.content}</p>
                </div>
                {isCustomer && (
                  <button
                    onClick={() => speakText(m.content)}
                    className="p-2 rounded-lg bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-500 hover:text-white transition-all text-xs"
                    title="Speak text"
                  >
                    🔊
                  </button>
                )}
              </div>
            )
          })}

          {/* Typing Indicator */}
          {apiPending && messages.length > 0 && (
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
