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
 * Get the secret key for signing/verifying JWTs
 */
function getKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is required')
  }
  return new TextEncoder().encode(secret)
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

/**
 * Verify and decode a guest token
 *
 * @param token - JWT string from cookie
 * @returns Decoded payload with sid, iat, exp
 * @throws Error if token is invalid or expired
 */
export async function verifyGuestToken(token: string): Promise<{
  sid: string
  iat: number
  exp: number
}> {
  try {
    const { payload } = await jwtVerify(token, getKey())

    if (payload.typ !== 'guest' || typeof payload.sid !== 'string') {
      throw new Error('Invalid guest token payload')
    }

    return {
      sid: payload.sid as string,
      iat: payload.iat as number,
      exp: payload.exp as number,
    }
  } catch (error) {
    throw new Error(`Guest token verification failed: ${error}`)
  }
}
