import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import OnboardingWizard from "./OnboardingWizard"

export default async function OnboardingPage() {
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

  // Fetch company details from Firestore
  const companyDoc = await adminDb.collection("companies").doc(profile.company_id).get()
  if (!companyDoc.exists) {
    redirect("/dashboard")
  }

  const company = companyDoc.data() as { name: string; website_url?: string; logo_url?: string }

  return (
    <OnboardingWizard
      initialCompanyName={company.name}
      initialWebsiteUrl={company.website_url || ""}
      initialLogoUrl={company.logo_url || ""}
    />
  )
}
