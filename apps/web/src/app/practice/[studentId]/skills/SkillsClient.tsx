'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import { PracticeSubNav } from '@/components/practice'
import { useTheme } from '@/contexts/ThemeContext'
import type { PlayerCurriculum } from '@/db/schema/player-curriculum'
import {
  calculateFluencyState,
  type FluencyState,
  type PlayerSkillMastery,
} from '@/db/schema/player-skill-mastery'
import type { Player } from '@/db/schema/players'
import type { ProblemResultWithContext } from '@/lib/curriculum/server'
import { css } from '../../../../../styled-system/css'

// ============================================================================
// Types
// ============================================================================

interface SkillsClientProps {
  studentId: string
  player: Player
  curriculum: PlayerCurriculum | null
  skills: PlayerSkillMastery[]
  problemHistory: ProblemResultWithContext[]
}

/** Processed skill with computed metrics */
interface ProcessedSkill {
  id: string
  skillId: string
  displayName: string
  category: string
  categoryOrder: number
  fluencyState: FluencyState | 'not_practicing'
  accuracy: number
  attempts: number
  correct: number
  consecutiveCorrect: number
  isPracticing: boolean
  needsReinforcement: boolean
  lastPracticedAt: Date | null
  daysSinceLastPractice: number | null
  avgResponseTimeMs: number | null
  /** Problems involving this skill (most recent first) */
  problems: ProblemResultWithContext[]
}

/** Skill category with display info */
interface SkillCategory {
  id: string
  name: string
  emoji: string
  order: number
}

// ============================================================================
// Skill Category Definitions
// ============================================================================

const SKILL_CATEGORIES: Record<string, SkillCategory> = {
  basic: { id: 'basic', name: 'Basic', emoji: '🔢', order: 1 },
  fiveComplements: { id: 'fiveComplements', name: 'Five Complements (+)', emoji: '✋', order: 2 },
  fiveComplementsSub: {
    id: 'fiveComplementsSub',
    name: 'Five Complements (-)',
    emoji: '✋',
    order: 3,
  },
  tenComplements: { id: 'tenComplements', name: 'Ten Complements (+)', emoji: '🔟', order: 4 },
  tenComplementsSub: {
    id: 'tenComplementsSub',
    name: 'Ten Complements (-)',
    emoji: '🔟',
    order: 5,
  },
  mixedComplements: {
    id: 'mixedComplements',
    name: 'Mixed Complements (+)',
    emoji: '🔄',
    order: 6,
  },
  mixedComplementsSub: {
    id: 'mixedComplementsSub',
    name: 'Mixed Complements (-)',
    emoji: '🔄',
    order: 7,
  },
}

function getCategoryFromSkillId(skillId: string): SkillCategory {
  const categoryKey = skillId.split('.')[0]
  return SKILL_CATEGORIES[categoryKey] ?? { id: 'other', name: 'Other', emoji: '❓', order: 99 }
}

function formatSkillDisplayName(skillId: string): string {
  // Format: "category.value" -> extract value part
  // e.g., "fiveComplements.4=5-1" -> "+4 = +5 - 1"
  // e.g., "tenComplements.9=10-1" -> "+9 = +10 - 1"
  // e.g., "basic.directAddition" -> "Direct Addition"
  const parts = skillId.split('.')
  if (parts.length < 2) return skillId

  const value = parts[1]

  // Basic skills
  if (parts[0] === 'basic') {
    return value
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/^./, (c) => c.toUpperCase())
  }

  // Complement skills with format like "4=5-1" or "-4=-5+1"
  if (value.includes('=')) {
    return value
  }

  return value
}

// ============================================================================
// Data Processing
// ============================================================================

function processSkills(
  skills: PlayerSkillMastery[],
  problemHistory: ProblemResultWithContext[]
): ProcessedSkill[] {
  const now = new Date()

  // Build a map of problems by skill
  const problemsBySkill = new Map<string, ProblemResultWithContext[]>()
  for (const problem of problemHistory) {
    for (const skillId of problem.skillsExercised) {
      const existing = problemsBySkill.get(skillId) ?? []
      existing.push(problem)
      problemsBySkill.set(skillId, existing)
    }
  }

  return skills.map((skill) => {
    const category = getCategoryFromSkillId(skill.skillId)
    const daysSinceLastPractice = skill.lastPracticedAt
      ? Math.floor(
          (now.getTime() - new Date(skill.lastPracticedAt).getTime()) / (1000 * 60 * 60 * 24)
        )
      : null

    const fluencyState: FluencyState | 'not_practicing' = !skill.isPracticing
      ? 'not_practicing'
      : calculateFluencyState(
          skill.attempts,
          skill.correct,
          skill.consecutiveCorrect,
          daysSinceLastPractice ?? undefined
        )

    const accuracy = skill.attempts > 0 ? skill.correct / skill.attempts : 0
    const avgResponseTimeMs =
      skill.responseTimeCount > 0 ? skill.totalResponseTimeMs / skill.responseTimeCount : null

    const problems = problemsBySkill.get(skill.skillId) ?? []

    return {
      id: skill.id,
      skillId: skill.skillId,
      displayName: formatSkillDisplayName(skill.skillId),
      category: category.name,
      categoryOrder: category.order,
      fluencyState,
      accuracy,
      attempts: skill.attempts,
      correct: skill.correct,
      consecutiveCorrect: skill.consecutiveCorrect,
      isPracticing: skill.isPracticing,
      needsReinforcement: skill.needsReinforcement,
      lastPracticedAt: skill.lastPracticedAt,
      daysSinceLastPractice,
      avgResponseTimeMs,
      problems,
    }
  })
}

// ============================================================================
// Sub-components
// ============================================================================

function SkillCard({
  skill,
  isDark,
  onClick,
}: {
  skill: ProcessedSkill
  isDark: boolean
  onClick: () => void
}) {
  const errorCount = skill.attempts - skill.correct

  // Determine status color
  const getStatusColor = () => {
    if (skill.fluencyState === 'effortless')
      return { bg: 'green.100', border: 'green.400', text: 'green.700' }
    if (skill.fluencyState === 'fluent')
      return { bg: 'blue.100', border: 'blue.400', text: 'blue.700' }
    if (skill.fluencyState === 'rusty')
      return { bg: 'orange.100', border: 'orange.400', text: 'orange.700' }
    if (skill.fluencyState === 'practicing')
      return { bg: 'yellow.100', border: 'yellow.400', text: 'yellow.700' }
    return { bg: 'gray.100', border: 'gray.400', text: 'gray.600' }
  }

  const colors = getStatusColor()

  return (
    <button
      type="button"
      data-element="skill-card"
      data-skill-id={skill.skillId}
      data-fluency={skill.fluencyState}
      onClick={onClick}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        padding: '0.75rem',
        borderRadius: '8px',
        border: '2px solid',
        borderColor: isDark ? `${colors.border}/60` : colors.border,
        backgroundColor: isDark ? `${colors.bg}/20` : colors.bg,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s ease',
        _hover: {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        },
      })}
    >
      {/* Skill name */}
      <span
        className={css({
          fontSize: '0.875rem',
          fontWeight: 'bold',
          color: isDark ? 'gray.100' : 'gray.900',
          marginBottom: '0.25rem',
        })}
      >
        {skill.displayName}
      </span>

      {/* Stats row - honest framing */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.75rem',
          color: isDark ? 'gray.400' : 'gray.600',
        })}
      >
        <span title="Correct problems involving this skill">✓ {skill.correct}</span>
        {errorCount > 0 && (
          <>
            <span>•</span>
            <span title="Problems with errors that involved this skill">✗ {errorCount}</span>
          </>
        )}
        {skill.needsReinforcement && <span title="Needs reinforcement">⚠️</span>}
      </div>

      {/* Fluency badge */}
      <span
        className={css({
          marginTop: '0.5rem',
          padding: '0.125rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.625rem',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          backgroundColor: isDark ? `${colors.bg}/40` : colors.bg,
          color: isDark ? 'gray.200' : colors.text,
          alignSelf: 'flex-start',
        })}
      >
        {skill.fluencyState}
      </span>
    </button>
  )
}

function SectionHeader({
  title,
  emoji,
  count,
  isDark,
}: {
  title: string
  emoji: string
  count: number
  isDark: boolean
}) {
  return (
    <div
      data-element="section-header"
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.75rem',
      })}
    >
      <span className={css({ fontSize: '1.25rem' })}>{emoji}</span>
      <h2
        className={css({
          fontSize: '1rem',
          fontWeight: 'bold',
          color: isDark ? 'gray.100' : 'gray.900',
        })}
      >
        {title}
      </h2>
      <span
        className={css({
          padding: '0.125rem 0.5rem',
          borderRadius: '999px',
          fontSize: '0.75rem',
          fontWeight: 'bold',
          backgroundColor: isDark ? 'gray.700' : 'gray.200',
          color: isDark ? 'gray.300' : 'gray.600',
        })}
      >
        {count}
      </span>
    </div>
  )
}

function SkillSection({
  title,
  emoji,
  skills,
  isDark,
  onSkillClick,
  emptyMessage,
}: {
  title: string
  emoji: string
  skills: ProcessedSkill[]
  isDark: boolean
  onSkillClick: (skill: ProcessedSkill) => void
  emptyMessage: string
}) {
  if (skills.length === 0) {
    return (
      <section
        data-section={title.toLowerCase().replace(/\s+/g, '-')}
        className={css({
          padding: '1rem',
          borderRadius: '12px',
          backgroundColor: isDark ? 'gray.800' : 'gray.50',
          marginBottom: '1.5rem',
        })}
      >
        <SectionHeader title={title} emoji={emoji} count={0} isDark={isDark} />
        <p
          className={css({
            fontSize: '0.875rem',
            color: isDark ? 'gray.500' : 'gray.500',
            fontStyle: 'italic',
          })}
        >
          {emptyMessage}
        </p>
      </section>
    )
  }

  return (
    <section
      data-section={title.toLowerCase().replace(/\s+/g, '-')}
      className={css({
        padding: '1rem',
        borderRadius: '12px',
        backgroundColor: isDark ? 'gray.800' : 'gray.50',
        marginBottom: '1.5rem',
      })}
    >
      <SectionHeader title={title} emoji={emoji} count={skills.length} isDark={isDark} />
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '0.75rem',
        })}
      >
        {skills.map((skill) => (
          <SkillCard
            key={skill.id}
            skill={skill}
            isDark={isDark}
            onClick={() => onSkillClick(skill)}
          />
        ))}
      </div>
    </section>
  )
}

function CategorySection({
  category,
  skills,
  isDark,
  onSkillClick,
}: {
  category: SkillCategory
  skills: ProcessedSkill[]
  isDark: boolean
  onSkillClick: (skill: ProcessedSkill) => void
}) {
  return (
    <section
      data-section={`category-${category.id}`}
      className={css({
        padding: '1rem',
        borderRadius: '12px',
        backgroundColor: isDark ? 'gray.800' : 'gray.50',
        marginBottom: '1rem',
      })}
    >
      <SectionHeader
        title={category.name}
        emoji={category.emoji}
        count={skills.length}
        isDark={isDark}
      />
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '0.75rem',
        })}
      >
        {skills.map((skill) => (
          <SkillCard
            key={skill.id}
            skill={skill}
            isDark={isDark}
            onClick={() => onSkillClick(skill)}
          />
        ))}
      </div>
    </section>
  )
}

// ============================================================================
// Skill Detail Drawer
// ============================================================================

function SkillDetailDrawer({
  skill,
  isDark,
  onClose,
}: {
  skill: ProcessedSkill | null
  isDark: boolean
  onClose: () => void
}) {
  if (!skill) return null

  const errorCount = skill.attempts - skill.correct
  const avgTimeSeconds = skill.avgResponseTimeMs
    ? (skill.avgResponseTimeMs / 1000).toFixed(1)
    : 'N/A'

  return (
    <>
      {/* Backdrop */}
      <div
        data-element="drawer-backdrop"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        className={css({
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 100,
        })}
      />

      {/* Drawer */}
      <div
        data-element="skill-detail-drawer"
        data-skill-id={skill.skillId}
        className={css({
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '400px',
          backgroundColor: isDark ? 'gray.900' : 'white',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.2)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        })}
      >
        {/* Header */}
        <div
          className={css({
            padding: '1rem',
            borderBottom: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          })}
        >
          <div>
            <h2
              className={css({
                fontSize: '1.125rem',
                fontWeight: 'bold',
                color: isDark ? 'gray.100' : 'gray.900',
              })}
            >
              {skill.displayName}
            </h2>
            <p
              className={css({
                fontSize: '0.75rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              {skill.category}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={css({
              padding: '0.5rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              fontSize: '1.25rem',
              color: isDark ? 'gray.400' : 'gray.600',
              _hover: {
                backgroundColor: isDark ? 'gray.800' : 'gray.100',
              },
            })}
          >
            ✕
          </button>
        </div>

        {/* Stats - honest framing */}
        <div
          className={css({
            padding: '1rem',
            borderBottom: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem',
          })}
        >
          <div className={css({ textAlign: 'center' })}>
            <div
              className={css({
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: isDark ? 'green.400' : 'green.600',
              })}
            >
              {skill.correct}
            </div>
            <div className={css({ fontSize: '0.75rem', color: isDark ? 'gray.400' : 'gray.600' })}>
              Correct
            </div>
          </div>
          <div className={css({ textAlign: 'center' })}>
            <div
              className={css({
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color:
                  errorCount > 0
                    ? isDark
                      ? 'red.400'
                      : 'red.600'
                    : isDark
                      ? 'gray.400'
                      : 'gray.600',
              })}
            >
              {errorCount}
            </div>
            <div className={css({ fontSize: '0.75rem', color: isDark ? 'gray.400' : 'gray.600' })}>
              In errors
            </div>
          </div>
          <div className={css({ textAlign: 'center' })}>
            <div
              className={css({
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: isDark ? 'gray.100' : 'gray.900',
              })}
            >
              {avgTimeSeconds}s
            </div>
            <div className={css({ fontSize: '0.75rem', color: isDark ? 'gray.400' : 'gray.600' })}>
              Avg Time
            </div>
          </div>
        </div>

        {/* Important note about error attribution */}
        <div
          className={css({
            padding: '0.75rem 1rem',
            backgroundColor: isDark ? 'blue.900/30' : 'blue.50',
            borderBottom: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
            fontSize: '0.75rem',
            color: isDark ? 'blue.300' : 'blue.700',
            lineHeight: '1.4',
          })}
        >
          <strong>Note:</strong> "In errors" counts problems where this skill appeared but the
          answer was wrong. The error may have been caused by other skills in the same problem.
        </div>

        {/* Additional info */}
        <div
          className={css({
            padding: '1rem',
            borderBottom: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
            fontSize: '0.875rem',
            color: isDark ? 'gray.300' : 'gray.700',
          })}
        >
          <div className={css({ marginBottom: '0.5rem' })}>
            <strong>Status:</strong>{' '}
            <span
              className={css({
                textTransform: 'capitalize',
                color:
                  skill.fluencyState === 'effortless' || skill.fluencyState === 'fluent'
                    ? isDark
                      ? 'green.400'
                      : 'green.600'
                    : skill.fluencyState === 'practicing'
                      ? isDark
                        ? 'yellow.400'
                        : 'yellow.600'
                      : isDark
                        ? 'orange.400'
                        : 'orange.600',
              })}
            >
              {skill.fluencyState}
            </span>
          </div>
          <div className={css({ marginBottom: '0.5rem' })}>
            <strong>Consecutive correct:</strong> {skill.consecutiveCorrect}
          </div>
          {skill.lastPracticedAt && (
            <div className={css({ marginBottom: '0.5rem' })}>
              <strong>Last practiced:</strong>{' '}
              {skill.daysSinceLastPractice === 0
                ? 'Today'
                : skill.daysSinceLastPractice === 1
                  ? 'Yesterday'
                  : `${skill.daysSinceLastPractice} days ago`}
            </div>
          )}
          {skill.needsReinforcement && (
            <div
              className={css({
                marginTop: '0.5rem',
                padding: '0.5rem',
                borderRadius: '6px',
                backgroundColor: isDark ? 'orange.900/40' : 'orange.100',
                color: isDark ? 'orange.300' : 'orange.700',
              })}
            >
              ⚠️ Needs reinforcement
            </div>
          )}
        </div>

        {/* Problem history */}
        <div
          className={css({
            flex: 1,
            overflow: 'auto',
            padding: '1rem',
          })}
        >
          <h3
            className={css({
              fontSize: '0.875rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.300' : 'gray.700',
              marginBottom: '0.75rem',
            })}
          >
            Recent Problems ({skill.problems.length})
          </h3>

          {skill.problems.length === 0 ? (
            <p
              className={css({
                fontSize: '0.875rem',
                color: isDark ? 'gray.500' : 'gray.500',
                fontStyle: 'italic',
              })}
            >
              No problems recorded yet
            </p>
          ) : (
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.5rem' })}>
              {skill.problems.slice(0, 20).map((problem, index) => {
                const terms = problem.problem.terms
                const problemDisplay = terms
                  .map((t, i) => (i === 0 ? t.toString() : t >= 0 ? `+ ${t}` : `- ${Math.abs(t)}`))
                  .join(' ')

                return (
                  <div
                    key={`${problem.sessionId}-${problem.partNumber}-${problem.slotIndex}`}
                    data-element="problem-history-item"
                    data-correct={problem.isCorrect}
                    className={css({
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      backgroundColor: problem.isCorrect
                        ? isDark
                          ? 'green.900/30'
                          : 'green.50'
                        : isDark
                          ? 'red.900/30'
                          : 'red.50',
                      border: '1px solid',
                      borderColor: problem.isCorrect
                        ? isDark
                          ? 'green.700/50'
                          : 'green.200'
                        : isDark
                          ? 'red.700/50'
                          : 'red.200',
                    })}
                  >
                    <div
                      className={css({
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.25rem',
                      })}
                    >
                      <span
                        className={css({
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          color: isDark ? 'gray.200' : 'gray.800',
                        })}
                      >
                        {problemDisplay} = {problem.problem.answer}
                      </span>
                      <span
                        className={css({
                          fontSize: '1rem',
                        })}
                      >
                        {problem.isCorrect ? '✓' : '✗'}
                      </span>
                    </div>
                    <div
                      className={css({
                        display: 'flex',
                        gap: '0.75rem',
                        fontSize: '0.6875rem',
                        color: isDark ? 'gray.500' : 'gray.500',
                      })}
                    >
                      <span>
                        {problem.isCorrect ? 'Correct' : `Answered: ${problem.studentAnswer}`}
                      </span>
                      <span>{(problem.responseTimeMs / 1000).toFixed(1)}s</span>
                      <span>{problem.partType}</span>
                    </div>
                  </div>
                )
              })}
              {skill.problems.length > 20 && (
                <p
                  className={css({
                    fontSize: '0.75rem',
                    color: isDark ? 'gray.500' : 'gray.500',
                    textAlign: 'center',
                    marginTop: '0.5rem',
                  })}
                >
                  + {skill.problems.length - 20} more problems
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function SkillsClient({
  studentId,
  player,
  curriculum,
  skills,
  problemHistory,
}: SkillsClientProps) {
  const { isDark } = useTheme()
  const [selectedSkill, setSelectedSkill] = useState<ProcessedSkill | null>(null)

  // Process skills
  const processedSkills = useMemo(
    () => processSkills(skills, problemHistory),
    [skills, problemHistory]
  )

  // Filter practicing skills only
  const practicingSkills = useMemo(
    () => processedSkills.filter((s) => s.isPracticing),
    [processedSkills]
  )

  // Categorize skills
  const interventionNeeded = useMemo(
    () =>
      practicingSkills.filter(
        (s) => s.needsReinforcement || (s.fluencyState === 'practicing' && s.accuracy < 0.7)
      ),
    [practicingSkills]
  )

  const readyToAdvance = useMemo(
    () =>
      practicingSkills.filter(
        (s) => s.fluencyState === 'effortless' || s.fluencyState === 'fluent'
      ),
    [practicingSkills]
  )

  const rustySkills = useMemo(
    () => practicingSkills.filter((s) => s.fluencyState === 'rusty'),
    [practicingSkills]
  )

  // Group by category for the grid
  const skillsByCategory = useMemo(() => {
    const groups = new Map<string, ProcessedSkill[]>()
    for (const skill of practicingSkills) {
      const category = getCategoryFromSkillId(skill.skillId)
      const existing = groups.get(category.id) ?? []
      existing.push(skill)
      groups.set(category.id, existing)
    }

    // Sort groups by category order
    return Array.from(groups.entries())
      .map(([categoryId, skills]) => ({
        category: SKILL_CATEGORIES[categoryId] ?? {
          id: categoryId,
          name: categoryId,
          emoji: '❓',
          order: 99,
        },
        skills: skills.sort((a, b) => a.displayName.localeCompare(b.displayName)),
      }))
      .sort((a, b) => a.category.order - b.category.order)
  }, [practicingSkills])

  const handleSkillClick = useCallback((skill: ProcessedSkill) => {
    setSelectedSkill(skill)
  }, [])

  const handleCloseDrawer = useCallback(() => {
    setSelectedSkill(null)
  }, [])

  return (
    <PageWithNav title={`${player.name}'s Skills`} isDark={isDark}>
      {/* Sub-navigation */}
      <PracticeSubNav student={player} />

      {/* Main content */}
      <div
        data-component="skills-dashboard"
        className={css({
          padding: '1rem',
          maxWidth: '1200px',
          margin: '0 auto',
        })}
      >
        {/* Page header */}
        <div
          className={css({
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          })}
        >
          <div>
            <h1
              className={css({
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: isDark ? 'gray.100' : 'gray.900',
              })}
            >
              Skills Dashboard
            </h1>
            <p
              className={css({
                fontSize: '0.875rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              {practicingSkills.length} skills in practice • Click any skill for details
            </p>
          </div>
          <Link
            href={`/practice/${studentId}/dashboard`}
            className={css({
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              backgroundColor: isDark ? 'gray.700' : 'gray.200',
              color: isDark ? 'gray.200' : 'gray.700',
              fontSize: '0.875rem',
              textDecoration: 'none',
              _hover: {
                backgroundColor: isDark ? 'gray.600' : 'gray.300',
              },
            })}
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Summary cards */}
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          })}
        >
          <div
            data-element="summary-card"
            data-type="intervention"
            className={css({
              padding: '1rem',
              borderRadius: '12px',
              backgroundColor: isDark ? 'red.900/30' : 'red.50',
              border: '2px solid',
              borderColor: isDark ? 'red.700/50' : 'red.200',
            })}
          >
            <div
              className={css({
                fontSize: '2rem',
                fontWeight: 'bold',
                color: isDark ? 'red.300' : 'red.600',
              })}
            >
              {interventionNeeded.length}
            </div>
            <div className={css({ fontSize: '0.875rem', color: isDark ? 'red.400' : 'red.700' })}>
              Appear in frequent errors
            </div>
          </div>

          <div
            data-element="summary-card"
            data-type="rusty"
            className={css({
              padding: '1rem',
              borderRadius: '12px',
              backgroundColor: isDark ? 'orange.900/30' : 'orange.50',
              border: '2px solid',
              borderColor: isDark ? 'orange.700/50' : 'orange.200',
            })}
          >
            <div
              className={css({
                fontSize: '2rem',
                fontWeight: 'bold',
                color: isDark ? 'orange.300' : 'orange.600',
              })}
            >
              {rustySkills.length}
            </div>
            <div
              className={css({ fontSize: '0.875rem', color: isDark ? 'orange.400' : 'orange.700' })}
            >
              Rusty (needs review)
            </div>
          </div>

          <div
            data-element="summary-card"
            data-type="ready"
            className={css({
              padding: '1rem',
              borderRadius: '12px',
              backgroundColor: isDark ? 'green.900/30' : 'green.50',
              border: '2px solid',
              borderColor: isDark ? 'green.700/50' : 'green.200',
            })}
          >
            <div
              className={css({
                fontSize: '2rem',
                fontWeight: 'bold',
                color: isDark ? 'green.300' : 'green.600',
              })}
            >
              {readyToAdvance.length}
            </div>
            <div
              className={css({ fontSize: '0.875rem', color: isDark ? 'green.400' : 'green.700' })}
            >
              Fluent / Effortless
            </div>
          </div>
        </div>

        {/* Skills appearing frequently in errors */}
        {interventionNeeded.length > 0 && (
          <SkillSection
            title="Appear Frequently in Errors"
            emoji="🔍"
            skills={interventionNeeded}
            isDark={isDark}
            onSkillClick={handleSkillClick}
            emptyMessage="No skills frequently appearing in errors"
          />
        )}

        {/* Rusty skills section */}
        {rustySkills.length > 0 && (
          <SkillSection
            title="Getting Rusty"
            emoji="🌿"
            skills={rustySkills}
            isDark={isDark}
            onSkillClick={handleSkillClick}
            emptyMessage="No rusty skills"
          />
        )}

        {/* All skills by category */}
        <div className={css({ marginTop: '2rem' })}>
          <h2
            className={css({
              fontSize: '1.125rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.900',
              marginBottom: '1rem',
            })}
          >
            All Skills by Category
          </h2>

          {skillsByCategory.length === 0 ? (
            <p
              className={css({
                padding: '2rem',
                textAlign: 'center',
                color: isDark ? 'gray.500' : 'gray.500',
                fontStyle: 'italic',
              })}
            >
              No skills are currently being practiced. Add skills from the dashboard.
            </p>
          ) : (
            skillsByCategory.map(({ category, skills }) => (
              <CategorySection
                key={category.id}
                category={category}
                skills={skills}
                isDark={isDark}
                onSkillClick={handleSkillClick}
              />
            ))
          )}
        </div>
      </div>

      {/* Detail drawer */}
      <SkillDetailDrawer skill={selectedSkill} isDark={isDark} onClose={handleCloseDrawer} />
    </PageWithNav>
  )
}
