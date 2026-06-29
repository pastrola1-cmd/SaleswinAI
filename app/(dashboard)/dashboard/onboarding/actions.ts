"use server"

import { adminAuth, adminDb, adminStorage } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { v4 as uuidv4 } from "uuid"
// @ts-expect-error: pdf-parse lacks default export declaration
import pdfParse from "pdf-parse"
import mammoth from "mammoth"

// Helper to count words
function getWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export async function saveCompanyDetails(formData: FormData) {
  const websiteUrl = formData.get("websiteUrl") as string
  const logoUrl = formData.get("logoUrl") as string

  // Get current user session from HTTP-only cookie
  const session = cookies().get("session")?.value
  if (!session) {
    return { error: "Unauthenticated" }
  }

  let uid: string
  try {
    const decodedToken = await adminAuth.verifySessionCookie(session)
    uid = decodedToken.uid
  } catch {
    return { error: "Session expired or invalid. Please sign in again." }
  }

  const profileDoc = await adminDb.collection("profiles").doc(uid).get()
  const profile = profileDoc.data()

  if (!profile?.company_id) {
    return { error: "No company associated with this profile" }
  }

  try {
    // Update company in Firestore
    await adminDb.collection("companies").doc(profile.company_id).update({
      website_url: websiteUrl || null,
      logo_url: logoUrl || null
    })
  } catch (dbErr) {
    return { error: dbErr instanceof Error ? dbErr.message : "Failed to update company details" }
  }

  return { success: true }
}

export async function uploadOnboardingFile(formData: FormData) {
  const file = formData.get("file") as File
  if (!file || file.size === 0) {
    return { error: "No file provided" }
  }

  // Get current user session from HTTP-only cookie
  const session = cookies().get("session")?.value
  if (!session) {
    return { error: "Unauthenticated" }
  }

  let uid: string
  try {
    const decodedToken = await adminAuth.verifySessionCookie(session)
    uid = decodedToken.uid
  } catch {
    return { error: "Session expired or invalid. Please sign in again." }
  }

  const profileDoc = await adminDb.collection("profiles").doc(uid).get()
  const profile = profileDoc.data()

  if (!profile?.company_id) {
    return { error: "No company associated with this profile" }
  }

  const fileExtension = file.name.split(".").pop()?.toLowerCase() || ""
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // 1. Extract text based on file type
  let extractedText = ""
  let fileType = "text"

  try {
    if (fileExtension === "pdf") {
      fileType = "pdf"
      const data = await pdfParse(buffer)
      extractedText = data.text || ""
    } else if (fileExtension === "docx") {
      fileType = "docx"
      const result = await mammoth.extractRawText({ buffer })
      extractedText = result.value || ""
    } else if (fileExtension === "txt") {
      fileType = "text"
      extractedText = buffer.toString("utf-8")
    } else if (["png", "jpg", "jpeg"].includes(fileExtension)) {
      fileType = "image"
      extractedText = `[AI Visual Reference: ${file.name}]\nThis image contains visual sales collateral or marketing content from the business.`
    } else if (fileExtension === "pptx") {
      fileType = "pptx"
      extractedText = `[AI Document Reference: ${file.name}]\nThis presentation file outlines sales strategies, product guidelines, or pitch decks.`
    } else {
      fileType = "text"
      extractedText = buffer.toString("utf-8")
    }
  } catch (err) {
    console.error("Text extraction failed for file:", file.name, err)
    extractedText = `[Failed Text Extraction: ${file.name}]\nCould not extract raw text from file due to structure or encoding issues.`
  }

  // 2. Upload file to Firebase Storage
  const uniqueFileName = `companies/${profile.company_id}/knowledge/${uuidv4()}-${file.name}`
  try {
    const bucket = adminStorage.bucket()
    const bucketFile = bucket.file(uniqueFileName)
    await bucketFile.save(buffer, {
      metadata: {
        contentType: file.type,
        cacheControl: "public, max-age=3600"
      }
    })
  } catch (uploadError) {
    console.error("Firebase Storage Upload Error:", uploadError)
    return { error: `Storage Upload Failed: ${uploadError instanceof Error ? uploadError.message : "Unknown storage error"}` }
  }

  // 3. Insert document record into Firestore collection
  try {
    const docRef = await adminDb.collection("knowledge_documents").add({
      company_id: profile.company_id,
      file_name: file.name,
      file_type: fileType,
      storage_path: uniqueFileName,
      status: "pending",
      extracted_text: extractedText,
      word_count: getWordCount(extractedText),
      created_at: new Date().toISOString()
    })
    return { success: true, documentId: docRef.id }
  } catch (dbError) {
    console.error("Firestore database write error:", dbError)
    return { error: dbError instanceof Error ? dbError.message : "Failed to create document record in Firestore" }
  }
}

export async function savePastedTexts(scripts: string, faqs: string, websiteUrl: string) {
  // Get current user session from HTTP-only cookie
  const session = cookies().get("session")?.value
  if (!session) {
    return { error: "Unauthenticated" }
  }

  let uid: string
  try {
    const decodedToken = await adminAuth.verifySessionCookie(session)
    uid = decodedToken.uid
  } catch {
    return { error: "Session expired or invalid. Please sign in again." }
  }

  const profileDoc = await adminDb.collection("profiles").doc(uid).get()
  const profile = profileDoc.data()

  if (!profile?.company_id) {
    return { error: "No company associated with this profile" }
  }

  const docsInserted: string[] = []

  // Insert website URL reference if provided
  if (websiteUrl && websiteUrl.trim()) {
    try {
      const docRef = await adminDb.collection("knowledge_documents").add({
        company_id: profile.company_id,
        file_name: `Website Link: ${websiteUrl.trim()}`,
        file_type: "url",
        storage_path: `url://${websiteUrl.trim()}`,
        status: "pending",
        extracted_text: `Sales page and marketing information from website: ${websiteUrl.trim()}`,
        word_count: 10,
        created_at: new Date().toISOString()
      })
      docsInserted.push(docRef.id)
    } catch (err) {
      console.error("Error saving website paste:", err)
    }
  }

  // Insert scripts if provided
  if (scripts && scripts.trim()) {
    try {
      const docRef = await adminDb.collection("knowledge_documents").add({
        company_id: profile.company_id,
        file_name: "Manual Sales Script",
        file_type: "script",
        storage_path: "manual-input://script",
        status: "pending",
        extracted_text: scripts.trim(),
        word_count: getWordCount(scripts),
        created_at: new Date().toISOString()
      })
      docsInserted.push(docRef.id)
    } catch (err) {
      console.error("Error saving scripts paste:", err)
    }
  }

  // Insert FAQs if provided
  if (faqs && faqs.trim()) {
    try {
      const docRef = await adminDb.collection("knowledge_documents").add({
        company_id: profile.company_id,
        file_name: "Manual FAQ Sheet",
        file_type: "faq",
        storage_path: "manual-input://faq",
        status: "pending",
        extracted_text: faqs.trim(),
        word_count: getWordCount(faqs),
        created_at: new Date().toISOString()
      })
      docsInserted.push(docRef.id)
    } catch (err) {
      console.error("Error saving FAQs paste:", err)
    }
  }

  return { success: true, documentIds: docsInserted }
}
