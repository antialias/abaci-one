'use client'

import { animated, useSpring } from '@react-spring/web'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useMyAbacus } from '@/contexts/MyAbacusContext'
import { useTheme } from '@/contexts/ThemeContext'
import type {
  ProblemSlot,
  SessionHealth,
  SessionPart,
  SessionPlan,
  SlotResult,
} from '@/db/schema/session-plans'

import { css } from '../../../styled-system/css'
import { type AutoPauseStats, calculateAutoPauseInfo, type PauseInfo } from './autoPauseCalculator'
import { BrowseModeView, getLinearIndex } from './BrowseModeView'
import { SessionPausedModal } from './SessionPausedModal'

// Re-export types for consumers
export type { AutoPauseStats, PauseInfo }

/**
 * Student info needed for the pause modal
 */
export interface StudentInfo {
  name: string
  emoji: string
  color: string
}

import { AbacusDock } from '../AbacusDock'
import { DecompositionProvider, DecompositionSection } from '../decomposition'
import { Tooltip, TooltipProvider } from '../ui/Tooltip'
import { generateCoachHint } from './coachHintGenerator'
import { useHasPhysicalKeyboard } from './hooks/useDeviceDetection'
import { useInteractionPhase } from './hooks/useInteractionPhase'
import { usePracticeSoundEffects } from './hooks/usePracticeSoundEffects'
import { NumericKeypad } from './NumericKeypad'
import { PracticeFeedback } from './PracticeFeedback'
import { PracticeHelpOverlay } from './PracticeHelpOverlay'
import { ProblemDebugPanel } from './ProblemDebugPanel'
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
}

/**
 * Extract the primary skill from constraints for display
 */
function extractTargetSkillName(slot: ProblemSlot): string | null {
  const targetSkills = slot.constraints?.targetSkills
  if (!targetSkills) return null

  // Look for specific skill in targetSkills
  for (const [category, skills] of Object.entries(targetSkills)) {
    if (skills && typeof skills === 'object') {
      const skillKeys = Object.keys(skills)
      if (skillKeys.length === 1) {
        // Single skill - this is a targeted reinforce/review
        return formatSkillName(category, skillKeys[0])
      }
    }
  }
  return null
}

/**
 * Format a skill ID into a human-readable name
 */
function formatSkillName(category: string, skillKey: string): string {
  // Categories: basic, fiveComplements, tenComplements
  if (category === 'basic') {
    // Format "+3" or "-5" into "add 3" or "subtract 5"
    if (skillKey.startsWith('+')) {
      return `add ${skillKey.slice(1)}`
    }
    if (skillKey.startsWith('-')) {
      return `subtract ${skillKey.slice(1)}`
    }
    return skillKey
  }

  if (category === 'fiveComplements') {
    // Format "4=5-1" into "5-complement for 4"
    const match = skillKey.match(/^(\d+)=/)
    if (match) {
      return `5-complement for ${match[1]}`
    }
    return skillKey
  }

  if (category === 'tenComplements') {
    // Format "9=10-1" into "10-complement for 9"
    const match = skillKey.match(/^(\d+)=/)
    if (match) {
      return `10-complement for ${match[1]}`
    }
    return skillKey
  }

  return `${category}: ${skillKey}`
}

/**
 * Complexity section for purpose tooltip - shows complexity bounds and actual costs
 */
function ComplexitySection({
  slot,
  showBounds = true,
}: {
  slot: ProblemSlot
  showBounds?: boolean
}) {
  const trace = slot.problem?.generationTrace
  const bounds = slot.complexityBounds
  const hasBounds = bounds && (bounds.min !== undefined || bounds.max !== undefined)
  const hasCost =
    trace?.totalComplexityCost !== undefined && !Number.isNaN(trace?.totalComplexityCost)

  // Don't render anything if no complexity data
  if (!hasBounds && !hasCost) {
    return null
  }

  const sectionStyles = {
    container: css({
      marginTop: '0.5rem',
      padding: '0.5rem',
      backgroundColor: 'gray.800',
      borderRadius: '6px',
      fontSize: '0.8125rem',
    }),
    header: css({
      display: 'flex',
      alignItems: 'center',
      gap: '0.25rem',
      color: 'gray.400',
      fontWeight: '500',
      marginBottom: '0.375rem',
    }),
    row: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      color: 'gray.300',
      paddingY: '0.125rem',
    }),
    value: css({
      fontFamily: 'mono',
      color: 'white',
    }),
    boundsLabel: css({
      color: 'gray.500',
      fontSize: '0.75rem',
    }),
  }

  // Format bounds string
  let boundsText = ''
  if (bounds?.min !== undefined && bounds?.max !== undefined) {
    boundsText = `${bounds.min} – ${bounds.max}`
  } else if (bounds?.min !== undefined) {
    boundsText = `≥${bounds.min}`
  } else if (bounds?.max !== undefined) {
    boundsText = `≤${bounds.max}`
  }

  return (
    <div className={sectionStyles.container} data-element="complexity-section">
      <div className={sectionStyles.header}>
        <span>📊</span>
        <span>Complexity</span>
      </div>
      {showBounds && hasBounds && (
        <div className={sectionStyles.row}>
          <span className={sectionStyles.boundsLabel}>Required range:</span>
          <span className={sectionStyles.value}>{boundsText}</span>
        </div>
      )}
      {hasCost && (
        <div className={sectionStyles.row}>
          <span>Total cost:</span>
          <span className={sectionStyles.value}>{trace.totalComplexityCost}</span>
        </div>
      )}
      {hasCost && trace?.steps && trace.steps.length > 0 && (
        <div className={sectionStyles.row}>
          <span>Per term (avg):</span>
          <span className={sectionStyles.value}>
            {(trace.totalComplexityCost! / trace.steps.length).toFixed(1)}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Purpose tooltip content - rich explanatory content for each purpose
 */
function PurposeTooltipContent({ slot }: { slot: ProblemSlot }) {
  const skillName = extractTargetSkillName(slot)

  const tooltipStyles = {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    }),
    header: css({
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontWeight: 'bold',
      fontSize: '0.9375rem',
    }),
    emoji: css({
      fontSize: '1.125rem',
    }),
    description: css({
      color: 'gray.300',
      lineHeight: '1.5',
    }),
    detail: css({
      display: 'flex',
      alignItems: 'center',
      gap: '0.375rem',
      padding: '0.375rem 0.5rem',
      backgroundColor: 'gray.800',
      borderRadius: '6px',
      fontSize: '0.8125rem',
    }),
    detailLabel: css({
      color: 'gray.400',
      fontWeight: '500',
    }),
    detailValue: css({
      color: 'white',
      fontFamily: 'mono',
    }),
    percentage: css({
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.125rem 0.375rem',
      backgroundColor: 'orange.900',
      color: 'orange.200',
      borderRadius: '4px',
      fontSize: '0.75rem',
      fontWeight: 'bold',
    }),
  }

  switch (slot.purpose) {
    case 'focus':
      return (
        <div className={tooltipStyles.container}>
          <div className={tooltipStyles.header}>
            <span className={tooltipStyles.emoji}>🎯</span>
            <span>Focus Practice</span>
          </div>
          <p className={tooltipStyles.description}>
            Building mastery of your current curriculum skills. These problems are at the heart of
            what you&apos;re learning right now.
          </p>
          <div className={tooltipStyles.detail}>
            <span className={tooltipStyles.detailLabel}>Distribution:</span>
            <span className={tooltipStyles.detailValue}>60% of session</span>
          </div>
          <ComplexitySection slot={slot} />
        </div>
      )

    case 'reinforce':
      return (
        <div className={tooltipStyles.container}>
          <div className={tooltipStyles.header}>
            <span className={tooltipStyles.emoji}>💪</span>
            <span>Reinforcement</span>
          </div>
          <p className={tooltipStyles.description}>
            Extra practice for skills identified as needing more work. These problems target areas
            where mastery is still developing.
          </p>
          {skillName && (
            <div className={tooltipStyles.detail}>
              <span className={tooltipStyles.detailLabel}>Targeting:</span>
              <span className={tooltipStyles.detailValue}>{skillName}</span>
            </div>
          )}
          <ComplexitySection slot={slot} />
        </div>
      )

    case 'review':
      return (
        <div className={tooltipStyles.container}>
          <div className={tooltipStyles.header}>
            <span className={tooltipStyles.emoji}>🔄</span>
            <span>Spaced Review</span>
          </div>
          <p className={tooltipStyles.description}>
            Keeping mastered skills fresh through spaced repetition. Regular review prevents
            forgetting and strengthens long-term memory.
          </p>
          {skillName && (
            <div className={tooltipStyles.detail}>
              <span className={tooltipStyles.detailLabel}>Reviewing:</span>
              <span className={tooltipStyles.detailValue}>{skillName}</span>
            </div>
          )}
          <div className={tooltipStyles.detail}>
            <span className={tooltipStyles.detailLabel}>Schedule:</span>
            <span className={tooltipStyles.detailValue}>
              Mastered: 14 days • Practicing: 7 days
            </span>
          </div>
          <ComplexitySection slot={slot} />
        </div>
      )

    case 'challenge':
      return (
        <div className={tooltipStyles.container}>
          <div className={tooltipStyles.header}>
            <span className={tooltipStyles.emoji}>⭐</span>
            <span>Challenge</span>
          </div>
          <p className={tooltipStyles.description}>
            Harder problems that require complement techniques for every term. These push your
            skills and build deeper fluency.
          </p>
          <div className={tooltipStyles.detail}>
            <span className={tooltipStyles.detailLabel}>Requirement:</span>
            <span className={tooltipStyles.detailValue}>Every term uses complements</span>
          </div>
          <ComplexitySection slot={slot} />
        </div>
      )

    default:
      return null
  }
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
            ? userAnswer === String(correctAnswer)
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
            ? userAnswer === String(correctAnswer)
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
}: ActiveSessionProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Check if abacus is docked (to force show submit button)
  const { isDockedByUser } = useMyAbacus()

  // Sound effects
  const { playSound } = usePracticeSoundEffects()

  // Compute initial problem from plan for SSR hydration (must be before useInteractionPhase)
  const initialProblem = useMemo(() => {
    const currentPart = plan.parts[plan.currentPartIndex]
    const currentSlot = currentPart?.slots[plan.currentSlotIndex]
    if (currentPart && currentSlot?.problem) {
      return {
        problem: currentSlot.problem,
        slotIndex: plan.currentSlotIndex,
        partIndex: plan.currentPartIndex,
      }
    }
    return undefined
  }, [plan.parts, plan.currentPartIndex, plan.currentSlotIndex])

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
    matchedPrefixIndex,
    canSubmit,
    shouldAutoSubmit,
    ambiguousHelpTermIndex,
    loadProblem,
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
    onManualSubmitRequired: () => playSound('womp_womp'),
  })

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
  ])

  // Track which help elements have been individually dismissed
  // These reset when entering a new help session (helpContext changes)
  const [helpAbacusDismissed, setHelpAbacusDismissed] = useState(false)
  const [helpPanelDismissed, setHelpPanelDismissed] = useState(false)
  // Track when answer is fading out (for dream sequence)
  const [answerFadingOut, setAnswerFadingOut] = useState(false)

  // Track pause info for displaying in the modal (single source of truth)
  const [pauseInfo, setPauseInfo] = useState<PauseInfo | undefined>(undefined)

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

  // Track last resume time to reset auto-pause timer after resuming
  const lastResumeTimeRef = useRef<number>(0)

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

  // Track problem container height for AbacusDock sizing
  const [problemHeight, setProblemHeight] = useState<number | null>(null)

  // Measure problem container height with ResizeObserver
  // Use useLayoutEffect to run synchronously after DOM mutations (before paint)
  // This ensures we get accurate measurements before the browser paints
  useLayoutEffect(() => {
    const element = activeRef.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use borderBoxSize for more accurate measurement including padding
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
        setProblemHeight(height)
      }
    })

    observer.observe(element)
    // Initial measurement - offsetHeight includes padding and border
    setProblemHeight(element.offsetHeight)

    return () => observer.disconnect()
  }, [attempt?.slotIndex, attempt?.partIndex]) // Re-run when problem changes

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

  // Get current part and slot from plan
  const parts = plan.parts
  const currentPartIndex = plan.currentPartIndex
  const currentSlotIndex = plan.currentSlotIndex
  const currentPart = parts[currentPartIndex] as SessionPart | undefined
  const currentSlot = currentPart?.slots[currentSlotIndex] as ProblemSlot | undefined
  const sessionHealth = plan.sessionHealth as SessionHealth | null

  // Calculate total progress across all parts
  const totalProblems = useMemo(() => {
    return parts.reduce((sum, part) => sum + part.slots.length, 0)
  }, [parts])

  const completedProblems = useMemo(() => {
    let count = 0
    for (let i = 0; i < currentPartIndex; i++) {
      count += parts[i].slots.length
    }
    count += currentSlotIndex
    return count
  }, [parts, currentPartIndex, currentSlotIndex])

  // Check for session completion
  useEffect(() => {
    if (currentPartIndex >= parts.length) {
      onComplete()
    }
  }, [currentPartIndex, parts.length, onComplete])

  // Initialize problem when slot changes and in loading phase
  useEffect(() => {
    if (currentPart && currentSlot && phase.phase === 'loading') {
      if (!currentSlot.problem) {
        throw new Error(
          `Problem not pre-generated for slot ${currentSlotIndex} in part ${currentPartIndex}. ` +
            'This indicates a bug in session planning - problems should be generated at plan creation time.'
        )
      }
      loadProblem(currentSlot.problem, currentSlotIndex, currentPartIndex)
    }
  }, [currentPart, currentSlot, currentPartIndex, currentSlotIndex, phase.phase, loadProblem])

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

    // For unambiguous matches, trigger immediately
    if (matchedPrefixIndex >= 0 && matchedPrefixIndex < prefixSums.length - 1) {
      const newConfirmedCount = matchedPrefixIndex + 1
      if (newConfirmedCount < phase.attempt.problem.terms.length) {
        enterHelpMode(newConfirmedCount)
      }
    }
  }, [phase, matchedPrefixIndex, prefixSums.length, enterHelpMode, isDockedByUser])

  // Handle when student reaches target value on help abacus
  // Sequence: show target value → dismiss abacus → show value in answer boxes → fade to empty → exit
  const handleTargetReached = useCallback(() => {
    if (phase.phase !== 'helpMode' || !helpContext) return

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
  }, [phase.phase, helpContext, setAnswer, clearAnswer, exitHelpMode])

  // Handle value change from the docked abacus
  const handleAbacusDockValueChange = useCallback(
    (newValue: number) => {
      // When the abacus shows the correct answer, set it and auto-submit will trigger
      setAnswer(String(newValue))
    },
    [setAnswer]
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
    if (isDockedByUser && phase.phase !== 'helpMode') {
      // Check if the answer matches a prefix sum (but not the final answer)
      const prefixIndex = prefixSums.indexOf(answerNum)
      if (prefixIndex >= 0 && prefixIndex < prefixSums.length - 1) {
        // Answer matches a prefix sum - enter help mode instead of submitting
        const newConfirmedCount = prefixIndex + 1
        if (newConfirmedCount < attemptData.problem.terms.length) {
          enterHelpMode(newConfirmedCount)
          return
        }
      }
    }

    // Transition to submitting phase
    startSubmit()

    // Subtract accumulated pause time to get actual response time
    const responseTimeMs = Date.now() - attemptData.startTime - attemptData.accumulatedPauseMs
    const isCorrect = answerNum === attemptData.problem.answer

    // Record the result
    const result: Omit<SlotResult, 'timestamp' | 'partNumber'> = {
      slotIndex: attemptData.slotIndex,
      problem: attemptData.problem,
      studentAnswer: answerNum,
      isCorrect,
      responseTimeMs,
      skillsExercised: attemptData.problem.skillsRequired,
      usedOnScreenAbacus: phase.phase === 'helpMode',
      incorrectAttempts: 0, // TODO: track this properly
      hadHelp: phase.phase === 'helpMode',
    }

    await onAnswer(result)

    // Complete submit with result
    completeSubmit(isCorrect ? 'correct' : 'incorrect')

    // Wait for feedback display then advance
    setTimeout(
      () => {
        const nextSlotIndex = currentSlotIndex + 1
        const nextSlot = currentPart?.slots[nextSlotIndex]

        if (nextSlot && currentPart && isCorrect) {
          // Has next problem - animate transition
          if (!nextSlot.problem) {
            throw new Error(
              `Problem not pre-generated for slot ${nextSlotIndex} in part ${currentPartIndex}. ` +
                'This indicates a bug in session planning - problems should be generated at plan creation time.'
            )
          }
          // Mark that we need to apply centering offset in useLayoutEffect
          needsCenteringOffsetRef.current = true

          startTransition(nextSlot.problem, nextSlotIndex)
        } else {
          // End of part or incorrect - clear to loading
          clearToLoading()
        }
      },
      isCorrect ? 500 : 1500
    )
  }, [
    phase,
    onAnswer,
    currentSlotIndex,
    currentPart,
    currentPartIndex,
    startSubmit,
    completeSubmit,
    startTransition,
    clearToLoading,
    isDockedByUser,
    prefixSums,
    enterHelpMode,
  ])

  // Auto-submit when correct answer is entered
  useEffect(() => {
    if (shouldAutoSubmit) {
      handleSubmit()
    }
  }, [shouldAutoSubmit, handleSubmit])

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
        handleDigit(e.key)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    hasPhysicalKeyboard,
    canAcceptInput,
    handleSubmit,
    handleDigit,
    handleBackspace,
    showHelpOverlay,
    exitHelpMode,
  ])

  // Auto-pause when user takes too long on a problem
  // Uses mean + 2 standard deviations of response times if we have enough data,
  // otherwise defaults to 5 minutes
  useEffect(() => {
    // Only run auto-pause when actively inputting
    if (
      phase.phase !== 'inputting' &&
      phase.phase !== 'awaitingDisambiguation' &&
      phase.phase !== 'helpMode'
    ) {
      return
    }

    // Don't auto-pause if already paused or no attempt yet
    if (isPaused || !attempt) return

    // Calculate the threshold and stats from historical results
    const { threshold, stats } = calculateAutoPauseInfo(plan.results)

    // Calculate remaining time until auto-pause
    // After resume, use the resume time as effective start (resets the auto-pause timer)
    const effectiveStartTime = Math.max(attempt.startTime, lastResumeTimeRef.current)
    const elapsedMs = Date.now() - effectiveStartTime
    const remainingMs = threshold - elapsedMs

    // Create pause info for auto-timeout
    const autoPauseInfo: PauseInfo = {
      pausedAt: new Date(),
      reason: 'auto-timeout',
      autoPauseStats: stats,
    }

    // If already over threshold, pause immediately
    if (remainingMs <= 0) {
      setPauseInfo(autoPauseInfo)
      pause()
      onPause?.(autoPauseInfo)
      return
    }

    // Set timeout to trigger pause when threshold is reached
    const timeoutId = setTimeout(() => {
      // Update pausedAt to actual pause time
      autoPauseInfo.pausedAt = new Date()
      setPauseInfo(autoPauseInfo)
      pause()
      onPause?.(autoPauseInfo)
    }, remainingMs)

    return () => clearTimeout(timeoutId)
  }, [
    phase.phase,
    isPaused,
    attempt?.startTime,
    attempt?.accumulatedPauseMs,
    plan.results,
    pause,
    onPause,
  ])

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
    lastResumeTimeRef.current = Date.now() // Reset auto-pause timer
    resume()
    onResume?.()
  }, [resume, onResume])

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
      />
    )
  }

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
        maxWidth: '600px',
        margin: '0 auto',
        height: '100%', // Fill parent container
        overflow: 'hidden', // Prevent overflow
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
          flex: 1, // Take remaining space
          minHeight: 0, // Allow shrinking
          paddingTop: { base: '1rem', md: '2rem' },
          paddingRight: { base: '1rem', md: '2rem' },
          paddingBottom: { base: '1rem', md: '1.5rem' },
          paddingLeft: { base: '1rem', md: '2rem' },
          backgroundColor: isDark ? 'gray.800' : 'white',
          borderRadius: '16px',
          boxShadow: 'md',
          overflow: 'hidden', // Prevent overflow
        })}
      >
        {/* Purpose badge with tooltip */}
        {currentSlot && (
          <TooltipProvider>
            <Tooltip
              content={<PurposeTooltipContent slot={currentSlot} />}
              side="bottom"
              delayDuration={300}
            >
              <div
                data-element="problem-purpose"
                data-purpose={currentSlot.purpose}
                className={css({
                  position: 'relative',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  cursor: 'help',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  _hover: {
                    transform: 'scale(1.05)',
                    boxShadow: 'sm',
                  },
                  backgroundColor:
                    currentSlot.purpose === 'focus'
                      ? isDark
                        ? 'blue.900'
                        : 'blue.100'
                      : currentSlot.purpose === 'reinforce'
                        ? isDark
                          ? 'orange.900'
                          : 'orange.100'
                        : currentSlot.purpose === 'review'
                          ? isDark
                            ? 'green.900'
                            : 'green.100'
                          : isDark
                            ? 'purple.900'
                            : 'purple.100',
                  color:
                    currentSlot.purpose === 'focus'
                      ? isDark
                        ? 'blue.200'
                        : 'blue.700'
                      : currentSlot.purpose === 'reinforce'
                        ? isDark
                          ? 'orange.200'
                          : 'orange.700'
                        : currentSlot.purpose === 'review'
                          ? isDark
                            ? 'green.200'
                            : 'green.700'
                          : isDark
                            ? 'purple.200'
                            : 'purple.700',
                })}
              >
                {currentSlot.purpose}
              </div>
            </Tooltip>
          </TooltipProvider>
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
                  size="large"
                  currentHelpTermIndex={helpContext?.termIndex}
                  needHelpTermIndex={
                    // Only show "need help?" prompt when not already in help mode
                    !showHelpOverlay && ambiguousHelpTermIndex >= 0
                      ? ambiguousHelpTermIndex
                      : undefined
                  }
                  rejectedDigit={attempt.rejectedDigit}
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
                      Math.max(helpContext.currentValue, helpContext.targetValue).toString().length
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
              {/* Abacus dock - positioned absolutely so it doesn't affect problem centering */}
              {/* Width 100% matches problem width, height matches problem height */}
              {currentPart.type === 'abacus' && !showHelpOverlay && (problemHeight ?? 0) > 0 && (
                <AbacusDock
                  id="practice-abacus"
                  columns={String(Math.abs(attempt.problem.answer)).length}
                  interactive={true}
                  showNumbers={false}
                  animated={true}
                  onValueChange={handleAbacusDockValueChange}
                  className={css({
                    position: 'absolute',
                    left: '100%',
                    top: 0,
                    width: '100%',
                    marginLeft: '1.5rem',
                  })}
                  style={{ height: problemHeight }}
                />
              )}
            </animated.div>
          </animated.div>
        </div>

        {/* Feedback message - only show for incorrect */}
        {showFeedback && (
          <PracticeFeedback isCorrect={false} correctAnswer={attempt.problem.answer} />
        )}
      </div>

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
              onDigit={handleDigit}
              onBackspace={handleBackspace}
              onSubmit={handleSubmit}
              disabled={isSubmitting}
              currentValue={attempt.userAnswer}
              showSubmitButton={showSubmitButton}
            />
          )}
        </div>
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

      {/* Session Paused Modal - rendered here as single source of truth */}
      <SessionPausedModal
        isOpen={isPaused}
        student={student}
        session={plan}
        pauseInfo={pauseInfo}
        onResume={handleResume}
        onEndSession={() => onEndEarly('Session ended by user')}
      />
    </div>
  )
}
export default ActiveSession
