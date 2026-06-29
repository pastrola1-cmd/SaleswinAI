import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import KnowledgeDashboardClient from "./KnowledgeDashboardClient"
import Link from "next/link"
import { QueryDocumentSnapshot } from "firebase-admin/firestore"

export default async function KnowledgePage() {
  const session = cookies().get("session")?.value
  if (!session) {
    redirect("/login")
  }

  let uid: string
  try {
    const decodedToken = await adminAuth.verifySessionCookie(session)
    uid = decodedToken.uid
  } catch {
    redirect("/login")
  }

  // Fetch profile from Firestore
  const profileDoc = await adminDb.collection("profiles").doc(uid).get()
  if (!profileDoc.exists) {
    redirect("/login")
  }

  const profile = profileDoc.data()
  if (!profile || !profile.company_id) {
    redirect("/dashboard")
  }

  // Fetch all company knowledge documents from Firestore
  const documentsQuery = await adminDb
    .collection("knowledge_documents")
    .where("company_id", "==", profile.company_id)
    .get()

  interface KnowledgeDoc {
    id: string
    file_name: string
    file_type: string
    status: string
    word_count: number
    created_at: string
    storage_path: string
  }

  const documents: KnowledgeDoc[] = documentsQuery.docs.map((doc: QueryDocumentSnapshot) => {
    const data = doc.data()
    return {
      id: doc.id,
      file_name: (data.file_name as string) || "",
      file_type: (data.file_type as string) || "",
      status: (data.status as string) || "pending",
      word_count: (data.word_count as number) || 0,
      created_at: (data.created_at as string) || "",
      storage_path: (data.storage_path as string) || ""
    }
  })

  // Sort documents by created_at descending
  documents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Fetch all company brain facts from Firestore to calculate category counts
  const brainQuery = await adminDb
    .collection("company_brain")
    .where("company_id", "==", profile.company_id)
    .get()

  const stats = {
    products: 0,
    pricing: 0,
    objections: 0,
    competitors: 0,
    personas: 0,
    policies: 0,
    usps: 0,
    faq: 0,
    scripts: 0,
  }

  brainQuery.docs.forEach((doc: QueryDocumentSnapshot) => {
    const data = doc.data()
    const category = data.category as keyof typeof stats
    if (category in stats) {
      stats[category]++
    }
  })

  // Fetch company name
  const companyDoc = await adminDb.collection("companies").doc(profile.company_id).get()
  const companyName = companyDoc.exists ? companyDoc.data()?.name || "Partner Company" : "Partner Company"

  return (
    <div className="min-h-screen bg-[#080810] text-[#F2F2F7] p-8">
      <div className="max-w-6xl mx-auto space-y-8 font-body">
        
        {/* Header */}
        <header className="flex justify-between items-center border-b border-gray-800/80 pb-6">
          <div>
            <Link href="/dashboard" className="text-xs text-gray-500 hover:text-[#00D68F] font-semibold uppercase tracking-wider mb-2 inline-block">
              &larr; Back to Dashboard
            </Link>
            <h1 className="text-3xl font-display font-extrabold tracking-tight text-white">
              AI Brain & <span className="text-[#00D68F]">Knowledge Base</span>
            </h1>
            <p className="text-sm text-gray-400">Manage business documentation and customize your SaleswinAI engine for {companyName}</p>
          </div>
        </header>

        {/* Dashboard Client */}
        <KnowledgeDashboardClient
          documents={documents}
          stats={stats}
        />
      </div>
    </div>
  )
}
