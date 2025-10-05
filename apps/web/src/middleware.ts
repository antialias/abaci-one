import { NextRequest, NextResponse } from 'next/server'
import { createGuestToken, GUEST_COOKIE_NAME } from './lib/guest-token'

/**
 * Middleware to:
 * 1. Ensure every visitor gets a guest token
 * 2. Add pathname to headers for Server Components
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Add pathname to headers so Server Components can access it
  response.headers.set('x-pathname', request.nextUrl.pathname)

  // Check if guest cookie already exists
  const existing = request.cookies.get(GUEST_COOKIE_NAME)?.value

  if (!existing) {
    // Generate new stable session ID
    const sid = crypto.randomUUID()

    // Create signed guest token
    const token = await createGuestToken(sid)

    // Set cookie with security flags
    response.cookies.set({
      name: GUEST_COOKIE_NAME,
      value: token,
      httpOnly: true, // Not accessible via JavaScript
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'lax', // CSRF protection
      path: '/', // Required for __Host- prefix
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}