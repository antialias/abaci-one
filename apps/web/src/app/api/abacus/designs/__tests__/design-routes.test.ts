// @vitest-environment node
/**
 * Design-snapshot route tests (Gitea #22, extended for sharing in #24): the
 * guest-first POST with its owner-scoped content-hash dedup, and the
 * shared-or-owner-or-admin GET that answers an identical 404 for "unknown",
 * "not yours" and "not shared". Uses the in-memory-db pattern from the print
 * proxy tests; auth is mocked to a fixed user.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defaultParams } from '@/components/create/abacus/abacus-model'
import { db, schema } from '@/db'
import { getUserId } from '@/lib/viewer'

vi.mock('@/db', async () => {
  const schema = await vi.importActual<typeof import('@/db/schema')>('@/db/schema')
  const { createClient } = await import('@libsql/client')
  const { drizzle } = await import('drizzle-orm/libsql')
  const client = createClient({ url: ':memory:' })
  return { db: drizzle(client, { schema }), schema }
})

const OWNER = 'design-route-test-owner'
const STRANGER = 'design-route-test-stranger'

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: (handler: unknown) => handler,
}))
vi.mock('@/lib/viewer', () => ({
  getUserId: vi.fn(async () => 'design-route-test-owner'),
}))

import { GET as getDesign } from '../[id]/route'
import { POST as createDesign } from '../route'

function ctx(params: Record<string, string> = {}, userRole = 'user') {
  // biome-ignore lint/suspicious/noExplicitAny: handler context, unused auth fields omitted
  return { params: Promise.resolve(params), userRole } as any
}

const snapshot = (over: Record<string, unknown> = {}) => ({
  v: 1,
  params: { ...defaultParams, cols: 15, top_text: 'Sonia' },
  overrides: { 'bead:earth': 'ams-1-2' },
  profileId: 'fdm-0.4',
  ...over,
})

async function post(body: unknown) {
  const request = new NextRequest('http://localhost:3000/api/abacus/designs', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
  return createDesign(request, ctx())
}

async function get(id: string, userRole = 'user') {
  const request = new NextRequest(`http://localhost:3000/api/abacus/designs/${id}`)
  return getDesign(request, ctx({ id }, userRole))
}

describe('abacus design routes', () => {
  beforeAll(async () => {
    await db.run(sql.raw('CREATE TABLE `users` (`id` text PRIMARY KEY NOT NULL)'))
    // Every migration that touches abacus_designs, in order — miss one and the
    // failures read as "no such column", not "you forgot a migration".
    for (const file of ['0140_abacus_designs.sql', '0141_abacus_design_sharing.sql']) {
      const migration = readFileSync(
        path.join(__dirname, '../../../../../../drizzle', file),
        'utf-8'
      )
      for (const statement of migration.split('--> statement-breakpoint')) {
        if (statement.trim()) await db.run(sql.raw(statement))
      }
    }
    await db.run(sql.raw(`INSERT INTO users (id) VALUES ('${OWNER}'), ('${STRANGER}')`))
  })

  afterEach(async () => {
    await db.delete(schema.abacusDesigns)
    // mockReset (not mockClear): an unconsumed mockResolvedValueOnce — e.g. the
    // admin test's, whose path never calls getUserId — must not leak forward.
    vi.mocked(getUserId).mockReset()
    vi.mocked(getUserId).mockResolvedValue(OWNER)
  })

  it('round-trips: POST stores the snapshot, GET returns it (and only it)', async () => {
    const created = await post({
      design: snapshot(),
      provenance: { filamentMap: { 0: '#ff0000' }, slotLabels: ['Red PLA'] },
    })
    expect(created.status).toBe(201)
    const { id } = await created.json()
    expect(typeof id).toBe('string')

    const res = await get(id)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ design: snapshot() }) // provenance is never returned
  })

  it('dedups an identical resubmit onto one row, key order be damned', async () => {
    const first = await post({ design: snapshot() })
    const { id } = await first.json()

    const reordered = {
      profileId: 'fdm-0.4',
      overrides: { 'bead:earth': 'ams-1-2' },
      params: Object.fromEntries(
        Object.entries({ ...defaultParams, cols: 15, top_text: 'Sonia' }).reverse()
      ),
      v: 1,
    }
    const second = await post({ design: reordered, provenance: { slotLabels: ['later'] } })
    expect(second.status).toBe(200)
    expect((await second.json()).id).toBe(id)

    // The dedup hit changed nothing — one row, first submit's provenance.
    const rows = await db.query.abacusDesigns.findMany()
    expect(rows).toHaveLength(1)
    expect(rows[0].provenance).toBeNull()
  })

  it('gives a different user their OWN row for the same design (owner-scoped hash)', async () => {
    const mine = await post({ design: snapshot() })
    const { id: myId } = await mine.json()

    vi.mocked(getUserId).mockResolvedValueOnce(STRANGER)
    const theirs = await post({ design: snapshot() })
    expect(theirs.status).toBe(201)
    const { id: theirId } = await theirs.json()
    expect(theirId).not.toBe(myId)

    // …so their THH edit link resolves for THEM.
    vi.mocked(getUserId).mockResolvedValueOnce(STRANGER)
    expect((await get(theirId)).status).toBe(200)
  })

  it('400s a body that is not a v1 design snapshot', async () => {
    expect((await post({})).status).toBe(400)
    expect((await post({ design: { v: 2, params: {} } })).status).toBe(400)
    expect((await post({ design: { v: 1, params: 'nope' } })).status).toBe(400)
    expect(await db.query.abacusDesigns.findMany()).toHaveLength(0)
  })

  it('404s an unknown id', async () => {
    expect((await get('no-such-design')).status).toBe(404)
  })

  it("404s (not 403) a design the caller doesn't own — existence isn't leaked", async () => {
    const created = await post({ design: snapshot() })
    const { id } = await created.json()

    vi.mocked(getUserId).mockResolvedValueOnce(STRANGER)
    const res = await get(id)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Design not found' }) // same body as unknown-id
  })

  it('lets an admin read any design', async () => {
    const created = await post({ design: snapshot() })
    const { id } = await created.json()

    vi.mocked(getUserId).mockResolvedValueOnce(STRANGER)
    const res = await get(id, 'admin')
    expect(res.status).toBe(200)
  })

  it('lets anyone read a SHARED design, and stops the moment it is un-shared', async () => {
    const created = await post({ design: snapshot() })
    const { id } = await created.json()

    await db
      .update(schema.abacusDesigns)
      .set({ sharedAt: new Date() })
      .where(eq(schema.abacusDesigns.id, id))

    // Anyone can read it — the handler never even asks who you are, so a
    // signed-out visitor works too. (Deliberately no queued mock value here:
    // the short-circuit would leave it unconsumed, leaking into the next read.)
    vi.mocked(getUserId).mockClear()
    expect((await get(id)).status).toBe(200)
    expect(getUserId).not.toHaveBeenCalled()

    await db
      .update(schema.abacusDesigns)
      .set({ sharedAt: null })
      .where(eq(schema.abacusDesigns.id, id))

    vi.mocked(getUserId).mockResolvedValueOnce(STRANGER)
    const denied = await get(id)
    expect(denied.status).toBe(404)
    expect(await denied.json()).toEqual({ error: 'Design not found' })
    // …while the owner never lost their own design
    expect((await get(id)).status).toBe(200)
  })

  it('counts reads without ever blocking them', async () => {
    const created = await post({ design: snapshot() })
    const { id } = await created.json()

    await get(id)
    await get(id)
    const row = await db.query.abacusDesigns.findFirst()
    expect(row?.views).toBe(2)
    expect(row?.lastAccessedAt).toBeInstanceOf(Date)
  })
})
