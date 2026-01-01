/**
 * Annotated Problem Component
 *
 * Shows a problem in vertical format with optional skill annotations.
 * Used in ProblemToReview for both collapsed (simple) and expanded (annotated) views.
 *
 * Key features:
 * - Always renders in vertical format for consistency
 * - Expanded mode shows skill annotations next to each term
 * - Highlights weak skills with ⚠️ indicator
 * - Single problem representation (never duplicated)
 */

'use client'

import { css } from '../../../styled-system/css'
import type { GenerationTrace, SlotResult } from '@/db/schema/session-plans'
import type { SkillBktResult } from '@/lib/curriculum/bkt'
import { formatSkillLabel, isLikelyCause, type WeakSkillInfo } from './weakSkillUtils'

export interface AnnotatedProblemProps {
  /** Problem terms (positive for addition, negative for subtraction) */
  terms: number[]
  /** Correct answer */
  answer: number
  /** Student's submitted answer */
  studentAnswer: number
  /** Whether the student got it correct */
  isCorrect: boolean
  /** Generation trace with skill info for each term */
  trace?: GenerationTrace
  /** BKT mastery data for skills */
  skillMasteries?: Map<string, SkillBktResult> | Record<string, SkillBktResult>
  /** Whether to show expanded view with annotations */
  expanded?: boolean
  /** Dark mode */
  isDark: boolean
}

/**
 * Get mastery info for a skill
 */
function getSkillMasteryInfo(
  skillId: string,
  masteries: Map<string, SkillBktResult> | Record<string, SkillBktResult> | undefined
): WeakSkillInfo | null {
  if (!masteries) return null

  const masteryMap = masteries instanceof Map ? masteries : new Map(Object.entries(masteries))

  const bkt = masteryMap.get(skillId)
  if (!bkt) return null

  return {
    skillId,
    pKnown: bkt.pKnown,
    classification: bkt.masteryClassification,
    displayLabel: formatSkillLabel(skillId),
    masteryPercent: Math.round(bkt.pKnown * 100),
  }
}

/**
 * Skill tag with optional weak indicator
 */
function SkillTag({
  skillId,
  masteryInfo,
  isDark,
}: {
  skillId: string
  masteryInfo: WeakSkillInfo | null
  isDark: boolean
}) {
  const isWeak = masteryInfo ? isLikelyCause(masteryInfo) : false
  const label = formatSkillLabel(skillId)

  return (
    <span
      data-element="skill-tag"
      data-skill-id={skillId}
      data-is-weak={isWeak}
      className={css({
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.125rem 0.375rem',
        borderRadius: '4px',
        fontSize: '0.6875rem',
        fontWeight: '500',
        backgroundColor: isWeak
          ? isDark
            ? 'red.900/60'
            : 'red.100'
          : isDark
            ? 'gray.700'
            : 'gray.100',
        color: isWeak ? (isDark ? 'red.300' : 'red.700') : isDark ? 'gray.300' : 'gray.600',
      })}
    >
      {isWeak && (
        <span className={css({ fontSize: '0.625rem' })} aria-label="Weak skill">
          ⚠️
        </span>
      )}
      <span>{label}</span>
      {isWeak && (
        <span
          className={css({
            fontSize: '0.5625rem',
            fontStyle: 'italic',
            opacity: 0.8,
          })}
        >
          ← likely cause
        </span>
      )}
    </span>
  )
}

/**
 * Collapsed view - simple problem display without annotations
 */
function CollapsedProblemDisplay({
  terms,
  answer,
  studentAnswer,
  isCorrect,
  isDark,
}: {
  terms: number[]
  answer: number
  studentAnswer: number
  isCorrect: boolean
  isDark: boolean
}) {
  const maxDigits = Math.max(
    ...terms.map((t) => Math.abs(t).toString().length),
    Math.abs(answer).toString().length
  )

  return (
    <div
      data-element="collapsed-problem"
      className={css({
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: '0.875rem',
        fontWeight: 'bold',
        lineHeight: 1.2,
      })}
    >
      {terms.map((term, i) => (
        <div key={i} className={css({ display: 'flex', alignItems: 'center' })}>
          <span
            className={css({
              width: '1rem',
              textAlign: 'center',
              color:
                i === 0
                  ? 'transparent'
                  : term < 0
                    ? isDark
                      ? 'red.400'
                      : 'red.600'
                    : isDark
                      ? 'green.400'
                      : 'green.600',
            })}
          >
            {i === 0 ? '' : term < 0 ? '−' : '+'}
          </span>
          <span
            className={css({
              minWidth: `${maxDigits}ch`,
              textAlign: 'right',
              color: isDark ? 'gray.200' : 'gray.800',
            })}
          >
            {Math.abs(term)}
          </span>
        </div>
      ))}
      <div
        className={css({
          width: '100%',
          height: '1px',
          backgroundColor: isDark ? 'gray.500' : 'gray.400',
          marginY: '0.125rem',
        })}
      />
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
        })}
      >
        <span
          className={css({
            color: isCorrect
              ? isDark
                ? 'green.300'
                : 'green.700'
              : isDark
                ? 'red.300'
                : 'red.700',
            minWidth: `${maxDigits}ch`,
            textAlign: 'right',
          })}
        >
          {answer}
        </span>
        {!isCorrect && (
          <span
            className={css({
              marginLeft: '0.25rem',
              padding: '0 0.25rem',
              borderRadius: '2px',
              fontSize: '0.625rem',
              backgroundColor: isDark ? 'red.900/60' : 'red.100',
              color: isDark ? 'red.300' : 'red.700',
            })}
          >
            said {studentAnswer}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Expanded view - problem with skill annotations for each term
 */
function ExpandedProblemDisplay({
  terms,
  answer,
  studentAnswer,
  isCorrect,
  trace,
  skillMasteries,
  isDark,
}: {
  terms: number[]
  answer: number
  studentAnswer: number
  isCorrect: boolean
  trace?: GenerationTrace
  skillMasteries?: Map<string, SkillBktResult> | Record<string, SkillBktResult>
  isDark: boolean
}) {
  const maxDigits = Math.max(
    ...terms.map((t) => Math.abs(t).toString().length),
    Math.abs(answer).toString().length
  )

  const hasTrace = trace && trace.steps.length > 0

  return (
    <div
      data-element="expanded-problem"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
      })}
    >
      {/* Terms with annotations */}
      {terms.map((term, i) => {
        const step = trace?.steps[i]
        const skillsUsed = step?.skillsUsed ?? []

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
              className={css({
                display: 'flex',
                alignItems: 'center',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '1rem',
                fontWeight: 'bold',
                flexShrink: 0,
              })}
            >
              <span
                className={css({
                  width: '1rem',
                  textAlign: 'center',
                  color:
                    i === 0
                      ? 'transparent'
                      : term < 0
                        ? isDark
                          ? 'red.400'
                          : 'red.600'
                        : isDark
                          ? 'green.400'
                          : 'green.600',
                })}
              >
                {i === 0 ? '' : term < 0 ? '−' : '+'}
              </span>
              <span
                className={css({
                  minWidth: `${maxDigits}ch`,
                  textAlign: 'right',
                  color: isDark ? 'gray.100' : 'gray.900',
                })}
              >
                {Math.abs(term)}
              </span>
            </div>

            {/* Vertical separator */}
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

            {/* Skill annotations */}
            {hasTrace && (
              <div
                className={css({
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.25rem',
                  flex: 1,
                })}
              >
                {skillsUsed.length === 0 ? (
                  <span
                    className={css({
                      fontSize: '0.6875rem',
                      color: isDark ? 'gray.500' : 'gray.400',
                      fontStyle: 'italic',
                    })}
                  >
                    (start)
                  </span>
                ) : (
                  skillsUsed.map((skillId) => (
                    <SkillTag
                      key={skillId}
                      skillId={skillId}
                      masteryInfo={getSkillMasteryInfo(skillId, skillMasteries)}
                      isDark={isDark}
                    />
                  ))
                )}
              </div>
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
            width: `calc(1rem + ${maxDigits}ch)`,
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
          backgroundColor: isCorrect
            ? isDark
              ? 'green.900/40'
              : 'green.50'
            : isDark
              ? 'red.900/40'
              : 'red.50',
        })}
      >
        {/* Answer display */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '1rem',
            fontWeight: 'bold',
            flexShrink: 0,
          })}
        >
          <span
            className={css({
              width: '1rem',
              textAlign: 'center',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            =
          </span>
          <span
            className={css({
              minWidth: `${maxDigits}ch`,
              textAlign: 'right',
              color: isCorrect
                ? isDark
                  ? 'green.300'
                  : 'green.700'
                : isDark
                  ? 'red.300'
                  : 'red.700',
            })}
          >
            {answer}
          </span>
        </div>

        {/* Vertical separator */}
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

        {/* Result indicator */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flex: 1,
          })}
        >
          {isCorrect ? (
            <span
              className={css({
                fontSize: '1rem',
                color: isDark ? 'green.400' : 'green.600',
              })}
            >
              ✓
            </span>
          ) : (
            <span
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.125rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.875rem',
                backgroundColor: isDark ? 'red.900/60' : 'red.100',
                color: isDark ? 'red.300' : 'red.700',
              })}
            >
              said {studentAnswer}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Annotated Problem - shows a problem with optional skill annotations
 *
 * In collapsed mode: simple vertical problem display
 * In expanded mode: problem with skill annotations and weak skill indicators
 */
export function AnnotatedProblem({
  terms,
  answer,
  studentAnswer,
  isCorrect,
  trace,
  skillMasteries,
  expanded = false,
  isDark,
}: AnnotatedProblemProps) {
  return (
    <div data-component="annotated-problem" data-mode={expanded ? 'expanded' : 'collapsed'}>
      {expanded ? (
        <ExpandedProblemDisplay
          terms={terms}
          answer={answer}
          studentAnswer={studentAnswer}
          isCorrect={isCorrect}
          trace={trace}
          skillMasteries={skillMasteries}
          isDark={isDark}
        />
      ) : (
        <CollapsedProblemDisplay
          terms={terms}
          answer={answer}
          studentAnswer={studentAnswer}
          isCorrect={isCorrect}
          isDark={isDark}
        />
      )}
    </div>
  )
}

export default AnnotatedProblem
