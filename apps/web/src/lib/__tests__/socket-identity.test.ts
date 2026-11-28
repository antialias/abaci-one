/**
 * @vitest-environment node
 *
 * The socket handshake's viewer (`resolveSocketViewer`): the identity the
 * HTTP side gives the same browser, read from real cookies. A NextAuth
 * session cookie made by NextAuth's own `encode` (plain, `__Secure-` and
 * chunked; only the one name `auth()` would read: by AUTH_URL, else the
 * request's protocol), a signed guest cookie (mapped to its `users` row, created on
 * first sight, the same row `getUserId()` uses), both, none, tampered,
 * expired, and no secret. It never throws.
 */

import { SignJWT } from 'jose'
import { encode } from 'next-auth/jwt'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import { createGuestToken, GUEST_COOKIE_NAME } from '@/lib/guest-token'
import { resolveSocketViewer, sessionCookieIsSecure } from '@/lib/socket-identity'
import {
  createEphemeralDatabase,
  type EphemeralDbResult,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
} from '@/test/journey-simulator/EphemeralDatabase'

vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))

const SECRET = 'made-up-secret-for-socket-identity-tests-0001'
const OLD = 'made-up-old-secret-for-socket-identity-tests-02'
const PLAIN = 'authjs.session-token'
const SECURE = '__Secure-authjs.session-token'

/** A session cookie value exactly as NextAuth writes it (salt = cookie name). */
async function sessionToken(
  sub: string,
  {
    name = PLAIN,
    secret = SECRET,
    maxAge,
  }: { name?: string; secret?: string; maxAge?: number } = {}
) {
  return encode({ token: { sub, name: 'Test' }, secret, salt: name, maxAge })
}

async function signGuest(secret: string, sid: string) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ typ: 'guest', sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(new TextEncoder().encode(secret))
}

const cookies = (pairs: Record<string, string>) =>
  Object.entries(pairs)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')

async function guestRow(guestId: string) {
  return getCurrentEphemeralDb().query.users.findFirst({
    where: (u, { eq }) => eq(u.guestId, guestId),
  })
}

describe('resolveSocketViewer', () => {
  let eph: EphemeralDbResult

  beforeEach(() => {
    eph = createEphemeralDatabase()
    setCurrentEphemeralDb(eph.db)
    vi.stubEnv('AUTH_SECRET', SECRET)
    vi.stubEnv('AUTH_SECRET_PREVIOUS', '')
    vi.stubEnv('NEXTAUTH_SECRET', '')
    // No env URL unless a test sets one: the handshake's protocol decides
    vi.stubEnv('AUTH_URL', '')
    delete process.env.AUTH_URL
    vi.stubEnv('NEXTAUTH_URL', '')
    delete process.env.NEXTAUTH_URL
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    setCurrentEphemeralDb(null)
    eph.cleanup()
  })

  it('a session cookie made by NextAuth is that user', async () => {
    const token = await sessionToken('user-1')
    await expect(resolveSocketViewer({ cookie: cookies({ [PLAIN]: token }) })).resolves.toEqual({
      kind: 'user',
      userId: 'user-1',
    })
  })

  describe('reads the one session cookie auth() would: by the request protocol', () => {
    const user = (userId: string) => ({ kind: 'user', userId })
    const anonymous = { kind: 'anonymous' }
    async function both() {
      return {
        plain: cookies({ [PLAIN]: await sessionToken('user-plain') }),
        secure: cookies({ [SECURE]: await sessionToken('user-secure', { name: SECURE }) }),
      }
    }

    it('local dev and the e2e build (http, no AUTH_URL): the plain cookie only', async () => {
      const { plain, secure } = await both()
      await expect(resolveSocketViewer({ cookie: plain })).resolves.toEqual(user('user-plain'))
      await expect(resolveSocketViewer({ cookie: secure })).resolves.toEqual(anonymous)
    })

    it('prod (AUTH_URL https, behind the https proxy): the __Secure- cookie only', async () => {
      vi.stubEnv('AUTH_URL', 'https://abaci.example')
      const { plain, secure } = await both()
      // Whatever the proxy forwards: the env URL decides, as in createActionURL
      for (const proto of [undefined, 'https', 'http']) {
        const fwd = proto ? { 'x-forwarded-proto': proto } : {}
        await expect(resolveSocketViewer({ cookie: secure, ...fwd })).resolves.toEqual(
          user('user-secure')
        )
        await expect(resolveSocketViewer({ cookie: plain, ...fwd })).resolves.toEqual(anonymous)
      }
    })

    it('an http AUTH_URL reads the plain cookie even behind an https proxy', async () => {
      vi.stubEnv('AUTH_URL', 'http://localhost:3022')
      const { plain, secure } = await both()
      const fwd = { 'x-forwarded-proto': 'https' }
      await expect(resolveSocketViewer({ cookie: plain, ...fwd })).resolves.toEqual(
        user('user-plain')
      )
      await expect(resolveSocketViewer({ cookie: secure, ...fwd })).resolves.toEqual(anonymous)
    })

    it('NEXTAUTH_URL counts when AUTH_URL is unset', async () => {
      delete process.env.AUTH_URL
      vi.stubEnv('NEXTAUTH_URL', 'https://abaci.example')
      const { plain, secure } = await both()
      await expect(resolveSocketViewer({ cookie: secure })).resolves.toEqual(user('user-secure'))
      await expect(resolveSocketViewer({ cookie: plain })).resolves.toEqual(anonymous)
    })

    it('no env URL: x-forwarded-proto, else the connection TLS', async () => {
      const { plain, secure } = await both()
      const https = { 'x-forwarded-proto': 'https' }
      await expect(resolveSocketViewer({ cookie: secure, ...https })).resolves.toEqual(
        user('user-secure')
      )
      await expect(resolveSocketViewer({ cookie: plain, ...https })).resolves.toEqual(anonymous)
      await expect(resolveSocketViewer({ cookie: secure }, { encrypted: true })).resolves.toEqual(
        user('user-secure')
      )
      // A proxy's http wins over the connection, as Next keeps it
      await expect(
        resolveSocketViewer({ cookie: plain, 'x-forwarded-proto': 'http' }, { encrypted: true })
      ).resolves.toEqual(user('user-plain'))
    })

    it('an AUTH_URL that does not parse is no session (auth() throws on it)', async () => {
      vi.stubEnv('AUTH_URL', 'not a url')
      const { plain, secure } = await both()
      await expect(resolveSocketViewer({ cookie: plain })).resolves.toEqual(anonymous)
      await expect(resolveSocketViewer({ cookie: secure })).resolves.toEqual(anonymous)
    })

    it('matches sessionCookieIsSecure', () => {
      expect(sessionCookieIsSecure({})).toBe(false)
      expect(sessionCookieIsSecure({ 'x-forwarded-proto': 'https' })).toBe(true)
      expect(sessionCookieIsSecure({ 'x-forwarded-proto': ['https'] })).toBe(true)
      expect(sessionCookieIsSecure({}, { encrypted: true })).toBe(true)
    })
  })

  it('joins a chunked session cookie', async () => {
    const token = await sessionToken('user-chunked')
    const cut = Math.floor(token.length / 2)
    const cookie = cookies({
      [`${PLAIN}.1`]: token.slice(cut),
      [`${PLAIN}.0`]: token.slice(0, cut),
    })
    await expect(resolveSocketViewer({ cookie })).resolves.toEqual({
      kind: 'user',
      userId: 'user-chunked',
    })
  })

  it('a guest cookie is the guest, mapped to its users row (created once)', async () => {
    const token = await createGuestToken('sid-guest')
    const cookie = cookies({ [GUEST_COOKIE_NAME]: token })
    const first = await resolveSocketViewer({ cookie })
    const row = await guestRow('sid-guest')
    expect(row).toBeDefined()
    expect(first).toEqual({ kind: 'guest', userId: row!.id })
    // Several sockets of one page handshake at once: one row, one id
    const again = await Promise.all([1, 2, 3].map(() => resolveSocketViewer({ cookie })))
    expect(again).toEqual([first, first, first])
    const rows = await getCurrentEphemeralDb().query.users.findMany({
      where: (u, { eq }) => eq(u.guestId, 'sid-guest'),
    })
    expect(rows).toHaveLength(1)
  })

  it('a guest who already has a users row gets that id', async () => {
    await getCurrentEphemeralDb()
      .insert(schema.users)
      .values({ id: 'existing-guest-user', guestId: 'sid-known' })
    const cookie = cookies({ [GUEST_COOKIE_NAME]: await createGuestToken('sid-known') })
    await expect(resolveSocketViewer({ cookie })).resolves.toEqual({
      kind: 'guest',
      userId: 'existing-guest-user',
    })
  })

  it('a guest token signed with AUTH_SECRET_PREVIOUS still counts (as on HTTP)', async () => {
    vi.stubEnv('AUTH_SECRET_PREVIOUS', OLD)
    const cookie = cookies({ [GUEST_COOKIE_NAME]: await signGuest(OLD, 'sid-rotated') })
    const viewer = await resolveSocketViewer({ cookie })
    expect(viewer.kind).toBe('guest')
  })

  it('a session cookie signed with AUTH_SECRET_PREVIOUS does not (sessions are cut hard)', async () => {
    vi.stubEnv('AUTH_SECRET_PREVIOUS', OLD)
    const token = await sessionToken('user-old', { secret: OLD })
    await expect(resolveSocketViewer({ cookie: cookies({ [PLAIN]: token }) })).resolves.toEqual({
      kind: 'anonymous',
    })
  })

  it('a session wins over a guest cookie (as in getViewer)', async () => {
    const cookie = cookies({
      [GUEST_COOKIE_NAME]: await createGuestToken('sid-both'),
      [PLAIN]: await sessionToken('user-both'),
    })
    await expect(resolveSocketViewer({ cookie })).resolves.toEqual({
      kind: 'user',
      userId: 'user-both',
    })
    expect(await guestRow('sid-both')).toBeUndefined()
  })

  it('no cookie, or no header at all, is anonymous', async () => {
    await expect(resolveSocketViewer({})).resolves.toEqual({ kind: 'anonymous' })
    await expect(resolveSocketViewer({ cookie: 'theme=dark' })).resolves.toEqual({
      kind: 'anonymous',
    })
  })

  it('a tampered session or guest cookie is anonymous', async () => {
    const session = await sessionToken('user-tampered')
    const guest = await createGuestToken('sid-tampered')
    const flip = (t: string) => `${t.slice(0, -4)}${t.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA'}`
    await expect(
      resolveSocketViewer({ cookie: cookies({ [PLAIN]: flip(session) }) })
    ).resolves.toEqual({ kind: 'anonymous' })
    await expect(
      resolveSocketViewer({ cookie: cookies({ [GUEST_COOKIE_NAME]: flip(guest) }) })
    ).resolves.toEqual({ kind: 'anonymous' })
    // Signed with some other secret
    const foreign = await sessionToken('user-foreign', { secret: 'some-other-secret-entirely-000' })
    await expect(resolveSocketViewer({ cookie: cookies({ [PLAIN]: foreign }) })).resolves.toEqual({
      kind: 'anonymous',
    })
    expect(await guestRow('sid-tampered')).toBeUndefined()
  })

  it('an expired session cookie is anonymous', async () => {
    const token = await sessionToken('user-expired', { maxAge: -3600 })
    await expect(resolveSocketViewer({ cookie: cookies({ [PLAIN]: token }) })).resolves.toEqual({
      kind: 'anonymous',
    })
  })

  it('a session cookie falls back to a valid guest cookie when it does not verify', async () => {
    const cookie = cookies({
      [PLAIN]: 'not-a-token',
      [GUEST_COOKIE_NAME]: await createGuestToken('sid-fallback'),
    })
    const viewer = await resolveSocketViewer({ cookie })
    expect(viewer.kind).toBe('guest')
  })

  it('no secret: everyone is anonymous, and nothing throws', async () => {
    const session = await sessionToken('user-nosecret')
    const guest = await createGuestToken('sid-nosecret')
    vi.stubEnv('AUTH_SECRET', '')
    delete process.env.AUTH_SECRET
    await expect(
      resolveSocketViewer({ cookie: cookies({ [PLAIN]: session, [GUEST_COOKIE_NAME]: guest }) })
    ).resolves.toEqual({ kind: 'anonymous' })
  })

  it('reads only the cookie: a Bearer header is not a session (auth() ignores it too)', async () => {
    const token = await sessionToken('user-bearer')
    await expect(
      resolveSocketViewer({ authorization: `Bearer ${encodeURIComponent(token)}` })
    ).resolves.toEqual({ kind: 'anonymous' })
  })

  it('a database failure for a guest is anonymous, not a thrown handshake', async () => {
    const cookie = cookies({ [GUEST_COOKIE_NAME]: await createGuestToken('sid-dbfail') })
    setCurrentEphemeralDb(null)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(resolveSocketViewer({ cookie })).resolves.toEqual({ kind: 'anonymous' })
    errors.mockRestore()
    setCurrentEphemeralDb(eph.db)
  })
})
