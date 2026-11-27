import { jwtVerify, SignJWT } from 'jose'

/**
 * Guest token utilities for stateless guest session management
 *
 * Uses HttpOnly cookies with signed JWTs to track guest identities.
 * Tokens are small (just a stable ID) to respect cookie size limits.
 */

// Cookie name with __Host- prefix for security in production
// __Host- prefix requires: Secure, Path=/, no Domain
// In development (http://localhost), __Host- won't work without Secure flag
export const GUEST_COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-guest' : 'guest'

/**
 * Header the middleware uses to hand the guest token to server components on
 * page requests (where the cookie may not exist yet, or is being re-issued).
 * It carries the signed token, never a bare id: readers verify it, so a
 * client that sends its own gains nothing it couldn't do with the cookie.
 */
export const GUEST_TOKEN_HEADER = 'x-guest-token'

function encodeSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

/**
 * Get the secret key for signing/verifying JWTs
 */
function getKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is required')
  }
  return encodeSecret(secret)
}

/**
 * The secret in force before the last rotation, if any. Only guest tokens
 * honour it (NextAuth sessions are cut hard). Empty or unset means none.
 */
function getPreviousKey(): Uint8Array | null {
  // Trimmed: a stray space in the env must not become a 1-byte HMAC key
  const previous = process.env.AUTH_SECRET_PREVIOUS?.trim()
  if (!previous || previous === process.env.AUTH_SECRET) return null
  return encodeSecret(previous)
}

/**
 * Create a signed guest token (JWT)
 *
 * @param sid - Stable session ID (UUID or similar)
 * @param maxAgeSec - Token expiration in seconds (default: 30 days)
 * @returns Signed JWT string
 */
export async function createGuestToken(
  sid: string,
  maxAgeSec = 60 * 60 * 24 * 30 // 30 days
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  return await new SignJWT({ typ: 'guest', sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + maxAgeSec)
    .sign(getKey())
}

export interface VerifiedGuestToken {
  sid: string
  iat: number
  exp: number
  /** Signed with AUTH_SECRET_PREVIOUS: valid, but re-issue it with the current secret. */
  stale: boolean
}

async function verifyWithKey(token: string, key: Uint8Array) {
  const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] })
  if (payload.typ !== 'guest' || typeof payload.sid !== 'string') {
    throw new Error('Invalid guest token payload')
  }
  return {
    sid: payload.sid as string,
    iat: payload.iat as number,
    exp: payload.exp as number,
  }
}

/**
 * Verify and decode a guest token
 *
 * Accepts a token signed with AUTH_SECRET, or (when AUTH_SECRET_PREVIOUS is
 * set) with the previous secret, in which case the result is marked stale so
 * the caller can re-issue it for the same sid.
 *
 * @param token - JWT string from cookie
 * @returns Decoded payload with sid, iat, exp, stale
 * @throws Error if token is invalid or expired
 */
export async function verifyGuestToken(token: string): Promise<VerifiedGuestToken> {
  const key = getKey()
  try {
    return { ...(await verifyWithKey(token, key)), stale: false }
  } catch (error) {
    const previousKey = getPreviousKey()
    if (previousKey) {
      try {
        return { ...(await verifyWithKey(token, previousKey)), stale: true }
      } catch {
        // Report the failure against the current secret below.
      }
    }
    throw new Error(`Guest token verification failed: ${error}`)
  }
}
