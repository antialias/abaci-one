/**
 * Phase 3b (session-architecture plan §7): the song names every game break.
 *
 * `buildSongPromptInput` against real migrations: every `practice-break`
 * `game_results` row of the session, in `played_at` order; one break and no
 * break behave as before; recent sessions are the kid's newest.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import type { SessionPart, SessionSummary, SlotResult } from '@/db/schema/session-plans'
import type { GameResultsReport } from '@/lib/arcade/game-sdk/types'
import { buildSongPromptInput, readyPromptInput } from '@/lib/tasks/session-song'
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

const DAY = 24 * 60 * 60 * 1000
const T0 = new Date('2026-11-01T15:00:00Z').getTime()

let eph: EphemeralDbResult
let playerId: string

beforeEach(async () => {
  eph = createEphemeralDatabase()
  setCurrentEphemeralDb(eph.db)
  ;({ playerId } = await createTestStudent(eph.db, 'song-kid'))
})

afterEach(() => {
  setCurrentEphemeralDb(null)
  eph.cleanup()
})

/** `total` first tries of a one-part session, the first `correct` right (pre-Phase-1 rows) */
function tries(correct: number, total: number): SlotResult[] {
  return Array.from({ length: total }, (_, i) => {
    const problem = { terms: [i + 1, 1], answer: i + 2, skillsRequired: [] }
    return {
      partNumber: 1,
      slotIndex: i,
      problem,
      studentAnswer: i < correct ? problem.answer : problem.answer + 1,
      isCorrect: i < correct,
      responseTimeMs: 3000,
      epochNumber: 0,
    } as unknown as SlotResult
  })
}

/** The one part the tries above answer, one slot per try */
function partsFor(results: SlotResult[]): SessionPart[] {
  return [
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
}

async function insertPlan(
  id: string,
  status: 'in_progress' | 'completed',
  createdAt: Date,
  results: SlotResult[],
  legacyBreak: Partial<typeof schema.sessionPlans.$inferInsert> = {}
) {
  await eph.db.insert(schema.sessionPlans).values({
    id,
    playerId,
    targetDurationMinutes: 10,
    estimatedProblemCount: results.length,
    avgTimePerProblemSeconds: 5,
    parts: partsFor(results),
    summary: {} as SessionSummary,
    status,
    results,
    // Written explicitly: drizzle stores a json column's omitted default as the
    // string "[]", which the session report (Phase 4e reads it) cannot read
    adjustments: [],
    createdAt,
    ...legacyBreak,
  })
}

function report(gameDisplayName: string, headline: string, endedAt?: Date): GameResultsReport {
  return {
    gameName: gameDisplayName.toLowerCase().replace(/\W+/g, '-'),
    gameDisplayName,
    headline,
    customStats: [],
    ...(endedAt && { endedAt: endedAt.getTime() }),
  } as unknown as GameResultsReport
}

async function insertBreakResult(
  sessionId: string,
  gameDisplayName: string,
  headline: string,
  playedAt: Date
) {
  await eph.db.insert(schema.gameResults).values({
    playerId,
    gameName: gameDisplayName.toLowerCase().replace(/\W+/g, '-'),
    gameDisplayName,
    sessionType: 'practice-break',
    sessionId,
    normalizedScore: 80,
    accuracy: 90,
    playedAt,
    fullReport: report(gameDisplayName, headline, playedAt),
  })
}

async function songInput(sessionPlanId = 'current') {
  const built = await buildSongPromptInput({ sessionPlanId, playerId, triggerSource: 'auto' })
  if (!built.promptInput) throw new Error('no prompt input')
  return built.promptInput
}

describe('song input: game breaks (Phase 3b)', () => {
  it('names both games of a two-break session, in played_at order', async () => {
    await insertPlan('current', 'in_progress', new Date(T0), tries(4, 5))
    // Inserted out of order: the later break first
    await insertBreakResult(
      'current',
      'Type Racer Jr.',
      'Fast fingers!',
      new Date(T0 + 20 * 60_000)
    )
    await insertBreakResult('current', 'Memory Match', 'Great memory!', new Date(T0 + 8 * 60_000))
    // Another session's break and a non-practice game never appear
    await insertBreakResult('other-session', 'Rithmomachia', 'Elsewhere', new Date(T0))
    await eph.db.insert(schema.gameResults).values({
      playerId,
      gameName: 'matching',
      gameDisplayName: 'Matching Pairs',
      sessionType: 'arcade-room',
      sessionId: 'current',
      normalizedScore: 50,
      playedAt: new Date(T0 + 9 * 60_000),
      fullReport: report('Matching Pairs', 'Arcade'),
    })

    const input = await songInput()

    expect(input.gameBreaks?.map((gb) => [gb.gameName, gb.headline])).toEqual([
      ['Memory Match', 'Great memory!'],
      ['Type Racer Jr.', 'Fast fingers!'],
    ])
    expect(input.practiceDrama.arcs).toEqual(
      expect.arrayContaining([
        'Side quest: Memory Match - Great memory!.',
        'Side quest: Type Racer Jr. - Fast fingers!.',
      ])
    )
    expect(input).not.toHaveProperty('gameBreak')
  })

  it('a break stored twice (a double POST) is named once', async () => {
    await insertPlan('current', 'in_progress', new Date(T0), tries(4, 5))
    const endedAt = new Date(T0 + 8 * 60_000)
    await insertBreakResult('current', 'Memory Match', 'Great memory!', endedAt)
    await insertBreakResult('current', 'Memory Match', 'Great memory!', endedAt)

    const input = await songInput()

    expect(input.gameBreaks?.map((gb) => gb.gameName)).toEqual(['Memory Match'])
    expect(input.practiceDrama.arcs.filter((a) => a.startsWith('Side quest'))).toHaveLength(1)
  })

  it('one break: the one game, as before', async () => {
    await insertPlan('current', 'in_progress', new Date(T0), tries(4, 5), {
      breakSelectedGame: 'memory-match',
      breakReason: 'gameFinished',
    })
    await insertBreakResult('current', 'Memory Match', 'Great memory!', new Date(T0 + 8 * 60_000))

    const input = await songInput()

    expect(input.gameBreaks).toEqual([
      {
        gameName: 'Memory Match',
        headline: 'Great memory!',
        accuracy: 90,
        highlights: [],
        details: [],
        moments: ['Game ended before a full finish'],
      },
    ])
    expect(input.practiceDrama.arcs.filter((a) => a.startsWith('Side quest'))).toEqual([
      'Side quest: Memory Match - Great memory!.',
    ])
  })

  it('one skipped break (no game_results row): the legacy columns, as before', async () => {
    await insertPlan('current', 'in_progress', new Date(T0), tries(4, 5), {
      breakSelectedGame: 'matching-pairs',
      breakReason: 'skipped',
    })

    const input = await songInput()

    expect(input.gameBreaks?.map((gb) => gb.headline)).toEqual([
      'Played matching-pairs (ended early)',
    ])
  })

  it('no break (an old session with no game_results rows): still a song, no break', async () => {
    await insertPlan('current', 'in_progress', new Date(T0), tries(4, 5))

    const built = await buildSongPromptInput({
      sessionPlanId: 'current',
      playerId,
      triggerSource: 'auto',
    })

    expect(built.disabled).toBe(false)
    expect(built.promptInput).toBeDefined()
    expect(built.promptInput).not.toHaveProperty('gameBreaks')
    expect(built.promptInput?.practiceDrama.arcs.some((a) => a.startsWith('Side quest'))).toBe(
      false
    )
  })
})

describe('song input: recent sessions', () => {
  it("reads the kid's 10 newest completed sessions, newest first", async () => {
    // 12 completed sessions, one a day: the 2 oldest all wrong, then five at
    // 50%, then the five newest at 100%.
    const accuracyByDay = [0, 0, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1, 1]
    for (const [day, accuracy] of accuracyByDay.entries()) {
      await insertPlan(`done-${day}`, 'completed', new Date(T0 + day * DAY), tries(accuracy * 2, 2))
    }
    await insertPlan('current', 'in_progress', new Date(T0 + 12 * DAY), tries(1, 1))

    const input = await songInput()

    // The newest 10 (days 2..11) average 0.75; the oldest 10 would be 0.55
    expect(input.history.recentSessionCount).toBe(10)
    expect(input.history.averageAccuracy).toBeCloseTo(0.75)
    // Read newest-first, the older half (0.5) is below the newer half (1)
    expect(input.history.trend).toBe('improving')
  })

  it('a regenerated song for an old session ignores the sessions after it', async () => {
    // Days 0-3 at 50%, the regenerated session on day 4 (completed, so it counts
    // as it always has), then days 5-9 at 100%.
    for (const day of [0, 1, 2, 3]) {
      await insertPlan(`before-${day}`, 'completed', new Date(T0 + day * DAY), tries(1, 2))
    }
    await insertPlan('old', 'completed', new Date(T0 + 4 * DAY), tries(1, 2))
    for (const day of [5, 6, 7, 8, 9]) {
      await insertPlan(`after-${day}`, 'completed', new Date(T0 + day * DAY), tries(2, 2))
    }

    const input = await songInput('old')

    expect(input.history.recentSessionCount).toBe(5)
    expect(input.history.averageAccuracy).toBeCloseTo(0.5)
  })
})

describe('song input: genre', () => {
  it('passes a stored empty genre through to the writer', async () => {
    await insertPlan('current', 'in_progress', new Date(T0), tries(1, 1))
    await eph.db.insert(schema.playerSessionPreferences).values({
      playerId,
      config: JSON.stringify({ sessionSongGenre: '' }),
      updatedAt: Date.now(),
    })

    const built = await buildSongPromptInput({
      sessionPlanId: 'current',
      playerId,
      triggerSource: 'auto',
    })

    expect(built.genrePreference).toBe('')
    expect(readyPromptInput(built).genrePreference).toBe('')
    expect(() => readyPromptInput({ ...built, genrePreference: undefined })).toThrow(
      'Failed to build song prompt input'
    )
  })
})
