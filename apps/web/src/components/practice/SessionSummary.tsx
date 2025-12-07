'use client'

import { useTheme } from '@/contexts/ThemeContext'
import type { SessionPlan, SlotResult } from '@/db/schema/session-plans'
import { css } from '../../../styled-system/css'

interface SessionSummaryProps {
  plan: SessionPlan
  studentName: string
  /** Called when user wants to practice again */
  onPracticeAgain: () => void
  /** Called when user wants to go back to dashboard */
  onBackToDashboard: () => void
}

interface SkillBreakdown {
  skillId: string
  correct: number
  total: number
  accuracy: number
}

/**
 * SessionSummary - Shows results after completing a practice session
 *
 * Features:
 * - Overall score and time
 * - Breakdown by skill
 * - Problem review list
 * - Encouragement messages
 * - Next steps suggestions
 */
export function SessionSummary({
  plan,
  studentName,
  onPracticeAgain,
  onBackToDashboard,
}: SessionSummaryProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const results = plan.results as SlotResult[]
  const totalProblems = results.length
  const correctProblems = results.filter((r) => r.isCorrect).length
  const accuracy = totalProblems > 0 ? correctProblems / totalProblems : 0

  // Calculate time stats
  const totalTimeMs = results.reduce((sum, r) => sum + r.responseTimeMs, 0)
  const avgTimeMs = totalProblems > 0 ? totalTimeMs / totalProblems : 0

  // Timestamps are serialized as milliseconds from the API (not Date objects)
  const startedAtMs = plan.startedAt as unknown as number
  const completedAtMs = plan.completedAt as unknown as number
  const sessionDurationMinutes =
    startedAtMs && completedAtMs ? (completedAtMs - startedAtMs) / 1000 / 60 : 0

  // Calculate skill breakdown
  const skillBreakdown = calculateSkillBreakdown(results)

  // Determine overall performance message
  const performanceMessage = getPerformanceMessage(accuracy)

  // Check if abacus was used
  const abacusUsageCount = results.filter((r) => r.usedOnScreenAbacus).length
  const abacusUsagePercent = totalProblems > 0 ? (abacusUsageCount / totalProblems) * 100 : 0

  return (
    <div
      data-component="session-summary"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        padding: '1.5rem',
        maxWidth: '600px',
        margin: '0 auto',
      })}
    >
      {/* Header with celebration */}
      <div
        data-section="summary-header"
        className={css({
          textAlign: 'center',
          padding: '1.5rem',
          backgroundColor: isDark
            ? accuracy >= 0.8
              ? 'green.900'
              : accuracy >= 0.6
                ? 'yellow.900'
                : 'orange.900'
            : accuracy >= 0.8
              ? 'green.50'
              : accuracy >= 0.6
                ? 'yellow.50'
                : 'orange.50',
          borderRadius: '16px',
          border: '2px solid',
          borderColor: isDark
            ? accuracy >= 0.8
              ? 'green.700'
              : accuracy >= 0.6
                ? 'yellow.700'
                : 'orange.700'
            : accuracy >= 0.8
              ? 'green.200'
              : accuracy >= 0.6
                ? 'yellow.200'
                : 'orange.200',
        })}
      >
        <div
          className={css({
            fontSize: '4rem',
            marginBottom: '0.5rem',
          })}
        >
          {accuracy >= 0.9 ? '🌟' : accuracy >= 0.8 ? '🎉' : accuracy >= 0.6 ? '👍' : '💪'}
        </div>
        <h1
          className={css({
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: isDark ? 'gray.100' : 'gray.800',
            marginBottom: '0.25rem',
          })}
        >
          Great Work, {studentName}!
        </h1>
        <p
          className={css({
            fontSize: '1rem',
            color: isDark ? 'gray.400' : 'gray.600',
          })}
        >
          {performanceMessage}
        </p>
      </div>

      {/* Main stats */}
      <div
        data-section="main-stats"
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
        })}
      >
        <div
          data-element="stat-accuracy"
          className={css({
            textAlign: 'center',
            padding: '1rem',
            backgroundColor: isDark ? 'gray.800' : 'white',
            borderRadius: '12px',
            boxShadow: 'sm',
          })}
        >
          <div
            className={css({
              fontSize: '2rem',
              fontWeight: 'bold',
              color: isDark
                ? accuracy >= 0.8
                  ? 'green.400'
                  : accuracy >= 0.6
                    ? 'yellow.400'
                    : 'orange.400'
                : accuracy >= 0.8
                  ? 'green.600'
                  : accuracy >= 0.6
                    ? 'yellow.600'
                    : 'orange.600',
            })}
          >
            {Math.round(accuracy * 100)}%
          </div>
          <div
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            Accuracy
          </div>
        </div>

        <div
          data-element="stat-problems"
          className={css({
            textAlign: 'center',
            padding: '1rem',
            backgroundColor: isDark ? 'gray.800' : 'white',
            borderRadius: '12px',
            boxShadow: 'sm',
          })}
        >
          <div
            className={css({
              fontSize: '2rem',
              fontWeight: 'bold',
              color: isDark ? 'blue.400' : 'blue.600',
            })}
          >
            {correctProblems}/{totalProblems}
          </div>
          <div
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            Correct
          </div>
        </div>

        <div
          data-element="stat-time"
          className={css({
            textAlign: 'center',
            padding: '1rem',
            backgroundColor: isDark ? 'gray.800' : 'white',
            borderRadius: '12px',
            boxShadow: 'sm',
          })}
        >
          <div
            className={css({
              fontSize: '2rem',
              fontWeight: 'bold',
              color: isDark ? 'purple.400' : 'purple.600',
            })}
          >
            {Math.round(sessionDurationMinutes)}
          </div>
          <div
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            Minutes
          </div>
        </div>
      </div>

      {/* Detailed stats */}
      <div
        data-section="detailed-stats"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          padding: '1rem',
          backgroundColor: isDark ? 'gray.800' : 'white',
          borderRadius: '12px',
          boxShadow: 'sm',
        })}
      >
        <h3
          className={css({
            fontSize: '1rem',
            fontWeight: 'bold',
            color: isDark ? 'gray.300' : 'gray.700',
            marginBottom: '0.5rem',
          })}
        >
          Session Details
        </h3>

        <div
          className={css({
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.875rem',
          })}
        >
          <span className={css({ color: isDark ? 'gray.400' : 'gray.600' })}>
            Average time per problem
          </span>
          <span className={css({ fontWeight: 'bold', color: isDark ? 'gray.200' : 'gray.800' })}>
            {Math.round(avgTimeMs / 1000)}s
          </span>
        </div>

        <div
          className={css({
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.875rem',
          })}
        >
          <span className={css({ color: isDark ? 'gray.400' : 'gray.600' })}>
            On-screen abacus used
          </span>
          <span className={css({ fontWeight: 'bold', color: isDark ? 'gray.200' : 'gray.800' })}>
            {abacusUsageCount} times ({Math.round(abacusUsagePercent)}%)
          </span>
        </div>
      </div>

      {/* Skill breakdown */}
      {skillBreakdown.length > 0 && (
        <div
          data-section="skill-breakdown"
          className={css({
            padding: '1rem',
            backgroundColor: isDark ? 'gray.800' : 'white',
            borderRadius: '12px',
            boxShadow: 'sm',
          })}
        >
          <h3
            className={css({
              fontSize: '1rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.300' : 'gray.700',
              marginBottom: '1rem',
            })}
          >
            Skills Practiced
          </h3>

          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            })}
          >
            {skillBreakdown.map((skill) => (
              <div
                key={skill.skillId}
                data-element="skill-row"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                })}
              >
                <div
                  className={css({
                    flex: 1,
                    fontSize: '0.875rem',
                    color: isDark ? 'gray.300' : 'gray.700',
                  })}
                >
                  {formatSkillName(skill.skillId)}
                </div>
                <div
                  className={css({
                    width: '120px',
                    height: '8px',
                    backgroundColor: isDark ? 'gray.700' : 'gray.200',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  })}
                >
                  <div
                    className={css({
                      height: '100%',
                      backgroundColor: isDark
                        ? skill.accuracy >= 0.8
                          ? 'green.400'
                          : skill.accuracy >= 0.6
                            ? 'yellow.400'
                            : 'red.400'
                        : skill.accuracy >= 0.8
                          ? 'green.500'
                          : skill.accuracy >= 0.6
                            ? 'yellow.500'
                            : 'red.500',
                      borderRadius: '4px',
                      transition: 'width 0.5s ease',
                    })}
                    style={{ width: `${skill.accuracy * 100}%` }}
                  />
                </div>
                <div
                  className={css({
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    color: isDark
                      ? skill.accuracy >= 0.8
                        ? 'green.400'
                        : skill.accuracy >= 0.6
                          ? 'yellow.400'
                          : 'red.400'
                      : skill.accuracy >= 0.8
                        ? 'green.600'
                        : skill.accuracy >= 0.6
                          ? 'yellow.600'
                          : 'red.600',
                    minWidth: '40px',
                    textAlign: 'right',
                  })}
                >
                  {skill.correct}/{skill.total}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Problem review (collapsed by default) */}
      <details
        data-section="problem-review"
        className={css({
          padding: '1rem',
          backgroundColor: isDark ? 'gray.800' : 'gray.50',
          borderRadius: '12px',
          border: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        <summary
          className={css({
            fontSize: '0.875rem',
            fontWeight: 'bold',
            color: isDark ? 'gray.300' : 'gray.700',
            cursor: 'pointer',
            _hover: {
              color: isDark ? 'gray.100' : 'gray.900',
            },
          })}
        >
          Review All Problems ({totalProblems})
        </summary>

        <div
          className={css({
            marginTop: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          })}
        >
          {results.map((result, index) => (
            <div
              key={index}
              data-element="problem-review-item"
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem',
                backgroundColor: isDark
                  ? result.isCorrect
                    ? 'green.900'
                    : 'red.900'
                  : result.isCorrect
                    ? 'green.50'
                    : 'red.50',
                borderRadius: '8px',
                fontSize: '0.875rem',
                color: isDark ? 'gray.200' : 'inherit',
              })}
            >
              <span>{result.isCorrect ? '✓' : '✗'}</span>
              <span
                className={css({
                  flex: 1,
                  fontFamily: 'monospace',
                })}
              >
                {formatProblem(result.problem.terms)} = {result.problem.answer}
              </span>
              {!result.isCorrect && (
                <span
                  className={css({
                    color: isDark ? 'red.400' : 'red.600',
                    textDecoration: 'line-through',
                  })}
                >
                  {result.studentAnswer}
                </span>
              )}
            </div>
          ))}
        </div>
      </details>

      {/* Action buttons */}
      <div
        data-section="actions"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          marginTop: '1rem',
        })}
      >
        <button
          type="button"
          data-action="practice-again"
          onClick={onPracticeAgain}
          className={css({
            padding: '1rem',
            fontSize: '1.125rem',
            fontWeight: 'bold',
            color: 'white',
            backgroundColor: 'blue.500',
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            _hover: {
              backgroundColor: 'blue.600',
            },
          })}
        >
          Practice Again
        </button>

        <button
          type="button"
          data-action="back-to-dashboard"
          onClick={onBackToDashboard}
          className={css({
            padding: '0.75rem',
            fontSize: '1rem',
            color: isDark ? 'gray.300' : 'gray.600',
            backgroundColor: isDark ? 'gray.700' : 'gray.100',
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            _hover: {
              backgroundColor: isDark ? 'gray.600' : 'gray.200',
            },
          })}
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  )
}

function calculateSkillBreakdown(results: SlotResult[]): SkillBreakdown[] {
  const skillMap = new Map<string, { correct: number; total: number }>()

  for (const result of results) {
    for (const skillId of result.skillsExercised) {
      const current = skillMap.get(skillId) || { correct: 0, total: 0 }
      current.total++
      if (result.isCorrect) current.correct++
      skillMap.set(skillId, current)
    }
  }

  return Array.from(skillMap.entries())
    .map(([skillId, stats]) => ({
      skillId,
      ...stats,
      accuracy: stats.correct / stats.total,
    }))
    .sort((a, b) => b.total - a.total)
}

function formatSkillName(skillId: string): string {
  // Convert skill IDs like "fiveComplements.4=5-1" to readable names
  const parts = skillId.split('.')
  if (parts.length === 2) {
    const [category, skill] = parts
    const categoryName =
      {
        fiveComplements: '5-Complements',
        tenComplements: '10-Complements',
        directAddition: 'Direct Addition',
        directSubtraction: 'Direct Subtraction',
        basic: 'Basic',
      }[category] || category

    return `${categoryName}: ${skill}`
  }
  return skillId
}

function formatProblem(terms: number[]): string {
  return terms
    .map((t, i) => {
      if (i === 0) return t.toString()
      return t < 0 ? ` - ${Math.abs(t)}` : ` + ${t}`
    })
    .join('')
}

function getPerformanceMessage(accuracy: number): string {
  if (accuracy >= 0.95) return 'Outstanding! You are a math champion!'
  if (accuracy >= 0.9) return 'Excellent work! Keep up the great practice!'
  if (accuracy >= 0.8) return 'Great job! Your hard work is paying off!'
  if (accuracy >= 0.7) return "Good effort! You're getting stronger!"
  if (accuracy >= 0.6) return 'Nice try! Practice makes perfect!'
  return "Keep practicing! You'll get better with each session!"
}

export default SessionSummary
