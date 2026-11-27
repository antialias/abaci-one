import { describe, expect, it, vi } from 'vitest'
import {
  adjustmentsOf,
  currentItemOf,
  doOverStamp,
  findTryIndex,
  legacyPartStateOf,
  legacyTryId,
  mintTryId,
  normalizeTries,
  type PartStateSource,
  partStateOf,
  resolveItemId,
} from '../session-plan-normalize'
import type {
  GeneratedProblem,
  PartRetryState,
  ProblemSlot,
  SessionPart,
  SlotResult,
} from '../session-plans'

/** Fixtures for read-time normalization (plan §2, §5). Rows are never rewritten. */

const problem = (a: number, b: number): GeneratedProblem =>
  ({ terms: [a, b], answer: a + b, skillsRequired: ['basic.directAddition'] }) as GeneratedProblem

const slot = (slotId: string, index: number, p: GeneratedProblem): ProblemSlot =>
  ({ slotId, index, purpose: 'focus', constraints: {}, problem: p }) as ProblemSlot

const P = [problem(1, 2), problem(3, 4), problem(5, 1), problem(2, 2)]

const parts: SessionPart[] = [
  {
    partNumber: 1,
    type: 'abacus',
    format: 'vertical',
    useAbacus: true,
    estimatedMinutes: 3,
    slots: [slot('s0', 0, P[0]), slot('s1', 1, P[1]), slot('s2', 2, P[2])],
  },
  {
    partNumber: 2,
    type: 'visualization',
    format: 'vertical',
    useAbacus: false,
    estimatedMinutes: 3,
    slots: [slot('t0', 0, P[3])],
  },
]

/** A legacy row (no try-record fields), as stored before Phase 1. */
function row(over: Partial<SlotResult> & { slotIndex: number; problem: GeneratedProblem }) {
  return {
    slotId: 's0',
    partNumber: 1,
    studentAnswer: over.problem.answer,
    isCorrect: true,
    responseTimeMs: 3000,
    skillsExercised: ['basic.directAddition'],
    usedOnScreenAbacus: false,
    timestamp: new Date('2026-01-01T00:00:00Z'),
    hadHelp: false,
    incorrectAttempts: 0,
    ...over,
  } as SlotResult
}

describe('normalizeTries', () => {
  it('resolves a prod-shaped row whose slotId names the previous slot to the slot slotIndex names', () => {
    // Optimistic advance: slotId from the not-yet-refreshed plan (slot 0), the
    // rest from the attempt actually answered (slot 1)
    const results = [
      row({ slotId: 's0', slotIndex: 0, problem: P[0], originalSlotIndex: 0, masteryWeight: 1 }),
      row({ slotId: 's0', slotIndex: 1, problem: P[1], originalSlotIndex: 1, masteryWeight: 1 }),
    ]
    const tries = normalizeTries('plan', parts, results)
    expect(tries.map((t) => t.itemId)).toEqual(['s0', 's1'])
    expect(tries.map((t) => t.kind)).toEqual(['first', 'first'])
  })

  it('tells apart two rows that share one lagged slotId', () => {
    const results = [
      row({ slotId: 's0', slotIndex: 0, problem: P[0] }),
      row({ slotId: 's0', slotIndex: 1, problem: P[1] }),
      row({ slotId: 's0', slotIndex: 2, problem: P[2] }),
    ]
    const tries = normalizeTries('plan', parts, results)
    expect(tries.map((t) => t.itemId)).toEqual(['s0', 's1', 's2'])
    expect(new Set(tries.map((t) => t.itemId)).size).toBe(3)
  })

  it('keys items by part as well as slot index', () => {
    const results = [
      row({ slotId: 's0', slotIndex: 0, problem: P[0] }),
      row({ slotId: 'stale', partNumber: 2, slotIndex: 0, problem: P[3] }),
    ]
    const tries = normalizeTries('plan', parts, results)
    expect(tries.map((t) => [t.itemId, t.partIndex])).toEqual([
      ['s0', 0],
      ['t0', 1],
    ])
  })

  it('derives legacy kinds and rounds; a legacy do-over of a wrong item is round 1, not practice-only', () => {
    const results = [
      row({ slotIndex: 0, problem: P[0], isCorrect: false, studentAnswer: 9, masteryWeight: 0 }),
      row({ slotId: 's1', slotIndex: 1, problem: P[1] }),
      row({
        slotIndex: 0,
        problem: P[0],
        isRetry: true,
        epochNumber: 1,
        originalSlotIndex: 0,
        isCorrect: false,
        masteryWeight: 0,
      }),
      // pre-Phase-1 do-over: server stored epochNumber 0, weight 1.0
      row({ slotIndex: 0, problem: P[0], isManualRedo: true, epochNumber: 0, masteryWeight: 1 }),
      // and a second do-over of the same item, now correct: practice-only (derived)
      row({ slotIndex: 0, problem: P[0], isManualRedo: true, epochNumber: 0, masteryWeight: 1 }),
    ]
    const tries = normalizeTries('plan', parts, results)
    expect(tries.map((t) => [t.kind, t.round])).toEqual([
      ['first', 0],
      ['first', 0],
      ['retry', 1],
      ['do_over', 2],
      ['do_over', 3],
    ])
    expect(tries[3].practiceOnlyDerived).toBe(false)
    expect(tries[4].practiceOnlyDerived).toBe(true)
    // the derived flag is report-only: the stamp (what BKT reads) stays false
    expect(tries.every((t) => t.practiceOnly === false)).toBe(true)
    // the stored weight passes through untouched (no refold)
    expect(tries[3].masteryWeight).toBe(1)
  })

  it('turns a legacy duplicate original (bug 3) into a derived practice-only do-over', () => {
    // The duplicate was attributed to the server's next slot (originalSlotIndex 1)
    // but carries slot 0's content and slotId
    const results = [
      row({ slotId: 's0', slotIndex: 0, problem: P[0], originalSlotIndex: 0 }),
      row({ slotId: 's0', slotIndex: 0, problem: P[0], originalSlotIndex: 1 }),
    ]
    const tries = normalizeTries('plan', parts, results)
    expect(tries.map((t) => t.itemId)).toEqual(['s0', 's0'])
    expect(tries.map((t) => t.kind)).toEqual(['first', 'do_over'])
    expect(tries[1]).toMatchObject({ round: 1, practiceOnlyDerived: true, practiceOnly: false })
  })

  it('gives rows without a slotId a positional item id, and every legacy row a positional tryId', () => {
    const residue = row({ slotIndex: 7, problem: problem(9, 9) }) as Partial<SlotResult>
    delete residue.slotId
    const tries = normalizeTries('plan-1', parts, [residue as SlotResult])
    expect(tries[0].itemId).toBe('legacy-item:1:7')
    expect(tries[0].tryId).toBe(legacyTryId('plan-1', 0))
  })

  it('falls back to the raw slotId when the slot named by index does not hold the row’s problem', () => {
    // offline/worksheet rows: slot-less parts, no masteryWeight
    const results = [row({ slotId: 'ws-1', slotIndex: 0, problem: problem(8, 8) })]
    const offlineParts = [{ ...parts[0], slots: [] }]
    const tries = normalizeTries('plan', offlineParts, results)
    expect(tries[0]).toMatchObject({ itemId: 'ws-1', kind: 'first', masteryWeight: undefined })
  })

  it('skips recency-refresh sentinels, which are not tries', () => {
    const sentinel = row({ slotIndex: 0, problem: P[0], source: 'recency-refresh' })
    const results = [sentinel, row({ slotIndex: 0, problem: P[0] })]
    const tries = normalizeTries('plan', [], results)
    expect(tries).toHaveLength(1)
    expect(tries[0].arrayIndex).toBe(1)
    expect(tries[0].tryId).toBe(legacyTryId('plan', 1))
  })

  it('passes stamped rows through: the stamp wins', () => {
    const results = [
      row({
        tryId: 'a',
        kind: 'first',
        round: 0,
        practiceOnly: false,
        slotIndex: 0,
        problem: P[0],
      }),
      row({
        tryId: 'b',
        kind: 'do_over',
        round: 1,
        practiceOnly: true,
        masteryWeight: 0,
        isManualRedo: true,
        slotIndex: 0,
        problem: P[0],
      }),
    ]
    const tries = normalizeTries('plan', parts, results)
    expect(tries.map((t) => t.tryId)).toEqual(['a', 'b'])
    expect(tries[1]).toMatchObject({
      kind: 'do_over',
      round: 1,
      practiceOnly: true,
      practiceOnlyDerived: true,
    })
  })

  it('leaves the rows byte-identical', () => {
    const results = [
      row({ slotId: 's0', slotIndex: 1, problem: P[1] }),
      row({ slotIndex: 0, problem: P[0], isManualRedo: true }),
    ]
    const before = JSON.stringify(results)
    normalizeTries('plan', parts, results)
    expect(JSON.stringify(results)).toBe(before)
  })
})

describe('try ids', () => {
  it('finds a row by stored id or by legacy id, never a stored row by its position', () => {
    const results = [
      row({ slotIndex: 0, problem: P[0] }),
      row({ tryId: 'x', slotIndex: 1, problem: P[1] }),
    ]
    expect(findTryIndex('p', results, legacyTryId('p', 0))).toBe(0)
    expect(findTryIndex('p', results, 'x')).toBe(1)
    expect(findTryIndex('p', results, legacyTryId('p', 1))).toBe(-1)
    expect(findTryIndex('p', results, legacyTryId('other', 0))).toBe(-1)
  })

  it('mints v4 UUIDs', () => {
    const id = mintTryId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(mintTryId()).not.toBe(id)
  })
})

describe('doOverStamp', () => {
  it('counts earlier counted tries and is practice-only when the latest of them was correct', () => {
    const t = (isCorrect: boolean, practiceOnlyDerived = false) => ({
      isCorrect,
      practiceOnlyDerived,
    })
    expect(doOverStamp([t(false)])).toEqual({ round: 1, practiceOnly: false })
    expect(doOverStamp([t(true)])).toEqual({ round: 1, practiceOnly: true })
    expect(doOverStamp([t(false), t(true)])).toEqual({ round: 2, practiceOnly: true })
    // practice-only tries do not count toward round (M23) nor decide the flag
    expect(doOverStamp([t(false), t(false, true)])).toEqual({ round: 1, practiceOnly: false })
  })
})

describe('resolveItemId', () => {
  it('trusts a stored slotId only when the indexed slot holds the same problem', () => {
    expect(resolveItemId(row({ slotId: 's1', slotIndex: 1, problem: P[1] }), parts)).toBe('s1')
    expect(resolveItemId(row({ slotId: 's2', slotIndex: 1, problem: P[1] }), parts)).toBe('s1')
  })
})

describe('adjustmentsOf', () => {
  const ended = {
    timestamp: new Date('2026-01-01T00:00:00.000Z'),
    type: 'ended_early',
    reason: 'bedtime',
  } as const
  const of = (adjustments: unknown) =>
    adjustmentsOf({ adjustments } as Parameters<typeof adjustmentsOf>[0])

  it('passes a well-formed list through', () => {
    expect(of([ended])).toEqual([ended])
    expect(of([])).toEqual([])
  })

  it("reads the JSON-string default ('[]') and a missing value as no adjustments", () => {
    expect(of('[]')).toEqual([])
    expect(of(null)).toEqual([])
    expect(of(undefined)).toEqual([])
  })

  it('drops the characters an early end spread into a string row, keeping the adjustment', () => {
    expect(of(['[', ']', ended])).toEqual([ended])
  })
})

/**
 * Phase 5a: a part's state is read from `part_states`, with the legacy cursor
 * (`currentSlotIndex` + `retryState`) as the fallback for a part the row has
 * no entry for. Where the two disagree the entry is stale and the legacy
 * columns win (P5a-8).
 */
describe('part states (Phase 5a)', () => {
  const round1 = (slotIndex: number): PartRetryState => ({
    currentEpoch: 1,
    pendingRetries: [],
    currentEpochItems: [
      {
        slotId: `s${slotIndex}`,
        originalSlotIndex: slotIndex,
        problem: P[slotIndex],
        epochNumber: 1,
        originalPurpose: 'focus',
      },
    ],
    currentRetryIndex: 0,
  })
  const plan = (over: Partial<PartStateSource>): PartStateSource => ({
    parts,
    currentPartIndex: 0,
    currentSlotIndex: 0,
    retryState: null,
    partStates: {},
    ...over,
  })

  it('reads part_states where it agrees with the legacy columns', () => {
    // The current part: same cursor and retry state, the entry is read
    const entry = { slotIndex: 3, retry: round1(1) }
    const p = plan({
      currentSlotIndex: 3,
      retryState: { 0: round1(1) },
      partStates: { '0': entry },
    })
    expect(partStateOf(p, 0)).toBe(entry)
    // An earlier part: legacy stores only its retry state; the entry's matches
    const earlier = plan({
      currentPartIndex: 1,
      retryState: { 0: round1(0) },
      partStates: { '0': { retry: round1(0), slotIndex: 3 } },
    })
    expect(partStateOf(earlier, 0)).toEqual({ slotIndex: 3, retry: round1(0) })
  })

  it('reads the legacy columns, and warns once, where a stale entry disagrees (§10 P5a-8)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      // The cursor: the entry says s2, the legacy columns (written last) say s1
      const p = {
        ...plan({ currentSlotIndex: 1, partStates: { '0': { slotIndex: 2 } } }),
        id: 'pl-1',
      }
      expect(partStateOf(p, 0)).toEqual({ slotIndex: 1, retry: undefined })
      expect(currentItemOf(p)).toMatchObject({ partIndex: 0, slotId: 's1', epochNumber: 0 })
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0][1]).toEqual({ planId: 'pl-1', partIndex: 0 })

      // An earlier part's retry state
      const earlier = {
        ...plan({
          currentPartIndex: 1,
          retryState: { 0: round1(0) },
          partStates: { '0': { slotIndex: 3, retry: round1(1) } },
        }),
        id: 'pl-2',
      }
      expect(partStateOf(earlier, 0)).toEqual(legacyPartStateOf(earlier, 0))
      expect(partStateOf(earlier, 0)).toEqual({ slotIndex: 3, retry: round1(0) })
      expect(warn).toHaveBeenCalledTimes(2) // once per plan and part
    } finally {
      warn.mockRestore()
    }
  })

  it('reads the legacy cursor for a part without an entry', () => {
    const p = plan({ currentSlotIndex: 3, retryState: { 0: round1(1) } })
    expect(partStateOf(p, 0)).toEqual({ slotIndex: 3, retry: round1(1) })
    expect(currentItemOf(p)).toMatchObject({ slotId: 's1', epochNumber: 1, retryIndex: 0 })
    // the next part: not started
    expect(partStateOf(p, 1)).toEqual({ slotIndex: 0, retry: undefined })
    // an entry for another part does not stand in for this one
    const other = plan({ currentSlotIndex: 1, partStates: { '1': { slotIndex: 1 } } })
    expect(partStateOf(other, 0)).toEqual({ slotIndex: 1, retry: undefined })
    // a row whose part_states did not decode to an object reads as having none
    const odd = plan({ currentSlotIndex: 2, partStates: '{}' as never })
    expect(partStateOf(odd, 0)).toEqual({ slotIndex: 2, retry: undefined })
  })

  it('has no current item past the last part', () => {
    expect(currentItemOf(plan({ currentPartIndex: 2 }))).toBeNull()
  })
})
