import { adminDb } from "@/utils/firebase/admin"
import { FieldValue } from "firebase-admin/firestore"
import { awardXP as gamificationAwardXP } from "./gamification"

export async function awardXP(userId: string, xpEarned: number, reason: string) {
  // Delegate to gamification engine under 'bonus' type
  return gamificationAwardXP(userId, xpEarned, reason, "bonus")
}

export async function deductXP(userId: string, xpDeducted: number, reason: string) {
  if (xpDeducted <= 0) return

  const progressRef = adminDb.collection("user_progress").doc(userId)
  const xpLogRef = adminDb.collection("xp_log").doc()

  await adminDb.runTransaction(async (transaction) => {
    const progressDoc = await transaction.get(progressRef)
    if (!progressDoc.exists) return

    const currentData = progressDoc.data() || {}
    const currentXp = currentData.xpTotal !== undefined ? currentData.xpTotal : (currentData.xp_total || 0)
    const newXp = Math.max(0, currentXp - xpDeducted)

    // Recalculate level
    // 1000 XP per level (or match the gamification levels range)
    const newLevel = Math.floor(newXp / 1000) + 1

    let newLevelTitle = "Rookie"
    if (newLevel >= 5) newLevelTitle = "Closer Elite"
    else if (newLevel >= 4) newLevelTitle = "Sales Master"
    else if (newLevel >= 3) newLevelTitle = "Objection Crusher"
    else if (newLevel >= 2) newLevelTitle = "Negotiator"

    const updates = {
      xpTotal: newXp,
      xp_total: newXp,
      level: newLevel,
      levelTitle: newLevelTitle,
      level_title: newLevelTitle,
      updated_at: new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp()
    }

    transaction.update(progressRef, updates)

    // Log the XP transaction as a negative value
    transaction.set(xpLogRef, {
      userId,
      amount: -xpDeducted,
      reason,
      sessionType: "bonus",
      createdAt: FieldValue.serverTimestamp(),
      created_at: new Date().toISOString()
    })
  })
}
