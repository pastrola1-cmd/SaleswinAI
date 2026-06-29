"use client"

import { useEffect, useState } from "react"
import { db } from "@/utils/firebase/client"
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc
} from "firebase/firestore"
import Link from "next/link"

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
  company_id: string | null
  is_active: boolean
  created_at?: string
  lastSeenAt?: string
  last_active?: string
}

interface Invite {
  id: string
  email: string
  role: string
  status: string
  token: string
  createdAt?: string
  created_at?: string
  expiresAt?: string
  expires_at?: string
}

interface TeamManagementClientProps {
  companyId: string
  currentUserRole: string
  currentUserId: string
}

export default function TeamManagementClient({
  companyId,
  currentUserRole,
  currentUserId
}: TeamManagementClientProps) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)

  // Form State
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("salesperson")
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  // Confirmation Modals State
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [profileToRemove, setProfileToRemove] = useState<Profile | null>(null)
  const [removeLoading, setRemoveLoading] = useState(false)

  const [showRoleModal, setShowRoleModal] = useState(false)
  const [profileToEdit, setProfileToEdit] = useState<Profile | null>(null)
  const [selectedRole, setSelectedRole] = useState("salesperson")
  const [roleLoading, setRoleLoading] = useState(false)

  // 1. Real-time listener for current team members (profiles)
  useEffect(() => {
    const q = query(collection(db, "profiles"), where("company_id", "==", companyId))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Profile[] = []
        snapshot.forEach((docSnap) => {
          const data = docSnap.data()
          list.push({
            id: docSnap.id,
            full_name: data.full_name || null,
            email: data.email || null,
            role: data.role || null,
            company_id: data.company_id || null,
            is_active: data.is_active !== undefined ? data.is_active : (data.isActive !== undefined ? data.isActive : true),
            created_at: data.created_at || data.createdAt,
            lastSeenAt: data.lastSeenAt || data.last_active || data.created_at || data.createdAt
          })
        })
        setProfiles(list)
        setLoading(false)
      },
      (error) => {
        console.error("Firestore team listener error:", error)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [companyId])

  // 2. Real-time listener for pending invites
  useEffect(() => {
    const q = query(
      collection(db, "invites"),
      where("company_id", "==", companyId),
      where("status", "==", "pending")
    )
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Invite[] = []
        snapshot.forEach((docSnap) => {
          const data = docSnap.data()
          list.push({
            id: docSnap.id,
            email: data.email || "",
            role: data.role || "",
            status: data.status || "pending",
            token: data.token || "",
            createdAt: data.createdAt || data.created_at,
            expiresAt: data.expiresAt || data.expires_at
          })
        })
        setInvites(list)
      },
      (error) => {
        console.error("Firestore invites listener error:", error)
      }
    )

    return () => unsubscribe()
  }, [companyId])

  // 3. Invite Action
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError(null)
    setInviteSuccess(null)
    setInviteLoading(true)

    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          companyId
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to send invitation")
      }

      setInviteSuccess(`Invite sent to ${inviteEmail}`)
      setInviteEmail("")
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to send invite")
    } finally {
      setInviteLoading(false)
    }
  }

  // 4. Deactivate / Activate Action
  const toggleDeactivate = async (profile: Profile) => {
    try {
      const profileRef = doc(db, "profiles", profile.id)
      await updateDoc(profileRef, {
        is_active: !profile.is_active,
        isActive: !profile.is_active
      })
    } catch (err) {
      console.error("Failed to update status:", err)
      alert("Failed to update user status")
    }
  }

  // 5. Cancel Invitation Action
  const cancelInvite = async (inviteId: string) => {
    try {
      const inviteRef = doc(db, "invites", inviteId)
      await updateDoc(inviteRef, {
        status: "expired"
      })
    } catch (err) {
      console.error("Failed to cancel invite:", err)
      alert("Failed to cancel invitation")
    }
  }

  // 6. Resend Invitation Action
  const resendInvite = async (invite: Invite) => {
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: invite.email,
          role: invite.role,
          companyId
        })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to resend invite")
      }

      // Expire old invite
      const inviteRef = doc(db, "invites", invite.id)
      await updateDoc(inviteRef, { status: "expired" })

      setInviteSuccess(`Resent invite to ${invite.email}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to resend invitation")
    }
  }

  // 7. Remove User Action
  const triggerRemove = (profile: Profile) => {
    setProfileToRemove(profile)
    setShowRemoveModal(true)
  }

  const confirmRemove = async () => {
    if (!profileToRemove) return
    setRemoveLoading(true)

    try {
      // Delete user profile document from Firestore
      await deleteDoc(doc(db, "profiles", profileToRemove.id))
      
      // Also delete progress document if it exists
      await deleteDoc(doc(db, "user_progress", profileToRemove.id))

      setShowRemoveModal(false)
      setProfileToRemove(null)
    } catch (err) {
      console.error("Failed to remove member:", err)
      alert("Failed to remove team member")
    } finally {
      setRemoveLoading(false)
    }
  }

  // 8. Edit Role Action
  const triggerRoleEdit = (profile: Profile) => {
    setProfileToEdit(profile)
    setSelectedRole(profile.role || "salesperson")
    setShowRoleModal(true)
  }

  const confirmRoleEdit = async () => {
    if (!profileToEdit) return
    setRoleLoading(true)

    try {
      const profileRef = doc(db, "profiles", profileToEdit.id)
      await updateDoc(profileRef, {
        role: selectedRole
      })

      setShowRoleModal(false)
      setProfileToEdit(null)
    } catch (err) {
      console.error("Failed to edit role:", err)
      alert("Failed to update role")
    } finally {
      setRoleLoading(false)
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "owner":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#00D68F] text-[#080810]">Owner</span>
      case "manager":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">Manager</span>
      case "trainer":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">Trainer</span>
      case "admin":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Admin</span>
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-500/10 text-gray-400 border border-gray-500/20">Salesperson</span>
    }
  }

  const getInitials = (name: string | null) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase()
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-10 h-10 border-4 border-t-[#00D68F] border-gray-800 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8 font-body">
      
      {/* Top Section Layout */}
      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Section C: Invite New Member */}
        <div className="lg:col-span-1">
          <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="font-display font-bold text-white text-lg">Invite New Member</h3>
              <p className="text-xs text-gray-400 mt-1">Send an invitation email to add them to your company workspace.</p>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              {inviteError && (
                <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/50 text-red-200 text-sm">
                  {inviteError}
                </div>
              )}
              {inviteSuccess && (
                <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/50 text-emerald-200 text-sm">
                  {inviteSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="agent@company.com"
                  className="w-full px-4 py-3 rounded-lg bg-[#080810] border border-gray-800 text-[#F2F2F7] placeholder-gray-600 focus:outline-none focus:border-[#00D68F] focus:ring-1 focus:ring-[#00D68F] transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Workspace Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#080810] border border-gray-800 text-[#F2F2F7] focus:outline-none focus:border-[#00D68F] focus:ring-1 focus:ring-[#00D68F] transition-all text-sm cursor-pointer"
                >
                  <option value="salesperson">Salesperson</option>
                  <option value="trainer">Trainer</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={inviteLoading}
                className="w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-[#080810] bg-[#00D68F] hover:bg-[#00b378] focus:outline-none transition-all disabled:opacity-50"
              >
                {inviteLoading ? "Sending invite..." : "Send Invite"}
              </button>
            </form>
          </div>
        </div>

        {/* Section B: Pending Invites */}
        <div className="lg:col-span-2">
          <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl overflow-hidden h-full flex flex-col">
            <div className="p-6 border-b border-gray-800/80">
              <h3 className="font-display font-bold text-white text-lg">Pending Invitations</h3>
              <p className="text-xs text-gray-400 mt-1">Workspace invitations awaiting completion.</p>
            </div>
            
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-800/80 bg-[#080810]/30 text-gray-400 font-semibold">
                    <th className="p-4">Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Sent Date</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.length > 0 ? (
                    invites.map((invite) => (
                      <tr key={invite.id} className="border-b border-gray-800/30 hover:bg-[#080810]/20 transition-colors">
                        <td className="p-4">
                          <p className="font-semibold text-white">{invite.email}</p>
                          <span className="text-[10px] text-gray-500 font-mono select-all bg-gray-900/40 px-1 py-0.5 rounded border border-gray-800">
                            /invite?token={invite.token}
                          </span>
                        </td>
                        <td className="p-4 uppercase text-xs font-semibold text-gray-300">{invite.role}</td>
                        <td className="p-4 text-xs text-gray-400">
                          {invite.createdAt ? new Date(invite.createdAt).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => resendInvite(invite)}
                            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-lg transition-colors"
                          >
                            Resend
                          </button>
                          <button
                            onClick={() => cancelInvite(invite.id)}
                            className="px-3 py-1.5 bg-red-950/40 hover:bg-red-950/80 border border-red-500/20 text-red-200 text-xs font-semibold rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-500">
                        No pending invitations.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Section A: Current Team Members */}
      <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-800/80">
          <h3 className="font-display font-bold text-white text-lg">Active Team Members</h3>
          <p className="text-xs text-gray-400 mt-1">Manage team roles, status active states, and system entry credentials.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-800/80 bg-[#080810]/30 text-gray-400 font-semibold">
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
                <th className="p-4">Joined Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id} className="border-b border-gray-800/30 hover:bg-[#080810]/20 transition-colors">
                  <td className="p-4 flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-[#00D68F] text-[#080810] flex items-center justify-center font-bold font-display text-sm shrink-0">
                      {getInitials(profile.full_name)}
                    </div>
                    <div>
                      {currentUserRole === "manager" || currentUserRole === "owner" || currentUserRole === "admin" || currentUserRole === "super_admin" ? (
                        <Link
                          href={`/dashboard/team/${profile.id}`}
                          className="font-bold text-white hover:text-[#00D68F] transition-colors"
                        >
                          {profile.full_name || "New User"}
                        </Link>
                      ) : (
                        <span className="font-bold text-white">{profile.full_name || "New User"}</span>
                      )}
                      {profile.id === currentUserId && (
                        <span className="ml-2 text-[10px] bg-white/10 text-white px-1.5 py-0.5 rounded font-semibold uppercase">You</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-gray-300">{profile.email || "N/A"}</td>
                  <td className="p-4">{getRoleBadge(profile.role || "")}</td>
                  <td className="p-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                        profile.is_active
                          ? "bg-green-500/10 text-green-400 border border-green-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}
                    >
                      {profile.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-gray-400">
                    {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "N/A"}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    {profile.id !== currentUserId && (
                      <>
                        <button
                          onClick={() => triggerRoleEdit(profile)}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-lg transition-colors"
                        >
                          Change Role
                        </button>
                        <button
                          onClick={() => toggleDeactivate(profile)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                            profile.is_active
                              ? "bg-amber-950/40 hover:bg-amber-950/80 border-amber-500/20 text-amber-200"
                              : "bg-green-950/40 hover:bg-green-950/80 border-green-500/20 text-green-200"
                          }`}
                        >
                          {profile.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => triggerRemove(profile)}
                          className="px-3 py-1.5 bg-red-950/40 hover:bg-red-950/80 border border-red-500/20 text-red-200 text-xs font-semibold rounded-lg transition-colors"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Change Modal */}
      {showRoleModal && profileToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-[#080810]/75 backdrop-blur-xs" onClick={() => setShowRoleModal(false)}></div>
          <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-6 max-w-md w-full relative z-10 space-y-6">
            <div>
              <h3 className="font-display font-bold text-white text-lg">Change Workspace Role</h3>
              <p className="text-xs text-gray-400 mt-1">
                Select the new security classification and role parameters for <strong>{profileToEdit.full_name}</strong>.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#080810] border border-gray-800 text-[#F2F2F7] focus:outline-none focus:border-[#00D68F] focus:ring-1 focus:ring-[#00D68F] transition-all text-sm cursor-pointer"
                >
                  <option value="salesperson">Salesperson</option>
                  <option value="trainer">Trainer</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowRoleModal(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRoleEdit}
                disabled={roleLoading}
                className="px-4 py-2 bg-[#00D68F] hover:bg-[#00b378] text-[#080810] font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {roleLoading ? "Updating..." : "Save Role Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {showRemoveModal && profileToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-[#080810]/75 backdrop-blur-xs" onClick={() => setShowRemoveModal(false)}></div>
          <div className="bg-[#12121E] border border-gray-800/80 rounded-2xl p-6 max-w-md w-full relative z-10 space-y-6">
            <div>
              <h3 className="font-display font-bold text-white text-lg">Remove Team Member?</h3>
              <p className="text-sm text-gray-400 mt-2">
                Are you sure you want to completely remove <strong>{profileToRemove.full_name}</strong> from the company workspace? This action is permanent and deletes all training logs and records.
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowRemoveModal(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemove}
                disabled={removeLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {removeLoading ? "Removing..." : "Confirm Removal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
