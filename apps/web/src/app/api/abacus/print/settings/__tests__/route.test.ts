// @vitest-environment node
/**
 * Print-settings overlay route tests: null-when-absent, verbatim roundtrip
 * (including vector process values), validation 400s, upsert idempotence.
 * In-memory-db pattern from the abacus-identity route tests.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, schema } from '@/db'

vi.mock('@/db', async () => {
  const schema = await vi.importActual<typeof import('@/db/schema')>('@/db/schema')
  const { createClient } = await import('@libsql/client')
  const { drizzle } = await import('drizzle-orm/libsql')
  const client = createClient({ url: ':memory:' })
  return { db: drizzle(client, { schema }), schema }
})

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: (handler: unknown) => handler,
}))
vi.mock('@/lib/viewer', () => ({
  getUserId: vi.fn(async () => 'print-settings-test-user'),
}))

import { GET, PUT } from '../route'

const USER = 'print-settings-test-user'

function putRequest(style: unknown) {
  return new NextRequest('http://localhost:3000/api/abacus/print/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ style }),
  })
}

const getRequest = () => new NextRequest('http://localhost:3000/api/abacus/print/settings')

const VALID = {
  basePreset: '0.20mm-standard',
  process: { sparse_infill_density: 15, wall_loops: 3 },
}

describe('print-settings route', () => {
  beforeAll(async () => {
    await db.run(sql.raw('CREATE TABLE `users` (`id` text PRIMARY KEY NOT NULL)'))
    const migration = readFileSync(
      path.join(__dirname, '../../../../../../../drizzle/0139_abacus_print_settings.sql'),
      'utf-8'
    )
    for (const statement of migration.split('--> statement-breakpoint')) {
      if (statement.trim()) await db.run(sql.raw(statement))
    }
  })

  beforeEach(async () => {
    await db.run(sql.raw(`INSERT OR IGNORE INTO users (id) VALUES ('${USER}')`))
  })

  afterEach(async () => {
    await db.delete(schema.abacusPrintSettings)
  })

  it('GET returns null when nothing is saved', async () => {
    const res = await GET(getRequest(), {} as any)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ style: null })
  })

  it('PUT then GET roundtrips the style verbatim', async () => {
    const put = await PUT(putRequest(VALID), {} as any)
    expect(put.status).toBe(200)
    expect(await put.json()).toEqual({ style: VALID })

    const res = await GET(getRequest(), {} as any)
    expect(await res.json()).toEqual({ style: VALID })
  })

  it('roundtrips vector process values', async () => {
    const style = {
      basePreset: '0.16mm-fine',
      process: {
        first_layer_temperature: [220, 220],
        notes: 'silk PLA',
        spiral_mode: true,
      },
    }
    await PUT(putRequest(style), {} as any)
    const res = await GET(getRequest(), {} as any)
    expect(await res.json()).toEqual({ style })
  })

  it('PUT twice upserts a single row with the newest style', async () => {
    await PUT(putRequest(VALID), {} as any)
    const updated = { basePreset: '0.28mm-draft', process: {} }
    await PUT(putRequest(updated), {} as any)

    const rows = await db.select().from(schema.abacusPrintSettings)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.userId).toBe(USER)
    expect(JSON.parse(rows[0]?.style ?? '')).toEqual(updated)
  })

  it.each([
    ['missing basePreset', { process: {} }],
    ['empty basePreset', { basePreset: '', process: {} }],
    ['missing process', { basePreset: '0.20mm-standard' }],
    ['array process', { basePreset: '0.20mm-standard', process: [] }],
    ['object process value', { basePreset: '0.20mm-standard', process: { k: { nested: 1 } } }],
    ['null process value', { basePreset: '0.20mm-standard', process: { k: null } }],
    ['NaN process value', { basePreset: '0.20mm-standard', process: { k: Number.NaN } }],
    ['not an object', 'just-a-string'],
    ['null style', null],
  ])('PUT rejects %s with 400', async (_label, style) => {
    const res = await PUT(putRequest(style), {} as any)
    expect(res.status).toBe(400)
  })

  it('PUT rejects an unparseable body with 400', async () => {
    const request = new NextRequest('http://localhost:3000/api/abacus/print/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const res = await PUT(request, {} as any)
    expect(res.status).toBe(400)
  })
})
