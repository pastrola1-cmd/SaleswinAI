import { adminDb } from "@/utils/firebase/admin"

export const PLAN_LIMITS = {
  free: {
    users: 1,
    simulations_per_month: 3,
    quiz_per_month: 5
  },
  pro: {
    users: 1, // Wait, pro allows 1 owner/admin or is it unlimited? As per user spec: { users: 1, simulations_per_month: -1, quiz_per_month: -1 }
    simulations_per_month: -1,
    quiz_per_month: -1
  },
  starter: {
    users: 10,
    simulations_per_month: -1,
    quiz_per_month: -1
  },
  growth: {
    users: 25,
    simulations_per_month: -1,
    quiz_per_month: -1
  },
  enterprise: {
    users: -1,
    simulations_per_month: -1,
    quiz_per_month: -1
  }
}

export async function checkLimit(
  companyId: string,
  limitType: "users" | "simulations" | "quizzes"
): Promise<{ allowed: boolean; reason?: string }> {
  // 1. Fetch company document
  const companyDoc = await adminDb.collection("companies").doc(companyId).get()
  if (!companyDoc.exists) {
    return { allowed: false, reason: "Company not found" }
  }

  const companyData = companyDoc.data()
  const plan = (companyData?.plan || "free") as keyof typeof PLAN_LIMITS
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free

  if (limitType === "users") {
    const limit = limits.users
    if (limit === -1) {
      return { allowed: true }
    }

    // Count profiles belonging to this company
    const profilesSnapshot = await adminDb
      .collection("profiles")
      .where("company_id", "==", companyId)
      .get()

    if (profilesSnapshot.size >= limit) {
      return {
        allowed: false,
        reason: `Your company is on the '${plan}' plan, which limits active team members to ${limit}. Please upgrade to add more members.`
      }
    }
  } else if (limitType === "simulations") {
    const limit = limits.simulations_per_month
    if (limit === -1) {
      return { allowed: true }
    }

    // Count simulation sessions created this month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const sessionsSnapshot = await adminDb
      .collection("simulation_sessions")
      .where("company_id", "==", companyId)
      .where("createdAt", ">=", startOfMonth.toISOString())
      .get()

    if (sessionsSnapshot.size >= limit) {
      return {
        allowed: false,
        reason: `Your company is on the '${plan}' plan, which limits simulations to ${limit} per month. Please upgrade for unlimited practice.`
      }
    }
  } else if (limitType === "quizzes") {
    const limit = limits.quiz_per_month
    if (limit === -1) {
      return { allowed: true }
    }

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const quizzesSnapshot = await adminDb
      .collection("quiz_sessions")
      .where("company_id", "==", companyId)
      .where("createdAt", ">=", startOfMonth.toISOString())
      .get()

    if (quizzesSnapshot.size >= limit) {
      return {
        allowed: false,
        reason: `Your company is on the '${plan}' plan, which limits quizzes to ${limit} per month. Please upgrade for unlimited quizzes.`
      }
    }
  }

  return { allowed: true }
}
