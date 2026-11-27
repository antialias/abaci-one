/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'
import type { SessionPlan } from '@/db/schema/session-plans'
import { applyFlowEvent, InvalidFlowTransitionError } from '@/lib/curriculum/session-flow'

function buildPlan(overrides: Partial<SessionPlan> = {}): SessionPlan {
  return {
    id: 'plan_1',
    playerId: 'player_1',
    targetDurationMinutes: 10,
    estimatedProblemCount: 10,
    avgTimePerProblemSeconds: 30,
    gameBreakSettings: null,
    parts: [],
    summary: {
      focusDescription: '',
      totalProblemCount: 0,
      estimatedMinutes: 0,
      parts: [],
    },
    masteredSkillIds: [],
    status: 'in_progress',
    flowState: 'practicing',
    flowUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
    flowVersion: 0,
    currentPartIndex: 0,
    currentSlotIndex: 0,
    breakStartedAt: null,
    breakReason: null,
    breakSelectedGame: null,
    breakResults: null,
    sessionHealth: null,
    adjustments: [],
    results: [],
    retryState: null,
    rowVersion: 0,
    breaks: [],
    partStates: {},
    pauses: [],
    remoteCameraSessionId: null,
    isPaused: false,
    pausedAt: null,
    pausedBy: null,
    pauseReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    approvedAt: null,
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
    completedAt: null,
    statusBeforeDeletion: null,
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  }
}

describe('applyFlowEvent', () => {
  it('transitions part_transition -> break_pending -> break_active', () => {
    // Breaks follow the plan's settings, not the client's shouldRunBreak (Phase 3a)
    const transitionPlan = buildPlan({
      flowState: 'part_transition',
      flowVersion: 3,
      gameBreakSettings: {
        enabled: true,
        maxDurationMinutes: 5,
        selectionMode: 'kid-chooses',
        selectedGame: null,
      },
    })
    const completed = applyFlowEvent(transitionPlan, {
      type: 'PART_TRANSITION_COMPLETED',
      shouldRunBreak: false,
    })

    expect(completed.changed).toBe(true)
    expect(completed.patch.flowState).toBe('break_pending')
    expect(completed.patch.flowVersion).toBe(4)

    const pendingPlan = buildPlan({
      flowState: 'break_pending',
      flowVersion: completed.patch.flowVersion!,
    })
    const started = applyFlowEvent(pendingPlan, { type: 'BREAK_STARTED', game: 'type-racer-jr' })
    expect(started.patch.flowState).toBe('break_active')
    expect(started.patch.breakSelectedGame).toBe('type-racer-jr')
  })

  it('is idempotent for repeated BREAK_FINISHED', () => {
    const finishedPlan = buildPlan({
      flowState: 'break_results',
      flowVersion: 7,
      breakReason: 'gameFinished',
      breakResults: { score: 123 } as never,
      breaks: [
        {
          breakIndex: 0,
          afterPartIndex: 0,
          startedAt: '2026-01-01T00:05:00.000Z',
          endedAt: '2026-01-01T00:06:00.000Z',
          reason: 'gameFinished',
          results: { score: 123 } as never,
        },
      ],
    })

    const repeated = applyFlowEvent(finishedPlan, {
      type: 'BREAK_FINISHED',
      reason: 'gameFinished',
      results: { score: 123 } as never,
    })

    expect(repeated.changed).toBe(false)
  })

  it('rejects illegal transitions', () => {
    const plan = buildPlan({ flowState: 'practicing' })
    expect(() =>
      applyFlowEvent(plan, {
        type: 'BREAK_FINISHED',
        reason: 'skipped',
      })
    ).toThrow(InvalidFlowTransitionError)
  })

  it.each(['part_transition', 'break_pending', 'break_active', 'break_results'] as const)(
    'refuses a first try in %s (no implicit transition since Phase 3c)',
    (flowState) => {
      const plan = buildPlan({ flowState, currentPartIndex: 1 })
      expect(() =>
        applyFlowEvent(plan, {
          type: 'TRY_RECORDED',
          row: {} as never,
          try: {
            partIndex: 1,
            itemId: 's0',
            kind: 'first',
            round: 0,
            practiceOnly: false,
            isCorrect: true,
          },
        })
      ).toThrow(InvalidFlowTransitionError)
    }
  )
})

/**
 * Phase 5a: the machine reads `breaks`, falling back to the legacy break
 * columns for a row without it. Each reader: where the two disagree the new
 * column wins. Phase 6b-0 (§10 P6b-4) removed the fallback: with only the
 * legacy columns, nothing is read from them.
 */
describe('applyFlowEvent reads breaks (Phase 5a)', () => {
  const STARTED = '2026-01-01T00:05:00.000Z'

  describe('BREAK_STARTED in break_active: the running break’s game', () => {
    it('reads the open record when it disagrees with breakSelectedGame', () => {
      const plan = buildPlan({
        flowState: 'break_active',
        currentPartIndex: 1,
        breakSelectedGame: 'memory-quiz',
        breaks: [{ breakIndex: 0, afterPartIndex: 0, startedAt: STARTED, game: 'type-racer-jr' }],
      })
      // The open record already has this game: a repeat
      expect(applyFlowEvent(plan, { type: 'BREAK_STARTED', game: 'type-racer-jr' }).changed).toBe(
        false
      )
      // The legacy column's game is a change of game
      const changed = applyFlowEvent(plan, { type: 'BREAK_STARTED', game: 'memory-quiz' })
      expect(changed.changed).toBe(true)
      expect(changed.patch.breaks?.[0].game).toBe('memory-quiz')
      expect(changed.patch.breakSelectedGame).toBe('memory-quiz') // legacy still written
    })

    it('does not read breakSelectedGame when the row has no open record (6b-0)', () => {
      const plan = buildPlan({
        flowState: 'break_active',
        currentPartIndex: 1,
        breakSelectedGame: 'memory-quiz',
        breaks: [],
      })
      // Until 6b-0 the legacy column made this a repeat; now the running game
      // is unknown, so the same game is written again (harmless)
      const again = applyFlowEvent(plan, { type: 'BREAK_STARTED', game: 'memory-quiz' })
      expect(again.changed).toBe(true)
      expect(again.patch).toMatchObject({ breakSelectedGame: 'memory-quiz', breaks: [] })
      // A row with no game anywhere repeats as before
      expect(
        applyFlowEvent(buildPlan({ flowState: 'break_active', breaks: [] }), {
          type: 'BREAK_STARTED',
          game: undefined,
        }).changed
      ).toBe(false)
    })
  })

  describe('BREAK_FINISHED: whether it already landed', () => {
    it('reads the last record when it disagrees with the legacy columns', () => {
      // The record says this break was skipped; the legacy columns say nothing
      const plan = buildPlan({
        flowState: 'practicing',
        currentPartIndex: 1,
        breakReason: null,
        breaks: [
          {
            breakIndex: 0,
            afterPartIndex: 0,
            startedAt: STARTED,
            endedAt: STARTED,
            reason: 'skipped',
            results: null,
          },
        ],
      })
      expect(applyFlowEvent(plan, { type: 'BREAK_FINISHED', reason: 'skipped' }).changed).toBe(
        false
      )
      // The legacy columns alone would not count it as landed
      expect(() =>
        applyFlowEvent({ ...plan, breaks: [] }, { type: 'BREAK_FINISHED', reason: 'skipped' })
      ).toThrow(InvalidFlowTransitionError)
    })

    it('does not read the legacy columns when the row has no records (6b-0)', () => {
      const plan = buildPlan({
        flowState: 'practicing',
        currentPartIndex: 1,
        breakReason: 'skipped',
        breaks: [],
      })
      // Until 6b-0 breakReason made this a landed repeat
      expect(() => applyFlowEvent(plan, { type: 'BREAK_FINISHED', reason: 'skipped' })).toThrow(
        InvalidFlowTransitionError
      )
    })

    it('compares results from the record too', () => {
      const plan = buildPlan({
        flowState: 'break_results',
        currentPartIndex: 1,
        breakReason: 'gameFinished',
        breakResults: { score: 1 } as never,
        breaks: [
          {
            breakIndex: 0,
            afterPartIndex: 0,
            startedAt: STARTED,
            endedAt: STARTED,
            reason: 'gameFinished',
            results: { score: 2 } as never,
          },
        ],
      })
      const repeat = { type: 'BREAK_FINISHED', reason: 'gameFinished' } as const
      expect(applyFlowEvent(plan, { ...repeat, results: { score: 2 } as never }).changed).toBe(
        false
      )
      // break_results is not a state BREAK_FINISHED leaves, so a mismatch throws
      expect(() => applyFlowEvent(plan, { ...repeat, results: { score: 1 } as never })).toThrow(
        InvalidFlowTransitionError
      )
    })
  })

  describe('BREAK_RESULTS_ACKED: whether it already landed', () => {
    const finished = {
      breakIndex: 0,
      afterPartIndex: 0,
      startedAt: STARTED,
      endedAt: STARTED,
      results: null,
    }

    it('reads the last record when it disagrees with the legacy columns', () => {
      // Acked per the record (the break ended with results), whatever the
      // legacy columns carry
      const plan = buildPlan({
        flowState: 'practicing',
        currentPartIndex: 1,
        breakReason: 'skipped',
        breakSelectedGame: 'memory-quiz',
        breaks: [{ ...finished, reason: 'gameFinished' }],
      })
      expect(applyFlowEvent(plan, { type: 'BREAK_RESULTS_ACKED' }).changed).toBe(false)

      // A skipped break has no results to ack, whatever the legacy columns say
      const skipped = buildPlan({
        flowState: 'practicing',
        currentPartIndex: 1,
        breaks: [{ ...finished, reason: 'skipped' }],
      })
      expect(() => applyFlowEvent(skipped, { type: 'BREAK_RESULTS_ACKED' })).toThrow(
        InvalidFlowTransitionError
      )
    })

    it('a row with no records has nothing left to ack, whatever the legacy columns say (6b-0)', () => {
      expect(
        applyFlowEvent(buildPlan({ flowState: 'practicing', breaks: [] }), {
          type: 'BREAK_RESULTS_ACKED',
        }).changed
      ).toBe(false)
      // Until 6b-0 a skipped break in the legacy columns refused the ack
      expect(
        applyFlowEvent(buildPlan({ flowState: 'practicing', breakReason: 'skipped', breaks: [] }), {
          type: 'BREAK_RESULTS_ACKED',
        }).changed
      ).toBe(false)
    })
  })
})

/**
 * Phase 6b-0 (§10 P6b-3): a pending break starts when the flow entered
 * `break_pending` (`flowUpdatedAt`), not at the legacy `breakStartedAt`, which
 * 6b-1 stops writing. The legacy write is unchanged.
 */
describe('the pending break’s start (Phase 6b-0)', () => {
  const ENTERED = new Date('2026-01-01T00:05:00.000Z')
  const LEGACY = new Date('2026-01-01T00:04:00.000Z')

  it('BREAK_STARTED opens the record at flowUpdatedAt; the legacy column is written as before', () => {
    const plan = buildPlan({
      flowState: 'break_pending',
      flowUpdatedAt: ENTERED,
      currentPartIndex: 1,
      breakStartedAt: LEGACY,
    })
    const started = applyFlowEvent(plan, { type: 'BREAK_STARTED', game: 'memory-quiz' })
    expect(started.patch.breaks?.[0].startedAt).toBe(ENTERED.toISOString())
    expect(started.patch.breakStartedAt).toBe(LEGACY)
  })

  it('a row in 6b-1 shape (no breakStartedAt) opens the record at the same instant', () => {
    const plan = buildPlan({
      flowState: 'break_pending',
      flowUpdatedAt: ENTERED,
      currentPartIndex: 1,
    })
    const started = applyFlowEvent(plan, { type: 'BREAK_STARTED', game: 'memory-quiz' })
    expect(started.patch.breaks?.[0].startedAt).toBe(ENTERED.toISOString())
  })

  it('a break skipped from break_pending is appended closed, started at flowUpdatedAt', () => {
    const plan = buildPlan({
      flowState: 'break_pending',
      flowUpdatedAt: ENTERED,
      currentPartIndex: 1,
      breakStartedAt: LEGACY,
    })
    const skipped = applyFlowEvent(plan, { type: 'BREAK_FINISHED', reason: 'skipped' })
    expect(skipped.patch.breaks?.[0]).toMatchObject({
      startedAt: ENTERED.toISOString(),
      reason: 'skipped',
      game: null,
    })
  })
})
