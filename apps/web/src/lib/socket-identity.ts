/**
 * The socket handshake's viewer, verified from its cookies: the same identity
 * `getViewer()` / `getUserId()` give an HTTP request from that browser.
 *
 * The socket server runs this in `io.use` for every connection (each
 * reconnect is a new handshake, so it is re-derived) and stores the result
 * in `socket.data.viewer` (`socket-viewer.ts`). It never rejects a
 * connection: a socket with neither cookie is `anonymous`. Token holders
 * (share links, remote-camera phones) are admitted by their token whatever
 * their viewer is; a phone page gets a guest cookie from the middleware like
 * any signed-out visitor, so its socket is that guest.
 *
 * - Signed in: the NextAuth session cookie (JWT strategy), decoded with
 *   `getToken` the way `auth()` reads it: the secret NextAuth uses
 *   (`AUTH_SECRET`, else `NEXTAUTH_SECRET`; sessions do not honour
 *   `AUTH_SECRET_PREVIOUS`), and the one cookie name `auth()` would read
 *   (`__Secure-authjs.session-token` on https, `authjs.session-token` on
 *   http; see `sessionCookieIsSecure`; chunked cookies are joined). Only the
 *   cookie, never an `Authorization` header, which `auth()` does not read.
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

/** What the handshake's connection itself says (not its headers). */
export interface HandshakeConnection {
  /** The connection is TLS (`socket.request.socket.encrypted`). */
  encrypted?: boolean
}

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

/**
 * Whether `auth()` would read the `__Secure-` session cookie for a request
 * with these headers: the protocol of the URL Auth.js builds for it
 * (next-auth 5.0.0-beta.29, @auth/core 0.40.0, next 14.2):
 * - `@auth/core/lib/init.js:69`: `defaultCookies(config.useSecureCookies ??
 *   url.protocol === "https:")`; our config sets no `useSecureCookies`;
 * - `@auth/core/lib/utils/env.js:66-86` (`createActionURL`, which
 *   `next-auth/lib/index.js:8-10` calls for `auth()`): `AUTH_URL ??
 *   NEXTAUTH_URL` when set, else `x-forwarded-proto ?? "https"` (with
 *   `x-forwarded-host ?? host`);
 * - `next/dist/server/base-server.js:525-529`: Next has already set
 *   `x-forwarded-proto`, keeping a proxy's value and otherwise using the
 *   connection's own TLS (`"https"` / `"http"`). The socket handshake
 *   doesn't pass through Next, so that default is applied here.
 * An env URL that doesn't parse makes `auth()` throw; here it is null (no session).
 */
export function sessionCookieIsSecure(
  headers: HandshakeHeaders,
  connection: HandshakeConnection = {}
): boolean | null {
  const envUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL
  if (envUrl) {
    try {
      return new URL(envUrl).protocol === 'https:'
    } catch {
      return null
    }
  }
  const forwarded = headers['x-forwarded-proto']
  const proto =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded) ??
    (connection.encrypted ? 'https' : 'http')
  return (proto.endsWith(':') ? proto : `${proto}:`) === 'https:'
}

/** The signed-in user's id from the NextAuth session cookie, or null. */
async function sessionUserId(
  cookie: string,
  headers: HandshakeHeaders,
  connection: HandshakeConnection
): Promise<string | null> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) return null
  const secureCookie = sessionCookieIsSecure(headers, connection)
  if (secureCookie === null) return null
  const token = await getToken({ req: { headers: { cookie } }, secret, secureCookie })
  return token && typeof token.sub === 'string' && token.sub ? token.sub : null
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
export async function resolveSocketViewer(
  headers: HandshakeHeaders,
  connection: HandshakeConnection = {}
): Promise<SocketViewer> {
  const cookie = headerValue(headers ?? {}, 'cookie')
  if (!cookie) return ANONYMOUS_VIEWER
  try {
    const userId = await sessionUserId(cookie, headers, connection)
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
