import { adminAuth, adminDb } from "@/utils/firebase/admin"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import ActiveQuizClient from "./ActiveQuizClient"

interface QuizPageProps {
  params: {
    sessionId: string
  }
}

export default async function QuizPage({ params }: QuizPageProps) {
  const { sessionId } = params

  const sessionCookie = cookies().get("session")?.value
  if (!sessionCookie) {
    redirect("/login")
  }

  let uid: string
  try {
    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie)
    uid = decodedToken.uid
  } catch {
    redirect("/login")
  }

  // Fetch quiz session
  const docRef = adminDb.collection("quiz_sessions").doc(sessionId)
  const docSnap = await docRef.get()

  if (!docSnap.exists) {
    notFound()
  }

  const session = docSnap.data()
  if (!session || session.userId !== uid) {
    notFound()
  }

  // If already completed, redirect straight to results page
  if (session.completedAt) {
    redirect(`/dashboard/quiz/${sessionId}/results`)
  }

  // Cast Firestore data to clean serializable object
  const quizSession = {
    id: docSnap.id,
    userId: session.userId,
    companyId: session.companyId,
    category: session.category,
    difficulty: session.difficulty,
    questions: session.questions || [],
    answers: session.answers || [],
    score: session.score || 0,
    xpEarned: session.xpEarned || 0,
    completedAt: session.completedAt || null,
    createdAt: session.createdAt
  }

  return <ActiveQuizClient session={quizSession} />
}
