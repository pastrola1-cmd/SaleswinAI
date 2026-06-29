import { adminDb } from "@/utils/firebase/admin"
import { FieldValue } from "firebase-admin/firestore"

export async function awardXP(userId: string, xpEarned: number, reason: string) {
  if (xpEarned <= 0) return

  const progressRef = adminDb.collection("user_progress").doc(userId)
  const xpLogRef = adminDb.collection("xp_log").doc()

  await adminDb.runTransaction(async (transaction) => {
    const progressDoc = await transaction.get(progressRef)
    let currentData = progressDoc.exists ? progressDoc.data() : null

    const nowIso = new Date().toISOString()

    if (!currentData) {
      // Auto-initialize progress data
      currentData = {
        user_id: userId,
        userId: userId,
        xp_total: 0,
        xpTotal: 0,
        level: 1,
        level_title: "Rookie",
        levelTitle: "Rookie",
        streak_days: 0,
        streakDays: 0,
        knowledge_score: 0,
        knowledgeScore: 0,
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
        quizzes_completed: 0,
        quizzesCompleted: 0,
        objections_drilled: 0,
        objectionsDrilled: 0,
        updated_at: nowIso,
        updatedAt: FieldValue.serverTimestamp()
      }
    }

    const currentXp = currentData.xp_total !== undefined ? currentData.xp_total : (currentData.xpTotal || 0)
    const newXp = currentXp + xpEarned

    // 1000 XP per level
    const newLevel = Math.floor(newXp / 1000) + 1

    let newLevelTitle = "Rookie"
    if (newLevel >= 5) newLevelTitle = "Closer Elite"
    else if (newLevel >= 4) newLevelTitle = "Sales Master"
    else if (newLevel >= 3) newLevelTitle = "Objection Crusher"
    else if (newLevel >= 2) newLevelTitle = "Negotiator"

    const updates = {
      xp_total: newXp,
      xpTotal: newXp,
      level: newLevel,
      level_title: newLevelTitle,
      levelTitle: newLevelTitle,
      updated_at: nowIso,
      updatedAt: FieldValue.serverTimestamp()
    }

    transaction.set(progressRef, updates, { merge: true })

    // Log the XP transaction
    transaction.set(xpLogRef, {
      userId,
      xpEarned,
      reason,
      createdAt: FieldValue.serverTimestamp(),
      created_at: nowIso
    })
  })
}
