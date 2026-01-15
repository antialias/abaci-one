'use client'

/**
 * PracticeHelpOverlay - Simplified help overlay for practice sessions
 *
 * Shows just the interactive abacus with bead arrows and tooltip.
 * Uses the same tooltip system as TutorialPlayer for consistency.
 *
 * Time-based escalation:
 * - 0s: Abacus with arrows
 * - +5s: Coach hint (shown in parent component)
 * - +10s: Bead tooltip appears
 */

import type { AbacusOverlay, StepBeadHighlight } from '@soroban/abacus-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { css } from '../../../styled-system/css'
import { useTheme } from '@/contexts/ThemeContext'
import { getHelpTiming, shouldUseDebugTiming } from '@/constants/helpTiming'
import { generateUnifiedInstructionSequence } from '@/utils/unifiedStepGenerator'
import { calculateTooltipPositioning } from '@/utils/beadTooltipUtils'
import { calculateBeadDiffFromValues } from '@/utils/beadDiff'
import { BeadTooltipContent } from '../shared/BeadTooltipContent'
import { HelpAbacus } from './HelpAbacus'

export interface PracticeHelpOverlayProps {
  /** Current abacus value (prefix sum the kid entered) */
  currentValue: number
  /** Target value to reach (current prefix sum + next term) */
  targetValue: number
  /** Number of columns in the abacus */
  columns?: number
  /** Called when kid reaches the target value */
  onTargetReached?: () => void
  /** Called when abacus value changes */
  onValueChange?: (value: number) => void
  /** Called when user dismisses the help abacus */
  onDismiss?: () => void
  /** Whether to show debug timing */
  debugTiming?: boolean
  /** Whether the overlay is visible (false = being dismissed, suppress tooltip) */
  visible?: boolean
}

/**
 * Help escalation phases
 */
type HelpPhase = 'abacus' | 'bead-tooltip'

/**
 * PracticeHelpOverlay - Progressive help overlay for practice sessions
 *
 * Shows just the interactive abacus with bead arrows and optional tooltip.
 * No extra UI (no current/target labels, no dismiss button).
 */
export function PracticeHelpOverlay({
  currentValue,
  targetValue,
  columns = 3,
  onTargetReached,
  onValueChange,
  onDismiss,
  debugTiming,
  visible = true,
}: PracticeHelpOverlayProps) {
  const { resolvedTheme } = useTheme()
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light'

  // Determine timing config
  const timing = useMemo(() => {
    const useDebug = debugTiming ?? shouldUseDebugTiming()
    return getHelpTiming(useDebug)
  }, [debugTiming])

  // Track current help phase and escalation
  const [currentPhase, setCurrentPhase] = useState<HelpPhase>('abacus')
  const [abacusValue, setAbacusValue] = useState(currentValue)
  const [beadHighlights, setBeadHighlights] = useState<StepBeadHighlight[] | undefined>()

  // Refs for timers
  const beadTooltipTimerRef = useRef<NodeJS.Timeout | null>(null)
  const celebrationTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Calculate if at target
  const isAtTarget = abacusValue === targetValue

  // Generate the decomposition steps
  const sequence = useMemo(() => {
    return generateUnifiedInstructionSequence(currentValue, targetValue)
  }, [currentValue, targetValue])

  // Calculate current step summary using bead diff (same as TutorialPlayer)
  const currentStepSummary = useMemo(() => {
    if (isAtTarget) return null

    try {
      const beadDiff = calculateBeadDiffFromValues(abacusValue, targetValue)
      return beadDiff.hasChanges ? beadDiff.summary : null
    } catch {
      return null
    }
  }, [abacusValue, targetValue, isAtTarget])

  // Check if decomposition is meaningful (same as TutorialPlayer)
  const isMeaningfulDecomposition = sequence?.isMeaningfulDecomposition ?? false

  // Calculate current step index based on abacus value
  const currentStepIndex = useMemo(() => {
    if (!sequence || sequence.steps.length === 0) return 0

    // If abacus is still at start value, we're at step 0
    if (abacusValue === currentValue) return 0

    // Find which step we're on
    for (let i = 0; i < sequence.steps.length; i++) {
      const step = sequence.steps[i]
      if (abacusValue < step.expectedValue) {
        return i
      }
      if (abacusValue === step.expectedValue) {
        return Math.min(i + 1, sequence.steps.length - 1)
      }
    }

    return sequence.steps.length - 1
  }, [sequence, abacusValue, currentValue])

  // Generate highlighted decomposition (same pattern as TutorialPlayer)
  const renderHighlightedDecomposition = useCallback(() => {
    if (!sequence?.fullDecomposition || sequence.steps.length === 0) return null

    const currentStep = sequence.steps[currentStepIndex]
    if (!currentStep?.mathematicalTerm) return null

    const mathTerm = currentStep.mathematicalTerm

    // Try to use precise position first
    if (currentStep.termPosition) {
      const { startIndex, endIndex } = currentStep.termPosition
      const highlighted = sequence.fullDecomposition.substring(startIndex, endIndex)

      // Validate that the highlighted text makes sense
      if (highlighted.includes(mathTerm.replace('-', '')) || highlighted === mathTerm) {
        return {
          before: sequence.fullDecomposition.substring(0, startIndex),
          highlighted,
          after: sequence.fullDecomposition.substring(endIndex),
        }
      }
    }

    // Fallback: search for the mathematical term in the decomposition
    const searchTerm = mathTerm.startsWith('-') ? mathTerm.substring(1) : mathTerm
    const searchIndex = sequence.fullDecomposition.indexOf(searchTerm)

    if (searchIndex !== -1) {
      const startIndex = mathTerm.startsWith('-') ? Math.max(0, searchIndex - 1) : searchIndex
      const endIndex = mathTerm.startsWith('-')
        ? searchIndex + searchTerm.length
        : searchIndex + mathTerm.length

      return {
        before: sequence.fullDecomposition.substring(0, startIndex),
        highlighted: sequence.fullDecomposition.substring(startIndex, endIndex),
        after: sequence.fullDecomposition.substring(endIndex),
      }
    }

    // Final fallback: highlight the first occurrence of just the number part
    const numberMatch = mathTerm.match(/\d+/)
    if (numberMatch) {
      const number = numberMatch[0]
      const numberIndex = sequence.fullDecomposition.indexOf(number)
      if (numberIndex !== -1) {
        return {
          before: sequence.fullDecomposition.substring(0, numberIndex),
          highlighted: sequence.fullDecomposition.substring(
            numberIndex,
            numberIndex + number.length
          ),
          after: sequence.fullDecomposition.substring(numberIndex + number.length),
        }
      }
    }

    return null
  }, [sequence, currentStepIndex])

  // Calculate tooltip positioning using shared utility
  const tooltipPositioning = useMemo(() => {
    if (currentPhase !== 'bead-tooltip' || isAtTarget) return null
    return calculateTooltipPositioning(abacusValue, beadHighlights, columns)
  }, [currentPhase, isAtTarget, abacusValue, beadHighlights, columns])

  // Create tooltip overlay for HelpAbacus using shared BeadTooltipContent
  const tooltipOverlay: AbacusOverlay | undefined = useMemo(() => {
    // Suppress tooltip when overlay is being dismissed (visible=false)
    if (!visible) return undefined

    // Show tooltip in bead-tooltip phase with instructions, or when celebrating
    const showCelebration = isAtTarget
    const showInstructions =
      !showCelebration && currentPhase === 'bead-tooltip' && currentStepSummary

    if (!showCelebration && !showInstructions) return undefined
    if (!tooltipPositioning && !showCelebration) return undefined

    // For celebration, use a default position if no bead highlights
    const side = tooltipPositioning?.side ?? 'top'
    const target = tooltipPositioning?.target ?? {
      type: 'bead' as const,
      columnIndex: columns - 1, // rightmost column
      beadType: 'heaven' as const,
      beadPosition: 0,
    }

    return {
      id: 'practice-help-tooltip',
      type: 'tooltip',
      target,
      content: (
        <BeadTooltipContent
          showCelebration={showCelebration}
          currentStepSummary={currentStepSummary}
          isMeaningfulDecomposition={isMeaningfulDecomposition}
          decomposition={renderHighlightedDecomposition()}
          side={side}
          theme={theme}
        />
      ),
      offset: { x: 0, y: 0 },
      visible: true,
    }
  }, [
    visible,
    tooltipPositioning,
    isAtTarget,
    currentPhase,
    currentStepSummary,
    isMeaningfulDecomposition,
    renderHighlightedDecomposition,
    columns,
    theme,
  ])

  // Start time-based escalation when mounted
  useEffect(() => {
    // Start bead tooltip timer
    beadTooltipTimerRef.current = setTimeout(() => {
      setCurrentPhase('bead-tooltip')
    }, timing.beadTooltipDelayMs)

    return () => {
      if (beadTooltipTimerRef.current) clearTimeout(beadTooltipTimerRef.current)
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current)
    }
  }, [timing])

  // Handle target reached - show celebration then notify
  useEffect(() => {
    if (isAtTarget) {
      celebrationTimerRef.current = setTimeout(() => {
        onTargetReached?.()
      }, timing.celebrationDurationMs)
    }
  }, [isAtTarget, timing, onTargetReached])

  // Handle abacus value change
  const handleValueChange = useCallback(
    (newValue: number) => {
      setAbacusValue(newValue)
      onValueChange?.(newValue)
    },
    [onValueChange]
  )

  // Handle bead highlights change from HelpAbacus
  const handleBeadHighlightsChange = useCallback((highlights: StepBeadHighlight[] | undefined) => {
    setBeadHighlights(highlights)
  }, [])

  const isDark = theme === 'dark'

  return (
    <div
      data-component="practice-help-overlay"
      data-phase={currentPhase}
      data-at-target={isAtTarget}
      className={css({
        position: 'relative',
      })}
    >
      {/* Interactive abacus with bead arrows - just the abacus, no extra UI */}
      <HelpAbacus
        currentValue={currentValue}
        targetValue={targetValue}
        columns={columns}
        scaleFactor={1.2}
        interactive={true}
        onValueChange={handleValueChange}
        onTargetReached={onTargetReached}
        onBeadHighlightsChange={handleBeadHighlightsChange}
        overlays={tooltipOverlay ? [tooltipOverlay] : undefined}
        showSummary={false}
        showValueLabels={false}
        showTargetReached={false}
      />

      {/* Dismiss button - small X in top-right corner */}
      {onDismiss && (
        <button
          type="button"
          data-action="dismiss-help-abacus"
          onClick={onDismiss}
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
          aria-label="Dismiss help abacus"
        >
          ×
        </button>
      )}
    </div>
  )
}

export default PracticeHelpOverlay
