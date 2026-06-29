import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const session = cookies().get("session")?.value
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  }

  let managerUid: string
  try {
    const decodedToken = await adminAuth.verifySessionCookie(session)
    managerUid = decodedToken.uid
  } catch {
    return NextResponse.json({ error: "Session expired or invalid" }, { status: 401 })
  }

  try {
    const { userId } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    // 1. Fetch manager's profile to verify authority
    const managerDoc = await adminDb.collection("profiles").doc(managerUid).get()
    const managerData = managerDoc.data()
    if (!managerData || !managerData.company_id) {
      return NextResponse.json({ error: "Manager profile or company not found" }, { status: 403 })
    }

    if (!["owner", "manager", "admin", "super_admin"].includes(managerData.role || "")) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 })
    }

    // 2. Fetch target user's profile to ensure same company
    const repDoc = await adminDb.collection("profiles").doc(userId).get()
    if (!repDoc.exists) {
      return NextResponse.json({ error: "Representative profile not found" }, { status: 404 })
    }

    const repData = repDoc.data()!
    if (repData.company_id !== managerData.company_id) {
      return NextResponse.json({ error: "Cross-company visibility is forbidden" }, { status: 403 })
    }

    // 3. Fetch progress document
    const progressDoc = await adminDb.collection("user_progress").doc(userId).get()
    const progress = progressDoc.exists ? progressDoc.data() : null

    // 4. Fetch quiz sessions to find weak categories
    const quizQuery = await adminDb
      .collection("quiz_sessions")
      .where("userId", "==", userId)
      .get()

    const categoryStats: Record<string, { total: number; count: number }> = {}
    quizQuery.docs.forEach((d) => {
      const data = d.data()
      if (data.completedAt) {
        const cat = data.category || "general"
        const score = data.score || 0
        if (!categoryStats[cat]) {
          categoryStats[cat] = { total: 0, count: 0 }
        }
        categoryStats[cat].total += score
        categoryStats[cat].count += 1
      }
    })

    const weakCategories = Object.entries(categoryStats)
      .map(([cat, stats]) => ({
        category: cat,
        avgScore: Math.round(stats.total / stats.count)
      }))
      .filter((c) => c.avgScore < 60)
      .map((c) => `${c.category} (${c.avgScore}% avg)`)
      .join(", ")

    // 5. Fetch last 5 simulation outcomes
    const simsQuery = await adminDb
      .collection("simulation_sessions")
      .where("userId", "==", userId)
      .where("status", "==", "completed")
      .orderBy("completedAt", "desc")
      .limit(5)
      .get()

    const recentOutcomes = simsQuery.docs
      .map((d) => {
        const data = d.data()
        return `Outcome: ${data.outcome || "pending"}, Overall Score: ${data.scores?.overall || 0}%, Difficulty: ${data.difficulty}`
      })
      .join("\n")

    // 6. Request recommendations from Gemini
    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      return NextResponse.json({ error: "Gemini API key is not configured" }, { status: 500 })
    }

    const repName = repData.full_name || "Salesperson"
    const knowledgeScore = progress?.knowledgeScore ?? progress?.knowledge_score ?? 0
    const conversionScore = progress?.conversionScore ?? progress?.conversion_score ?? 0
    const objectionScore = progress?.objectionScore ?? progress?.objection_score ?? 0

    const systemPrompt = `You are a professional real estate sales consultant and coach. Your job is to output training actions in JSON.`
    const prompt = `Review the performance of property sales representative ${repName}:
Rolling scores:
- Product Knowledge Score: ${knowledgeScore}%
- Customer Conversion/Closing Score: ${conversionScore}%
- Objection Handling Score: ${objectionScore}%

Weak Quiz Categories:
${weakCategories || "None detected (representative scoring above 60% average)"}

Last 5 Practice Simulation Outcomes:
${recentOutcomes || "No practice runs completed yet."}

Based on this rep's performance details:
Give exactly 3 specific, highly-actionable real estate coaching recommendations to help them improve their closing rates, objection handling, or product knowledge.
Return ONLY a valid JSON object matching this structure (do NOT include any markdown code blocks, backticks, or other text):
{
  "recommendations": [
    {
      "action": "string (the training task, e.g. Drill the Lagos Land Registry document or practice with High-Budget Investors)",
      "reason": "string (1-2 sentences explaining why based on their scores/outcomes)",
      "priority": "high" | "medium" | "low"
    }
  ]
}`

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      }
    )

    if (!geminiResponse.ok) {
      const errTxt = await geminiResponse.text()
      console.error("Gemini coaching API error:", errTxt)
      throw new Error(`Gemini request failed: ${errTxt}`)
    }

    const geminiData = await geminiResponse.json()
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    if (!rawText) {
      throw new Error("Empty response from Gemini")
    }

    const responseJSON = JSON.parse(rawText)
    return NextResponse.json(responseJSON)

  } catch (err) {
    console.error("Coaching recommendation API error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch coaching recommendations" },
      { status: 500 }
    )
  }
}
