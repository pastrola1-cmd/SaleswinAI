import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { redirect, notFound } from "next/navigation"
import RepProfileClient from "./RepProfileClient"
import Link from "next/link"

interface Params {
  userId: string
}

export default async function RepProfilePage({ params }: { params: Params }) {
  const { userId } = params

  // Get current user session from HTTP-only cookie
  const session = cookies().get("session")?.value
  if (!session) {
    redirect("/login")
  }

  let uid: string
  try {
    const decodedToken = await adminAuth.verifySessionCookie(session)
    uid = decodedToken.uid
  } catch {
    redirect("/login")
  }

  // 1. Fetch current user profile to verify manager/owner access
  const curProfileDoc = await adminDb.collection("profiles").doc(uid).get()
  const curProfile = curProfileDoc.data()

  if (!curProfile || !curProfile.company_id) {
    redirect("/dashboard")
  }

  if (!["owner", "manager", "admin", "super_admin"].includes(curProfile.role || "")) {
    redirect("/dashboard")
  }

  // 2. Fetch the target representative's profile
  const memberDoc = await adminDb.collection("profiles").doc(userId).get()
  if (!memberDoc.exists) {
    notFound()
  }

  const memberData = memberDoc.data()
  if (!memberData || memberData.company_id !== curProfile.company_id) {
    // Prevent cross-company visibility
    redirect("/dashboard")
  }

  const member = {
    id: memberDoc.id,
    full_name: memberData.full_name || null,
    email: memberData.email || null,
    role: memberData.role || null,
    created_at: memberData.created_at || memberData.createdAt || ""
  }

  // 3. Fetch progress metrics
  const progressDoc = await adminDb.collection("user_progress").doc(userId).get()
  const progressData = progressDoc.data()

  const progress = {
    xp_total: progressData?.xp_total || progressData?.xpTotal || 0,
    level: progressData?.level || 1,
    level_title: progressData?.level_title || progressData?.levelTitle || "Rookie",
    streak_days: progressData?.streak_days || progressData?.streakDays || 0,
    knowledge_score: progressData?.knowledge_score || progressData?.knowledgeScore || 0,
    confidence_score: progressData?.confidence_score || progressData?.confidenceScore || 0,
    conversion_score: progressData?.conversion_score || progressData?.conversionScore || 0,
    objection_score: progressData?.objection_score || progressData?.objectionScore || 0,
    closing_score: progressData?.closing_score || progressData?.closingScore || 0,
    simulations_completed: progressData?.simulations_completed || progressData?.simulationsCompleted || 0,
    quizzes_completed: progressData?.quizzes_completed || progressData?.quizzesCompleted || 0,
    objections_drilled: progressData?.objections_drilled || progressData?.objectionsDrilled || 0
  }

  // 4. Fetch recent simulation sessions (limit 20)
  const sessionsQuery = await adminDb
    .collection("simulation_sessions")
    .where("userId", "==", userId)
    .orderBy("completedAt", "desc")
    .limit(20)
    .get()

  const sessions = sessionsQuery.docs.map((docSnap) => {
    const data = docSnap.data()
    const compAt = data.completedAt || data.createdAt || ""
    const dateStr = compAt.toDate ? compAt.toDate().toISOString() : new Date(compAt).toISOString()
    return {
      id: docSnap.id,
      scenarioName: data.scenarioName || data.scenario_name || "Lekki smart haven simulation",
      createdAt: dateStr,
      score: data.scores?.overall !== undefined ? data.scores.overall : (data.score || 0),
      xpEarned: data.xpEarned || data.xp_earned || 0,
      durationSeconds: data.durationSeconds || data.duration_seconds || 0,
      outcome: data.outcome || "pending",
      // Include components scores for sparklines
      scores: data.scores || { discovery: 0, trust: 0, objection: 0, closing: 0 }
    }
  })

  // 5. Fetch quiz sessions (limit 7 for Knowledge Sparkline and to compute weak areas)
  const quizQuery = await adminDb
    .collection("quiz_sessions")
    .where("userId", "==", userId)
    .get()

  // Sort quizzes in memory to avoid missing index queries
  const sortedQuizzes = quizQuery.docs
    .map((d) => {
      const data = d.data()
      return {
        score: data.score || 0,
        category: data.category || "general",
        completedAt: data.completedAt || data.createdAt || ""
      }
    })
    .filter((q) => q.completedAt !== "")
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())

  // Weak quiz categories
  const categoryScores: Record<string, { total: number; count: number }> = {}
  sortedQuizzes.forEach((q) => {
    if (!categoryScores[q.category]) {
      categoryScores[q.category] = { total: 0, count: 0 }
    }
    categoryScores[q.category].total += q.score
    categoryScores[q.category].count += 1
  })

  const weakAreas = Object.entries(categoryScores)
    .map(([category, stats]) => ({
      category,
      avgScore: Math.round(stats.total / stats.count)
    }))
    .filter((area) => area.avgScore < 60)

  // 6. Generate Sparkline datasets (limit 7 values, chronological order)
  const completedSimsSorted = [...sessions]
    .filter((s) => s.createdAt !== "")
    .slice(0, 7)
    .reverse()

  const conversionSparkline = completedSimsSorted.map((s) => ({ value: s.score }))
  const objectionSparkline = completedSimsSorted.map((s) => ({ value: s.scores?.objection || s.scores?.objection_handling || 0 }))
  const closingSparkline = completedSimsSorted.map((s) => ({ value: s.scores?.closing || 0 }))
  const confidenceSparkline = completedSimsSorted.map((s) => ({ value: s.scores?.trust || s.scores?.trust_building || 0 }))

  const recentQuizzesSorted = sortedQuizzes.slice(0, 7).reverse()
  const knowledgeSparkline = recentQuizzesSorted.map((q) => ({ value: q.score }))

  // 7. Performance trend (last 8 sessions overall scores)
  const trendData = [...sessions]
    .filter((s) => s.createdAt !== "")
    .slice(0, 8)
    .reverse()
    .map((s, idx) => ({
      name: `Run ${idx + 1}`,
      score: s.score
    }))

  return (
    <div className="min-h-screen bg-[#080810] text-[#F2F2F7] p-8">
      <div className="max-w-6xl mx-auto space-y-8 font-body">
        
        {/* Header */}
        <header className="flex justify-between items-center border-b border-gray-800/80 pb-6">
          <div>
            <Link href="/dashboard/team" className="text-xs text-gray-500 hover:text-[#00D68F] font-semibold uppercase tracking-wider mb-2 inline-block">
              &larr; Back to Team Standings
            </Link>
            <h1 className="text-3xl font-display font-extrabold tracking-tight text-white">
              Representative <span className="text-[#00D68F]">Performance</span>
            </h1>
            <p className="text-sm text-gray-400">Detailed overview of sales closing rates and quiz metrics</p>
          </div>
        </header>

        <RepProfileClient
          member={member}
          progress={progress}
          sessions={sessions}
          weakAreas={weakAreas}
          sparklines={{
            conversion: conversionSparkline,
            objection: objectionSparkline,
            closing: closingSparkline,
            confidence: confidenceSparkline,
            knowledge: knowledgeSparkline
          }}
          trendData={trendData}
        />
      </div>
    </div>
  )
}
