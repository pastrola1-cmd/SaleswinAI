import { getApps, initializeApp, cert } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"
import { getStorage } from "firebase-admin/storage"

const apps = getApps()

if (!apps.length) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY

  if (serviceAccountKey) {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey)
      initializeApp({
        credential: cert(serviceAccount),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`
      })
    } catch (e) {
      console.error("Firebase admin initialization error:", e)
      // Fallback
      initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "mock-project",
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "mock-project.appspot.com"
      })
    }
  } else {
    // Local / build fallback
    initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "mock-project",
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "mock-project.appspot.com"
    })
  }
}

export const adminAuth = getAuth()
export const adminDb = getFirestore()
export const adminStorage = getStorage()
