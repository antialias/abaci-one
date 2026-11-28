'use client'

/**
 * Arithmetic's item view (practice-kinds plan §1.3, §4 K5a-3b): a problem on
 * screen and everything a kid does with it, inside the session shell. Moved
 * from `ActiveSession.tsx` with its markup, timings and data attributes
 * unchanged; the shell kept the kind-blind half (the try lifecycle, the
 * submit path and its feedback timing, the do-over, browse, the broadcast,
 * resync, the pause modal and the round interlude).
 *
 * Arithmetic's here: digit entry and help (`useDigitEntry`, called as the
 * shell's child so its effects run before the lifecycle's, A18(2)), the
 * progressive assistance and its auto-pause, the abacus dock and the
 * keypad, the teacher's abacus control, vision training frames, the slide
 * between problems, and the record and do-over bodies. The problem is drawn
 * by presentation: abacus and visualization vertically, linear as a number
 * sentence.
 */

import { animated, useSpring } from '@react-spring/web'
import { useAbacusDisplay } from '@soroban/abacus-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { DecompositionProvider } from '@/components/decomposition'
import { DebugOverlay } from '@/components/practice/DebugOverlay'
import { AbacusDock } from '@/components/practice/input/AbacusDock'
// Audio disabled for practice sessions (use abacus / visualize)
import { NumericKeypad } from '@/components/practice/input/NumericKeypad'
import { useHasPhysicalKeyboard } from '@/components/practice/input/useDeviceDetection'
import type { ItemViewProps } from '@/components/practice/session/sessionKind'
import type { PauseInfo } from '@/components/practice/session/types'
import { useMyAbacus } from '@/contexts/MyAbacusContext'
import { useTheme } from '@/contexts/ThemeContext'
import type { ProblemSlot, SessionPart, SessionPlan } from '@/db/schema/session-plans'
import { useSetRemoteCameraSession } from '@/hooks/useSessionPlan'
import { css } from '../../../../../../styled-system/css'
import { arithmeticPresentationOf } from '../presentations'
import { arithmeticSlotAt, arithmeticSlotOf } from '../session-view'
import { getCurrentProblemInfo } from '../state'
import { AssistanceDebugPanel } from './AssistanceDebugPanel'
import { generateCoachHint } from './coachHintGenerator'
import { DecompositionSection } from './DecompositionSection'
import { LinearProblem } from './LinearProblem'
import { PracticeFeedback } from './PracticeFeedback'
import { PracticeHelpOverlay } from './PracticeHelpOverlay'
import { ProblemDebugPanel } from './ProblemDebugPanel'
import { ProgressiveAssistanceUI } from './ProgressiveAssistanceUI'
import { PurposeBadge } from './PurposeBadge'
import {
  type AttemptInput,
  type DigitEntryPhase,
  findMatchedPrefixIndex,
  type InitialProblemData,
  type OutgoingAttempt,
  useDigitEntry,
} from './useDigitEntry'
import { useProgressiveAssistance } from './useProgressiveAssistance'
import { VerticalProblem } from './VerticalProblem'

/** Arithmetic's item view props: the shell's, over arithmetic's try types. */
export type ArithmeticItemViewProps = ItemViewProps<
  InitialProblemData,
  AttemptInput,
  OutgoingAttempt,
  DigitEntryPhase,
  number
>

/**
 * Identity of the problem an attempt answers, as the server matches it: the
 * attempt's own part, slot and round, never the plan's current ones (which
 * lag one problem behind an optimistic advance), plus the try id minted when
 * the problem was shown (the server records a try id once).
 */
export function answeredProblemIdentity(parts: SessionPlan['parts'], attempt: AttemptInput) {
  return {
    tryId: attempt.tryId,
    partIndex: attempt.partIndex,
    slotId: arithmeticSlotAt(parts, attempt.partIndex, attempt.slotIndex)?.slotId ?? '',
    slotIndex: attempt.slotIndex,
    epochNumber: attempt.epochNumber ?? 0,
  }
}

/** How each presentation draws its problem. */
const PRESENTATION_DISPLAY: Record<string, 'vertical' | 'linear'> = {
  abacus: 'vertical',
  visualization: 'vertical',
  linear: 'linear',
}

/** The problem display of a part's presentation (its `format` for an id this table lacks). */
export function presentationDisplayOf(part: SessionPart): 'vertical' | 'linear' {
  return (
    PRESENTATION_DISPLAY[arithmeticPresentationOf(part)] ??
    (part.format === 'vertical' ? 'vertical' : 'linear')
  )
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

export function ArithmeticItemView({
  plan,
  student,
  historicalResults,
  state,
  lifecycle,
  channel,
  feedback,
  redo,
  itemKey,
  slidePending,
  handle,
  hidden,
  banner,
  overlays,
  teacherControl,
  onTeacherControlHandled,
  debug,
}: ArithmeticItemViewProps) {
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

  // The problem the plan shows (getCurrentProblemInfo accounts for retry rounds)
  const currentProblemInfo = useMemo(() => getCurrentProblemInfo(plan), [plan])

  // Redo mode: the item being redone, by its id
  const isInRedoMode = redo?.isActive ?? false
  const redoItem = useMemo(
    () => (redo?.isActive ? arithmeticSlotOf(plan.parts[redo.partIndex], redo.itemId) : null),
    [redo, plan.parts]
  )
  const redoSlot = redoItem?.slot ?? null

  // LINEAR parts drop the bead-help scaffolding (prefix-sum / disambiguation / help
  // coach): the horizontal number sentence uses free digit entry + a forced submit.
  // The working abacus itself is a SEPARATE concern (see showAbacusDock / useAbacus):
  // it stays ON during the linear-with-abacus ramp and only goes away for mental
  // (post-gate) linear. Keyed off the part of the problem the shell loads (a
  // do-over's part when one is on screen), which matches the on-screen problem
  // even in redo mode.
  const activePartIndex =
    isInRedoMode && redo && redoSlot?.problem ? redo.partIndex : plan.currentPartIndex
  const isLinearActive = plan.parts[activePartIndex]?.format === 'linear'

  // Digit entry and help, over the phase the shell's lifecycle holds. Called
  // here, in the shell's child, so its effects run before the lifecycle's
  // (practice-kinds A18(2)).
  const {
    helpContext,
    showHelpOverlay,
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
  } = useDigitEntry(state, { disableAbacusScaffolding: isLinearActive })

  const {
    phase,
    attempt,
    outgoingAttempt,
    canAcceptInput,
    showAsCompleted,
    showInputArea,
    showFeedback,
    inputIsFocused,
    isPaused,
    isSubmitting,
    completeTransition,
  } = lifecycle

  // Format of the OUTGOING problem's part (may differ from the current part at a
  // part boundary), so the sliding-away problem keeps its own vertical/linear shape.
  const outgoingPart = outgoingAttempt != null ? plan.parts[outgoingAttempt.partIndex] : undefined
  const outgoingFormat = outgoingPart ? presentationDisplayOf(outgoingPart) : undefined

  // Progressive assistance state machine — subsumes auto-pause timer
  const handleAutoPause = useCallback(
    (info: PauseInfo) => {
      channel.pause(info)
    },
    [channel]
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

  // The shell resumes the session (the kid or the teacher): the assistance
  // machine hears it first, as it always has
  handle.current = { onResumed: assistance.onResumed }

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
  const prevActiveProblemKeyRef = useRef(itemKey)
  useEffect(() => {
    const prevKey = prevActiveProblemKeyRef.current
    const currKey = itemKey
    prevActiveProblemKeyRef.current = currKey

    if (prevKey !== undefined && currKey !== prevKey) {
      assistance.onProblemChanged()
    }
  }, [itemKey, assistance.onProblemChanged])

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

  // Track which help elements have been individually dismissed
  // These reset when entering a new help session (helpContext changes)
  const [helpAbacusDismissed, setHelpAbacusDismissed] = useState(false)
  const [helpPanelDismissed, setHelpPanelDismissed] = useState(false)
  // Track when answer is fading out (for dream sequence)
  const [answerFadingOut, setAnswerFadingOut] = useState(false)
  // The reveal policy the shell captured at submit, so feedback is stable
  // even if the plan advances (before any submit: reveal)
  const showCorrectAnswerOnIncorrect = feedback?.showAnswer ?? true

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

  // Apply centering offset before paint to prevent jank. The shell sets
  // `slidePending` when it starts a transition to the next problem.
  useLayoutEffect(() => {
    if (slidePending.current && outgoingRef.current) {
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

      slidePending.current = false

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
  }, [outgoingAttempt, trackApi, completeTransition, slidePending])

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
  const currentPart = plan.parts[plan.currentPartIndex] as SessionPart | undefined
  const regularSlot: ProblemSlot | undefined = currentProblemInfo
    ? {
        slotId: currentProblemInfo.slotId,
        index: currentProblemInfo.originalSlotIndex,
        purpose: currentProblemInfo.purpose,
        problem: currentProblemInfo.problem,
        constraints: {},
      }
    : undefined

  // Use redo slot when in redo mode, otherwise regular slot
  const currentSlot = isInRedoMode && redoSlot ? redoSlot : regularSlot

  // Retry epoch tracking
  const inRetryEpoch = currentProblemInfo?.isRetry ?? false
  const retryEpochNumber = currentProblemInfo?.epochNumber ?? 0

  // Auto-trigger help when an unambiguous prefix sum is detected
  // The awaitingDisambiguation phase handles the timer and auto-transitions to helpMode when it expires
  // This effect only handles the inputting phase case for unambiguous matches
  // DISABLED when abacus is docked - user controls when to submit, help triggers on submit if needed
  useEffect(() => {
    // LINEAR parts never auto-trigger bead help (a ramp part keeps the physical
    // abacus, but its help stays bead-free). The hook's enterHelpMode is already
    // a no-op for linear; this avoids the wasted work.
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

  // Handle submit: arithmetic's checks, then the shell's submit path (the
  // verdict, the write, the feedback and where the screen goes next)
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

    const inHelpMode = phase.phase === 'helpMode'
    await channel.submit(attemptData, {
      answer: answerNum,
      // The capture-time timing guard (#156) caps at this child's auto-pause threshold
      capMs: assistance.machineState.context.thresholds.autoPauseMs,
      onVerdict: (isCorrect) => {
        // Notify assistance machine of incorrect answer
        if (!isCorrect) {
          assistance.onWrongAnswer()
        }

        // Collect vision training data if answer is correct and vision is enabled
        // This runs in the background (fire-and-forget) to not block the UI
        if (isCorrect) {
          collectVisionTrainingData(attemptData.problem.answer, attemptData.slotIndex)
        }
      },
      resultOf: ({ isCorrect, timing, hiddenTimeExcludedMs }) => ({
        // The round tells the server a resubmit from the next try of the same slot
        ...answeredProblemIdentity(plan.parts, attemptData),
        problem: attemptData.problem,
        studentAnswer: answerNum,
        // The screen's own check, for display (the markers). Never sent: the
        // try goes as record_try, and the server is the only judge
        // (practice-kinds K4, amendments A1, A15)
        isCorrect,
        ...timing,
        hiddenTimeExcludedMs,
        skillsExercised: attemptData.problem.skillsRequired,
        usedOnScreenAbacus: inHelpMode,
        incorrectAttempts: assistance.machineState.context.wrongAttemptCount,
        hadHelp: inHelpMode || assistance.machineState.context.helpedTermIndices.size > 0,
      }),
    })
  }, [
    phase,
    channel,
    plan.parts,
    isDockedByUser,
    prefixSums,
    enterHelpMode,
    collectVisionTrainingData,
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

  // Handle skip (from progressive assistance): the shell shows the correct
  // answer, records the skip and moves on (a do-over's skip cancels it)
  const handleSkip = useCallback(async () => {
    if (!attempt) return
    await channel.skip(attempt, {
      // Same capture-time timing guard (#156) as a submit — a skip after a
      // long idle/backgrounded stretch must not store an unbounded response time
      capMs: assistance.machineState.context.thresholds.autoPauseMs,
      // Show the correct answer briefly
      reveal: () => setAnswer(String(attempt.problem.answer)),
      // Record as incorrect with help
      resultOf: ({ timing, hiddenTimeExcludedMs }) => ({
        ...answeredProblemIdentity(plan.parts, attempt),
        problem: attempt.problem,
        studentAnswer: attempt.problem.answer, // Record the correct answer
        // The screen's own check, for display; never sent (K4, amendment A15)
        isCorrect: false,
        // Sent as the envelope's outcome (practice-kinds §3.3)
        outcome: 'skipped' as const,
        ...timing,
        hiddenTimeExcludedMs,
        skillsExercised: attempt.problem.skillsRequired,
        usedOnScreenAbacus: false,
        incorrectAttempts: assistance.machineState.context.wrongAttemptCount,
        hadHelp: true,
        helpTrigger: 'manual' as const,
      }),
    })
  }, [
    attempt,
    channel,
    plan.parts,
    setAnswer,
    assistance.machineState.context.wrongAttemptCount,
    assistance.machineState.context.thresholds,
  ])

  // Handle help requested from progressive assistance UI
  const handleHelpFromAssistance = useCallback(() => {
    // LINEAR parts have no bead help to request (ramp parts included).
    if (isLinearActive) return
    enterHelpMode(0)
  }, [enterHelpMode, isLinearActive])

  // Loading or browsing: the shell draws its own screen; this view's hooks
  // keep running (the help thresholds are computed once, on mount)
  if (hidden || !currentPart || !attempt) return null

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
          {/* The shell's do-over banner */}
          {banner}

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
                {presentationDisplayOf(currentPart) === 'vertical' ? (
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

      {/* The shell's overlays: the pause modal, the round interlude */}
      {overlays}
    </div>
  )
}
