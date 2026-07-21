// @vitest-environment node
/**
 * Player abacus-identity route tests: authz on both verbs ('view' to read,
 * 'start-session' to write), default identity when no row, validation, and
 * upsert semantics. In-memory-db pattern from the print route tests.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, schema } from '@/db'
import { canPerformAction } from '@/lib/classroom'

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
  getUserId: vi.fn(async () => 'identity-route-test-user'),
}))
vi.mock('@/lib/classroom', () => ({
  canPerformAction: vi.fn(async () => true),
}))

import { GET, PUT } from '../route'

const PLAYER = 'identity-route-test-player'
const USER = 'identity-route-test-user'

const canPerformActionMock = vi.mocked(canPerformAction)

function ctx(id: string = PLAYER) {
  return { params: Promise.resolve({ id }) } as any
}

function putRequest(identity: unknown) {
  return new NextRequest(`http://localhost:3000/api/players/${PLAYER}/abacus-identity`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity }),
  })
}

const getRequest = () =>
  new NextRequest(`http://localhost:3000/api/players/${PLAYER}/abacus-identity`)

const VALID = { colorScheme: 'heaven-earth', colorPalette: 'nature', columns: 6 }

describe('player abacus-identity route', () => {
  beforeAll(async () => {
    await db.run(sql.raw('CREATE TABLE `users` (`id` text PRIMARY KEY NOT NULL)'))
    await db.run(
      sql.raw('CREATE TABLE `players` (`id` text PRIMARY KEY NOT NULL, `user_id` text NOT NULL)')
    )
    const migration = readFileSync(
      path.join(__dirname, '../../../../../../../drizzle/0138_player_abacus_identity.sql'),
      'utf-8'
    )
    for (const statement of migration.split('--> statement-breakpoint')) {
      if (statement.trim()) await db.run(sql.raw(statement))
    }
  })

  beforeEach(async () => {
    canPerformActionMock.mockReset()
    canPerformActionMock.mockResolvedValue(true)
    await db.run(sql.raw(`INSERT OR IGNORE INTO users (id) VALUES ('${USER}')`))
    await db.run(
      sql.raw(`INSERT OR IGNORE INTO players (id, user_id) VALUES ('${PLAYER}', '${USER}')`)
    )
  })

  afterEach(async () => {
    await db.delete(schema.playerAbacusIdentity)
  })

  it('GET returns the default identity when no row exists', async () => {
    const res = await GET(getRequest(), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      identity: { colorScheme: 'place-value', colorPalette: 'default', columns: 4 },
    })
    expect(canPerformActionMock).toHaveBeenCalledWith(USER, PLAYER, 'view')
    // GET must never create a row ('view'-level access is read-only)
    const rows = await db.select().from(schema.playerAbacusIdentity)
    expect(rows).toHaveLength(0)
  })

  it('GET 403s without view access', async () => {
    canPerformActionMock.mockResolvedValue(false)
    const res = await GET(getRequest(), ctx())
    expect(res.status).toBe(403)
  })

  it('PUT requires start-session access', async () => {
    canPerformActionMock.mockResolvedValue(false)
    const res = await PUT(putRequest(VALID), ctx())
    expect(res.status).toBe(403)
    expect(canPerformActionMock).toHaveBeenCalledWith(USER, PLAYER, 'start-session')
  })

  it('PUT then GET roundtrips the identity', async () => {
    const put = await PUT(putRequest(VALID), ctx())
    expect(put.status).toBe(200)
    expect(await put.json()).toEqual({ identity: VALID })

    const res = await GET(getRequest(), ctx())
    expect(await res.json()).toEqual({ identity: VALID })
  })

  it('PUT twice upserts a single row with the newest values', async () => {
    await PUT(putRequest(VALID), ctx())
    const updated = { colorScheme: 'monochrome', colorPalette: 'grayscale', columns: 13 }
    await PUT(putRequest(updated), ctx())

    const rows = await db.select().from(schema.playerAbacusIdentity)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ playerId: PLAYER, ...updated })
  })

  it.each([
    ['bad scheme', { ...VALID, colorScheme: 'rainbow' }],
    ['bad palette', { ...VALID, colorPalette: 'neon' }],
    ['columns 0', { ...VALID, columns: 0 }],
    ['columns 22', { ...VALID, columns: 22 }],
    ['fractional columns', { ...VALID, columns: 4.5 }],
    ['missing fields', { colorScheme: 'place-value' }],
    ['not an object', 'place-value'],
  ])('PUT rejects %s with 400', async (_label, identity) => {
    const res = await PUT(putRequest(identity), ctx())
    expect(res.status).toBe(400)
  })

  it('PUT rejects an unparseable body with 400', async () => {
    const request = new NextRequest(`http://localhost:3000/api/players/${PLAYER}/abacus-identity`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const res = await PUT(request, ctx())
    expect(res.status).toBe(400)
  })
})
