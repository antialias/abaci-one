/**
 * @vitest-environment node
 */

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { GUEST_COOKIE_NAME, verifyGuestToken } from '../src/lib/guest-token'
import { middleware } from '../src/middleware'

describe('Middleware E2E', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = 'test-secret-for-middleware'
  })

  it('sets guest cookie on first request', async () => {
    const req = new NextRequest('http://localhost:3000/')
    const res = await middleware(req)

    const cookie = res.cookies.get(GUEST_COOKIE_NAME)

    expect(cookie).toBeDefined()
    expect(cookie?.value).toBeDefined()
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite).toBe('lax')
    expect(cookie?.path).toBe('/')
  })

  it('creates valid guest token', async () => {
    const req = new NextRequest('http://localhost:3000/')
    const res = await middleware(req)

    const cookie = res.cookies.get(GUEST_COOKIE_NAME)
    expect(cookie).toBeDefined()

    // Verify the token is valid
    const verified = await verifyGuestToken(cookie!.value)
    expect(verified.sid).toBeDefined()
    expect(typeof verified.sid).toBe('string')
  })

  it('preserves existing guest cookie', async () => {
    // First request - creates cookie
    const req1 = new NextRequest('http://localhost:3000/')
    const res1 = await middleware(req1)
    const cookie1 = res1.cookies.get(GUEST_COOKIE_NAME)

    // Second request - with existing cookie
    const req2 = new NextRequest('http://localhost:3000/')
    req2.cookies.set(GUEST_COOKIE_NAME, cookie1!.value)
    const res2 = await middleware(req2)

    const cookie2 = res2.cookies.get(GUEST_COOKIE_NAME)

    // Cookie should not be set again (preserves existing)
    expect(cookie2).toBeUndefined()
  })

  it('sets different guest IDs for different visitors', async () => {
    const req1 = new NextRequest('http://localhost:3000/')
    const req2 = new NextRequest('http://localhost:3000/')

    const res1 = await middleware(req1)
    const res2 = await middleware(req2)

    const cookie1 = res1.cookies.get(GUEST_COOKIE_NAME)
    const cookie2 = res2.cookies.get(GUEST_COOKIE_NAME)

    const verified1 = await verifyGuestToken(cookie1!.value)
    const verified2 = await verifyGuestToken(cookie2!.value)

    // Different visitors get different guest IDs
    expect(verified1.sid).not.toBe(verified2.sid)
  })

  it('sets secure flag in production', async () => {
    const originalEnv = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      configurable: true,
    })

    const req = new NextRequest('http://localhost:3000/')
    const res = await middleware(req)

    const cookie = res.cookies.get(GUEST_COOKIE_NAME)
    expect(cookie?.secure).toBe(true)

    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      configurable: true,
    })
  })

  it('does not set secure flag in development', async () => {
    const originalEnv = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      configurable: true,
    })

    const req = new NextRequest('http://localhost:3000/')
    const res = await middleware(req)

    const cookie = res.cookies.get(GUEST_COOKIE_NAME)
    expect(cookie?.secure).toBe(false)

    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      configurable: true,
    })
  })

  it('sets maxAge correctly', async () => {
    const req = new NextRequest('http://localhost:3000/')
    const res = await middleware(req)

    const cookie = res.cookies.get(GUEST_COOKIE_NAME)
    expect(cookie?.maxAge).toBe(60 * 60 * 24 * 30) // 30 days
  })

  it('runs on valid paths', async () => {
    const paths = [
      'http://localhost:3000/',
      'http://localhost:3000/games',
      'http://localhost:3000/tutorial-editor',
      'http://localhost:3000/some/deep/path',
    ]

    for (const path of paths) {
      const req = new NextRequest(path)
      const res = await middleware(req)
      const cookie = res.cookies.get(GUEST_COOKIE_NAME)
      expect(cookie).toBeDefined()
    }
  })
})
