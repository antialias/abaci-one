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
    sessionHealth: null,
    adjustments: [],
    results: [],
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

/**
 * The legacy columns as a row may still hold them until 6b-2 drops them (not
 * in the schema since 6b-1; nothing reads them, the cases below pin that).
 */
const LEGACY_COLUMN_NAMES = [
  'currentSlotIndex',
  'retryState',
  'breakStartedAt',
  'breakReason',
  'breakSelectedGame',
  'breakResults',
] as const
function legacy(columns: Partial<Record<(typeof LEGACY_COLUMN_NAMES)[number], unknown>>) {
  return columns as Partial<SessionPlan>
}
function expectNoLegacyWrite(patch: object) {
  for (const name of LEGACY_COLUMN_NAMES) expect(patch).not.toHaveProperty(name)
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
    expect(started.patch.breaks?.[0].game).toBe('type-racer-jr')
    expectNoLegacyWrite(completed.patch)
    expectNoLegacyWrite(started.patch)
  })

  it('is idempotent for repeated BREAK_FINISHED', () => {
    const finishedPlan = buildPlan({
      flowState: 'break_results',
      flowVersion: 7,
      ...legacy({ breakReason: 'gameFinished', breakResults: { score: 123 } }),
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
        ...legacy({ breakSelectedGame: 'memory-quiz' }),
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
      expectNoLegacyWrite(changed.patch) // 6b-1: the legacy column is not written
    })

    it('does not read breakSelectedGame when the row has no open record (6b-0)', () => {
      const plan = buildPlan({
        flowState: 'break_active',
        currentPartIndex: 1,
        ...legacy({ breakSelectedGame: 'memory-quiz' }),
        breaks: [],
      })
      // Until 6b-0 the legacy column made this a repeat; now the running game
      // is unknown, so the same game is written again (harmless)
      const again = applyFlowEvent(plan, { type: 'BREAK_STARTED', game: 'memory-quiz' })
      expect(again.changed).toBe(true)
      expect(again.patch).toMatchObject({ breaks: [] })
      expectNoLegacyWrite(again.patch)
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
        ...legacy({ breakReason: 'skipped' }),
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
        ...legacy({ breakReason: 'gameFinished', breakResults: { score: 1 } }),
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
        ...legacy({ breakReason: 'skipped', breakSelectedGame: 'memory-quiz' }),
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
        applyFlowEvent(
          buildPlan({ flowState: 'practicing', ...legacy({ breakReason: 'skipped' }), breaks: [] }),
          {
            type: 'BREAK_RESULTS_ACKED',
          }
        ).changed
      ).toBe(false)
    })
  })
})

/**
 * Phase 6b-0 (§10 P6b-3): a pending break starts when the flow entered
 * `break_pending` (`flowUpdatedAt`), not at the legacy `breakStartedAt`,
 * which 6b-1 no longer writes.
 */
describe('the pending break’s start (Phase 6b-0)', () => {
  const ENTERED = new Date('2026-01-01T00:05:00.000Z')
  const LEGACY = new Date('2026-01-01T00:04:00.000Z')

  it('BREAK_STARTED opens the record at flowUpdatedAt; the legacy column is neither read nor written (6b-1)', () => {
    const plan = buildPlan({
      flowState: 'break_pending',
      flowUpdatedAt: ENTERED,
      currentPartIndex: 1,
      ...legacy({ breakStartedAt: LEGACY }),
    })
    const started = applyFlowEvent(plan, { type: 'BREAK_STARTED', game: 'memory-quiz' })
    expect(started.patch.breaks?.[0].startedAt).toBe(ENTERED.toISOString())
    expectNoLegacyWrite(started.patch)
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
      ...legacy({ breakStartedAt: LEGACY }),
    })
    const skipped = applyFlowEvent(plan, { type: 'BREAK_FINISHED', reason: 'skipped' })
    expect(skipped.patch.breaks?.[0]).toMatchObject({
      startedAt: ENTERED.toISOString(),
      reason: 'skipped',
      game: null,
    })
  })
})

/**
 * Phase 6b-1 (§10 P6b1-1, P6b1-5): a recorded try writes no legacy column,
 * no longer bumps `flowVersion` for clearing leftover legacy break fields, and
 * writes the next part's initial entry when it moves the cursor on.
 */
describe('TRY_RECORDED writes only the new columns (Phase 6b-1)', () => {
  const slot = (p: number, s: number) => ({
    slotId: `p${p}s${s}`,
    index: s,
    purpose: 'focus' as const,
    constraints: {},
    problem: { terms: [p + 1, s + 1], answer: p + s + 2, skillsRequired: [] },
  })
  const parts = [0, 1].map((p) => ({
    kind: 'arithmetic' as const,
    partNumber: (p + 1) as 1 | 2,
    type: 'abacus' as const,
    format: 'vertical' as const,
    useAbacus: true,
    slots: [slot(p, 0), slot(p, 1)],
    estimatedMinutes: 1,
  })) as SessionPlan['parts']
  const tryOf = (partIndex: number, itemId: string) => ({
    type: 'TRY_RECORDED' as const,
    row: { tryId: itemId } as never,
    try: {
      partIndex,
      itemId,
      kind: 'first' as const,
      round: 0,
      practiceOnly: false,
      isCorrect: true,
    },
  })

  it('a try in the part, after a skipped break left legacy fields set: no flowVersion bump', () => {
    const plan = buildPlan({
      parts,
      currentPartIndex: 1,
      flowVersion: 6,
      partStates: { '0': { slotIndex: 2 }, '1': { slotIndex: 0 } },
      ...legacy({ breakStartedAt: new Date('2026-01-01T00:04:00.000Z'), breakResults: null }),
    })
    const applied = applyFlowEvent(plan, tryOf(1, 'p1s0'))
    // Until 6b-1 clearing the leftover breakStartedAt bumped it to 7 (§10 P5a-3 (2))
    expect(applied.patch.flowVersion).toBe(6)
    expect(applied.patch.flowUpdatedAt).toBe(plan.flowUpdatedAt)
    expect(applied.patch.partStates).toEqual({ '0': { slotIndex: 2 }, '1': { slotIndex: 1 } })
    expectNoLegacyWrite(applied.patch)
  })

  it('the try that ends a part writes the next part’s initial entry', () => {
    const plan = buildPlan({ parts, partStates: { '0': { slotIndex: 1 } } })
    const applied = applyFlowEvent(plan, tryOf(0, 'p0s1'))
    expect(applied.patch).toMatchObject({ currentPartIndex: 1, flowState: 'part_transition' })
    expect(applied.patch.partStates).toEqual({
      '0': { slotIndex: 2, retry: undefined },
      '1': { slotIndex: 0, retry: undefined },
    })
    expectNoLegacyWrite(applied.patch)
  })
})
