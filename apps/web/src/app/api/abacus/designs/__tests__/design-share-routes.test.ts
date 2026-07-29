// @vitest-environment node
/**
 * Design sharing routes (Gitea #24) — the ACCESS sub-resource of an immutable
 * design. Pins the properties the feature rests on: sharing is idempotent and
 * records its FIRST time; un-share/re-share returns the SAME id (so the UI
 * toggle can be its own undo); a stranger can neither read the state nor flip
 * it, and learns nothing from trying (identical 404, row untouched).
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

const OWNER = 'design-share-test-owner'
const STRANGER = 'design-share-test-stranger'

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: (handler: unknown) => handler,
}))
vi.mock('@/lib/viewer', () => ({
  getUserId: vi.fn(async () => 'design-share-test-owner'),
}))

import { GET as getDesign } from '../[id]/route'
import { GET as getShare, POST as share, DELETE as unshare } from '../[id]/share/route'
import { POST as createDesign, GET as listShared } from '../route'

function ctx(params: Record<string, string> = {}, userRole = 'user') {
  // biome-ignore lint/suspicious/noExplicitAny: handler context, unused auth fields omitted
  return { params: Promise.resolve(params), userRole } as any
}

const snapshot = (topText = 'shared') => ({
  v: 1,
  params: { ...defaultParams, cols: 11, top_text: topText },
  overrides: {},
  profileId: 'fdm-0.4',
})

const req = (id: string) => new NextRequest(`http://localhost:3000/api/abacus/designs/${id}/share`)
const listReq = () => new NextRequest('http://localhost:3000/api/abacus/designs')

async function createDesignRow(topText = 'shared') {
  const request = new NextRequest('http://localhost:3000/api/abacus/designs', {
    method: 'POST',
    body: JSON.stringify({ design: snapshot(topText) }),
    headers: { 'content-type': 'application/json' },
  })
  const res = await createDesign(request, ctx())
  return (await res.json()).id as string
}

// File-level on purpose: the ledger suite below is a sibling describe and needs
// the same schema and the same between-test reset.
beforeAll(async () => {
  await db.run(sql.raw('CREATE TABLE `users` (`id` text PRIMARY KEY NOT NULL)'))
  for (const file of ['0140_abacus_designs.sql', '0141_abacus_design_sharing.sql']) {
    const migration = readFileSync(path.join(__dirname, '../../../../../../drizzle', file), 'utf-8')
    for (const statement of migration.split('--> statement-breakpoint')) {
      if (statement.trim()) await db.run(sql.raw(statement))
    }
  }
  await db.run(sql.raw(`INSERT INTO users (id) VALUES ('${OWNER}'), ('${STRANGER}')`))
})

afterEach(async () => {
  await db.delete(schema.abacusDesigns)
  vi.mocked(getUserId).mockReset()
  vi.mocked(getUserId).mockResolvedValue(OWNER)
})

describe('abacus design sharing routes', () => {
  it('starts private, shares, and reports the state', async () => {
    const id = await createDesignRow()

    const before = await getShare(req(id), ctx({ id }))
    expect(await before.json()).toEqual({ shared: false, sharedAt: null })

    const shared = await share(req(id), ctx({ id }))
    expect(shared.status).toBe(200)
    const body = await shared.json()
    expect(body.shared).toBe(true)
    expect(typeof body.sharedAt).toBe('number')
  })

  it('is idempotent — re-sharing keeps the FIRST sharedAt', async () => {
    const id = await createDesignRow()
    const first = await (await share(req(id), ctx({ id }))).json()
    const second = await (await share(req(id), ctx({ id }))).json()
    expect(second.sharedAt).toBe(first.sharedAt)
  })

  it('un-shares, and re-sharing revives the SAME id (the undo contract)', async () => {
    const id = await createDesignRow()
    await share(req(id), ctx({ id }))

    const off = await unshare(req(id), ctx({ id }))
    expect(await off.json()).toEqual({ shared: false, sharedAt: null })
    // the stranger's read is closed again…
    vi.mocked(getUserId).mockResolvedValueOnce(STRANGER)
    const strangerRead = await getDesign(
      new NextRequest(`http://localhost:3000/api/abacus/designs/${id}`),
      ctx({ id })
    )
    expect(strangerRead.status).toBe(404)

    // …and turning it back on restores that very link, not a new one
    const back = await (await share(req(id), ctx({ id }))).json()
    expect(back.shared).toBe(true)
    vi.mocked(getUserId).mockResolvedValueOnce(STRANGER)
    const reopened = await getDesign(
      new NextRequest(`http://localhost:3000/api/abacus/designs/${id}`),
      ctx({ id })
    )
    expect(reopened.status).toBe(200)
  })

  it('never lets a stranger read or flip sharing, and leaks nothing', async () => {
    const id = await createDesignRow()

    for (const handler of [getShare, share, unshare]) {
      vi.mocked(getUserId).mockResolvedValueOnce(STRANGER)
      const res = await handler(req(id), ctx({ id }))
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Design not found' })
    }

    // the attempts changed nothing — nobody publishes someone else's design
    const row = await db.query.abacusDesigns.findFirst({
      where: eq(schema.abacusDesigns.id, id),
    })
    expect(row?.sharedAt).toBeNull()
  })

  it('answers an unknown id with the same 404 on every verb', async () => {
    for (const handler of [getShare, share, unshare]) {
      const res = await handler(req('no-such-design'), ctx({ id: 'no-such-design' }))
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'Design not found' })
    }
  })

  it('lets an admin flip sharing — a takedown path that is not the DB console', async () => {
    const id = await createDesignRow()
    await share(req(id), ctx({ id }))

    vi.mocked(getUserId).mockResolvedValueOnce(STRANGER)
    const res = await unshare(req(id), ctx({ id }, 'admin'))
    expect(await res.json()).toEqual({ shared: false, sharedAt: null })
  })
})

/**
 * The ledger of what you've made public. It exists because the studio's toggle
 * can only address the design on screen, and a design id is an immutable
 * snapshot — so editing past a shared design would otherwise strand it: still
 * public, no longer reachable by any control.
 */
describe('shared-design ledger (GET /api/abacus/designs)', () => {
  const list = async (userRole = 'user') => (await listShared(listReq(), ctx({}, userRole))).json()

  it('lists your shared designs — not your private ones, and not anyone else’s', async () => {
    const mineShared = await createDesignRow('Mira')
    await share(req(mineShared), ctx({ id: mineShared }))
    await createDesignRow('Theo') // saved but never shared

    vi.mocked(getUserId).mockResolvedValue(STRANGER)
    const theirs = await createDesignRow('Nobody')
    await share(req(theirs), ctx({ id: theirs }))
    vi.mocked(getUserId).mockResolvedValue(OWNER)

    const body = await list()
    expect(body.designs.map((d: { id: string }) => d.id)).toEqual([mineShared])
    expect(body.truncated).toBe(false)
  })

  it('carries enough to tell them apart — the engraving and the shape', async () => {
    const id = await createDesignRow('Mira')
    await share(req(id), ctx({ id }))

    const [row] = (await list()).designs
    expect(row).toMatchObject({ id, label: 'Mira', cols: 11 })
    expect(typeof row.sharedAt).toBe('number')
  })

  it('still lists a design whose envelope no longer parses — it is still public', async () => {
    const id = await createDesignRow('Mira')
    await share(req(id), ctx({ id }))
    // schema drift: the design can no longer be OPENED (the read 404s it), but
    // it is still shared, so a ledger that hid it would strand it forever
    await db
      .update(schema.abacusDesigns)
      // biome-ignore lint/suspicious/noExplicitAny: deliberately invalid envelope
      .set({ design: { v: 999 } as any })
      .where(eq(schema.abacusDesigns.id, id))

    const [row] = (await list()).designs
    expect(row).toMatchObject({ id, label: null, cols: null })
  })

  it('orders newest share first', async () => {
    const older = await createDesignRow('Older')
    const newer = await createDesignRow('Newer')
    for (const id of [older, newer]) await share(req(id), ctx({ id }))
    // sharedAt persists whole seconds, so set them apart explicitly rather than
    // racing the clock for an ordering assertion
    await db
      .update(schema.abacusDesigns)
      .set({ sharedAt: new Date(1_700_000_000_000) })
      .where(eq(schema.abacusDesigns.id, older))
    await db
      .update(schema.abacusDesigns)
      .set({ sharedAt: new Date(1_800_000_000_000) })
      .where(eq(schema.abacusDesigns.id, newer))

    const body = await list()
    expect(body.designs.map((d: { id: string }) => d.id)).toEqual([newer, older])
  })

  it('answers a signed-out visitor with an empty ledger, not an error', async () => {
    vi.mocked(getUserId).mockRejectedValueOnce(new Error('no session'))
    const res = await listShared(listReq(), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ designs: [], truncated: false })
  })

  it('stays identity-scoped for an admin — this answers "what have I shared"', async () => {
    vi.mocked(getUserId).mockResolvedValue(STRANGER)
    const theirs = await createDesignRow('Nobody')
    await share(req(theirs), ctx({ id: theirs }))
    vi.mocked(getUserId).mockResolvedValue(OWNER)

    // an admin's takedown path is the per-id share resource, not this list
    expect((await list('admin')).designs).toEqual([])
  })
})
