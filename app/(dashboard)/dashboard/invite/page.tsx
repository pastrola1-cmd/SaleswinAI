import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import InviteFormClient from "./InviteFormClient"
import Link from "next/link"
import { QueryDocumentSnapshot } from "firebase-admin/firestore"

export default async function InviteTeamPage() {
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

  // Allow only owners, managers or admins to access
  if (!['owner', 'manager', 'admin', 'super_admin'].includes(profile.role || '')) {
    redirect("/dashboard")
  }

  // Fetch past invites from Firestore
  const invitesQuery = await adminDb
    .collection("invites")
    .where("company_id", "==", profile.company_id)
    .get()

  interface InviteData {
    id: string
    email: string
    role: string
    status: string
    token: string
    created_at: string
  }

  const invites: InviteData[] = invitesQuery.docs.map((doc: QueryDocumentSnapshot) => {
    const data = doc.data()
    return {
      id: doc.id,
      email: (data.email as string) || "",
      role: (data.role as string) || "",
      status: (data.status as string) || "pending",
      token: (data.token as string) || "",
      created_at: (data.created_at as string) || ""
    }
  })

  // Sort invites by created_at descending
  invites.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Fetch company name
  const companyDoc = await adminDb.collection("companies").doc(profile.company_id).get()
  const companyName = companyDoc.exists ? companyDoc.data()?.name || "Saleswin Partner" : "Saleswin Partner"

  return (
    <div className="min-h-screen bg-[#080810] text-[#F2F2F7] p-8">
      <div className="max-w-4xl mx-auto space-y-8 font-body">
        <header className="flex justify-between items-center border-b border-gray-800/80 pb-6">
          <div>
            <Link href="/dashboard" className="text-xs text-gray-500 hover:text-[#00D68F] font-semibold uppercase tracking-wider mb-2 inline-block">
              &larr; Back to Dashboard
            </Link>
            <h1 className="text-3xl font-display font-extrabold tracking-tight text-white">
              Invite <span className="text-[#00D68F]">Team Members</span>
            </h1>
            <p className="text-sm text-gray-400">Add sales agents, managers, or trainers to {companyName}</p>
          </div>
        </header>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Invite Form */}
          <div className="md:col-span-1">
            <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-6 space-y-4">
              <h3 className="font-display font-bold text-white text-lg">New Invitation</h3>
              <InviteFormClient />
            </div>
          </div>

          {/* Invitation Log */}
          <div className="md:col-span-2">
            <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl overflow-hidden animate-fadeIn">
              <div className="p-6 border-b border-gray-800/80">
                <h3 className="font-display font-bold text-white text-lg">Active Invitations</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-800/80 bg-[#080810]/30 text-gray-400 font-semibold">
                      <th className="p-4">Email</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites && invites.length > 0 ? (
                      invites.map((invite) => (
                        <tr key={invite.id} className="border-b border-gray-800/30 hover:bg-[#080810]/20 transition-colors">
                          <td className="p-4 font-semibold text-white">
                            {invite.email}
                            {invite.status === 'pending' && (
                              <div className="text-[10px] text-gray-500 font-mono select-all mt-1">
                                token: {invite.token}
                              </div>
                            )}
                          </td>
                          <td className="p-4 uppercase text-xs tracking-wider text-gray-400 font-semibold">{invite.role}</td>
                          <td className="p-4">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                              invite.status === 'accepted'
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                : invite.status === 'expired'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {invite.status}
                            </span>
                          </td>
                          <td className="p-4 text-xs text-gray-500">
                            {invite.created_at ? new Date(invite.created_at).toLocaleDateString() : "N/A"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-500">
                          No invitations sent yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
