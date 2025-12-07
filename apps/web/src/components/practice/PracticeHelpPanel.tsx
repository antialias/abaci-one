'use client'

import { useCallback, useState } from 'react'
import type { HelpLevel } from '@/db/schema/session-plans'
import type { PracticeHelpState } from '@/hooks/usePracticeHelp'
import { css } from '../../../styled-system/css'
import { HelpAbacus } from './HelpAbacus'

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
  const { currentLevel, content, isAvailable, maxLevelUsed } = helpState
  const [isExpanded, setIsExpanded] = useState(false)

  const handleRequestHelp = useCallback(() => {
    if (currentLevel === 0) {
      onRequestHelp(1)
      setIsExpanded(true)
    } else if (currentLevel < 3) {
      onRequestHelp((currentLevel + 1) as HelpLevel)
    }
  }, [currentLevel, onRequestHelp])

  const handleDismiss = useCallback(() => {
    onDismissHelp()
    setIsExpanded(false)
  }, [onDismissHelp])

  // Don't render if help is not available (e.g., sequence generation failed)
  if (!isAvailable) {
    return null
  }

  // Level 0: Just show the help request button
  if (currentLevel === 0) {
    return (
      <div
        data-component="practice-help-panel"
        data-level={0}
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        })}
      >
        <button
          type="button"
          data-action="request-help"
          onClick={handleRequestHelp}
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            width: '100%',
            padding: '0.75rem',
            fontSize: '0.875rem',
            color: 'blue.600',
            backgroundColor: 'blue.50',
            border: '1px solid',
            borderColor: 'blue.200',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            _hover: {
              backgroundColor: 'blue.100',
              borderColor: 'blue.300',
            },
          })}
        >
          <span>💡</span>
          <span>Need Help?</span>
        </button>
      </div>
    )
  }

  // Levels 1-3: Show the help content
  return (
    <div
      data-component="practice-help-panel"
      data-level={currentLevel}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '1rem',
        backgroundColor: 'blue.50',
        borderRadius: '12px',
        border: '2px solid',
        borderColor: 'blue.200',
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
          <span className={css({ fontSize: '1.25rem' })}>{HELP_LEVEL_ICONS[currentLevel]}</span>
          <span
            className={css({
              fontSize: '0.875rem',
              fontWeight: 'bold',
              color: 'blue.700',
            })}
          >
            {HELP_LEVEL_LABELS[currentLevel]}
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
                  backgroundColor: level <= currentLevel ? 'blue.500' : 'blue.200',
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
            color: 'gray.500',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            _hover: {
              color: 'gray.700',
            },
          })}
        >
          ✕ Hide
        </button>
      </div>

      {/* Level 1: Coach hint */}
      {currentLevel >= 1 && content?.coachHint && (
        <div
          data-element="coach-hint"
          className={css({
            padding: '0.75rem',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: 'blue.100',
          })}
        >
          <p
            className={css({
              fontSize: '1rem',
              color: 'gray.700',
              lineHeight: '1.5',
            })}
          >
            {content.coachHint}
          </p>
        </div>
      )}

      {/* Level 2: Decomposition */}
      {currentLevel >= 2 && content?.decomposition && content.decomposition.isMeaningful && (
        <div
          data-element="decomposition"
          className={css({
            padding: '0.75rem',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: 'blue.100',
          })}
        >
          <div
            className={css({
              fontSize: '0.75rem',
              fontWeight: 'bold',
              color: 'blue.600',
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
            })}
          >
            Step-by-Step
          </div>
          <div
            className={css({
              fontFamily: 'monospace',
              fontSize: '1.125rem',
              color: 'gray.800',
              wordBreak: 'break-word',
            })}
          >
            {content.decomposition.fullDecomposition}
          </div>

          {/* Segment explanations */}
          {content.decomposition.segments.length > 0 && (
            <div
              className={css({
                marginTop: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              })}
            >
              {content.decomposition.segments.map((segment) => (
                <div
                  key={segment.id}
                  className={css({
                    padding: '0.5rem',
                    backgroundColor: 'gray.50',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                  })}
                >
                  <span
                    className={css({
                      fontWeight: 'bold',
                      color: 'gray.700',
                    })}
                  >
                    {segment.readable?.title || `Column ${segment.place + 1}`}:
                  </span>{' '}
                  <span className={css({ color: 'gray.600' })}>
                    {segment.readable?.summary || segment.expression}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Level 3: Visual abacus with bead arrows */}
      {currentLevel >= 3 && currentValue !== undefined && targetValue !== undefined && (
        <div
          data-element="help-abacus"
          className={css({
            padding: '0.75rem',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: 'purple.200',
          })}
        >
          <div
            className={css({
              fontSize: '0.75rem',
              fontWeight: 'bold',
              color: 'purple.600',
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
          />

          {isAbacusPart && (
            <div
              className={css({
                marginTop: '0.75rem',
                padding: '0.5rem',
                backgroundColor: 'purple.50',
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: 'purple.700',
                textAlign: 'center',
              })}
            >
              Try following these movements on your physical abacus
            </div>
          )}
        </div>
      )}

      {/* Fallback: Text bead steps if abacus values not provided */}
      {currentLevel >= 3 &&
        (currentValue === undefined || targetValue === undefined) &&
        content?.beadSteps &&
        content.beadSteps.length > 0 && (
          <div
            data-element="bead-steps-text"
            className={css({
              padding: '0.75rem',
              backgroundColor: 'white',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: 'blue.100',
            })}
          >
            <div
              className={css({
                fontSize: '0.75rem',
                fontWeight: 'bold',
                color: 'purple.600',
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
                    color: 'gray.700',
                  })}
                >
                  <span
                    className={css({
                      fontWeight: 'bold',
                      color: 'purple.700',
                    })}
                  >
                    {step.mathematicalTerm}
                  </span>
                  {step.englishInstruction && (
                    <span className={css({ color: 'gray.600' })}> — {step.englishInstruction}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

      {/* More help button (if not at max level) */}
      {currentLevel < 3 && (
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
            color: 'blue.600',
            backgroundColor: 'white',
            border: '1px solid',
            borderColor: 'blue.200',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            _hover: {
              backgroundColor: 'blue.50',
            },
          })}
        >
          <span>{HELP_LEVEL_ICONS[(currentLevel + 1) as HelpLevel]}</span>
          <span>More Help: {HELP_LEVEL_LABELS[(currentLevel + 1) as HelpLevel]}</span>
        </button>
      )}

      {/* Max level indicator */}
      {maxLevelUsed > 0 && (
        <div
          className={css({
            fontSize: '0.75rem',
            color: 'gray.400',
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
