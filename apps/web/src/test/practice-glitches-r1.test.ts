/**
 * @vitest-environment node
 *
 * K5a-3c R1, the glitch record's server side (practice-kinds plan of record
 * §8 A23.3, A23.7 R1 acceptance), against the real query path
 * (EphemeralDatabase, every migration applied):
 * - the route's whitelist: every kind's detail; an unknown kind, a bad ref,
 *   5 KB of detail → 400 `MALFORMED_GLITCH` and `kind="malformed"` counted;
 * - 403 then 404, in the record route's order;
 * - idempotent by `(session, ref)` (`stored: false` on the resend, one row);
 * - the 50-row cap (429 `GLITCH_LIMIT`; a resend at the cap still answers);
 * - `loadSessionReport` carries `glitches` (`count: 0` when none) and
 *   `summarizeSessionReport` the count;
 * - MCP `get_glitch`, through the MCP route's no-`player_id` branch: the
 *   key's own player's rows, never another user's, both sessions of a shared
 *   ref;
 * - the counter's labels are the fixed set (read from `metricsRegistry`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import type { SessionPart, SessionSummary, SlotResult } from '@/db/schema/session-plans'
import {
  createEphemeralDatabase,
  createTestStudent,
  type EphemeralDbResult,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
} from './journey-simulator/EphemeralDatabase'

vi.mock('server-only', () => ({}))
vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))
vi.mock('@/lib/auth/withAuth', () => ({ withAuth: (handler: unknown) => handler }))
vi.mock('@/lib/viewer', () => ({ getUserId: async () => 'adult' }))
const allowed = vi.hoisted(() => ({ value: true }))
vi.mock('@/lib/classroom', () => ({ canPerformAction: async () => allowed.value }))
const mcpKeyUser = vi.hoisted(() => ({ value: 'nobody' }))
vi.mock('@/lib/mcp/auth', () => ({ validateMcpApiKey: async () => mcpKeyUser.value }))

// After the mocks: the routes load `@/db` (the factory reads the imports above)
const { POST: glitchPOST } = await import(
  '@/app/api/curriculum/[playerId]/sessions/plans/[planId]/glitches/route'
)
const { POST: mcpPOST } = await import('@/app/api/mcp/route')
const { loadSessionReport } = await import('@/lib/curriculum/session-report-server')
const { summarizeSessionReport } = await import('@/lib/curriculum/session-report')
const { getPracticeSessions } = await import('@/lib/mcp/tools')
const { GLITCH_KINDS, GLITCH_SESSION_LIMIT, SAVE_REJECTED_LABELS } = await import(
  '@/lib/curriculum/glitches'
)
const { metricsRegistry, practiceGlitchesTotal } = await import('@/lib/metrics')
const { BUILD_ID } = await import('@/lib/build-id')

let eph: EphemeralDbResult
let playerId: string
let userId: string

beforeEach(async () => {
  allowed.value = true
  practiceGlitchesTotal.reset()
  eph = createEphemeralDatabase()
  setCurrentEphemeralDb(eph.db)
  ;({ playerId, userId } = await createTestStudent(eph.db, 'glitch-kid'))
  mcpKeyUser.value = userId
  await insertPlan('plan-a', playerId)
})

afterEach(() => {
  setCurrentEphemeralDb(null)
  eph.cleanup()
})

// ============================================================================
// Helpers
// ============================================================================

/** A finished one-part session of two tries */
async function insertPlan(id: string, owner: string, startedAt = new Date()) {
  const results = [0, 1].map((i) => {
    const problem = { terms: [i + 1, 1], answer: i + 2, skillsRequired: [] }
    return {
      tryId: `try-${id}-${i}`,
      slotId: `s${i}`,
      partNumber: 1,
      slotIndex: i,
      problem,
      studentAnswer: problem.answer,
      isCorrect: true,
      responseTimeMs: 3000,
      skillsExercised: [],
      usedOnScreenAbacus: false,
      hadHelp: false,
      incorrectAttempts: 0,
      timestamp: startedAt,
    } as unknown as SlotResult
  })
  const parts = [
    {
      kind: 'arithmetic',
      partNumber: 1,
      type: 'abacus',
      format: 'vertical',
      useAbacus: true,
      estimatedMinutes: 3,
      slots: results.map((r, index) => ({
        slotId: `s${index}`,
        index,
        purpose: 'focus',
        constraints: {},
        problem: r.problem,
      })),
    } as SessionPart,
  ]
  await eph.db.insert(schema.sessionPlans).values({
    id,
    playerId: owner,
    targetDurationMinutes: 10,
    estimatedProblemCount: results.length,
    avgTimePerProblemSeconds: 5,
    parts,
    summary: {} as SessionSummary,
    status: 'completed',
    results,
    adjustments: [],
    createdAt: startedAt,
    startedAt,
    completedAt: new Date(startedAt.getTime() + 60_000),
  })
}

type Handler = (request: Request, context: { params: Promise<unknown> }) => Promise<Response>

/** POST a glitch as the browser would; the status and the JSON body */
async function post(body: unknown, params: { playerId?: string; planId?: string } = {}) {
  const response = await (glitchPOST as unknown as Handler)(
    new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'user-agent': 'TestAgent/1.0' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ playerId, planId: 'plan-a', ...params }) }
  )
  return { status: response.status, body: await response.json() }
}

const TRY = { tryId: 'try-plan-a-0', partIndex: 0, itemId: 's0', round: 0, mode: 'first_or_retry' }
const CONTEXT = { outboxDepth: 1, online: true, visible: true }

/** A valid detail per kind, every whitelisted field set */
const DETAILS: Record<(typeof GLITCH_KINDS)[number], Record<string, unknown>> = {
  verdict_corrected: {
    ...TRY,
    shown: true,
    stored: false,
    answer: '4',
    submittedAt: 1000,
    repliedAt: 1200,
    slidBeforeReply: false,
    ...CONTEXT,
  },
  save_delayed: {
    tries: 2,
    attempts: 3,
    firstEnqueuedAt: 1000,
    pillShownAt: 6000,
    resolvedAfterMs: 9000,
    lastFailure: 'network',
    ...CONTEXT,
  },
  stale_screen: {
    ...TRY,
    reason: 'not_current',
    expectedItemId: 's1',
    serverFlowState: 'practicing',
    screenFlowState: 'practicing',
    ...CONTEXT,
  },
  do_over_refused: { ...TRY, mode: 'do_over', reason: 'divulged', ...CONTEXT },
  save_rejected: { ...TRY, status: 400, code: 'MALFORMED_TRY', ...CONTEXT },
  try_lost_at_end: {
    ...TRY,
    answer: 7,
    enqueuedAt: 1000,
    planStatus: 'completed',
    endedBy: 'teacher',
    drainedBy: 'summary',
    ...CONTEXT,
  },
}

let refCounter = 0
/** A fresh valid reference (`GL-` + 4 of the alphabet) */
function nextRef(): string {
  const alphabet = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
  let n = refCounter++
  let out = ''
  for (let i = 0; i < 4; i++) {
    out += alphabet[n % alphabet.length]
    n = Math.floor(n / alphabet.length)
  }
  return `GL-${out}`
}

function glitch(
  kind: string,
  detail: unknown = DETAILS[kind as keyof typeof DETAILS],
  ref = nextRef()
) {
  return { ref, kind, clientAt: 1_795_000_000_000, clientBuild: 'abc1234', detail }
}

async function rows() {
  return eph.db.select().from(schema.practiceGlitches)
}

/** The counter's samples as `kind/detail → value` */
async function counterSamples(): Promise<Record<string, number>> {
  const metric = await practiceGlitchesTotal.get()
  return Object.fromEntries(
    metric.values.map((v) => [`${v.labels.kind}/${v.labels.detail}`, v.value])
  )
}

// ============================================================================
// The route
// ============================================================================

describe('POST glitches: the whitelist', () => {
  it.each(GLITCH_KINDS)('stores a %s with its whitelisted detail, whole', async (kind) => {
    const body = glitch(kind, { ...DETAILS[kind], extra: 'dropped', name: 'Sonia' })
    const answer = await post(body)
    expect(answer.status).toBe(200)
    expect(answer.body).toMatchObject({ ref: body.ref, stored: true })
    const [row] = await rows()
    expect(row).toMatchObject({
      id: answer.body.id,
      ref: body.ref,
      kind,
      sessionPlanId: 'plan-a',
      playerId,
      clientBuild: 'abc1234',
      serverBuild: BUILD_ID,
      userAgent: 'TestAgent/1.0',
      clientAt: body.clientAt,
    })
    // Every whitelisted field kept, anything else dropped
    expect(row.detail).toEqual(DETAILS[kind])
    expect(typeof row.createdAt).toBe('number')
  })

  it('refuses an unknown kind, a bad ref and 5 KB of detail, and counts each as malformed', async () => {
    const refused = [
      glitch('verdict_corected'),
      glitch('stale_screen', DETAILS.stale_screen, 'GL-7K2'),
      glitch('stale_screen', DETAILS.stale_screen, 'GL-7K2O'), // O is not in the alphabet
      glitch('stale_screen', DETAILS.stale_screen, 'gl-7k2q'),
      glitch('save_rejected', { ...DETAILS.save_rejected, pad: 'x'.repeat(5 * 1024) }),
    ]
    for (const body of refused) {
      const answer = await post(body)
      expect(answer.status, JSON.stringify(body).slice(0, 60)).toBe(400)
      expect(answer.body.code).toBe('MALFORMED_GLITCH')
    }
    expect(await rows()).toHaveLength(0)
    expect(await counterSamples()).toEqual({ 'malformed/none': refused.length })
  })

  it('refuses a mistyped or missing required field, and a correction that agrees', async () => {
    const refused = [
      glitch('verdict_corrected', { ...DETAILS.verdict_corrected, stored: true }), // no correction
      glitch('verdict_corrected', { ...DETAILS.verdict_corrected, shown: 'yes' }),
      glitch('save_delayed', { ...DETAILS.save_delayed, lastFailure: 'offline' }),
      glitch('stale_screen', { ...DETAILS.stale_screen, reason: undefined }),
      glitch('do_over_refused', { ...DETAILS.do_over_refused, reason: 'not_current' }),
      glitch('try_lost_at_end', { ...DETAILS.try_lost_at_end, planStatus: undefined }),
      glitch('stale_screen', { ...DETAILS.stale_screen, round: -1 }),
      { ...glitch('stale_screen'), clientAt: 'now' },
      { ...glitch('stale_screen'), detail: [] },
    ]
    for (const body of refused) {
      expect((await post(body)).status, JSON.stringify(body).slice(0, 80)).toBe(400)
    }
    expect(await rows()).toHaveLength(0)
  })
})

describe('POST glitches: auth in the record route order', () => {
  it('403 before anything else, even for a plan that is not the player’s', async () => {
    allowed.value = false
    expect((await post(glitch('stale_screen'))).status).toBe(403)
    expect((await post(glitch('stale_screen'), { planId: 'no-such-plan' })).status).toBe(403)
    expect((await post({ junk: true })).status).toBe(403)
    expect(await rows()).toHaveLength(0)
  })

  it('404 for a missing plan or one of another player, before the body is read', async () => {
    const other = await createTestStudent(eph.db, 'other-kid')
    await insertPlan('plan-other', other.playerId)
    expect((await post(glitch('stale_screen'), { planId: 'no-such-plan' })).status).toBe(404)
    expect((await post(glitch('stale_screen'), { planId: 'plan-other' })).status).toBe(404)
    // A malformed body on a plan not the player's is still 404, not 400
    expect((await post({ junk: true }, { planId: 'plan-other' })).status).toBe(404)
    expect(await rows()).toHaveLength(0)
  })
})

describe('POST glitches: idempotency and the cap', () => {
  it('a resend of the same (session, ref) answers stored: false and writes nothing', async () => {
    const body = glitch('verdict_corrected')
    const first = await post(body)
    const again = await post(body)
    expect(first.body).toMatchObject({ ref: body.ref, stored: true })
    expect(again.status).toBe(200)
    expect(again.body).toEqual({ id: first.body.id, ref: body.ref, stored: false })
    expect(await rows()).toHaveLength(1)
    // Counted once: the resend is not a second glitch
    expect(await counterSamples()).toEqual({ 'verdict_corrected/shown_right_stored_wrong': 1 })
  })

  it('the same ref in another session is its own row', async () => {
    await insertPlan('plan-b', playerId)
    const body = glitch('stale_screen')
    expect((await post(body)).body.stored).toBe(true)
    expect((await post(body, { planId: 'plan-b' })).body.stored).toBe(true)
    expect(await rows()).toHaveLength(2)
  })

  it(`holds a session to ${50} rows: 429 GLITCH_LIMIT past it, a resend still answers`, async () => {
    expect(GLITCH_SESSION_LIMIT).toBe(50)
    const bodies = Array.from({ length: GLITCH_SESSION_LIMIT }, () => glitch('save_delayed'))
    for (const body of bodies) expect((await post(body)).status).toBe(200)
    const over = await post(glitch('save_delayed'))
    expect(over.status).toBe(429)
    expect(over.body.code).toBe('GLITCH_LIMIT')
    expect(await rows()).toHaveLength(GLITCH_SESSION_LIMIT)
    const resend = await post(bodies[0])
    expect(resend.status).toBe(200)
    expect(resend.body.stored).toBe(false)
    // Another session is not held by this one's cap
    await insertPlan('plan-b', playerId)
    expect((await post(glitch('save_delayed'), { planId: 'plan-b' })).status).toBe(200)
  })
})

// ============================================================================
// The report
// ============================================================================

describe('the report carries glitches', () => {
  async function report(planId = 'plan-a') {
    const plan = await eph.db.query.sessionPlans.findFirst({
      where: (p, { eq }) => eq(p.id, planId),
    })
    return loadSessionReport(plan!)
  }

  it('a session with none reads count 0', async () => {
    const r = await report()
    expect(r.glitches).toEqual({ count: 0, byKind: {}, refs: [] })
    expect(r.glitches).toMatchObject({ count: 0 })
    expect(summarizeSessionReport(r).glitches).toEqual({ count: 0 })
  })

  it('counts by kind; the count and refs leave out save_delayed; the summary carries the count', async () => {
    const corrected = glitch('verdict_corrected')
    const delayed = glitch('save_delayed')
    const lost = glitch('try_lost_at_end')
    for (const body of [corrected, delayed, lost]) await post(body)
    const r = await report()
    expect(r.glitches).toEqual({
      count: 2,
      byKind: { verdict_corrected: 1, save_delayed: 1, try_lost_at_end: 1 },
      refs: [corrected.ref, lost.ref],
    })
    expect(summarizeSessionReport(r).glitches).toEqual({ count: 2 })
    // MCP's session list: the same count, through the batch builder
    const [row] = await getPracticeSessions(playerId, 3650)
    expect(row).toMatchObject({ sessionId: 'plan-a', glitches: 2 })
  })
})

// ============================================================================
// MCP get_glitch
// ============================================================================

describe('MCP get_glitch (no player_id; its own access filter)', () => {
  async function callTool(name: string, args: Record<string, unknown>) {
    const response = await mcpPOST(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name, arguments: args },
        }),
      })
    )
    const rpc = await response.json()
    const content = rpc.result.content[0].text
    return { isError: rpc.result.isError as boolean, value: JSON.parse(content) }
  }

  it('is listed by tools/list', async () => {
    const response = await mcpPOST(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-key' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      })
    )
    const names = (await response.json()).result.tools.map((t: { name: string }) => t.name)
    expect(names).toContain('get_glitch')
  })

  it("returns the key's own player's rows, whole, both sessions of a shared ref, newest first; never another user's", async () => {
    const ref = 'GL-7K2Q'
    await insertPlan('plan-b', playerId)
    const other = await createTestStudent(eph.db, 'other-kid')
    await insertPlan('plan-other', other.playerId)

    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date('2026-11-28T10:00:00Z'))
      await post(glitch('verdict_corrected', DETAILS.verdict_corrected, ref))
      vi.setSystemTime(new Date('2026-11-28T11:00:00Z'))
      await post(glitch('stale_screen', DETAILS.stale_screen, ref), { planId: 'plan-b' })
      vi.setSystemTime(new Date('2026-11-28T12:00:00Z'))
      await post(glitch('stale_screen', DETAILS.stale_screen, ref), {
        playerId: other.playerId,
        planId: 'plan-other',
      })
    } finally {
      vi.useRealTimers()
    }
    expect(await rows()).toHaveLength(3)

    // No player_id: the route's no-player_id branch, not "player_id is required"
    const mine = await callTool('get_glitch', { ref: 'gl-7k2q' })
    expect(mine.isError).toBe(false)
    expect(mine.value.ref).toBe(ref)
    expect(mine.value.glitches.map((g: { sessionId: string }) => g.sessionId)).toEqual([
      'plan-b',
      'plan-a',
    ])
    expect(mine.value.glitches[1]).toMatchObject({
      ref,
      kind: 'verdict_corrected',
      sessionId: 'plan-a',
      playerId,
      detail: DETAILS.verdict_corrected,
      clientBuild: 'abc1234',
      serverBuild: BUILD_ID,
      userAgent: 'TestAgent/1.0',
      clientAt: 1_795_000_000_000,
      createdAt: Date.parse('2026-11-28T10:00:00Z'),
      date: '2026-11-28T10:00:00.000Z',
    })

    // The other user's key sees only its own player's row
    mcpKeyUser.value = other.userId
    const theirs = await callTool('get_glitch', { ref })
    expect(theirs.value.glitches.map((g: { sessionId: string }) => g.sessionId)).toEqual([
      'plan-other',
    ])

    // A key with no players sees nothing
    mcpKeyUser.value = 'stranger'
    expect((await callTool('get_glitch', { ref })).value.glitches).toEqual([])
  })

  it('refuses a ref of the wrong shape', async () => {
    const answer = await callTool('get_glitch', { ref: 'nope' })
    expect(answer.isError).toBe(true)
    expect(answer.value.error).toMatch(/GL-XXXX/)
  })
})

// ============================================================================
// The counter
// ============================================================================

describe('practice_glitches_total', () => {
  it('is registered with the kind and detail labels', async () => {
    const text = await metricsRegistry.metrics()
    expect(text).toContain('# TYPE practice_glitches_total counter')
  })

  it("labels every stored glitch from the route's own fixed set, never the client's strings", async () => {
    const send = (kind: keyof typeof DETAILS, over: Record<string, unknown> = {}) =>
      post(glitch(kind, { ...DETAILS[kind], ...over }))
    await send('verdict_corrected')
    await send('verdict_corrected', { shown: false, stored: true })
    await send('save_delayed', { lastFailure: 'timeout' })
    await send('stale_screen', { reason: 'unknown_item' })
    await send('do_over_refused', { reason: 'no_try' })
    await send('save_rejected', { status: 400, code: 'MALFORMED_TRY' })
    await send('save_rejected', { status: 400, code: 'MALFORMED_DO_OVER' })
    await send('save_rejected', { status: 404, code: null })
    await send('save_rejected', { status: 409, code: 'INVALID_FLOW_TRANSITION' })
    await send('save_rejected', { status: 418, code: 'DROP TABLE; <script>' })
    await send('try_lost_at_end', { planStatus: 'completed' })
    await send('try_lost_at_end', { planStatus: 'abandoned' })
    await post(glitch('nonsense'))

    const samples = await counterSamples()
    expect(samples).toEqual({
      'verdict_corrected/shown_right_stored_wrong': 1,
      'verdict_corrected/shown_wrong_stored_right': 1,
      'save_delayed/timeout': 1,
      'stale_screen/unknown_item': 1,
      'do_over_refused/no_try': 1,
      'save_rejected/malformed_try': 1,
      'save_rejected/malformed_do_over': 1,
      'save_rejected/not_found': 1,
      'save_rejected/flow': 1,
      'save_rejected/other': 1,
      'try_lost_at_end/completed': 1,
      'try_lost_at_end/ended': 1,
      'malformed/none': 1,
    })

    // Every label value is in the fixed set A23.3 names
    const FIXED: Record<string, readonly string[]> = {
      verdict_corrected: ['shown_right_stored_wrong', 'shown_wrong_stored_right'],
      stale_screen: ['not_current', 'unknown_item', 'not_practicing'],
      do_over_refused: ['divulged', 'no_try', 'not_accepted'],
      save_delayed: ['timeout', 'network', 'http_5xx', 'contention', 'unknown_kind'],
      save_rejected: SAVE_REJECTED_LABELS,
      try_lost_at_end: ['ended', 'completed'],
      malformed: ['none'],
    }
    const metric = await practiceGlitchesTotal.get()
    for (const { labels } of metric.values) {
      expect(FIXED[String(labels.kind)], String(labels.kind)).toContain(String(labels.detail))
    }
  })
})
