import { eq } from 'drizzle-orm'
import { cookies, headers } from 'next/headers'
import { auth } from '@/auth'
import { db, schema } from '@/db'
import { GUEST_COOKIE_NAME, verifyGuestToken } from './guest-token'

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

  // Check for guest ID in header (set by middleware)
  const headerStore = await headers()
  const headerGuestId = headerStore.get('x-guest-id')
  if (headerGuestId) {
    return { kind: 'guest', guestId: headerGuestId }
  }

  // Fallback: check for guest cookie
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
      return viewer.session.user!.id
    case 'guest':
      return viewer.guestId
    case 'unknown':
      throw new Error('No valid viewer session found')
  }
}

/**
 * Get or create a user record from a guestId
 *
 * This is the core function for converting a guest session identifier
 * into a database user record. If no user exists for the guestId,
 * one is created automatically.
 *
 * @param guestId - The guest session identifier
 * @returns The user record from the database
 */
async function getOrCreateUserFromGuestId(guestId: string) {
  let user = await db.query.users.findFirst({
    where: eq(schema.users.guestId, guestId),
  })

  if (!user) {
    const [newUser] = await db.insert(schema.users).values({ guestId }).returning()
    user = newUser
  }

  return user
}

/**
 * Get the database user.id for the current viewer
 *
 * IMPORTANT: This returns the actual database user.id, NOT the guestId.
 * Use this when you need to pass a user ID to authorization functions
 * like canPerformAction(), or any function that expects a database user.id.
 *
 * For authenticated users: returns session.user.id directly
 * For guests: looks up or creates the user record by guestId, returns user.id
 * For unknown: throws an error
 *
 * @throws Error if no valid viewer found
 */
export async function getDbUserId(): Promise<string> {
  const viewer = await getViewer()

  switch (viewer.kind) {
    case 'user':
      // Authenticated users already have a database user.id in their session
      return viewer.session.user!.id
    case 'guest': {
      // Guests need to look up their user record by guestId
      const user = await getOrCreateUserFromGuestId(viewer.guestId)
      return user.id
    }
    case 'unknown':
      throw new Error('No valid viewer session found')
  }
}

/**
 * Get the full user record for the current viewer
 *
 * This returns the complete database user record, useful when you need
 * more than just the user.id (e.g., for checking user properties).
 *
 * For authenticated users: looks up user by session.user.id
 * For guests: looks up or creates user by guestId
 * For unknown: throws an error
 *
 * @throws Error if no valid viewer found
 */
export async function getViewerUser() {
  const viewer = await getViewer()

  switch (viewer.kind) {
    case 'user': {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, viewer.session.user!.id),
      })
      if (!user) {
        throw new Error('Authenticated user not found in database')
      }
      return user
    }
    case 'guest': {
      return getOrCreateUserFromGuestId(viewer.guestId)
    }
    case 'unknown':
      throw new Error('No valid viewer session found')
  }
}
