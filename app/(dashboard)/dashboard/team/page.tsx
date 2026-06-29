import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import TeamOverviewClient from "./TeamOverviewClient"

export default async function TeamOverviewPage() {
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

  // 1. Fetch current profile
  const curProfileDoc = await adminDb.collection("profiles").doc(uid).get()
  const curProfile = curProfileDoc.data()

  if (!curProfile || !curProfile.company_id) {
    redirect("/dashboard")
  }

  // Authorize manager only
  if (!["owner", "manager", "admin", "super_admin"].includes(curProfile.role || "")) {
    redirect("/dashboard")
  }

  const companyId = curProfile.company_id

  // 2. Fetch all profiles in company
  const profilesSnap = await adminDb
    .collection("profiles")
    .where("company_id", "==", companyId)
    .get()

  const profiles = profilesSnap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      full_name: data.full_name || "Anonymous",
      email: data.email || "",
      role: data.role || "salesperson",
      is_active: data.is_active !== undefined ? data.is_active : true,
      lastSeenAt: data.lastSeenAt || data.last_seen_at || ""
    }
  })

  // 3. Fetch all progress records
  const progressSnap = await adminDb
    .collection("user_progress")
    .where("companyId", "==", companyId)
    .get()

  const progressRecords = progressSnap.docs.map((d) => {
    const data = d.data()
    return {
      userId: d.id,
      xpTotal: data.xpTotal !== undefined ? data.xpTotal : (data.xp_total || 0),
      level: data.level || 1,
      streakDays: data.streakDays !== undefined ? data.streakDays : (data.streak_days || 0),
      conversionScore: data.conversionScore !== undefined ? data.conversionScore : (data.conversion_score || 0),
      knowledgeScore: data.knowledgeScore !== undefined ? data.knowledgeScore : (data.knowledge_score || 0),
      objectionScore: data.objectionScore !== undefined ? data.objectionScore : (data.objection_score || 0),
      simulationsCompleted: data.simulationsCompleted !== undefined ? data.simulationsCompleted : (data.simulations_completed || 0),
      quizzesCompleted: data.quizzesCompleted !== undefined ? data.quizzesCompleted : (data.quizzes_completed || 0),
      objectionsDrilled: data.objectionsDrilled !== undefined ? data.objectionsDrilled : (data.objections_drilled || 0),
      lastActiveDate: data.lastActiveDate || data.last_active_date || ""
    }
  })

  // 4. Fetch simulations count in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const weeklySimsSnap = await adminDb
    .collection("simulation_sessions")
    .where("companyId", "==", companyId)
    .get()

  // Filter in memory to avoid index requirements for simple range filters
  const weeklySessionsCount = weeklySimsSnap.docs.filter((d) => {
    const data = d.data()
    const compAt = data.completedAt || data.createdAt || data.startedAt
    if (!compAt) return false
    const dateStr = compAt.toDate ? compAt.toDate().toISOString() : new Date(compAt).toISOString()
    return dateStr >= sevenDaysAgo
  }).length

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16 font-body text-[#F2F2F7]">
      <div>
        <h1 className="text-3xl font-display font-black text-white">Team Overview</h1>
        <p className="text-gray-400 mt-2 text-sm">
          Track representative training participation, closing average scores, and send nudges.
        </p>
      </div>

      <TeamOverviewClient
        profiles={profiles}
        progressRecords={progressRecords}
        weeklySessionsCount={weeklySessionsCount}
      />
    </div>
  )
}
