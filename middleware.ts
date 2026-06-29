import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const session = request.cookies.get("session")?.value
  const { pathname } = request.nextUrl

  // Protected paths redirect to login if no session cookie is present
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) {
    if (!session) {
      const loginUrl = new URL("/login", request.url)
      // Pass the original destination as a search param for post-login redirect
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Auth paths redirect to dashboard if session cookie is present
  if (pathname === "/login" || pathname === "/register") {
    if (session) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/login",
    "/register",
  ],
}
