"use server"

import { adminAuth, adminDb, adminStorage } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { QueryDocumentSnapshot } from "firebase-admin/firestore"

export async function deleteDocument(documentId: string) {
  // Get current user session from HTTP-only cookie
  const session = cookies().get("session")?.value
  if (!session) {
    return { error: "Unauthenticated" }
  }

  try {
    await adminAuth.verifySessionCookie(session)
  } catch {
    return { error: "Session expired or invalid. Please sign in again." }
  }

  // Fetch document details from Firestore
  const docRef = adminDb.collection("knowledge_documents").doc(documentId)
  const docSnap = await docRef.get()

  if (!docSnap.exists) {
    return { error: "Document not found" }
  }

  const doc = docSnap.data()
  if (!doc) {
    return { error: "Document record is empty" }
  }

  // 1. Delete from Firebase Storage if it's a real file upload
  const path = doc.storage_path
  if (path && !path.startsWith("manual-input://") && !path.startsWith("url://")) {
    try {
      const bucket = adminStorage.bucket()
      const bucketFile = bucket.file(path)
      await bucketFile.delete()
    } catch (storageError) {
      console.warn("Storage deletion warning:", storageError)
    }
  }

  // 2. Cascade delete Firestore facts in company_brain collection
  const batch = adminDb.batch()
  
  try {
    const brainQuery = await adminDb
      .collection("company_brain")
      .where("source_doc_id", "==", documentId)
      .get()

    brainQuery.docs.forEach((factDoc: QueryDocumentSnapshot) => {
      batch.delete(factDoc.ref)
    })
    
    // 3. Delete knowledge document record itself
    batch.delete(docRef)

    // Commit batch deletes
    await batch.commit()
  } catch (dbErr) {
    console.error("Firestore cascading delete error:", dbErr)
    return { error: dbErr instanceof Error ? dbErr.message : "Failed to remove database records" }
  }

  revalidatePath("/dashboard/knowledge")
  return { success: true }
}
