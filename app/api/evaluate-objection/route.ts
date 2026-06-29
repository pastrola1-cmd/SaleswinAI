import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { awardXP } from "@/lib/xp"
import { FieldValue } from "firebase-admin/firestore"

interface EvaluationResult {
  score: number
  verdict: "Excellent" | "Good" | "Developing" | "Weak"
  feedback: string
  strengths: string[]
  weaknesses: string[]
  missed_points: string[]
  better_response: string
  xp_earned: number
}

function getMockEvaluation(objectionText: string, userResponse: string): EvaluationResult {
  const responseLength = userResponse.trim().length
  const score = Math.min(100, Math.max(20, Math.floor(responseLength / 3) + Math.floor(Math.random() * 20)))
  
  let verdict: EvaluationResult["verdict"] = "Developing"
  if (score >= 90) verdict = "Excellent"
  else if (score >= 70) verdict = "Good"
  else if (score >= 50) verdict = "Developing"
  else verdict = "Weak"

  return {
    score,
    verdict,
    feedback: `You made a reasonable attempt at addressing the objection. Your response showed some awareness of the client's concern, but you can be more specific about the actual value propositions that distinguish Lekki Smart Haven from alternatives. Try to anchor every objection response with a verifiable fact — price points, documentation status, or capital appreciation rates.`,
    strengths: [
      "You acknowledged the client's concern directly",
      "Response tone was professional and calm",
      "You attempted to redirect toward the product"
    ].slice(0, score >= 70 ? 3 : 2),
    weaknesses: [
      "Missing specific pricing reference points to support claims",
      "No mention of Certificate of Occupancy documentation advantage",
      "Did not offer a concrete next step or call to action"
    ].slice(0, score < 70 ? 3 : 1),
    missed_points: [
      "Reference the 18% annual capital appreciation rate",
      "Mention the 20% initial deposit installment plan option",
      "Cite C of O title as a differentiator from competitors"
    ],
    better_response: `I completely understand your concern — it's a significant investment and you want to be certain. What separates Lekki Smart Haven is the C of O title documentation, meaning you have full legal security from day one. Our 3-bedroom terraces start at ₦85 million with a flexible installment plan requiring just 20% upfront, interest-free over 12 months. Properties in this corridor have historically appreciated 18% annually — so delaying actually costs you more. Can I book you a site visit this weekend so you can see the infrastructure firsthand?`,
    xp_earned: Math.round(score * 0.75)
  }
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
    const { objectionText, userResponse, companyId, objectionId } = await request.json()

    if (!objectionText || !userResponse || !companyId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (userResponse.trim().length < 80) {
      return NextResponse.json({ error: "Response must be at least 80 characters" }, { status: 400 })
    }

    // 1. Fetch company brain for context
    const brainSnapshot = await adminDb
      .collection("company_brain")
      .where("company_id", "==", companyId)
      .get()

    const brainSummary = brainSnapshot.docs
      .map((d) => `[${d.data().category?.toUpperCase() || "GENERAL"}] ${d.data().content}`)
      .join("\n")

    const geminiApiKey = process.env.GEMINI_API_KEY
    let evaluation: EvaluationResult | null = null

    // 2. Call Gemini to evaluate
    if (geminiApiKey) {
      try {
        const systemInstruction = `You are a senior real estate sales coach in Nigeria with 15 years of experience. 
You are direct, encouraging, and results-focused. 
You specialize in helping property sales agents handle objections for luxury and affordable real estate.`

        const userPrompt = `Company knowledge context:
${brainSummary || "No company knowledge uploaded yet. Use general real estate sales coaching principles."}

Customer objection: "${objectionText}"

Salesperson response: "${userResponse}"

Evaluate this response and return ONLY valid JSON (no markdown, no code blocks):
{
  "score": number (0-100, based on how well they handled the objection with specific facts),
  "verdict": "Excellent" | "Good" | "Developing" | "Weak",
  "feedback": "string (2-3 sentences, address the rep as 'you', be specific and coach-like)",
  "strengths": ["string", "string"] (max 3 things they did well),
  "weaknesses": ["string", "string"] (max 3 things to improve),
  "missed_points": ["string"] (specific facts/tactics they should have used),
  "better_response": "string (ideal response demonstrating use of specific company details, prices, policies)",
  "xp_earned": number (0-100, proportional to score)
}`

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: userPrompt }] }],
              systemInstruction: { parts: [{ text: systemInstruction }] },
              generationConfig: { responseMimeType: "application/json" }
            })
          }
        )

        if (response.ok) {
          const data = await response.json()
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text
          if (rawText) {
            evaluation = JSON.parse(rawText)
          }
        }
      } catch (geminiError) {
        console.error("Gemini evaluation error, using mock:", geminiError)
      }
    }

    // Fallback
    if (!evaluation) {
      evaluation = getMockEvaluation(objectionText, userResponse)
    }

    const nowIso = new Date().toISOString()

    // 3. Save objection session to Firestore
    const sessionRef = await adminDb.collection("objection_sessions").add({
      userId: uid,
      companyId,
      objectionId: objectionId || null,
      objectionText,
      userResponse,
      aiScore: evaluation.score,
      aiFeedback: evaluation.feedback,
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      betterResponse: evaluation.better_response,
      missedPoints: evaluation.missed_points,
      xpEarned: evaluation.xp_earned,
      createdAt: nowIso
    })

    // 4. Update objectionScore with rolling average (last 10 sessions)
    const recentSessionsSnapshot = await adminDb
      .collection("objection_sessions")
      .where("userId", "==", uid)
      .get()

    const completedSessions = recentSessionsSnapshot.docs
      .map((d) => d.data())
      .filter((d) => d.aiScore !== undefined)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)

    // Ensure current session included
    const scores = completedSessions.map((s) => s.aiScore as number)
    if (!scores.includes(evaluation.score)) scores.unshift(evaluation.score)
    const rollingObjScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)

    const progressRef = adminDb.collection("user_progress").doc(uid)
    await adminDb.runTransaction(async (transaction) => {
      const progressDoc = await transaction.get(progressRef)
      if (progressDoc.exists) {
        transaction.update(progressRef, {
          objection_score: rollingObjScore,
          objectionScore: rollingObjScore,
          objections_drilled: FieldValue.increment(1),
          objectionsDrilled: FieldValue.increment(1),
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
          confidence_score: 0, confidenceScore: 0,
          conversion_score: 0, conversionScore: 0,
          objection_score: rollingObjScore,
          objectionScore: rollingObjScore,
          closing_score: 0, closingScore: 0,
          simulations_completed: 0, simulationsCompleted: 0,
          quizzes_completed: 0, quizzesCompleted: 0,
          objections_drilled: 1, objectionsDrilled: 1,
          updated_at: nowIso,
          updatedAt: FieldValue.serverTimestamp()
        })
      }
    })

    // 5. Award XP
    if (evaluation.xp_earned > 0) {
      await awardXP(uid, evaluation.xp_earned, `Objection Drill: ${objectionText.slice(0, 50)}`)
    }

    return NextResponse.json({
      success: true,
      sessionId: sessionRef.id,
      evaluation
    })
  } catch (err) {
    console.error("Evaluate objection error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to evaluate response" },
      { status: 500 }
    )
  }
}
