'use client'

import { useTheme } from '@/contexts/ThemeContext'
import type { SessionPart, SessionPlan, SlotResult } from '@/db/schema/session-plans'
import { useNextSkillToLearn } from '@/hooks/useNextSkillToLearn'
import { getSkillTutorialConfig } from '@/lib/curriculum/skill-tutorial-config'
import { css } from '../../../styled-system/css'
import { CompactLinearProblem, CompactVerticalProblem } from './CompactProblemDisplay'

interface SessionSummaryProps {
  plan: SessionPlan
  studentId: string
  studentName: string
  /** Called when user wants to practice again */
  onPracticeAgain: () => void
}

interface SkillBreakdown {
  skillId: string
  correct: number
  total: number
  accuracy: number
}

interface SkillCategoryGroup {
  categoryId: string
  categoryName: string
  skills: SkillBreakdown[]
  /** Aggregate stats for the category */
  correct: number
  total: number
  accuracy: number
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
  studentId,
  studentName,
  onPracticeAgain,
}: SessionSummaryProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const results = plan.results as SlotResult[]

  // Check if there's a new skill available to learn
  const { data: nextSkill } = useNextSkillToLearn(studentId)
  const nextSkillConfig = nextSkill ? getSkillTutorialConfig(nextSkill.skillId) : null
  // Only show unlock if the skill needs a tutorial (tutorialReady is false means NOT satisfied)
  const showUnlockCelebration = nextSkill && !nextSkill.tutorialReady && nextSkillConfig
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

      {/* Skill unlock celebration */}
      {showUnlockCelebration && nextSkillConfig && (
        <div
          data-section="skill-unlock"
          className={css({
            padding: '1rem',
            backgroundColor: isDark ? 'rgba(234, 179, 8, 0.12)' : 'rgba(234, 179, 8, 0.08)',
            border: '2px solid',
            borderColor: isDark ? 'yellow.700' : 'yellow.300',
            borderRadius: '12px',
            textAlign: 'center',
          })}
        >
          <div
            className={css({
              fontSize: '2rem',
              marginBottom: '0.5rem',
            })}
          >
            🔓
          </div>
          <p
            className={css({
              fontSize: '1rem',
              fontWeight: 'bold',
              color: isDark ? 'yellow.200' : 'yellow.800',
              marginBottom: '0.25rem',
            })}
          >
            New Skill Unlocked!
          </p>
          <p
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'gray.300' : 'gray.700',
              marginBottom: '0.5rem',
            })}
          >
            You're ready to learn <strong>{nextSkillConfig.title}</strong>
          </p>
          <p
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            Start your next practice session to begin the tutorial!
          </p>
        </div>
      )}

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
                        backgroundColor: isDark
                          ? category.accuracy >= 0.8
                            ? 'green.400'
                            : category.accuracy >= 0.6
                              ? 'yellow.400'
                              : 'red.400'
                          : category.accuracy >= 0.8
                            ? 'green.500'
                            : category.accuracy >= 0.6
                              ? 'yellow.500'
                              : 'red.500',
                        borderRadius: '3px',
                      })}
                      style={{ width: `${category.accuracy * 100}%` }}
                    />
                  </div>
                  <div
                    className={css({
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      color: isDark
                        ? category.accuracy >= 0.8
                          ? 'green.400'
                          : category.accuracy >= 0.6
                            ? 'yellow.400'
                            : 'red.400'
                        : category.accuracy >= 0.8
                          ? 'green.600'
                          : category.accuracy >= 0.6
                            ? 'yellow.600'
                            : 'red.600',
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
                            borderRadius: '2px',
                          })}
                          style={{ width: `${skill.accuracy * 100}%` }}
                        />
                      </div>
                      <div
                        className={css({
                          fontSize: '0.6875rem',
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

      {/* Problems by part - always visible */}
      <div
        data-section="problems-by-part"
        className={css({
          padding: '1rem',
          backgroundColor: isDark ? 'gray.800' : 'gray.50',
          borderRadius: '12px',
          border: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        })}
      >
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          })}
        >
          {plan.parts.map((part) => (
            <div key={part.partNumber} data-element="part-section">
              <h4
                className={css({
                  fontSize: '0.8125rem',
                  fontWeight: 'bold',
                  color: isDark ? 'gray.400' : 'gray.600',
                  marginBottom: '0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                })}
              >
                Part {part.partNumber}: {getPartTypeName(part.type)}
                <span
                  className={css({
                    fontWeight: 'normal',
                    marginLeft: '0.5rem',
                    textTransform: 'none',
                  })}
                >
                  ({part.slots.length} problems)
                </span>
              </h4>

              {/* Vertical parts: grid layout for compact problem cards */}
              {isVerticalPart(part.type) ? (
                <div
                  className={css({
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  })}
                >
                  {part.slots.map((slot) => {
                    const result = results.find(
                      (r) => r.partNumber === part.partNumber && r.slotIndex === slot.index
                    )
                    const problem = result?.problem ?? slot.problem

                    return (
                      <div
                        key={slot.index}
                        data-element="vertical-problem-item"
                        className={css({
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.5rem',
                          backgroundColor: result
                            ? isDark
                              ? result.isCorrect
                                ? 'green.900'
                                : 'red.900'
                              : result.isCorrect
                                ? 'green.50'
                                : 'red.50'
                            : isDark
                              ? 'gray.700'
                              : 'white',
                          borderRadius: '6px',
                          minWidth: '3.5rem',
                        })}
                      >
                        {/* Status indicator */}
                        <span
                          className={css({
                            fontSize: '0.75rem',
                          })}
                        >
                          {result ? (result.isCorrect ? '✓' : '✗') : '○'}
                        </span>

                        {/* Problem display */}
                        {problem ? (
                          <CompactVerticalProblem
                            terms={problem.terms}
                            answer={problem.answer}
                            studentAnswer={result?.studentAnswer}
                            isCorrect={result?.isCorrect}
                            isDark={isDark}
                          />
                        ) : (
                          <span
                            className={css({
                              fontSize: '0.625rem',
                              fontStyle: 'italic',
                              color: isDark ? 'gray.500' : 'gray.400',
                            })}
                          >
                            ?
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* Linear parts: list layout for horizontal equations */
                <div
                  className={css({
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.375rem',
                  })}
                >
                  {part.slots.map((slot) => {
                    const result = results.find(
                      (r) => r.partNumber === part.partNumber && r.slotIndex === slot.index
                    )
                    const problem = result?.problem ?? slot.problem

                    return (
                      <div
                        key={slot.index}
                        data-element="linear-problem-item"
                        className={css({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.375rem 0.5rem',
                          backgroundColor: result
                            ? isDark
                              ? result.isCorrect
                                ? 'green.900'
                                : 'red.900'
                              : result.isCorrect
                                ? 'green.50'
                                : 'red.50'
                            : isDark
                              ? 'gray.700'
                              : 'white',
                          borderRadius: '6px',
                        })}
                      >
                        {/* Status indicator */}
                        <span
                          className={css({
                            width: '1.25rem',
                            textAlign: 'center',
                          })}
                        >
                          {result ? (result.isCorrect ? '✓' : '✗') : '○'}
                        </span>

                        {/* Problem content */}
                        {problem ? (
                          <CompactLinearProblem
                            terms={problem.terms}
                            answer={problem.answer}
                            studentAnswer={result?.studentAnswer}
                            isCorrect={result?.isCorrect}
                            isDark={isDark}
                          />
                        ) : (
                          <span
                            className={css({
                              flex: 1,
                              fontStyle: 'italic',
                              color: isDark ? 'gray.500' : 'gray.400',
                            })}
                          >
                            (not yet generated)
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

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
    const current = categoryMap.get(categoryId) || { skills: [], correct: 0, total: 0 }

    current.skills.push({
      skillId,
      ...stats,
      accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
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
        accuracy: categoryData.total > 0 ? categoryData.correct / categoryData.total : 0,
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
        accuracy: categoryData.total > 0 ? categoryData.correct / categoryData.total : 0,
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

function getPartTypeName(type: SessionPart['type']): string {
  switch (type) {
    case 'abacus':
      return 'Abacus'
    case 'visualization':
      return 'Visualize'
    case 'linear':
      return 'Mental Math'
    default:
      return type
  }
}

/** Check if part type uses vertical layout (abacus/visualization) vs linear */
function isVerticalPart(type: SessionPart['type']): boolean {
  return type === 'abacus' || type === 'visualization'
}

export default SessionSummary
