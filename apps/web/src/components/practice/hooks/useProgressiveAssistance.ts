'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { SlotResult } from '@/db/schema/session-plans'
import {
  type AutoPauseStats,
  calculateAutoPauseInfo,
  calculateProgressiveThresholds,
  type PauseInfo,
  type ProgressiveThresholds,
} from '../autoPauseCalculator'
import {
  getProgressiveAssistanceTiming,
  type ProgressiveAssistanceTimingConfig,
  shouldUseDebugTiming,
} from '@/constants/helpTiming'

// =============================================================================
// Types
// =============================================================================

export type AssistanceStateName =
  | 'idle'
  | 'encouraging'
  | 'offeringHelp'
  | 'autoPaused'
  | 'inHelp'

export interface AssistanceEventLogEntry {
  timestamp: number
  event: string
  fromState: AssistanceStateName
  toState: AssistanceStateName
  note: string
}

export interface AssistanceContext {
  wrongAttemptCount: number
  helpedTermIndices: Set<number>
  allTermsHelped: boolean
  moveOnGraceStartedAt: number | null
  moveOnAvailable: boolean
  idleStartedAt: number
  thresholds: ProgressiveThresholds
  autoPauseStats: AutoPauseStats | null
  wrongAnswerThreshold: number
  moveOnGraceMs: number
  eventLog: AssistanceEventLogEntry[]
}

export interface AssistanceMachineState {
  state: AssistanceStateName
  context: AssistanceContext
}

export type AssistanceEvent =
  | { type: 'TIMER_ENCOURAGEMENT' }
  | { type: 'TIMER_HELP_OFFER' }
  | { type: 'TIMER_AUTO_PAUSE'; autoPauseStats: AutoPauseStats }
  | { type: 'TIMER_MOVE_ON_GRACE' }
  | { type: 'DIGIT_TYPED' }
  | { type: 'WRONG_ANSWER' }
  | { type: 'HELP_ENTERED' }
  | { type: 'HELP_TERM_COMPLETED'; termIndex: number }
  | { type: 'HELP_EXITED'; problemTermsCount: number }
  | { type: 'RESUMED' }
  | { type: 'PROBLEM_CHANGED' }
  | { type: 'DISMISS_WRONG_ANSWER_SUGGESTION' }
  | { type: 'UPDATE_THRESHOLDS'; thresholds: ProgressiveThresholds }

// =============================================================================
// Constants
// =============================================================================

const MAX_EVENT_LOG_SIZE = 30

// =============================================================================
// Pure Reducer
// =============================================================================

export function createFreshContext(
  thresholds: ProgressiveThresholds,
  wrongAnswerThreshold: number,
  moveOnGraceMs: number,
): AssistanceContext {
  return {
    wrongAttemptCount: 0,
    helpedTermIndices: new Set(),
    allTermsHelped: false,
    moveOnGraceStartedAt: null,
    moveOnAvailable: false,
    idleStartedAt: Date.now(),
    thresholds,
    autoPauseStats: null,
    wrongAnswerThreshold,
    moveOnGraceMs,
    eventLog: [],
  }
}

function resetContext(ctx: AssistanceContext): AssistanceContext {
  return {
    ...ctx,
    wrongAttemptCount: 0,
    helpedTermIndices: new Set(),
    allTermsHelped: false,
    moveOnGraceStartedAt: null,
    moveOnAvailable: false,
    idleStartedAt: Date.now(),
    autoPauseStats: null,
  }
}

function appendLog(
  ctx: AssistanceContext,
  event: string,
  fromState: AssistanceStateName,
  toState: AssistanceStateName,
  note: string,
): AssistanceEventLogEntry[] {
  const entry: AssistanceEventLogEntry = {
    timestamp: Date.now(),
    event,
    fromState,
    toState,
    note,
  }
  const log = [entry, ...ctx.eventLog]
  if (log.length > MAX_EVENT_LOG_SIZE) {
    log.length = MAX_EVENT_LOG_SIZE
  }
  return log
}

export function assistanceReducer(
  machine: AssistanceMachineState,
  event: AssistanceEvent
): AssistanceMachineState {
  const { state, context } = machine

  // UPDATE_THRESHOLDS can happen in any state
  if (event.type === 'UPDATE_THRESHOLDS') {
    return {
      state,
      context: {
        ...context,
        thresholds: event.thresholds,
        eventLog: appendLog(context, event.type, state, state, 'thresholds updated'),
      },
    }
  }

  // PROBLEM_CHANGED always resets to idle from any state
  if (event.type === 'PROBLEM_CHANGED') {
    const newCtx = resetContext(context)
    return {
      state: 'idle',
      context: {
        ...newCtx,
        eventLog: appendLog(context, event.type, state, 'idle', 'full reset'),
      },
    }
  }

  // DISMISS_WRONG_ANSWER_SUGGESTION — reset wrong attempt count
  if (event.type === 'DISMISS_WRONG_ANSWER_SUGGESTION') {
    return {
      state,
      context: {
        ...context,
        wrongAttemptCount: 0,
        eventLog: appendLog(context, event.type, state, state, 'dismissed'),
      },
    }
  }

  switch (state) {
    case 'idle': {
      switch (event.type) {
        case 'TIMER_ENCOURAGEMENT':
          return {
            state: 'encouraging',
            context: {
              ...context,
              eventLog: appendLog(context, event.type, 'idle', 'encouraging', ''),
            },
          }

        case 'DIGIT_TYPED':
          return {
            state: 'idle',
            context: {
              ...context,
              idleStartedAt: Date.now(),
              eventLog: appendLog(context, event.type, 'idle', 'idle', 'reset timer'),
            },
          }

        case 'WRONG_ANSWER': {
          const newCount = context.wrongAttemptCount + 1
          const nextState: AssistanceStateName =
            newCount >= context.wrongAnswerThreshold ? 'offeringHelp' : 'idle'
          return {
            state: nextState,
            context: {
              ...context,
              wrongAttemptCount: newCount,
              eventLog: appendLog(
                context,
                event.type,
                'idle',
                nextState,
                `count=${newCount}/${context.wrongAnswerThreshold}`
              ),
            },
          }
        }

        case 'HELP_ENTERED':
          return {
            state: 'inHelp',
            context: {
              ...context,
              eventLog: appendLog(context, event.type, 'idle', 'inHelp', ''),
            },
          }

        case 'TIMER_MOVE_ON_GRACE':
          if (context.allTermsHelped) {
            return {
              state: 'idle',
              context: {
                ...context,
                moveOnAvailable: true,
                moveOnGraceStartedAt: null,
                eventLog: appendLog(context, event.type, 'idle', 'idle', 'moveOn available'),
              },
            }
          }
          return machine

        default:
          return machine
      }
    }

    case 'encouraging': {
      switch (event.type) {
        case 'TIMER_HELP_OFFER':
          return {
            state: 'offeringHelp',
            context: {
              ...context,
              eventLog: appendLog(context, event.type, 'encouraging', 'offeringHelp', ''),
            },
          }

        case 'DIGIT_TYPED':
          return {
            state: 'idle',
            context: {
              ...context,
              idleStartedAt: Date.now(),
              eventLog: appendLog(context, event.type, 'encouraging', 'idle', 'reset timer'),
            },
          }

        case 'HELP_ENTERED':
          return {
            state: 'inHelp',
            context: {
              ...context,
              eventLog: appendLog(context, event.type, 'encouraging', 'inHelp', ''),
            },
          }

        case 'WRONG_ANSWER': {
          const newCount = context.wrongAttemptCount + 1
          const nextState: AssistanceStateName =
            newCount >= context.wrongAnswerThreshold ? 'offeringHelp' : 'encouraging'
          return {
            state: nextState,
            context: {
              ...context,
              wrongAttemptCount: newCount,
              eventLog: appendLog(
                context,
                event.type,
                'encouraging',
                nextState,
                `count=${newCount}/${context.wrongAnswerThreshold}`
              ),
            },
          }
        }

        default:
          return machine
      }
    }

    case 'offeringHelp': {
      switch (event.type) {
        case 'TIMER_AUTO_PAUSE':
          return {
            state: 'autoPaused',
            context: {
              ...context,
              autoPauseStats: event.autoPauseStats,
              eventLog: appendLog(context, event.type, 'offeringHelp', 'autoPaused', ''),
            },
          }

        case 'DIGIT_TYPED':
          return {
            state: 'idle',
            context: {
              ...context,
              idleStartedAt: Date.now(),
              eventLog: appendLog(context, event.type, 'offeringHelp', 'idle', 'reset timer'),
            },
          }

        case 'HELP_ENTERED':
          return {
            state: 'inHelp',
            context: {
              ...context,
              eventLog: appendLog(context, event.type, 'offeringHelp', 'inHelp', ''),
            },
          }

        default:
          return machine
      }
    }

    case 'autoPaused': {
      switch (event.type) {
        case 'RESUMED':
          return {
            state: 'idle',
            context: {
              ...context,
              idleStartedAt: Date.now(),
              eventLog: appendLog(context, event.type, 'autoPaused', 'idle', 'reset timer'),
            },
          }

        default:
          return machine
      }
    }

    case 'inHelp': {
      switch (event.type) {
        case 'HELP_TERM_COMPLETED': {
          const newSet = new Set(context.helpedTermIndices)
          newSet.add(event.termIndex)
          return {
            state: 'inHelp',
            context: {
              ...context,
              helpedTermIndices: newSet,
              eventLog: appendLog(
                context,
                event.type,
                'inHelp',
                'inHelp',
                `term=${event.termIndex}, helped=${newSet.size}`
              ),
            },
          }
        }

        case 'HELP_EXITED': {
          // Determine if all terms have been helped
          // Help is for terms at indices 1..n-1 (first term is the starting number)
          const helpableTermCount = Math.max(0, event.problemTermsCount - 1)
          const allHelped = helpableTermCount > 0 &&
            context.helpedTermIndices.size >= helpableTermCount
          const shouldStartGrace = allHelped && !context.moveOnAvailable

          return {
            state: 'idle',
            context: {
              ...context,
              idleStartedAt: Date.now(),
              allTermsHelped: allHelped || context.allTermsHelped,
              moveOnGraceStartedAt: shouldStartGrace ? Date.now() : context.moveOnGraceStartedAt,
              eventLog: appendLog(
                context,
                event.type,
                'inHelp',
                'idle',
                allHelped ? 'all terms helped, grace started' : ''
              ),
            },
          }
        }

        case 'DIGIT_TYPED':
          return {
            state: 'idle',
            context: {
              ...context,
              idleStartedAt: Date.now(),
              eventLog: appendLog(context, event.type, 'inHelp', 'idle', 'student typed'),
            },
          }

        default:
          return machine
      }
    }

    default:
      return machine
  }
}

// =============================================================================
// Derived Values
// =============================================================================

export function showWrongAnswerSuggestion(
  state: AssistanceStateName,
  ctx: AssistanceContext
): boolean {
  return (
    ctx.wrongAttemptCount >= ctx.wrongAnswerThreshold &&
    state !== 'inHelp' &&
    state !== 'autoPaused'
  )
}

// =============================================================================
// Hook
// =============================================================================

export interface UseProgressiveAssistanceInputs {
  /** Current attempt (null when loading) */
  attempt: { startTime: number; accumulatedPauseMs: number; problem: { terms: number[] } } | null
  /** Historical results for threshold calculation */
  results: SlotResult[]
  /** Number of terms in current problem */
  problemTermsCount: number
  /** Whether session is currently paused */
  isPaused: boolean
  /** Called when auto-pause fires — should pause the session and set pause info */
  onAutoPause: (info: PauseInfo) => void
}

export interface UseProgressiveAssistanceReturn {
  machineState: AssistanceMachineState
  showWrongAnswerSuggestion: boolean
  onDigitTyped: () => void
  onWrongAnswer: () => void
  onHelpEntered: () => void
  onHelpTermCompleted: (termIndex: number) => void
  onHelpExited: () => void
  onResumed: () => void
  onProblemChanged: () => void
  dismissWrongAnswerSuggestion: () => void
}

export function useProgressiveAssistance(
  inputs: UseProgressiveAssistanceInputs
): UseProgressiveAssistanceReturn {
  const {
    attempt,
    results,
    problemTermsCount,
    isPaused,
    onAutoPause,
  } = inputs

  // Determine timing config
  const timing = useMemo<ProgressiveAssistanceTimingConfig>(
    () => getProgressiveAssistanceTiming(shouldUseDebugTiming()),
    []
  )

  // Calculate initial thresholds
  const initialThresholds = useMemo(
    () => calculateProgressiveThresholds(results, timing),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // Only on mount — thresholds update via UPDATE_THRESHOLDS event
  )

  const [machine, dispatch] = useReducer(assistanceReducer, {
    state: 'idle' as AssistanceStateName,
    context: createFreshContext(
      initialThresholds,
      timing.wrongAnswerThreshold,
      timing.moveOnGraceMs,
    ),
  })

  // Update thresholds when results change
  const prevResultsLengthRef = useRef(results.length)
  useEffect(() => {
    if (results.length !== prevResultsLengthRef.current) {
      prevResultsLengthRef.current = results.length
      const newThresholds = calculateProgressiveThresholds(results, timing)
      dispatch({ type: 'UPDATE_THRESHOLDS', thresholds: newThresholds })
    }
  }, [results, timing])

  // Refs for stable callbacks that need current values
  const onAutoPauseRef = useRef(onAutoPause)
  onAutoPauseRef.current = onAutoPause
  const problemTermsCountRef = useRef(problemTermsCount)
  problemTermsCountRef.current = problemTermsCount

  // Timer orchestration for idle → encouraging → offeringHelp → autoPaused
  useEffect(() => {
    const timedStates: AssistanceStateName[] = ['idle', 'encouraging', 'offeringHelp']
    if (!timedStates.includes(machine.state)) return
    if (isPaused || !attempt) return

    const { thresholds, idleStartedAt } = machine.context
    const elapsed = Date.now() - idleStartedAt

    let targetMs: number
    let timerEventFactory: () => AssistanceEvent

    switch (machine.state) {
      case 'idle':
        targetMs = thresholds.encouragementMs
        timerEventFactory = () => ({ type: 'TIMER_ENCOURAGEMENT' })
        break
      case 'encouraging':
        targetMs = thresholds.helpOfferMs
        timerEventFactory = () => ({ type: 'TIMER_HELP_OFFER' })
        break
      case 'offeringHelp': {
        targetMs = thresholds.autoPauseMs
        timerEventFactory = () => {
          const { stats } = calculateAutoPauseInfo(results)
          return { type: 'TIMER_AUTO_PAUSE', autoPauseStats: stats }
        }
        break
      }
      default:
        return
    }

    const remainingMs = targetMs - elapsed

    const fireTimer = () => {
      const timerEvent = timerEventFactory()
      dispatch(timerEvent)

      if (timerEvent.type === 'TIMER_AUTO_PAUSE') {
        const autoPauseInfo: PauseInfo = {
          pausedAt: new Date(),
          reason: 'auto-timeout',
          autoPauseStats: timerEvent.autoPauseStats,
        }
        onAutoPauseRef.current(autoPauseInfo)
      }
    }

    if (remainingMs <= 0) {
      fireTimer()
      return
    }

    const timeoutId = setTimeout(fireTimer, remainingMs)
    return () => clearTimeout(timeoutId)
  }, [
    machine.state,
    machine.context.idleStartedAt,
    machine.context.thresholds,
    isPaused,
    attempt,
    results,
  ])

  // Move-on grace timer
  useEffect(() => {
    if (machine.state !== 'idle') return
    if (!machine.context.allTermsHelped) return
    if (machine.context.moveOnAvailable) return
    if (!machine.context.moveOnGraceStartedAt) return

    const elapsed = Date.now() - machine.context.moveOnGraceStartedAt
    const remaining = machine.context.moveOnGraceMs - elapsed

    if (remaining <= 0) {
      dispatch({ type: 'TIMER_MOVE_ON_GRACE' })
      return
    }

    const timeoutId = setTimeout(() => {
      dispatch({ type: 'TIMER_MOVE_ON_GRACE' })
    }, remaining)

    return () => clearTimeout(timeoutId)
  }, [
    machine.state,
    machine.context.allTermsHelped,
    machine.context.moveOnAvailable,
    machine.context.moveOnGraceStartedAt,
    machine.context.moveOnGraceMs,
  ])

  // Stable event dispatchers
  const onDigitTyped = useCallback(() => {
    dispatch({ type: 'DIGIT_TYPED' })
  }, [])

  const onWrongAnswer = useCallback(() => {
    dispatch({ type: 'WRONG_ANSWER' })
  }, [])

  const onHelpEntered = useCallback(() => {
    dispatch({ type: 'HELP_ENTERED' })
  }, [])

  const onHelpTermCompleted = useCallback((termIndex: number) => {
    dispatch({ type: 'HELP_TERM_COMPLETED', termIndex })
  }, [])

  const onHelpExited = useCallback(() => {
    dispatch({ type: 'HELP_EXITED', problemTermsCount: problemTermsCountRef.current })
  }, [])

  const onResumed = useCallback(() => {
    dispatch({ type: 'RESUMED' })
  }, [])

  const onProblemChanged = useCallback(() => {
    dispatch({ type: 'PROBLEM_CHANGED' })
  }, [])

  const dismissWrongAnswerSuggestion = useCallback(() => {
    dispatch({ type: 'DISMISS_WRONG_ANSWER_SUGGESTION' })
  }, [])

  // Derived values
  const showWrongAnswerSuggestionValue = showWrongAnswerSuggestion(machine.state, machine.context)

  return {
    machineState: machine,
    showWrongAnswerSuggestion: showWrongAnswerSuggestionValue,
    onDigitTyped,
    onWrongAnswer,
    onHelpEntered,
    onHelpTermCompleted,
    onHelpExited,
    onResumed,
    onProblemChanged,
    dismissWrongAnswerSuggestion,
  }
}
