/**
 * @vitest-environment node
 *
 * The middleware's part in guest identity: it re-signs a guest cookie made
 * with the previous AUTH_SECRET (same sid), forwards only a signed token to
 * server components, and drops any guest header a client sent.
 */

import { SignJWT } from 'jose'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GUEST_COOKIE_NAME, GUEST_TOKEN_HEADER, verifyGuestToken } from '../src/lib/guest-token'
import { middleware } from '../src/middleware'

const OLD = 'made-up-old-secret-for-middleware-tests-01'
const NEW = 'made-up-new-secret-for-middleware-tests-02'

async function oldGuestToken(sid: string) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ typ: 'guest', sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(new TextEncoder().encode(OLD))
}

/** A request header the middleware handed on to the route (Next's override protocol). */
function forwarded(res: Response, name: string): string | null {
  return res.headers.get(`x-middleware-request-${name}`)
}

describe('middleware guest identity', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_SECRET', NEW)
    vi.stubEnv('AUTH_SECRET_PREVIOUS', OLD)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('re-issues a guest cookie signed with the previous secret, for the same sid', async () => {
    const req = new NextRequest('http://localhost:3000/practice')
    req.cookies.set(GUEST_COOKIE_NAME, await oldGuestToken('sid-before-rotation'))

    const res = await middleware(req)
    const reissued = res.cookies.get(GUEST_COOKIE_NAME)
    expect(reissued?.value).toBeTruthy()
    expect(reissued?.httpOnly).toBe(true)
    expect(reissued?.maxAge).toBe(60 * 60 * 24 * 30)

    // Once the previous secret is retired, the re-issued cookie still holds.
    vi.stubEnv('AUTH_SECRET_PREVIOUS', '')
    await expect(verifyGuestToken(reissued!.value)).resolves.toMatchObject({
      sid: 'sid-before-rotation',
      stale: false,
    })

    // This request's server components see the same guest.
    const token = forwarded(res, GUEST_TOKEN_HEADER)
    expect(token).toBe(reissued!.value)
  })

  it('leaves a current guest cookie alone and forwards it', async () => {
    const first = await middleware(new NextRequest('http://localhost:3000/'))
    const cookie = first.cookies.get(GUEST_COOKIE_NAME)!.value
    expect(forwarded(first, GUEST_TOKEN_HEADER)).toBe(cookie)

    const req = new NextRequest('http://localhost:3000/practice')
    req.cookies.set(GUEST_COOKIE_NAME, cookie)
    const res = await middleware(req)
    expect(res.cookies.get(GUEST_COOKIE_NAME)).toBeUndefined()
    expect(forwarded(res, GUEST_TOKEN_HEADER)).toBe(cookie)
  })

  it('drops client-sent guest headers', async () => {
    const spoof = {
      'x-guest-id': 'victim-sid',
      [GUEST_TOKEN_HEADER]: 'forged.token.value',
    }

    // Guest request: the forwarded token is the middleware's own, not the client's.
    const guest = await middleware(new NextRequest('http://localhost:3000/', { headers: spoof }))
    expect(forwarded(guest, 'x-guest-id')).toBeNull()
    const token = forwarded(guest, GUEST_TOKEN_HEADER)
    expect(token).not.toBe('forged.token.value')
    expect((await verifyGuestToken(token!)).sid).not.toBe('victim-sid')

    // Request with a session cookie (valid or not): no guest header at all.
    const signedIn = new NextRequest('http://localhost:3000/practice', { headers: spoof })
    signedIn.cookies.set('authjs.session-token', 'whatever')
    const res = await middleware(signedIn)
    expect(forwarded(res, 'x-guest-id')).toBeNull()
    expect(forwarded(res, GUEST_TOKEN_HEADER)).toBeNull()
    const overridden = (res.headers.get('x-middleware-override-headers') ?? '').split(',')
    expect(overridden).not.toContain('x-guest-id')
    expect(overridden).not.toContain(GUEST_TOKEN_HEADER)
  })
})
