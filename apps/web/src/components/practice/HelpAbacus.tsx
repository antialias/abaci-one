'use client'

import {
  type AbacusOverlay,
  AbacusReact,
  calculateBeadDiffFromValues,
  type StepBeadHighlight,
  useAbacusDisplay,
} from '@soroban/abacus-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../styled-system/css'

/** Bead change from calculateBeadDiffFromValues */
interface BeadChange {
  placeValue: number
  beadType: 'heaven' | 'earth'
  position?: number
  direction: 'up' | 'down' | 'activate' | 'deactivate' | 'none'
  order?: number
}

export interface HelpAbacusProps {
  /** Initial value to start the abacus at */
  currentValue: number
  /** Target value we want to reach */
  targetValue: number
  /** Number of columns to display (default: 3) */
  columns?: number
  /** Scale factor for the abacus (default: 1.2) */
  scaleFactor?: number
  /** Callback when target is reached */
  onTargetReached?: () => void
  /** Optional callback when value changes (if interactive) */
  onValueChange?: (value: number) => void
  /** Whether the abacus is interactive (default: false for help mode) */
  interactive?: boolean
  /** Optional overlays (e.g., tooltips pointing at beads) */
  overlays?: AbacusOverlay[]
  /** Whether to show the summary instruction above abacus (default: true) */
  showSummary?: boolean
  /** Whether to show the value labels below abacus (default: true) */
  showValueLabels?: boolean
  /** Whether to show the target reached message (default: true) */
  showTargetReached?: boolean
  /** Callback to receive bead highlights for tooltip positioning */
  onBeadHighlightsChange?: (highlights: StepBeadHighlight[] | undefined) => void
}

/**
 * HelpAbacus - Shows an abacus with bead movement arrows
 *
 * Uses AbacusReact in uncontrolled mode (defaultValue) so interactions
 * work automatically. Tracks value changes via onValueChange to update
 * the bead diff arrows and detect when target is reached.
 */
export function HelpAbacus({
  currentValue,
  targetValue,
  columns = 3,
  scaleFactor = 1.2,
  onTargetReached,
  onValueChange,
  interactive = false,
  overlays,
  showSummary = true,
  showValueLabels = true,
  showTargetReached = true,
  onBeadHighlightsChange,
}: HelpAbacusProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { config: abacusConfig } = useAbacusDisplay()
  const [currentStep] = useState(0)
  const onBeadHighlightsChangeRef = useRef(onBeadHighlightsChange)

  // Track the displayed value for bead diff calculations
  // This is updated via onValueChange from AbacusReact
  const [displayedValue, setDisplayedValue] = useState(currentValue)

  // Track visibility state for animations
  // 'entering' = fade in, 'visible' = fully shown, 'waiting' = target reached, waiting to exit
  // 'exiting' = fade out, 'hidden' = removed from DOM
  const [visibilityState, setVisibilityState] = useState<
    'entering' | 'visible' | 'waiting' | 'exiting' | 'hidden'
  >('entering')

  // After mount, transition to visible
  useEffect(() => {
    if (visibilityState === 'entering') {
      // Small delay to ensure CSS transition triggers
      const timer = setTimeout(() => setVisibilityState('visible'), 50)
      return () => clearTimeout(timer)
    }
  }, [visibilityState])

  // Handle value changes from user interaction
  const handleValueChange = useCallback(
    (newValue: number | bigint) => {
      const numValue = typeof newValue === 'bigint' ? Number(newValue) : newValue
      setDisplayedValue(numValue)
      onValueChange?.(numValue)

      // If we just reached the target, mark that we're waiting for animation to complete
      if (numValue === targetValue) {
        setVisibilityState('waiting')
      }
    },
    [onValueChange, targetValue]
  )

  // Handle value change complete (called after animations settle)
  const handleValueChangeComplete = useCallback(
    (newValue: number | bigint) => {
      const numValue = typeof newValue === 'bigint' ? Number(newValue) : newValue
      // Only trigger dismissal after animation completes
      if (numValue === targetValue) {
        // Wait a moment to let user see the completed state, then start exit animation
        setTimeout(() => {
          setVisibilityState('exiting')
          // After exit animation completes, notify parent
          setTimeout(() => {
            onTargetReached?.()
          }, 300) // Match CSS transition duration
        }, 600) // Delay before starting exit
      }
    },
    [targetValue, onTargetReached]
  )

  // Check if currently at target (for showing success state)
  const isAtTarget = displayedValue === targetValue

  // Generate bead movement highlights using the bead diff algorithm
  // Updates as user moves beads closer to (or away from) the target
  const { stepBeadHighlights, hasChanges, summary } = useMemo(() => {
    try {
      const beadDiff = calculateBeadDiffFromValues(displayedValue, targetValue)

      if (!beadDiff.hasChanges) {
        return { stepBeadHighlights: undefined, hasChanges: false, summary: '' }
      }

      // Convert bead diff to StepBeadHighlight format
      // Filter to only columns that exist in our display
      const highlights: StepBeadHighlight[] = (beadDiff.changes as BeadChange[])
        .filter((change: BeadChange) => change.placeValue < columns)
        .map((change: BeadChange) => ({
          placeValue: change.placeValue,
          beadType: change.beadType,
          position: change.position,
          direction: change.direction,
          stepIndex: 0, // All in step 0 for now (could be multi-step later)
          order: change.order,
        }))

      return {
        stepBeadHighlights: highlights.length > 0 ? highlights : undefined,
        hasChanges: true,
        summary: beadDiff.summary,
      }
    } catch (error) {
      console.error('HelpAbacus: Error generating bead diff:', error)
      return { stepBeadHighlights: undefined, hasChanges: false, summary: '' }
    }
  }, [displayedValue, targetValue, columns])

  // Keep callback ref up to date
  onBeadHighlightsChangeRef.current = onBeadHighlightsChange

  // Notify parent when bead highlights change
  useEffect(() => {
    onBeadHighlightsChangeRef.current?.(stepBeadHighlights)
  }, [stepBeadHighlights])

  // Custom styles for help mode - highlight the arrows more prominently
  const customStyles = useMemo(() => {
    return {
      // Subtle background to indicate this is a help visualization
      frame: {
        fill: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.05)',
      },
    }
  }, [isDark])

  // Compute visibility - hidden when no changes and not animating
  const isHidden = !hasChanges && visibilityState !== 'waiting' && visibilityState !== 'exiting'
  const isEntering = visibilityState === 'entering'
  const isExiting = visibilityState === 'exiting'
  const shouldHide = isEntering || isExiting || isHidden

  return (
    <div
      data-component="help-abacus"
      data-visibility={visibilityState}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
        // Animation properties
        transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
        opacity: shouldHide ? 0 : 1,
        transform: shouldHide ? 'translateY(-10px)' : 'translateY(0)',
        // Disable interaction when hidden/transitioning
        pointerEvents: shouldHide ? 'none' : 'auto',
      })}
    >
      {/* Summary instruction */}
      {showSummary && summary && (
        <div
          data-element="help-summary"
          className={css({
            padding: '0.5rem 1rem',
            backgroundColor: isDark ? 'blue.900' : 'blue.50',
            borderRadius: '8px',
            fontSize: '0.875rem',
            color: isDark ? 'blue.200' : 'blue.700',
            fontWeight: 'medium',
            textAlign: 'center',
          })}
        >
          💡 {summary}
        </div>
      )}

      {/* The abacus with bead arrows - uses defaultValue for uncontrolled mode */}
      <div
        className={css({
          padding: '1rem',
          backgroundColor: isDark ? 'gray.800' : 'white',
          borderRadius: '12px',
          border: '2px solid',
          borderColor: isDark ? 'blue.700' : 'blue.200',
          boxShadow: 'md',
        })}
      >
        <AbacusReact
          defaultValue={currentValue}
          columns={columns}
          interactive={interactive}
          animated={true}
          scaleFactor={scaleFactor}
          colorScheme={abacusConfig.colorScheme}
          beadShape={abacusConfig.beadShape}
          hideInactiveBeads={abacusConfig.hideInactiveBeads}
          showNumbers={false} // Hide numerals to keep display tight
          soundEnabled={false} // Disable sound in help mode
          stepBeadHighlights={isAtTarget ? undefined : stepBeadHighlights}
          currentStep={currentStep}
          showDirectionIndicators={!isAtTarget}
          customStyles={customStyles}
          onValueChange={handleValueChange}
          onValueChangeComplete={handleValueChangeComplete}
          overlays={overlays}
        />
      </div>

      {/* Value labels */}
      {showValueLabels && (
        <div
          className={css({
            display: 'flex',
            justifyContent: 'center',
            gap: '2rem',
            fontSize: '0.875rem',
          })}
        >
          <div
            className={css({
              color: isAtTarget
                ? isDark
                  ? 'green.400'
                  : 'green.600'
                : isDark
                  ? 'gray.400'
                  : 'gray.600',
            })}
          >
            Current:{' '}
            <span
              className={css({
                fontWeight: 'bold',
                color: isAtTarget
                  ? isDark
                    ? 'green.300'
                    : 'green.700'
                  : isDark
                    ? 'gray.200'
                    : 'gray.800',
              })}
            >
              {displayedValue}
            </span>
          </div>
          <div
            className={css({
              color: isAtTarget
                ? isDark
                  ? 'green.400'
                  : 'green.600'
                : isDark
                  ? 'blue.400'
                  : 'blue.600',
            })}
          >
            Target:{' '}
            <span
              className={css({
                fontWeight: 'bold',
                color: isAtTarget
                  ? isDark
                    ? 'green.300'
                    : 'green.700'
                  : isDark
                    ? 'blue.300'
                    : 'blue.800',
              })}
            >
              {targetValue}
            </span>
          </div>
        </div>
      )}

      {/* Success feedback when target reached */}
      {showTargetReached && isAtTarget && (
        <div
          data-element="target-reached"
          className={css({
            padding: '0.5rem 1rem',
            backgroundColor: isDark ? 'green.900' : 'green.100',
            borderRadius: '8px',
            fontSize: '0.875rem',
            color: isDark ? 'green.200' : 'green.700',
            fontWeight: 'bold',
            textAlign: 'center',
          })}
        >
          ✓ Perfect! Moving to next term...
        </div>
      )}
    </div>
  )
}

export default HelpAbacus
