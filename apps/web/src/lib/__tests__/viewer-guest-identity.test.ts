/**
 * @vitest-environment node
 *
 * getViewer's guest identity, with the real token code. A client-set
 * `x-guest-id` (API routes skip the middleware, so nothing strips it there)
 * must not name the guest; only a verified token does: the cookie on API
 * routes, or the token the middleware forwards on page requests.
 */

import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let requestHeaders = new Headers()
let requestCookies = new Map<string, string>()

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => requestHeaders),
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      requestCookies.has(name) ? { name, value: requestCookies.get(name) } : undefined,
  })),
}))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
vi.mock('@/db', () => ({ db: {}, schema: { users: {} } }))

import { middleware } from '../../middleware'
import { createGuestToken, GUEST_COOKIE_NAME, GUEST_TOKEN_HEADER } from '../guest-token'
import { getViewer } from '../viewer'

/** Load the request a route handler would see. */
function asRequest(headers: Record<string, string>, cookies: Record<string, string> = {}) {
  requestHeaders = new Headers(headers)
  requestCookies = new Map(Object.entries(cookies))
}

describe('getViewer guest identity', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_SECRET', 'made-up-secret-for-viewer-tests-000001')
    vi.stubEnv('AUTH_SECRET_PREVIOUS', '')
    asRequest({})
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('ignores a client-set x-guest-id on an API request with no cookie', async () => {
    asRequest({ 'x-guest-id': 'victim-sid' })
    expect(await getViewer()).toEqual({ kind: 'unknown' })
  })

  it('takes the guest from the verified cookie, not a client-set x-guest-id', async () => {
    const cookie = await createGuestToken('my-own-sid')
    asRequest({ 'x-guest-id': 'victim-sid' }, { [GUEST_COOKIE_NAME]: cookie })
    expect(await getViewer()).toEqual({ kind: 'guest', guestId: 'my-own-sid' })
  })

  it('ignores a forged forwarded token', async () => {
    asRequest({ [GUEST_TOKEN_HEADER]: 'forged.token.value' })
    expect(await getViewer()).toEqual({ kind: 'unknown' })
  })

  it('a guest API call (cookie only, as fetch sends it) is that guest', async () => {
    const cookie = await createGuestToken('guest-api-sid')
    asRequest({}, { [GUEST_COOKIE_NAME]: cookie })
    expect(await getViewer()).toEqual({ kind: 'guest', guestId: 'guest-api-sid' })
  })

  it('a first page visit sees the guest the middleware just minted', async () => {
    // No cookie yet: the middleware mints one and forwards its token.
    const res = await middleware(new NextRequest('http://localhost:3000/practice'))
    const minted = res.cookies.get(GUEST_COOKIE_NAME)!.value
    const token = res.headers.get(`x-middleware-request-${GUEST_TOKEN_HEADER}`)!
    asRequest({ [GUEST_TOKEN_HEADER]: token })

    const viewer = await getViewer()
    expect(viewer.kind).toBe('guest')

    // ...the same guest the browser's new cookie names on its next API call.
    asRequest({}, { [GUEST_COOKIE_NAME]: minted })
    expect(await getViewer()).toEqual(viewer)
  })
})
