import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import AnalyticsClient from "./AnalyticsClient"

export default async function AnalyticsPage() {
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

  // 1. Verify manager profile and companyId
  const curProfileDoc = await adminDb.collection("profiles").doc(uid).get()
  const curProfile = curProfileDoc.data()

  if (!curProfile || !curProfile.company_id) {
    redirect("/dashboard")
  }

  if (!["owner", "manager", "admin", "super_admin"].includes(curProfile.role || "")) {
    redirect("/dashboard")
  }

  const companyId = curProfile.company_id

  // 2. Fetch all profiles
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

  // 3. Fetch all user progress docs
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
      conversionScore: data.conversionScore !== undefined ? data.conversionScore : (data.conversion_score || 0),
      knowledgeScore: data.knowledgeScore !== undefined ? data.knowledgeScore : (data.knowledge_score || 0),
      objectionScore: data.objectionScore !== undefined ? data.objectionScore : (data.objection_score || 0),
      simulationsCompleted: data.simulationsCompleted !== undefined ? data.simulationsCompleted : (data.simulations_completed || 0),
      quizzesCompleted: data.quizzesCompleted !== undefined ? data.quizzesCompleted : (data.quizzes_completed || 0),
      objectionsDrilled: data.objectionsDrilled !== undefined ? data.objectionsDrilled : (data.objections_drilled || 0),
      lastActiveDate: data.lastActiveDate || data.last_active_date || ""
    }
  })

  // 4. Fetch all simulations for the company
  const simsSnap = await adminDb
    .collection("simulation_sessions")
    .where("companyId", "==", companyId)
    .get()

  const simulations = simsSnap.docs.map((d) => {
    const data = d.data()
    const compAt = data.completedAt || data.createdAt || data.startedAt
    const dateStr = compAt ? (compAt.toDate ? compAt.toDate().toISOString() : new Date(compAt).toISOString()) : ""
    return {
      id: d.id,
      userId: data.userId || "",
      score: data.scores?.overall !== undefined ? data.scores.overall : (data.score || 0),
      outcome: data.outcome || "pending",
      createdAt: dateStr
    }
  })

  // 5. Fetch objection sessions for the company
  const objSnap = await adminDb
    .collection("objection_sessions")
    .where("companyId", "==", companyId)
    .get()

  const objections = objSnap.docs.map((d) => {
    const data = d.data()
    const compAt = data.createdAt || ""
    const dateStr = compAt ? (compAt.toDate ? compAt.toDate().toISOString() : new Date(compAt).toISOString()) : ""
    return {
      id: d.id,
      userId: data.userId || "",
      objectionText: data.objectionText || data.objection_text || "Unknown Objection",
      aiScore: data.aiScore !== undefined ? data.aiScore : (data.score || 0),
      createdAt: dateStr
    }
  })

  // 6. Fetch all quiz sessions for the company
  const quizSnap = await adminDb
    .collection("quiz_sessions")
    .where("companyId", "==", companyId)
    .get()

  const quizzes = quizSnap.docs.map((d) => {
    const data = d.data()
    const compAt = data.completedAt || data.createdAt || ""
    const dateStr = compAt ? (compAt.toDate ? compAt.toDate().toISOString() : new Date(compAt).toISOString()) : ""
    return {
      id: d.id,
      userId: data.userId || "",
      category: data.category || "general",
      score: data.score || 0,
      createdAt: dateStr
    }
  })

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16 font-body text-[#F2F2F7]">
      <div>
        <h1 className="text-3xl font-display font-black text-white">Team Analytics</h1>
        <p className="text-gray-400 mt-2 text-sm">
          High-level overview of team performance metrics, weak areas, active heatmap, and ROI indicators.
        </p>
      </div>

      <AnalyticsClient
        profiles={profiles}
        progressRecords={progressRecords}
        simulations={simulations}
        objections={objections}
        quizzes={quizzes}
      />
    </div>
  )
}
