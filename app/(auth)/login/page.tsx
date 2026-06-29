import { Suspense } from "react"
import LoginForm from "./LoginForm"

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-12">
        <div className="w-8 h-8 border-2 border-t-[#00D68F] border-gray-800 rounded-full animate-spin"></div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
