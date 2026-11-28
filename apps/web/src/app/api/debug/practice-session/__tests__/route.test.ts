/**
 * @vitest-environment node
 *
 * The dev route's presets (practice-kinds §4 K4): they name their parts as
 * `(kind, presentation)`, and the owner's hand test, `preset: 'minimal'`,
 * still starts a one-part, one-problem abacus session with no break. Runs the
 * route on `EphemeralDatabase` through the real generator.
 */

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import { playerSessionPreferences } from '@/db/schema/player-session-preferences'
import {
  createEphemeralDatabase,
  createTestStudent,
  type EphemeralDbResult,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
} from '@/test/journey-simulator/EphemeralDatabase'

vi.mock('server-only', () => ({}))
vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))
vi.mock('@/lib/auth/withAuth', () => ({ withAuth: (handler: unknown) => handler }))
const { viewer } = vi.hoisted(() => ({ viewer: { userId: '' } }))
vi.mock('@/lib/viewer', () => ({ getUserId: async () => viewer.userId }))

const { POST } = await import('../route')

async function post(body: unknown) {
  const res = await (POST as unknown as (req: Request) => Promise<Response>)(
    new Request('http://test/api/debug/practice-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

async function planOf(sessionId: string) {
  const [plan] = await getCurrentEphemeralDb()
    .select()
    .from(schema.sessionPlans)
    .where(eq(schema.sessionPlans.id, sessionId))
  return plan
}

describe('dev route presets name (kind, presentation) (K4)', () => {
  let eph: EphemeralDbResult

  beforeEach(async () => {
    eph = createEphemeralDatabase()
    setCurrentEphemeralDb(eph.db)
    ;({ userId: viewer.userId } = await createTestStudent(eph.db, 'devroute'))
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    setCurrentEphemeralDb(null)
    eph.cleanup()
  })

  it("the owner's hand test: preset minimal starts one abacus part of one problem, no break", async () => {
    const { status, json } = await post({ preset: 'minimal' })
    expect(status, JSON.stringify(json)).toBe(200)
    expect(json.preset).toBe('minimal')
    expect(json.redirectUrl).toBe(`/practice/${json.playerId}?debug=1`)

    const plan = await planOf(json.sessionId as string)
    expect(plan.status).toBe('in_progress')
    expect(plan.parts.map((p) => [p.kind ?? 'arithmetic', p.presentation ?? p.type])).toEqual([
      ['arithmetic', 'abacus'],
    ])
    expect(plan.parts[0].slots).toHaveLength(1)
    expect(plan.gameBreakSettings?.enabled).toBe(false)
  })

  it('preset game-break: abacus then visualization, one problem each, the break on', async () => {
    const { status, json } = await post({ preset: 'game-break' })
    expect(status, JSON.stringify(json)).toBe(200)
    const plan = await planOf(json.sessionId as string)
    expect(plan.parts.map((p) => [p.kind ?? 'arithmetic', p.presentation ?? p.type])).toEqual([
      ['arithmetic', 'abacus'],
      ['arithmetic', 'visualization'],
    ])
    expect(plan.parts.map((p) => p.slots.length)).toEqual([1, 1])
    expect(plan.gameBreakSettings).toMatchObject({ enabled: true, selectedGame: 'matching' })
  })

  it('setupOnly saves the preset as preferences: a weight per presentation it names', async () => {
    const { status, json } = await post({ preset: 'minimal', setupOnly: true })
    expect(status, JSON.stringify(json)).toBe(200)
    const [prefs] = await getCurrentEphemeralDb()
      .select()
      .from(playerSessionPreferences)
      .where(eq(playerSessionPreferences.playerId, json.playerId as string))
    expect(JSON.parse(prefs.config).partWeights).toEqual({
      abacus: 1,
      visualization: 0,
      linear: 0,
    })
  })

  it('an unknown preset is a 400 that lists the presets', async () => {
    const { status, json } = await post({ preset: 'nope' })
    expect(status).toBe(400)
    expect(json.error).toContain('minimal')
  })
})
