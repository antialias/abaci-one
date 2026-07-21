// @vitest-environment node
/**
 * Proxy pass-through route tests (#8.3): submit stamping discipline, ETag
 * relay, and the jobs ownership gate. Uses the in-memory-db pattern from
 * the print lib tests; auth is mocked to a fixed user. Runs in the node
 * environment — jsdom's FormData/File don't interop with undici's
 * multipart body parsing.
 */
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, schema } from '@/db'
import { seal } from '@/lib/secret-box'

vi.mock('@/db', async () => {
  const schema = await vi.importActual<typeof import('@/db/schema')>('@/db/schema')
  const { createClient } = await import('@libsql/client')
  const { drizzle } = await import('drizzle-orm/libsql')
  const client = createClient({ url: ':memory:' })
  return { db: drizzle(client, { schema }), schema }
})

const USER = 'proxy-route-test-user'

vi.mock('@/lib/auth/withAuth', () => ({
  withAuth: (handler: unknown) => handler,
}))
vi.mock('@/lib/viewer', () => ({
  getUserId: vi.fn(async () => 'proxy-route-test-user'),
}))

import { GET as getCapabilities } from '../capabilities/route'
import { GET as getJob } from '../jobs/[id]/route'
import { POST as submitJob } from '../printers/[id]/jobs/route'

const KEY = randomBytes(32).toString('base64')

function ctx(params: Record<string, string> = {}) {
  // biome-ignore lint/suspicious/noExplicitAny: handler context, auth fields unused by these routes
  return { params: Promise.resolve(params) } as any
}

async function insertConnection() {
  const [row] = await db
    .insert(schema.printServiceConnections)
    .values({
      userId: USER,
      name: 'Test service',
      origin: 'https://things.haunt.house',
      tokenSealed: seal('bearer-token'),
    })
    .returning()
  return row
}

describe('print proxy routes', () => {
  let savedKey: string | undefined
  let fetchMock: ReturnType<typeof vi.fn>

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
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    await db.delete(schema.printJobs)
    await db.delete(schema.printServiceConnections)
    if (savedKey === undefined) delete process.env.SECRET_BOX_KEY
    else process.env.SECRET_BOX_KEY = savedKey
    vi.unstubAllGlobals()
  })

  describe('GET capabilities', () => {
    it('forwards If-None-Match and relays ETag + 304', async () => {
      await insertConnection()
      fetchMock.mockResolvedValue(new Response(null, { status: 304, headers: { etag: '"v7"' } }))

      const request = new NextRequest('http://localhost:3000/api/abacus/print/capabilities', {
        headers: { 'If-None-Match': '"v7"' },
      })
      const res = await getCapabilities(request, ctx())

      expect(res.status).toBe(304)
      expect(res.headers.get('etag')).toBe('"v7"')

      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://things.haunt.house/api/print/v1/capabilities')
      expect((init.headers as Headers).get('if-none-match')).toBe('"v7"')
      expect((init.headers as Headers).get('Authorization')).toBe('Bearer bearer-token')
    })

    it('404s cleanly when the user has no connection', async () => {
      const request = new NextRequest('http://localhost:3000/api/abacus/print/capabilities')
      const res = await getCapabilities(request, ctx())
      expect(res.status).toBe(404)
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('POST printers/[id]/jobs (submit)', () => {
    const ticket = {
      name: 'My abacus',
      filaments: [{ slotId: 'ams-1-2', overrides: { pressureAdvance: 0.03 } }],
      style: { basePreset: 'structural', process: { wallLoops: 4, sparseInfillDensity: 25 } },
      start: { policy: 'manual' },
      idempotencyKey: 'idem-1',
    }

    async function submit() {
      const form = new FormData()
      form.set('model', new File([new Uint8Array([1, 2, 3])], 'abacus.3mf'), 'abacus.3mf')
      form.set('job', JSON.stringify(ticket))
      const request = new NextRequest(
        'http://localhost:3000/api/abacus/print/printers/printer-1/jobs',
        { method: 'POST', body: form }
      )
      return submitJob(request, ctx({ id: 'printer-1' }))
    }

    it('stamps ONLY source.app and forwards style untouched', async () => {
      await insertConnection()
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ jobId: 'job-42' }), { status: 202 })
      )

      const res = await submit()
      expect(res.status).toBe(202)

      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://things.haunt.house/api/print/v1/printers/printer-1/jobs')
      const forwarded = JSON.parse((init.body as FormData).get('job') as string)

      expect(forwarded.source).toEqual({ app: 'abacus-studio' })
      const { source: _source, ...rest } = forwarded
      const { source: _origSource, ...origRest } = ticket as Record<string, unknown>
      expect(rest).toEqual(origRest) // style + everything else byte-for-byte semantics
      expect(Object.keys(forwarded.style)).toEqual(Object.keys(ticket.style)) // nothing injected
    })

    it('records the ownership row on 202', async () => {
      const connection = await insertConnection()
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ jobId: 'job-42' }), { status: 202 })
      )

      await submit()

      const row = await db.query.printJobs.findFirst()
      expect(row).toMatchObject({
        jobId: 'job-42',
        connectionId: connection.id,
        userId: USER,
        printerId: 'printer-1',
      })
    })

    it('records nothing when upstream rejects the ticket', async () => {
      await insertConnection()
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({ detail: { code: 'invalid_style', message: 'mixed vocabulary' } }),
          { status: 400 }
        )
      )

      const res = await submit()
      expect(res.status).toBe(400) // relayed raw — the service's error is the error
      expect(await db.query.printJobs.findFirst()).toBeUndefined()
    })

    it('400s on a submit without the multipart fields', async () => {
      await insertConnection()
      const request = new NextRequest(
        'http://localhost:3000/api/abacus/print/printers/printer-1/jobs',
        { method: 'POST', body: JSON.stringify({ nope: true }) }
      )
      const res = await submitJob(request, ctx({ id: 'printer-1' }))
      expect(res.status).toBe(400)
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('GET jobs/[id] ownership gate', () => {
    it("404s for a job the user didn't submit through abaci", async () => {
      await insertConnection()
      const request = new NextRequest('http://localhost:3000/api/abacus/print/jobs/job-999')
      const res = await getJob(request, ctx({ id: 'job-999' }))
      expect(res.status).toBe(404)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('proxies an owned job through its recorded connection', async () => {
      const connection = await insertConnection()
      await db.insert(schema.printJobs).values({
        jobId: 'job-42',
        connectionId: connection.id,
        userId: USER,
        printerId: 'printer-1',
      })
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ id: 'job-42', phase: 'printing' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )

      const request = new NextRequest('http://localhost:3000/api/abacus/print/jobs/job-42')
      const res = await getJob(request, ctx({ id: 'job-42' }))

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ id: 'job-42', phase: 'printing' })
      expect(fetchMock.mock.calls[0][0]).toBe('https://things.haunt.house/api/print/v1/jobs/job-42')
    })
  })
})
