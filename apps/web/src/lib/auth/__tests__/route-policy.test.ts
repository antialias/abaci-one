// @vitest-environment node
/**
 * Route-RBAC policy pins. The enforcer is deny-by-default, and route handlers
 * unit-test with withAuth mocked out — so a missing policy rule ships silently
 * and every real request 401s (exactly how the abacus print proxy shipped
 * unreachable). These pins hit the real enforcer.
 */
import { describe, expect, it } from 'vitest'
import { getRouteEnforcer } from '../enforcer'

describe('route RBAC policy', () => {
  it('guests reach the abacus print proxy family', async () => {
    const enforcer = await getRouteEnforcer()
    for (const [path, method] of [
      ['/api/abacus/print/connections', 'GET'],
      ['/api/abacus/print/connections', 'POST'],
      ['/api/abacus/print/printers', 'GET'],
      ['/api/abacus/print/jobs', 'GET'],
      ['/api/abacus/print/capabilities', 'GET'],
      ['/api/abacus/print/settings', 'PUT'],
    ] as const) {
      expect(await enforcer.enforce('guest', path, method), `${method} ${path}`).toBe(true)
    }
  })

  it('guests reach the player abacus-identity routes', async () => {
    const enforcer = await getRouteEnforcer()
    expect(await enforcer.enforce('guest', '/api/players/p1/abacus-identity', 'GET')).toBe(true)
    expect(await enforcer.enforce('guest', '/api/players/p1/abacus-identity', 'PUT')).toBe(true)
  })

  it('guests reach the design snapshot + sharing routes', async () => {
    const enforcer = await getRouteEnforcer()
    for (const [path, method] of [
      ['/api/abacus/designs', 'POST'],
      // the caller's design list — #24's shared ledger grown into "my abacuses"
      // (#11). Its own line because the POST rule is verb-scoped: GET on the
      // collection is genuinely uncovered without it, which would 401 the only
      // route back to a design you shared and edited past.
      ['/api/abacus/designs', 'GET'],
      ['/api/abacus/designs/abc123', 'GET'],
      // renaming / un-listing a design (#11) — same trap, second time: the GET
      // rule one line up is verb-scoped, so PATCH is genuinely uncovered
      // without a rule of its own.
      ['/api/abacus/designs/abc123', 'PATCH'],
      // the mid-path wildcard (#24) — this is the pin: keyMatch2 has to expand
      // designs/*/share, and a missing rule 401s in prod but never in a unit
      // test, because handler tests mock withAuth away.
      ['/api/abacus/designs/abc123/share', 'GET'],
      ['/api/abacus/designs/abc123/share', 'POST'],
      ['/api/abacus/designs/abc123/share', 'DELETE'],
    ] as const) {
      expect(await enforcer.enforce('guest', path, method), `${method} ${path}`).toBe(true)
    }
  })

  it('stays deny-by-default elsewhere', async () => {
    const enforcer = await getRouteEnforcer()
    expect(await enforcer.enforce('guest', '/api/admin/subscriptions', 'GET')).toBe(false)
    expect(await enforcer.enforce('user', '/api/admin/subscriptions', 'GET')).toBe(false)
    expect(await enforcer.enforce('guest', '/api/no-such-route', 'GET')).toBe(false)
  })
})
