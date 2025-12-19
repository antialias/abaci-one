/**
 * Detailed Problem Card Component
 *
 * Shows a single problem with full debugging information:
 * - Problem display (vertical or linear based on part type)
 * - Per-term skill annotations with effective costs
 * - Total complexity cost
 * - Problem constraints (from slot)
 * - Auto-pause timing info
 * - Result (if completed)
 */

import type {
  GenerationTrace,
  GenerationTraceStep,
  ProblemSlot,
  SessionPart,
  SkillMasteryDisplay,
  SlotResult,
} from '@/db/schema/session-plans'
import { css } from '../../../styled-system/css'
import type { AutoPauseStats } from './autoPauseCalculator'
import { formatMs, getAutoPauseExplanation } from './autoPauseCalculator'

export interface DetailedProblemCardProps {
  /** The problem slot with constraints and generated problem */
  slot: ProblemSlot
  /** The session part this problem belongs to */
  part: SessionPart
  /** Result if the problem was answered */
  result?: SlotResult
  /** Auto-pause stats at this problem position */
  autoPauseStats?: AutoPauseStats
  /** Dark mode */
  isDark: boolean
  /** Problem index within the session (1-based for display) */
  problemNumber: number
}

/**
 * Get display label for slot purpose
 */
function getPurposeLabel(purpose: ProblemSlot['purpose']): {
  label: string
  emoji: string
  color: string
} {
  switch (purpose) {
    case 'focus':
      return { label: 'Focus', emoji: '🎯', color: 'blue' }
    case 'reinforce':
      return { label: 'Reinforce', emoji: '💪', color: 'green' }
    case 'review':
      return { label: 'Review', emoji: '📝', color: 'purple' }
    case 'challenge':
      return { label: 'Challenge', emoji: '⭐', color: 'orange' }
  }
}

/**
 * Get display label for part type
 */
function getPartTypeLabel(type: SessionPart['type']): string {
  switch (type) {
    case 'abacus':
      return 'Use Abacus'
    case 'visualization':
      return 'Mental Math (Visualization)'
    case 'linear':
      return 'Mental Math (Linear)'
  }
}

/**
 * Check if part type uses vertical layout
 */
function isVerticalPart(type: SessionPart['type']): boolean {
  return type === 'abacus' || type === 'visualization'
}

/**
 * Format constraints for display
 */
function formatConstraints(slot: ProblemSlot): string[] {
  const lines: string[] = []
  const c = slot.constraints

  if (c.termCount) {
    lines.push(`Terms: ${c.termCount.min}-${c.termCount.max}`)
  }
  if (c.digitRange) {
    lines.push(`Digits: ${c.digitRange.min}-${c.digitRange.max}`)
  }
  if (slot.complexityBounds) {
    const { min, max } = slot.complexityBounds
    if (min !== undefined && max !== undefined) {
      lines.push(`Budget: ${min}-${max}/term`)
    } else if (max !== undefined) {
      lines.push(`Max budget: ${max}/term`)
    } else if (min !== undefined) {
      lines.push(`Min budget: ${min}/term`)
    }
  }

  return lines
}

/**
 * Cell dimensions matching VerticalProblem.tsx
 */
const CELL_WIDTH = '1.4rem'
const CELL_HEIGHT = '1.8rem'

/**
 * Format a skill ID for human-readable display
 */
function formatSkillName(skillId: string): string {
  const parts = skillId.split('.')
  const category = parts[0]
  const specific = parts[1] || skillId

  // Make complement skills readable
  if (category === 'fiveComplements' || category === 'fiveComplementsSub') {
    return `5's complement: ${specific}`
  }
  if (category === 'tenComplements' || category === 'tenComplementsSub') {
    return `10's complement: ${specific}`
  }
  if (category === 'basic') {
    const names: Record<string, string> = {
      directAddition: 'Direct addition',
      heavenBead: 'Heaven bead',
      simpleCombinations: 'Simple combinations',
      directSubtraction: 'Direct subtraction',
      heavenBeadSubtraction: 'Heaven bead (sub)',
      simpleCombinationsSub: 'Simple combinations (sub)',
    }
    return names[specific] || specific
  }
  return specific
}

/**
 * Get mastery state label
 */
function getMasteryLabel(state: string): { label: string; color: string } {
  switch (state) {
    case 'effortless':
      return { label: 'Effortless', color: 'green' }
    case 'fluent':
      return { label: 'Fluent', color: 'blue' }
    case 'rusty':
      return { label: 'Rusty', color: 'yellow' }
    case 'practicing':
      return { label: 'Practicing', color: 'orange' }
    case 'not_practicing':
      return { label: 'Learning', color: 'red' }
    default:
      return { label: state, color: 'gray' }
  }
}

/**
 * Inline skill list - just the skills, no total (total is rendered separately for alignment)
 */
function InlineSkillList({
  step,
  skillMasteryContext,
  isDark,
}: {
  step: GenerationTraceStep
  skillMasteryContext?: Record<string, SkillMasteryDisplay>
  isDark: boolean
}) {
  const { skillsUsed } = step

  // No skills = starting value
  if (skillsUsed.length === 0) {
    return (
      <span
        className={css({
          fontSize: '0.75rem',
          color: isDark ? 'gray.500' : 'gray.400',
          fontStyle: 'italic',
        })}
      >
        (start)
      </span>
    )
  }

  return (
    <div
      data-element="inline-skill-list"
      className={css({
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.375rem',
        flex: 1,
      })}
    >
      {skillsUsed.map((skillId, i) => {
        const masteryInfo = skillMasteryContext?.[skillId]
        const baseCost = masteryInfo?.baseCost ?? 1
        const effectiveCost = masteryInfo?.effectiveCost ?? baseCost
        const masteryState = masteryInfo?.masteryState
        const mastery = masteryState ? getMasteryLabel(masteryState) : null
        const hasMultiplier = mastery && effectiveCost !== baseCost
        const isZeroCost = effectiveCost === 0

        return (
          <span
            key={i}
            data-element="skill-pill"
            data-zero-cost={isZeroCost || undefined}
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.125rem 0.5rem',
              backgroundColor: isDark ? 'gray.800' : 'gray.100',
              borderRadius: '9999px',
              fontSize: '0.6875rem',
              whiteSpace: 'nowrap',
              opacity: isZeroCost ? 0.75 : 1,
            })}
          >
            <span className={css({ color: isDark ? 'gray.300' : 'gray.600' })}>
              {formatSkillName(skillId)}
            </span>
            <span
              className={css({
                fontWeight: 'bold',
                color: isDark ? 'blue.300' : 'blue.600',
              })}
            >
              {effectiveCost}
            </span>
            {hasMultiplier && (
              <span
                className={css({
                  color: isDark ? 'gray.500' : 'gray.400',
                  fontSize: '0.625rem',
                })}
              >
                ({baseCost}×{effectiveCost / baseCost})
              </span>
            )}
            {mastery && (
              <span
                className={css({
                  padding: '0 0.25rem',
                  borderRadius: '4px',
                  fontSize: '0.5625rem',
                  backgroundColor: isDark ? `${mastery.color}.900` : `${mastery.color}.100`,
                  color: isDark ? `${mastery.color}.300` : `${mastery.color}.600`,
                })}
              >
                {mastery.label}
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}

/**
 * Term total badge - rendered separately for alignment
 */
function TermTotalBadge({
  cost,
  maxBudget,
  minBudget,
  isFirstTerm,
  isDark,
}: {
  cost: number | undefined
  maxBudget?: number
  minBudget?: number
  isFirstTerm: boolean
  isDark: boolean
}) {
  if (cost === undefined) return null

  const isOverBudget = maxBudget !== undefined && cost > maxBudget
  const isUnderBudget = minBudget !== undefined && cost < minBudget && !isFirstTerm
  const budgetStatus = isOverBudget ? 'over' : isUnderBudget ? 'under' : 'ok'
  const isZeroCost = cost === 0

  return (
    <span
      data-element="term-total"
      data-zero-cost={isZeroCost || undefined}
      className={css({
        opacity: isZeroCost ? 0.75 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '2.5rem',
        padding: '0.25rem 0.5rem',
        borderRadius: '4px',
        fontSize: '0.875rem',
        fontWeight: 'bold',
        fontFamily: 'var(--font-mono, monospace)',
        border: '2px solid',
        backgroundColor:
          budgetStatus === 'over'
            ? isDark
              ? 'red.900'
              : 'red.50'
            : budgetStatus === 'under'
              ? isDark
                ? 'yellow.900'
                : 'yellow.50'
              : isDark
                ? 'green.900'
                : 'green.50',
        borderColor:
          budgetStatus === 'over'
            ? isDark
              ? 'red.600'
              : 'red.300'
            : budgetStatus === 'under'
              ? isDark
                ? 'yellow.600'
                : 'yellow.300'
              : isDark
                ? 'green.600'
                : 'green.300',
        color:
          budgetStatus === 'over'
            ? isDark
              ? 'red.300'
              : 'red.700'
            : budgetStatus === 'under'
              ? isDark
                ? 'yellow.300'
                : 'yellow.700'
              : isDark
                ? 'green.300'
                : 'green.700',
      })}
    >
      {cost}
      {budgetStatus === 'over' && '!'}
      {budgetStatus === 'under' && '↓'}
    </span>
  )
}

/**
 * Render vertical problem display with skill annotations
 * Compact layout: one line per term, fits more on screen
 */
function DetailedVerticalProblem({
  terms,
  answer,
  trace,
  maxBudget,
  minBudget,
  isDark,
  result,
}: {
  terms: number[]
  answer: number
  trace?: GenerationTrace
  maxBudget?: number
  minBudget?: number
  isDark: boolean
  result?: SlotResult
}) {
  // Calculate max digits for alignment
  const maxDigits = Math.max(
    ...terms.map((t) => Math.abs(t).toString().length),
    Math.abs(answer).toString().length
  )

  const hasTrace = trace && trace.steps.length > 0

  return (
    <div
      data-element="detailed-vertical-problem"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
      })}
    >
      {/* Terms - compact single line each */}
      {terms.map((term, i) => {
        const isNegative = term < 0
        const absValue = Math.abs(term)
        const digits = absValue.toString().padStart(maxDigits, ' ').split('')
        const step = trace?.steps[i]

        return (
          <div
            key={i}
            data-element="term-row"
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              backgroundColor:
                i % 2 === 0
                  ? isDark
                    ? 'rgba(255,255,255,0.02)'
                    : 'rgba(0,0,0,0.015)'
                  : 'transparent',
            })}
          >
            {/* Term display */}
            <div
              data-element="term-display"
              className={css({
                display: 'flex',
                alignItems: 'center',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '1.25rem',
                fontWeight: 'bold',
                flexShrink: 0,
              })}
            >
              {/* Operator */}
              <span
                className={css({
                  width: '1.25rem',
                  textAlign: 'center',
                  color:
                    i === 0
                      ? 'transparent'
                      : isNegative
                        ? isDark
                          ? 'red.400'
                          : 'red.600'
                        : isDark
                          ? 'green.400'
                          : 'green.600',
                })}
              >
                {i === 0 ? '' : isNegative ? '−' : '+'}
              </span>
              {/* Digits */}
              {digits.map((digit, di) => (
                <span
                  key={di}
                  className={css({
                    width: '0.9rem',
                    textAlign: 'center',
                    color: isDark ? 'gray.100' : 'gray.900',
                  })}
                >
                  {digit}
                </span>
              ))}
            </div>

            {/* Vertical separator */}
            {hasTrace && (
              <div
                className={css({
                  width: '2px',
                  height: '1.25rem',
                  backgroundColor: step
                    ? isDark
                      ? 'blue.600'
                      : 'blue.400'
                    : isDark
                      ? 'gray.700'
                      : 'gray.300',
                  flexShrink: 0,
                })}
              />
            )}

            {/* Skill breakdown - inline (no total, that's separate) */}
            {hasTrace && (
              <InlineSkillList
                step={
                  step ?? {
                    termAdded: term,
                    skillsUsed: [],
                    runningTotal: term,
                  }
                }
                skillMasteryContext={trace.skillMasteryContext}
                isDark={isDark}
              />
            )}

            {/* Term total - in its own column for alignment */}
            {hasTrace && step && (
              <TermTotalBadge
                cost={step.complexityCost}
                maxBudget={maxBudget}
                minBudget={minBudget}
                isFirstTerm={i === 0}
                isDark={isDark}
              />
            )}
          </div>
        )
      })}

      {/* Separator line */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.125rem 0.5rem',
        })}
      >
        <div
          className={css({
            width: `calc(1.25rem + ${maxDigits} * 0.9rem)`,
            height: '2px',
            backgroundColor: isDark ? 'gray.500' : 'gray.400',
          })}
        />
      </div>

      {/* Answer row */}
      <div
        data-element="answer-row"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          backgroundColor: result
            ? result.isCorrect
              ? isDark
                ? 'green.900/40'
                : 'green.50'
              : isDark
                ? 'red.900/40'
                : 'red.50'
            : 'transparent',
        })}
      >
        {/* Answer display */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            flexShrink: 0,
          })}
        >
          <span
            className={css({
              width: '1.25rem',
              textAlign: 'center',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            =
          </span>
          {Math.abs(answer)
            .toString()
            .padStart(maxDigits, ' ')
            .split('')
            .map((digit, di) => (
              <span
                key={di}
                className={css({
                  width: '0.9rem',
                  textAlign: 'center',
                  color: result
                    ? result.isCorrect
                      ? isDark
                        ? 'green.300'
                        : 'green.700'
                      : isDark
                        ? 'red.300'
                        : 'red.700'
                    : isDark
                      ? 'gray.100'
                      : 'gray.900',
                })}
              >
                {digit}
              </span>
            ))}
        </div>

        {/* Vertical separator - same as term rows */}
        {hasTrace && (
          <div
            className={css({
              width: '2px',
              height: '1.25rem',
              backgroundColor: isDark ? 'blue.600' : 'blue.400',
              flexShrink: 0,
            })}
          />
        )}

        {/* Result indicator - takes up flexible space */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flex: 1,
          })}
        >
          {result && (
            <>
              <span
                className={css({
                  fontSize: '1rem',
                  color: result.isCorrect
                    ? isDark
                      ? 'green.400'
                      : 'green.600'
                    : isDark
                      ? 'red.400'
                      : 'red.600',
                })}
              >
                {result.isCorrect ? '✓' : '✗'}
              </span>
              {!result.isCorrect && (
                <span
                  className={css({
                    fontSize: '0.875rem',
                    color: isDark ? 'red.400' : 'red.500',
                    textDecoration: 'line-through',
                  })}
                >
                  {result.studentAnswer}
                </span>
              )}
            </>
          )}
        </div>

        {/* Grand total - aligned with term totals */}
        {hasTrace && trace.totalComplexityCost !== undefined && (
          <span
            data-element="grand-total"
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '2.5rem',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.875rem',
              fontWeight: 'bold',
              fontFamily: 'var(--font-mono, monospace)',
              border: '2px solid',
              backgroundColor: isDark ? 'blue.900' : 'blue.50',
              borderColor: isDark ? 'blue.600' : 'blue.300',
              color: isDark ? 'blue.200' : 'blue.700',
            })}
          >
            Σ{trace.totalComplexityCost}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Render linear problem display with skill annotations
 * Compact layout: equation header + one line per term
 */
function DetailedLinearProblem({
  terms,
  answer,
  trace,
  maxBudget,
  minBudget,
  isDark,
  result,
}: {
  terms: number[]
  answer: number
  trace?: GenerationTrace
  maxBudget?: number
  minBudget?: number
  isDark: boolean
  result?: SlotResult
}) {
  const equation = terms
    .map((term, i) => {
      if (i === 0) return String(term)
      return term < 0 ? ` − ${Math.abs(term)}` : ` + ${term}`
    })
    .join('')

  const hasTrace = trace && trace.steps.length > 0

  return (
    <div
      data-element="detailed-linear-problem"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.375rem',
      })}
    >
      {/* Equation header - compact */}
      <div
        data-element="equation-section"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.375rem 0.5rem',
          borderRadius: '6px',
          backgroundColor: result
            ? result.isCorrect
              ? isDark
                ? 'green.900/40'
                : 'green.50'
              : isDark
                ? 'red.900/40'
                : 'red.50'
            : isDark
              ? 'gray.800/50'
              : 'gray.50',
          flexWrap: 'wrap',
        })}
      >
        {/* Equation */}
        <div
          className={css({
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '1.25rem',
            fontWeight: 'bold',
          })}
        >
          <span className={css({ color: isDark ? 'gray.200' : 'gray.800' })}>{equation} = </span>
          <span
            className={css({
              color: result
                ? result.isCorrect
                  ? isDark
                    ? 'green.300'
                    : 'green.700'
                  : isDark
                    ? 'red.300'
                    : 'red.700'
                : isDark
                  ? 'gray.100'
                  : 'gray.900',
            })}
          >
            {answer}
          </span>
        </div>

        {/* Result indicator */}
        {result && (
          <>
            <span
              className={css({
                fontSize: '1rem',
                color: result.isCorrect
                  ? isDark
                    ? 'green.400'
                    : 'green.600'
                  : isDark
                    ? 'red.400'
                    : 'red.600',
              })}
            >
              {result.isCorrect ? '✓' : '✗'}
            </span>
            {!result.isCorrect && (
              <span
                className={css({
                  fontSize: '0.875rem',
                  color: isDark ? 'red.400' : 'red.500',
                  textDecoration: 'line-through',
                })}
              >
                {result.studentAnswer}
              </span>
            )}
          </>
        )}
      </div>

      {/* Per-term skill breakdown - compact rows */}
      {hasTrace && (
        <div
          data-element="term-breakdown"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          })}
        >
          {trace.steps.map((step, i) => (
            <div
              key={i}
              data-element="term-row"
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                backgroundColor:
                  i % 2 === 0
                    ? isDark
                      ? 'rgba(255,255,255,0.02)'
                      : 'rgba(0,0,0,0.015)'
                    : 'transparent',
              })}
            >
              {/* Term value - compact */}
              <div
                data-element="term-label"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  flexShrink: 0,
                })}
              >
                <span
                  className={css({
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    color:
                      i === 0
                        ? isDark
                          ? 'gray.300'
                          : 'gray.700'
                        : step.termAdded >= 0
                          ? isDark
                            ? 'green.400'
                            : 'green.600'
                          : isDark
                            ? 'red.400'
                            : 'red.600',
                    minWidth: '3.5rem',
                    textAlign: 'right',
                  })}
                >
                  {i === 0
                    ? step.termAdded
                    : step.termAdded >= 0
                      ? `+${step.termAdded}`
                      : step.termAdded}
                </span>
              </div>

              {/* Vertical separator */}
              <div
                className={css({
                  width: '2px',
                  height: '1.25rem',
                  backgroundColor: isDark ? 'blue.600' : 'blue.400',
                  flexShrink: 0,
                })}
              />

              {/* Skill breakdown - inline (no total) */}
              <InlineSkillList
                step={step}
                skillMasteryContext={trace.skillMasteryContext}
                isDark={isDark}
              />

              {/* Term total - separate for alignment */}
              <TermTotalBadge
                cost={step.complexityCost}
                maxBudget={maxBudget}
                minBudget={minBudget}
                isFirstTerm={i === 0}
                isDark={isDark}
              />
            </div>
          ))}

          {/* Summary row with grand total - aligned with term totals */}
          {trace.totalComplexityCost !== undefined && (
            <div
              data-element="summary-row"
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                marginTop: '0.25rem',
                borderTop: '2px solid',
                borderColor: isDark ? 'gray.600' : 'gray.300',
              })}
            >
              {/* Spacer for term column */}
              <div className={css({ minWidth: '3.5rem' })} />

              {/* Vertical separator */}
              <div
                className={css({
                  width: '2px',
                  height: '1.25rem',
                  backgroundColor: isDark ? 'blue.600' : 'blue.400',
                  flexShrink: 0,
                })}
              />

              {/* Label takes flexible space */}
              <div
                className={css({
                  flex: 1,
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  color: isDark ? 'gray.400' : 'gray.600',
                })}
              >
                Total complexity
              </div>

              {/* Grand total - aligned with term totals */}
              <span
                data-element="grand-total"
                className={css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '2.5rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  fontFamily: 'var(--font-mono, monospace)',
                  border: '2px solid',
                  backgroundColor: isDark ? 'blue.900' : 'blue.50',
                  borderColor: isDark ? 'blue.600' : 'blue.300',
                  color: isDark ? 'blue.200' : 'blue.700',
                })}
              >
                Σ{trace.totalComplexityCost}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function DetailedProblemCard({
  slot,
  part,
  result,
  autoPauseStats,
  isDark,
  problemNumber,
}: DetailedProblemCardProps) {
  const problem = slot.problem
  const {
    label: purposeLabel,
    emoji: purposeEmoji,
    color: purposeColor,
  } = getPurposeLabel(slot.purpose)

  // Get budget constraints
  const maxBudget = slot.complexityBounds?.max ?? slot.constraints.maxComplexityBudgetPerTerm
  const minBudget = slot.complexityBounds?.min ?? slot.constraints.minComplexityBudgetPerTerm

  return (
    <div
      data-component="detailed-problem-card"
      data-purpose={slot.purpose}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '1rem',
        borderRadius: '8px',
        border: '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.200',
        backgroundColor: result
          ? result.isCorrect
            ? isDark
              ? 'green.900/30'
              : 'green.50'
            : isDark
              ? 'red.900/30'
              : 'red.50'
          : isDark
            ? 'gray.800'
            : 'white',
      })}
    >
      {/* Header */}
      <div
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
          <span
            className={css({
              fontWeight: 'bold',
              color: isDark ? 'gray.200' : 'gray.800',
            })}
          >
            #{problemNumber}
          </span>
          <span
            className={css({
              padding: '0.125rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: '500',
              backgroundColor: isDark ? `${purposeColor}.900` : `${purposeColor}.100`,
              color: isDark ? `${purposeColor}.200` : `${purposeColor}.700`,
            })}
          >
            {purposeEmoji} {purposeLabel}
          </span>
        </div>
      </div>

      {/* Problem display with annotations */}
      {problem && (
        <div className={css({ marginTop: '0.5rem' })}>
          {isVerticalPart(part.type) ? (
            <DetailedVerticalProblem
              terms={problem.terms}
              answer={problem.answer}
              trace={problem.generationTrace}
              maxBudget={maxBudget}
              minBudget={minBudget}
              isDark={isDark}
              result={result}
            />
          ) : (
            <DetailedLinearProblem
              terms={problem.terms}
              answer={problem.answer}
              trace={problem.generationTrace}
              maxBudget={maxBudget}
              minBudget={minBudget}
              isDark={isDark}
              result={result}
            />
          )}
        </div>
      )}

      {/* Constraints and timing info */}
      <div
        className={css({
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingTop: '0.5rem',
          borderTop: '1px dashed',
          borderColor: isDark ? 'gray.700' : 'gray.200',
          fontSize: '0.75rem',
          color: isDark ? 'gray.400' : 'gray.500',
        })}
      >
        {/* Constraints */}
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '0.125rem',
          })}
        >
          <span className={css({ fontWeight: 'bold' })}>Constraints:</span>
          {formatConstraints(slot).map((line, i) => (
            <span key={i}>{line}</span>
          ))}
          {formatConstraints(slot).length === 0 && <span>(none)</span>}
        </div>

        {/* Timing */}
        {autoPauseStats && (
          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '0.125rem',
            })}
          >
            <span className={css({ fontWeight: 'bold' })}>Auto-pause threshold:</span>
            <span>{formatMs(autoPauseStats.thresholdMs)}</span>
            <span className={css({ fontSize: '0.625rem', maxWidth: '200px' })}>
              {getAutoPauseExplanation(autoPauseStats)}
            </span>
          </div>
        )}

        {/* Result timing */}
        {result && (
          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '0.125rem',
            })}
          >
            <span className={css({ fontWeight: 'bold' })}>Response:</span>
            <span
              className={css({
                color:
                  autoPauseStats && result.responseTimeMs > autoPauseStats.thresholdMs
                    ? isDark
                      ? 'yellow.400'
                      : 'yellow.600'
                    : undefined,
              })}
            >
              {formatMs(result.responseTimeMs)}
              {autoPauseStats &&
                result.responseTimeMs > autoPauseStats.thresholdMs &&
                ' (over threshold)'}
            </span>
            {result.helpLevelUsed > 0 && <span>Help level: {result.helpLevelUsed}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
