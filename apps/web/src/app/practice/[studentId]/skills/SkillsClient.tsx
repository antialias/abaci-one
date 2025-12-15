'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import { ManualSkillSelector } from '@/components/practice/ManualSkillSelector'
import { PracticeSubNav } from '@/components/practice'
import { useTheme } from '@/contexts/ThemeContext'
import type { PlayerCurriculum } from '@/db/schema/player-curriculum'
import {
  calculateFluencyState,
  type FluencyState,
  type PlayerSkillMastery,
} from '@/db/schema/player-skill-mastery'
import type { Player } from '@/db/schema/players'
import {
  computeBktFromHistory,
  getConfidenceLabel,
  getStalenessWarning,
  type BktComputeOptions,
  type SkillBktResult,
} from '@/lib/curriculum/bkt'
import {
  calculateBktMultiplier,
  isBktConfident,
  MASTERY_MULTIPLIERS,
} from '@/lib/curriculum/config'
import { computeMasteryState } from '@/utils/skillComplexity'
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
  /** BKT-computed P(known) estimate [0, 1] */
  pKnown: number | null
  /** Confidence in the pKnown estimate [0, 1] */
  confidence: number | null
  /** Uncertainty range around pKnown */
  uncertaintyRange: { low: number; high: number } | null
  /** BKT mastery classification */
  bktClassification: 'mastered' | 'learning' | 'struggling' | null
  /** Staleness warning message */
  stalenessWarning: string | null
  /** Complexity multiplier used in problem generation (lower = easier problems allowed) */
  complexityMultiplier: number
  /** Whether BKT is being used for this skill's multiplier (vs fluency fallback) */
  usingBktMultiplier: boolean
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
  problemHistory: ProblemResultWithContext[],
  bktResults: Map<string, SkillBktResult>
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

    // Get BKT data for this skill
    const bkt = bktResults.get(skill.skillId)
    const stalenessWarning = getStalenessWarning(daysSinceLastPractice)

    // Calculate complexity multiplier (same logic as problem generation)
    const usingBktMultiplier = bkt !== undefined && isBktConfident(bkt.confidence)
    let complexityMultiplier: number
    if (usingBktMultiplier) {
      // BKT-based continuous multiplier
      complexityMultiplier = calculateBktMultiplier(bkt.pKnown)
    } else {
      // Fluency-based discrete multiplier
      const masteryState = computeMasteryState(
        skill.isPracticing,
        skill.attempts,
        skill.correct,
        skill.consecutiveCorrect,
        daysSinceLastPractice ?? undefined
      )
      complexityMultiplier = MASTERY_MULTIPLIERS[masteryState]
    }

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
      // BKT metrics
      pKnown: bkt?.pKnown ?? null,
      confidence: bkt?.confidence ?? null,
      uncertaintyRange: bkt?.uncertaintyRange ?? null,
      bktClassification: bkt?.masteryClassification ?? null,
      stalenessWarning,
      // Problem generation metrics
      complexityMultiplier,
      usingBktMultiplier,
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

  // Determine status color based on BKT classification or fluency state
  const getStatusColor = () => {
    // Prefer BKT classification if available
    if (skill.bktClassification === 'mastered')
      return { bg: 'green.100', border: 'green.400', text: 'green.700' }
    if (skill.bktClassification === 'struggling')
      return { bg: 'red.100', border: 'red.400', text: 'red.700' }
    if (skill.bktClassification === 'learning')
      return { bg: 'yellow.100', border: 'yellow.400', text: 'yellow.700' }
    // Fallback to fluency state
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
  const confidenceLabel = skill.confidence !== null ? getConfidenceLabel(skill.confidence) : null

  return (
    <button
      type="button"
      data-element="skill-card"
      data-skill-id={skill.skillId}
      data-bkt-classification={skill.bktClassification}
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

      {/* BKT P(known) estimate - honest framing */}
      {skill.pKnown !== null && (
        <div
          className={css({
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.25rem',
            fontSize: '0.75rem',
            marginBottom: '0.25rem',
          })}
        >
          <span
            className={css({
              fontWeight: 'bold',
              color:
                skill.pKnown >= 0.8
                  ? isDark
                    ? 'green.400'
                    : 'green.600'
                  : skill.pKnown < 0.5
                    ? isDark
                      ? 'red.400'
                      : 'red.600'
                    : isDark
                      ? 'yellow.400'
                      : 'yellow.600',
            })}
          >
            ~{Math.round(skill.pKnown * 100)}%
          </span>
          {confidenceLabel && (
            <span
              className={css({ color: isDark ? 'gray.500' : 'gray.500', fontSize: '0.625rem' })}
            >
              ({confidenceLabel})
            </span>
          )}
        </div>
      )}

      {/* Evidence counts - secondary info */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.6875rem',
          color: isDark ? 'gray.500' : 'gray.500',
        })}
      >
        <span title="Problems answered correctly">{skill.correct} correct</span>
        {errorCount > 0 && (
          <>
            <span>•</span>
            <span title="Problems with errors">{errorCount} errors</span>
          </>
        )}
      </div>

      {/* Staleness warning if applicable */}
      {skill.stalenessWarning && (
        <span
          className={css({
            marginTop: '0.25rem',
            fontSize: '0.625rem',
            color: isDark ? 'orange.400' : 'orange.600',
            fontStyle: 'italic',
          })}
        >
          {skill.stalenessWarning}
        </span>
      )}

      {/* BKT classification badge */}
      {skill.bktClassification && (
        <span
          className={css({
            marginTop: '0.375rem',
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
          {skill.bktClassification}
        </span>
      )}
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

        {/* BKT Mastery Estimate - primary metric */}
        {skill.pKnown !== null && (
          <div
            className={css({
              padding: '1rem',
              borderBottom: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
              backgroundColor:
                skill.pKnown >= 0.8
                  ? isDark
                    ? 'green.900/20'
                    : 'green.50'
                  : skill.pKnown < 0.5
                    ? isDark
                      ? 'red.900/20'
                      : 'red.50'
                    : isDark
                      ? 'yellow.900/20'
                      : 'yellow.50',
            })}
          >
            <div
              className={css({
                fontSize: '0.75rem',
                color: isDark ? 'gray.400' : 'gray.600',
                marginBottom: '0.25rem',
              })}
            >
              Estimated Mastery
            </div>
            <div
              className={css({
                display: 'flex',
                alignItems: 'baseline',
                gap: '0.5rem',
              })}
            >
              <span
                className={css({
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  color:
                    skill.pKnown >= 0.8
                      ? isDark
                        ? 'green.400'
                        : 'green.600'
                      : skill.pKnown < 0.5
                        ? isDark
                          ? 'red.400'
                          : 'red.600'
                        : isDark
                          ? 'yellow.400'
                          : 'yellow.600',
                })}
              >
                ~{Math.round(skill.pKnown * 100)}%
              </span>
              {skill.confidence !== null && (
                <span
                  className={css({
                    fontSize: '0.875rem',
                    color: isDark ? 'gray.400' : 'gray.600',
                  })}
                >
                  ({getConfidenceLabel(skill.confidence)} confidence)
                </span>
              )}
            </div>
            {skill.uncertaintyRange && (
              <div
                className={css({
                  fontSize: '0.75rem',
                  color: isDark ? 'gray.500' : 'gray.500',
                  marginTop: '0.25rem',
                })}
              >
                Range: {Math.round(skill.uncertaintyRange.low * 100)}% -{' '}
                {Math.round(skill.uncertaintyRange.high * 100)}%
              </div>
            )}
          </div>
        )}

        {/* Problem Generation Impact */}
        <div
          className={css({
            padding: '1rem',
            borderBottom: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
            backgroundColor: isDark ? 'purple.900/20' : 'purple.50',
          })}
        >
          <div
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.400' : 'gray.600',
              marginBottom: '0.5rem',
            })}
          >
            Problem Generation Impact
          </div>
          <div
            className={css({
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.5rem',
              marginBottom: '0.375rem',
            })}
          >
            <span
              className={css({
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: isDark ? 'purple.300' : 'purple.600',
              })}
            >
              {skill.complexityMultiplier.toFixed(2)}×
            </span>
            <span
              className={css({
                fontSize: '0.875rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              complexity multiplier
            </span>
          </div>
          <div
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.500' : 'gray.500',
            })}
          >
            {skill.usingBktMultiplier ? (
              <>Using Bayesian estimate (adaptive mode)</>
            ) : (
              <>Using fluency threshold (classic mode)</>
            )}
          </div>
          <div
            className={css({
              fontSize: '0.6875rem',
              color: isDark ? 'gray.500' : 'gray.500',
              marginTop: '0.375rem',
              fontStyle: 'italic',
            })}
          >
            Lower multiplier = skill costs less budget = more skills can appear together
          </div>
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
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [selectedSkill, setSelectedSkill] = useState<ProcessedSkill | null>(null)
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5)
  const [applyDecay, setApplyDecay] = useState(false)
  const [useCrossStudentPriors, setUseCrossStudentPriors] = useState(false)
  const [showManualSkillModal, setShowManualSkillModal] = useState(false)

  // Compute BKT from problem history
  const bktResult = useMemo(() => {
    const options: BktComputeOptions = {
      confidenceThreshold,
      useCrossStudentPriors,
      applyDecay,
      decayHalfLifeDays: 30,
    }
    return computeBktFromHistory(problemHistory, options)
  }, [problemHistory, confidenceThreshold, applyDecay, useCrossStudentPriors])

  // Create a map of BKT results by skill ID for easy lookup
  const bktResultsMap = useMemo(() => {
    const map = new Map<string, SkillBktResult>()
    for (const skill of bktResult.skills) {
      map.set(skill.skillId, skill)
    }
    return map
  }, [bktResult])

  // Process skills with BKT data
  const processedSkills = useMemo(
    () => processSkills(skills, problemHistory, bktResultsMap),
    [skills, problemHistory, bktResultsMap]
  )

  // Filter practicing skills only
  const practicingSkills = useMemo(
    () => processedSkills.filter((s) => s.isPracticing),
    [processedSkills]
  )

  // Categorize skills using BKT classification
  const interventionNeeded = useMemo(
    () =>
      practicingSkills.filter(
        (s) =>
          s.bktClassification === 'struggling' ||
          s.needsReinforcement ||
          (s.bktClassification === null && s.fluencyState === 'practicing' && s.accuracy < 0.7)
      ),
    [practicingSkills]
  )

  const readyToAdvance = useMemo(
    () =>
      practicingSkills.filter(
        (s) =>
          s.bktClassification === 'mastered' ||
          (s.bktClassification === null &&
            (s.fluencyState === 'effortless' || s.fluencyState === 'fluent'))
      ),
    [practicingSkills]
  )

  const learningSkills = useMemo(
    () =>
      practicingSkills.filter(
        (s) =>
          s.bktClassification === 'learning' ||
          (s.bktClassification === null && s.fluencyState === 'practicing')
      ),
    [practicingSkills]
  )

  const rustySkills = useMemo(
    () => practicingSkills.filter((s) => s.stalenessWarning !== null),
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

  // Handle saving manual skill selections
  const handleSaveManualSkills = useCallback(
    async (masteredSkillIds: string[]): Promise<void> => {
      const response = await fetch(`/api/curriculum/${studentId}/skills`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masteredSkillIds }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save skills')
      }

      // Reload the page to show updated skills
      router.refresh()
      setShowManualSkillModal(false)
    },
    [studentId, router]
  )

  // Handle refreshing a skill's recency (sets lastPracticedAt to today)
  const handleRefreshSkill = useCallback(
    async (skillId: string): Promise<void> => {
      const response = await fetch(`/api/curriculum/${studentId}/skills`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to refresh skill')
      }

      // Reload to show updated mastery state
      router.refresh()
    },
    [studentId, router]
  )

  return (
    <PageWithNav navTitle={`${player.name}'s Skills`}>
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
            flexWrap: 'wrap',
            gap: '1rem',
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
          <div className={css({ display: 'flex', gap: '0.5rem', alignItems: 'center' })}>
            <button
              type="button"
              data-action="manage-skills"
              onClick={() => setShowManualSkillModal(true)}
              className={css({
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                backgroundColor: isDark ? 'purple.900' : 'purple.100',
                color: isDark ? 'purple.200' : 'purple.700',
                fontSize: '0.875rem',
                fontWeight: 'medium',
                border: '1px solid',
                borderColor: isDark ? 'purple.700' : 'purple.300',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                _hover: {
                  backgroundColor: isDark ? 'purple.800' : 'purple.200',
                },
              })}
            >
              Manage Skills
            </button>
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
              ← Dashboard
            </Link>
          </div>
        </div>

        {/* Confidence threshold control */}
        <div
          data-element="confidence-control"
          className={css({
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            backgroundColor: isDark ? 'gray.800' : 'gray.100',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
          })}
        >
          <label
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.400' : 'gray.600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            })}
          >
            Confidence threshold:
            <input
              type="range"
              min="0.3"
              max="0.8"
              step="0.05"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
              className={css({
                width: '100px',
                accentColor: isDark ? 'blue.400' : 'blue.600',
              })}
            />
            <span className={css({ fontWeight: 'bold', minWidth: '2.5rem' })}>
              {(confidenceThreshold * 100).toFixed(0)}%
            </span>
          </label>
          <span
            className={css({
              fontSize: '0.6875rem',
              color: isDark ? 'gray.500' : 'gray.500',
              fontStyle: 'italic',
            })}
          >
            Higher = stricter classification, lower = more lenient
          </span>

          {/* Decay toggle */}
          <label
            data-setting="decay-toggle"
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.400' : 'gray.600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
            })}
          >
            <input
              type="checkbox"
              checked={applyDecay}
              onChange={(e) => setApplyDecay(e.target.checked)}
              className={css({
                accentColor: isDark ? 'blue.400' : 'blue.600',
              })}
            />
            Apply decay
            <span
              className={css({
                fontSize: '0.625rem',
                color: isDark ? 'gray.500' : 'gray.500',
                fontStyle: 'italic',
              })}
            >
              (30-day half-life)
            </span>
          </label>

          {/* Cross-student priors toggle */}
          <label
            data-setting="cross-student-priors-toggle"
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.400' : 'gray.600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              opacity: 0.5,
            })}
            title="Coming soon: Use aggregate data from all students to inform initial estimates"
          >
            <input
              type="checkbox"
              checked={useCrossStudentPriors}
              onChange={(e) => setUseCrossStudentPriors(e.target.checked)}
              disabled
              className={css({
                accentColor: isDark ? 'blue.400' : 'blue.600',
              })}
            />
            Cross-student priors
            <span
              className={css({
                fontSize: '0.625rem',
                color: isDark ? 'gray.500' : 'gray.500',
                fontStyle: 'italic',
              })}
            >
              (coming soon)
            </span>
          </label>
        </div>

        {/* Summary cards */}
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          })}
        >
          <div
            data-element="summary-card"
            data-type="struggling"
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
              Struggling
            </div>
          </div>

          <div
            data-element="summary-card"
            data-type="learning"
            className={css({
              padding: '1rem',
              borderRadius: '12px',
              backgroundColor: isDark ? 'yellow.900/30' : 'yellow.50',
              border: '2px solid',
              borderColor: isDark ? 'yellow.700/50' : 'yellow.200',
            })}
          >
            <div
              className={css({
                fontSize: '2rem',
                fontWeight: 'bold',
                color: isDark ? 'yellow.300' : 'yellow.600',
              })}
            >
              {learningSkills.length}
            </div>
            <div
              className={css({ fontSize: '0.875rem', color: isDark ? 'yellow.400' : 'yellow.700' })}
            >
              Learning
            </div>
          </div>

          <div
            data-element="summary-card"
            data-type="stale"
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
              Stale
            </div>
          </div>

          <div
            data-element="summary-card"
            data-type="mastered"
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
              Mastered
            </div>
          </div>
        </div>

        {/* Skills that may need intervention */}
        {interventionNeeded.length > 0 && (
          <SkillSection
            title="May Need Attention"
            emoji="🔴"
            skills={interventionNeeded}
            isDark={isDark}
            onSkillClick={handleSkillClick}
            emptyMessage="No skills appear to be struggling"
          />
        )}

        {/* Stale skills section */}
        {rustySkills.length > 0 && (
          <SkillSection
            title="Not Practiced Recently"
            emoji="🟠"
            skills={rustySkills}
            isDark={isDark}
            onSkillClick={handleSkillClick}
            emptyMessage="All skills recently practiced"
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

      {/* Manual Skill Selector Modal */}
      <ManualSkillSelector
        studentName={player.name}
        playerId={player.id}
        open={showManualSkillModal}
        onClose={() => setShowManualSkillModal(false)}
        onSave={handleSaveManualSkills}
        onRefreshSkill={handleRefreshSkill}
        currentMasteredSkills={skills.filter((s) => s.isPracticing).map((s) => s.skillId)}
        skillMasteryData={skills}
      />
    </PageWithNav>
  )
}
