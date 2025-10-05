import { auth } from '@/auth'
import { cookies } from 'next/headers'
import { verifyGuestToken, GUEST_COOKIE_NAME } from './guest-token'

/**
 * Unified viewer utility for server components
 *
 * Gets the current viewer (guest or authenticated user) in a type-safe way.
 * Use this in server components instead of calling auth() directly.
 *
 * @returns Viewer information with discriminated union type
 */
export async function getViewer(): Promise<
  | { kind: 'user'; session: Awaited<ReturnType<typeof auth>> }
  | { kind: 'guest'; guestId: string }
  | { kind: 'unknown' }
> {
  // Check if user is authenticated via NextAuth
  const session = await auth()
  if (session) {
    return { kind: 'user', session }
  }

  // Check for guest cookie
  const cookieStore = await cookies()
  const guestCookie = cookieStore.get(GUEST_COOKIE_NAME)?.value

  if (!guestCookie) {
    return { kind: 'unknown' }
  }

  try {
    const { sid } = await verifyGuestToken(guestCookie)
    return { kind: 'guest', guestId: sid }
  } catch {
    return { kind: 'unknown' }
  }
}

/**
 * Get the user ID for the current viewer
 *
 * For guests: returns the guestId
 * For authenticated users: returns the user.id from session
 * For unknown: throws an error
 *
 * @throws Error if no valid viewer found
 */
export async function getViewerId(): Promise<string> {
  const viewer = await getViewer()

  switch (viewer.kind) {
    case 'user':
      return viewer.session!.user!.id
    case 'guest':
      return viewer.guestId
    case 'unknown':
      throw new Error('No valid viewer session found')
  }
}
