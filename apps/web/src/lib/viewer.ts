import { eq } from 'drizzle-orm'
import { cookies, headers } from 'next/headers'
import type { Session } from 'next-auth'
import { auth } from '@/auth'
import { db, schema } from '@/db'
import { GUEST_COOKIE_NAME, GUEST_TOKEN_HEADER, verifyGuestToken } from './guest-token'
import { getOrCreateUserFromGuestId } from './guest-user'

/**
 * Unified viewer utility for server components
 *
 * Gets the current viewer (guest or authenticated user) in a type-safe way.
 * Use this in server components instead of calling auth() directly.
 *
 * @returns Viewer information with discriminated union type
 */
export async function getViewer(): Promise<
  { kind: 'user'; session: Session } | { kind: 'guest'; guestId: string } | { kind: 'unknown' }
> {
  const start = performance.now()

  // Check if user is authenticated via NextAuth
  let t = performance.now()
  const session = await auth()
  const authTime = performance.now() - t

  if (session) {
    console.log(
      `[PERF] getViewer (user): ${(performance.now() - start).toFixed(1)}ms | auth=${authTime.toFixed(1)}ms`
    )
    return { kind: 'user', session }
  }

  // Guest identity comes only from a verified token: the one the middleware
  // forwarded on page requests (a new guest has no cookie yet), else the
  // cookie (API routes, where the middleware doesn't run). Never a bare id a
  // client could set.
  t = performance.now()
  const headerStore = await headers()
  const headerToken = headerStore.get(GUEST_TOKEN_HEADER)
  const headersTime = performance.now() - t

  if (headerToken) {
    try {
      const { sid } = await verifyGuestToken(headerToken)
      console.log(
        `[PERF] getViewer (guest-header): ${(performance.now() - start).toFixed(1)}ms | auth=${authTime.toFixed(1)}ms, headers=${headersTime.toFixed(1)}ms`
      )
      return { kind: 'guest', guestId: sid }
    } catch {
      // Not a token we signed: fall through to the cookie.
    }
  }

  // Fallback: check for guest cookie
  t = performance.now()
  const cookieStore = await cookies()
  const guestCookie = cookieStore.get(GUEST_COOKIE_NAME)?.value
  const cookieTime = performance.now() - t

  if (!guestCookie) {
    console.log(
      `[PERF] getViewer (unknown): ${(performance.now() - start).toFixed(1)}ms | auth=${authTime.toFixed(1)}ms, headers=${headersTime.toFixed(1)}ms, cookies=${cookieTime.toFixed(1)}ms`
    )
    return { kind: 'unknown' }
  }

  try {
    t = performance.now()
    const { sid } = await verifyGuestToken(guestCookie)
    const verifyTime = performance.now() - t
    console.log(
      `[PERF] getViewer (guest-cookie): ${(performance.now() - start).toFixed(1)}ms | auth=${authTime.toFixed(1)}ms, headers=${headersTime.toFixed(1)}ms, cookies=${cookieTime.toFixed(1)}ms, verify=${verifyTime.toFixed(1)}ms`
    )
    return { kind: 'guest', guestId: sid }
  } catch {
    console.log(
      `[PERF] getViewer (unknown-failed): ${(performance.now() - start).toFixed(1)}ms | auth=${authTime.toFixed(1)}ms, headers=${headersTime.toFixed(1)}ms, cookies=${cookieTime.toFixed(1)}ms`
    )
    return { kind: 'unknown' }
  }
}

/**
 * Get the stable database user.id for the current viewer
 *
 * For authenticated users: returns session.user.id directly
 * For guests: looks up or creates the user record by guestId, returns user.id
 * For unknown: throws an error
 *
 * This is the single canonical way to get the current user's ID on the server.
 *
 * @throws Error if no valid viewer found
 */
export async function getUserId(): Promise<string> {
  const start = performance.now()
  const viewer = await getViewer()
  const viewerTime = performance.now() - start

  switch (viewer.kind) {
    case 'user':
      // Authenticated users already have a database user.id in their session
      console.log(
        `[PERF] getUserId (user): ${(performance.now() - start).toFixed(1)}ms | getViewer=${viewerTime.toFixed(1)}ms`
      )
      return viewer.session.user!.id
    case 'guest': {
      // Guests need to look up their user record by guestId
      const t = performance.now()
      const user = await getOrCreateUserFromGuestId(viewer.guestId)
      const userLookupTime = performance.now() - t
      console.log(
        `[PERF] getUserId (guest): ${(performance.now() - start).toFixed(1)}ms | getViewer=${viewerTime.toFixed(1)}ms, userLookup=${userLookupTime.toFixed(1)}ms`
      )
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
