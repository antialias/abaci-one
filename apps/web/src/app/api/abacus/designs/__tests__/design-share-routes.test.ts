// @vitest-environment node
/**
 * Design sharing routes (Gitea #24) — the ACCESS sub-resource of an immutable
 * design. Pins the properties the feature rests on: sharing is idempotent and
 * records its FIRST time; un-share/re-share returns the SAME id (so the UI
 * toggle can be its own undo); a stranger can neither read the state nor flip
 * it, and learns nothing from trying (identical 404, row untouched).
 *
 * Plus the design's other mutable metadata (Gitea #11): its name, whether it
 * appears in the owner's list, and the list itself. The pin that matters most
 * there is the one tying the two features together — a design that is shared
 * stays listed even when hidden, because a public design must always have a
 * control naming it.
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

import { GET as getDesign, PATCH as patchDesign } from '../[id]/route'
import { GET as getShare, POST as share, DELETE as unshare } from '../[id]/share/route'
import { POST as createDesign, GET as listDesigns } from '../route'

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

async function saveDesign(topText = 'shared', name?: unknown) {
  const request = new NextRequest('http://localhost:3000/api/abacus/designs', {
    method: 'POST',
    body: JSON.stringify(
      name === undefined ? { design: snapshot(topText) } : { design: snapshot(topText), name }
    ),
    headers: { 'content-type': 'application/json' },
  })
  return createDesign(request, ctx())
}

async function createDesignRow(topText = 'shared', name?: unknown) {
  const res = await saveDesign(topText, name)
  return (await res.json()).id as string
}

/** PATCH the metadata of a design (#11) — its name, or whether it's listed. */
const patch = (id: string, body: unknown, userRole = 'user') =>
  patchDesign(
    new NextRequest(`http://localhost:3000/api/abacus/designs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
    ctx({ id }, userRole)
  )

const nameOf = async (id: string) =>
  (await db.query.abacusDesigns.findFirst({ where: eq(schema.abacusDesigns.id, id) }))?.name ?? null

// File-level on purpose: the ledger suite below is a sibling describe and needs
// the same schema and the same between-test reset.
beforeAll(async () => {
  await db.run(sql.raw('CREATE TABLE `users` (`id` text PRIMARY KEY NOT NULL)'))
  for (const file of [
    '0140_abacus_designs.sql',
    '0141_abacus_design_sharing.sql',
    '0142_abacus_design_names.sql',
  ]) {
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
 * "My abacuses" (GET /api/abacus/designs) — #24's shared-only ledger grown into
 * the caller's whole list (#11), and the one place a design's mutable metadata
 * lives.
 *
 * It still has to keep the ledger's promise: the studio's share toggle can only
 * address the design on screen, so a public design must always have SOME control
 * naming it. Hence the invariant pinned below — hiding a design takes it out of
 * the list, unless it's shared.
 */
describe('my-designs list (GET /api/abacus/designs)', () => {
  const list = async (userRole = 'user') => (await listDesigns(listReq(), ctx({}, userRole))).json()
  const ids = async (userRole = 'user') =>
    ((await list(userRole)).designs as { id: string }[]).map((d) => d.id)

  it('lists everything of yours — printed or link-saved, shared or not', async () => {
    const shared = await createDesignRow('Mira')
    await share(req(shared), ctx({ id: shared }))
    const private_ = await createDesignRow('Theo') // saved, never shared

    const got = await ids()
    expect(got).toHaveLength(2)
    expect(new Set(got)).toEqual(new Set([shared, private_]))
    expect((await list()).truncated).toBe(false)
  })

  it('never lists anyone else’s design', async () => {
    vi.mocked(getUserId).mockResolvedValue(STRANGER)
    const theirs = await createDesignRow('Nobody')
    await share(req(theirs), ctx({ id: theirs }))
    vi.mocked(getUserId).mockResolvedValue(OWNER)

    expect(await ids()).toEqual([])
  })

  it('carries enough to tell them apart — name, engraving, shape, dates', async () => {
    const id = await createDesignRow('Mira')
    await patch(id, { name: 'Mira’s abacus' })
    await share(req(id), ctx({ id }))

    const [row] = (await list()).designs
    expect(row).toMatchObject({ id, name: 'Mira’s abacus', label: 'Mira', cols: 11 })
    expect(typeof row.sharedAt).toBe('number')
    expect(typeof row.createdAt).toBe('number')
  })

  it('still lists a design whose envelope no longer parses', async () => {
    const id = await createDesignRow('Mira')
    await share(req(id), ctx({ id }))
    // schema drift: the design can no longer be OPENED (the read 404s it), but
    // it is still shared, so a list that hid it would strand it forever
    await db
      .update(schema.abacusDesigns)
      // biome-ignore lint/suspicious/noExplicitAny: deliberately invalid envelope
      .set({ design: { v: 999 } as any })
      .where(eq(schema.abacusDesigns.id, id))

    const [row] = (await list()).designs
    expect(row).toMatchObject({ id, label: null, cols: null })
  })

  it('orders newest SAVED first — this is a list of what you made', async () => {
    const older = await createDesignRow('Older')
    const newer = await createDesignRow('Newer')
    // createdAt persists whole seconds, so set them apart explicitly rather
    // than racing the clock for an ordering assertion
    await db
      .update(schema.abacusDesigns)
      .set({ createdAt: new Date(1_700_000_000_000) })
      .where(eq(schema.abacusDesigns.id, older))
    await db
      .update(schema.abacusDesigns)
      .set({ createdAt: new Date(1_800_000_000_000) })
      .where(eq(schema.abacusDesigns.id, newer))

    expect(await ids()).toEqual([newer, older])
  })

  it('drops a hidden design from the list', async () => {
    const kept = await createDesignRow('Kept')
    const gone = await createDesignRow('Tidied')
    await patch(gone, { hidden: true })

    expect(await ids()).toEqual([kept])
  })

  it('KEEPS a hidden design that is shared — a public design always has a control', async () => {
    const id = await createDesignRow('Public')
    await share(req(id), ctx({ id }))
    await patch(id, { hidden: true })

    // hiding cannot be a way to lose track of something strangers can open…
    expect(await ids()).toEqual([id])

    // …and un-sharing is what finally lets it go, the hide still standing
    await unshare(req(id), ctx({ id }))
    expect(await ids()).toEqual([])
  })

  it('answers a signed-out visitor with an empty list, not an error', async () => {
    vi.mocked(getUserId).mockRejectedValueOnce(new Error('no session'))
    const res = await listDesigns(listReq(), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ designs: [], truncated: false })
  })

  it('stays identity-scoped for an admin — this answers "what have I made"', async () => {
    vi.mocked(getUserId).mockResolvedValue(STRANGER)
    const theirs = await createDesignRow('Nobody')
    await share(req(theirs), ctx({ id: theirs }))
    vi.mocked(getUserId).mockResolvedValue(OWNER)

    // an admin's takedown path is the per-id share resource, not this list
    expect(await ids('admin')).toEqual([])
  })
})

/**
 * Names and listing (PATCH /api/abacus/designs/[id], Gitea #11) — a design's
 * METADATA. Its content is immutable by construction, so the one thing these
 * tests must never allow is a rename that changes the id: a `?design=` link
 * printed on a job card has to keep resolving.
 */
describe('design metadata (PATCH /api/abacus/designs/[id])', () => {
  it('names a design, and renaming does NOT fork it', async () => {
    const id = await createDesignRow('Mira')
    const res = await patch(id, { name: '  Mira’s abacus  ' })
    expect(res.status).toBe(200)
    // trimmed on the way in
    expect(await res.json()).toEqual({ id, name: 'Mira’s abacus', hidden: false })

    // the pin: saving byte-identical content still lands on the SAME row, so
    // the name never entered the content hash
    const again = await saveDesign('Mira')
    expect(again.status).toBe(200) // 200 = dedup hit, not a fresh 201
    expect((await again.json()).id).toBe(id)
    expect(await nameOf(id)).toBe('Mira’s abacus')
  })

  it('takes a name back off with an empty one — never stores ""', async () => {
    const id = await createDesignRow('Mira', 'Temporary')
    expect(await nameOf(id)).toBe('Temporary')

    for (const body of [{ name: '   ' }, { name: null }]) {
      await patch(id, { name: 'Temporary' })
      const res = await patch(id, body)
      expect(await res.json()).toEqual({ id, name: null, hidden: false })
      expect(await nameOf(id)).toBeNull()
    }
  })

  it('hides and un-hides', async () => {
    const id = await createDesignRow('Mira')
    expect(await (await patch(id, { hidden: true })).json()).toEqual({
      id,
      name: null,
      hidden: true,
    })
    expect(await (await patch(id, { hidden: false })).json()).toEqual({
      id,
      name: null,
      hidden: false,
    })
  })

  it('refuses a name it cannot store, rather than truncating it', async () => {
    const id = await createDesignRow('Mira')
    for (const body of [
      { name: 'x'.repeat(61) },
      { name: 42 },
      { hidden: 'yes' },
      {}, // an update that asks for nothing is a caller bug, not a success
      [],
      null,
    ]) {
      const res = await patch(id, body)
      expect(res.status, JSON.stringify(body)).toBe(400)
    }
    expect(await nameOf(id)).toBeNull()
    // …but exactly at the cap is fine
    const ok = await patch(id, { name: 'x'.repeat(60) })
    expect(ok.status).toBe(200)
  })

  it('answers a stranger with the read’s own 404, and changes nothing', async () => {
    const id = await createDesignRow('Mira')
    await patch(id, { name: 'Mine' })

    vi.mocked(getUserId).mockResolvedValueOnce(STRANGER)
    const res = await patch(id, { name: 'Yours' })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Design not found' })
    expect(await nameOf(id)).toBe('Mine')
  })

  it('answers an unknown id with the same 404', async () => {
    const res = await patch('no-such-design', { name: 'Whatever' })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Design not found' })
  })

  it('lets an admin rename — the same reach they have over sharing', async () => {
    const id = await createDesignRow('Mira')
    vi.mocked(getUserId).mockResolvedValueOnce(STRANGER)
    const res = await patch(id, { name: 'Renamed by support' }, 'admin')
    expect(res.status).toBe(200)
    expect(await nameOf(id)).toBe('Renamed by support')
  })
})

/**
 * A name may ride along on the save (#11): the studio passes the name of the
 * design an edit came FROM, so "Ada's abacus" survives being tweaked.
 */
describe('design names on save (POST /api/abacus/designs)', () => {
  it('stores an inherited name on the new row', async () => {
    const id = await createDesignRow('Mira', 'Mira’s abacus')
    expect(await nameOf(id)).toBe('Mira’s abacus')
  })

  it('fills a blank name on a dedup hit, and never overwrites a chosen one', async () => {
    const id = await createDesignRow('Mira') // saved unnamed (e.g. by a print)
    await saveDesign('Mira', 'Mira’s abacus') // same content, now with a name
    expect(await nameOf(id)).toBe('Mira’s abacus')

    await saveDesign('Mira', 'Something else')
    expect(await nameOf(id)).toBe('Mira’s abacus')
  })

  it('ignores an unusable name rather than failing the save', async () => {
    // the print path must never lose a snapshot over metadata — a dropped name
    // costs one rename, a dropped snapshot costs the job card's edit link
    const res = await saveDesign('Mira', 'x'.repeat(61))
    expect(res.status).toBe(201)
    expect(await nameOf((await res.json()).id)).toBeNull()
  })
})
