import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    cookies().delete("session")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// Support GET for simple redirect-logout calls
export async function GET() {
  try {
    cookies().delete("session")
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"))
  } catch (error) {
    console.error("Logout GET error:", error)
    return NextResponse.redirect(new URL("/login", "http://localhost:3000"))
  }
}
