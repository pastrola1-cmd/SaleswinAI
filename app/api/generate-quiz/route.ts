import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

interface GenerateQuizRequest {
  companyId: string
  category: string
  difficulty: string
  count: number
}

interface QuestionItem {
  question: string
  options: { A: string; B: string; C: string; D: string }
  correct: "A" | "B" | "C" | "D"
  explanation: string
  category: string
}

function getMockQuestions(category: string, difficulty: string, count: number): QuestionItem[] {
  const allMocks: QuestionItem[] = [
    {
      question: "What is the starting price for Lekki Smart Haven Terraces?",
      options: {
        A: "₦65,000,000",
        B: "₦75,000,000",
        C: "₦85,000,000",
        D: "₦95,000,000"
      },
      correct: "C",
      explanation: "Lekki Smart Haven Terraces start at ₦85,000,000 for the off-plan luxury 3-bedroom terraces.",
      category: "pricing"
    },
    {
      question: "What is the document title certificate associated with Lekki Smart Haven serviced plots?",
      options: {
        A: "Deed of Assignment",
        B: "Certificate of Occupancy (C of O)",
        C: "Governor's Consent",
        D: "Survey Plan"
      },
      correct: "B",
      explanation: "The official document title for the Lekki Smart Haven serviced plots is the Certificate of Occupancy (C of O).",
      category: "policies"
    },
    {
      question: "What discount is available for buyers who make an outright payment for properties?",
      options: {
        A: "2% outright payment discount",
        B: "5% outright payment discount",
        C: "10% outright payment discount",
        D: "12% outright payment discount"
      },
      correct: "B",
      explanation: "Outright payments receive a promotional discount of 5% off the purchase value.",
      category: "pricing"
    },
    {
      question: "What is the minimum initial deposit required for the 12-month installment payment plan?",
      options: {
        A: "10% initial deposit",
        B: "20% initial deposit",
        C: "30% initial deposit",
        D: "40% initial deposit"
      },
      correct: "B",
      explanation: "The terrace installment payment plan requires a minimum of 20% initial deposit followed by 12 interest-free months.",
      category: "pricing"
    },
    {
      question: "Which competitor is listed as a major alternative in the Lekki/Lagos real estate region?",
      options: {
        A: "Landwey Properties",
        B: "UPDC Real Estate",
        C: "Mixta Africa",
        D: "Both A and C"
      },
      correct: "D",
      explanation: "Both Landwey Properties and Mixta Africa are listed as primary regional competitors.",
      category: "competitors"
    },
    {
      question: "What is the guaranteed annual capital appreciation rate for Lekki Smart Haven properties?",
      options: {
        A: "10% annual capital appreciation",
        B: "15% annual capital appreciation",
        C: "18% annual capital appreciation",
        D: "25% annual capital appreciation"
      },
      correct: "C",
      explanation: "The marketing documents outline a guaranteed capital appreciation of 18% annually.",
      category: "products"
    },
    {
      question: "How much advance notice is required to arrange a physical property inspection for clients?",
      options: {
        A: "12 hours notice",
        B: "24 hours notice",
        C: "48 hours notice",
        D: "72 hours notice"
      },
      correct: "B",
      explanation: "Company policies dictate that arranging a physical property site tour requires at least 24 hours advance notice.",
      category: "policies"
    },
    {
      question: "Are documentation fees refundable if a client decides to cancel their purchase agreement?",
      options: {
        A: "Refundable within 7 days",
        B: "Refundable with a 10% penalty fee",
        C: "Non-refundable documentation fees",
        D: "Fully refundable"
      },
      correct: "C",
      explanation: "Documentation and legal fees are non-refundable once paperwork is dispatched.",
      category: "policies"
    }
  ]

  // Filter by category if not 'all'
  let filtered = allMocks
  if (category !== "all") {
    filtered = allMocks.filter(q => q.category === category)
    if (filtered.length === 0) {
      filtered = allMocks // Fallback if filtered category is empty
    }
  }

  // Shuffle and slice to request count
  const shuffled = [...filtered].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

export async function POST(request: Request) {
  // Get current user session from HTTP-only cookie
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
    const { companyId, category, difficulty, count } = (await request.json()) as GenerateQuizRequest

    if (!companyId || !category || !difficulty || !count) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
    }

    // 1. Query company brain facts
    let queryRef = adminDb.collection("company_brain").where("company_id", "==", companyId)
    if (category !== "all") {
      queryRef = queryRef.where("category", "==", category)
    }

    const brainSnapshot = await queryRef.get()

    // Fallback block if no company knowledge documents have been parsed
    if (brainSnapshot.empty) {
      // Check if they have at least one knowledge document
      const docCheck = await adminDb
        .collection("knowledge_documents")
        .where("company_id", "==", companyId)
        .limit(1)
        .get()

      if (docCheck.empty) {
        return NextResponse.json(
          { error: "Upload company knowledge first before generating training quizzes." },
          { status: 400 }
        )
      }
    }

    const brainContent = brainSnapshot.docs.map((docSnap) => docSnap.data().content).join("\n")
    const geminiApiKey = process.env.GEMINI_API_KEY
    let parsedQuestions: QuestionItem[] = []

    if (geminiApiKey && brainContent.trim().length > 0) {
      try {
        const systemInstruction = "You are a sales training quiz generator. Generate challenging, specific questions testing real product and sales knowledge."
        const userPrompt = `Based on this company knowledge base:
${brainContent}

Generate ${count} multiple choice questions.
Difficulty: ${difficulty}
Category: ${category}

IMPORTANT: Reference SPECIFIC details (actual prices, real product names, real policies). No generic questions.

Return ONLY valid JSON array. Each item:
{
  "question": string,
  "options": { "A": string, "B": string, "C": string, "D": string },
  "correct": "A" | "B" | "C" | "D",
  "explanation": string,
  "category": string
}`

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [{ text: userPrompt }]
                }
              ],
              systemInstruction: {
                parts: [{ text: systemInstruction }]
              },
              generationConfig: {
                responseMimeType: "application/json"
              }
            })
          }
        )

        if (response.ok) {
          const data = await response.json()
          const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text
          if (rawJsonText) {
            parsedQuestions = JSON.parse(rawJsonText)
          }
        }
      } catch (geminiError) {
        console.error("Gemini quiz generation error, falling back to mock questions:", geminiError)
      }
    }

    // Fallback if gemini didn't generate or failed
    if (parsedQuestions.length === 0) {
      parsedQuestions = getMockQuestions(category, difficulty, count)
    }

    // 2. Insert quiz session in Firestore
    const sessionRef = await adminDb.collection("quiz_sessions").add({
      userId: uid,
      companyId,
      category,
      difficulty,
      questions: parsedQuestions,
      answers: [],
      score: 0,
      xpEarned: 0,
      completedAt: null,
      createdAt: new Date().toISOString()
    })

    return NextResponse.json({ success: true, sessionId: sessionRef.id })
  } catch (err) {
    console.error("Quiz generate API error:", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create quiz session" }, { status: 500 })
  }
}
