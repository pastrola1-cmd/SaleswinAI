import { adminDb } from "@/utils/firebase/admin"
import { FieldValue } from "firebase-admin/firestore"
import { createNotification } from "./notifications"

export const XP_REWARDS = {
  simulation_complete: 200,
  simulation_converted: 100,   // bonus
  quiz_complete: 100,
  quiz_perfect: 200,           // bonus
  objection_drill: 50,
  daily_login: 25,
  streak_7_days: 500,
  streak_30_days: 2000,
  hint_used: -50               // cost
}

export const LEVELS = [
  { level: 1, title: "Rookie",    minXp: 0 },
  { level: 2, title: "Prospect",  minXp: 500 },
  { level: 3, title: "Qualifier", minXp: 1500 },
  { level: 4, title: "Closer",    minXp: 3500 },
  { level: 5, title: "Converter", minXp: 7000 },
  { level: 6, title: "Elite",     minXp: 12000 },
  { level: 7, title: "Legend",    minXp: 20000 }
]

export const BADGES = [
  { key: "first_session",  name: "First Step",       icon: "👟", xp: 100, desc: "Completed your first practice simulation" },
  { key: "first_close",    name: "First Blood",      icon: "🎯", xp: 200, desc: "Successfully converted your first customer" },
  { key: "quiz_ace",       name: "Quiz Ace",         icon: "🧠", xp: 150, desc: "Scored 100% on a product knowledge quiz" },
  { key: "streak_3",       name: "On Fire",          icon: "🔥", xp: 100, desc: "Maintained a 3-day active practice streak" },
  { key: "streak_7",       name: "Unstoppable",      icon: "⚡", xp: 500, desc: "Maintained a 7-day active practice streak" },
  { key: "streak_30",      name: "Iron Rep",         icon: "💪", xp: 2000, desc: "Maintained a 30-day active practice streak" },
  { key: "objection_50",   name: "Objection Master", icon: "🛡️", xp: 300, desc: "Drilled 50 objections in the simulator" },
  { key: "objection_100",  name: "Bulletproof",      icon: "🔰", xp: 500, desc: "Drilled 100 objections in the simulator" },
  { key: "knowledge_90",   name: "Product Expert",   icon: "📚", xp: 300, desc: "Maintained a product knowledge score of 90+" },
  { key: "conversion_90",  name: "Elite Closer",     icon: "💎", xp: 500, desc: "Maintained a simulation conversion score of 90+" },
  { key: "sim_10",         name: "Rep",              icon: "🎪", xp: 200, desc: "Completed 10 full practice simulations" },
  { key: "sim_50",         name: "Veteran",          icon: "🏆", xp: 1000, desc: "Completed 50 full practice simulations" },
  { key: "comeback",       name: "Comeback",         icon: "📈", xp: 300, desc: "Scored 80+ after a previous low score (<50)" }
]

export interface AwardXPResult {
  newXP: number
  newLevel: number
  leveledUp: boolean
  newBadges: Array<{ key: string; name: string; icon: string }>
}

export async function awardXP(
  userId: string,
  amount: number,
  reason: string,
  sessionType: "simulation" | "quiz" | "objection" | "login" | "bonus"
): Promise<AwardXPResult> {
  // 1. Fetch existing badges and profile companyId beforehand
  const badgesSnapshot = await adminDb
    .collection("badges")
    .where("userId", "==", userId)
    .get()
  const existingBadgeKeys = badgesSnapshot.docs.map((d) => d.data().badgeKey as string)

  const profileDoc = await adminDb.collection("profiles").doc(userId).get()
  const companyId = profileDoc.exists ? (profileDoc.data()?.company_id || null) : null

  const progressRef = adminDb.collection("user_progress").doc(userId)
  const xpLogRef = adminDb.collection("xp_log").doc()

  const newBadgesAwarded: Array<{ key: string; name: string; icon: string }> = []
  let result: AwardXPResult = { newXP: 0, newLevel: 1, leveledUp: false, newBadges: [] }

  await adminDb.runTransaction(async (transaction) => {
    const progressDoc = await transaction.get(progressRef)
    let currentData = progressDoc.exists ? progressDoc.data() : null
    const nowIso = new Date().toISOString()

    if (!currentData) {
      currentData = {
        userId,
        companyId,
        xpTotal: 0,
        xp_total: 0,
        level: 1,
        levelTitle: "Rookie",
        level_title: "Rookie",
        streakDays: 0,
        streak_days: 0,
        knowledgeScore: 0,
        knowledge_score: 0,
        confidenceScore: 0,
        confidence_score: 0,
        conversionScore: 0,
        conversion_score: 0,
        objectionScore: 0,
        objection_score: 0,
        closingScore: 0,
        closing_score: 0,
        simulationsCompleted: 0,
        simulations_completed: 0,
        quizzesCompleted: 0,
        quizzes_completed: 0,
        objectionsDrilled: 0,
        objections_drilled: 0,
        createdAt: FieldValue.serverTimestamp()
      }
    }

    const currentXp = currentData.xpTotal !== undefined ? currentData.xpTotal : (currentData.xp_total || 0)
    let totalXp = currentXp + amount
    const startLevel = currentData.level || 1

    // Update session metrics based on types (so we don't have stale evaluations)
    let simCount = currentData.simulationsCompleted || currentData.simulations_completed || 0
    let drillCount = currentData.objectionsDrilled || currentData.objections_drilled || 0
    const streakDays = currentData.streakDays || currentData.streak_days || 0
    const knowledgeScore = currentData.knowledgeScore || currentData.knowledge_score || 0
    const conversionScore = currentData.conversionScore || currentData.conversion_score || 0

    if (sessionType === "simulation") simCount += 1
    if (sessionType === "objection") drillCount += 1

    // Evaluate badge triggers
    const badgesToTrigger = BADGES.filter((b) => !existingBadgeKeys.includes(b.key))
    const badgesToAward: typeof BADGES = []

    for (const b of badgesToTrigger) {
      let isTriggered = false

      if (b.key === "first_session" && simCount >= 1) isTriggered = true
      if (b.key === "first_close" && sessionType === "simulation" && reason.toLowerCase().includes("converted")) isTriggered = true
      if (b.key === "quiz_ace" && sessionType === "quiz" && reason.toLowerCase().includes("perfect")) isTriggered = true
      if (b.key === "streak_3" && streakDays >= 3) isTriggered = true
      if (b.key === "streak_7" && streakDays >= 7) isTriggered = true
      if (b.key === "streak_30" && streakDays >= 30) isTriggered = true
      if (b.key === "objection_50" && drillCount >= 50) isTriggered = true
      if (b.key === "objection_100" && drillCount >= 100) isTriggered = true
      if (b.key === "knowledge_90" && knowledgeScore >= 90) isTriggered = true
      if (b.key === "conversion_90" && conversionScore >= 90) isTriggered = true
      if (b.key === "sim_10" && simCount >= 10) isTriggered = true
      if (b.key === "sim_50" && simCount >= 50) isTriggered = true
      if (b.key === "comeback" && sessionType === "simulation" && reason.toLowerCase().includes("comeback")) isTriggered = true

      if (isTriggered) {
        badgesToAward.push(b)
        newBadgesAwarded.push({ key: b.key, name: b.name, icon: b.icon })
        existingBadgeKeys.push(b.key) // Prevent duplicate checking in the same loop
        totalXp += b.xp // Award bonus XP
      }
    }

    // Determine final level
    let newLevel = 1
    let newLevelTitle = "Rookie"
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (totalXp >= LEVELS[i].minXp) {
        newLevel = LEVELS[i].level
        newLevelTitle = LEVELS[i].title
        break
      }
    }

    const leveledUp = newLevel > startLevel

    // Write progress updates
    const updates: any = {
      xpTotal: totalXp,
      xp_total: totalXp,
      level: newLevel,
      levelTitle: newLevelTitle,
      level_title: newLevelTitle,
      companyId: companyId,
      company_id: companyId,
      updatedAt: FieldValue.serverTimestamp(),
      updated_at: nowIso
    }

    if (sessionType === "simulation") {
      updates.simulationsCompleted = FieldValue.increment(1)
      updates.simulations_completed = FieldValue.increment(1)
    }
    if (sessionType === "quiz") {
      updates.quizzesCompleted = FieldValue.increment(1)
      updates.quizzes_completed = FieldValue.increment(1)
    }
    if (sessionType === "objection") {
      updates.objectionsDrilled = FieldValue.increment(1)
      updates.objections_drilled = FieldValue.increment(1)
    }

    transaction.set(progressRef, updates, { merge: true })

    // Log the base XP transaction
    transaction.set(xpLogRef, {
      userId,
      amount,
      reason,
      sessionType,
      createdAt: FieldValue.serverTimestamp(),
      created_at: nowIso
    })

    // Write new badge documents inside transaction
    badgesToAward.forEach((b) => {
      const badgeRef = adminDb.collection("badges").doc()
      transaction.set(badgeRef, {
        userId,
        badgeKey: b.key,
        badgeName: b.name,
        badgeDescription: b.desc,
        badgeIcon: b.icon,
        xpBonus: b.xp,
        earnedAt: FieldValue.serverTimestamp(),
        earned_at: nowIso
      })

      // Log the bonus XP from badges
      const badgeXpLogRef = adminDb.collection("xp_log").doc()
      transaction.set(badgeXpLogRef, {
        userId,
        amount: b.xp,
        reason: `Unlocked Badge: ${b.name}`,
        sessionType: "bonus",
        createdAt: FieldValue.serverTimestamp(),
        created_at: nowIso
      })
    })

    result = {
      newXP: totalXp,
      newLevel,
      leveledUp,
      newBadges: newBadgesAwarded
    }
  })

  // Trigger Level Up Notification
  if (result.leveledUp) {
    const levelTitle = LEVELS.find((l) => l.level === result.newLevel)?.title || "Converter"
    await createNotification(
      userId,
      "level_up",
      "Level Up!",
      `Congratulations! You've reached Level ${result.newLevel} — ${levelTitle}!`,
      "/dashboard/progress"
    )
  }

  // Trigger Badge Earned Notifications
  for (const b of result.newBadges) {
    await createNotification(
      userId,
      "badge_earned",
      "New Badge Unlocked",
      `${b.icon} You earned the "${b.name}" badge!`,
      "/dashboard/progress"
    )
  }

  return result
}

export async function checkStreak(userId: string): Promise<any> {
  const progressRef = adminDb.collection("user_progress").doc(userId)
  const nowIso = new Date().toISOString()
  const todayStr = nowIso.split("T")[0] // YYYY-MM-DD
  const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0]

  let responseData = { streakUpdated: false, newStreak: 0, dailyBonusAwarded: false }

  await adminDb.runTransaction(async (transaction) => {
    const progressDoc = await transaction.get(progressRef)
    if (!progressDoc.exists) return

    const data = progressDoc.data()!
    const lastActive = data.lastActiveDate || data.last_active_date || ""
    const currentStreak = data.streakDays !== undefined ? data.streakDays : (data.streak_days || 0)

    if (lastActive === todayStr) {
      // Already active today, do nothing
      responseData = { streakUpdated: false, newStreak: currentStreak, dailyBonusAwarded: false }
      return
    }

    let dailyBonusAwarded = false
    let newStreak = currentStreak

    if (lastActive === yesterdayStr) {
      // Consecutive day login
      newStreak += 1
      dailyBonusAwarded = true
    } else {
      // Streak broken
      newStreak = 1
      dailyBonusAwarded = true
    }

    transaction.update(progressRef, {
      streakDays: newStreak,
      streak_days: newStreak,
      lastActiveDate: todayStr,
      last_active_date: todayStr,
      updatedAt: FieldValue.serverTimestamp(),
      updated_at: nowIso
    })

    responseData = {
      streakUpdated: true,
      newStreak,
      dailyBonusAwarded
    }
  })

  // Award XP for daily login outside the main transaction to prevent lock conflicts
  if (responseData.dailyBonusAwarded) {
    let reason = "Daily Login Reward"
    let amount = XP_REWARDS.daily_login

    // Check streak milestones
    if (responseData.newStreak === 7) {
      amount += XP_REWARDS.streak_7_days
      reason = "7-Day Login Streak Reward!"
    } else if (responseData.newStreak === 30) {
      amount += XP_REWARDS.streak_30_days
      reason = "30-Day Login Streak Reward!"
    }

    await awardXP(userId, amount, reason, "login")
  }

  if (responseData.streakUpdated) {
    await createNotification(
      userId,
      "streak_reminder",
      "Closing Streak Active!",
      `🔥 You have started or maintained a ${responseData.newStreak}-day active practice streak! Keep it up!`,
      "/dashboard/progress"
    )
  }

  return responseData
}
