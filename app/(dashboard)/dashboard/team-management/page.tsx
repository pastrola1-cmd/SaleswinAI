import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import TeamManagementClient from "./TeamManagementClient"

export default async function TeamManagementPage() {
  // Get current user session from HTTP-only cookie
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
  const profile = profileDoc.data()

  if (!profile || !profile.company_id) {
    redirect("/dashboard")
  }

  // Allow only owners, managers or admins to access team settings
  if (!["owner", "manager", "admin", "super_admin"].includes(profile.role || "")) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-[#080810] text-[#F2F2F7] p-8">
      <div className="max-w-6xl mx-auto space-y-8 font-body">
        
        {/* Header */}
        <header className="border-b border-gray-800/80 pb-6">
          <h1 className="text-3xl font-display font-extrabold tracking-tight text-white">
            Team <span className="text-[#00D68F]">Management</span>
          </h1>
          <p className="text-sm text-gray-400">Add, configure, and monitor roles and access permissions for your workspace members</p>
        </header>

        <TeamManagementClient
          companyId={profile.company_id}
          currentUserRole={profile.role}
          currentUserId={uid}
        />
      </div>
    </div>
  )
}
