'use client'

import { animated, useSpring } from '@react-spring/web'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useMyAbacus } from '@/contexts/MyAbacusContext'
import { useTheme } from '@/contexts/ThemeContext'
import { getCurrentProblemInfo, MAX_RETRY_EPOCHS } from '@/db/schema/session-plan-helpers'
import type {
  ProblemSlot,
  SessionHealth,
  SessionPart,
  SessionPartType,
  SessionPlan,
  SlotResult,
} from '@/db/schema/session-plans'

import { css } from '../../../styled-system/css'
import type { AutoPauseStats, PauseInfo } from './autoPauseCalculator'
import { BrowseModeView, getLinearIndex } from './BrowseModeView'
import { PartTransitionScreen, TRANSITION_COUNTDOWN_MS } from './PartTransitionScreen'
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
import { AbacusDock } from '../AbacusDock'
import { DecompositionProvider, DecompositionSection } from '../decomposition'
import { generateCoachHint } from './coachHintGenerator'
import { useHasPhysicalKeyboard } from './hooks/useDeviceDetection'
import { findMatchedPrefixIndex, useInteractionPhase } from './hooks/useInteractionPhase'
// Audio disabled for practice sessions (use abacus / visualize)
import { NumericKeypad } from './NumericKeypad'
import { PracticeFeedback } from './PracticeFeedback'
import { PracticeHelpOverlay } from './PracticeHelpOverlay'
import { DebugOverlay } from './DebugOverlay'
import { ProblemDebugPanel } from './ProblemDebugPanel'
import { AssistanceDebugPanel } from './AssistanceDebugPanel'
import { ProgressiveAssistanceUI } from './ProgressiveAssistanceUI'
import { useProgressiveAssistance } from './hooks/useProgressiveAssistance'
import { VerticalProblem } from './VerticalProblem'
import type { ReceivedAbacusControl } from '@/hooks/useSessionBroadcast'
import { useSetRemoteCameraSession } from '@/hooks/useSessionPlan'

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
  /** Current problem number (1-indexed for display) */
  currentProblemNumber: number
  /** Total problems in the session */
  totalProblems: number
  /** Session structure for progress indicator */
  sessionParts?: SessionPart[]
  /** Current part index for progress indicator */
  currentPartIndex?: number
  /** Current slot index within the part */
  currentSlotIndex?: number
  /** Accumulated results for progress indicator */
  slotResults?: SlotResult[]
}

type SubmitAdvanceDestination = 'next-problem-same-lane' | 'state-handoff'
type SubmitAdvanceIntent = 'slide-to-next-problem' | 'clear-to-loading'
type SubmitMode = 'practice' | 'redo'
type TransitionTarget = {
  problem: SlotResult['problem']
  slotIndex: number
  partIndex: number
}

type SubmitAdvanceResolution = {
  destination: SubmitAdvanceDestination
  intent: SubmitAdvanceIntent
  transitionTarget: TransitionTarget | null
}

function getSubmitAdvanceIntent(destination: SubmitAdvanceDestination): SubmitAdvanceIntent {
  return destination === 'next-problem-same-lane' ? 'slide-to-next-problem' : 'clear-to-loading'
}

interface ActiveSessionProps {
  plan: SessionPlan
  /** Student info for display in pause modal */
  student: StudentInfo
  /** Called when a problem is answered */
  onAnswer: (result: Omit<SlotResult, 'timestamp' | 'partNumber'>) => Promise<void>
  /** Called when session is ended early */
  onEndEarly: (reason?: string) => void
  /** Called when session is paused (with info about why) - for external HUD updates */
  onPause?: (pauseInfo: PauseInfo) => void
  /** Called when session is resumed - for external HUD updates */
  onResume?: () => void
  /** Called when session completes */
  onComplete: () => void
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
  /** Called when a part transition starts (for broadcasting to observers) */
  onPartTransition?: (
    previousPartType: SessionPartType | null,
    nextPartType: SessionPartType,
    countdownStartTime: number,
    countdownDurationMs: number
  ) => void
  /** Called when a part transition completes (for broadcasting to observers) */
  onPartTransitionComplete?: () => void
  /** Redo state - when set, show a redo problem instead of current session problem */
  redoState?: {
    isActive: boolean
    linearIndex: number
    originalPartIndex: number
    originalSlotIndex: number
    originalResult: SlotResult
  } | null
  /** Called to record a redo result (separate from onAnswer since it doesn't advance position) */
  onRecordRedo?: (params: {
    playerId: string
    planId: string
    result: Omit<SlotResult, 'timestamp' | 'partNumber'>
    redoContext: {
      originalPartIndex: number
      originalSlotIndex: number
      originalWasCorrect: boolean
    }
  }) => Promise<SessionPlan>
  /** Called when the redo is complete or cancelled */
  onRedoComplete?: () => void
  /** Called to cancel the redo without recording */
  onCancelRedo?: () => void
  /** Called when a result is edited in browse mode (to trigger refetch) */
  onResultEdited?: () => void
  /** When true, show the debug overlay with submit buttons */
  debug?: boolean
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
 * Linear problem display component for Part 3
 */
function LinearProblem({
  terms,
  userAnswer,
  isFocused,
  isCompleted,
  correctAnswer,
  isDark,
  detectedPrefixIndex,
}: {
  terms: number[]
  userAnswer: string
  isFocused: boolean
  isCompleted: boolean
  correctAnswer: number
  isDark: boolean
  /** Detected prefix index - shows "..." instead of "=" for partial sums */
  detectedPrefixIndex?: number
}) {
  // Build the equation string
  const equation = terms
    .map((term, i) => {
      if (i === 0) return String(term)
      return term < 0 ? ` - ${Math.abs(term)}` : ` + ${term}`
    })
    .join('')

  // Use "..." for prefix sums (mathematically incomplete), "=" for final answer
  const isPrefixSum = detectedPrefixIndex !== undefined
  const operator = isPrefixSum ? '…' : '='

  // Use numeric comparison so "09" equals 9
  const numericUserAnswer = parseInt(userAnswer, 10)
  const answeredCorrectly = isCompleted && numericUserAnswer === correctAnswer

  return (
    <div
      data-component="linear-problem"
      data-prefix-mode={isPrefixSum ? 'true' : undefined}
      className={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        fontFamily: 'monospace',
        fontSize: '2rem',
        fontWeight: 'bold',
      })}
    >
      <span className={css({ color: isDark ? 'gray.200' : 'gray.800' })}>
        {equation}{' '}
        <span
          className={css({
            color: isPrefixSum
              ? isDark
                ? 'yellow.400'
                : 'yellow.600'
              : isDark
                ? 'gray.200'
                : 'gray.800',
          })}
        >
          {operator}
        </span>
      </span>
      <span
        className={css({
          minWidth: '80px',
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          textAlign: 'center',
          backgroundColor: isCompleted
            ? answeredCorrectly
              ? isDark
                ? 'green.900'
                : 'green.100'
              : isDark
                ? 'red.900'
                : 'red.100'
            : isDark
              ? 'gray.800'
              : 'gray.100',
          color: isCompleted
            ? answeredCorrectly
              ? isDark
                ? 'green.200'
                : 'green.700'
              : isDark
                ? 'red.200'
                : 'red.700'
            : isDark
              ? 'gray.200'
              : 'gray.800',
          border: '2px solid',
          borderColor: isFocused ? 'blue.400' : isDark ? 'gray.600' : 'gray.300',
        })}
      >
        {userAnswer || (isFocused ? '?' : '')}
      </span>
    </div>
  )
}

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
  student,
  onAnswer,
  onEndEarly,
  onPause,
  onResume,
  onComplete,
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
  onPartTransition,
  onPartTransitionComplete,
  redoState,
  onRecordRedo,
  onRedoComplete,
  onCancelRedo,
  onResultEdited,
  debug = false,
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
      const redoPart = plan.parts[redoState.originalPartIndex]
      const redoProblem = (redoPart?.slots[redoState.originalSlotIndex] as ProblemSlot)?.problem
      if (redoProblem) {
        return {
          problem: redoProblem,
          slotIndex: redoState.originalSlotIndex,
          partIndex: redoState.originalPartIndex,
          key: `redo-${redoState.linearIndex}`,
        }
      }
    }

    // Normal mode: use currentProblemInfo (handles epochs/retries correctly)
    if (currentProblemInfo?.problem) {
      return {
        problem: currentProblemInfo.problem,
        slotIndex: currentProblemInfo.originalSlotIndex,
        partIndex: plan.currentPartIndex,
        key: `normal-${plan.currentPartIndex}-${currentProblemInfo.originalSlotIndex}-${currentProblemInfo.epochNumber ?? 0}`,
      }
    }

    return null
  }, [redoState, plan.parts, plan.currentPartIndex, currentProblemInfo])
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
  })

  // Progressive assistance state machine — subsumes auto-pause timer
  const handleAutoPause = useCallback(
    (info: PauseInfo) => {
      setPauseInfo(info)
      pause()
      onPause?.(info)
    },
    [pause, onPause]
  )

  const assistance = useProgressiveAssistance({
    attempt: attempt
      ? {
          startTime: attempt.startTime,
          accumulatedPauseMs: attempt.accumulatedPauseMs,
          problem: { terms: attempt.problem.terms },
        }
      : null,
    results: plan.results,
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

  // Calculate total progress across all parts (needed for broadcast state)
  const totalProblems = useMemo(() => {
    return plan.parts.reduce((sum, part) => sum + part.slots.length, 0)
  }, [plan.parts])

  const completedProblems = useMemo(() => {
    let count = 0
    for (let i = 0; i < plan.currentPartIndex; i++) {
      count += plan.parts[i].slots.length
    }
    count += plan.currentSlotIndex
    return count
  }, [plan.parts, plan.currentPartIndex, plan.currentSlotIndex])

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

    // Get current slot's purpose from plan
    const currentPart = plan.parts[plan.currentPartIndex]
    const slot = currentPart?.slots[plan.currentSlotIndex]
    const purpose = slot?.purpose ?? 'focus'

    // During transitioning, we show the outgoing (completed) problem, not the incoming one
    // But we use the PREVIOUS slot's purpose since we're still showing feedback for it
    if (phase.phase === 'transitioning' && outgoingAttempt) {
      // During transition, use the previous slot's purpose and complexity
      const prevSlotIndex = plan.currentSlotIndex > 0 ? plan.currentSlotIndex - 1 : 0
      const prevSlot = currentPart?.slots[prevSlotIndex]
      const prevPurpose = prevSlot?.purpose ?? purpose

      onBroadcastStateChange({
        currentProblem: {
          terms: outgoingAttempt.problem.terms,
          answer: outgoingAttempt.problem.answer,
        },
        phase: 'feedback',
        studentAnswer: outgoingAttempt.userAnswer,
        isCorrect: outgoingAttempt.result === 'correct',
        startedAt: attempt?.startTime ?? Date.now(),
        purpose: prevPurpose,
        complexity: extractComplexity(prevSlot),
        currentProblemNumber: completedProblems + 1,
        totalProblems,
        // Session structure for progress indicator
        sessionParts: plan.parts,
        // Use redo indices when in redo mode so observer sees correct active problem
        currentPartIndex: redoState?.isActive ? redoState.originalPartIndex : plan.currentPartIndex,
        currentSlotIndex: redoState?.isActive ? redoState.originalSlotIndex : plan.currentSlotIndex,
        slotResults: plan.results,
      })
      return
    }

    if (!attempt) {
      onBroadcastStateChange(null)
      return
    }

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

    onBroadcastStateChange({
      currentProblem: {
        terms: attempt.problem.terms,
        answer: attempt.problem.answer,
      },
      phase: broadcastPhase,
      studentAnswer: attempt.userAnswer,
      isCorrect,
      startedAt: attempt.startTime,
      purpose,
      complexity: extractComplexity(slot),
      currentProblemNumber: completedProblems + 1,
      totalProblems,
      // Session structure for progress indicator
      sessionParts: plan.parts,
      // Use redo indices when in redo mode so observer sees correct active problem
      currentPartIndex: redoState?.isActive ? redoState.originalPartIndex : plan.currentPartIndex,
      currentSlotIndex: redoState?.isActive ? redoState.originalSlotIndex : plan.currentSlotIndex,
      slotResults: plan.results,
    })
  }, [
    onBroadcastStateChange,
    attempt?.problem?.terms,
    attempt?.problem?.answer,
    attempt?.userAnswer,
    attempt?.startTime,
    phase,
    outgoingAttempt,
    plan.parts,
    plan.currentPartIndex,
    plan.currentSlotIndex,
    plan.results,
    completedProblems,
    totalProblems,
    redoState?.isActive,
    redoState?.originalPartIndex,
    redoState?.originalSlotIndex,
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

  // Part transition state - for showing transition screen between parts
  const [isInPartTransition, setIsInPartTransition] = useState(false)
  const [transitionData, setTransitionData] = useState<{
    previousPartType: SessionPartType | null
    nextPartType: SessionPartType
    countdownStartTime: number
  } | null>(null)
  // Track the previous part index to detect part changes
  const prevPartIndexRef = useRef<number>(plan.currentPartIndex)

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
  const currentPracticeLinearIndex = useMemo(() => {
    return getLinearIndex(plan.parts, plan.currentPartIndex, plan.currentSlotIndex)
  }, [plan.parts, plan.currentPartIndex, plan.currentSlotIndex])

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
  const showSubmitButton = attempt?.manualSubmitRequired || isDockedByUser
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

  // Get current part and slot from plan (accounting for retry epochs)
  const parts = plan.parts
  const currentPartIndex = plan.currentPartIndex
  const currentSlotIndex = plan.currentSlotIndex
  const gameBreakTraceEnabled =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debugGameBreakTrace') === '1'
  const logGameBreakTrace = useCallback(
    (event: string, details: Record<string, unknown> = {}) => {
      if (!gameBreakTraceEnabled) return
      console.log('[GBTRACE][client]', event, {
        ts: new Date().toISOString(),
        planId: plan.id,
        currentPartIndex,
        currentSlotIndex,
        ...details,
      })
    },
    [gameBreakTraceEnabled, plan.id, currentPartIndex, currentSlotIndex]
  )
  const currentPart = parts[currentPartIndex] as SessionPart | undefined
  // Use getCurrentProblemInfo which handles both original slots and retry epochs
  const regularSlot = currentProblemInfo
    ? {
        slotId: currentProblemInfo.slotId ?? '',
        index: currentProblemInfo.originalSlotIndex,
        purpose: currentProblemInfo.purpose,
        problem: currentProblemInfo.problem,
        constraints: {},
      }
    : (currentPart?.slots[currentSlotIndex] as ProblemSlot | undefined)
  const sessionHealth = plan.sessionHealth as SessionHealth | null

  // Redo mode: get the redo problem slot if in redo mode
  const isInRedoMode = redoState?.isActive ?? false
  const redoSlot = useMemo(() => {
    if (!redoState?.isActive) return null
    const redoPart = parts[redoState.originalPartIndex]
    if (!redoPart) return null
    return redoPart.slots[redoState.originalSlotIndex] as ProblemSlot | undefined
  }, [redoState, parts])

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

  // Check for session completion
  useEffect(() => {
    if (currentPartIndex >= parts.length) {
      onComplete()
    }
  }, [currentPartIndex, parts.length, onComplete])

  // Detect part index changes and trigger transition screen
  useEffect(() => {
    const prevIndex = prevPartIndexRef.current

    logGameBreakTrace('active-session-part-transition-effect', {
      prevIndex,
      currentPartIndex,
      partsLength: parts.length,
      willTriggerTransition: currentPartIndex !== prevIndex && currentPartIndex < parts.length,
    })

    // If part index changed and we have a valid next part
    if (currentPartIndex !== prevIndex && currentPartIndex < parts.length) {
      const prevPart = prevIndex < parts.length ? parts[prevIndex] : null
      const nextPart = parts[currentPartIndex]

      logGameBreakTrace('active-session-trigger-transition-screen', {
        previousPartType: prevPart?.type ?? null,
        nextPartType: nextPart.type,
      })

      // Trigger transition screen
      const startTime = Date.now()
      setTransitionData({
        previousPartType: prevPart?.type ?? null,
        nextPartType: nextPart.type,
        countdownStartTime: startTime,
      })
      setIsInPartTransition(true)

      // Broadcast transition to observers
      onPartTransition?.(prevPart?.type ?? null, nextPart.type, startTime, TRANSITION_COUNTDOWN_MS)
    }

    // Update ref for next comparison
    prevPartIndexRef.current = currentPartIndex
  }, [currentPartIndex, parts, onPartTransition, logGameBreakTrace])

  // Handle transition screen completion (countdown finished or user skipped)
  const handleTransitionComplete = useCallback(() => {
    logGameBreakTrace('active-session-transition-complete-callback')
    setIsInPartTransition(false)
    setTransitionData(null)
    // Broadcast transition complete to observers
    onPartTransitionComplete?.()
  }, [onPartTransitionComplete, logGameBreakTrace])

  // Detect retry epoch transitions and show retry transition screen
  useEffect(() => {
    const currentEpoch = retryEpochNumber
    const prevEpoch = prevEpochRef.current

    // If we just entered a new retry epoch (epoch increased from 0 to 1, or 1 to 2)
    if (currentEpoch > prevEpoch && currentEpoch > 0 && currentProblemInfo) {
      // Get the count of problems in this retry epoch
      const retryState = plan.retryState?.[plan.currentPartIndex]
      const problemCount = retryState?.currentEpochItems?.length ?? 0

      if (problemCount > 0) {
        setRetryTransitionData({
          epochNumber: currentEpoch,
          problemCount,
        })
        setIsInRetryTransition(true)
      }
    }

    prevEpochRef.current = currentEpoch
  }, [retryEpochNumber, currentProblemInfo, plan.retryState, plan.currentPartIndex])

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
  }, [phase, prefixMatch, matchedPrefixIndex, prefixSums.length, enterHelpMode, isDockedByUser])

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
        const submittedPart = plan.parts[submittedPartIndex]
        const nextSlot = submittedPart?.slots[submittedSlotIndex + 1]
        if (submittedPart && nextSlot?.problem) {
          return {
            problem: nextSlot.problem,
            slotIndex: submittedSlotIndex + 1,
            partIndex: submittedPartIndex,
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
          transitionTarget.partIndex
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

    // Subtract accumulated pause time to get actual response time
    const responseTimeMs = Date.now() - attemptData.startTime - attemptData.accumulatedPauseMs
    const isCorrect = answerNum === attemptData.problem.answer
    const epochNumberAtSubmit = currentProblemInfo?.epochNumber ?? 0
    const activeProblemKeyAtSubmit = activeProblem?.key ?? null
    const redoReturnTarget = currentProblemInfo
      ? {
          problem: currentProblemInfo.problem,
          slotIndex: currentProblemInfo.originalSlotIndex,
          partIndex: plan.currentPartIndex,
        }
      : null
    const hasRetriesRemaining = epochNumberAtSubmit < MAX_RETRY_EPOCHS
    setShowCorrectAnswerOnIncorrect(isCorrect || isInRedoMode || !hasRetriesRemaining)

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
    const result: Omit<SlotResult, 'timestamp' | 'partNumber'> = {
      slotId: currentProblemInfo?.slotId,
      slotIndex: attemptData.slotIndex,
      problem: attemptData.problem,
      studentAnswer: answerNum,
      isCorrect,
      responseTimeMs,
      skillsExercised: attemptData.problem.skillsRequired,
      usedOnScreenAbacus: phase.phase === 'helpMode',
      incorrectAttempts: assistance.machineState.context.wrongAttemptCount,
      hadHelp:
        phase.phase === 'helpMode' || assistance.machineState.context.helpedTermIndices.size > 0,
    }

    const submitMode: SubmitMode = isInRedoMode && redoState ? 'redo' : 'practice'

    // Handle redo recording separately - return path is still unified through submit advance resolver.
    if (submitMode === 'redo' && redoState) {
      // Only record if the original problem was incorrect
      // (Original correct = pure practice, no recording to avoid unintentional penalty)
      if (!redoOriginalWasCorrect && onRecordRedo) {
        // Add retry tracking fields
        const redoSlotId =
          plan.parts[redoState.originalPartIndex]?.slots[redoState.originalSlotIndex]?.slotId
        const redoResult: Omit<SlotResult, 'timestamp' | 'partNumber'> = {
          ...result,
          // Override slotId + slotIndex with the original slot from the redo
          slotId: redoSlotId,
          slotIndex: redoState.originalSlotIndex,
          isRetry: true,
          epochNumber: (redoState.originalResult.epochNumber ?? 0) + 1,
          originalSlotIndex: redoState.originalSlotIndex,
        }
        // Use the special redo mutation that doesn't advance session position
        await onRecordRedo({
          playerId: student.id,
          planId: plan.id,
          result: redoResult,
          redoContext: {
            originalPartIndex: redoState.originalPartIndex,
            originalSlotIndex: redoState.originalSlotIndex,
            originalWasCorrect: redoOriginalWasCorrect,
          },
        })
      }

      // Continue into unified completion path below.
    } else {
      // Optimistic submit: for epoch 0 mid-part, advance immediately without
      // waiting for the server. The mutation queue in PracticeClient serializes
      // the actual server writes.
      const nextSlotExists =
        !!plan.parts[attemptData.partIndex]?.slots[attemptData.slotIndex + 1]?.problem
      const canAdvanceOptimistically = epochNumberAtSubmit === 0 && nextSlotExists

      if (canAdvanceOptimistically) {
        void onAnswer(result)
      } else {
        await onAnswer(result)
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
          redoReturnTarget,
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
    redoOriginalWasCorrect,
    onRedoComplete,
    assistance.onWrongAnswer,
    assistance.machineState.context.wrongAttemptCount,
    assistance.machineState.context.helpedTermIndices,
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

    // Record as incorrect with help
    const responseTimeMs = Date.now() - attempt.startTime - attempt.accumulatedPauseMs
    const result: Omit<SlotResult, 'timestamp' | 'partNumber'> = {
      slotId: currentProblemInfo?.slotId,
      slotIndex: attempt.slotIndex,
      problem: attempt.problem,
      studentAnswer: attempt.problem.answer, // Record the correct answer
      isCorrect: false, // Marked incorrect because student didn't solve it
      responseTimeMs,
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
  ])

  // Handle help requested from progressive assistance UI
  const handleHelpFromAssistance = useCallback(() => {
    enterHelpMode(0)
  }, [enterHelpMode])

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

  // Check if we should show the abacus dock
  const showAbacusDock = currentPart.type === 'abacus' && !showHelpOverlay

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
                ← Back to #{completedProblems + 1}
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
                  <VerticalProblem
                    terms={outgoingAttempt.problem.terms}
                    userAnswer={outgoingAttempt.userAnswer}
                    isCompleted={true}
                    correctAnswer={outgoingAttempt.problem.answer}
                    size="large"
                    generationTrace={outgoingAttempt.problem.generationTrace}
                  />
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
                    detectedPrefixIndex={
                      matchedPrefixIndex >= 0 && matchedPrefixIndex < prefixSums.length - 1
                        ? matchedPrefixIndex
                        : undefined
                    }
                  />
                )}

                {/* Help panel - absolutely positioned to the right of the problem */}
                {showHelpOverlay && helpContext && !helpPanelDismissed && (
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
          partIndex={currentPartIndex}
          slotIndex={currentSlotIndex}
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
          partIndex={currentPartIndex}
          slotIndex={currentSlotIndex}
          userInput={attempt.userAnswer}
          phaseName={phase.phase}
        />
      )}

      {/* Assistance debug panel - shows state machine state when visual debug mode is on */}
      <AssistanceDebugPanel machineState={assistance.machineState} />

      {/* Session Paused Modal - rendered here as single source of truth */}
      <SessionPausedModal
        isOpen={isPaused}
        student={student}
        session={plan}
        pauseInfo={pauseInfo}
        onResume={handleResume}
        onEndSession={() => onEndEarly('Session ended by user')}
      />

      {/* Part Transition Screen - full screen overlay between parts */}
      {transitionData && (
        <PartTransitionScreen
          isVisible={isInPartTransition}
          previousPartType={transitionData.previousPartType}
          nextPartType={transitionData.nextPartType}
          countdownStartTime={transitionData.countdownStartTime}
          student={student}
          onComplete={handleTransitionComplete}
        />
      )}

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
