import { describe, it, expect, beforeEach } from 'vitest'
import {
  assistanceReducer,
  createFreshContext,
  showWrongAnswerSuggestion,
  type AssistanceMachineState,
  type AssistanceEvent,
  type AssistanceContext,
  type AssistanceStateName,
} from '../useProgressiveAssistance'
import type { ProgressiveThresholds } from '../../autoPauseCalculator'

const defaultThresholds: ProgressiveThresholds = {
  encouragementMs: 15000,
  helpOfferMs: 30000,
  autoPauseMs: 120000,
}

function makeMachine(
  state: AssistanceStateName,
  contextOverrides: Partial<AssistanceContext> = {}
): AssistanceMachineState {
  return {
    state,
    context: {
      ...createFreshContext(defaultThresholds, 3, 12000),
      ...contextOverrides,
    },
  }
}

describe('assistanceReducer', () => {
  // ==========================================================================
  // Global events (handled in any state)
  // ==========================================================================

  describe('PROBLEM_CHANGED', () => {
    it.each<AssistanceStateName>([
      'idle',
      'encouraging',
      'offeringHelp',
      'autoPaused',
      'inHelp',
    ])('from %s → idle with full reset', (fromState) => {
      const machine = makeMachine(fromState, {
        wrongAttemptCount: 5,
        helpedTermIndices: new Set([1, 2]),
        allTermsHelped: true,
        moveOnAvailable: true,
      })

      const result = assistanceReducer(machine, { type: 'PROBLEM_CHANGED' })

      expect(result.state).toBe('idle')
      expect(result.context.wrongAttemptCount).toBe(0)
      expect(result.context.helpedTermIndices.size).toBe(0)
      expect(result.context.allTermsHelped).toBe(false)
      expect(result.context.moveOnAvailable).toBe(false)
      expect(result.context.moveOnGraceStartedAt).toBeNull()
    })
  })

  describe('UPDATE_THRESHOLDS', () => {
    it('updates thresholds without changing state', () => {
      const machine = makeMachine('encouraging')
      const newThresholds: ProgressiveThresholds = {
        encouragementMs: 5000,
        helpOfferMs: 10000,
        autoPauseMs: 60000,
      }

      const result = assistanceReducer(machine, {
        type: 'UPDATE_THRESHOLDS',
        thresholds: newThresholds,
      })

      expect(result.state).toBe('encouraging')
      expect(result.context.thresholds).toEqual(newThresholds)
    })
  })

  describe('DISMISS_WRONG_ANSWER_SUGGESTION', () => {
    it('resets wrong attempt count without changing state', () => {
      const machine = makeMachine('idle', { wrongAttemptCount: 5 })
      const result = assistanceReducer(machine, {
        type: 'DISMISS_WRONG_ANSWER_SUGGESTION',
      })

      expect(result.state).toBe('idle')
      expect(result.context.wrongAttemptCount).toBe(0)
    })
  })

  // ==========================================================================
  // idle state
  // ==========================================================================

  describe('idle', () => {
    it('TIMER_ENCOURAGEMENT → encouraging', () => {
      const machine = makeMachine('idle')
      const result = assistanceReducer(machine, { type: 'TIMER_ENCOURAGEMENT' })
      expect(result.state).toBe('encouraging')
    })

    it('DIGIT_TYPED → idle (resets timer)', () => {
      const machine = makeMachine('idle', { idleStartedAt: 1000 })
      const result = assistanceReducer(machine, { type: 'DIGIT_TYPED' })
      expect(result.state).toBe('idle')
      expect(result.context.idleStartedAt).toBeGreaterThan(1000)
    })

    it('WRONG_ANSWER below threshold → idle (increments count)', () => {
      const machine = makeMachine('idle', { wrongAttemptCount: 0 })
      const result = assistanceReducer(machine, { type: 'WRONG_ANSWER' })
      expect(result.state).toBe('idle')
      expect(result.context.wrongAttemptCount).toBe(1)
    })

    it('WRONG_ANSWER at threshold → offeringHelp', () => {
      const machine = makeMachine('idle', { wrongAttemptCount: 2 })
      const result = assistanceReducer(machine, { type: 'WRONG_ANSWER' })
      expect(result.state).toBe('offeringHelp')
      expect(result.context.wrongAttemptCount).toBe(3)
    })

    it('HELP_ENTERED → inHelp', () => {
      const machine = makeMachine('idle')
      const result = assistanceReducer(machine, { type: 'HELP_ENTERED' })
      expect(result.state).toBe('inHelp')
    })

    it('TIMER_MOVE_ON_GRACE with allTermsHelped → moveOnAvailable', () => {
      const machine = makeMachine('idle', {
        allTermsHelped: true,
        moveOnGraceStartedAt: Date.now() - 15000,
      })
      const result = assistanceReducer(machine, { type: 'TIMER_MOVE_ON_GRACE' })
      expect(result.state).toBe('idle')
      expect(result.context.moveOnAvailable).toBe(true)
      expect(result.context.moveOnGraceStartedAt).toBeNull()
    })

    it('TIMER_MOVE_ON_GRACE without allTermsHelped → no-op', () => {
      const machine = makeMachine('idle', { allTermsHelped: false })
      const result = assistanceReducer(machine, { type: 'TIMER_MOVE_ON_GRACE' })
      expect(result).toBe(machine) // Same reference = no-op
    })

    it('unhandled event → no-op', () => {
      const machine = makeMachine('idle')
      const result = assistanceReducer(machine, { type: 'TIMER_HELP_OFFER' })
      expect(result).toBe(machine)
    })
  })

  // ==========================================================================
  // encouraging state
  // ==========================================================================

  describe('encouraging', () => {
    it('TIMER_HELP_OFFER → offeringHelp', () => {
      const machine = makeMachine('encouraging')
      const result = assistanceReducer(machine, { type: 'TIMER_HELP_OFFER' })
      expect(result.state).toBe('offeringHelp')
    })

    it('DIGIT_TYPED → idle (resets timer)', () => {
      const machine = makeMachine('encouraging')
      const result = assistanceReducer(machine, { type: 'DIGIT_TYPED' })
      expect(result.state).toBe('idle')
    })

    it('HELP_ENTERED → inHelp', () => {
      const machine = makeMachine('encouraging')
      const result = assistanceReducer(machine, { type: 'HELP_ENTERED' })
      expect(result.state).toBe('inHelp')
    })

    it('WRONG_ANSWER below threshold → encouraging', () => {
      const machine = makeMachine('encouraging', { wrongAttemptCount: 1 })
      const result = assistanceReducer(machine, { type: 'WRONG_ANSWER' })
      expect(result.state).toBe('encouraging')
      expect(result.context.wrongAttemptCount).toBe(2)
    })

    it('WRONG_ANSWER at threshold → offeringHelp', () => {
      const machine = makeMachine('encouraging', { wrongAttemptCount: 2 })
      const result = assistanceReducer(machine, { type: 'WRONG_ANSWER' })
      expect(result.state).toBe('offeringHelp')
      expect(result.context.wrongAttemptCount).toBe(3)
    })

    it('unhandled event → no-op', () => {
      const machine = makeMachine('encouraging')
      const result = assistanceReducer(machine, { type: 'RESUMED' })
      expect(result).toBe(machine)
    })
  })

  // ==========================================================================
  // offeringHelp state
  // ==========================================================================

  describe('offeringHelp', () => {
    it('TIMER_AUTO_PAUSE → autoPaused (stores stats)', () => {
      const machine = makeMachine('offeringHelp')
      const stats = {
        meanMs: 5000,
        stdDevMs: 2000,
        thresholdMs: 9000,
        sampleCount: 10,
        usedStatistics: true,
      }
      const result = assistanceReducer(machine, {
        type: 'TIMER_AUTO_PAUSE',
        autoPauseStats: stats,
      })
      expect(result.state).toBe('autoPaused')
      expect(result.context.autoPauseStats).toEqual(stats)
    })

    it('DIGIT_TYPED → idle (resets timer)', () => {
      const machine = makeMachine('offeringHelp')
      const result = assistanceReducer(machine, { type: 'DIGIT_TYPED' })
      expect(result.state).toBe('idle')
    })

    it('HELP_ENTERED → inHelp', () => {
      const machine = makeMachine('offeringHelp')
      const result = assistanceReducer(machine, { type: 'HELP_ENTERED' })
      expect(result.state).toBe('inHelp')
    })

    it('unhandled event → no-op', () => {
      const machine = makeMachine('offeringHelp')
      const result = assistanceReducer(machine, { type: 'WRONG_ANSWER' })
      expect(result).toBe(machine)
    })
  })

  // ==========================================================================
  // autoPaused state
  // ==========================================================================

  describe('autoPaused', () => {
    it('RESUMED → idle (resets timer)', () => {
      const machine = makeMachine('autoPaused')
      const result = assistanceReducer(machine, { type: 'RESUMED' })
      expect(result.state).toBe('idle')
      expect(result.context.idleStartedAt).toBeGreaterThan(0)
    })

    it('unhandled event → no-op', () => {
      const machine = makeMachine('autoPaused')
      const result = assistanceReducer(machine, { type: 'DIGIT_TYPED' })
      expect(result).toBe(machine)
    })
  })

  // ==========================================================================
  // inHelp state
  // ==========================================================================

  describe('inHelp', () => {
    it('HELP_TERM_COMPLETED → inHelp (adds term index)', () => {
      const machine = makeMachine('inHelp', { helpedTermIndices: new Set([1]) })
      const result = assistanceReducer(machine, {
        type: 'HELP_TERM_COMPLETED',
        termIndex: 2,
      })
      expect(result.state).toBe('inHelp')
      expect(result.context.helpedTermIndices.has(1)).toBe(true)
      expect(result.context.helpedTermIndices.has(2)).toBe(true)
    })

    it('HELP_TERM_COMPLETED for same term is idempotent', () => {
      const machine = makeMachine('inHelp', { helpedTermIndices: new Set([1]) })
      const result = assistanceReducer(machine, {
        type: 'HELP_TERM_COMPLETED',
        termIndex: 1,
      })
      expect(result.context.helpedTermIndices.size).toBe(1)
    })

    it('HELP_EXITED → idle (not all terms helped)', () => {
      const machine = makeMachine('inHelp', {
        helpedTermIndices: new Set([1]),
      })
      const result = assistanceReducer(machine, {
        type: 'HELP_EXITED',
        problemTermsCount: 4, // terms 1,2,3 need help
      })
      expect(result.state).toBe('idle')
      expect(result.context.allTermsHelped).toBe(false)
      expect(result.context.moveOnGraceStartedAt).toBeNull()
    })

    it('HELP_EXITED → idle (all terms helped, starts grace)', () => {
      const machine = makeMachine('inHelp', {
        helpedTermIndices: new Set([1, 2, 3]),
      })
      const result = assistanceReducer(machine, {
        type: 'HELP_EXITED',
        problemTermsCount: 4, // terms 1,2,3 need help
      })
      expect(result.state).toBe('idle')
      expect(result.context.allTermsHelped).toBe(true)
      expect(result.context.moveOnGraceStartedAt).toBeGreaterThan(0)
    })

    it('HELP_EXITED does not restart grace if moveOnAvailable', () => {
      const machine = makeMachine('inHelp', {
        helpedTermIndices: new Set([1, 2, 3]),
        moveOnAvailable: true,
      })
      const result = assistanceReducer(machine, {
        type: 'HELP_EXITED',
        problemTermsCount: 4,
      })
      expect(result.context.moveOnGraceStartedAt).toBeNull()
    })

    it('DIGIT_TYPED → idle (student typed = exits help)', () => {
      const machine = makeMachine('inHelp')
      const result = assistanceReducer(machine, { type: 'DIGIT_TYPED' })
      expect(result.state).toBe('idle')
    })

    it('unhandled event → no-op', () => {
      const machine = makeMachine('inHelp')
      const result = assistanceReducer(machine, { type: 'TIMER_ENCOURAGEMENT' })
      expect(result).toBe(machine)
    })
  })

  // ==========================================================================
  // Event log
  // ==========================================================================

  describe('event log', () => {
    it('appends log entries on transitions', () => {
      const machine = makeMachine('idle')
      const result = assistanceReducer(machine, { type: 'TIMER_ENCOURAGEMENT' })
      expect(result.context.eventLog.length).toBe(1)
      expect(result.context.eventLog[0].event).toBe('TIMER_ENCOURAGEMENT')
      expect(result.context.eventLog[0].fromState).toBe('idle')
      expect(result.context.eventLog[0].toState).toBe('encouraging')
    })

    it('caps log at 30 entries', () => {
      let machine = makeMachine('idle')
      // Generate 35 events by alternating between digit typed and timer encouragement
      for (let i = 0; i < 35; i++) {
        if (machine.state === 'idle') {
          machine = assistanceReducer(machine, { type: 'TIMER_ENCOURAGEMENT' })
        } else {
          machine = assistanceReducer(machine, { type: 'DIGIT_TYPED' })
        }
      }
      expect(machine.context.eventLog.length).toBeLessThanOrEqual(30)
    })

    it('newest entries are first', () => {
      let machine = makeMachine('idle')
      machine = assistanceReducer(machine, { type: 'TIMER_ENCOURAGEMENT' })
      machine = assistanceReducer(machine, { type: 'DIGIT_TYPED' })

      expect(machine.context.eventLog[0].event).toBe('DIGIT_TYPED')
      expect(machine.context.eventLog[1].event).toBe('TIMER_ENCOURAGEMENT')
    })
  })

  // ==========================================================================
  // Full escalation flow
  // ==========================================================================

  describe('full escalation flow', () => {
    it('idle → encouraging → offeringHelp → autoPaused → resumed → idle', () => {
      let machine = makeMachine('idle')

      machine = assistanceReducer(machine, { type: 'TIMER_ENCOURAGEMENT' })
      expect(machine.state).toBe('encouraging')

      machine = assistanceReducer(machine, { type: 'TIMER_HELP_OFFER' })
      expect(machine.state).toBe('offeringHelp')

      const stats = {
        meanMs: 5000,
        stdDevMs: 2000,
        thresholdMs: 9000,
        sampleCount: 10,
        usedStatistics: true,
      }
      machine = assistanceReducer(machine, { type: 'TIMER_AUTO_PAUSE', autoPauseStats: stats })
      expect(machine.state).toBe('autoPaused')

      machine = assistanceReducer(machine, { type: 'RESUMED' })
      expect(machine.state).toBe('idle')
    })

    it('idle → inHelp → all terms → idle + grace → moveOnAvailable', () => {
      let machine = makeMachine('idle')

      machine = assistanceReducer(machine, { type: 'HELP_ENTERED' })
      expect(machine.state).toBe('inHelp')

      machine = assistanceReducer(machine, { type: 'HELP_TERM_COMPLETED', termIndex: 1 })
      machine = assistanceReducer(machine, { type: 'HELP_TERM_COMPLETED', termIndex: 2 })
      expect(machine.context.helpedTermIndices.size).toBe(2)

      // Exit help with 3-term problem (terms 1,2 = all helpable terms)
      machine = assistanceReducer(machine, { type: 'HELP_EXITED', problemTermsCount: 3 })
      expect(machine.state).toBe('idle')
      expect(machine.context.allTermsHelped).toBe(true)
      expect(machine.context.moveOnGraceStartedAt).not.toBeNull()

      // Grace period expires
      machine = assistanceReducer(machine, { type: 'TIMER_MOVE_ON_GRACE' })
      expect(machine.context.moveOnAvailable).toBe(true)
    })

    it('typing resets escalation back to idle from any timed state', () => {
      let machine = makeMachine('encouraging')
      machine = assistanceReducer(machine, { type: 'DIGIT_TYPED' })
      expect(machine.state).toBe('idle')

      machine = makeMachine('offeringHelp')
      machine = assistanceReducer(machine, { type: 'DIGIT_TYPED' })
      expect(machine.state).toBe('idle')
    })
  })
})

describe('showWrongAnswerSuggestion', () => {
  it('true when wrongAttemptCount >= threshold and not in help or paused', () => {
    const ctx = createFreshContext(defaultThresholds, 3, 12000)
    expect(showWrongAnswerSuggestion('idle', { ...ctx, wrongAttemptCount: 3 })).toBe(true)
    expect(showWrongAnswerSuggestion('encouraging', { ...ctx, wrongAttemptCount: 3 })).toBe(true)
    expect(showWrongAnswerSuggestion('offeringHelp', { ...ctx, wrongAttemptCount: 5 })).toBe(true)
  })

  it('false when in help or paused', () => {
    const ctx = createFreshContext(defaultThresholds, 3, 12000)
    expect(showWrongAnswerSuggestion('inHelp', { ...ctx, wrongAttemptCount: 5 })).toBe(false)
    expect(showWrongAnswerSuggestion('autoPaused', { ...ctx, wrongAttemptCount: 5 })).toBe(false)
  })

  it('false when below threshold', () => {
    const ctx = createFreshContext(defaultThresholds, 3, 12000)
    expect(showWrongAnswerSuggestion('idle', { ...ctx, wrongAttemptCount: 2 })).toBe(false)
  })
})
