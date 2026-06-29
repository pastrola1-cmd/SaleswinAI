"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { auth, db } from "@/utils/firebase/client"
import { onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
  company_id: string | null
  avatar_url: string | null
  is_active: boolean
}

interface Company {
  id: string
  name: string
  logo_url: string | null
  website_url: string | null
  plan?: string
  planStatus?: string
  paystackSubscriptionCode?: string
  paystackCustomerCode?: string
}

interface ProfileContextType {
  profile: Profile | null
  company: Company | null
  loading: boolean
  refresh: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfileData = useCallback(async (uid: string) => {
    try {
      // Fetch profile doc from Firestore
      const profileRef = doc(db, "profiles", uid)
      const profileDoc = await getDoc(profileRef)

      if (!profileDoc.exists()) {
        setProfile(null)
        setCompany(null)
        return
      }

      const profileData = profileDoc.data() as Profile
      setProfile(profileData)

      // Fetch company doc from Firestore if available
      if (profileData.company_id) {
        const companyRef = doc(db, "companies", profileData.company_id)
        const companyDoc = await getDoc(companyRef)
        if (companyDoc.exists()) {
          setCompany({ id: companyDoc.id, ...companyDoc.data() } as Company)
        }
      }
    } catch (err) {
      console.error("Error fetching profile context in Firebase:", err)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await fetchProfileData(user.uid)
      } else {
        setProfile(null)
        setCompany(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [fetchProfileData])

  const refresh = useCallback(async () => {
    const user = auth.currentUser
    if (user) {
      setLoading(true)
      await fetchProfileData(user.uid)
      setLoading(false)
    }
  }, [fetchProfileData])

  const value = {
    profile,
    company,
    loading,
    refresh,
  }

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider")
  }
  return context
}
