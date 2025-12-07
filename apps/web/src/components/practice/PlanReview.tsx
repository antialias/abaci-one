'use client'

import { useTheme } from '@/contexts/ThemeContext'
import type {
  PartSummary,
  ProblemSlot,
  SessionPart,
  SessionPlan,
  SessionSummary,
} from '@/db/schema/session-plans'
import { useState } from 'react'
import { css } from '../../../styled-system/css'

interface PlanReviewProps {
  plan: SessionPlan
  studentName: string
  onApprove: () => void
  onCancel: () => void
}

/**
 * Get part type emoji
 */
function getPartTypeEmoji(type: SessionPart['type']): string {
  switch (type) {
    case 'abacus':
      return '🧮'
    case 'visualization':
      return '🧠'
    case 'linear':
      return '💭'
  }
}

/**
 * Get part type colors (dark mode aware)
 */
function getPartTypeColors(
  type: SessionPart['type'],
  isDark: boolean
): {
  bg: string
  border: string
  text: string
} {
  switch (type) {
    case 'abacus':
      return isDark
        ? { bg: 'blue.900', border: 'blue.700', text: 'blue.200' }
        : { bg: 'blue.50', border: 'blue.200', text: 'blue.700' }
    case 'visualization':
      return isDark
        ? { bg: 'purple.900', border: 'purple.700', text: 'purple.200' }
        : { bg: 'purple.50', border: 'purple.200', text: 'purple.700' }
    case 'linear':
      return isDark
        ? { bg: 'orange.900', border: 'orange.700', text: 'orange.200' }
        : { bg: 'orange.50', border: 'orange.200', text: 'orange.700' }
  }
}

/**
 * PlanReview - Shows the generated three-part session plan for teacher/student approval
 *
 * Features:
 * - Three-part structure display
 * - Plan summary (problems, time, focus areas)
 * - Configuration inspector toggle (debug mode)
 * - "Let's Go!" button to start
 */
export function PlanReview({ plan, studentName, onApprove, onCancel }: PlanReviewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [showConfig, setShowConfig] = useState(false)

  const summary = plan.summary as SessionSummary
  const parts = plan.parts as SessionPart[]

  // Count total slots by purpose across all parts
  const allSlots = parts.flatMap((p) => p.slots)
  const focusCount = allSlots.filter((s) => s.purpose === 'focus').length
  const reinforceCount = allSlots.filter((s) => s.purpose === 'reinforce').length
  const reviewCount = allSlots.filter((s) => s.purpose === 'review').length
  const challengeCount = allSlots.filter((s) => s.purpose === 'challenge').length

  return (
    <div
      data-component="plan-review"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.5rem',
        padding: '2rem',
        maxWidth: '600px',
        margin: '0 auto',
      })}
    >
      {/* Header */}
      <div
        className={css({
          textAlign: 'center',
        })}
      >
        <h1
          className={css({
            fontSize: '1.75rem',
            fontWeight: 'bold',
            color: isDark ? 'gray.100' : 'gray.800',
            marginBottom: '0.5rem',
          })}
        >
          Today's Practice for {studentName}
        </h1>
        <p
          className={css({
            fontSize: '1rem',
            color: isDark ? 'gray.400' : 'gray.600',
          })}
        >
          Review your plan before starting
        </p>
      </div>

      {/* Summary Card */}
      <div
        data-section="plan-summary"
        className={css({
          width: '100%',
          padding: '1.5rem',
          borderRadius: '12px',
          backgroundColor: isDark ? 'gray.800' : 'white',
          boxShadow: 'md',
          border: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        {/* Time and problem count */}
        <div
          className={css({
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
            paddingBottom: '1rem',
            borderBottom: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          <div>
            <div
              className={css({
                fontSize: '2rem',
                fontWeight: 'bold',
                color: isDark ? 'blue.400' : 'blue.600',
              })}
            >
              ~{summary.estimatedMinutes} min
            </div>
            <div
              className={css({
                fontSize: '0.875rem',
                color: isDark ? 'gray.400' : 'gray.500',
              })}
            >
              {summary.totalProblemCount} problems
            </div>
          </div>
          <div
            className={css({
              textAlign: 'right',
            })}
          >
            <div
              className={css({
                fontSize: '0.875rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              Focus: <strong>{summary.focusDescription}</strong>
            </div>
          </div>
        </div>

        {/* Three-part structure */}
        <div
          className={css({
            marginBottom: '1.5rem',
          })}
        >
          <h3
            className={css({
              fontSize: '1rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.800',
              marginBottom: '0.75rem',
            })}
          >
            Session Structure
          </h3>

          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            })}
          >
            {summary.parts.map((partSummary: PartSummary) => {
              const colors = getPartTypeColors(partSummary.type, isDark)
              return (
                <div
                  key={partSummary.partNumber}
                  data-element="part-summary"
                  data-part={partSummary.partNumber}
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    backgroundColor: colors.bg,
                    border: '1px solid',
                    borderColor: colors.border,
                  })}
                >
                  <span className={css({ fontSize: '1.5rem' })}>
                    {getPartTypeEmoji(partSummary.type)}
                  </span>
                  <div className={css({ flex: 1 })}>
                    <div
                      className={css({
                        fontWeight: 'bold',
                        color: colors.text,
                      })}
                    >
                      Part {partSummary.partNumber}: {partSummary.description}
                    </div>
                    <div
                      className={css({
                        fontSize: '0.75rem',
                        color: colors.text,
                      })}
                    >
                      {partSummary.problemCount} problems (~{partSummary.estimatedMinutes} min)
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Problem type breakdown */}
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.5rem',
          })}
        >
          <div
            className={css({
              padding: '0.5rem',
              borderRadius: '8px',
              backgroundColor: isDark ? 'blue.900' : 'blue.50',
              textAlign: 'center',
            })}
          >
            <div
              className={css({
                fontSize: '1.125rem',
                fontWeight: 'bold',
                color: isDark ? 'blue.200' : 'blue.700',
              })}
            >
              {focusCount}
            </div>
            <div
              className={css({
                fontSize: '0.625rem',
                color: isDark ? 'blue.300' : 'blue.600',
              })}
            >
              Focus
            </div>
          </div>

          <div
            className={css({
              padding: '0.5rem',
              borderRadius: '8px',
              backgroundColor: isDark ? 'orange.900' : 'orange.50',
              textAlign: 'center',
            })}
          >
            <div
              className={css({
                fontSize: '1.125rem',
                fontWeight: 'bold',
                color: isDark ? 'orange.200' : 'orange.700',
              })}
            >
              {reinforceCount}
            </div>
            <div
              className={css({
                fontSize: '0.625rem',
                color: isDark ? 'orange.300' : 'orange.600',
              })}
            >
              Reinforce
            </div>
          </div>

          <div
            className={css({
              padding: '0.5rem',
              borderRadius: '8px',
              backgroundColor: isDark ? 'green.900' : 'green.50',
              textAlign: 'center',
            })}
          >
            <div
              className={css({
                fontSize: '1.125rem',
                fontWeight: 'bold',
                color: isDark ? 'green.200' : 'green.700',
              })}
            >
              {reviewCount}
            </div>
            <div
              className={css({
                fontSize: '0.625rem',
                color: isDark ? 'green.300' : 'green.600',
              })}
            >
              Review
            </div>
          </div>

          <div
            className={css({
              padding: '0.5rem',
              borderRadius: '8px',
              backgroundColor: isDark ? 'purple.900' : 'purple.50',
              textAlign: 'center',
            })}
          >
            <div
              className={css({
                fontSize: '1.125rem',
                fontWeight: 'bold',
                color: isDark ? 'purple.200' : 'purple.700',
              })}
            >
              {challengeCount}
            </div>
            <div
              className={css({
                fontSize: '0.625rem',
                color: isDark ? 'purple.300' : 'purple.600',
              })}
            >
              Challenge
            </div>
          </div>
        </div>
      </div>

      {/* Config Inspector Toggle */}
      <button
        type="button"
        data-action="toggle-config"
        onClick={() => setShowConfig(!showConfig)}
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          fontSize: '0.875rem',
          color: isDark ? 'gray.400' : 'gray.600',
          backgroundColor: 'transparent',
          border: '1px solid',
          borderColor: isDark ? 'gray.600' : 'gray.300',
          borderRadius: '6px',
          cursor: 'pointer',
          _hover: {
            backgroundColor: isDark ? 'gray.800' : 'gray.50',
          },
        })}
      >
        <span>{showConfig ? '▼' : '▶'}</span>
        Configuration Details
      </button>

      {/* Config Inspector Panel */}
      {showConfig && (
        <div
          data-section="config-inspector"
          className={css({
            width: '100%',
            padding: '1rem',
            borderRadius: '8px',
            backgroundColor: isDark ? 'gray.800' : 'gray.50',
            border: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            overflow: 'auto',
            maxHeight: '400px',
          })}
        >
          <h4
            className={css({
              fontSize: '0.875rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.300' : 'gray.700',
              marginBottom: '1rem',
            })}
          >
            Session Configuration
          </h4>

          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              color: isDark ? 'gray.400' : 'gray.600',
            })}
          >
            <div>
              <strong>Plan ID:</strong> {plan.id}
            </div>
            <div>
              <strong>Target Duration:</strong> {plan.targetDurationMinutes} minutes
            </div>
            <div>
              <strong>Estimated Problems:</strong> {plan.estimatedProblemCount}
            </div>
            <div>
              <strong>Avg Time/Problem:</strong> {plan.avgTimePerProblemSeconds}s
            </div>
            <div>
              <strong>Status:</strong> {plan.status}
            </div>
            <div>
              <strong>Created:</strong> {new Date(plan.createdAt).toLocaleString()}
            </div>

            <hr className={css({ margin: '0.5rem 0', borderColor: isDark ? 'gray.600' : 'gray.300' })} />

            {parts.map((part: SessionPart) => (
              <details key={part.partNumber}>
                <summary className={css({ cursor: 'pointer', fontWeight: 'bold' })}>
                  Part {part.partNumber}: {part.type} ({part.slots.length} slots)
                </summary>
                <div className={css({ marginTop: '0.5rem', marginLeft: '1rem' })}>
                  <div>Format: {part.format}</div>
                  <div>Use Abacus: {part.useAbacus ? 'Yes' : 'No'}</div>
                  <div>Estimated: {part.estimatedMinutes} min</div>
                  <div style={{ marginTop: '0.5rem' }}>
                    {part.slots.map((slot: ProblemSlot, i: number) => (
                      <div
                        key={i}
                        className={css({
                          padding: '0.25rem 0',
                          borderBottom: '1px dashed',
                          borderColor: isDark ? 'gray.600' : 'gray.200',
                        })}
                      >
                        <div>
                          #{slot.index + 1} - <strong>{slot.purpose}</strong>
                        </div>
                        {slot.constraints && (
                          <div className={css({ marginLeft: '1rem', fontSize: '0.7rem' })}>
                            Terms: {slot.constraints.termCount?.min}-
                            {slot.constraints.termCount?.max}, Digits:{' '}
                            {slot.constraints.digitRange?.min}-{slot.constraints.digitRange?.max}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          width: '100%',
        })}
      >
        <button
          type="button"
          data-action="approve-plan"
          onClick={onApprove}
          className={css({
            padding: '1rem',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: 'white',
            backgroundColor: 'green.500',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
            _hover: {
              backgroundColor: 'green.600',
            },
          })}
        >
          Let's Go!
        </button>

        <button
          type="button"
          data-action="cancel"
          onClick={onCancel}
          className={css({
            padding: '0.75rem',
            fontSize: '1rem',
            color: isDark ? 'gray.400' : 'gray.600',
            backgroundColor: 'transparent',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: isDark ? 'gray.600' : 'gray.300',
            cursor: 'pointer',
            _hover: {
              backgroundColor: isDark ? 'gray.800' : 'gray.50',
            },
          })}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default PlanReview
