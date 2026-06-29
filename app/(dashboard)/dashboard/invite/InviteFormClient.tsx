"use client"

import { useFormState, useFormStatus } from "react-dom"
import { createAndSendInvite } from "@/app/(auth)/actions"
import { useEffect, useRef } from "react"

const initialState: {
  error?: string
  success?: boolean
  message?: string
} = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-[#080810] bg-[#00D68F] hover:bg-[#00b378] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00D68F] focus:ring-offset-[#12121E] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Sending invite..." : "Send Invitation"}
    </button>
  )
}

export default function InviteFormClient() {
  const [state, formAction] = useFormState(createAndSendInvite, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset()
    }
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state?.error && (
        <div className="p-3 rounded-lg bg-red-950/50 border border-red-500/50 text-red-200 text-xs font-body">
          {state.error}
        </div>
      )}

      {state?.success && state?.message && (
        <div className="p-3 rounded-lg bg-green-950/50 border border-green-500/50 text-green-200 text-xs break-all font-body">
          {state.message}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Agent Email Address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="agent@company.com"
          className="w-full px-3 py-2.5 rounded-lg bg-[#080810] border border-gray-800 text-[#F2F2F7] placeholder-gray-600 focus:outline-none focus:border-[#00D68F] focus:ring-1 focus:ring-[#00D68F] transition-all text-xs"
        />
      </div>

      <div>
        <label htmlFor="role" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Target Role
        </label>
        <select
          id="role"
          name="role"
          required
          className="w-full px-3 py-2.5 rounded-lg bg-[#080810] border border-gray-800 text-[#F2F2F7] focus:outline-none focus:border-[#00D68F] focus:ring-1 focus:ring-[#00D68F] transition-all text-xs"
        >
          <option value="salesperson">Salesperson (Agent)</option>
          <option value="trainer">Trainer</option>
          <option value="manager">Manager</option>
          <option value="admin">Administrator</option>
        </select>
      </div>

      <div className="pt-2">
        <SubmitButton />
      </div>
    </form>
  )
}
