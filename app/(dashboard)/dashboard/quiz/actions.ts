"use server"

import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { awardXP } from "@/lib/xp"
import { cookies } from "next/headers"
import { FieldValue } from "firebase-admin/firestore"

interface AnswerItem {
  index: number
  selected: "A" | "B" | "C" | "D" | null
  isCorrect: boolean
  timeSeconds: number
}

export async function completeQuizSession(sessionId: string, answers: AnswerItem[], score: number) {
  const sessionCookie = cookies().get("session")?.value
  if (!sessionCookie) {
    throw new Error("Unauthenticated")
  }

  let uid: string
  try {
    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie)
    uid = decodedToken.uid
  } catch {
    throw new Error("Invalid session")
  }

  // 1. Fetch current quiz session to confirm validity
  const sessionRef = adminDb.collection("quiz_sessions").doc(sessionId)
  const sessionDoc = await sessionRef.get()

  if (!sessionDoc.exists) {
    throw new Error("Quiz session not found")
  }

  const sessionData = sessionDoc.data()
  if (!sessionData || sessionData.userId !== uid) {
    throw new Error("Unauthorized access to quiz session")
  }

  if (sessionData.completedAt) {
    return { success: true, message: "Quiz already completed" }
  }

  const nowIso = new Date().toISOString()
  // Earn 2 XP for every 1% of score (100% score = 200 XP)
  const xpEarned = Math.round(score * 2)

  // 2. Update Quiz Session with scores
  await sessionRef.update({
    answers,
    score,
    xpEarned,
    completedAt: nowIso
  })

  // 3. Fetch completed quizzes for this user to compute rolling average (limit 5)
  const allUserQuizzesSnapshot = await adminDb
    .collection("quiz_sessions")
    .where("userId", "==", uid)
    .get()

  const completedQuizzes = allUserQuizzesSnapshot.docs
    .map((docSnap) => docSnap.data())
    .filter((data) => data.completedAt !== null && data.completedAt !== undefined)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 5)

  // If this session wasn't written to Firestore in time for the snapshot, make sure it is included
  const hasCurrentSession = completedQuizzes.some((q) => q.completedAt === nowIso)
  if (!hasCurrentSession && completedQuizzes.length < 5) {
    completedQuizzes.push({ score, completedAt: nowIso })
    completedQuizzes.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
  }

  const totalScore = completedQuizzes.reduce((sum, item) => sum + (item.score || 0), 0)
  const rollingKnowledgeScore = completedQuizzes.length > 0 ? Math.round(totalScore / completedQuizzes.length) : score

  // 4. Update user progress (increment quiz counts, set knowledgeScore)
  const progressRef = adminDb.collection("user_progress").doc(uid)
  await adminDb.runTransaction(async (transaction) => {
    const progressDoc = await transaction.get(progressRef)
    
    if (progressDoc.exists) {
      transaction.update(progressRef, {
        knowledge_score: rollingKnowledgeScore,
        knowledgeScore: rollingKnowledgeScore,
        quizzes_completed: FieldValue.increment(1),
        quizzesCompleted: FieldValue.increment(1),
        updated_at: nowIso,
        updatedAt: FieldValue.serverTimestamp()
      })
    } else {
      transaction.set(progressRef, {
        user_id: uid,
        userId: uid,
        xp_total: 0,
        xpTotal: 0,
        level: 1,
        level_title: "Rookie",
        levelTitle: "Rookie",
        streak_days: 0,
        streakDays: 0,
        knowledge_score: rollingKnowledgeScore,
        knowledgeScore: rollingKnowledgeScore,
        confidence_score: 0,
        confidenceScore: 0,
        conversion_score: 0,
        conversionScore: 0,
        objection_score: 0,
        objectionScore: 0,
        closing_score: 0,
        closingScore: 0,
        simulations_completed: 0,
        simulationsCompleted: 0,
        quizzes_completed: 1,
        quizzesCompleted: 1,
        objections_drilled: 0,
        objectionsDrilled: 0,
        updated_at: nowIso,
        updatedAt: FieldValue.serverTimestamp()
      })
    }
  })

  // 5. Award XP
  if (xpEarned > 0) {
    await awardXP(uid, xpEarned, `Completed Quiz (${sessionData.category} - ${sessionData.difficulty})`)
  }

  return { success: true }
}
