/**
 * @vitest-environment node
 *
 * Guest tokens across an AUTH_SECRET rotation: a token signed with
 * AUTH_SECRET_PREVIOUS stays valid (marked stale, so it gets re-issued), and
 * nothing else signed with the previous secret gets through.
 */

import { SignJWT } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGuestToken, verifyGuestToken } from '../guest-token'

const OLD = 'made-up-old-secret-for-rotation-tests-0001'
const NEW = 'made-up-new-secret-for-rotation-tests-0002'

async function signWith(secret: string, payload: Record<string, unknown>) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(new TextEncoder().encode(secret))
}

describe('verifyGuestToken across a secret rotation', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_SECRET', NEW)
    vi.stubEnv('AUTH_SECRET_PREVIOUS', '')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('accepts a token signed with the current secret, not stale', async () => {
    const token = await createGuestToken('sid-current')
    await expect(verifyGuestToken(token)).resolves.toMatchObject({
      sid: 'sid-current',
      stale: false,
    })
  })

  it('accepts a token signed with the previous secret when it is set, marked stale', async () => {
    vi.stubEnv('AUTH_SECRET_PREVIOUS', OLD)
    const token = await signWith(OLD, { typ: 'guest', sid: 'sid-old' })
    await expect(verifyGuestToken(token)).resolves.toMatchObject({
      sid: 'sid-old',
      stale: true,
    })
  })

  it('rejects a previous-secret token when AUTH_SECRET_PREVIOUS is unset', async () => {
    delete process.env.AUTH_SECRET_PREVIOUS
    const token = await signWith(OLD, { typ: 'guest', sid: 'sid-old' })
    await expect(verifyGuestToken(token)).rejects.toThrow()
  })

  it('treats an empty AUTH_SECRET_PREVIOUS as no previous secret', async () => {
    // Terraform's default is "" (set in beforeEach): it means "none".
    const oldToken = await signWith(OLD, { typ: 'guest', sid: 'sid-old' })
    await expect(verifyGuestToken(oldToken)).rejects.toThrow()
    await expect(verifyGuestToken(await createGuestToken('sid-new'))).resolves.toMatchObject({
      stale: false,
    })
  })

  it('treats a whitespace-only AUTH_SECRET_PREVIOUS as no previous secret', async () => {
    // Untrimmed, "  " would be a 2-byte HMAC key anyone could sign with
    vi.stubEnv('AUTH_SECRET_PREVIOUS', '  ')
    const token = await signWith('  ', { typ: 'guest', sid: 'sid-blank' })
    await expect(verifyGuestToken(token)).rejects.toThrow()
  })

  it('rejects a non-guest payload signed with the previous secret', async () => {
    vi.stubEnv('AUTH_SECRET_PREVIOUS', OLD)
    const notGuest = await signWith(OLD, { typ: 'admin', sid: 'sid-old' })
    const noSid = await signWith(OLD, { typ: 'guest' })
    await expect(verifyGuestToken(notGuest)).rejects.toThrow()
    await expect(verifyGuestToken(noSid)).rejects.toThrow()
  })

  it('rejects tampered and garbage tokens even with a previous secret set', async () => {
    vi.stubEnv('AUTH_SECRET_PREVIOUS', OLD)
    const good = await signWith(OLD, { typ: 'guest', sid: 'sid-old' })
    const [header, , sig] = good.split('.')
    const forgedBody = Buffer.from(JSON.stringify({ typ: 'guest', sid: 'victim' })).toString(
      'base64url'
    )
    await expect(verifyGuestToken(`${header}.${forgedBody}.${sig}`)).rejects.toThrow()
    await expect(verifyGuestToken('not-a-jwt')).rejects.toThrow()
    await expect(verifyGuestToken('')).rejects.toThrow()
    await expect(
      verifyGuestToken(await signWith('some-third-secret-nobody-has', { typ: 'guest', sid: 'x' }))
    ).rejects.toThrow()
  })

  it('rejects an unsigned (alg none) token', async () => {
    vi.stubEnv('AUTH_SECRET_PREVIOUS', OLD)
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ typ: 'guest', sid: 'victim' })}.`
    await expect(verifyGuestToken(unsigned)).rejects.toThrow()
  })
})
