// @vitest-environment node
/**
 * withAuth must fail CLOSED when route enforcement itself breaks: a throwing
 * enforcer means the RBAC layer is gone, and proceeding would silently serve
 * every withAuth route without it (how it behaved until 2026-08).
 */
import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }))
const enforce = vi.fn()
vi.mock('../enforcer', () => ({ getRouteEnforcer: vi.fn(async () => ({ enforce })) }))

import { getRouteEnforcer } from '../enforcer'
import { withAuth } from '../withAuth'

const request = () => new NextRequest('https://abaci.one/api/example', { method: 'GET' })

describe('withAuth enforcement failures', () => {
  beforeEach(() => {
    vi.mocked(getRouteEnforcer).mockClear()
    enforce.mockReset()
  })

  it('passes through when the enforcer allows', async () => {
    enforce.mockResolvedValue(true)
    const handler = vi.fn(async () => NextResponse.json({ ok: true }))
    const res = await withAuth(handler)(request())
    expect(res.status).toBe(200)
    expect(handler).toHaveBeenCalled()
  })

  it('fails closed with 503 when the enforcer cannot be constructed', async () => {
    vi.mocked(getRouteEnforcer).mockRejectedValueOnce(new Error('policy load failed'))
    const handler = vi.fn()
    const res = await withAuth(handler)(request())
    expect(res.status).toBe(503)
    expect(handler).not.toHaveBeenCalled()
  })

  it('fails closed with 503 when enforcement itself throws', async () => {
    enforce.mockRejectedValue(new Error('matcher exploded'))
    const handler = vi.fn()
    const res = await withAuth(handler)(request())
    expect(res.status).toBe(503)
    expect(handler).not.toHaveBeenCalled()
  })
})
