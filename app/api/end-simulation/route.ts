import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { awardXP } from "@/lib/xp"
import { FieldValue } from "firebase-admin/firestore"

interface SimulationDebrief {
  overall_score: number
  scores: {
    discovery: number
    trust_building: number
    objection_handling: number
    closing: number
    communication: number
    product_knowledge: number
  }
  outcome: "converted" | "not_converted"
  outcome_reason: string
  top_strengths: string[]
  critical_mistakes: string[]
  turning_points: Array<{
    messageIndex: number // Index of the message in the conversation array
    type: "strong" | "mistake" | "missed"
    quote: string
    explanation: string
  }>
  debrief: string
  xp_earned: number
  coaching_focus: string
}

export async function POST(request: Request) {
  const session = cookies().get("session")?.value
  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })
  }

  let uid: string
  try {
    const decodedToken = await adminAuth.verifySessionCookie(session)
    uid = decodedToken.uid
  } catch {
    return NextResponse.json({ error: "Session expired or invalid" }, { status: 401 })
  }

  try {
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
    }

    // 1. Fetch simulation session doc
    const sessionRef = adminDb.collection("simulation_sessions").doc(sessionId)
    const sessionDoc = await sessionRef.get()
    if (!sessionDoc.exists) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const sessionData = sessionDoc.data()!
    const { messages = [], personaName, channel, difficulty, companyId } = sessionData

    if (messages.length === 0) {
      return NextResponse.json({ error: "Cannot evaluate empty conversation" }, { status: 400 })
    }

    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      return NextResponse.json({ error: "Gemini API key is not configured" }, { status: 500 })
    }

    // 2. Query company brain for context
    const brainSnapshot = await adminDb
      .collection("company_brain")
      .where("company_id", "==", companyId)
      .get()

    const brainSummary = brainSnapshot.docs
      .map((d) => `[${d.data().category?.toUpperCase() || "GENERAL"}] ${d.data().content}`)
      .join("\n")

    // 3. Compile full chat transcript
    const chatTranscript = messages
      .map((m: any, index: number) => `[Message Index: ${index}] ${m.role.toUpperCase()}: "${m.content}"`)
      .join("\n")

    // 4. Prompt Gemini to evaluate the conversation
    const systemPrompt = `You are a senior real estate sales coach in Nigeria with 15 years of experience. You evaluate sales conversations and output detailed feedback in valid JSON.`

    const evaluationPrompt = `You are evaluating a simulated sales conversation between a salesperson and a client named ${personaName} via ${channel}.
Company knowledge context:
${brainSummary || "No company information uploaded."}
Difficulty level: ${difficulty}

Conversation transcript:
${chatTranscript}

Evaluate the salesperson's performance across 6 criteria:
1. Discovery (asking open questions to identify budget, needs, and timelines).
2. Trust Building (showing legal transparency, professional handling of skepticism, and clear documentation policies).
3. Objection Handling (how well they addressed buyer pushbacks using specific company facts).
4. Closing (asking for a concrete next step like a booking or deposit, and handling payment discussions).
5. Communication (professional tone, clarity, and client pacing).
6. Product Knowledge (accuracy of pitching facts from the company context).

Provide your complete evaluation and return ONLY a valid JSON object matching the format below (do NOT include any markdown code blocks, backticks, or other text):
{
  "overall_score": number (0-100),
  "scores": {
    "discovery": number (0-100),
    "trust_building": number (0-100),
    "objection_handling": number (0-100),
    "closing": number (0-100),
    "communication": number (0-100),
    "product_knowledge": number (0-100)
  },
  "outcome": "converted" | "not_converted",
  "outcome_reason": "string (1-2 sentences summarizing why they did or did not close the deal)",
  "top_strengths": ["string"] (max 3 strengths),
  "critical_mistakes": ["string"] (max 3 critical mistakes),
  "turning_points": [
    {
      "messageIndex": number (index corresponding to the salesperson's message in the transcript above),
      "type": "strong" | "mistake" | "missed",
      "quote": "string (the exact quote from that message)",
      "explanation": "string (why it was strong/mistake/missed)"
    }
  ],
  "debrief": "string (2-3 sentences of constructive coaching feedback written in your professional sales coach voice, addressing the user as 'you')",
  "xp_earned": number (0-100, proportional to the overall score),
  "coaching_focus": "string (the primary skill category they should work on next)"
}`

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: evaluationPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      }
    )

    if (!geminiResponse.ok) {
      const errTxt = await geminiResponse.text()
      console.error("Gemini end evaluation error:", errTxt)
      throw new Error(`Gemini evaluation failed: ${errTxt}`)
    }

    const geminiData = await geminiResponse.json()
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    if (!rawText) {
      throw new Error("Empty response received from Gemini evaluation")
    }

    const debrief: SimulationDebrief = JSON.parse(rawText)

    // 5. Update session in Firestore
    const nowIso = new Date().toISOString()
    await sessionRef.update({
      status: "completed",
      completedAt: new Date(),
      scores: {
        overall: debrief.overall_score,
        discovery: debrief.scores.discovery,
        trust: debrief.scores.trust_building,
        objection: debrief.scores.objection_handling,
        closing: debrief.scores.closing,
        communication: debrief.scores.communication,
        productKnowledge: debrief.scores.product_knowledge
      },
      outcome: debrief.outcome,
      outcomeReason: debrief.outcome_reason,
      aiDebrief: debrief.debrief,
      topStrengths: debrief.top_strengths,
      criticalMistakes: debrief.critical_mistakes,
      turningPoints: debrief.turning_points,
      xpEarned: debrief.xp_earned,
      updatedAt: FieldValue.serverTimestamp()
    })

    // 6. Update user rolling average metrics
    const recentSimulationsSnapshot = await adminDb
      .collection("simulation_sessions")
      .where("userId", "==", uid)
      .where("status", "==", "completed")
      .get()

    const completedSims = recentSimulationsSnapshot.docs
      .map((d) => d.data())
      .filter((s) => s.scores?.overall !== undefined)
      .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime())
      .slice(0, 10)

    const overallScores = completedSims.map((s) => s.scores.overall as number)
    if (!overallScores.includes(debrief.overall_score)) overallScores.unshift(debrief.overall_score)
    const avgOverall = Math.round(overallScores.reduce((s, v) => s + v, 0) / overallScores.length)

    const closingScores = completedSims.map((s) => s.scores.closing as number)
    if (!closingScores.includes(debrief.scores.closing)) closingScores.unshift(debrief.scores.closing)
    const avgClosing = Math.round(closingScores.reduce((s, v) => s + v, 0) / closingScores.length)

    const trustScores = completedSims.map((s) => s.scores.trust as number)
    if (!trustScores.includes(debrief.scores.trust_building)) trustScores.unshift(debrief.scores.trust_building)
    const avgTrust = Math.round(trustScores.reduce((s, v) => s + v, 0) / trustScores.length)

    const progressRef = adminDb.collection("user_progress").doc(uid)
    await adminDb.runTransaction(async (transaction) => {
      const progressDoc = await transaction.get(progressRef)
      if (progressDoc.exists) {
        transaction.update(progressRef, {
          conversion_score: avgOverall,
          conversionScore: avgOverall,
          closing_score: avgClosing,
          closingScore: avgClosing,
          confidence_score: avgTrust,
          confidenceScore: avgTrust,
          simulations_completed: FieldValue.increment(1),
          simulationsCompleted: FieldValue.increment(1),
          updated_at: nowIso,
          updatedAt: FieldValue.serverTimestamp()
        })
      } else {
        transaction.set(progressRef, {
          userId: uid,
          xp_total: 0, xpTotal: 0,
          level: 1, level_title: "Rookie", levelTitle: "Rookie",
          streak_days: 0, streakDays: 0,
          knowledge_score: 0, knowledgeScore: 0,
          confidence_score: avgTrust, confidenceScore: avgTrust,
          conversion_score: avgOverall, conversionScore: avgOverall,
          objection_score: 0, objectionScore: 0,
          closing_score: avgClosing, closingScore: avgClosing,
          simulations_completed: 1, simulationsCompleted: 1,
          quizzes_completed: 0, quizzesCompleted: 0,
          objections_drilled: 0, objectionsDrilled: 0,
          updated_at: nowIso,
          updatedAt: FieldValue.serverTimestamp()
        })
      }
    })

    // 7. Award XP
    if (debrief.xp_earned > 0) {
      await awardXP(uid, debrief.xp_earned, `Completed Sales Simulation with ${personaName}`)
    }

    return NextResponse.json({
      success: true,
      debrief
    })

  } catch (err) {
    console.error("End simulation error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to end simulation" },
      { status: 500 }
    )
  }
}
