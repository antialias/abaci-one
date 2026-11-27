/**
 * @vitest-environment node
 *
 * Rotating AUTH_SECRET is a hard cut for NextAuth sessions: a session cookie
 * encoded with the old secret is not a session any more, even while
 * AUTH_SECRET_PREVIOUS (guest tokens only) holds that old secret. Exercised
 * through the app's own NextAuth config (src/auth.ts) and its session
 * endpoint, which decodes the cookie the way auth() does.
 */

import { encode } from '@auth/core/jwt'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', () => ({ db: {}, schema: { users: {} } }))
// Stubs to pass config assertions; a JWT session read touches none of them.
vi.mock('@/lib/auth/adapter', () => ({
  abacisAdapter: {
    createVerificationToken: vi.fn(),
    useVerificationToken: vi.fn(),
    getUserByEmail: vi.fn(),
  },
}))
vi.mock('@/lib/auth/mergeGuestIntoUser', () => ({ mergeGuestIntoUser: vi.fn() }))
vi.mock('@/lib/auth/upgradeGuestToUser', () => ({ upgradeGuestToUser: vi.fn() }))

const OLD = 'made-up-old-secret-for-session-tests-00001'
const NEW = 'made-up-new-secret-for-session-tests-00002'
const COOKIE = 'authjs.session-token' // http: the salt is the cookie name

async function sessionFor(secret: string) {
  const token = await encode({
    token: { sub: 'user-123', name: 'Someone', email: 'someone@example.com', role: 'user' },
    secret,
    salt: COOKIE,
  })
  // Fresh module per call: NextAuth reads the env when the config is built.
  vi.resetModules()
  const { handlers } = await import('@/auth')
  const res = await handlers.GET(
    new NextRequest('http://localhost:3000/api/auth/session', {
      headers: { cookie: `${COOKIE}=${token}` },
    })
  )
  expect(res.status).toBe(200)
  return res.json()
}

describe('NextAuth session across an AUTH_SECRET rotation', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_SECRET', NEW)
    vi.stubEnv('AUTH_URL', 'http://localhost:3000/api/auth')
    vi.stubEnv('EMAIL_SERVER', 'smtp://user:pass@localhost:2525') // config needs one; never used
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('accepts a session encoded with the current secret (control)', async () => {
    const session = await sessionFor(NEW)
    expect(session?.user?.id).toBe('user-123')
  })

  it('rejects a session encoded with the old secret', async () => {
    expect(await sessionFor(OLD)).toBeNull()
  })

  it('still rejects it while AUTH_SECRET_PREVIOUS holds the old secret', async () => {
    vi.stubEnv('AUTH_SECRET_PREVIOUS', OLD)
    expect(await sessionFor(OLD)).toBeNull()
  })
})
