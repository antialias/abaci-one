/**
 * Owner-scoping and create-via-pair tests for print connections (#8.2).
 *
 * Overrides the global @/db mock with a REAL drizzle instance over an
 * in-memory libsql database, with tables created from the actual 0137
 * migration SQL — full query fidelity, no dependency on data/sqlite.db,
 * safe in CI.
 */
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, schema } from '@/db'
import { seal } from '@/lib/secret-box'
import {
  createConnectionFromPairing,
  deleteConnection,
  getOwnedConnection,
  listConnections,
  renameConnection,
  resolveConnection,
  toConnectionView,
} from '../connections'

vi.mock('@/db', async () => {
  const schema = await vi.importActual<typeof import('@/db/schema')>('@/db/schema')
  const { createClient } = await import('@libsql/client')
  const { drizzle } = await import('drizzle-orm/libsql')
  const client = createClient({ url: ':memory:' })
  return { db: drizzle(client, { schema }), schema }
})

const USER_A = 'print-conn-test-user-a'
const USER_B = 'print-conn-test-user-b'
const KEY = randomBytes(32).toString('base64')

async function insertConnection(userId: string, name: string) {
  const [row] = await db
    .insert(schema.printServiceConnections)
    .values({
      userId,
      name,
      origin: 'https://things.haunt.house',
      tokenSealed: seal(`token-for-${name}`),
    })
    .returning()
  return row
}

describe('print connections', () => {
  let savedKey: string | undefined
  let savedRingOrigin: string | undefined

  beforeAll(async () => {
    // Minimal users table so the print tables' FK clauses can resolve.
    await db.run(sql.raw('CREATE TABLE `users` (`id` text PRIMARY KEY NOT NULL)'))

    // Create the print tables exactly as production migrations do.
    const migration = readFileSync(
      path.join(__dirname, '../../../../../drizzle/0137_print_service_connections.sql'),
      'utf-8'
    )
    for (const statement of migration.split('--> statement-breakpoint')) {
      if (statement.trim()) await db.run(sql.raw(statement))
    }
  })

  beforeEach(async () => {
    savedKey = process.env.SECRET_BOX_KEY
    savedRingOrigin = process.env.PRINT_RING_ORIGIN
    process.env.SECRET_BOX_KEY = KEY
    process.env.PRINT_RING_ORIGIN = 'https://abaci.one'

    // libsql enforces FKs, so the owning users must exist
    await db.run(sql.raw(`INSERT OR IGNORE INTO users (id) VALUES ('${USER_A}'), ('${USER_B}')`))
  })

  afterEach(async () => {
    await db.delete(schema.printJobs)
    await db.delete(schema.printServiceConnections)

    if (savedKey === undefined) delete process.env.SECRET_BOX_KEY
    else process.env.SECRET_BOX_KEY = savedKey
    if (savedRingOrigin === undefined) delete process.env.PRINT_RING_ORIGIN
    else process.env.PRINT_RING_ORIGIN = savedRingOrigin
    vi.unstubAllGlobals()
  })

  it('toConnectionView never exposes sealed fields', async () => {
    const row = await insertConnection(USER_A, 'Home X1C')
    const view: Record<string, unknown> = { ...toConnectionView(row) }
    expect(view).toEqual({
      id: row.id,
      name: 'Home X1C',
      origin: 'https://things.haunt.house',
      webhookRegistered: false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
    expect(JSON.stringify(view)).not.toContain('Sealed')
    expect(JSON.stringify(view)).not.toContain('sb1:')
  })

  it('listConnections is owner-scoped', async () => {
    await insertConnection(USER_A, 'A printer')
    await insertConnection(USER_B, 'B printer')

    const forA = await listConnections(USER_A)
    expect(forA).toHaveLength(1)
    expect(forA[0].name).toBe('A printer')
  })

  it("user B cannot read, rename, or delete A's connection", async () => {
    const row = await insertConnection(USER_A, 'A printer')

    expect(await getOwnedConnection(USER_B, row.id)).toBeUndefined()
    expect(await renameConnection(USER_B, row.id, 'stolen')).toBeUndefined()
    expect(await deleteConnection(USER_B, row.id)).toBe(false)

    // still intact for A
    const still = await getOwnedConnection(USER_A, row.id)
    expect(still?.name).toBe('A printer')
  })

  it('rename and delete work for the owner', async () => {
    const row = await insertConnection(USER_A, 'A printer')
    const renamed = await renameConnection(USER_A, row.id, 'Garage AMS')
    expect(renamed?.name).toBe('Garage AMS')
    expect(await deleteConnection(USER_A, row.id)).toBe(true)
    expect(await getOwnedConnection(USER_A, row.id)).toBeUndefined()
  })

  describe('resolveConnection', () => {
    it('returns the sole connection when no id is passed', async () => {
      const row = await insertConnection(USER_A, 'Only one')
      const resolved = await resolveConnection(USER_A, null)
      expect(resolved.id).toBe(row.id)
    })

    it('400s when ambiguous and 404s when there are none', async () => {
      await expect(resolveConnection(USER_A, null)).rejects.toMatchObject({ status: 404 })
      await insertConnection(USER_A, 'one')
      await insertConnection(USER_A, 'two')
      await expect(resolveConnection(USER_A, null)).rejects.toMatchObject({ status: 400 })
    })

    it("404s on another user's explicit connectionId", async () => {
      const row = await insertConnection(USER_A, 'A printer')
      await expect(resolveConnection(USER_B, row.id)).rejects.toMatchObject({ status: 404 })
    })
  })

  describe('createConnectionFromPairing', () => {
    it('pairs, persists a sealed token, and registers the webhook', async () => {
      const fetchMock = vi
        .fn()
        // POST /pair
        .mockResolvedValueOnce(new Response(JSON.stringify({ token: 'fresh-token' })))
        // PUT /webhook
        .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))
      vi.stubGlobal('fetch', fetchMock)

      const result = await createConnectionFromPairing({
        userId: USER_A,
        artifact: 'CODE@things.haunt.house',
        userLabel: 'a@example.com',
      })

      expect(result.webhookWarning).toBeUndefined()
      expect(result.connection.name).toBe('things.haunt.house')
      expect(result.connection.webhookRegistered).toBe(true)

      const row = await getOwnedConnection(USER_A, result.connection.id)
      expect(row?.tokenSealed).toMatch(/^sb1:/)
      expect(row?.tokenSealed).not.toContain('fresh-token')
      expect(row?.ringSecretSealed).toMatch(/^sb1:/)

      // webhook registration hit the right URL with the ring callback
      const webhookCall = fetchMock.mock.calls[1]
      expect(webhookCall[0]).toBe('https://things.haunt.house/api/print/v1/webhook')
      const webhookBody = JSON.parse(webhookCall[1].body)
      expect(webhookBody.url).toBe(
        `https://abaci.one/api/abacus/print/ring/${result.connection.id}`
      )
      expect(typeof webhookBody.secret).toBe('string')
      expect(webhookBody.secret.length).toBeGreaterThanOrEqual(32)
    })

    it('keeps the connection when webhook registration fails (codes are single-use)', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ token: 'fresh-token' })))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ detail: { code: 'not_pairable', message: 'env token' } }), {
            status: 409,
          })
        )
      vi.stubGlobal('fetch', fetchMock)

      const result = await createConnectionFromPairing({
        userId: USER_A,
        artifact: 'CODE@things.haunt.house',
      })

      expect(result.webhookWarning).toContain('fixed token')
      expect(result.connection.webhookRegistered).toBe(false)
      const row = await getOwnedConnection(USER_A, result.connection.id)
      expect(row?.tokenSealed).toMatch(/^sb1:/)
      expect(row?.ringSecretSealed).toBeNull()
    })
  })
})
