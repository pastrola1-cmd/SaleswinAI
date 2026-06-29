"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { useProfile } from "@/hooks/useProfile"
import { auth, db } from "@/utils/firebase/client"
import { collection, query, where, onSnapshot, getDocs, writeBatch } from "firebase/firestore"

interface NavItem {
  name: string
  href: string
  icon: React.ReactNode
  roles: string[]
}

const NAV_ITEMS: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    roles: ["salesperson", "trainer", "manager", "owner", "admin", "super_admin"]
  },
  {
    name: "AI Simulator",
    href: "/dashboard/practice",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    roles: ["salesperson", "trainer", "manager", "owner", "admin", "super_admin"]
  },
  {
    name: "Objection Drill",
    href: "/dashboard/objections",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    roles: ["salesperson", "trainer", "manager", "owner", "admin", "super_admin"]
  },
  {
    name: "Knowledge Quiz",
    href: "/dashboard/quiz",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    roles: ["salesperson", "trainer", "manager", "owner", "admin", "super_admin"]
  },
  {
    name: "My Progress",
    href: "/dashboard/progress",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2zm5-18v18" />
      </svg>
    ),
    roles: ["salesperson", "trainer", "manager", "owner", "admin", "super_admin"]
  },
  {
    name: "Leaderboard",
    href: "/dashboard/leaderboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
      </svg>
    ),
    roles: ["salesperson", "trainer", "manager", "owner", "admin", "super_admin"]
  },
  {
    name: "Team Overview",
    href: "/dashboard/team",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    roles: ["manager", "owner", "admin", "super_admin"]
  },
  {
    name: "Analytics",
    href: "/dashboard/analytics",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    roles: ["manager", "owner", "admin", "super_admin"]
  },
  {
    name: "Knowledge Base",
    href: "/dashboard/knowledge",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    roles: ["owner", "admin", "super_admin"]
  },
  {
    name: "Team Management",
    href: "/dashboard/team-management",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
    roles: ["owner", "admin", "super_admin"]
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    roles: ["owner", "admin", "super_admin"]
  },
  {
    name: "Billing",
    href: "/dashboard/billing",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    roles: ["owner", "admin", "super_admin"]
  }
]

const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "Home Dashboard",
  "/dashboard/practice": "AI Simulator",
  "/dashboard/objections": "Objection Drill",
  "/dashboard/quiz": "Knowledge Quiz",
  "/dashboard/progress": "My Progress",
  "/dashboard/leaderboard": "Leaderboard",
  "/dashboard/team": "Team Overview",
  "/dashboard/analytics": "Analytics",
  "/dashboard/knowledge": "Knowledge Base & AI Brain",
  "/dashboard/team-management": "Team Management",
  "/dashboard/settings": "Settings",
  "/dashboard/billing": "Billing",
  "/dashboard/invite": "Invite Team Members"
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, company, loading } = useProfile()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  useEffect(() => {
    if (!profile?.id) return

    const q = query(
      collection(db, "notifications", profile.id, "items"),
      where("isRead", "==", false)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadNotifications(snapshot.size)
    }, (err) => {
      console.error("Notifications listener error:", err)
    })

    return () => unsubscribe()
  }, [profile?.id])

  const handleClearNotifications = async () => {
    if (!profile?.id || unreadNotifications === 0) return
    try {
      const q = query(
        collection(db, "notifications", profile.id, "items"),
        where("isRead", "==", false)
      )
      const querySnapshot = await getDocs(q)
      const batch = writeBatch(db)
      querySnapshot.forEach(docSnap => {
        batch.update(docSnap.ref, { isRead: true })
      })
      await batch.commit()
    } catch (e) {
      console.error("Failed to clear notifications:", e)
    }
  }
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      await auth.signOut()
    } catch (e) {
      console.error("Sign out error:", e)
    }
    router.push("/login")
    router.refresh()
  }

  // Get active role
  const userRole = profile?.role || "salesperson"

  // Filter menu items by role
  const filteredNavItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(userRole)
  )

  // Get current page title dynamically
  const pageTitle = ROUTE_TITLES[pathname] || "SaleswinAI"

  // Initials for avatar
  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U"

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-t-[#00D68F] border-gray-800 rounded-full animate-spin"></div>
      </div>
    )
  }
  const isQuizActive = pathname.startsWith("/dashboard/quiz/") && pathname.split("/").length === 4
  const isPracticeChat = /^\/dashboard\/practice\/[^/]+$/.test(pathname)

  if (isQuizActive || isPracticeChat) {
    return (
      <div className="min-h-screen bg-[#080810] text-[#F2F2F7]">
        {children}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080810] text-[#F2F2F7] flex">
      {/* Sidebar - Desktop */}
      <aside
        className={`bg-[#1C1C35] border-r border-gray-800/40 hidden md:flex flex-col fixed top-0 bottom-0 left-0 transition-all duration-300 z-30 ${
          isSidebarCollapsed ? "w-16" : "w-[260px]"
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-gray-800/40">
          <Link href="/dashboard" className="flex items-center space-x-2 truncate">
            <span className="text-xl font-display font-extrabold tracking-tight">
              {isSidebarCollapsed ? (
                <span className="text-[#00D68F]">S</span>
              ) : (
                <>
                  Saleswin<span className="text-[#00D68F]">AI</span>
                </>
              )}
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-4 py-3 text-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? "bg-[#00D68F]/10 border-l-[3px] border-[#00D68F] text-[#00D68F]"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="inline-block">{item.icon}</span>
                {!isSidebarCollapsed && <span className="ml-3 truncate">{item.name}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-800/40 space-y-4">
          <div className="flex items-center space-x-3 truncate">
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-[#00D68F] text-[#080810] flex items-center justify-center font-bold font-display text-sm shrink-0">
              {initials}
            </div>
            {!isSidebarCollapsed && (
              <div className="truncate">
                <p className="text-sm font-semibold text-white truncate">{profile?.full_name || "User"}</p>
                <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold bg-[#00D68F]/10 text-[#00D68F] rounded uppercase tracking-wider mt-0.5 border border-[#00D68F]/20">
                  {userRole}
                </span>
              </div>
            )}
          </div>
          {!isSidebarCollapsed && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center py-2 px-3 bg-red-950/40 hover:bg-red-950/80 border border-red-500/20 text-red-200 text-xs font-semibold rounded-lg transition-colors"
            >
              Sign Out
            </button>
          )}
        </div>
      </aside>

      {/* Sidebar - Mobile drawer */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div className="fixed inset-0 bg-[#080810]/60 backdrop-blur-xs" onClick={() => setIsMobileSidebarOpen(false)}></div>
          <aside className="w-[260px] bg-[#1C1C35] flex flex-col relative z-55 border-r border-gray-800/40 animate-slideRight">
            <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800/40">
              <span className="text-xl font-display font-extrabold text-white">
                Saleswin<span className="text-[#00D68F]">AI</span>
              </span>
              <button onClick={() => setIsMobileSidebarOpen(false)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>
            <nav className="flex-1 py-4 overflow-y-auto space-y-1">
              {filteredNavItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileSidebarOpen(false)}
                    className={`flex items-center px-4 py-3 text-sm font-semibold transition-all duration-150 ${
                      isActive
                        ? "bg-[#00D68F]/10 border-l-[3px] border-[#00D68F] text-[#00D68F]"
                        : "text-gray-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span className="ml-3">{item.name}</span>
                  </Link>
                )
              })}
            </nav>
            <div className="p-4 border-t border-gray-800/40 space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-[#00D68F] text-[#080810] flex items-center justify-center font-bold font-display text-sm">
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{profile?.full_name || "User"}</p>
                  <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold bg-[#00D68F]/10 text-[#00D68F] rounded uppercase mt-0.5 border border-[#00D68F]/20">
                    {userRole}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full py-2 bg-red-950/40 hover:bg-red-950/80 border border-red-500/20 text-red-200 text-xs font-semibold rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
        isSidebarCollapsed ? "md:pl-16" : "md:pl-[260px]"
      }`}>
        {/* Topbar */}
        <header className="h-16 border-b border-gray-800/40 bg-[#080810]/80 backdrop-blur-md sticky top-0 flex items-center justify-between px-6 z-20">
          <div className="flex items-center space-x-4">
            {/* Hamburger for mobile */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {/* Collapse toggle for desktop */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden md:block text-gray-500 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </button>
            <h2 className="text-lg font-display font-bold text-white hidden sm:block">
              {pageTitle}
            </h2>
          </div>

          <div className="flex items-center space-x-6">
            {/* Company Name */}
            {company && (
              <span className="text-xs text-gray-500 font-semibold tracking-wider uppercase border border-gray-800/80 bg-gray-900/30 px-3 py-1 rounded-full hidden md:inline-block">
                🏢 {company.name}
              </span>
            )}
            
            {/* Notification Bell */}
            <div 
              onClick={handleClearNotifications}
              className="relative cursor-pointer hover:opacity-80 transition-opacity"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {/* Unread badge */}
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#00D68F] text-[#080810] text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadNotifications}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Content Wrapper */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
