import { adminDb } from "@/utils/firebase/admin"
import InviteForm from "./InviteForm"
import Link from "next/link"

export default async function InvitePage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  const token = searchParams.token

  if (!token) {
    return (
      <div className="text-center py-6 space-y-4 font-body">
        <div className="text-red-400 text-sm font-semibold">Missing Invitation Token</div>
        <p className="text-xs text-gray-400">Please check the link provided in your email.</p>
        <Link href="/login" className="inline-block text-[#00D68F] text-xs hover:underline mt-4">
          Go to Sign In
        </Link>
      </div>
    )
  }

  // Fetch invite details from Firestore
  const inviteQuery = await adminDb
    .collection("invites")
    .where("token", "==", token)
    .limit(1)
    .get()

  if (inviteQuery.empty) {
    return (
      <div className="text-center py-6 space-y-4 font-body">
        <div className="text-red-400 text-sm font-semibold">Invalid Invitation Link</div>
        <p className="text-xs text-gray-400">This invite link is invalid or does not exist.</p>
        <Link href="/login" className="inline-block text-[#00D68F] text-xs hover:underline mt-4">
          Go to Sign In
        </Link>
      </div>
    )
  }

  const inviteDoc = inviteQuery.docs[0]
  const invite = inviteDoc.data()

  if (invite.status !== "pending") {
    return (
      <div className="text-center py-6 space-y-4 font-body">
        <div className="text-amber-400 text-sm font-semibold">Invitation Already Used</div>
        <p className="text-xs text-gray-400">This invite has already been accepted or is no longer active.</p>
        <Link href="/login" className="inline-block text-[#00D68F] text-xs hover:underline mt-4">
          Go to Sign In
        </Link>
      </div>
    )
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return (
      <div className="text-center py-6 space-y-4 font-body">
        <div className="text-red-400 text-sm font-semibold">Invitation Expired</div>
        <p className="text-xs text-gray-400">This invite link has expired. Please contact your administrator.</p>
        <Link href="/login" className="inline-block text-[#00D68F] text-xs hover:underline mt-4">
          Go to Sign In
        </Link>
      </div>
    )
  }

  // Fetch company details
  let companyName = "Saleswin Partner"
  if (invite.company_id) {
    const companyDoc = await adminDb.collection("companies").doc(invite.company_id).get()
    if (companyDoc.exists) {
      companyName = companyDoc.data()?.name || "Saleswin Partner"
    }
  }

  return (
    <InviteForm
      token={token}
      inviteId={inviteDoc.id}
      email={invite.email}
      companyId={invite.company_id}
      role={invite.role}
      companyName={companyName}
    />
  )
}
