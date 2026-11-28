'use client'

import { animated, useSpring } from '@react-spring/web'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useMyAbacus } from '@/contexts/MyAbacusContext'
import { useTheme } from '@/contexts/ThemeContext'
import { sameProblem } from '@/db/schema/session-plan-helpers'
import type {
  ProblemSlot,
  SessionHealth,
  SessionPart,
  SessionPlan,
  SlotResult,
  SlotResultSubmission,
} from '@/db/schema/session-plans'
import {
  arithmeticCursorLinearIndex,
  arithmeticRetryRoundSize,
  arithmeticSlotAt,
  arithmeticSlotOf,
  arithmeticSlotOfProblem,
  type OnScreenItem,
} from '@/lib/curriculum/parts/arithmetic/session-view'
import { getCurrentProblemInfo, MAX_RETRY_EPOCHS } from '@/lib/curriculum/parts/arithmetic/state'
import { applyResponseTimeGuard } from '@/lib/curriculum/timing/response-time-guard'
import { css } from '../../../styled-system/css'
import type { AutoPauseStats, PauseInfo } from './autoPauseCalculator'
import { BrowseModeView } from './BrowseModeView'
import { extractTargetSkillName, PurposeBadge } from './PurposeBadge'
import { RetryTransitionScreen } from './RetryTransitionScreen'
import { SessionPausedModal } from './SessionPausedModal'

// Re-export types for consumers
export type { AutoPauseStats, PauseInfo }

/**
 * Student info needed for the pause modal
 */
export interface StudentInfo {
  id: string
  name: string
  emoji: string
  color: string
}

import { useAbacusDisplay } from '@soroban/abacus-react'
import type { ReceivedAbacusControl } from '@/hooks/useSessionBroadcast'
import { useSetRemoteCameraSession } from '@/hooks/useSessionPlan'
import { AbacusDock } from '../AbacusDock'
import { DecompositionProvider, DecompositionSection } from '../decomposition'
import { AssistanceDebugPanel } from './AssistanceDebugPanel'
import { generateCoachHint } from './coachHintGenerator'
import { DebugOverlay } from './DebugOverlay'
import { useHasPhysicalKeyboard } from './hooks/useDeviceDetection'
import {
  type AttemptInput,
  findMatchedPrefixIndex,
  useInteractionPhase,
} from './hooks/useInteractionPhase'
import { useProgressiveAssistance } from './hooks/useProgressiveAssistance'
import { LinearProblem } from './LinearProblem'
// Audio disabled for practice sessions (use abacus / visualize)
import { NumericKeypad } from './NumericKeypad'
import { PracticeFeedback } from './PracticeFeedback'
import { PracticeHelpOverlay } from './PracticeHelpOverlay'
import { ProblemDebugPanel } from './ProblemDebugPanel'
import { ProgressiveAssistanceUI } from './ProgressiveAssistanceUI'
import {
  chooseRedoReturnTarget,
  type RedoWriteOutcome,
  type TransitionTarget,
} from './redoReturnTarget'
import { VerticalProblem } from './VerticalProblem'

/**
 * Timing data for the current problem attempt
 */
export interface AttemptTimingData {
  /** When the current attempt started */
  startTime: number
  /** Accumulated pause time in ms */
  accumulatedPauseMs: number
}

/**
 * Complexity data for broadcast (simplified for transmission)
 */
export interface BroadcastComplexity {
  /** Complexity bounds from slot constraints */
  bounds?: { min?: number; max?: number }
  /** Total complexity cost from generation trace */
  totalCost?: number
  /** Number of steps (for per-term average) */
  stepCount?: number
  /** Pre-formatted target skill name */
  targetSkillName?: string
}

/**
 * Broadcast state for session observation
 * This is sent to teachers observing the session in real-time
 */
export interface BroadcastState {
  /** Current problem being worked on */
  currentProblem: {
    terms: number[]
    answer: number
  }
  /** Unique slot ID for this problem (same ID used in answer validation) */
  slotId: string
  /** Current phase of the interaction */
  phase: 'problem' | 'feedback' | 'tutorial'
  /** Student's current answer (empty string if not yet started typing) */
  studentAnswer: string
  /** Whether the answer is correct (null if not yet submitted) */
  isCorrect: boolean | null
  /** When the current attempt started (timestamp) */
  startedAt: number
  /** Purpose of this problem slot (why this problem was selected) */
  purpose: 'focus' | 'reinforce' | 'review' | 'challenge'
  /** Complexity data for tooltip display */
  complexity?: BroadcastComplexity
  /**
   * The item on screen: the problem's own part and item, whether it is a
   * do-over, and its retry round. Position and counts are not here (Phase
   * 5b): the page takes them from the server's plan and the report.
   */
  item: BroadcastItem
}

/** The item on screen, as `BroadcastState` names it. */
export interface BroadcastItem extends OnScreenItem {
  /** Retry round of the problem on screen (0 = original; a do-over is 0) */
  round: number
}

type SubmitAdvanceDestination = 'next-problem-same-lane' | 'state-handoff'
type SubmitAdvanceIntent = 'slide-to-next-problem' | 'clear-to-loading'
type SubmitMode = 'practice' | 'redo'
/**
 * Identity of the problem an attempt answers, as the server matches it: the
 * attempt's own part, slot and round, never the plan's current ones (which
 * lag one problem behind an optimistic advance), plus the try id minted when
 * the problem was shown (the server records a try id once).
 */
function answeredProblemIdentity(plan: SessionPlan, attempt: AttemptInput) {
  return {
    tryId: attempt.tryId,
    partIndex: attempt.partIndex,
    slotId: arithmeticSlotAt(plan.parts, attempt.partIndex, attempt.slotIndex)?.slotId ?? '',
    slotIndex: attempt.slotIndex,
    epochNumber: attempt.epochNumber ?? 0,
  }
}

type SubmitAdvanceResolution = {
  destination: SubmitAdvanceDestination
  intent: SubmitAdvanceIntent
  transitionTarget: TransitionTarget | null
}

function getSubmitAdvanceIntent(destination: SubmitAdvanceDestination): SubmitAdvanceIntent {
  return destination === 'next-problem-same-lane' ? 'slide-to-next-problem' : 'clear-to-loading'
}

/**
 * A do-over the kid chose by tapping a dot: the item, by its id (Phase 5b).
 * Where the session goes after it is the server's plan, never a remembered
 * position.
 */
export interface ActiveRedo {
  isActive: boolean
  /** Part of the item being redone */
  partIndex: number
  /** The item being redone (today its slot id) */
  itemId: string
  /** The dots' index of the item (its number on screen is `linearIndex + 1`) */
  linearIndex: number
  /** The latest result of the item when it was tapped */
  originalResult: SlotResult
}

/** What a do-over write sends (`record_redo`). */
export interface RecordRedoParams {
  playerId: string
  planId: string
  result: Omit<SlotResult, 'timestamp' | 'partNumber'> & { tryId: string }
  redoContext: {
    /** The item redone (Phase 5b); the server also reads `result.slotId` */
    itemId: string
    /** Legacy position of the item, which servers up to Phase 5 match by */
    originalPartIndex: number
    originalSlotIndex: number
    /** Read only by servers from before Phase 1 */
    originalWasCorrect: boolean
  }
}

/**
 * The do-over write for a tapped item: the result names the item
 * (`slotId = itemId`) and `redoContext.itemId` names it to a server from Phase
 * 5a on; the item's slot index rides beside it for servers before that (the
 * indices must agree with the id).
 */
export function doOverWriteOf({
  playerId,
  planId,
  redo,
  slotIndex,
  result,
  originalWasCorrect,
}: {
  playerId: string
  planId: string
  redo: Pick<ActiveRedo, 'partIndex' | 'itemId'>
  /** The item's slot index, read off the item by the kind's view */
  slotIndex: number
  result: Omit<SlotResult, 'timestamp' | 'partNumber'> & { tryId: string }
  originalWasCorrect: boolean
}): RecordRedoParams {
  return {
    playerId,
    planId,
    result: { ...result, slotId: redo.itemId, slotIndex, originalSlotIndex: slotIndex },
    redoContext: {
      itemId: redo.itemId,
      originalPartIndex: redo.partIndex,
      originalSlotIndex: slotIndex,
      // For servers from before Phase 1; a current server derives it
      originalWasCorrect,
    },
  }
}

interface ActiveSessionProps {
  plan: SessionPlan
  /** Historical results from prior completed sessions for threshold calculation */
  historicalResults?: SlotResult[]
  /** Student info for display in pause modal */
  student: StudentInfo
  /** Called when a problem is answered */
  onAnswer: (result: SlotResultSubmission & { partIndex: number; tryId: string }) => Promise<void>
  /** Called when session is ended early */
  onEndEarly: (reason?: string) => void
  /** Called when session is paused (with info about why) - for external HUD updates */
  onPause?: (pauseInfo: PauseInfo) => void
  /** Called when session is resumed - for external HUD updates */
  onResume?: () => void
  /** Called with timing data when it changes (for external timing display) */
  onTimingUpdate?: (timing: AttemptTimingData | null) => void
  /** Called with broadcast state when it changes (for session observation) */
  onBroadcastStateChange?: (state: BroadcastState | null) => void
  /** Whether browse mode is active (controlled externally via toggle in PracticeSubNav) */
  isBrowseMode?: boolean
  /** Controlled browse index (linear problem index) */
  browseIndex?: number
  /** Called when browse index changes (for external navigation from progress indicator) */
  onBrowseIndexChange?: (index: number) => void
  /** Teacher abacus control received from observing teacher */
  teacherControl?: ReceivedAbacusControl | null
  /** Called after teacher control has been handled (to clear the state) */
  onTeacherControlHandled?: () => void
  /** Teacher-initiated pause request (from observing teacher) */
  teacherPauseRequest?: { message?: string } | null
  /** Called after teacher pause has been handled (to clear the state) */
  onTeacherPauseHandled?: () => void
  /** Teacher-initiated resume request (from observing teacher) */
  teacherResumeRequest?: boolean
  /** Called after teacher resume has been handled (to clear the state) */
  onTeacherResumeHandled?: () => void
  /** Manual pause request from parent (HUD pause button) */
  manualPauseRequest?: boolean
  /** Called after manual pause has been handled (to clear the state) */
  onManualPauseHandled?: () => void
  /** Redo state - when set, show a redo problem instead of current session problem */
  redoState?: ActiveRedo | null
  /** Called to record a redo result (separate from onAnswer since it doesn't advance position) */
  onRecordRedo?: (params: RecordRedoParams) => Promise<SessionPlan | null>
  /** Called when the redo is complete or cancelled */
  onRedoComplete?: () => void
  /** Called to cancel the redo without recording */
  onCancelRedo?: () => void
  /** Called when a result is edited in browse mode (to trigger refetch) */
  onResultEdited?: () => void
  /** When true, show the debug overlay with submit buttons */
  debug?: boolean
  /**
   * Bumped by the parent after a server write failed and the plan was
   * refetched: re-show the server's current problem even if its key is the
   * one already on screen.
   */
  resyncRequest?: number
}

/**
 * Calculate the number of abacus columns needed to compute a problem.
 *
 * This considers all intermediate running totals as we progress through the terms,
 * not just the final answer. For subtraction (e.g., 87 - 45 = 42), we need
 * enough columns for the minuend (87), not just the answer (42).
 */
function calculateAbacusColumns(terms: number[]): number {
  if (terms.length === 0) return 1

  let runningTotal = 0
  let maxAbsValue = 0

  for (const term of terms) {
    runningTotal += term
    maxAbsValue = Math.max(maxAbsValue, Math.abs(runningTotal))
  }

  return Math.max(1, String(maxAbsValue).length)
}

/**
 * Owner toggle: show the "…" partial-answer cue on LINEAR problems (renders "…"
 * instead of "=" while the typed number equals a running subtotal). It's a generic
 * "you're mid-calculation, keep going" hint — not a bead widget — so it stays on.
 * Flip to false to make linear show only "=".
 */
const SHOW_LINEAR_PREFIX_HINT = true

/**
 * ActiveSession - The main practice session component
 *
 * Features:
 * - Three-part session structure (abacus, visualization, linear)
 * - Part-specific display and instructions
 * - Adaptive input (keyboard on desktop, on-screen keypad on mobile)
 * - Session health indicators
 * - On-screen abacus toggle (for abacus part only)
 * - Teacher controls (pause, end early)
 *
 * State Architecture:
 * - Uses useInteractionPhase hook for interaction state machine
 * - Single source of truth for all UI state
 * - Explicit phase transitions instead of boolean flags
 */
export function ActiveSession({
  plan,
  historicalResults,
  student,
  onAnswer,
  onEndEarly,
  onPause,
  onResume,
  onTimingUpdate,
  onBroadcastStateChange,
  isBrowseMode: isBrowseModeProp = false,
  browseIndex: browseIndexProp,
  onBrowseIndexChange,
  teacherControl,
  onTeacherControlHandled,
  teacherPauseRequest,
  onTeacherPauseHandled,
  teacherResumeRequest,
  onTeacherResumeHandled,
  manualPauseRequest,
  onManualPauseHandled,
  redoState,
  onRecordRedo,
  onRedoComplete,
  onCancelRedo,
  onResultEdited,
  debug = false,
  resyncRequest = 0,
}: ActiveSessionProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Check if abacus is docked (to force show submit button)
  const {
    isDockedByUser,
    requestDock,
    undock,
    dock,
    setDockedValue,
    visionConfig,
    captureTrainingColumns,
    setVisionRemoteSession,
  } = useMyAbacus()

  // Mutation for saving remote camera session ID to the session plan
  const setRemoteCameraSessionMutation = useSetRemoteCameraSession()

  // Track whether we've synced from DB to avoid infinite loops
  const hasInitializedRemoteSessionRef = useRef(false)
  const lastSyncedRemoteSessionRef = useRef<string | null>(null)

  // Sync remote camera session ID between session plan (DB) and vision config (context)
  useEffect(() => {
    // On mount: sync from DB to context if plan has a remote camera session
    if (!hasInitializedRemoteSessionRef.current) {
      hasInitializedRemoteSessionRef.current = true
      if (plan.remoteCameraSessionId) {
        setVisionRemoteSession(plan.remoteCameraSessionId)
        lastSyncedRemoteSessionRef.current = plan.remoteCameraSessionId
      }
      return
    }

    // After initialization: sync from context to DB when it changes
    const currentRemoteSession = visionConfig.remoteCameraSessionId
    if (currentRemoteSession !== lastSyncedRemoteSessionRef.current) {
      lastSyncedRemoteSessionRef.current = currentRemoteSession
      setRemoteCameraSessionMutation.mutate({
        playerId: student.id,
        planId: plan.id,
        remoteCameraSessionId: currentRemoteSession,
      })
    }
  }, [
    plan.id,
    plan.remoteCameraSessionId,
    student.id,
    visionConfig.remoteCameraSessionId,
    setVisionRemoteSession,
    setRemoteCameraSessionMutation,
  ])

  // Get abacus display config (for physical abacus column count in vision mode)
  const { config: abacusDisplayConfig } = useAbacusDisplay()

  // Track which problems have had training data collected (one frame per problem)
  const trainingDataCollectedRef = useRef<Set<string>>(new Set())

  // Collect training data when vision is enabled and answer is correct
  const collectVisionTrainingData = useCallback(
    async (correctAnswer: number, slotIndex: number) => {
      // Only collect if vision is enabled and docked
      if (!visionConfig.enabled || !isDockedByUser) return

      // Create a unique key for this problem to avoid duplicate collection
      const problemKey = `${plan.id}-${slotIndex}`
      if (trainingDataCollectedRef.current.has(problemKey)) return

      // Get column count from display config (physicalAbacusColumns for vision detection)
      const columnCount = abacusDisplayConfig?.physicalAbacusColumns ?? 5

      // Capture the current column images
      const columns = captureTrainingColumns(columnCount)
      if (!columns || columns.length === 0) {
        return
      }

      // Mark as collected before sending (to avoid race conditions)
      trainingDataCollectedRef.current.add(problemKey)

      // Send to the collection API (fire and forget - don't block the UI)
      try {
        const response = await fetch('/api/vision-training/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            columns,
            correctAnswer,
            playerId: student.id,
            sessionId: plan.id,
          }),
        })
        if (!response.ok) {
          return
        }
      } catch {
        return
      }
    },
    [
      visionConfig.enabled,
      isDockedByUser,
      plan.id,
      student.id,
      captureTrainingColumns,
      abacusDisplayConfig,
    ]
  )

  // Compute initial problem from plan for SSR hydration (must be before useInteractionPhase)
  // Uses getCurrentProblemInfo to account for retry epochs
  const currentProblemInfo = useMemo(() => getCurrentProblemInfo(plan), [plan])

  const initialProblem = useMemo(() => {
    if (currentProblemInfo) {
      return {
        problem: currentProblemInfo.problem,
        slotIndex: currentProblemInfo.originalSlotIndex,
        partIndex: plan.currentPartIndex,
        epochNumber: currentProblemInfo.epochNumber,
      }
    }
    return undefined
  }, [currentProblemInfo, plan.currentPartIndex])

  // ============================================================================
  // SINGLE SOURCE OF TRUTH: Which problem should be displayed right now
  // ============================================================================
  // This computed value derives the active problem from redoState + plan.
  // The hook reacts to changes in activeProblem.key to load new problems, eliminating
  // the need for synchronization effects between redoState and phase.attempt.problem.
  const activeProblem = useMemo(() => {
    // Redo mode takes priority - user clicked on a problem to redo
    if (redoState?.isActive) {
      const redo = arithmeticSlotOf(plan.parts[redoState.partIndex], redoState.itemId)
      const redoProblem = redo?.slot.problem
      if (redo && redoProblem) {
        return {
          problem: redoProblem,
          slotIndex: redo.slotIndex,
          partIndex: redoState.partIndex,
          key: `redo-${redoState.partIndex}-${redoState.itemId}`,
        }
      }
    }

    // Normal mode: use currentProblemInfo (handles epochs/retries correctly)
    if (currentProblemInfo?.problem) {
      return {
        problem: currentProblemInfo.problem,
        slotIndex: currentProblemInfo.originalSlotIndex,
        partIndex: plan.currentPartIndex,
        epochNumber: currentProblemInfo.epochNumber,
        key: `normal-${plan.currentPartIndex}-${currentProblemInfo.originalSlotIndex}-${currentProblemInfo.epochNumber ?? 0}`,
      }
    }

    return null
  }, [redoState, plan.parts, plan.currentPartIndex, currentProblemInfo])

  // LINEAR parts drop the bead-help scaffolding (prefix-sum / disambiguation / help
  // coach): the horizontal number sentence uses free digit entry + a forced submit.
  // The working abacus itself is a SEPARATE concern (see showAbacusDock / useAbacus):
  // it stays ON during the linear-with-abacus ramp and only goes away for mental
  // (post-gate) linear. Keyed off the part of the problem actually loaded into the
  // interaction hook (activeProblem.partIndex), which matches the on-screen problem
  // even in redo mode.
  const activePartIndex = activeProblem?.partIndex ?? plan.currentPartIndex
  const isLinearActive = plan.parts[activePartIndex]?.format === 'linear'

  const latestActiveProblemRef = useRef(activeProblem)
  const latestCurrentProblemInfoRef = useRef(currentProblemInfo)
  useEffect(() => {
    latestActiveProblemRef.current = activeProblem
    latestCurrentProblemInfoRef.current = currentProblemInfo
  }, [activeProblem, currentProblemInfo])

  // Interaction state machine - single source of truth for UI state
  const {
    phase,
    attempt,
    helpContext,
    outgoingAttempt,
    canAcceptInput,
    showAsCompleted,
    showHelpOverlay,
    showInputArea,
    showFeedback,
    inputIsFocused,
    isTransitioning,
    isPaused,
    isSubmitting,
    prefixSums,
    prefixMatch,
    matchedPrefixIndex,
    canSubmit,
    shouldAutoSubmit,
    ambiguousHelpTermIndex,
    handleDigit,
    handleBackspace,
    enterHelpMode,
    exitHelpMode,
    clearAnswer,
    setAnswer,
    startSubmit,
    completeSubmit,
    startTransition,
    completeTransition,
    clearToLoading,
    pause,
    resume,
  } = useInteractionPhase({
    initialProblem,
    activeProblem,
    disableAbacusScaffolding: isLinearActive,
  })

  // A server write failed and the plan was refetched (resyncRequest bumped):
  // drop whatever is on screen and load the server's current problem. Loading
  // re-reads activeProblem even when its key has not changed.
  const handledResyncRef = useRef(resyncRequest)
  useEffect(() => {
    if (resyncRequest === handledResyncRef.current) return
    handledResyncRef.current = resyncRequest
    clearToLoading()
  }, [resyncRequest, clearToLoading])

  // Format of the OUTGOING problem's part (may differ from the current part at a
  // part boundary), so the sliding-away problem keeps its own vertical/linear shape.
  const outgoingFormat =
    outgoingAttempt != null ? plan.parts[outgoingAttempt.partIndex]?.format : undefined

  // Progressive assistance state machine — subsumes auto-pause timer
  const handleAutoPause = useCallback(
    (info: PauseInfo) => {
      setPauseInfo(info)
      pause()
      onPause?.(info)
    },
    [pause, onPause]
  )

  // Combine historical results from prior sessions with current session results.
  // Historical data provides the baseline for threshold calculation from session start;
  // current session results refine it as the student answers more problems.
  const thresholdResults = useMemo(
    () => [...(historicalResults ?? []), ...plan.results],
    [historicalResults, plan.results]
  )

  const assistance = useProgressiveAssistance({
    attempt: attempt
      ? {
          startTime: attempt.startTime,
          accumulatedPauseMs: attempt.accumulatedPauseMs,
          problem: {
            terms: attempt.problem.terms,
            generationTrace: attempt.problem.generationTrace,
          },
        }
      : null,
    results: thresholdResults,
    problemTermsCount: attempt?.problem?.terms?.length ?? 0,
    isPaused,
    onAutoPause: handleAutoPause,
  })

  // Sync assistance machine with interaction phase transitions
  const prevPhaseRef = useRef(phase.phase)
  useEffect(() => {
    const prev = prevPhaseRef.current
    const curr = phase.phase
    prevPhaseRef.current = curr

    // Entered help mode
    if (curr === 'helpMode' && prev !== 'helpMode') {
      assistance.onHelpEntered()
    }
    // Exited help mode
    if (prev === 'helpMode' && curr !== 'helpMode') {
      assistance.onHelpExited()
    }
  }, [phase.phase, assistance.onHelpEntered, assistance.onHelpExited])

  // Notify assistance machine when problem changes
  const prevActiveProblemKeyRef = useRef(activeProblem?.key)
  useEffect(() => {
    const prevKey = prevActiveProblemKeyRef.current
    const currKey = activeProblem?.key
    prevActiveProblemKeyRef.current = currKey

    if (prevKey !== undefined && currKey !== prevKey) {
      assistance.onProblemChanged()
    }
  }, [activeProblem?.key, assistance.onProblemChanged])

  // Notify parent of timing data changes for external timing display
  useEffect(() => {
    if (onTimingUpdate) {
      if (attempt) {
        onTimingUpdate({
          startTime: attempt.startTime,
          accumulatedPauseMs: attempt.accumulatedPauseMs,
        })
      } else {
        onTimingUpdate(null)
      }
    }
  }, [onTimingUpdate, attempt?.startTime, attempt?.accumulatedPauseMs])

  // Audio disabled for practice sessions (use abacus / visualize)

  // The item last broadcast as on screen: the problem sliding off during a
  // transition is that item, with its own round and do-over flag (the redo
  // state may already be cleared by then)
  const lastBroadcastItemRef = useRef<{
    item: BroadcastItem
    problem: { terms: number[]; answer: number }
  } | null>(null)

  // Notify parent of broadcast state changes for session observation
  useEffect(() => {
    if (!onBroadcastStateChange) return

    // Helper to extract complexity data from a slot
    const extractComplexity = (slot: ProblemSlot | undefined): BroadcastComplexity | undefined => {
      if (!slot) return undefined

      const bounds = slot.complexityBounds
      const trace = slot.problem?.generationTrace
      const hasBounds = bounds && (bounds.min !== undefined || bounds.max !== undefined)
      const hasCost = trace?.totalComplexityCost !== undefined

      if (!hasBounds && !hasCost) return undefined

      return {
        bounds: hasBounds ? { min: bounds?.min, max: bounds?.max } : undefined,
        totalCost: trace?.totalComplexityCost,
        stepCount: trace?.steps?.length,
        targetSkillName: extractTargetSkillName(slot) ?? undefined,
      }
    }

    const doOver = redoState?.isActive ?? false

    // During transitioning, we show the outgoing (answered) problem, not the incoming one
    if (phase.phase === 'transitioning' && outgoingAttempt) {
      const shown = lastBroadcastItemRef.current
      const outgoingItem =
        shown &&
        shown.item.partIndex === outgoingAttempt.partIndex &&
        sameProblem(shown.problem, outgoingAttempt.problem)
          ? shown.item
          : null
      const outgoingSlot = outgoingItem
        ? arithmeticSlotOf(plan.parts[outgoingItem.partIndex], outgoingItem.itemId)?.slot
        : arithmeticSlotOfProblem(plan.parts, outgoingAttempt.partIndex, outgoingAttempt.problem)
      onBroadcastStateChange({
        currentProblem: {
          terms: outgoingAttempt.problem.terms,
          answer: outgoingAttempt.problem.answer,
        },
        slotId: outgoingSlot?.slotId ?? '',
        phase: 'feedback',
        studentAnswer: outgoingAttempt.userAnswer,
        isCorrect: outgoingAttempt.result === 'correct',
        startedAt: attempt?.startTime ?? Date.now(),
        purpose: outgoingSlot?.purpose ?? 'focus',
        complexity: extractComplexity(outgoingSlot),
        item: outgoingItem ?? {
          partIndex: outgoingAttempt.partIndex,
          itemId: outgoingSlot?.slotId ?? '',
          doOver,
          round: 0,
        },
      })
      return
    }

    if (!attempt) {
      onBroadcastStateChange(null)
      return
    }

    // The slot of the problem on screen (its own part and slot: a retry's
    // original slot, a do-over's slot), not the plan's cursor
    const slot = arithmeticSlotAt(plan.parts, attempt.partIndex, attempt.slotIndex)

    // Map internal phase to broadcast phase
    let broadcastPhase: 'problem' | 'feedback' | 'tutorial'
    if (phase.phase === 'helpMode') {
      broadcastPhase = 'tutorial'
    } else if (phase.phase === 'showingFeedback') {
      broadcastPhase = 'feedback'
    } else {
      broadcastPhase = 'problem'
    }

    // Determine if answer is correct (only known in feedback phase)
    let isCorrect: boolean | null = null
    if (phase.phase === 'showingFeedback') {
      // Use the result stored in the phase, not calculated from attempt
      isCorrect = phase.result === 'correct'
    }

    const item: BroadcastItem = {
      partIndex: attempt.partIndex,
      itemId: slot?.slotId ?? '',
      doOver,
      round: attempt.epochNumber ?? 0,
    }
    lastBroadcastItemRef.current = { item, problem: attempt.problem }
    onBroadcastStateChange({
      currentProblem: {
        terms: attempt.problem.terms,
        answer: attempt.problem.answer,
      },
      slotId: slot?.slotId ?? '',
      phase: broadcastPhase,
      studentAnswer: attempt.userAnswer,
      isCorrect,
      startedAt: attempt.startTime,
      purpose: slot?.purpose ?? 'focus',
      complexity: extractComplexity(slot),
      item,
    })
  }, [
    onBroadcastStateChange,
    attempt?.problem?.terms,
    attempt?.problem?.answer,
    attempt?.userAnswer,
    attempt?.startTime,
    attempt?.partIndex,
    attempt?.slotIndex,
    attempt?.epochNumber,
    phase,
    outgoingAttempt,
    plan.parts,
    redoState?.isActive,
  ])

  // Handle teacher abacus control events
  useEffect(() => {
    if (!teacherControl) return

    // Only handle controls during problem-solving phases
    const isInputPhase =
      phase.phase === 'inputting' ||
      phase.phase === 'awaitingDisambiguation' ||
      phase.phase === 'helpMode'

    if (!isInputPhase || !attempt) {
      onTeacherControlHandled?.()
      return
    }

    switch (teacherControl.type) {
      case 'set-value':
        // Teacher sets the abacus to a specific value
        // Update both the docked abacus value AND the answer input
        setDockedValue(teacherControl.value)
        setAnswer(String(teacherControl.value))
        break
      case 'show-abacus':
        // Request dock with animation (triggers MyAbacus to animate into dock)
        if (!isDockedByUser && dock) {
          requestDock()
        }
        break
      case 'hide-abacus':
        // Undock the MyAbacus
        if (isDockedByUser) {
          undock()
        }
        break
    }

    // Clear the control after handling
    onTeacherControlHandled?.()
  }, [
    teacherControl,
    phase.phase,
    attempt,
    setAnswer,
    setDockedValue,
    isDockedByUser,
    dock,
    requestDock,
    undock,
    onTeacherControlHandled,
  ])

  // Handle teacher-initiated pause requests
  // Use a ref to track if we've handled this request to prevent duplicate handling
  const handledPauseRef = useRef(false)
  useEffect(() => {
    if (!teacherPauseRequest) {
      handledPauseRef.current = false
      return
    }
    if (handledPauseRef.current) return
    handledPauseRef.current = true

    // Pause the session with teacher reason
    const newPauseInfo: PauseInfo = {
      pausedAt: new Date(),
      reason: 'teacher',
      teacherMessage: teacherPauseRequest.message,
    }
    setPauseInfo(newPauseInfo)
    pause()
    onPause?.(newPauseInfo)

    // Clear the request after handling
    onTeacherPauseHandled?.()
  }, [teacherPauseRequest, pause, onPause, onTeacherPauseHandled])

  // Handle teacher-initiated resume requests
  // Use a ref to track if we've handled this request to prevent duplicate handling
  const handledResumeRef = useRef(false)
  useEffect(() => {
    if (!teacherResumeRequest) {
      handledResumeRef.current = false
      return
    }
    if (handledResumeRef.current) return
    handledResumeRef.current = true

    // Resume the session
    setPauseInfo(undefined)
    assistance.onResumed()
    resume()
    onResume?.()

    // Clear the request after handling
    onTeacherResumeHandled?.()
  }, [teacherResumeRequest, resume, onResume, onTeacherResumeHandled])

  // Handle manual pause requests from parent (HUD pause button)
  const handledManualPauseRef = useRef(false)
  useEffect(() => {
    if (!manualPauseRequest) {
      handledManualPauseRef.current = false
      return
    }
    if (handledManualPauseRef.current) return
    handledManualPauseRef.current = true

    // Pause the session with manual reason
    const newPauseInfo: PauseInfo = {
      pausedAt: new Date(),
      reason: 'manual',
    }
    setPauseInfo(newPauseInfo)
    pause()
    onPause?.(newPauseInfo)

    // Clear the request after handling
    onManualPauseHandled?.()
  }, [manualPauseRequest, pause, onPause, onManualPauseHandled])

  // Track which help elements have been individually dismissed
  // These reset when entering a new help session (helpContext changes)
  const [helpAbacusDismissed, setHelpAbacusDismissed] = useState(false)
  const [helpPanelDismissed, setHelpPanelDismissed] = useState(false)
  // Track when answer is fading out (for dream sequence)
  const [answerFadingOut, setAnswerFadingOut] = useState(false)
  // Capture reveal policy at submit-time so feedback is stable even if plan advances.
  const [showCorrectAnswerOnIncorrect, setShowCorrectAnswerOnIncorrect] = useState(true)

  // Track pause info for displaying in the modal (single source of truth)
  const [pauseInfo, setPauseInfo] = useState<PauseInfo | undefined>(undefined)

  // Retry transition state - for showing transition screen between retry epochs
  const [isInRetryTransition, setIsInRetryTransition] = useState(false)
  const [retryTransitionData, setRetryTransitionData] = useState<{
    epochNumber: number
    problemCount: number
  } | null>(null)
  // Track previous epoch to detect epoch changes
  const prevEpochRef = useRef<number>(0)

  // Browse mode state - isBrowseMode is controlled via props
  // browseIndex can be controlled (browseIndexProp + onBrowseIndexChange) or internal
  const [internalBrowseIndex, setInternalBrowseIndex] = useState(0)

  // Determine if browse index is controlled
  const isControlledBrowseIndex = browseIndexProp !== undefined
  const browseIndex = isControlledBrowseIndex ? browseIndexProp : internalBrowseIndex

  // Unified setter that handles both controlled and uncontrolled modes
  const setBrowseIndex = useCallback(
    (index: number | ((prev: number) => number)) => {
      const newIndex = typeof index === 'function' ? index(browseIndex) : index
      if (isControlledBrowseIndex) {
        onBrowseIndexChange?.(newIndex)
      } else {
        setInternalBrowseIndex(newIndex)
      }
    },
    [browseIndex, isControlledBrowseIndex, onBrowseIndexChange]
  )

  // Compute current practice position as a linear index
  // (the dots' coordinate, from the server's plan through the kind's view)
  const currentPracticeLinearIndex = useMemo(() => arithmeticCursorLinearIndex(plan), [plan])

  // When entering browse mode, initialize browseIndex to current problem
  const prevBrowseModeProp = useRef(isBrowseModeProp)
  useEffect(() => {
    if (isBrowseModeProp && !prevBrowseModeProp.current) {
      // Just entered browse mode - set to current practice position
      setBrowseIndex(currentPracticeLinearIndex)
    }
    prevBrowseModeProp.current = isBrowseModeProp
  }, [isBrowseModeProp, currentPracticeLinearIndex, setBrowseIndex])

  const handleDigitWithTimerReset = useCallback(
    (digit: string) => {
      assistance.onDigitTyped()
      handleDigit(digit)
    },
    [handleDigit, assistance.onDigitTyped]
  )

  // Reset dismissed states when help context changes (new help session)
  useEffect(() => {
    if (helpContext) {
      setHelpAbacusDismissed(false)
      setHelpPanelDismissed(false)
      setAnswerFadingOut(false)
    }
  }, [helpContext])

  // Exit help mode when both help elements are dismissed
  useEffect(() => {
    if (showHelpOverlay && helpAbacusDismissed && helpPanelDismissed) {
      exitHelpMode()
    }
  }, [showHelpOverlay, helpAbacusDismissed, helpPanelDismissed, exitHelpMode])

  // Refs for measuring problem widths during animation
  const outgoingRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)

  // Track if we need to apply centering offset (set true when transition starts)
  const needsCenteringOffsetRef = useRef(false)
  // Store the centering offset value for the animation end
  const centeringOffsetRef = useRef(0)

  // Spring for problem transition animation
  const [trackSpring, trackApi] = useSpring(() => ({
    x: 0,
    outgoingOpacity: 1,
    activeOpacity: 1,
    config: { tension: 200, friction: 26 },
  }))

  // Spring for submit button entrance animation
  // Show submit button when: manual submit is required OR abacus is docked (user needs way to submit)
  // Force it on for LINEAR parts: with the abacus scaffolding disabled we never reject
  // digits, so `manualSubmitRequired` never trips — and on touch that would leave a wrong
  // answer with no submit key (the keypad drops it when this is false). Correct answers
  // still auto-submit.
  const showSubmitButton = attempt?.manualSubmitRequired || isDockedByUser || isLinearActive
  const submitButtonSpring = useSpring({
    transform: showSubmitButton ? 'translateY(0px)' : 'translateY(60px)',
    opacity: showSubmitButton ? 1 : 0,
    scale: showSubmitButton ? 1 : 0.8,
    config: { tension: 280, friction: 14 },
  })

  // Apply centering offset before paint to prevent jank
  useLayoutEffect(() => {
    if (needsCenteringOffsetRef.current && outgoingRef.current) {
      const outgoingWidth = outgoingRef.current.offsetWidth
      const gap = 32 // 2rem gap
      const centeringOffset = (outgoingWidth + gap) / 2
      centeringOffsetRef.current = centeringOffset

      // Set initial position to compensate for flexbox centering
      trackApi.set({
        x: centeringOffset,
        outgoingOpacity: 1,
        activeOpacity: 0,
      })

      needsCenteringOffsetRef.current = false

      // Start fade-in of new problem
      trackApi.start({
        activeOpacity: 1,
        config: { tension: 200, friction: 26 },
      })

      // Start slide after a brief moment (150ms)
      setTimeout(() => {
        trackApi.start({
          x: -centeringOffset,
          outgoingOpacity: 0,
          config: { tension: 170, friction: 22 },
          onRest: () => {
            // Outgoing is now invisible - complete the transition
            flushSync(() => {
              completeTransition()
            })
            trackApi.set({ x: 0, outgoingOpacity: 1, activeOpacity: 1 })
          },
        })
      }, 150)
    }
  }, [outgoingAttempt, trackApi, completeTransition])

  const hasPhysicalKeyboard = useHasPhysicalKeyboard()

  // Track if keypad was ever shown - once shown, keep it visible
  // This prevents the keypad from disappearing if user uses physical keyboard
  const keypadWasShownRef = useRef(false)
  if (hasPhysicalKeyboard === false) {
    keypadWasShownRef.current = true
  }
  const showOnScreenKeypad = hasPhysicalKeyboard === false || keypadWasShownRef.current

  // Current part from the plan; the item on it from getCurrentProblemInfo,
  // which handles both original slots and retry epochs
  const currentPartIndex = plan.currentPartIndex
  const currentPart = plan.parts[currentPartIndex] as SessionPart | undefined
  const regularSlot: ProblemSlot | undefined = currentProblemInfo
    ? {
        slotId: currentProblemInfo.slotId,
        index: currentProblemInfo.originalSlotIndex,
        purpose: currentProblemInfo.purpose,
        problem: currentProblemInfo.problem,
        constraints: {},
      }
    : undefined
  const sessionHealth = plan.sessionHealth as SessionHealth | null

  // Redo mode: the item being redone, by its id
  const isInRedoMode = redoState?.isActive ?? false
  const redoItem = useMemo(
    () =>
      redoState?.isActive
        ? arithmeticSlotOf(plan.parts[redoState.partIndex], redoState.itemId)
        : null,
    [redoState, plan.parts]
  )
  const redoSlot = redoItem?.slot ?? null

  // Use redo slot when in redo mode, otherwise regular slot
  const currentSlot = isInRedoMode && redoSlot ? redoSlot : regularSlot
  // Whether the original redo problem was correct (for display and recording logic)
  const redoOriginalWasCorrect = redoState?.originalResult?.isCorrect ?? false

  // NOTE: Redo mode problem switching is now handled by the useInteractionPhase hook
  // via the activeProblem prop. The hook reacts to activeProblem.key changes and
  // loads the new problem automatically, eliminating synchronization bugs.

  // Retry epoch tracking
  const inRetryEpoch = currentProblemInfo?.isRetry ?? false
  const retryEpochNumber = currentProblemInfo?.epochNumber ?? 0

  // Session completion is the page's: it leaves for the summary when the
  // server's plan has ended (Phase 5b removed this screen's own check of the
  // part index running past the last part)

  // Detect retry epoch transitions and show retry transition screen
  useEffect(() => {
    const currentEpoch = retryEpochNumber
    const prevEpoch = prevEpochRef.current

    // If we just entered a new retry epoch (epoch increased from 0 to 1, or 1 to 2)
    if (currentEpoch > prevEpoch && currentEpoch > 0 && currentProblemInfo) {
      // Get the count of problems in this retry epoch (the kind's view of the part)
      const problemCount = arithmeticRetryRoundSize(plan, plan.currentPartIndex)

      if (problemCount > 0) {
        setRetryTransitionData({
          epochNumber: currentEpoch,
          problemCount,
        })
        setIsInRetryTransition(true)
      }
    }

    prevEpochRef.current = currentEpoch
  }, [retryEpochNumber, currentProblemInfo, plan])

  // Handle retry transition screen completion
  const handleRetryTransitionComplete = useCallback(() => {
    setIsInRetryTransition(false)
    setRetryTransitionData(null)
  }, [])

  // NOTE: Problem initialization is now handled by the useInteractionPhase hook
  // via the activeProblem prop. Initial load uses initialProblem for SSR hydration,
  // and subsequent changes (including redo mode and retry epochs) are detected via
  // activeProblem.key changes.

  // Auto-trigger help when an unambiguous prefix sum is detected
  // The awaitingDisambiguation phase handles the timer and auto-transitions to helpMode when it expires
  // This effect only handles the inputting phase case for unambiguous matches
  // DISABLED when abacus is docked - user controls when to submit, help triggers on submit if needed
  useEffect(() => {
    // LINEAR parts put the abacus away — never auto-trigger bead help. (The hook's
    // enterHelpMode is already a no-op for linear; this avoids the wasted work.)
    if (isLinearActive) return
    // Skip auto-help when abacus is docked - user has manual control
    if (isDockedByUser) return

    // Only handle unambiguous prefix matches in inputting phase
    // Ambiguous cases are handled by awaitingDisambiguation phase, which auto-transitions to helpMode
    if (phase.phase !== 'inputting') return

    // Skip ambiguous matches - they should go through awaitingDisambiguation flow
    if (prefixMatch.isAmbiguous) return

    // For unambiguous matches, trigger immediately
    if (matchedPrefixIndex >= 0 && matchedPrefixIndex < prefixSums.length - 1) {
      const newConfirmedCount = matchedPrefixIndex + 1
      if (newConfirmedCount < phase.attempt.problem.terms.length) {
        enterHelpMode(newConfirmedCount)
      }
    }
  }, [
    phase,
    prefixMatch,
    matchedPrefixIndex,
    prefixSums.length,
    enterHelpMode,
    isDockedByUser,
    isLinearActive,
  ])

  // Handle when student reaches target value on help abacus
  // Sequence: show target value → dismiss abacus → show value in answer boxes → fade to empty → exit
  const handleTargetReached = useCallback(() => {
    if (phase.phase !== 'helpMode' || !helpContext) return

    // Notify assistance machine that a help term was completed
    assistance.onHelpTermCompleted(helpContext.termIndex)

    // Step 1: Set the answer to the target value (shows in answer boxes behind abacus)
    setAnswer(String(helpContext.targetValue))

    // Step 2: After a brief moment, dismiss the help abacus to reveal the answer
    setTimeout(() => {
      setHelpAbacusDismissed(true)

      // Step 3: After abacus fades out (300ms), answer boxes are visible with target value
      // Wait 1 second to let user see the result
      setTimeout(() => {
        // Step 4: Start fading out the answer
        setAnswerFadingOut(true)

        // Step 5: After fade-out completes (300ms), clear and exit
        setTimeout(() => {
          clearAnswer()
          setAnswerFadingOut(false)
          exitHelpMode()
        }, 300) // Match fade-out duration
      }, 1000) // Show target value in answer boxes for 1 second
    }, 600) // Brief pause to see success state on abacus
  }, [
    phase.phase,
    helpContext,
    setAnswer,
    clearAnswer,
    exitHelpMode,
    assistance.onHelpTermCompleted,
  ])

  // Handle value change from the docked abacus
  const handleAbacusDockValueChange = useCallback(
    (newValue: number) => {
      // When the abacus shows the correct answer, set it and auto-submit will trigger
      setAnswer(String(newValue))
    },
    [setAnswer]
  )

  const resolvePracticeTransitionTarget = useCallback(
    ({
      submittedPartIndex,
      submittedSlotIndex,
      submittedEpochNumber,
      activeProblemKeyAtSubmit,
    }: {
      submittedPartIndex: number
      submittedSlotIndex: number
      submittedEpochNumber: number
      activeProblemKeyAtSubmit: string | null
    }): TransitionTarget | null => {
      // Original lane progression can be derived synchronously from part slots.
      if (submittedEpochNumber === 0) {
        const nextSlot = arithmeticSlotAt(plan.parts, submittedPartIndex, submittedSlotIndex + 1)
        if (nextSlot?.problem) {
          return {
            problem: nextSlot.problem,
            slotIndex: submittedSlotIndex + 1,
            partIndex: submittedPartIndex,
            epochNumber: 0,
          }
        }
      }

      // Retry and async mutation paths rely on the latest active problem snapshot.
      const latestActiveProblem = latestActiveProblemRef.current
      const latestCurrentProblemInfo = latestCurrentProblemInfoRef.current
      const hasAdvancedProblem =
        latestActiveProblem &&
        activeProblemKeyAtSubmit &&
        latestActiveProblem.key !== activeProblemKeyAtSubmit
      const isSamePartAsSubmitted = latestActiveProblem?.partIndex === submittedPartIndex
      const latestEpochNumber = latestCurrentProblemInfo?.epochNumber ?? submittedEpochNumber
      const isSameEpochAsSubmitted = latestEpochNumber === submittedEpochNumber

      if (hasAdvancedProblem && isSamePartAsSubmitted && isSameEpochAsSubmitted) {
        return {
          problem: latestActiveProblem.problem,
          slotIndex: latestActiveProblem.slotIndex,
          partIndex: latestActiveProblem.partIndex,
          epochNumber: latestActiveProblem.epochNumber ?? 0,
        }
      }

      return null
    },
    [plan.parts]
  )

  const enactSubmitAdvance = useCallback(
    ({ intent, transitionTarget }: SubmitAdvanceResolution) => {
      if (intent === 'slide-to-next-problem' && transitionTarget) {
        needsCenteringOffsetRef.current = true
        startTransition(
          transitionTarget.problem,
          transitionTarget.slotIndex,
          transitionTarget.partIndex,
          transitionTarget.epochNumber
        )
        return
      }
      clearToLoading()
    },
    [startTransition, clearToLoading]
  )

  const resolveSubmitAdvanceWithWait = useCallback(
    ({
      mode,
      submittedPartIndex,
      submittedSlotIndex,
      submittedEpochNumber,
      activeProblemKeyAtSubmit,
      redoReturnTarget,
    }: {
      mode: SubmitMode
      submittedPartIndex: number
      submittedSlotIndex: number
      submittedEpochNumber: number
      activeProblemKeyAtSubmit: string | null
      redoReturnTarget: TransitionTarget | null
    }): Promise<SubmitAdvanceResolution> =>
      new Promise((resolve) => {
        if (mode === 'redo') {
          const destination: SubmitAdvanceDestination = redoReturnTarget
            ? 'next-problem-same-lane'
            : 'state-handoff'
          resolve({
            destination,
            intent: getSubmitAdvanceIntent(destination),
            transitionTarget: redoReturnTarget,
          })
          return
        }

        const maxWaitMs = 500
        const pollIntervalMs = 50
        const startedAt = Date.now()

        const settle = () => {
          const transitionTarget = resolvePracticeTransitionTarget({
            submittedPartIndex,
            submittedSlotIndex,
            submittedEpochNumber,
            activeProblemKeyAtSubmit,
          })
          const destination: SubmitAdvanceDestination = transitionTarget
            ? 'next-problem-same-lane'
            : 'state-handoff'
          resolve({
            destination,
            intent: getSubmitAdvanceIntent(destination),
            transitionTarget,
          })
        }

        const tick = () => {
          const transitionTarget = resolvePracticeTransitionTarget({
            submittedPartIndex,
            submittedSlotIndex,
            submittedEpochNumber,
            activeProblemKeyAtSubmit,
          })
          if (transitionTarget) {
            resolve({
              destination: 'next-problem-same-lane',
              intent: 'slide-to-next-problem',
              transitionTarget,
            })
            return
          }

          if (Date.now() - startedAt >= maxWaitMs) {
            settle()
            return
          }

          setTimeout(tick, pollIntervalMs)
        }

        tick()
      }),
    [resolvePracticeTransitionTarget]
  )

  // Handle submit
  const handleSubmit = useCallback(async () => {
    // Allow submitting from inputting, awaitingDisambiguation, or helpMode
    if (
      phase.phase !== 'inputting' &&
      phase.phase !== 'awaitingDisambiguation' &&
      phase.phase !== 'helpMode'
    ) {
      return
    }
    if (!phase.attempt.userAnswer) return

    const attemptData = phase.attempt
    const answerNum = parseInt(attemptData.userAnswer, 10)
    if (Number.isNaN(answerNum)) return

    // When abacus is docked and not already in help mode, check if answer is a prefix sum
    // If so, trigger help mode instead of submitting (mimic auto-help behavior on submit)
    // NOTE: We use findMatchedPrefixIndex which correctly handles the case where an
    // intermediate prefix sum equals the final answer (e.g., 65-34-15+33-18=31 where
    // prefixSums = [65, 31, 16, 49, 31] - indexOf(31) would return 1, not 4)
    if (isDockedByUser && phase.phase !== 'helpMode') {
      const prefixMatch = findMatchedPrefixIndex(attemptData.userAnswer, prefixSums)
      // helpTermIndex >= 0 means this is an intermediate prefix sum, not the final answer
      if (prefixMatch.matchedIndex >= 0 && prefixMatch.helpTermIndex >= 0) {
        enterHelpMode(prefixMatch.helpTermIndex)
        return
      }
    }

    // Transition to submitting phase
    startSubmit()

    // Subtract accumulated pause time to get actual response time, then apply
    // the capture-time timing guard (#156): caps idle/backgrounded or
    // clock-anomaly deltas at this child's auto-pause threshold and flags the
    // sample (raw preserved) so #157/#158 can quarantine and review it.
    const rawResponseTimeMs = Date.now() - attemptData.startTime - attemptData.accumulatedPauseMs
    const timingGuard = applyResponseTimeGuard(
      rawResponseTimeMs,
      assistance.machineState.context.thresholds.autoPauseMs,
      'client'
    )
    const isCorrect = answerNum === attemptData.problem.answer
    // The round of the problem on screen, not the plan's (which can lag)
    const answered = answeredProblemIdentity(plan, attemptData)
    const epochNumberAtSubmit = answered.epochNumber
    const activeProblemKeyAtSubmit = activeProblem?.key ?? null
    const redoReturnTargetAtSubmit: TransitionTarget | null = currentProblemInfo
      ? {
          problem: currentProblemInfo.problem,
          slotIndex: currentProblemInfo.originalSlotIndex,
          partIndex: plan.currentPartIndex,
          epochNumber: currentProblemInfo.epochNumber,
        }
      : null
    const hasRetriesRemaining = epochNumberAtSubmit < MAX_RETRY_EPOCHS
    // Only reveal the correct answer when retries are exhausted (epoch 2 wrong).
    // Never reveal during manual redo — the kid chose to retry voluntarily and
    // shouldn't get a free look at the answer.
    setShowCorrectAnswerOnIncorrect(isCorrect || !hasRetriesRemaining)

    // Notify assistance machine of incorrect answer
    if (!isCorrect) {
      assistance.onWrongAnswer()
    }

    // Collect vision training data if answer is correct and vision is enabled
    // This runs in the background (fire-and-forget) to not block the UI
    if (isCorrect) {
      collectVisionTrainingData(attemptData.problem.answer, attemptData.slotIndex)
    }

    // Record the result
    const result: Omit<SlotResult, 'timestamp' | 'partNumber'> & {
      tryId: string
      partIndex: number
    } = {
      // The round tells the server a resubmit from the next try of the same slot
      ...answered,
      problem: attemptData.problem,
      studentAnswer: answerNum,
      // The screen's own check, for display (the markers). Never sent: the
      // try goes as record_try, and the server is the only judge
      // (practice-kinds K4, amendments A1, A15)
      isCorrect,
      ...timingGuard,
      hiddenTimeExcludedMs: attemptData.accumulatedHiddenMs || undefined,
      skillsExercised: attemptData.problem.skillsRequired,
      usedOnScreenAbacus: phase.phase === 'helpMode',
      incorrectAttempts: assistance.machineState.context.wrongAttemptCount,
      hadHelp:
        phase.phase === 'helpMode' || assistance.machineState.context.helpedTermIndices.size > 0,
    }

    const submitMode: SubmitMode = isInRedoMode && redoState ? 'redo' : 'practice'

    // Handle redo recording separately - return path is still unified through submit advance resolver.
    let redoOutcome: RedoWriteOutcome = { recorded: false }
    if (submitMode === 'redo' && redoState) {
      // Every do-over is recorded. The server stamps its round and weight; a
      // do-over of a problem already answered correctly is practice-only
      // (weight 0, no effect on mastery, the score or the dot).
      if (onRecordRedo && redoItem) {
        // The do-over names its item (Phase 5b). Use the special redo
        // mutation. It can move the session on (a redeemed retry round), so
        // the return target comes from its answer below.
        const redoPlan = await onRecordRedo(
          doOverWriteOf({
            playerId: student.id,
            planId: plan.id,
            redo: redoState,
            slotIndex: redoItem.slotIndex,
            result,
            originalWasCorrect: redoOriginalWasCorrect,
          })
        )
        redoOutcome = { recorded: true, plan: redoPlan }
      }

      // Continue into unified completion path below.
    } else {
      // Optimistic submit: for epoch 0 mid-part, advance immediately without
      // waiting for the server. The mutation queue in PracticeClient serializes
      // the actual server writes.
      const nextSlotExists = !!arithmeticSlotAt(
        plan.parts,
        attemptData.partIndex,
        attemptData.slotIndex + 1
      )?.problem
      const canAdvanceOptimistically = epochNumberAtSubmit === 0 && nextSlotExists

      const submission = { ...result, partIndex: answered.partIndex }
      if (canAdvanceOptimistically) {
        void onAnswer(submission)
      } else {
        await onAnswer(submission)
      }
    }

    // Complete submit with result
    completeSubmit(isCorrect ? 'correct' : 'incorrect')

    // Wait for feedback display then resolve-and-enact the shared advance policy.
    setTimeout(
      () => {
        void resolveSubmitAdvanceWithWait({
          mode: submitMode,
          submittedPartIndex: attemptData.partIndex,
          submittedSlotIndex: attemptData.slotIndex,
          submittedEpochNumber: epochNumberAtSubmit,
          activeProblemKeyAtSubmit,
          redoReturnTarget: chooseRedoReturnTarget(plan, redoOutcome, redoReturnTargetAtSubmit),
        }).then((resolution) => {
          enactSubmitAdvance(resolution)
          if (submitMode === 'redo') {
            onRedoComplete?.()
          }
        })
      },
      isCorrect ? 500 : 1500
    )
  }, [
    phase,
    onAnswer,
    onRecordRedo,
    student.id,
    plan.id,
    plan.currentPartIndex,
    activeProblem?.key,
    startSubmit,
    completeSubmit,
    enactSubmitAdvance,
    resolveSubmitAdvanceWithWait,
    currentProblemInfo?.epochNumber,
    isDockedByUser,
    prefixSums,
    enterHelpMode,
    collectVisionTrainingData,
    isInRedoMode,
    redoState,
    redoItem,
    redoOriginalWasCorrect,
    onRedoComplete,
    assistance.onWrongAnswer,
    assistance.machineState.context.wrongAttemptCount,
    assistance.machineState.context.helpedTermIndices,
    assistance.machineState.context.thresholds,
  ])

  // Auto-submit when correct answer is entered
  useEffect(() => {
    if (shouldAutoSubmit) {
      handleSubmit()
    }
  }, [shouldAutoSubmit, handleSubmit])

  // Debug submit: set answer then submit after React commits the state update
  const debugSubmitInFlightRef = useRef(false)
  const handleSubmitRef = useRef(handleSubmit)
  handleSubmitRef.current = handleSubmit
  const debugSubmit = useCallback(
    (value: number) => {
      if (debugSubmitInFlightRef.current) return
      debugSubmitInFlightRef.current = true
      flushSync(() => {
        setAnswer(String(value))
      })
      // Use rAF to ensure React has committed the state before calling handleSubmit
      requestAnimationFrame(() => {
        handleSubmitRef.current()
        // Reset guard after submission completes (allow next submit after delay)
        setTimeout(() => {
          debugSubmitInFlightRef.current = false
        }, 2000)
      })
    },
    [setAnswer]
  )

  // Handle keyboard input
  useEffect(() => {
    if (!hasPhysicalKeyboard || !canAcceptInput) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape or Delete/Backspace exits help mode when in help mode
      if (e.key === 'Escape') {
        e.preventDefault()
        if (showHelpOverlay) {
          exitHelpMode()
        }
        return
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        if (showHelpOverlay) {
          exitHelpMode()
        } else {
          handleBackspace()
        }
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      } else if (/^[0-9]$/.test(e.key)) {
        handleDigitWithTimerReset(e.key)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    hasPhysicalKeyboard,
    canAcceptInput,
    handleSubmit,
    handleDigitWithTimerReset,
    handleBackspace,
    showHelpOverlay,
    exitHelpMode,
  ])

  // Auto-pause is now handled by the progressive assistance state machine
  // (useProgressiveAssistance hook, TIMER_AUTO_PAUSE event)

  const handlePause = useCallback(
    (info?: PauseInfo) => {
      const newPauseInfo: PauseInfo = info ?? {
        pausedAt: new Date(),
        reason: 'manual',
      }
      setPauseInfo(newPauseInfo)
      pause()
      onPause?.(newPauseInfo)
    },
    [pause, onPause]
  )

  const handleResume = useCallback(() => {
    setPauseInfo(undefined)
    assistance.onResumed()
    resume()
    onResume?.()
  }, [resume, onResume, assistance.onResumed])

  // Handle skip (from progressive assistance) — show correct answer and advance
  const handleSkip = useCallback(async () => {
    if (!attempt) return

    // In redo mode, cancel the redo instead
    if (isInRedoMode && onCancelRedo) {
      onCancelRedo()
      return
    }

    // Record as incorrect with help. Same capture-time timing guard (#156) as
    // handleSubmit — a skip after a long idle/backgrounded stretch must not
    // store an unbounded response time.
    const rawResponseTimeMs = Date.now() - attempt.startTime - attempt.accumulatedPauseMs
    const timingGuard = applyResponseTimeGuard(
      rawResponseTimeMs,
      assistance.machineState.context.thresholds.autoPauseMs,
      'client'
    )
    const result: SlotResultSubmission & { partIndex: number; tryId: string } = {
      ...answeredProblemIdentity(plan, attempt),
      problem: attempt.problem,
      studentAnswer: attempt.problem.answer, // Record the correct answer
      // The screen's own check, for display; never sent (K4, amendment A15)
      isCorrect: false,
      // Sent as the envelope's outcome (practice-kinds §3.3)
      outcome: 'skipped' as const,
      ...timingGuard,
      hiddenTimeExcludedMs: attempt.accumulatedHiddenMs || undefined,
      skillsExercised: attempt.problem.skillsRequired,
      usedOnScreenAbacus: false,
      incorrectAttempts: assistance.machineState.context.wrongAttemptCount,
      hadHelp: true,
      helpTrigger: 'manual' as const,
    }

    // Show the correct answer briefly
    setShowCorrectAnswerOnIncorrect(true)
    setAnswer(String(attempt.problem.answer))
    startSubmit()

    // Fire-and-forget: mutation enters the queue, 1500ms feedback delay
    // + clearToLoading provides enough time for the cache to update
    void onAnswer(result)

    completeSubmit('incorrect')

    // Advance after showing the answer
    setTimeout(() => {
      clearToLoading()
    }, 1500)
  }, [
    attempt,
    isInRedoMode,
    onCancelRedo,
    onAnswer,
    currentProblemInfo,
    setAnswer,
    startSubmit,
    completeSubmit,
    clearToLoading,
    assistance.machineState.context.wrongAttemptCount,
    assistance.machineState.context.thresholds,
  ])

  // Handle help requested from progressive assistance UI
  const handleHelpFromAssistance = useCallback(() => {
    // LINEAR parts have the abacus away — no bead help to request.
    if (isLinearActive) return
    enterHelpMode(0)
  }, [enterHelpMode, isLinearActive])

  const getHealthColor = (health: SessionHealth['overall']) => {
    switch (health) {
      case 'good':
        return 'green.500'
      case 'warning':
        return 'yellow.500'
      case 'struggling':
        return 'red.500'
      default:
        return 'gray.500'
    }
  }

  const getHealthEmoji = (health: SessionHealth['overall']) => {
    switch (health) {
      case 'good':
        return '🟢'
      case 'warning':
        return '🟡'
      case 'struggling':
        return '🔴'
      default:
        return '⚪'
    }
  }

  if (!currentPart || !attempt) {
    return (
      <div
        data-component="active-session"
        data-status="loading"
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '300px',
        })}
      >
        <div
          className={css({
            fontSize: '1.25rem',
            color: isDark ? 'gray.400' : 'gray.500',
          })}
        >
          Loading next problem...
        </div>
      </div>
    )
  }

  // Browse mode - show the browse view instead of the practice view
  if (isBrowseModeProp) {
    return (
      <BrowseModeView
        plan={plan}
        browseIndex={browseIndex}
        currentPracticeIndex={currentPracticeLinearIndex}
        studentId={student.id}
        onResultEdited={onResultEdited}
      />
    )
  }

  // Check if we should show the abacus dock. The working abacus shows for abacus mode
  // AND the linear-with-abacus ramp phase — the planner sets useAbacus on ramp-linear
  // parts and clears it for mental (post-gate) linear, so keying off useAbacus covers
  // all three cases (abacus / ramp-linear = on, visualization / mental-linear = off).
  const showAbacusDock = currentPart.useAbacus && !showHelpOverlay

  return (
    <div
      data-component="active-session"
      data-status={isPaused ? 'paused' : 'active'}
      data-phase={phase.phase}
      data-part-type={currentPart.type}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: { base: '0.75rem', md: '1rem' },
        padding: { base: '0.5rem', md: '1rem' },
        // Widen container when dock is shown to accommodate side-by-side layout
        maxWidth: showAbacusDock ? '780px' : '600px',
        margin: '0 auto',
        height: '100%',
        overflow: 'hidden',
        transition: 'max-width 0.3s ease',
      })}
    >
      {/* Problem + Dock row container */}
      <div
        data-section="problem-dock-row"
        className={css({
          display: 'flex',
          flexDirection: 'row',
          gap: '1.5rem',
          flex: 1,
          minHeight: 0,
          alignItems: 'stretch',
        })}
      >
        {/* Problem display */}
        <div
          data-section="problem-area"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { base: '0.75rem', md: '1rem' },
            flex: showAbacusDock ? '1 1 60%' : '1 1 100%',
            minHeight: 0,
            minWidth: 0,
            paddingTop: { base: '1rem', md: '2rem' },
            paddingRight: { base: '1rem', md: '2rem' },
            paddingBottom: { base: '1rem', md: '1.5rem' },
            paddingLeft: { base: '1rem', md: '2rem' },
            backgroundColor: isDark ? 'gray.800' : 'white',
            borderRadius: '16px',
            boxShadow: 'md',
            overflow: 'hidden',
          })}
        >
          {/* Redo mode banner */}
          {isInRedoMode && redoState && (
            <div
              data-element="redo-mode-banner"
              className={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                padding: '0.5rem 1rem',
                backgroundColor: isDark ? 'orange.900/80' : 'orange.100',
                borderRadius: '12px',
                border: '2px solid',
                borderColor: isDark ? 'orange.600' : 'orange.400',
                marginBottom: '0.5rem',
              })}
            >
              <span className={css({ fontSize: '1.25rem' })}>🔄</span>
              <span
                className={css({
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  color: isDark ? 'orange.100' : 'orange.800',
                })}
              >
                Redoing Problem #{redoState.linearIndex + 1}
                {redoOriginalWasCorrect && (
                  <span
                    className={css({
                      marginLeft: '0.5rem',
                      fontWeight: '400',
                      fontSize: '0.75rem',
                      color: isDark ? 'orange.300' : 'orange.600',
                    })}
                  >
                    (Practice Only)
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={onCancelRedo}
                className={css({
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  color: isDark ? 'gray.300' : 'gray.600',
                  backgroundColor: isDark ? 'gray.700' : 'gray.200',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  _hover: {
                    backgroundColor: isDark ? 'gray.600' : 'gray.300',
                  },
                })}
              >
                ← Back to #{currentPracticeLinearIndex + 1}
              </button>
            </div>
          )}

          {/* Purpose badge with tooltip - shows retry indicator when in retry epoch */}
          {currentSlot && !isInRedoMode && (
            <div
              data-element="purpose-retry-container"
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              })}
            >
              {/* Retry indicator badge */}
              {inRetryEpoch && (
                <div
                  data-element="retry-indicator"
                  data-epoch={retryEpochNumber}
                  className={css({
                    padding: '0.25rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    backgroundColor: isDark ? 'red.900' : 'red.100',
                    color: isDark ? 'red.200' : 'red.700',
                    border: '1px solid',
                    borderColor: isDark ? 'red.700' : 'red.300',
                  })}
                >
                  Retry {retryEpochNumber}/2
                </div>
              )}
              <PurposeBadge purpose={currentSlot.purpose} slot={currentSlot} />
            </div>
          )}

          {/* Problem display - centered, with help panel positioned outside */}
          <div
            data-element="problem-with-help"
            className={css({
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
              // Query container for LinearProblem's fit-to-width font size (100cqw).
              containerType: 'inline-size',
            })}
          >
            {/* Animated track for problem transitions */}
            <animated.div
              data-element="problem-track"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                transform: trackSpring.x.to((x) => `translateX(${x}px)`),
              }}
            >
              {/* Outgoing problem (slides left during transition) */}
              {outgoingAttempt && (
                <animated.div
                  ref={outgoingRef}
                  data-element="outgoing-problem"
                  style={{
                    opacity: trackSpring.outgoingOpacity,
                    marginRight: '2rem',
                    position: 'relative' as const,
                  }}
                >
                  {outgoingFormat === 'linear' ? (
                    <LinearProblem
                      terms={outgoingAttempt.problem.terms}
                      userAnswer={outgoingAttempt.userAnswer}
                      isCompleted
                      correctAnswer={outgoingAttempt.problem.answer}
                      isDark={isDark}
                    />
                  ) : (
                    <VerticalProblem
                      terms={outgoingAttempt.problem.terms}
                      userAnswer={outgoingAttempt.userAnswer}
                      isCompleted={true}
                      correctAnswer={outgoingAttempt.problem.answer}
                      size="large"
                      generationTrace={outgoingAttempt.problem.generationTrace}
                    />
                  )}
                  {/* Feedback stays with outgoing problem */}
                  <PracticeFeedback
                    isCorrect={true}
                    correctAnswer={outgoingAttempt.problem.answer}
                    className={css({
                      position: 'absolute',
                      top: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      marginTop: '0.5rem',
                      whiteSpace: 'nowrap',
                    })}
                  />
                </animated.div>
              )}

              {/* Current problem */}
              <animated.div
                ref={activeRef}
                data-element="problem-container"
                style={{
                  opacity: trackSpring.activeOpacity,
                  position: 'relative' as const,
                }}
              >
                {currentPart.format === 'vertical' ? (
                  <VerticalProblem
                    terms={attempt.problem.terms}
                    userAnswer={attempt.userAnswer}
                    isFocused={inputIsFocused}
                    isCompleted={showAsCompleted}
                    correctAnswer={attempt.problem.answer}
                    showCorrectAnswerOnIncorrect={showCorrectAnswerOnIncorrect}
                    size="large"
                    currentHelpTermIndex={helpContext?.termIndex}
                    needHelpTermIndex={
                      // Only show "need help?" prompt when not already in help mode
                      !showHelpOverlay && ambiguousHelpTermIndex >= 0
                        ? ambiguousHelpTermIndex
                        : undefined
                    }
                    rejectedDigit={attempt.rejectedDigit}
                    detectedPrefixIndex={
                      // Show vision feedback for prefix sums (not final answer)
                      matchedPrefixIndex >= 0 && matchedPrefixIndex < prefixSums.length - 1
                        ? matchedPrefixIndex
                        : undefined
                    }
                    helpOverlay={
                      // Always render overlay when in help mode (for exit transition)
                      showHelpOverlay && helpContext ? (
                        <PracticeHelpOverlay
                          currentValue={helpContext.currentValue}
                          targetValue={helpContext.targetValue}
                          columns={Math.max(
                            1,
                            Math.max(helpContext.currentValue, helpContext.targetValue).toString()
                              .length
                          )}
                          onTargetReached={handleTargetReached}
                          onDismiss={() => {
                            setHelpAbacusDismissed(true)
                            clearAnswer()
                          }}
                          visible={!helpAbacusDismissed}
                        />
                      ) : undefined
                    }
                    helpOverlayVisible={showHelpOverlay && !helpAbacusDismissed}
                    helpOverlayTransitionMs={helpAbacusDismissed ? 300 : 1000}
                    onHelpOverlayTransitionEnd={clearAnswer}
                    answerFadingOut={answerFadingOut}
                    generationTrace={attempt.problem.generationTrace}
                    complexityBudget={currentSlot?.constraints?.maxComplexityBudgetPerTerm}
                  />
                ) : (
                  <LinearProblem
                    terms={attempt.problem.terms}
                    userAnswer={attempt.userAnswer}
                    isFocused={inputIsFocused}
                    isCompleted={showAsCompleted}
                    correctAnswer={attempt.problem.answer}
                    isDark={isDark}
                    // Preserve the live player's current behavior: no correct-answer
                    // reveal on an incorrect submit (read-only surfaces opt in via default).
                    showCorrectAnswerOnIncorrect={false}
                    detectedPrefixIndex={
                      SHOW_LINEAR_PREFIX_HINT &&
                      matchedPrefixIndex >= 0 &&
                      matchedPrefixIndex < prefixSums.length - 1
                        ? matchedPrefixIndex
                        : undefined
                    }
                  />
                )}

                {/* Help panel - absolutely positioned to the right of the problem.
                    Never render the bead-decomposition coach panel next to a LINEAR
                    problem (help mode can't be entered for linear, so showHelpOverlay
                    is already false — this hard-guarantees it). */}
                {!isLinearActive && showHelpOverlay && helpContext && !helpPanelDismissed && (
                  <div
                    data-element="help-panel"
                    className={css({
                      position: 'absolute',
                      left: '100%',
                      top: 0,
                      marginLeft: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      padding: '1rem',
                      backgroundColor: isDark ? 'blue.900' : 'blue.50',
                      borderRadius: '12px',
                      border: '2px solid',
                      borderColor: isDark ? 'blue.700' : 'blue.200',
                      minWidth: '200px',
                      maxWidth: '280px',
                    })}
                  >
                    {/* Close button for help panel */}
                    <button
                      type="button"
                      data-action="close-help-panel"
                      onClick={() => setHelpPanelDismissed(true)}
                      className={css({
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.875rem',
                        fontWeight: 'bold',
                        color: isDark ? 'gray.400' : 'gray.500',
                        backgroundColor: isDark ? 'gray.700' : 'gray.200',
                        border: '2px solid',
                        borderColor: isDark ? 'gray.600' : 'gray.300',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        zIndex: 10,
                        _hover: {
                          backgroundColor: isDark ? 'gray.600' : 'gray.300',
                          color: isDark ? 'gray.200' : 'gray.700',
                        },
                      })}
                      aria-label="Close help panel"
                    >
                      ×
                    </button>

                    {/* Coach hint */}
                    {(() => {
                      const hint = generateCoachHint(
                        helpContext.currentValue,
                        helpContext.targetValue
                      )
                      if (!hint) return null
                      return (
                        <div
                          data-element="coach-hint"
                          className={css({
                            padding: '0.5rem 0.75rem',
                            backgroundColor: isDark ? 'gray.800' : 'white',
                            borderRadius: '8px',
                            border: '1px solid',
                            borderColor: isDark ? 'blue.800' : 'blue.100',
                          })}
                        >
                          <p
                            className={css({
                              fontSize: '0.875rem',
                              color: isDark ? 'gray.300' : 'gray.700',
                              lineHeight: '1.4',
                              margin: 0,
                            })}
                          >
                            {hint}
                          </p>
                        </div>
                      )
                    })()}

                    {/* Decomposition display */}
                    <DecompositionProvider
                      startValue={helpContext.currentValue}
                      targetValue={helpContext.targetValue}
                      currentStepIndex={0}
                      abacusColumns={Math.max(
                        1,
                        Math.max(helpContext.currentValue, helpContext.targetValue).toString()
                          .length
                      )}
                    >
                      <DecompositionSection
                        className={css({
                          padding: '0.5rem 0.75rem',
                          backgroundColor: isDark ? 'gray.800' : 'white',
                          borderRadius: '8px',
                          border: '1px solid',
                          borderColor: isDark ? 'blue.800' : 'blue.100',
                          whiteSpace: 'nowrap',
                        })}
                        labelClassName={css({
                          fontSize: '0.625rem',
                          fontWeight: 'bold',
                          color: isDark ? 'blue.300' : 'blue.600',
                          marginBottom: '0.25rem',
                          textTransform: 'uppercase',
                        })}
                        contentClassName={css({
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          color: isDark ? 'gray.100' : 'gray.800',
                        })}
                      />
                    </DecompositionProvider>
                  </div>
                )}
              </animated.div>
            </animated.div>
          </div>

          {/* Feedback message - only show for incorrect */}
          {showFeedback && (
            <PracticeFeedback
              isCorrect={false}
              correctAnswer={attempt.problem.answer}
              showCorrectAnswer={showCorrectAnswerOnIncorrect}
            />
          )}
        </div>

        {/* Abacus dock - flex sibling of problem-area for proper layout */}
        {showAbacusDock && (
          <AbacusDock
            id="practice-abacus"
            columns={calculateAbacusColumns(attempt.problem.terms)}
            interactive={true}
            showNumbers={false}
            animated={true}
            onValueChange={handleAbacusDockValueChange}
            className={css({
              flex: '0 0 auto',
              // Responsive sizing - constrain both width and height
              // Mobile: smaller (140px-180px), Desktop: larger (up to 240px)
              width: {
                base: 'clamp(140px, 20vw, 180px)',
                md: 'clamp(180px, 18vw, 240px)',
              },
              // Mobile: shorter, Desktop: taller
              height: {
                base: 'clamp(180px, 28vh, 240px)',
                md: 'clamp(220px, 26vh, 300px)',
              },
              alignSelf: 'center',
              // Remove background/shadow - the docked content has its own styling
            })}
          />
        )}
      </div>

      {/* Progressive assistance UI (encouragement, help button, skip) */}
      {showInputArea && !isPaused && (
        <ProgressiveAssistanceUI
          machineState={assistance.machineState}
          showWrongAnswerSuggestion={assistance.showWrongAnswerSuggestion}
          isDark={isDark}
          onHelpRequested={handleHelpFromAssistance}
          onSkip={handleSkip}
          onDismissWrongAnswerSuggestion={assistance.dismissWrongAnswerSuggestion}
          showHelpAffordance={!isLinearActive}
        />
      )}

      {/* Input area */}
      {showInputArea && !isPaused && (
        <div
          data-section="input-area"
          className={css({
            flexShrink: 0, // Don't shrink the input area
          })}
        >
          {/* Submit button - hidden on small screens when keypad is shown (integrated into keypad instead) */}
          {!showOnScreenKeypad && (
            <div
              className={css({
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '0.75rem',
                minHeight: '48px',
                overflow: 'hidden',
              })}
            >
              <animated.button
                type="button"
                data-action="submit"
                data-visible={showSubmitButton}
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting || !showSubmitButton}
                style={submitButtonSpring}
                className={css({
                  padding: '0.75rem 2rem',
                  fontSize: '1.125rem',
                  fontWeight: 'bold',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: !canSubmit || !showSubmitButton ? 'not-allowed' : 'pointer',
                  backgroundColor: canSubmit ? 'blue.500' : isDark ? 'gray.700' : 'gray.300',
                  color: !canSubmit ? (isDark ? 'gray.400' : 'gray.500') : 'white',
                  _hover: {
                    backgroundColor:
                      canSubmit && showSubmitButton ? 'blue.600' : isDark ? 'gray.600' : 'gray.300',
                  },
                })}
              >
                Submit
              </animated.button>
            </div>
          )}

          {/* On-screen keypad for mobile - includes submit button */}
          {showOnScreenKeypad && (
            <NumericKeypad
              onDigit={handleDigitWithTimerReset}
              onBackspace={handleBackspace}
              onSubmit={handleSubmit}
              disabled={isSubmitting}
              currentValue={attempt.userAnswer}
              showSubmitButton={showSubmitButton}
            />
          )}
        </div>
      )}

      {/* Debug overlay - submit buttons for automated testing */}
      {debug && attempt?.problem && (
        <DebugOverlay
          correctAnswer={attempt.problem.answer}
          partIndex={attempt.partIndex}
          slotIndex={attempt.slotIndex}
          partType={currentPart?.type ?? 'abacus'}
          purpose={currentSlot?.purpose ?? 'focus'}
          onSubmitCorrect={() => debugSubmit(attempt.problem.answer)}
          onSubmitWrong={() => debugSubmit(attempt.problem.answer + 1)}
        />
      )}

      {/* Debug panel - shows current problem details when visual debug mode is on */}
      {currentSlot?.problem && (
        <ProblemDebugPanel
          problem={currentSlot.problem}
          slot={currentSlot}
          part={currentPart}
          partIndex={attempt.partIndex}
          slotIndex={attempt.slotIndex}
          userInput={attempt.userAnswer}
          phaseName={phase.phase}
        />
      )}

      {/* Assistance debug panel - shows state machine state when visual debug mode is on */}
      <AssistanceDebugPanel machineState={assistance.machineState} />

      {/* Warning when complexity cost data is missing — visible in dev, console.warn in prod */}
      {assistance.complexityCostMissing &&
        (process.env.NODE_ENV === 'production' ? (
          (() => {
            console.warn(
              '[autopause] complexityCostMissing: current problem has no generationTrace.totalComplexityCost — using flat 5-min timeout'
            )
            return null
          })()
        ) : (
          <div
            data-element="complexity-cost-warning"
            className={css({
              position: 'fixed',
              bottom: '4px',
              left: '4px',
              padding: '4px 8px',
              backgroundColor: 'rgba(255, 165, 0, 0.9)',
              color: 'black',
              fontSize: '11px',
              borderRadius: '4px',
              zIndex: 9999,
              pointerEvents: 'none',
            })}
          >
            Missing complexityCost — flat 5min timeout
          </div>
        ))}

      {/* Session Paused Modal - rendered here as single source of truth */}
      <SessionPausedModal
        isOpen={isPaused}
        student={student}
        session={plan}
        pauseInfo={pauseInfo}
        onResume={handleResume}
        onEndSession={() => onEndEarly('Session ended by user')}
      />

      {/* Retry Transition Screen - shown when entering a retry epoch */}
      {retryTransitionData && (
        <RetryTransitionScreen
          isVisible={isInRetryTransition}
          epochNumber={retryTransitionData.epochNumber}
          problemCount={retryTransitionData.problemCount}
          student={{ name: student.name, emoji: student.emoji }}
          onComplete={handleRetryTransitionComplete}
        />
      )}
    </div>
  )
}
export default ActiveSession
