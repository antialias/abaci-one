/**
 * @vitest-environment node
 *
 * Tests for the optimistic practice submit feature:
 * - slotId generation and threading through getCurrentProblemInfo
 * - slotId carried through retry queue items
 * - Optimistic advance condition (epoch 0 + next slot exists)
 */

import { describe, expect, it } from 'vitest'
import { getCurrentProblemInfo } from '@/db/schema/session-plan-helpers'
import type {
  GeneratedProblem,
  ProblemSlot,
  SessionPart,
  SessionPlan,
} from '@/db/schema/session-plans'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fakeProblem: GeneratedProblem = {
  terms: [3, 4],
  answer: 7,
  skillsRequired: ['basic.directAddition'],
}

function makeSlot(index: number, slotId = `slot-${index}`): ProblemSlot {
  return {
    slotId,
    index,
    purpose: 'focus',
    constraints: {},
    problem: fakeProblem,
  }
}

function makePart(partNumber: 1 | 2 | 3, slotCount: number, slotIdPrefix = 'slot'): SessionPart {
  return {
    partNumber,
    type: 'abacus',
    format: 'vertical',
    useAbacus: true,
    slots: Array.from({ length: slotCount }, (_, i) => makeSlot(i, `${slotIdPrefix}-${i}`)),
    estimatedMinutes: 5,
  }
}

function buildPlan(overrides: Partial<SessionPlan> = {}): SessionPlan {
  return {
    id: 'plan_1',
    playerId: 'player_1',
    targetDurationMinutes: 10,
    estimatedProblemCount: 10,
    avgTimePerProblemSeconds: 30,
    gameBreakSettings: null,
    parts: [makePart(1, 5)],
    summary: {
      focusDescription: '',
      totalProblemCount: 5,
      estimatedMinutes: 10,
      parts: [],
    },
    masteredSkillIds: [],
    status: 'in_progress',
    flowState: 'practicing',
    flowUpdatedAt: new Date('2026-01-01'),
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
    remoteCameraSessionId: null,
    isPaused: false,
    pausedAt: null,
    pausedBy: null,
    pauseReason: null,
    createdAt: new Date('2026-01-01'),
    approvedAt: null,
    startedAt: new Date('2026-01-01'),
    completedAt: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// getCurrentProblemInfo — slotId threading
// ---------------------------------------------------------------------------

describe('getCurrentProblemInfo — slotId', () => {
  it('returns slotId for a normal (epoch 0) problem', () => {
    const plan = buildPlan({ currentSlotIndex: 2 })
    const info = getCurrentProblemInfo(plan)
    expect(info).not.toBeNull()
    expect(info!.slotId).toBe('slot-2')
    expect(info!.epochNumber).toBe(0)
    expect(info!.isRetry).toBe(false)
  })

  it('returns slotId from the retry item during a retry epoch', () => {
    const plan = buildPlan({
      currentSlotIndex: 5, // past last slot → retry epoch drives the problem
      retryState: {
        0: {
          currentEpoch: 1,
          pendingRetries: [],
          currentEpochItems: [
            {
              slotId: 'original-slot-id-A',
              originalSlotIndex: 1,
              problem: fakeProblem,
              epochNumber: 1,
              originalPurpose: 'focus',
            },
            {
              slotId: 'original-slot-id-B',
              originalSlotIndex: 3,
              problem: fakeProblem,
              epochNumber: 1,
              originalPurpose: 'reinforce',
            },
          ],
          currentRetryIndex: 0,
        },
      },
    })

    const info = getCurrentProblemInfo(plan)
    expect(info).not.toBeNull()
    expect(info!.slotId).toBe('original-slot-id-A')
    expect(info!.epochNumber).toBe(1)
    expect(info!.isRetry).toBe(true)
  })

  it('advances past redeemed retry items and returns correct slotId', () => {
    const plan = buildPlan({
      currentSlotIndex: 5,
      retryState: {
        0: {
          currentEpoch: 1,
          pendingRetries: [],
          currentEpochItems: [
            {
              slotId: 'redeemed-slot',
              originalSlotIndex: 1,
              problem: fakeProblem,
              epochNumber: 1,
              originalPurpose: 'focus',
            },
            {
              slotId: 'active-slot',
              originalSlotIndex: 3,
              problem: fakeProblem,
              epochNumber: 1,
              originalPurpose: 'reinforce',
            },
          ],
          currentRetryIndex: 0,
          redeemedSlots: [1], // slot 1 was redeemed via manual redo
        },
      },
    })

    const info = getCurrentProblemInfo(plan)
    expect(info).not.toBeNull()
    expect(info!.slotId).toBe('active-slot')
    expect(info!.originalSlotIndex).toBe(3)
  })

  it('returns null when all retry items are redeemed', () => {
    const plan = buildPlan({
      currentSlotIndex: 5,
      retryState: {
        0: {
          currentEpoch: 1,
          pendingRetries: [],
          currentEpochItems: [
            {
              slotId: 'slot-A',
              originalSlotIndex: 1,
              problem: fakeProblem,
              epochNumber: 1,
              originalPurpose: 'focus',
            },
          ],
          currentRetryIndex: 0,
          redeemedSlots: [1],
        },
      },
    })

    expect(getCurrentProblemInfo(plan)).toBeNull()
  })

  it('returns undefined slotId when retry item has no slotId (backward compat)', () => {
    const plan = buildPlan({
      currentSlotIndex: 5,
      retryState: {
        0: {
          currentEpoch: 1,
          pendingRetries: [],
          currentEpochItems: [
            {
              // No slotId — old session data
              originalSlotIndex: 0,
              problem: fakeProblem,
              epochNumber: 1,
              originalPurpose: 'focus',
            },
          ],
          currentRetryIndex: 0,
        },
      },
    })

    const info = getCurrentProblemInfo(plan)
    expect(info).not.toBeNull()
    expect(info!.slotId).toBeUndefined()
  })

  it('returns null when part index is beyond parts array', () => {
    const plan = buildPlan({ currentPartIndex: 5 })
    expect(getCurrentProblemInfo(plan)).toBeNull()
  })

  it('returns null when slot index is beyond slots array and no retry state', () => {
    const plan = buildPlan({ currentSlotIndex: 99 })
    expect(getCurrentProblemInfo(plan)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Optimistic advance condition
// ---------------------------------------------------------------------------
// The condition in ActiveSession.tsx:
//   const nextSlotExists = !!plan.parts[partIndex]?.slots[slotIndex + 1]?.problem
//   const canAdvanceOptimistically = epochNumberAtSubmit === 0 && nextSlotExists
//
// We test the logic in isolation without rendering the component.

describe('optimistic advance condition', () => {
  function canAdvanceOptimistically(
    plan: SessionPlan,
    partIndex: number,
    slotIndex: number,
    epochNumber: number
  ): boolean {
    const nextSlotExists = !!plan.parts[partIndex]?.slots[slotIndex + 1]?.problem
    return epochNumber === 0 && nextSlotExists
  }

  it('allows optimistic advance for epoch 0 mid-part', () => {
    const plan = buildPlan() // 5 slots, index 0
    expect(canAdvanceOptimistically(plan, 0, 0, 0)).toBe(true)
    expect(canAdvanceOptimistically(plan, 0, 3, 0)).toBe(true)
  })

  it('blocks at last slot in part (no next slot)', () => {
    const plan = buildPlan()
    // slot index 4 is last in a 5-slot part
    expect(canAdvanceOptimistically(plan, 0, 4, 0)).toBe(false)
  })

  it('blocks when epoch > 0 even if next slot exists', () => {
    const plan = buildPlan()
    expect(canAdvanceOptimistically(plan, 0, 0, 1)).toBe(false)
    expect(canAdvanceOptimistically(plan, 0, 2, 2)).toBe(false)
  })

  it('blocks when next slot has no generated problem yet', () => {
    const plan = buildPlan({
      parts: [
        {
          ...makePart(1, 3),
          slots: [
            makeSlot(0),
            makeSlot(1),
            { slotId: 'empty', index: 2, purpose: 'focus', constraints: {} }, // no problem
          ],
        },
      ],
    })
    // slot 0 → next is slot 1 (has problem) → true
    expect(canAdvanceOptimistically(plan, 0, 0, 0)).toBe(true)
    // slot 1 → next is slot 2 (no problem) → false
    expect(canAdvanceOptimistically(plan, 0, 1, 0)).toBe(false)
  })

  it('blocks when part index is out of range', () => {
    const plan = buildPlan()
    expect(canAdvanceOptimistically(plan, 5, 0, 0)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// SlotId on ProblemSlot — structural invariants
// ---------------------------------------------------------------------------

describe('ProblemSlot slotId', () => {
  it('every slot in a fresh plan has a unique slotId', () => {
    const part = makePart(1, 10)
    const ids = part.slots.map((s) => s.slotId)
    const unique = new Set(ids)
    expect(unique.size).toBe(10)
    // None are empty
    for (const id of ids) {
      expect(id).toBeTruthy()
    }
  })

  it('slot slotId is stable across reads (no re-generation)', () => {
    const slot = makeSlot(0, 'my-stable-id')
    expect(slot.slotId).toBe('my-stable-id')
    // Access again
    expect(slot.slotId).toBe('my-stable-id')
  })
})
