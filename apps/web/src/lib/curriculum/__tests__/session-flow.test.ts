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
    remoteCameraSessionId: null,
    isPaused: false,
    pausedAt: null,
    pausedBy: null,
    pauseReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    approvedAt: null,
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
    completedAt: null,
    ...overrides,
  }
}

describe('applyFlowEvent', () => {
  it('transitions part_transition -> break_pending -> break_active', () => {
    const transitionPlan = buildPlan({ flowState: 'part_transition', flowVersion: 3 })
    const completed = applyFlowEvent(transitionPlan, {
      type: 'PART_TRANSITION_COMPLETED',
      shouldRunBreak: true,
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
})
