'use client'

import { useMemo } from 'react'
import { PRACTICE_TYPES, type PracticeTypeId } from '@/constants/practiceTypes'
import { useTheme } from '@/contexts/ThemeContext'
import type { SessionPart, SessionPlan, SlotResult } from '@/db/schema/session-plans'
import { computeBktFromHistory, type SkillBktResult } from '@/lib/curriculum/bkt'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'
import { css } from '../../../styled-system/css'
import { AllProblemsSection } from './AllProblemsSection'
import { calculateAutoPauseInfo, formatMs, getAutoPauseExplanation } from './autoPauseCalculator'
import { ProblemToReview } from './ProblemToReview'
import { filterProblemsNeedingAttention, getProblemsWithContext } from './sessionSummaryUtils'

interface SessionSummaryProps {
  plan: SessionPlan
  studentId: string
  studentName: string
  /** Called when user wants to practice again */
  onPracticeAgain: () => void
  /** Problem history for BKT computation (optional - if not provided, weak skills won't be shown) */
  problemHistory?: ProblemResultWithContext[]
  /** Whether we just transitioned from active practice - shows celebration header */
  justCompleted?: boolean
}

interface SkillBreakdown {
  skillId: string
  correct: number
  total: number
}

interface SkillCategoryGroup {
  categoryId: string
  categoryName: string
  skills: SkillBreakdown[]
  /** Aggregate stats for the category */
  correct: number
  total: number
}

/** Ordered list of skill categories (pedagogical progression) */
const SKILL_CATEGORY_ORDER = [
  'basic',
  'fiveComplements',
  'tenComplements',
  'fiveComplementsSub',
  'tenComplementsSub',
] as const

const SKILL_CATEGORY_NAMES: Record<string, string> = {
  basic: 'Basic Operations',
  fiveComplements: '5-Complements (Addition)',
  tenComplements: '10-Complements (Addition)',
  fiveComplementsSub: '5-Complements (Subtraction)',
  tenComplementsSub: '10-Complements (Subtraction)',
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
  studentId: _studentId,
  studentName,
  onPracticeAgain,
  problemHistory,
  justCompleted = false,
}: SessionSummaryProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const results = plan.results as SlotResult[]
  const parts = (plan.parts ?? []) as SessionPart[]

  // Get unique practice types from the session parts
  const practiceTypesInSession = useMemo(() => {
    const typeIds = new Set<PracticeTypeId>()
    for (const part of parts) {
      if (part.slots && part.slots.length > 0) {
        typeIds.add(part.type as PracticeTypeId)
      }
    }
    return PRACTICE_TYPES.filter((t) => typeIds.has(t.id as PracticeTypeId))
  }, [parts])

  // Format session date
  const sessionDate = useMemo(() => {
    const timestamp = plan.startedAt ?? plan.createdAt
    if (!timestamp) return null
    // Handle both Date objects and millisecond timestamps
    const date =
      typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp as unknown as string)
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }, [plan.startedAt, plan.createdAt])

  // Compute BKT from problem history to get skill masteries
  const skillMasteries = useMemo<Record<string, SkillBktResult>>(() => {
    if (!problemHistory || problemHistory.length === 0) {
      return {}
    }
    const bktResult = computeBktFromHistory(problemHistory)
    // Convert array to record for easy lookup
    return Object.fromEntries(bktResult.skills.map((skill) => [skill.skillId, skill]))
  }, [problemHistory])

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

  // Calculate skill breakdown grouped by category
  const skillCategories = calculateSkillBreakdownByCategory(results)

  // Determine overall performance message
  const performanceMessage = getPerformanceMessage(accuracy)

  // Check if abacus was used
  const abacusUsageCount = results.filter((r) => r.usedOnScreenAbacus).length
  const abacusUsagePercent = totalProblems > 0 ? (abacusUsageCount / totalProblems) * 100 : 0

  // Calculate auto-pause info for timing summary
  const autoPauseInfo = calculateAutoPauseInfo(results)

  // Get problems that need attention (incorrect, slow, or used heavy help)
  const problemsWithContext = getProblemsWithContext(plan)
  const problemsNeedingAttention = filterProblemsNeedingAttention(
    problemsWithContext,
    autoPauseInfo.threshold
  )

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
      {/* Header - celebration when just completed, date otherwise */}
      {justCompleted ? (
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
      ) : (
        <div
          data-section="session-date-header"
          className={css({
            textAlign: 'center',
            marginBottom: '0.5rem',
          })}
        >
          <h1
            className={css({
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.800',
            })}
          >
            {sessionDate ?? 'Practice Session'}
          </h1>
        </div>
      )}

      {/* Main stats */}
      <div
        data-section="main-stats"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        })}
      >
        {/* Practice type badges */}
        {practiceTypesInSession.length > 0 && (
          <div
            data-element="practice-types"
            className={css({
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              justifyContent: 'center',
            })}
          >
            {practiceTypesInSession.map((type) => (
              <span
                key={type.id}
                className={css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  px: '0.75rem',
                  py: '0.25rem',
                  fontSize: '0.8125rem',
                  fontWeight: 'medium',
                  borderRadius: 'full',
                  backgroundColor: isDark ? 'gray.700' : 'gray.100',
                  color: isDark ? 'gray.200' : 'gray.700',
                })}
              >
                <span>{type.icon}</span>
                <span>{type.label}</span>
              </span>
            ))}
          </div>
        )}

        {/* Stats grid */}
        <div
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
          <span
            className={css({
              fontWeight: 'bold',
              color: isDark ? 'gray.200' : 'gray.800',
            })}
          >
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
          <span
            className={css({
              fontWeight: 'bold',
              color: isDark ? 'gray.200' : 'gray.800',
            })}
          >
            {abacusUsageCount} times ({Math.round(abacusUsagePercent)}%)
          </span>
        </div>
      </div>

      {/* Skill breakdown by category */}
      {skillCategories.length > 0 && (
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
              gap: '1.25rem',
            })}
          >
            {skillCategories.map((category) => (
              <details
                key={category.categoryId}
                data-element="skill-category"
                className={css({
                  '& > summary': {
                    listStyle: 'none',
                    cursor: 'pointer',
                    '&::-webkit-details-marker': { display: 'none' },
                  },
                })}
              >
                {/* Category header with aggregate stats (clickable summary) */}
                <summary
                  className={css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    paddingBottom: '0.375rem',
                    borderBottom: '1px solid',
                    borderColor: isDark ? 'gray.700' : 'gray.200',
                    _hover: {
                      backgroundColor: isDark ? 'gray.750' : 'gray.50',
                    },
                  })}
                >
                  <div
                    className={css({
                      flex: 1,
                      fontSize: '0.875rem',
                      fontWeight: 'bold',
                      color: isDark ? 'gray.200' : 'gray.800',
                    })}
                  >
                    {category.categoryName}
                  </div>
                  <div
                    className={css({
                      width: '80px',
                      height: '6px',
                      backgroundColor: isDark ? 'gray.700' : 'gray.200',
                      borderRadius: '3px',
                      overflow: 'hidden',
                    })}
                  >
                    <div
                      className={css({
                        height: '100%',
                        // Neutral blue color - not implying skill-level judgment
                        backgroundColor: isDark ? 'blue.400' : 'blue.500',
                        borderRadius: '3px',
                      })}
                      style={{
                        width: `${category.total > 0 ? (category.correct / category.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div
                    className={css({
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      color: isDark ? 'blue.400' : 'blue.600',
                      minWidth: '36px',
                      textAlign: 'right',
                    })}
                  >
                    {category.correct}/{category.total}
                  </div>
                </summary>

                {/* Individual skills within category (expanded content) */}
                <div
                  className={css({
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.375rem',
                    paddingLeft: '0.75rem',
                    paddingTop: '0.5rem',
                  })}
                >
                  {category.skills.map((skill) => (
                    <div
                      key={skill.skillId}
                      data-element="skill-row"
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      })}
                    >
                      <div
                        className={css({
                          flex: 1,
                          fontSize: '0.8125rem',
                          color: isDark ? 'gray.400' : 'gray.600',
                        })}
                      >
                        {formatSkillValue(skill.skillId)}
                      </div>
                      <div
                        className={css({
                          width: '60px',
                          height: '4px',
                          backgroundColor: isDark ? 'gray.700' : 'gray.200',
                          borderRadius: '2px',
                          overflow: 'hidden',
                        })}
                      >
                        <div
                          className={css({
                            height: '100%',
                            // Neutral blue color - not implying skill-level judgment
                            backgroundColor: isDark ? 'blue.400' : 'blue.500',
                            borderRadius: '2px',
                          })}
                          style={{
                            width: `${skill.total > 0 ? (skill.correct / skill.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <div
                        className={css({
                          fontSize: '0.6875rem',
                          color: isDark ? 'blue.400' : 'blue.600',
                          minWidth: '28px',
                          textAlign: 'right',
                        })}
                      >
                        {skill.correct}/{skill.total}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* Auto-Pause Timing Summary */}
      <section
        data-section="auto-pause-summary"
        className={css({
          padding: '1rem',
          borderRadius: '8px',
          backgroundColor: isDark ? 'gray.800' : 'gray.50',
          border: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        <h3
          className={css({
            fontSize: '1rem',
            fontWeight: 'bold',
            color: isDark ? 'gray.200' : 'gray.700',
            marginBottom: '0.5rem',
          })}
        >
          ⏱️ Response Timing
        </h3>
        <div
          className={css({
            display: 'grid',
            gap: '0.5rem',
            fontSize: '0.875rem',
          })}
        >
          <div
            className={css({
              display: 'flex',
              justifyContent: 'space-between',
            })}
          >
            <span className={css({ color: isDark ? 'gray.400' : 'gray.600' })}>
              Auto-pause threshold:
            </span>
            <span
              className={css({
                fontWeight: 'bold',
                color: isDark ? 'gray.200' : 'gray.800',
              })}
            >
              {formatMs(autoPauseInfo.threshold)}
            </span>
          </div>
          <div
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.500' : 'gray.500',
              fontStyle: 'italic',
            })}
          >
            {getAutoPauseExplanation(autoPauseInfo.stats)}
          </div>
          {autoPauseInfo.stats.sampleCount > 0 && (
            <div
              className={css({
                display: 'flex',
                gap: '1rem',
                marginTop: '0.25rem',
                fontSize: '0.75rem',
                color: isDark ? 'gray.400' : 'gray.500',
              })}
            >
              <span>Mean: {formatMs(autoPauseInfo.stats.meanMs)}</span>
              <span>Std Dev: {formatMs(autoPauseInfo.stats.stdDevMs)}</span>
              <span>Samples: {autoPauseInfo.stats.sampleCount}</span>
            </div>
          )}
        </div>
      </section>

      {/* Problems Worth Attention */}
      {problemsNeedingAttention.length > 0 ? (
        <section
          data-section="problems-to-review"
          className={css({
            padding: '1rem',
            borderRadius: '12px',
            backgroundColor: isDark ? 'gray.800' : 'white',
            border: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          <h3
            className={css({
              fontSize: '1rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.200' : 'gray.700',
              marginBottom: '0.5rem',
            })}
          >
            📋 Problems to Review
          </h3>
          <p
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.400' : 'gray.500',
              marginBottom: '1rem',
            })}
          >
            {problemsNeedingAttention.length} of {totalProblems} problems need attention
          </p>
          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            })}
          >
            {problemsNeedingAttention.map((problem) => {
              // Get all results before this problem for auto-pause calculation
              const resultsBeforeThis = results.slice(
                0,
                results.findIndex(
                  (r) =>
                    r.partNumber === problem.result.partNumber &&
                    r.slotIndex === problem.result.slotIndex
                )
              )

              return (
                <ProblemToReview
                  key={`${problem.part.partNumber}-${problem.slot.index}`}
                  problem={problem}
                  allResultsBeforeThis={resultsBeforeThis}
                  skillMasteries={skillMasteries}
                  isDark={isDark}
                />
              )
            })}
          </div>
        </section>
      ) : (
        <div
          data-section="all-correct"
          className={css({
            padding: '1.5rem',
            borderRadius: '12px',
            backgroundColor: isDark ? 'green.900/30' : 'green.50',
            border: '1px solid',
            borderColor: isDark ? 'green.700' : 'green.200',
            textAlign: 'center',
          })}
        >
          <span
            className={css({
              fontSize: '2rem',
              display: 'block',
              marginBottom: '0.5rem',
            })}
          >
            🎉
          </span>
          <h3
            className={css({
              fontSize: '1rem',
              fontWeight: 'bold',
              color: isDark ? 'green.300' : 'green.700',
            })}
          >
            Perfect! All problems answered correctly.
          </h3>
        </div>
      )}

      {/* All Problems (collapsed by default) */}
      <AllProblemsSection plan={plan} isDark={isDark} />

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
      </div>
    </div>
  )
}

function calculateSkillBreakdownByCategory(results: SlotResult[]): SkillCategoryGroup[] {
  // First, collect all skills with their stats
  const skillMap = new Map<string, { correct: number; total: number }>()

  for (const result of results) {
    for (const skillId of result.skillsExercised) {
      const current = skillMap.get(skillId) || { correct: 0, total: 0 }
      current.total++
      if (result.isCorrect) current.correct++
      skillMap.set(skillId, current)
    }
  }

  // Group skills by category
  const categoryMap = new Map<
    string,
    { skills: SkillBreakdown[]; correct: number; total: number }
  >()

  for (const [skillId, stats] of skillMap.entries()) {
    const categoryId = skillId.split('.')[0] || 'other'
    const current = categoryMap.get(categoryId) || {
      skills: [],
      correct: 0,
      total: 0,
    }

    current.skills.push({
      skillId,
      ...stats,
    })
    current.correct += stats.correct
    current.total += stats.total

    categoryMap.set(categoryId, current)
  }

  // Sort categories by pedagogical order, then build result
  const result: SkillCategoryGroup[] = []

  for (const categoryId of SKILL_CATEGORY_ORDER) {
    const categoryData = categoryMap.get(categoryId)
    if (categoryData && categoryData.skills.length > 0) {
      // Sort skills within category by total count (most practiced first)
      categoryData.skills.sort((a, b) => b.total - a.total)

      result.push({
        categoryId,
        categoryName: SKILL_CATEGORY_NAMES[categoryId] || categoryId,
        skills: categoryData.skills,
        correct: categoryData.correct,
        total: categoryData.total,
      })
    }
  }

  // Add any categories not in the predefined order (shouldn't happen, but just in case)
  for (const [categoryId, categoryData] of categoryMap.entries()) {
    if (!SKILL_CATEGORY_ORDER.includes(categoryId as (typeof SKILL_CATEGORY_ORDER)[number])) {
      categoryData.skills.sort((a, b) => b.total - a.total)

      result.push({
        categoryId,
        categoryName: SKILL_CATEGORY_NAMES[categoryId] || categoryId,
        skills: categoryData.skills,
        correct: categoryData.correct,
        total: categoryData.total,
      })
    }
  }

  return result
}

/** Format just the skill value part (e.g., "4=5-1" from "fiveComplements.4=5-1") */
function formatSkillValue(skillId: string): string {
  const parts = skillId.split('.')
  if (parts.length === 2) {
    return parts[1]
  }
  return skillId
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
