/**
 * The socket handshake's viewer, verified from its cookies: the same identity
 * `getViewer()` / `getUserId()` give an HTTP request from that browser.
 *
 * The socket server runs this in `io.use` for every connection (each
 * reconnect is a new handshake, so it is re-derived) and stores the result
 * in `socket.data.viewer` (`socket-viewer.ts`). It never rejects a
 * connection: a socket with no identity is `anonymous`, which is how
 * share-link holders and remote-camera phones connect, admitted by token.
 *
 * - Signed in: the NextAuth session cookie (JWT strategy), decoded with
 *   `getToken` exactly as `auth()` reads it: the secret NextAuth uses
 *   (`AUTH_SECRET`, else `NEXTAUTH_SECRET`; sessions do not honour
 *   `AUTH_SECRET_PREVIOUS`), the `__Secure-` cookie first, then the plain
 *   one (chunked cookies are joined), and only the cookie, never an
 *   `Authorization` header, which `auth()` does not read either.
 * - Guest: the signed guest cookie (`verifyGuestToken`, which accepts a
 *   token signed with `AUTH_SECRET_PREVIOUS`), mapped to its `users` row by
 *   the get-or-create `getUserId()` uses.
 * - A session wins over a guest cookie, as in `getViewer()`.
 *
 * The socket server is compiled to CommonJS (`tsconfig.server.json`), so
 * `next-auth/jwt` and `jose` (ESM-only) load through Node's `require(esm)`
 * (Node 20.19+ / 22.12+). `scripts/smoke-socket-identity.cjs` loads the built
 * module and resolves a real cookie, so a runtime that cannot fails the
 * build, not the boot.
 */

import type { IncomingHttpHeaders } from 'node:http'
import { getToken } from 'next-auth/jwt'
import { GUEST_COOKIE_NAME, verifyGuestToken } from './guest-token'
import { getOrCreateUserFromGuestId } from './guest-user'
import { ANONYMOUS_VIEWER, type SocketViewer } from './socket-viewer'

/** The handshake headers (`socket.request.headers`), or any header map with a cookie. */
export type HandshakeHeaders = IncomingHttpHeaders | Record<string, string | string[] | undefined>

function headerValue(headers: HandshakeHeaders, name: string): string {
  const value = headers[name]
  return Array.isArray(value) ? value.join('; ') : (value ?? '')
}

/** One cookie's value from a `Cookie` header, or undefined. */
function readCookie(cookieHeader: string, name: string): string | undefined {
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1 || part.slice(0, eq).trim() !== name) continue
    const raw = part.slice(eq + 1).trim()
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }
  return undefined
}

/** The signed-in user's id from the NextAuth session cookie, or null. */
async function sessionUserId(cookie: string): Promise<string | null> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) return null
  for (const secureCookie of [true, false]) {
    const token = await getToken({ req: { headers: { cookie } }, secret, secureCookie })
    if (token && typeof token.sub === 'string' && token.sub) return token.sub
  }
  return null
}

/** The guest's user id from the verified guest cookie, or null. */
async function guestUserId(cookie: string): Promise<string | null> {
  const token = readCookie(cookie, GUEST_COOKIE_NAME)
  if (!token) return null
  let sid: string
  try {
    ;({ sid } = await verifyGuestToken(token))
  } catch {
    return null
  }
  const user = await getOrCreateUserFromGuestId(sid)
  return user.id
}

/** The verified viewer of a socket handshake. Never throws. */
export async function resolveSocketViewer(headers: HandshakeHeaders): Promise<SocketViewer> {
  const cookie = headerValue(headers ?? {}, 'cookie')
  if (!cookie) return ANONYMOUS_VIEWER
  try {
    const userId = await sessionUserId(cookie)
    if (userId) return { kind: 'user', userId }
  } catch (error) {
    console.error('[socket-identity] session cookie check failed', error)
  }
  try {
    const userId = await guestUserId(cookie)
    if (userId) return { kind: 'guest', userId }
  } catch (error) {
    console.error('[socket-identity] guest cookie check failed', error)
  }
  return ANONYMOUS_VIEWER
}
