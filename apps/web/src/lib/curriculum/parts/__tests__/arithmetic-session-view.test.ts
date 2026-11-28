/**
 * The arithmetic kind's client view (Phase 5b): what the session screens read
 * of an arithmetic part instead of its slots and the legacy cursor columns.
 * The observer is sent the plan's parts and tries and the item on screen, and
 * places its current dot by that item (§10 P6b1-13).
 */

import { describe, expect, it } from 'vitest'
import type { ProblemSlot, SessionPart, SlotResult } from '@/db/schema/session-plans'
import { arithmeticObserverDotsOf } from '../arithmetic/result-view'
import {
  type ArithmeticViewPlan,
  arithmeticCursorLinearIndex,
  arithmeticDotsPosition,
  arithmeticItemNumber,
  arithmeticObserverPosition,
  arithmeticRetryRoundSize,
  arithmeticSlotOf,
  arithmeticSlotOfProblem,
  arithmeticTransitionView,
  arithmeticTryCount,
} from '../arithmetic/session-view'

function slot(p: number, i: number): ProblemSlot {
  return {
    slotId: `p${p}s${i}`,
    index: i,
    purpose: 'focus',
    constraints: {},
    problem: { terms: [p * 10 + i, 1], answer: p * 10 + i + 1, skillsRequired: [] },
  }
}

function part(p: number, type: SessionPart['type'], n: number): SessionPart {
  return {
    partNumber: (p + 1) as 1 | 2 | 3,
    type,
    format: type === 'linear' ? 'linear' : 'vertical',
    useAbacus: type === 'abacus',
    slots: Array.from({ length: n }, (_, i) => slot(p, i)),
    estimatedMinutes: 2,
  }
}

function result(partNumber: number, slotIndex: number, isCorrect: boolean): SlotResult {
  return {
    partNumber,
    slotIndex,
    slotId: `p${partNumber - 1}s${slotIndex}`,
    isCorrect,
  } as SlotResult
}

const parts = [part(0, 'abacus', 3), part(1, 'visualization', 4)]

function plan(over: Partial<ArithmeticViewPlan> = {}): ArithmeticViewPlan {
  return {
    parts,
    currentPartIndex: 1,
    partStates: { 1: { slotIndex: 2 } },
    results: [],
    ...over,
  } as ArithmeticViewPlan
}

describe('arithmetic session view', () => {
  it('numbers items across parts as the dots do', () => {
    expect(arithmeticItemNumber(parts, 0, 'p0s0')).toBe(1)
    expect(arithmeticItemNumber(parts, 1, 'p1s2')).toBe(6)
    expect(arithmeticItemNumber(parts, 1, 'nope')).toBeNull()
    expect(arithmeticCursorLinearIndex(plan())).toBe(5)
  })

  it('finds a slot by item id and by its problem', () => {
    expect(arithmeticSlotOf(parts[1], 'p1s3')?.slotIndex).toBe(3)
    expect(arithmeticSlotOf(parts[1], 'p0s0')).toBeNull()
    expect(arithmeticSlotOfProblem(parts, 0, { terms: [1, 1], answer: 2 })?.slotId).toBe('p0s1')
  })

  it('gives the dots the plan cursor', () => {
    expect(arithmeticDotsPosition(plan())).toEqual({
      parts,
      results: [],
      currentPartIndex: 1,
      currentSlotIndex: 2,
    })
  })

  it('sends the plan and the item on screen; the observer places its dot by the item', () => {
    const results = [result(1, 0, true)]
    const position = arithmeticObserverPosition(plan({ results }), {
      partIndex: 1,
      itemId: 'p1s2',
      doOver: false,
    })
    expect(position).toEqual({
      sessionParts: parts,
      slotResults: results,
      currentItem: { partIndex: 1, itemId: 'p1s2' },
    })
    expect(arithmeticObserverDotsOf(position)).toEqual({
      sessionParts: parts,
      slotResults: results,
      currentPartIndex: 1,
      currentSlotIndex: 2,
    })
  })

  it('shows a do-over at its own slot; the DVR number stays the cursor', () => {
    const position = arithmeticObserverPosition(plan(), {
      partIndex: 0,
      itemId: 'p0s1',
      doOver: true,
    })
    expect(position.currentItem).toEqual({ partIndex: 0, itemId: 'p0s1' })
    expect(arithmeticObserverDotsOf(position)).toMatchObject({
      currentPartIndex: 0,
      currentSlotIndex: 1,
    })
    expect(arithmeticCursorLinearIndex(plan()) + 1).toBe(6)
  })

  it('no current dot for an item the parts do not have', () => {
    const position = arithmeticObserverPosition(plan(), {
      partIndex: 1,
      itemId: 'nope',
      doOver: false,
    })
    expect(arithmeticObserverDotsOf(position)).not.toHaveProperty('currentSlotIndex')
  })

  it('during a retry round: the kid keeps the parked cursor, the observer shows the retry item', () => {
    const retrying = plan({
      currentPartIndex: 0,
      partStates: {
        0: {
          slotIndex: 3,
          retry: {
            currentEpoch: 1,
            pendingRetries: [],
            currentEpochItems: [
              { originalSlotIndex: 0, attemptCount: 1, slotId: 'p0s0' },
              { originalSlotIndex: 2, attemptCount: 1, slotId: 'p0s2' },
            ],
            currentRetryIndex: 0,
          },
        },
      },
    } as unknown as Partial<ArithmeticViewPlan>)
    expect(arithmeticRetryRoundSize(retrying, 0)).toBe(2)
    expect(arithmeticRetryRoundSize(retrying, 1)).toBe(0)
    const position = arithmeticObserverPosition(retrying, {
      partIndex: 0,
      itemId: 'p0s0',
      doOver: false,
    })
    // the kid's dots and the DVR number: the cursor, parked at the part's end
    expect(arithmeticDotsPosition(retrying).currentSlotIndex).toBe(3)
    expect(arithmeticCursorLinearIndex(retrying) + 1).toBe(4)
    // the observer's current dot: the retry item on the kid's screen (§10 P6b1-13)
    expect(arithmeticObserverDotsOf(position)).toMatchObject({
      currentPartIndex: 0,
      currentSlotIndex: 0,
    })
  })

  it('omits currentItem with nothing on screen', () => {
    expect(arithmeticObserverPosition(plan(), null)).not.toHaveProperty('currentItem')
  })

  it('counts the tries an item already has', () => {
    const results = [result(1, 1, false), result(1, 1, true), result(2, 1, true)]
    expect(arithmeticTryCount({ parts, results }, 0, 'p0s1')).toBe(2)
    expect(arithmeticTryCount({ parts, results }, 0, 'p0s2')).toBe(0)
  })

  it('names each presentation for the transition screen', () => {
    expect(arithmeticTransitionView({ type: 'abacus' })).toEqual({
      kind: 'arithmetic',
      label: 'Abacus',
      emoji: '🧮',
      needsPhysicalAbacus: true,
      presentation: 'abacus',
    })
    expect(arithmeticTransitionView({ type: 'visualization' }).label).toBe('Visualization')
    expect(arithmeticTransitionView({ type: 'linear' })).toMatchObject({
      label: 'Equations',
      emoji: '✏️',
      needsPhysicalAbacus: false,
    })
  })
})
