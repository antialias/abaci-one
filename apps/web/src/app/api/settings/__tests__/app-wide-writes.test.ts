// @vitest-environment node
/**
 * The /api/settings/* rows that every child's sessions read (voice chain,
 * audio voice, BKT, practice config) are admin-only to change, and open to
 * read. Runs through the real withAuth, route enforcer and role resolver;
 * only the session and the database are stand-ins.
 */
import { sql } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db'

vi.mock('@/db', async () => {
  const schema = await vi.importActual<typeof import('@/db/schema')>('@/db/schema')
  const { createClient } = await import('@libsql/client')
  const { drizzle } = await import('drizzle-orm/libsql')
  return { db: drizzle(createClient({ url: ':memory:' }), { schema }), schema }
})

let session: { user: { id: string; email: string } } | null = null
vi.mock('@/auth', () => ({ auth: vi.fn(async () => session) }))

import * as audioVoice from '../audio-voice/route'
import * as bkt from '../bkt/route'
import * as practiceConfig from '../practice-config/route'
import * as voiceChain from '../voice-chain/route'

type Handler = (req: NextRequest) => Promise<Response>

const writes: Array<[string, Handler, unknown]> = [
  ['voice-chain', voiceChain.PATCH as Handler, { voiceChain: [{ type: 'subtitle' }] }],
  ['audio-voice', audioVoice.PATCH as Handler, { audioVoice: 'el-onwK4e9ZLuTAKqWW03F9' }],
  ['bkt', bkt.PATCH as Handler, { bktConfidenceThreshold: 0.5 }],
  ['practice-config', practiceConfig.PATCH as Handler, { config: null }],
]
const reads: Array<[string, Handler]> = [
  ['voice-chain', voiceChain.GET as Handler],
  ['audio-voice', audioVoice.GET as Handler],
  ['bkt', bkt.GET as Handler],
  ['practice-config', practiceConfig.GET as Handler],
]

const patch = (name: string, body: unknown) =>
  new NextRequest(`https://abaci.one/api/settings/${name}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

async function voiceChainRow(): Promise<string | null> {
  const rows = await db.all<{ voice_chain: string | null }>(
    sql.raw("SELECT voice_chain FROM app_settings WHERE id = 'default'")
  )
  return rows[0]?.voice_chain ?? null
}

beforeAll(async () => {
  await db.run(sql.raw('CREATE TABLE users (id text PRIMARY KEY NOT NULL, role text)'))
  await db.run(
    sql.raw(
      "CREATE TABLE app_settings (id text PRIMARY KEY DEFAULT 'default' NOT NULL, bkt_confidence_threshold real DEFAULT 0.3 NOT NULL, audio_voice text DEFAULT 'nova' NOT NULL, voice_chain text, term_count_scaling text, pricing text, notification_channels text)"
    )
  )
  await db.run(
    sql.raw("INSERT INTO users (id, role) VALUES ('u-parent', 'user'), ('u-admin', 'admin')")
  )
})

beforeEach(async () => {
  session = null
  await db.run(sql.raw('DELETE FROM app_settings'))
  await db.run(
    sql.raw(
      `INSERT INTO app_settings (id, voice_chain) VALUES ('default', '[{"type":"pregenerated","name":"el-onwK4e9ZLuTAKqWW03F9"}]')`
    )
  )
})

const asParent = () => {
  session = { user: { id: 'u-parent', email: 'parent@example.com' } }
}
const asAdmin = () => {
  session = { user: { id: 'u-admin', email: 'admin@example.com' } }
}

describe('app-wide settings writes', () => {
  it.each(writes)('%s PATCH: a guest gets 401', async (name, handler, body) => {
    const res = await handler(patch(name, body))
    expect(res.status).toBe(401)
  })

  it.each(writes)('%s PATCH: a signed-in parent gets 403', async (name, handler, body) => {
    asParent()
    const res = await handler(patch(name, body))
    expect(res.status).toBe(403)
  })

  it.each(writes)('%s PATCH: an admin can change it', async (name, handler, body) => {
    asAdmin()
    const res = await handler(patch(name, body))
    expect(res.status).toBe(200)
  })

  it("a guest's silence-everyone request changes nothing", async () => {
    const before = await voiceChainRow()
    await voiceChain.PATCH(patch('voice-chain', { voiceChain: [{ type: 'subtitle' }] }), {})
    expect(await voiceChainRow()).toBe(before)
  })

  it.each(reads)('%s GET stays open to guests', async (name, handler) => {
    const res = await handler(new NextRequest(`https://abaci.one/api/settings/${name}`))
    expect(res.status).toBe(200)
  })
})
