// @vitest-environment node
/**
 * Doorbell ring route tests (#8.4): fail-closed auth (every failure is the
 * same bare 401), throttle collapse, and tolerant body parsing. Uses the
 * in-memory-db pattern from the other print tests; the socket emitter is
 * mocked — its tenant scoping has its own suite.
 */
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, schema } from '@/db'
import { emitPrintJobUpdated } from '@/lib/abacus/print/ring-emitter'
import { resetRingThrottle } from '@/lib/abacus/print/ring-throttle'
import { seal } from '@/lib/secret-box'

vi.mock('@/db', async () => {
  const schema = await vi.importActual<typeof import('@/db/schema')>('@/db/schema')
  const { createClient } = await import('@libsql/client')
  const { drizzle } = await import('drizzle-orm/libsql')
  const client = createClient({ url: ':memory:' })
  return { db: drizzle(client, { schema }), schema }
})

vi.mock('@/lib/abacus/print/ring-emitter', () => ({
  emitPrintJobUpdated: vi.fn(async () => {}),
}))

import { POST as ring } from '../ring/[connectionId]/route'

const USER = 'ring-route-test-user'
const KEY = randomBytes(32).toString('base64')
const RING_SECRET = 'ring-secret-abc123'

const emitMock = vi.mocked(emitPrintJobUpdated)

function ctx(connectionId: string) {
  return { params: Promise.resolve({ connectionId }) }
}

function ringRequest(connectionId: string, opts: { bearer?: string; body?: BodyInit } = {}) {
  return new NextRequest(`http://localhost:3000/api/abacus/print/ring/${connectionId}`, {
    method: 'POST',
    headers: opts.bearer !== undefined ? { authorization: `Bearer ${opts.bearer}` } : {},
    ...(opts.body !== undefined ? { body: opts.body } : {}),
  })
}

async function insertConnection(overrides: { ringSecretSealed?: string | null } = {}) {
  const [row] = await db
    .insert(schema.printServiceConnections)
    .values({
      userId: USER,
      name: 'Test service',
      origin: 'https://things.haunt.house',
      tokenSealed: seal('bearer-token'),
      ringSecretSealed:
        'ringSecretSealed' in overrides ? overrides.ringSecretSealed : seal(RING_SECRET),
      webhookRegisteredAt: new Date(),
    })
    .returning()
  return row
}

describe('POST ring/[connectionId]', () => {
  let savedKey: string | undefined

  beforeAll(async () => {
    await db.run(sql.raw('CREATE TABLE `users` (`id` text PRIMARY KEY NOT NULL)'))
    const migration = readFileSync(
      path.join(__dirname, '../../../../../../drizzle/0137_print_service_connections.sql'),
      'utf-8'
    )
    for (const statement of migration.split('--> statement-breakpoint')) {
      if (statement.trim()) await db.run(sql.raw(statement))
    }
  })

  beforeEach(async () => {
    savedKey = process.env.SECRET_BOX_KEY
    process.env.SECRET_BOX_KEY = KEY
    await db.run(sql.raw(`INSERT OR IGNORE INTO users (id) VALUES ('${USER}')`))
    resetRingThrottle()
    emitMock.mockClear()
  })

  afterEach(async () => {
    await db.delete(schema.printServiceConnections)
    if (savedKey === undefined) delete process.env.SECRET_BOX_KEY
    else process.env.SECRET_BOX_KEY = savedKey
  })

  it('acks a valid ring 204 and emits to the connection owner with the parsed hint', async () => {
    const connection = await insertConnection()
    const res = await ring(
      ringRequest(connection.id, {
        bearer: RING_SECRET,
        body: JSON.stringify({ jobId: 'job-42', printerId: 'printer-1', phase: 'printing' }),
      }),
      ctx(connection.id)
    )

    expect(res.status).toBe(204)
    expect(emitMock).toHaveBeenCalledTimes(1)
    expect(emitMock).toHaveBeenCalledWith(USER, {
      connectionId: connection.id,
      jobId: 'job-42',
      printerId: 'printer-1',
      phase: 'printing',
    })
  })

  it('401s a wrong secret with a bare body and no emit', async () => {
    const connection = await insertConnection()
    const res = await ring(
      ringRequest(connection.id, { bearer: 'wrong-secret' }),
      ctx(connection.id)
    )

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'unauthorized' }) // no detail, ever
    expect(emitMock).not.toHaveBeenCalled()
  })

  it('401s a missing bearer', async () => {
    const connection = await insertConnection()
    const res = await ring(ringRequest(connection.id), ctx(connection.id))
    expect(res.status).toBe(401)
    expect(emitMock).not.toHaveBeenCalled()
  })

  it('401s an unknown connection id identically to a wrong secret', async () => {
    const res = await ring(
      ringRequest('no-such-connection', { bearer: RING_SECRET }),
      ctx('no-such-connection')
    )
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'unauthorized' })
    expect(emitMock).not.toHaveBeenCalled()
  })

  it('401s a connection whose webhook was never registered (no ring secret)', async () => {
    const connection = await insertConnection({ ringSecretSealed: null })
    const res = await ring(ringRequest(connection.id, { bearer: RING_SECRET }), ctx(connection.id))
    expect(res.status).toBe(401)
    expect(emitMock).not.toHaveBeenCalled()
  })

  it('401s (not 500s) when the stored secret is corrupt', async () => {
    const connection = await insertConnection({ ringSecretSealed: 'sb1:not:valid:garbage' })
    const res = await ring(ringRequest(connection.id, { bearer: RING_SECRET }), ctx(connection.id))
    expect(res.status).toBe(401)
    expect(emitMock).not.toHaveBeenCalled()
  })

  it('collapses a burst to one emit but acks every ring', async () => {
    const connection = await insertConnection()
    const first = await ring(
      ringRequest(connection.id, { bearer: RING_SECRET }),
      ctx(connection.id)
    )
    const second = await ring(
      ringRequest(connection.id, { bearer: RING_SECRET }),
      ctx(connection.id)
    )

    expect(first.status).toBe(204)
    expect(second.status).toBe(204) // dropped, not rejected — the poll backstops
    expect(emitMock).toHaveBeenCalledTimes(1)
  })

  it('treats a missing or garbage body as a bare "connection changed" hint', async () => {
    const connection = await insertConnection()
    const res = await ring(
      ringRequest(connection.id, { bearer: RING_SECRET, body: 'not json {{' }),
      ctx(connection.id)
    )

    expect(res.status).toBe(204)
    expect(emitMock).toHaveBeenCalledWith(USER, { connectionId: connection.id })
  })
})
