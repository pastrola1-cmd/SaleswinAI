"use client"

import { useState, useEffect } from "react"
import { useProfile } from "@/hooks/useProfile"
import { db } from "@/utils/firebase/client"
import { collection, query, orderBy, limit, onSnapshot, doc, writeBatch, deleteDoc } from "firebase/firestore"
import { useRouter } from "next/navigation"

export default function NotificationsPage() {
  const { profile } = useProfile()
  const router = useRouter()

  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "unread" | "xp_badges" | "team" | "billing">("all")
  const [page, setPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    if (!profile?.id) return

    const q = query(
      collection(db, "notifications", profile.id, "items"),
      orderBy("createdAt", "desc"),
      limit(100)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }))
      setNotifications(items)
      setLoading(false)
    }, (err) => {
      console.error("Notifications list listener error:", err)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [profile?.id])

  const handleMarkAsRead = async (notifId: string) => {
    if (!profile?.id) return
    try {
      const batch = writeBatch(db)
      const docRef = doc(db, "notifications", profile.id, "items", notifId)
      batch.update(docRef, { isRead: true })
      await batch.commit()
    } catch (e) {
      console.error("Failed to mark as read:", e)
    }
  }

  const handleMarkAllAsRead = async () => {
    if (!profile?.id) return
    try {
      const batch = writeBatch(db)
      notifications.forEach(item => {
        if (!item.isRead) {
          const docRef = doc(db, "notifications", profile.id, "items", item.id)
          batch.update(docRef, { isRead: true })
        }
      })
      await batch.commit()
    } catch (e) {
      console.error("Failed to mark all as read:", e)
    }
  }

  const handleClearRead = async () => {
    if (!profile?.id) return
    try {
      const batch = writeBatch(db)
      let count = 0
      notifications.forEach(item => {
        if (item.isRead) {
          const docRef = doc(db, "notifications", profile.id, "items", item.id)
          batch.delete(docRef)
          count++
        }
      })
      if (count > 0) {
        await batch.commit()
      }
    } catch (e) {
      console.error("Failed to clear read notifications:", e)
    }
  }

  const handleNotifClick = async (notif: any) => {
    if (!profile?.id) return
    
    if (!notif.isRead) {
      try {
        const batch = writeBatch(db)
        const docRef = doc(db, "notifications", profile.id, "items", notif.id)
        batch.update(docRef, { isRead: true })
        await batch.commit()
      } catch (e) {
        console.error("Failed to mark read on click:", e)
      }
    }

    if (notif.actionUrl) {
      router.push(notif.actionUrl)
    }
  }

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center">
        <div className="w-10 h-10 border-4 border-t-[#00D68F] border-gray-800 rounded-full animate-spin"></div>
      </div>
    )
  }

  // 1. Filter notifications locally
  const filtered = notifications.filter(item => {
    if (filter === "unread") return !item.isRead
    if (filter === "xp_badges") return ["xp_earned", "badge_earned", "level_up"].includes(item.type)
    if (filter === "team") return ["manager_nudge", "team_alert"].includes(item.type)
    if (filter === "billing") return item.type === "billing"
    return true
  })

  // 2. Paginate notifications
  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1
  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  const hasUnread = notifications.some(item => !item.isRead)
  const hasRead = notifications.some(item => item.isRead)

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 font-body text-[#F2F2F7]">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-black text-white">Inbox Alerts</h1>
          <p className="text-gray-400 mt-2 text-sm">
            Review training triggers, milestone achievements, and manager reminders.
          </p>
        </div>

        <div className="flex space-x-3 shrink-0">
          {hasUnread && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-4 py-2 bg-[#1C1C35] hover:bg-gray-800 border border-gray-800 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
            >
              Mark all read
            </button>
          )}
          {hasRead && (
            <button
              onClick={handleClearRead}
              className="px-4 py-2 bg-red-950/20 hover:bg-red-950/40 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
            >
              Clear read items
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex overflow-x-auto pb-1 space-x-2 border-b border-gray-850">
        {[
          { id: "all", label: "All Alerts" },
          { id: "unread", label: "Unread" },
          { id: "xp_badges", label: "XP & Badges" },
          { id: "team", label: "Team Updates" },
          { id: "billing", label: "Billing" }
        ].map((tab) => {
          const isActive = filter === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => {
                setFilter(tab.id as any)
                setPage(1)
              }}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors border-b-2 -mb-[2px] ${
                isActive 
                  ? "border-[#00D68F] text-[#00D68F]" 
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Notifications List */}
      <div className="bg-[#121225] border border-gray-800/40 rounded-2xl overflow-hidden shadow-xl divide-y divide-gray-850">
        {paginated.length > 0 ? (
          paginated.map((notif) => {
            const dateStr = notif.createdAt 
              ? (notif.createdAt.toDate ? notif.createdAt.toDate().toLocaleString() : new Date(notif.createdAt).toLocaleString())
              : ""

            return (
              <div
                key={notif.id}
                onClick={() => handleNotifClick(notif)}
                className={`p-5 flex items-start space-x-4 cursor-pointer transition-colors hover:bg-white/2 ${
                  !notif.isRead 
                    ? "border-l-[4px] border-[#00D68F] bg-[#00D68F]/3" 
                    : ""
                }`}
              >
                <div className="text-2xl select-none shrink-0 p-2 bg-[#1C1C35]/60 border border-gray-800/40 rounded-xl flex items-center justify-center">
                  {notif.icon || "🔔"}
                </div>
                
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-4">
                    <h3 className={`text-sm text-white leading-tight truncate ${!notif.isRead ? "font-black" : "font-semibold"}`}>
                      {notif.title}
                    </h3>
                    <span className="text-[10px] text-gray-500 font-mono shrink-0">
                      {dateStr}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed max-w-2xl">
                    {notif.body}
                  </p>
                </div>

                {!notif.isRead && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleMarkAsRead(notif.id)
                    }}
                    className="p-1 rounded bg-gray-900 border border-gray-800 text-gray-400 hover:text-white text-[9px] font-bold uppercase tracking-wider shrink-0"
                  >
                    Mark read
                  </button>
                )}
              </div>
            )
          })
        ) : (
          <div className="py-20 text-center text-gray-500 space-y-3">
            <span className="text-4xl block">💤</span>
            <p className="text-sm font-semibold">Inbox is clear</p>
            <p className="text-xs text-gray-600">No alerts found matching this filter category.</p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center bg-[#121225] border border-gray-800/40 p-4 rounded-xl text-xs font-semibold">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-4 py-2 rounded bg-gray-900 border border-gray-800 text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            &larr; Previous Page
          </button>
          
          <span className="text-gray-500 font-mono">
            Page {page} of {totalPages}
          </span>

          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="px-4 py-2 rounded bg-gray-900 border border-gray-800 text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Next Page &rarr;
          </button>
        </div>
      )}

    </div>
  )
}
