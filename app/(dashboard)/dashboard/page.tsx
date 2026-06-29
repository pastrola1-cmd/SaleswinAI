import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import HomeDashboardClient from "./HomeDashboardClient"

export default async function DashboardPage() {
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

  // Fetch profile from Firestore
  const profileDoc = await adminDb.collection("profiles").doc(uid).get()
  const profile = profileDoc.data()

  if (!profile) {
    redirect("/login")
  }

  // Fetch or auto-create user progress doc in Firestore
  const progressDocRef = adminDb.collection("user_progress").doc(uid)
  const progressDoc = await progressDocRef.get()

  let progress = progressDoc.exists ? progressDoc.data() : null

  if (!progress) {
    const defaultProgress = {
      user_id: uid,
      xp_total: 0,
      level: 1,
      level_title: "Rookie",
      streak_days: 0,
      knowledge_score: 0,
      confidence_score: 0,
      conversion_score: 0,
      objection_score: 0,
      closing_score: 0,
      simulations_completed: 0,
      quizzes_completed: 0,
      objections_drilled: 0,
      updated_at: new Date().toISOString()
    }

    try {
      await progressDocRef.set(defaultProgress)
      progress = defaultProgress
    } catch (setErr) {
      console.error("Failed to auto-create progress doc in Firestore:", setErr)
      progress = defaultProgress
    }
  }

  return (
    <HomeDashboardClient
      fullName={profile.full_name || "User"}
      progress={progress as unknown as {
        xp_total: number
        level: number
        level_title: string
        streak_days: number
        knowledge_score: number
        confidence_score: number
        conversion_score: number
        objection_score: number
        closing_score: number
        simulations_completed: number
        quizzes_completed: number
        objections_drilled: number
      }}
    />
  )
}
