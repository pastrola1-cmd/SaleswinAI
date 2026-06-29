import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { deductXP } from "@/lib/xp"
import { FieldValue } from "firebase-admin/firestore"

const PERSONA_DETAILS: Record<string, string> = {
  sarah_m: "Sarah M. is a first-time home buyer with a strict budget of ₦8 Million. She is excited about owning her first property but extremely nervous, hesitant, and easily overwhelmed by real estate jargon. She needs warm guidance, clear explanations of documentation (C of O, survey plans), and emotional reassurance that her investment is safe.",
  alhaji_musa: "Alhaji Musa is a busy, experienced real estate investor. He doesn't care for small talk, greetings, or pleasantries. He only cares about hard numbers: Return on Investment (ROI), rental yield projections, capital appreciation rates, development timelines, and bulk discounts. If you do not provide specific metrics immediately, he gets impatient.",
  mrs_okonkwo: "Mrs. Okonkwo is a highly skeptical buyer. She was previously defrauded by a rogue developer and lost her hard-earned money. As a result, she is defensive, untrusting, and asks tough questions about the land title security, legal paperwork, and physical allocation. You must build deep trust and show clear legal transparency to warm her up.",
  david_a: "David A. is 'The Comparator'. He is currently looking at three other estates along the Lekki corridor. He knows prices, land sizes, and amenities of competitors. He is demanding strong Unique Selling Propositions (USPs) and clear justifications for why he should choose your company over others.",
  bola_tunde: "Bola and Tunde are a married couple. Bola is very excited about the design, amenities, and layout, and is ready to pay. Tunde is a conservative doubter who believes the location is too far out, underdeveloped, and not worth the price. You must balance both personas—validating Bola's excitement while addressing Tunde's skepticism about the area's appreciation.",
  lagos_corporate: "Lagos Corporate Ltd is a corporate representative looking to purchase 5 housing units for key executives. They are professional, formal, and require commercial discount terms, official pricing sheets, payment plan invoices, and assurance of strict corporate contract compliance."
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
    const { sessionId, userMessage } = await request.json()

    if (!sessionId || !userMessage) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // 1. Fetch simulation session doc
    const sessionRef = adminDb.collection("simulation_sessions").doc(sessionId)
    const sessionDoc = await sessionRef.get()
    if (!sessionDoc.exists) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const sessionData = sessionDoc.data()!
    const { companyId, personaKey, personaName, channel, difficulty, messages = [], messageCount = 0 } = sessionData

    // 2. Query company brain context
    const brainSnapshot = await adminDb
      .collection("company_brain")
      .where("company_id", "==", companyId)
      .get()

    const brainSummary = brainSnapshot.docs
      .map((d) => `[${d.data().category?.toUpperCase() || "GENERAL"}] ${d.data().content}`)
      .join("\n")

    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      return NextResponse.json({ error: "Gemini API key is not configured" }, { status: 500 })
    }

    // 3. Handle Hint Request
    if (userMessage === "__HINT__") {
      // Fetch user progress to verify XP
      const progressSnapshot = await adminDb.collection("user_progress").doc(uid).get()
      const xpTotal = progressSnapshot.exists ? (progressSnapshot.data()?.xp_total || progressSnapshot.data()?.xpTotal || 0) : 0

      if (xpTotal < 50) {
        return NextResponse.json({ error: "Insufficient XP. Hint costs 50 XP." }, { status: 400 })
      }

      // Deduct 50 XP
      await deductXP(uid, 50, `Simulation Hint used in session with ${personaName}`)

      // Ask Gemini for a hint based on history
      const hintPrompt = `You are an expert real estate sales coach. 
Analyze this conversation history between a salesperson (user) and the customer (${personaName}):
${messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")}

Provide a concise, 1-2 sentence hint/sales tip telling the salesperson exactly how they should handle the customer's last concern or what key value proposition they should pitch next. Keep it practical and coach-like.`

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: hintPrompt }] }],
            systemInstruction: { parts: [{ text: "You are a professional real estate sales coach." }] }
          })
        }
      )

      if (!response.ok) {
        throw new Error("Failed to call Gemini for hint")
      }

      const data = await response.json()
      const hintText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Try asking open-ended questions about their budget or timeline."

      return NextResponse.json({ hint: hintText })
    }

    // 4. Regular Simulation Flow
    const personaDescription = PERSONA_DETAILS[personaKey] || "A property buyer in Nigeria."

    const systemInstruction = `You are ${personaName}, a realistic Nigerian property buyer speaking via ${channel}.
Persona details: ${personaDescription}
Company knowledge context:
${brainSummary || "No company information uploaded. Respond with general Nigerian property buyer expectations."}
Difficulty level: ${difficulty}

RULES:
- Be extremely realistic. Show real emotions, raise typical objections (pricing, location, document trust), and ask for clarifications.
- Keep responses short and conversational (maximum 4 sentences).
- If the salesperson builds trust, uses facts, and answers your concerns, show warmer, more collaborative signals.
- If the salesperson fumbles, ignores your questions, or sounds robotic, increase your resistance and skepticism.
- Maintain the character at all times. Do NOT break character or explain that you are an AI.
- Do NOT mention the rules or the scoring systems.

${
  (messageCount + 2) % 6 === 0
    ? `CRITICAL RULE: Since this is the end of a round of 6 messages, you MUST append a hidden scoring block at the very end of your response exactly in this format: <!--SCORE:{"discovery":number,"trust":number,"objection":number}--> where scores are integers between 0 and 100 representing your internal satisfaction with the salesperson's performance so far (Discovery, Trust Building, Objection Handling).`
    : ""
}`

    // Format message history for Gemini (alternating turns)
    const contents: any[] = []
    messages.forEach((msg: any) => {
      // salesperson maps to user, customer maps to model
      contents.push({
        role: msg.role === "salesperson" ? "user" : "model",
        parts: [{ text: msg.content }]
      })
    })

    // If starting, send system-trigger, else append user message
    if (userMessage === "__START__") {
      contents.push({
        role: "user",
        parts: [{ text: "Start the conversation. Introduce yourself as the client and state your opening query/concern." }]
      })
    } else {
      contents.push({
        role: "user",
        parts: [{ text: userMessage }]
      })
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemInstruction }] }
        })
      }
    )

    if (!geminiResponse.ok) {
      const errTxt = await geminiResponse.text()
      console.error("Gemini simulation error:", errTxt)
      throw new Error(`Gemini simulation failed: ${errTxt}`)
    }

    const geminiData = await geminiResponse.json()
    const rawResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Hello? I am waiting for your response."

    // Extract hidden score block if present
    const scoreRegex = /<!--SCORE:(\{.*?\})-->/
    const scoreMatch = rawResponse.match(scoreRegex)
    let extractedScores = null
    if (scoreMatch) {
      try {
        extractedScores = JSON.parse(scoreMatch[1])
      } catch (e) {
        console.error("Failed to parse running scores:", e)
      }
    }

    // Clean response text
    const cleanResponseText = rawResponse.replace(scoreRegex, "").trim()

    // 5. Append messages to Firestore
    const messagesToAppend = []
    if (userMessage !== "__START__") {
      messagesToAppend.push({
        role: "salesperson",
        content: userMessage,
        timestamp: new Date().toISOString()
      })
    }
    messagesToAppend.push({
      role: "customer",
      content: cleanResponseText,
      timestamp: new Date().toISOString()
    })

    const updates: any = {
      messages: FieldValue.arrayUnion(...messagesToAppend),
      messageCount: FieldValue.increment(messagesToAppend.length),
      updatedAt: FieldValue.serverTimestamp()
    }

    if (extractedScores) {
      updates["scores.discovery"] = extractedScores.discovery || 0
      updates["scores.trust"] = extractedScores.trust || 0
      updates["scores.objection"] = extractedScores.objection || 0
    }

    await sessionRef.update(updates)

    return NextResponse.json({
      success: true,
      message: cleanResponseText
    })

  } catch (err) {
    console.error("Simulate message error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to simulate message" },
      { status: 500 }
    )
  }
}
