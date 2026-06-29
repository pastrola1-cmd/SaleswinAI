"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/utils/firebase/client"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { doc, setDoc, updateDoc } from "firebase/firestore"

interface InviteFormProps {
  token: string
  inviteId: string
  email: string
  companyId: string
  role: string
  companyName: string
}

export default function InviteForm({
  inviteId,
  email,
  companyId,
  role,
  companyName,
}: InviteFormProps) {
  const router = useRouter()
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)

    try {
      // 1. Create auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const userId = userCredential.user.uid

      // 2. Create profile document in Firestore
      await setDoc(doc(db, "profiles", userId), {
        id: userId,
        full_name: fullName,
        email: email,
        role: role,
        company_id: companyId,
        is_active: true,
        created_at: new Date().toISOString()
      })

      // 3. Mark invite as accepted in Firestore
      await updateDoc(doc(db, "invites", inviteId), {
        status: "accepted",
        accepted_at: new Date().toISOString()
      })

      // 4. Set session cookie on the server
      const idToken = await userCredential.user.getIdToken()
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      })

      if (!res.ok) {
        throw new Error("Failed to establish server session")
      }

      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Failed to set up account. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 font-body">
      <div>
        <h2 className="text-2xl font-display font-bold text-white text-center">
          Join {companyName}
        </h2>
        <p className="mt-2 text-xs text-gray-400 text-center">
          You have been invited to join as a <span className="text-[#00D68F] font-semibold uppercase">{role}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/50 text-red-200 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Email Address
          </label>
          <input
            type="email"
            disabled
            value={email}
            className="w-full px-4 py-3 rounded-lg bg-[#080810]/50 border border-gray-900 text-gray-500 text-sm cursor-not-allowed"
          />
        </div>

        <div>
          <label htmlFor="fullName" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Your Full Name
          </label>
          <input
            id="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Tunde Bakare"
            className="w-full px-4 py-3 rounded-lg bg-[#080810] border border-gray-800 text-[#F2F2F7] placeholder-gray-600 focus:outline-none focus:border-[#00D68F] focus:ring-1 focus:ring-[#00D68F] transition-all text-sm"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-lg bg-[#080810] border border-gray-800 text-[#F2F2F7] placeholder-gray-600 focus:outline-none focus:border-[#00D68F] focus:ring-1 focus:ring-[#00D68F] transition-all text-sm"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-lg bg-[#080810] border border-gray-800 text-[#F2F2F7] placeholder-gray-600 focus:outline-none focus:border-[#00D68F] focus:ring-1 focus:ring-[#00D68F] transition-all text-sm"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-[#080810] bg-[#00D68F] hover:bg-[#00b378] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00D68F] focus:ring-offset-[#12121E] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Setting up account..." : "Accept Invitation & Join"}
          </button>
        </div>
      </form>
    </div>
  )
}
