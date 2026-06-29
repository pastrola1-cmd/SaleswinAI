"use client"

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react"
import { useProfile } from "@/hooks/useProfile"
import { db } from "@/utils/firebase/client"
import { collection, query, where, onSnapshot, doc } from "firebase/firestore"
import confetti from "canvas-confetti"

interface Toast {
  id: string
  type: "xp" | "badge" | "streak"
  message: string
  emoji: string
}

interface ToastContextType {
  toasts: Toast[]
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile()
  const [toasts, setToasts] = useState<Toast[]>([])
  const [levelUpData, setLevelUpData] = useState<{ active: boolean; level: number; title: string } | null>(null)

  const mountedAt = useRef(new Date())
  const prevLevel = useRef<number | null>(null)
  const prevStreak = useRef<number | null>(null)

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((type: Toast["type"], message: string, emoji: string) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, type, message, emoji }])

    // Auto-remove after 4 seconds
    setTimeout(() => {
      removeToast(id)
    }, 4000)
  }, [removeToast])

  useEffect(() => {
    if (!profile?.id) {
      prevLevel.current = null
      prevStreak.current = null
      return
    }

    const uid = profile.id
    const startTimestamp = mountedAt.current.getTime()

    // 1. Listen to new XP Logs
    const xpQuery = query(collection(db, "xp_log"), where("userId", "==", uid))
    const unsubscribeXp = onSnapshot(xpQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data()
          const createdAtMs = data.createdAt ? (data.createdAt.toMillis ? data.createdAt.toMillis() : new Date(data.createdAt).getTime()) : new Date(data.created_at).getTime()
          
          // Only notify if created after the session started/page loaded
          if (createdAtMs >= startTimestamp - 1000) {
            const amount = data.amount || data.xpEarned || 0
            if (amount > 0) {
              addToast("xp", `+${amount} XP — ${data.reason}`, "🎯")
            } else if (amount < 0) {
              addToast("xp", `${amount} XP — ${data.reason}`, "💡")
            }
          }
        }
      })
    })

    // 2. Listen to new Badges
    const badgeQuery = query(collection(db, "badges"), where("userId", "==", uid))
    const unsubscribeBadges = onSnapshot(badgeQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data()
          const earnedAtMs = data.earnedAt ? (data.earnedAt.toMillis ? data.earnedAt.toMillis() : new Date(data.earnedAt).getTime()) : new Date(data.earned_at).getTime()

          if (earnedAtMs >= startTimestamp - 1000) {
            addToast("badge", `New Badge Unlocked: ${data.badgeName}!`, data.badgeIcon || "🏆")
          }
        }
      })
    })

    // 3. Listen to level-up & streak changes on user progress
    const progressRef = doc(db, "user_progress", uid)
    const unsubscribeProgress = onSnapshot(progressRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data()
        const currentLvl = data.level || 1
        const levelTitle = data.levelTitle || data.level_title || "Rookie"
        const currentStrk = data.streakDays !== undefined ? data.streakDays : (data.streak_days || 0)

        // Evaluate level-up
        if (prevLevel.current !== null && currentLvl > prevLevel.current) {
          // Trigger fullscreen Level Up modal & Confetti
          setLevelUpData({ active: true, level: currentLvl, title: levelTitle })
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 }
          })
        }
        prevLevel.current = currentLvl

        // Evaluate streak notification
        if (prevStreak.current !== null && currentStrk > prevStreak.current) {
          addToast("streak", `${currentStrk} Day Practice Streak! Keep going!`, "🔥")
        }
        prevStreak.current = currentStrk
      }
    })

    return () => {
      unsubscribeXp()
      unsubscribeBadges()
      unsubscribeProgress()
    }
  }, [profile?.id, addToast])

  return (
    <ToastContext.Provider value={{ toasts, removeToast }}>
      {children}

      {/* Floating Toasts container */}
      <div className="fixed bottom-6 right-6 z-55 flex flex-col space-y-3 pointer-events-none max-w-sm w-full">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center p-4 rounded-xl border shadow-xl bg-[#121225]/95 backdrop-blur-md animate-slideUp transition-all duration-200 ${
              t.type === "xp"
                ? "border-[#00D68F]/30 text-white"
                : t.type === "badge"
                ? "border-amber-500/30 text-white"
                : "border-orange-500/30 text-white"
            }`}
          >
            <span className="text-xl mr-3 shrink-0">{t.emoji}</span>
            <p className="text-xs font-semibold flex-1 leading-relaxed">{t.message}</p>
            <button
              onClick={() => removeToast(t.id)}
              className="text-gray-500 hover:text-gray-300 ml-4 shrink-0 text-xs"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Fullscreen Level Up overlay */}
      {levelUpData?.active && (
        <div className="fixed inset-0 z-55 bg-[#080810]/95 flex flex-col items-center justify-center p-6 text-center animate-fadeIn font-body text-[#F2F2F7]">
          <div className="absolute inset-0 bg-[radial-gradient(#00D68F10_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
          
          <div className="space-y-6 max-w-md relative z-10">
            <span className="text-7xl block animate-bounce">⚡</span>
            
            <div className="space-y-2">
              <span className="text-xs font-bold bg-[#00D68F]/10 text-[#00D68F] border border-[#00D68F]/20 px-3 py-1 rounded-full uppercase tracking-widest">
                Level Up!
              </span>
              <h2 className="text-4xl font-display font-black text-white tracking-tight mt-3">
                LEVEL {levelUpData.level} REACHED
              </h2>
              <p className="text-gray-400 text-sm mt-2">
                Your sales capacity has increased! You are now titled:
              </p>
            </div>

            <div className="py-4 px-6 rounded-2xl bg-[#121225] border border-[#00D68F]/30 shadow-lg shadow-[#00D68F]/5">
              <span className="text-2xl font-display font-black text-[#00D68F] tracking-wide uppercase">
                {levelUpData.title}
              </span>
            </div>

            <button
              onClick={() => setLevelUpData(null)}
              className="px-8 py-4 bg-[#00D68F] hover:bg-[#00b378] text-[#080810] font-bold rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-[#00D68F]/15 transition-all w-full"
            >
              Continue Close Journey
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}
