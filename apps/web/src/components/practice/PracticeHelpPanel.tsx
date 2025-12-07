'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import type { HelpLevel } from '@/db/schema/session-plans'
import type { PracticeHelpState } from '@/hooks/usePracticeHelp'
import { generateUnifiedInstructionSequence } from '@/utils/unifiedStepGenerator'
import { css } from '../../../styled-system/css'
import { DecompositionDisplay, DecompositionProvider } from '../decomposition'
import { HelpAbacus } from './HelpAbacus'

/**
 * Generate a dynamic coach hint based on the current step
 */
function generateDynamicCoachHint(
  sequence: ReturnType<typeof generateUnifiedInstructionSequence> | null,
  currentStepIndex: number,
  abacusValue: number,
  targetValue: number
): string {
  if (!sequence || sequence.steps.length === 0) {
    return 'Take your time and think through each step.'
  }

  // Check if we're done
  if (abacusValue === targetValue) {
    return 'You did it! Move on to the next step.'
  }

  // Get the current step
  const currentStep = sequence.steps[currentStepIndex]
  if (!currentStep) {
    return 'Take your time and think through each step.'
  }

  // Find the segment this step belongs to
  const segment = sequence.segments.find((s) => s.id === currentStep.segmentId)

  // Use the segment's readable summary if available
  if (segment?.readable?.summary) {
    return segment.readable.summary
  }

  // Fall back to generating from the rule
  if (segment) {
    const rule = segment.plan[0]?.rule
    switch (rule) {
      case 'Direct':
        return `Add ${segment.digit} directly to the ${getPlaceName(segment.place)} column.`
      case 'FiveComplement':
        return `Think about friends of 5. What plus ${5 - segment.digit} makes 5?`
      case 'TenComplement':
        return `Think about friends of 10. What plus ${10 - segment.digit} makes 10?`
      case 'Cascade':
        return 'This will carry through multiple columns. Start from the left.'
      default:
        break
    }
  }

  // Fall back to english instruction from the step
  if (currentStep.englishInstruction) {
    return currentStep.englishInstruction
  }

  return 'Think about which beads need to move.'
}

/**
 * Get place name from place value
 */
function getPlaceName(place: number): string {
  switch (place) {
    case 0:
      return 'ones'
    case 1:
      return 'tens'
    case 2:
      return 'hundreds'
    case 3:
      return 'thousands'
    default:
      return `10^${place}`
  }
}

interface PracticeHelpPanelProps {
  /** Current help state from usePracticeHelp hook */
  helpState: PracticeHelpState
  /** Request help at a specific level */
  onRequestHelp: (level?: HelpLevel) => void
  /** Dismiss help (return to L0) */
  onDismissHelp: () => void
  /** Whether this is the abacus part (enables bead arrows at L3) */
  isAbacusPart?: boolean
  /** Current value on the abacus (for bead arrows at L3) */
  currentValue?: number
  /** Target value to reach (for bead arrows at L3) */
  targetValue?: number
}

/**
 * Help level labels for display
 */
const HELP_LEVEL_LABELS: Record<HelpLevel, string> = {
  0: 'No Help',
  1: 'Hint',
  2: 'Show Steps',
  3: 'Show Beads',
}

/**
 * Help level icons
 */
const HELP_LEVEL_ICONS: Record<HelpLevel, string> = {
  0: '💡',
  1: '💬',
  2: '📝',
  3: '🧮',
}

/**
 * PracticeHelpPanel - Progressive help display for practice sessions
 *
 * Shows escalating levels of help:
 * - L0: Just the "Need Help?" button
 * - L1: Coach hint (verbal guidance)
 * - L2: Mathematical decomposition with explanations
 * - L3: Bead movement arrows (for abacus part)
 */
export function PracticeHelpPanel({
  helpState,
  onRequestHelp,
  onDismissHelp,
  isAbacusPart = false,
  currentValue,
  targetValue,
}: PracticeHelpPanelProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { currentLevel, content, isAvailable, maxLevelUsed } = helpState
  const [isExpanded, setIsExpanded] = useState(false)

  // Track current abacus value for step synchronization
  const [abacusValue, setAbacusValue] = useState(currentValue ?? 0)

  // Generate the decomposition steps to determine current step from abacus value
  const sequence = useMemo(() => {
    if (currentValue === undefined || targetValue === undefined) return null
    return generateUnifiedInstructionSequence(currentValue, targetValue)
  }, [currentValue, targetValue])

  // Calculate which step the user is on based on abacus value
  // Find the highest step index where expectedValue <= abacusValue
  const currentStepIndex = useMemo(() => {
    if (!sequence || sequence.steps.length === 0) return 0
    if (currentValue === undefined) return 0

    // Start value is the value before any steps
    const startVal = currentValue

    // If abacus is still at start value, we're at step 0
    if (abacusValue === startVal) return 0

    // Find which step we're on by checking expected values
    // The step index to highlight is the one we're working toward (next incomplete step)
    for (let i = 0; i < sequence.steps.length; i++) {
      const step = sequence.steps[i]
      // If abacus value is less than this step's expected value, we're working on this step
      if (abacusValue < step.expectedValue) {
        return i
      }
      // If we've reached or passed this step's expected value, check next step
      if (abacusValue === step.expectedValue) {
        // We've completed this step, move to next
        return Math.min(i + 1, sequence.steps.length - 1)
      }
    }

    // At or past target - show last step as complete
    return sequence.steps.length - 1
  }, [sequence, abacusValue, currentValue])

  // Generate dynamic coach hint based on current step
  const dynamicCoachHint = useMemo(() => {
    return generateDynamicCoachHint(sequence, currentStepIndex, abacusValue, targetValue ?? 0)
  }, [sequence, currentStepIndex, abacusValue, targetValue])

  // Handle abacus value changes
  const handleAbacusValueChange = useCallback((newValue: number) => {
    setAbacusValue(newValue)
  }, [])

  // Calculate effective level here so handleRequestHelp can use it
  // (effectiveLevel treats L0 as L1 since we auto-show help on prefix sum detection)
  const effectiveLevel = currentLevel === 0 ? 1 : currentLevel

  const handleRequestHelp = useCallback(() => {
    // Always request the next level above effectiveLevel
    if (effectiveLevel < 3) {
      onRequestHelp((effectiveLevel + 1) as HelpLevel)
      setIsExpanded(true)
    }
  }, [effectiveLevel, onRequestHelp])

  const handleDismiss = useCallback(() => {
    onDismissHelp()
    setIsExpanded(false)
  }, [onDismissHelp])

  // Don't render if help is not available (e.g., sequence generation failed)
  if (!isAvailable) {
    return null
  }

  // Levels 1-3: Show the help content (effectiveLevel is calculated above)
  return (
    <div
      data-component="practice-help-panel"
      data-level={effectiveLevel}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '1rem',
        backgroundColor: isDark ? 'blue.900' : 'blue.50',
        borderRadius: '12px',
        border: '2px solid',
        borderColor: isDark ? 'blue.700' : 'blue.200',
      })}
    >
      {/* Header with level indicator */}
      <div
        data-element="help-header"
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        })}
      >
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          })}
        >
          <span className={css({ fontSize: '1.25rem' })}>{HELP_LEVEL_ICONS[effectiveLevel]}</span>
          <span
            className={css({
              fontSize: '0.875rem',
              fontWeight: 'bold',
              color: isDark ? 'blue.200' : 'blue.700',
            })}
          >
            {HELP_LEVEL_LABELS[effectiveLevel]}
          </span>
          {/* Help level indicator dots */}
          <div
            className={css({
              display: 'flex',
              gap: '0.25rem',
              marginLeft: '0.5rem',
            })}
          >
            {[1, 2, 3].map((level) => (
              <div
                key={level}
                className={css({
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor:
                    level <= effectiveLevel ? 'blue.500' : isDark ? 'blue.700' : 'blue.200',
                })}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          data-action="dismiss-help"
          onClick={handleDismiss}
          className={css({
            padding: '0.25rem 0.5rem',
            fontSize: '0.75rem',
            color: isDark ? 'gray.400' : 'gray.500',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            _hover: {
              color: isDark ? 'gray.200' : 'gray.700',
            },
          })}
        >
          ✕ Hide
        </button>
      </div>

      {/* Level 1: Coach hint - uses dynamic hint that updates with abacus progress */}
      {effectiveLevel >= 1 && dynamicCoachHint && (
        <div
          data-element="coach-hint"
          data-step-index={currentStepIndex}
          className={css({
            padding: '0.75rem',
            backgroundColor: isDark ? 'gray.800' : 'white',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: isDark ? 'blue.800' : 'blue.100',
          })}
        >
          <p
            className={css({
              fontSize: '1rem',
              color: isDark ? 'gray.300' : 'gray.700',
              lineHeight: '1.5',
            })}
          >
            {dynamicCoachHint}
          </p>
        </div>
      )}

      {/* Level 2: Decomposition */}
      {effectiveLevel >= 2 &&
        content?.decomposition &&
        content.decomposition.isMeaningful &&
        currentValue !== undefined &&
        targetValue !== undefined && (
          <div
            data-element="decomposition-container"
            className={css({
              padding: '0.75rem',
              backgroundColor: isDark ? 'gray.800' : 'white',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: isDark ? 'blue.800' : 'blue.100',
            })}
          >
            <div
              className={css({
                fontSize: '0.75rem',
                fontWeight: 'bold',
                color: isDark ? 'blue.300' : 'blue.600',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
              })}
            >
              Step-by-Step
            </div>
            <div
              data-element="decomposition-display"
              className={css({
                fontFamily: 'monospace',
                fontSize: '1.125rem',
                color: isDark ? 'gray.100' : 'gray.800',
                wordBreak: 'break-word',
              })}
            >
              <DecompositionProvider
                startValue={currentValue}
                targetValue={targetValue}
                currentStepIndex={currentStepIndex}
                abacusColumns={3}
              >
                <DecompositionDisplay />
              </DecompositionProvider>
            </div>
          </div>
        )}

      {/* Level 3: Visual abacus with bead arrows */}
      {effectiveLevel >= 3 && currentValue !== undefined && targetValue !== undefined && (
        <div
          data-element="help-abacus"
          className={css({
            padding: '0.75rem',
            backgroundColor: isDark ? 'gray.800' : 'white',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: isDark ? 'purple.700' : 'purple.200',
          })}
        >
          <div
            className={css({
              fontSize: '0.75rem',
              fontWeight: 'bold',
              color: isDark ? 'purple.300' : 'purple.600',
              marginBottom: '0.75rem',
              textTransform: 'uppercase',
              textAlign: 'center',
            })}
          >
            🧮 Follow the Arrows
          </div>

          <HelpAbacus
            currentValue={currentValue}
            targetValue={targetValue}
            columns={3}
            scaleFactor={1.0}
            interactive={true}
            onValueChange={handleAbacusValueChange}
          />

          {isAbacusPart && (
            <div
              className={css({
                marginTop: '0.75rem',
                padding: '0.5rem',
                backgroundColor: isDark ? 'purple.900' : 'purple.50',
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: isDark ? 'purple.200' : 'purple.700',
                textAlign: 'center',
              })}
            >
              Try following these movements on your physical abacus
            </div>
          )}
        </div>
      )}

      {/* Fallback: Text bead steps if abacus values not provided */}
      {effectiveLevel >= 3 &&
        (currentValue === undefined || targetValue === undefined) &&
        content?.beadSteps &&
        content.beadSteps.length > 0 && (
          <div
            data-element="bead-steps-text"
            className={css({
              padding: '0.75rem',
              backgroundColor: isDark ? 'gray.800' : 'white',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: isDark ? 'blue.800' : 'blue.100',
            })}
          >
            <div
              className={css({
                fontSize: '0.75rem',
                fontWeight: 'bold',
                color: isDark ? 'purple.300' : 'purple.600',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
              })}
            >
              Bead Movements
            </div>
            <ol
              className={css({
                listStyle: 'decimal',
                paddingLeft: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              })}
            >
              {content.beadSteps.map((step, index) => (
                <li
                  key={index}
                  className={css({
                    fontSize: '0.875rem',
                    color: isDark ? 'gray.300' : 'gray.700',
                  })}
                >
                  <span
                    className={css({
                      fontWeight: 'bold',
                      color: isDark ? 'purple.300' : 'purple.700',
                    })}
                  >
                    {step.mathematicalTerm}
                  </span>
                  {step.englishInstruction && (
                    <span className={css({ color: isDark ? 'gray.400' : 'gray.600' })}>
                      {' '}
                      — {step.englishInstruction}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

      {/* More help button (if not at max level) */}
      {effectiveLevel < 3 && (
        <button
          type="button"
          data-action="escalate-help"
          onClick={handleRequestHelp}
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            width: '100%',
            padding: '0.5rem',
            fontSize: '0.875rem',
            color: isDark ? 'blue.300' : 'blue.600',
            backgroundColor: isDark ? 'gray.800' : 'white',
            border: '1px solid',
            borderColor: isDark ? 'blue.700' : 'blue.200',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            _hover: {
              backgroundColor: isDark ? 'gray.700' : 'blue.50',
            },
          })}
        >
          <span>{HELP_LEVEL_ICONS[(effectiveLevel + 1) as HelpLevel]}</span>
          <span>More Help: {HELP_LEVEL_LABELS[(effectiveLevel + 1) as HelpLevel]}</span>
        </button>
      )}

      {/* Max level indicator */}
      {maxLevelUsed > 0 && (
        <div
          className={css({
            fontSize: '0.75rem',
            color: isDark ? 'gray.500' : 'gray.400',
            textAlign: 'center',
          })}
        >
          Help used: Level {maxLevelUsed}
        </div>
      )}
    </div>
  )
}

export default PracticeHelpPanel
