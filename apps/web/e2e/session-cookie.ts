/**
 * NextAuth v5 session cookies for e2e: the local AUTH_SECRET (from
 * `.env.local`) and a minted session JWT, as NextAuth itself writes it.
 * `auth.setup.ts` mints the admin's; socket tests mint other users'.
 * Never log what these return.
 */

import { hkdfSync } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { EncryptJWT } from 'jose'

/** The admin's user id in the local dev database. */
export const LOCAL_ADMIN_USER_ID = 'g1c8pkb2fa4qiv5qc46m4js9'

/**
 * Read AUTH_SECRET from .env.local (grep-style to avoid bash multiline issues).
 */
export function getLocalAuthSecret(): string {
  const envPath = resolve(__dirname, '../.env.local')
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('AUTH_SECRET=')) {
      let value = trimmed.slice('AUTH_SECRET='.length)
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      return value
    }
  }
  throw new Error('AUTH_SECRET not found in .env.local')
}

/**
 * Mint an encrypted NextAuth v5 JWT.
 *
 * Uses the same encryption as NextAuth: HKDF-SHA256 key derivation with
 * A256CBC-HS512 encryption. The HKDF info string includes the cookie name,
 * which differs between HTTP and HTTPS environments.
 */
export async function mintSessionJWT(
  secret: string,
  cookieName: string,
  userId: string,
  profile: { name: string; email: string | null }
): Promise<string> {
  const info = `Auth.js Generated Encryption Key (${cookieName})`
  // Node's built-in HKDF (RFC 5869) — drop-in for @panva/hkdf with the same
  // arg order and output bytes. Avoids importing @panva/hkdf, which is only a
  // transitive (phantom) dep here and won't resolve under strict pnpm.
  const key = hkdfSync('sha256', secret, cookieName, info, 64)

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    ...profile,
    picture: null,
    sub: userId,
    iat: now,
    exp: now + 86400,
  }

  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256CBC-HS512' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .encrypt(new Uint8Array(key))
}

/** The admin's session JWT (the e2e storage state's sign-in). */
export function mintAdminJWT(secret: string, cookieName: string, userId: string): Promise<string> {
  return mintSessionJWT(secret, cookieName, userId, {
    name: 'Test Admin',
    email: 'hallock@gmail.com',
  })
}
