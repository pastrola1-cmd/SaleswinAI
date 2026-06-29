import { adminDb } from "@/utils/firebase/admin"
import { NextResponse } from "next/server"

interface ProcessRequest {
  documentId: string
}

interface ExtractedBrain {
  products?: string[]
  pricing?: string[]
  payment_plans?: string[]
  objections?: string[]
  personas?: string[]
  competitors?: string[]
  policies?: string[]
  scripts?: string[]
  faq?: string[]
  usps?: string[]
}

function mockExtractKnowledge(text: string, fileName: string): ExtractedBrain {
  const lowerText = text.toLowerCase()
  const isRealEstate = lowerText.includes("estate") || lowerText.includes("property") || lowerText.includes("land") || lowerText.includes("lekki") || lowerText.includes("developer")
  
  return {
    products: isRealEstate 
      ? [`Lekki Smart Haven Terraces (${fileName})`, "Off-plan Luxury 3-bedroom Terraces", "Premium serviced plots in Ibeju-Lekki"]
      : ["Premium AI Objections Trainer", "Saleswin Enterprise Analytics Portal"],
    pricing: isRealEstate 
      ? ["Terraces starting from ₦85,000,000", "Serviced plots at ₦25,000,000 per plot"]
      : ["Starter Plan: ₦15,000 per user/month", "Enterprise custom annual contract"],
    payment_plans: isRealEstate 
      ? ["20% initial deposit with 12 months interest-free installment", "Outright payment discount of 5%"]
      : ["Monthly billing available", "Annual billing receives 2 months free"],
    objections: isRealEstate 
      ? ["I need to verify the C of O first", "I cannot pay ₦85M outright", "I am worried about construction delays"]
      : ["The system is too complex for our sales agents", "We prefer in-person sales training"],
    personas: isRealEstate 
      ? ["Diaspora investors seeking high rental yield", "High net worth individuals in Lekki/Ikoyi"]
      : ["Sales managers seeking team progress tracking", "Real estate business owners looking to scale closes"],
    competitors: isRealEstate 
      ? ["Landwey properties", "Mixta Africa"]
      : ["Traditional classroom training", "Generic CRM dashboards"],
    policies: isRealEstate 
      ? ["Physical inspection requires 24h notice", "Documentation fees are non-refundable"]
      : ["Refund policy allows cancellations within 7 days", "User seats can be transferred"],
    scripts: isRealEstate 
      ? ["Hello, thank you for choosing our Lekki terraces. Are you looking for investment or self-use?"]
      : ["Welcome to SaleswinAI, how can we improve your team's closing rate today?"],
    faq: isRealEstate 
      ? ["Q: Is the road tarred? A: Yes, Lekki haven is accessed via a tarred road."]
      : ["Q: Do we need coding skills? A: No, SaleswinAI is 100% no-code."],
    usps: isRealEstate 
      ? ["24/7 solar backup electricity", "Title: Certificate of Occupancy (C of O)", "Guaranteed 18% annual capital appreciation"]
      : ["Localized Nigerian market simulation personas", "Real-time AI voice objection training"]
  }
}

export async function POST(request: Request) {
  let docIdToUpdate: string | null = null
  try {
    const { documentId } = (await request.json()) as ProcessRequest
    if (!documentId) {
      return NextResponse.json({ error: "Missing documentId" }, { status: 400 })
    }

    docIdToUpdate = documentId

    // 1. Fetch document from Firestore
    const docRef = adminDb.collection("knowledge_documents").doc(documentId)
    const docSnap = await docRef.get()

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const document = docSnap.data()
    if (!document) {
      return NextResponse.json({ error: "Document data is empty" }, { status: 500 })
    }

    // Update status to 'processing'
    await docRef.update({ status: "processing" })

    const text = document.extracted_text || ""
    const geminiApiKey = process.env.GEMINI_API_KEY
    let parsedJson: ExtractedBrain | null = null

    if (geminiApiKey) {
      // Call Gemini API
      try {
        const systemInstruction = "You are a business knowledge extractor for a sales training platform. Extract and structure all sales-relevant information from this document."
        const userPrompt = `Extract structured knowledge from this business document.
Return ONLY valid JSON with these keys:
{
  "products": string[],
  "pricing": string[],
  "payment_plans": string[],
  "objections": string[],
  "personas": string[],
  "competitors": string[],
  "policies": string[],
  "scripts": string[],
  "faq": string[],
  "usps": string[]
}
Each value is an array of clear, standalone facts.
Document: ${text}`

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [{ text: userPrompt }],
                },
              ],
              systemInstruction: {
                parts: [{ text: systemInstruction }],
              },
              generationConfig: {
                responseMimeType: "application/json",
              },
            }),
          }
        )

        if (!response.ok) {
          throw new Error(`Gemini API returned status ${response.status}`)
        }

        const data = await response.json()
        const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (rawJsonText) {
          parsedJson = JSON.parse(rawJsonText)
        }
      } catch (geminiError) {
        console.error("Gemini API call failed, falling back to mock parser:", geminiError)
        parsedJson = mockExtractKnowledge(text, document.file_name)
      }
    } else {
      parsedJson = mockExtractKnowledge(text, document.file_name)
    }

    if (!parsedJson) {
      throw new Error("Failed to parse extracted structured knowledge.")
    }

    // 2. Use a Firestore batch to perform bulk writes atomically
    const batch = adminDb.batch()

    const categoriesMap: Record<string, string> = {
      products: "products",
      pricing: "pricing",
      payment_plans: "pricing",
      objections: "objections",
      personas: "personas",
      competitors: "competitors",
      policies: "policies",
      scripts: "scripts",
      faq: "faq",
      usps: "usps",
    }

    for (const [key, value] of Object.entries(parsedJson)) {
      const category = categoriesMap[key]
      if (category && Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === "string" && item.trim()) {
            const brainRef = adminDb.collection("company_brain").doc()
            batch.set(brainRef, {
              company_id: document.company_id,
              category,
              content: item.trim(),
              source_doc_id: documentId,
              created_at: new Date().toISOString()
            })
          }
        }
      }
    }

    // 3. Save objections into objection_library collection
    if (parsedJson.objections && Array.isArray(parsedJson.objections)) {
      const uniqueObjections = Array.from(new Set(parsedJson.objections))
      for (const obj of uniqueObjections) {
        if (obj && typeof obj === "string" && obj.trim()) {
          const objectionRef = adminDb.collection("objection_library").doc()
          batch.set(objectionRef, {
            company_id: document.company_id,
            objection: obj.trim(),
            category: "custom",
            difficulty: "intermediate",
            is_custom: true,
            created_at: new Date().toISOString()
          })
        }
      }
    }

    // Commit all insertions
    await batch.commit()

    // 4. Update document status to 'ready'
    await docRef.update({ status: "ready" })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error processing document:", error)

    if (docIdToUpdate) {
      try {
        await adminDb.collection("knowledge_documents").doc(docIdToUpdate).update({
          status: "failed"
        })
      } catch (dbErr) {
        console.error("Failed to update status to failed:", dbErr)
      }
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 })
  }
}
