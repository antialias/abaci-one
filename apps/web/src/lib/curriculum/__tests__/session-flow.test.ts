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
 * column wins; with only the legacy columns, the legacy columns are read.
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

    it('reads breakSelectedGame when the row has no open record', () => {
      const plan = buildPlan({
        flowState: 'break_active',
        currentPartIndex: 1,
        breakSelectedGame: 'memory-quiz',
        breaks: [],
      })
      expect(applyFlowEvent(plan, { type: 'BREAK_STARTED', game: 'memory-quiz' }).changed).toBe(
        false
      )
      expect(applyFlowEvent(plan, { type: 'BREAK_STARTED', game: 'type-racer-jr' }).changed).toBe(
        true
      )
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

    it('reads the legacy columns when the row has no records', () => {
      const plan = buildPlan({
        flowState: 'practicing',
        currentPartIndex: 1,
        breakReason: 'skipped',
        breaks: [],
      })
      expect(applyFlowEvent(plan, { type: 'BREAK_FINISHED', reason: 'skipped' }).changed).toBe(
        false
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
      // Acked per the record (the break ended with results); the legacy
      // columns still carry the break, so alone they would refuse the ack
      const plan = buildPlan({
        flowState: 'practicing',
        currentPartIndex: 1,
        breakReason: 'gameFinished',
        breakSelectedGame: 'memory-quiz',
        breaks: [{ ...finished, reason: 'gameFinished' }],
      })
      expect(applyFlowEvent(plan, { type: 'BREAK_RESULTS_ACKED' }).changed).toBe(false)
      expect(() =>
        applyFlowEvent({ ...plan, breaks: [] }, { type: 'BREAK_RESULTS_ACKED' })
      ).toThrow(InvalidFlowTransitionError)

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

    it('reads the legacy columns when the row has no records', () => {
      expect(
        applyFlowEvent(buildPlan({ flowState: 'practicing', breaks: [] }), {
          type: 'BREAK_RESULTS_ACKED',
        }).changed
      ).toBe(false)
      expect(() =>
        applyFlowEvent(buildPlan({ flowState: 'practicing', breakReason: 'skipped', breaks: [] }), {
          type: 'BREAK_RESULTS_ACKED',
        })
      ).toThrow(InvalidFlowTransitionError)
    })
  })
})
