/**
 * @vitest-environment node
 *
 * Practice kinds K1b (plan of record §4 K1): the evidence readers move from
 * the arithmetic fields (`skillsExercised`, the part's `type`) onto the try
 * envelope K1a writes (`evidence.skills`, `mode` from
 * `masteryModeOf(evidence.presentation)`). BKT parity is the gate.
 *
 * Differential, in one run: `src/test/pre-k1b/` holds VERBATIM copies of
 * the readers at origin/main `76b2cc46c`, before K1b (the in-JS history with
 * its `skillsExercised` filter and `partType ?? 'linear'`, the SQL
 * projection's `toBktEvidence` with `bktModeOf`, `computeBktFromHistory`
 * keyed by `partType`, readiness and the linear gate). Both are run on the
 * same stored rows, for every seeded profile (`lib/seed/profiles.ts`), and
 * must agree on pKnown, classification, opportunities, per-mode BKT,
 * readiness and the linear gate, through both the in-JS history and the SQL
 * evidence projection. No recorded snapshot: a seed change re-runs both.
 *
 * The rows, made by the real seed generator (`generateSlotResults`,
 * `seededSessionRows`) under a seeded `Math.random`, mix:
 * - rows stamped with the envelope (spread over abacus, visualization and
 *   linear parts);
 * - `simulateLegacyData` rows, which the seeder leaves pre-K1 (amendment A6);
 * - one session of unstamped rows in parts stored without a `type` (they
 *   resolve to `linear`, as before);
 * - retries, do-overs, a voided row, a teacher-excluded row and a
 *   practice-only do-over in every session;
 * - a recency-refresh sentinel in a plan with no parts (`linear`);
 * - a stamped row with `evidence: null` and no `skillsExercised` (what the
 *   K1a recorder writes for a row that is not evidence);
 * - two rows with `evidence` and no `skillsExercised` (S2: the row a new kind
 *   writes), on a skill of their own.
 * The S2 rows were dropped before K1b, so old and new are compared on the
 * profile's own skills; what K1b adds for S2 is asserted after.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import type { SessionPart, SlotResult } from '@/db/schema/session-plans'
import { computeBktFromHistory } from '@/lib/curriculum/bkt'
import { batchGetRecentBktEvidence } from '@/lib/curriculum/bkt/evidence-query'
import type { BktComputeResult, SkillBktResult } from '@/lib/curriculum/bkt/types'
import { DEFAULT_LINEAR_GATE_THRESHOLDS, deriveLinearGateState } from '@/lib/curriculum/linear-gate'
import { batchGetRecentSessionResults } from '@/lib/curriculum/session-planner'
import { assessAllSkillsReadiness } from '@/lib/curriculum/skill-readiness'
import { SeededRandom } from '@/lib/SeededRandom'
import { generateSlotResults, seededSessionRows } from '@/lib/seed/helpers'
import { TEST_PROFILES } from '@/lib/seed/profiles'
import {
  createEphemeralDatabase,
  createTestStudent,
  type EphemeralDbResult,
  getCurrentEphemeralDb,
  setCurrentEphemeralDb,
} from '@/test/journey-simulator/EphemeralDatabase'
import { computeBktFromHistory as oldComputeBktFromHistory } from '@/test/pre-k1b/compute-bkt'
import { batchGetRecentBktEvidence as oldBatchGetRecentBktEvidence } from '@/test/pre-k1b/evidence-query'
import { batchGetRecentSessionResults as oldBatchGetRecentSessionResults } from '@/test/pre-k1b/history'
import { deriveLinearGateState as oldDeriveLinearGateState } from '@/test/pre-k1b/linear-gate'
import { assessAllSkillsReadiness as oldAssessAllSkillsReadiness } from '@/test/pre-k1b/skill-readiness'

vi.mock('server-only', () => ({}))

vi.mock('@/db', () => ({
  get db() {
    return getCurrentEphemeralDb()
  },
  schema,
}))

const NOW = new Date('2026-11-20T12:00:00Z')
const BASE = new Date('2026-11-15T10:00:00Z').getTime()
const DAY = 86_400_000
const TYPES = ['abacus', 'visualization', 'linear'] as const
/** The S2 rows' skill: evidence only, no `skillsExercised` */
const S2_SKILL = 'k1bOnly.evidenceWithoutSkillsExercised'

type StoredSession = {
  id: string
  status: 'completed' | 'recency-refresh'
  parts: SessionPart[]
  results: SlotResult[]
  completedAt: Date
}

function partsOf(rows: readonly SlotResult[], typeless: boolean): SessionPart[] {
  return TYPES.map((type, i) => {
    const part = {
      partNumber: (i + 1) as 1 | 2 | 3,
      type,
      format: type === 'linear' ? 'linear' : 'vertical',
      useAbacus: type === 'abacus',
      estimatedMinutes: 5,
      slots: rows
        .filter((r) => r.partNumber === i + 1)
        .map((r) => ({
          slotId: r.slotId,
          index: r.slotIndex,
          purpose: 'focus' as const,
          constraints: {},
          problem: r.problem,
        })),
    } as SessionPart
    if (typeless) delete (part as Partial<SessionPart>).type
    return part
  })
}

/** A profile's sessions as stored; `skills` = every skill its own rows exercise. */
function fixtureOf(profileIndex: number): { sessions: StoredSession[]; skills: Set<string> } {
  const profile = TEST_PROFILES[profileIndex]
  const sessions: StoredSession[] = []
  const skills = new Set<string>()

  profile.skillHistory.forEach((config, ci) => {
    const start = BASE - (config.ageDays ?? 1) * DAY - ci * 600_000
    const generated = generateSlotResults(config, 0, new Date(start))
    // Spread over the three presentations: abacus, visualization, linear
    const rows: SlotResult[] = generated.map((r, i) => ({
      ...r,
      partNumber: ((i % 3) + 1) as 1 | 2 | 3,
      slotIndex: Math.floor(i / 3),
    }))
    for (const r of rows) for (const s of r.skillsExercised) skills.add(s)
    // The first config's session: unstamped rows in parts with no `type`
    const typeless = ci === 0
    const parts = partsOf(rows, typeless)
    const stored = typeless
      ? rows
      : seededSessionRows(
          rows.map((result) => ({ result, simulateLegacyData: config.simulateLegacyData })),
          parts
        )
    // A stamped row that is not evidence: `evidence: null`, no skillsExercised
    const { skillsExercised: _none, ...notEvidence } = rows[0]
    const last = rows.length * 10_000
    // Retries, do-overs and the rows that count nowhere or at zero weight,
    // copied from the session's own rows (stamped or not, as they are)
    const at = (i: number) => stored[i % stored.length]
    const extra = (i: number, n: number, over: Partial<SlotResult>): SlotResult => ({
      ...at(i),
      tryId: `${at(i).tryId ?? at(i).slotId}-x${n}`,
      timestamp: new Date(start + last + n * 1_000),
      ...over,
    })
    const extras: SlotResult[] = stored.length
      ? [
          extra(1, 1, { isCorrect: false, masteryWeight: 0 }),
          extra(1, 2, {
            isRetry: true,
            epochNumber: 1,
            kind: 'retry',
            round: 1,
            masteryWeight: 0.5,
          }),
          extra(2, 3, {
            isRetry: true,
            epochNumber: 2,
            kind: 'retry',
            round: 2,
            isCorrect: false,
            masteryWeight: 0,
          }),
          extra(3, 4, { isManualRedo: true, kind: 'do_over', round: 0, masteryWeight: 1 }),
          extra(4, 5, { voided: true }),
          extra(5, 6, { source: 'teacher-excluded', isCorrect: false }),
          extra(6, 7, { isManualRedo: true, kind: 'do_over', round: 1, practiceOnly: true }),
        ]
      : []
    sessions.push({
      id: `p${profileIndex}-c${ci}`,
      status: 'completed',
      parts,
      results: [
        ...stored,
        ...extras,
        {
          ...notEvidence,
          timestamp: new Date(start + last),
          itemId: rows[0].slotId,
          outcome: 'answered',
          answer: rows[0].studentAnswer,
          evidence: null,
          payload: { kind: 'arithmetic' },
        } as SlotResult,
      ],
      completedAt: new Date(start + last + 10_000),
    })
  })

  // A recency-refresh sentinel: a plan with no parts ('linear', as before)
  const first = profile.skillHistory[0]?.skillId
  if (first) {
    sessions.push({
      id: `p${profileIndex}-sentinel`,
      status: 'recency-refresh',
      parts: [],
      results: [
        {
          slotId: 'sentinel',
          partNumber: 1,
          slotIndex: 0,
          problem: { terms: [], answer: 0, skillsRequired: [first] },
          studentAnswer: 0,
          isCorrect: true,
          responseTimeMs: 0,
          skillsExercised: [first],
          usedOnScreenAbacus: false,
          timestamp: new Date(BASE - 3_600_000),
          hadHelp: false,
          incorrectAttempts: 0,
          source: 'recency-refresh',
        },
      ],
      completedAt: new Date(BASE - 3_600_000),
    })
  }

  // S2: rows with `evidence` and no `skillsExercised` (a new kind's row)
  const s2Start = BASE - 2 * 3_600_000
  const s2Row = (i: number, isCorrect: boolean) =>
    ({
      tryId: `s2-${profileIndex}-${i}`,
      itemId: `s2-item-${i}`,
      partNumber: 1,
      partIndex: 0,
      kind: 'first',
      round: 0,
      practiceOnly: false,
      isCorrect,
      responseTimeMs: 4_000,
      timestamp: new Date(s2Start + i * 10_000),
      hadHelp: false,
      incorrectAttempts: 0,
      outcome: 'answered',
      answer: 7,
      evidence: { skills: [S2_SKILL], presentation: 'abacus' },
      payload: { kind: 'arithmetic' },
    }) as unknown as SlotResult
  sessions.push({
    id: `p${profileIndex}-s2`,
    status: 'completed',
    parts: partsOf([], false).slice(0, 1),
    results: [s2Row(0, true), s2Row(1, false)],
    completedAt: new Date(s2Start + 30_000),
  })

  return { sessions, skills }
}

async function store(playerId: string, sessions: readonly StoredSession[]) {
  for (const s of sessions) {
    await getCurrentEphemeralDb()
      .insert(schema.sessionPlans)
      .values({
        id: `${playerId}-${s.id}`,
        playerId,
        status: s.status,
        parts: s.parts,
        results: s.results,
        completedAt: s.completedAt,
        createdAt: s.completedAt,
        targetDurationMinutes: 12,
        estimatedProblemCount: s.results.length,
        avgTimePerProblemSeconds: 5,
        summary: { parts: [] } as never,
      })
  }
}

/** Everything a decision reads from one BKT skill, dates as ISO */
function skillView(s: SkillBktResult) {
  return { ...s, lastPracticedAt: s.lastPracticedAt?.toISOString() ?? null }
}

function bktView(result: BktComputeResult, skills: ReadonlySet<string> | null) {
  const kept = (list: SkillBktResult[]) =>
    list.filter((s) => skills === null || skills.has(s.skillId))
  const keep = (list: SkillBktResult[]) => kept(list).map(skillView)
  const ids = (list: SkillBktResult[]) => kept(list).map((s) => s.skillId)
  return {
    skills: keep(result.skills),
    interventionNeeded: ids(result.interventionNeeded),
    strengths: ids(result.strengths),
    // A mode none of the profile's own skills reached is left out: the S2
    // rows (counted since K1b, never before) can open one alone.
    byMode: Object.fromEntries(
      Object.entries(result.byMode ?? {})
        .filter(([, r]) => skills === null || !r || kept(r.skills).length > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mode, r]) => [
          mode,
          r
            ? {
                skills: keep(r.skills),
                interventionNeeded: ids(r.interventionNeeded),
                strengths: ids(r.strengths),
              }
            : r,
        ])
    ),
  }
}

let ephemeralDb: EphemeralDbResult

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterAll(() => {
  vi.useRealTimers()
})

beforeEach(() => {
  ephemeralDb = createEphemeralDatabase()
  setCurrentEphemeralDb(ephemeralDb.db)
})

afterEach(() => {
  vi.restoreAllMocks()
  setCurrentEphemeralDb(null)
  ephemeralDb.cleanup()
})

/** The profile's fixture stored, read back through both evidence paths, old and new. */
async function readProfile(profileIndex: number) {
  const rng = new SeededRandom(1_000 + profileIndex)
  const random = vi.spyOn(Math, 'random').mockImplementation(() => rng.next())
  const { sessions, skills } = fixtureOf(profileIndex)
  random.mockRestore()
  const { playerId } = await createTestStudent(ephemeralDb.db, `k1b-${profileIndex}`)
  await store(playerId, sessions)
  const ids = [playerId]
  const history = (await batchGetRecentSessionResults(ids, 5_000)).get(playerId) ?? []
  const sqlEvidence = (await batchGetRecentBktEvidence(ids, 5_000)).get(playerId) ?? []
  const oldHistory = (await oldBatchGetRecentSessionResults(ids, 5_000)).get(playerId) ?? []
  const oldSqlEvidence = (await oldBatchGetRecentBktEvidence(ids, 5_000)).get(playerId) ?? []
  return { history, sqlEvidence, oldHistory, oldSqlEvidence, skills, sessions }
}

describe('K1b: BKT parity over every seeded profile, old readers against new', () => {
  it.each(TEST_PROFILES.map((p, i) => [p.name, i] as const))(
    '%s: BKT, readiness and the linear gate as the pre-K1b readers, on both paths',
    async (_name, profileIndex) => {
      const { history, sqlEvidence, oldHistory, oldSqlEvidence, skills } =
        await readProfile(profileIndex)
      const bkt = computeBktFromHistory(history)
      const sqlBkt = computeBktFromHistory(sqlEvidence)
      const oldBkt = oldComputeBktFromHistory(oldHistory)
      const oldSqlBkt = oldComputeBktFromHistory(oldSqlEvidence)

      // The fixture reaches BKT at all (a profile with history has skills)
      if (oldHistory.length > 0) expect(oldBkt.skills.length).toBeGreaterThan(0)

      // New: the two paths agree on every skill, the S2 rows' included
      expect(bktView(sqlBkt, null)).toEqual(bktView(bkt, null))
      // Old against new, on the profile's own skills, per path
      expect(bktView(bkt, skills)).toEqual(bktView(oldBkt, skills))
      expect(bktView(sqlBkt, skills)).toEqual(bktView(oldSqlBkt, skills))

      const categories = [...new Set([...skills].map((s) => s.split('.')[0]))].sort()
      const loose = { minAccuracy: 0.6, accuracyWindowSize: 3, minOpportunities: 1 }
      const sorted = <V>(m: Map<string, V>) => [...m].sort(([a], [b]) => a.localeCompare(b))
      expect(sorted(assessAllSkillsReadiness(history, bkt.skills, skills))).toEqual(
        sorted(oldAssessAllSkillsReadiness(oldHistory, oldBkt.skills, skills))
      )
      for (const thresholds of [DEFAULT_LINEAR_GATE_THRESHOLDS, loose]) {
        expect(
          sorted(deriveLinearGateState({ problemHistory: history, categories, thresholds }))
        ).toEqual(
          sorted(oldDeriveLinearGateState({ problemHistory: oldHistory, categories, thresholds }))
        )
      }
    },
    60_000
  )
})

/** One plain arithmetic row (pre-K1: no envelope) */
function plainRow(slotIndex: number, over: Record<string, unknown> = {}): SlotResult {
  return {
    slotId: `slot-${slotIndex}`,
    partNumber: 1,
    slotIndex,
    problem: { terms: [1, 2], answer: 3, skillsRequired: ['basic.directAddition'] },
    studentAnswer: 3,
    isCorrect: true,
    responseTimeMs: 4_000,
    skillsExercised: ['basic.directAddition'],
    usedOnScreenAbacus: false,
    timestamp: new Date(BASE + slotIndex * 10_000),
    hadHelp: false,
    incorrectAttempts: 0,
    ...over,
  } as SlotResult
}

/** One session stored, read back through both paths, rows keyed by responseTimeMs */
async function readOne(parts: unknown[], results: SlotResult[]) {
  const { playerId } = await createTestStudent(ephemeralDb.db, 'k1b-one')
  await store(playerId, [
    {
      id: 'one',
      status: 'completed',
      parts: parts as SessionPart[],
      results,
      completedAt: new Date(BASE + 3_600_000),
    },
  ])
  const history = (await batchGetRecentSessionResults([playerId], 50)).get(playerId) ?? []
  const sql = (await batchGetRecentBktEvidence([playerId], 50)).get(playerId) ?? []
  const view = (rows: { responseTimeMs: number; mode?: string | null; evidence?: unknown }[]) =>
    rows
      .map((r) => [r.responseTimeMs, r.evidence ?? null, r.mode ?? null] as const)
      .sort(([a], [b]) => a - b)
  return { history: view(history), sql: view(sql), historyRows: history, sqlRows: sql }
}

describe('K1b: what the readers read now', () => {
  it('counts the S2 rows (evidence, no skillsExercised) on both paths, in their mode', async () => {
    const { history, sqlEvidence } = await readProfile(0)
    for (const rows of [history, sqlEvidence]) {
      const bkt = computeBktFromHistory(rows)
      expect(bkt.skills.find((s) => s.skillId === S2_SKILL)?.opportunities).toBe(2)
      expect(bkt.byMode?.abacus?.skills.find((s) => s.skillId === S2_SKILL)?.opportunities).toBe(2)
    }
  })

  it('follows evidence.skills over skillsExercised when the two differ', async () => {
    const { historyRows, sqlRows } = await readOne(
      [{ partNumber: 1, type: 'abacus' }],
      [
        plainRow(0, {
          responseTimeMs: 1,
          evidence: { skills: ['basic.heavenBead'], presentation: 'visualization' },
        }),
      ]
    )
    for (const rows of [historyRows, sqlRows]) {
      const skills = computeBktFromHistory(rows).skills.map((s) => s.skillId)
      expect(skills).toEqual(['basic.heavenBead'])
      expect(rows[0].mode).toBe('visualization')
    }
  })

  it("never labels a part of another kind 'linear'; both paths keep the same rows", async () => {
    const { history, sql } = await readOne(
      [{ partNumber: 1, kind: 'read_abacus' }, { partNumber: 2 }],
      [
        // a kind this image does not know, stamped: its own presentation is its mode
        plainRow(0, {
          responseTimeMs: 1,
          evidence: { skills: ['basic.directAddition'], presentation: 'read_abacus.flash' },
        }),
        // the same kind, unstamped: no evidence (before K1b the history said 'linear')
        plainRow(1, { responseTimeMs: 2 }),
        // an arithmetic part with no type and a row with no evidence: 'linear', as before
        plainRow(2, { responseTimeMs: 3, partNumber: 2 }),
        // a pre-schema row with neither evidence nor a skillsExercised array: dropped
        plainRow(3, { responseTimeMs: 4, partNumber: 2, skillsExercised: undefined }),
        // stamped null, skillsExercised or not: recorded, not counted (§1.3)
        plainRow(4, { responseTimeMs: 5, partNumber: 2, evidence: null }),
      ]
    )
    const flash = { skills: ['basic.directAddition'], presentation: 'read_abacus.flash' }
    const linear = { skills: ['basic.directAddition'], presentation: 'linear' }
    expect(history).toEqual([
      [1, flash, 'read_abacus.flash'],
      [3, linear, 'linear'],
    ])
    expect(sql).toEqual(history)
  })
})
