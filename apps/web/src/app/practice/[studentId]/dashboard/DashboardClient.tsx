'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import {
  type ActiveSessionState,
  type CurrentPhaseInfo,
  PracticeSubNav,
  ProgressDashboard,
  StartPracticeModal,
  type StudentWithProgress,
} from '@/components/practice'
import { ManualSkillSelector } from '@/components/practice/ManualSkillSelector'
import {
  type OfflineSessionData,
  OfflineSessionForm,
} from '@/components/practice/OfflineSessionForm'
import { useTheme } from '@/contexts/ThemeContext'
import type { PlayerCurriculum } from '@/db/schema/player-curriculum'
import {
  calculateFluencyState,
  type FluencyState,
  hasFluency,
  type PlayerSkillMastery,
} from '@/db/schema/player-skill-mastery'
import type { Player } from '@/db/schema/players'
import type { PracticeSession } from '@/db/schema/practice-sessions'
import type { SessionPlan } from '@/db/schema/session-plans'
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
import type { ProblemResultWithContext } from '@/lib/curriculum/server'
import { useRefreshSkillRecency, useSetMasteredSkills } from '@/hooks/usePlayerCurriculum'
import { useAbandonSession, useActiveSessionPlan } from '@/hooks/useSessionPlan'
import { computeMasteryState } from '@/utils/skillComplexity'
import { css } from '../../../../../styled-system/css'

// ============================================================================
// Types
// ============================================================================

type TabId = 'overview' | 'skills' | 'history'

interface DashboardClientProps {
  studentId: string
  player: Player
  curriculum: PlayerCurriculum | null
  skills: PlayerSkillMastery[]
  recentSessions: PracticeSession[]
  activeSession: SessionPlan | null
  currentPracticingSkillIds: string[]
  problemHistory: ProblemResultWithContext[]
  initialTab?: TabId
}

/** Processed skill with computed metrics (for Skills tab) */
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
  problems: ProblemResultWithContext[]
  pKnown: number | null
  confidence: number | null
  uncertaintyRange: { low: number; high: number } | null
  bktClassification: 'mastered' | 'learning' | 'struggling' | null
  stalenessWarning: string | null
  complexityMultiplier: number
  usingBktMultiplier: boolean
}

interface SkillCategory {
  id: string
  name: string
  emoji: string
  order: number
}

// ============================================================================
// Constants & Helpers
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
  const parts = skillId.split('.')
  if (parts.length < 2) return skillId
  const value = parts[1]
  if (parts[0] === 'basic') {
    return value
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/^./, (c) => c.toUpperCase())
  }
  if (value.includes('=')) return value
  return value
}

function getPhaseInfo(phaseId: string): CurrentPhaseInfo {
  const parts = phaseId.split('.')
  const level = parts[0]?.replace('L', '') || '1'
  const operation = parts[1] || 'add'
  const number = parts[2] || '+1'
  const technique = parts[3] || 'direct'
  const operationName = operation === 'add' ? 'Addition' : 'Subtraction'
  const techniqueName =
    technique === 'direct'
      ? 'Direct Method'
      : technique === 'five'
        ? 'Five Complement'
        : technique === 'ten'
          ? 'Ten Complement'
          : technique

  return {
    phaseId,
    levelName: `Level ${level}`,
    phaseName: `${operationName}: ${number} (${techniqueName})`,
    description: `Practice ${operation === 'add' ? 'adding' : 'subtracting'} ${number.replace('+', '').replace('-', '')} using the ${techniqueName.toLowerCase()}.`,
    skillsToMaster: [`${operation}.${number}.${technique}`],
    masteredSkills: 0,
    totalSkills: 1,
  }
}

function processSkills(
  skills: PlayerSkillMastery[],
  problemHistory: ProblemResultWithContext[],
  bktResults: Map<string, SkillBktResult>
): ProcessedSkill[] {
  const now = new Date()
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
    const bkt = bktResults.get(skill.skillId)
    const stalenessWarning = getStalenessWarning(daysSinceLastPractice)
    const usingBktMultiplier = bkt !== undefined && isBktConfident(bkt.confidence)

    let complexityMultiplier: number
    if (usingBktMultiplier) {
      complexityMultiplier = calculateBktMultiplier(bkt.pKnown)
    } else {
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
      pKnown: bkt?.pKnown ?? null,
      confidence: bkt?.confidence ?? null,
      uncertaintyRange: bkt?.uncertaintyRange ?? null,
      bktClassification: bkt?.masteryClassification ?? null,
      stalenessWarning,
      complexityMultiplier,
      usingBktMultiplier,
    }
  })
}

// ============================================================================
// Tab Navigation Component
// ============================================================================

function TabNavigation({
  activeTab,
  onTabChange,
  isDark,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  isDark: boolean
}) {
  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📋' },
    { id: 'skills', label: 'Skills', icon: '📊' },
    { id: 'history', label: 'History', icon: '📈' },
  ]

  return (
    <div
      data-component="tab-navigation"
      className={css({
        display: 'flex',
        gap: '0.25rem',
        padding: '0.25rem',
        backgroundColor: isDark ? 'gray.800' : 'gray.100',
        borderRadius: '10px',
        marginBottom: '1.5rem',
      })}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          data-tab={tab.id}
          data-active={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          className={css({
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            fontWeight: 'medium',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            backgroundColor: activeTab === tab.id ? (isDark ? 'gray.700' : 'white') : 'transparent',
            color:
              activeTab === tab.id
                ? isDark
                  ? 'gray.100'
                  : 'gray.900'
                : isDark
                  ? 'gray.400'
                  : 'gray.600',
            boxShadow: activeTab === tab.id ? 'sm' : 'none',
            _hover: {
              backgroundColor:
                activeTab === tab.id
                  ? isDark
                    ? 'gray.700'
                    : 'white'
                  : isDark
                    ? 'gray.750'
                    : 'gray.200',
            },
          })}
        >
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  )
}

// ============================================================================
// Skills Tab Components
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

  const getStatusColor = () => {
    if (skill.bktClassification === 'mastered')
      return { bg: 'green.100', border: 'green.400', text: 'green.700' }
    if (skill.bktClassification === 'struggling')
      return { bg: 'red.100', border: 'red.400', text: 'red.700' }
    if (skill.bktClassification === 'learning')
      return { bg: 'yellow.100', border: 'yellow.400', text: 'yellow.700' }
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
        _hover: { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
      })}
    >
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
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.6875rem',
          color: isDark ? 'gray.500' : 'gray.500',
        })}
      >
        <span>{skill.correct} correct</span>
        {errorCount > 0 && (
          <>
            <span>•</span>
            <span>{errorCount} errors</span>
          </>
        )}
      </div>
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
      <div
        data-element="skill-detail-drawer"
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
            <p className={css({ fontSize: '0.75rem', color: isDark ? 'gray.400' : 'gray.600' })}>
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
              _hover: { backgroundColor: isDark ? 'gray.800' : 'gray.100' },
            })}
          >
            ✕
          </button>
        </div>

        {/* BKT Mastery Estimate */}
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
            <div className={css({ display: 'flex', alignItems: 'baseline', gap: '0.5rem' })}>
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
                  className={css({ fontSize: '0.875rem', color: isDark ? 'gray.400' : 'gray.600' })}
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
              className={css({ fontSize: '0.875rem', color: isDark ? 'gray.400' : 'gray.600' })}
            >
              complexity multiplier
            </span>
          </div>
          <div className={css({ fontSize: '0.75rem', color: isDark ? 'gray.500' : 'gray.500' })}>
            {skill.usingBktMultiplier
              ? 'Using Bayesian estimate (adaptive mode)'
              : 'Using fluency threshold (classic mode)'}
          </div>
        </div>

        {/* Stats */}
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

        {/* Problem history */}
        <div className={css({ flex: 1, overflow: 'auto', padding: '1rem' })}>
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
              {skill.problems.slice(0, 20).map((problem) => {
                const terms = problem.problem.terms
                const problemDisplay = terms
                  .map((t, i) => (i === 0 ? t.toString() : t >= 0 ? `+ ${t}` : `- ${Math.abs(t)}`))
                  .join(' ')
                return (
                  <div
                    key={`${problem.sessionId}-${problem.partNumber}-${problem.slotIndex}`}
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
                      <span className={css({ fontSize: '1rem' })}>
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
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ============================================================================
// Tab Content Components
// ============================================================================

function OverviewTab({
  student,
  currentPhase,
  activeSession,
  isDark,
  onStartPractice,
  onResumePractice,
  onStartOver,
  isStartingOver,
  onViewFullProgress,
  onGenerateWorksheet,
  onRunPlacementTest,
  onRecordOfflinePractice,
}: {
  student: StudentWithProgress
  currentPhase: CurrentPhaseInfo
  activeSession: ActiveSessionState | null
  isDark: boolean
  onStartPractice: () => void
  onResumePractice: () => void
  onStartOver: () => void
  isStartingOver: boolean
  onViewFullProgress: () => void
  onGenerateWorksheet: () => void
  onRunPlacementTest: () => void
  onRecordOfflinePractice: () => void
}) {
  return (
    <ProgressDashboard
      student={student}
      currentPhase={currentPhase}
      activeSession={activeSession}
      onStartPractice={onStartPractice}
      onResumePractice={onResumePractice}
      onStartOver={onStartOver}
      isStartingOver={isStartingOver}
      onViewFullProgress={onViewFullProgress}
      onGenerateWorksheet={onGenerateWorksheet}
      onRunPlacementTest={onRunPlacementTest}
      onRecordOfflinePractice={onRecordOfflinePractice}
    />
  )
}

function SkillsTab({
  skills,
  problemHistory,
  isDark,
  onManageSkills,
}: {
  skills: PlayerSkillMastery[]
  problemHistory: ProblemResultWithContext[]
  isDark: boolean
  onManageSkills: () => void
}) {
  const [selectedSkill, setSelectedSkill] = useState<ProcessedSkill | null>(null)
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5)
  const [applyDecay, setApplyDecay] = useState(false)

  const bktResult = useMemo(() => {
    const options: BktComputeOptions = { confidenceThreshold, applyDecay, decayHalfLifeDays: 30 }
    return computeBktFromHistory(problemHistory, options)
  }, [problemHistory, confidenceThreshold, applyDecay])

  const bktResultsMap = useMemo(() => {
    const map = new Map<string, SkillBktResult>()
    for (const skill of bktResult.skills) map.set(skill.skillId, skill)
    return map
  }, [bktResult])

  const processedSkills = useMemo(
    () => processSkills(skills, problemHistory, bktResultsMap),
    [skills, problemHistory, bktResultsMap]
  )
  const practicingSkills = useMemo(
    () => processedSkills.filter((s) => s.isPracticing),
    [processedSkills]
  )

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

  const skillsByCategory = useMemo(() => {
    const groups = new Map<string, ProcessedSkill[]>()
    for (const skill of practicingSkills) {
      const category = getCategoryFromSkillId(skill.skillId)
      const existing = groups.get(category.id) ?? []
      existing.push(skill)
      groups.set(category.id, existing)
    }
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

  return (
    <div data-tab-content="skills">
      {/* Header with Manage button */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        })}
      >
        <p className={css({ fontSize: '0.875rem', color: isDark ? 'gray.400' : 'gray.600' })}>
          {practicingSkills.length} skills in practice • Click any skill for details
        </p>
        <button
          type="button"
          data-action="manage-skills"
          onClick={onManageSkills}
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
            _hover: { backgroundColor: isDark ? 'purple.800' : 'purple.200' },
          })}
        >
          Manage Skills
        </button>
      </div>

      {/* BKT Controls */}
      <div
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
          Confidence:
          <input
            type="range"
            min="0.3"
            max="0.8"
            step="0.05"
            value={confidenceThreshold}
            onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
            className={css({ width: '80px' })}
          />
          <span className={css({ fontWeight: 'bold', minWidth: '2rem' })}>
            {(confidenceThreshold * 100).toFixed(0)}%
          </span>
        </label>
        <label
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
          />
          Apply decay
        </label>
      </div>

      {/* Summary cards */}
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        })}
      >
        {[
          { label: 'Struggling', count: interventionNeeded.length, color: 'red' },
          { label: 'Learning', count: learningSkills.length, color: 'yellow' },
          { label: 'Stale', count: rustySkills.length, color: 'orange' },
          { label: 'Mastered', count: readyToAdvance.length, color: 'green' },
        ].map((item) => (
          <div
            key={item.label}
            className={css({
              padding: '0.75rem',
              borderRadius: '10px',
              backgroundColor: isDark ? `${item.color}.900/30` : `${item.color}.50`,
              border: '2px solid',
              borderColor: isDark ? `${item.color}.700/50` : `${item.color}.200`,
              textAlign: 'center',
            })}
          >
            <div
              className={css({
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: isDark ? `${item.color}.300` : `${item.color}.600`,
              })}
            >
              {item.count}
            </div>
            <div
              className={css({
                fontSize: '0.75rem',
                color: isDark ? `${item.color}.400` : `${item.color}.700`,
              })}
            >
              {item.label}
            </div>
          </div>
        ))}
      </div>

      {/* Attention needed */}
      {interventionNeeded.length > 0 && (
        <div
          className={css({
            padding: '1rem',
            borderRadius: '12px',
            backgroundColor: isDark ? 'gray.800' : 'gray.50',
            marginBottom: '1rem',
          })}
        >
          <h3
            className={css({
              fontSize: '1rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.900',
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            })}
          >
            <span>🔴</span> May Need Attention{' '}
            <span
              className={css({
                padding: '0.125rem 0.5rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                backgroundColor: isDark ? 'gray.700' : 'gray.200',
                color: isDark ? 'gray.300' : 'gray.600',
              })}
            >
              {interventionNeeded.length}
            </span>
          </h3>
          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '0.75rem',
            })}
          >
            {interventionNeeded.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                isDark={isDark}
                onClick={() => setSelectedSkill(skill)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Stale skills */}
      {rustySkills.length > 0 && (
        <div
          className={css({
            padding: '1rem',
            borderRadius: '12px',
            backgroundColor: isDark ? 'gray.800' : 'gray.50',
            marginBottom: '1rem',
          })}
        >
          <h3
            className={css({
              fontSize: '1rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.900',
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            })}
          >
            <span>🟠</span> Not Practiced Recently{' '}
            <span
              className={css({
                padding: '0.125rem 0.5rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                backgroundColor: isDark ? 'gray.700' : 'gray.200',
                color: isDark ? 'gray.300' : 'gray.600',
              })}
            >
              {rustySkills.length}
            </span>
          </h3>
          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '0.75rem',
            })}
          >
            {rustySkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                isDark={isDark}
                onClick={() => setSelectedSkill(skill)}
              />
            ))}
          </div>
        </div>
      )}

      {/* All by category */}
      <div className={css({ marginTop: '1.5rem' })}>
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
            No skills in practice. Click "Manage Skills" to add some.
          </p>
        ) : (
          skillsByCategory.map(({ category, skills }) => (
            <div
              key={category.id}
              className={css({
                padding: '1rem',
                borderRadius: '12px',
                backgroundColor: isDark ? 'gray.800' : 'gray.50',
                marginBottom: '1rem',
              })}
            >
              <h3
                className={css({
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  color: isDark ? 'gray.100' : 'gray.900',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                })}
              >
                <span>{category.emoji}</span> {category.name}{' '}
                <span
                  className={css({
                    padding: '0.125rem 0.5rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    backgroundColor: isDark ? 'gray.700' : 'gray.200',
                    color: isDark ? 'gray.300' : 'gray.600',
                  })}
                >
                  {skills.length}
                </span>
              </h3>
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
                    onClick={() => setSelectedSkill(skill)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <SkillDetailDrawer
        skill={selectedSkill}
        isDark={isDark}
        onClose={() => setSelectedSkill(null)}
      />
    </div>
  )
}

function HistoryTab({
  isDark,
  recentSessions,
}: {
  isDark: boolean
  recentSessions: PracticeSession[]
}) {
  return (
    <div data-tab-content="history">
      <div
        className={css({
          padding: '2rem',
          textAlign: 'center',
          borderRadius: '12px',
          backgroundColor: isDark ? 'gray.800' : 'gray.50',
        })}
      >
        <div className={css({ fontSize: '3rem', marginBottom: '1rem' })}>📈</div>
        <h2
          className={css({
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: isDark ? 'gray.100' : 'gray.900',
            marginBottom: '0.5rem',
          })}
        >
          Session History
        </h2>
        <p
          className={css({
            fontSize: '0.875rem',
            color: isDark ? 'gray.400' : 'gray.600',
            marginBottom: '1.5rem',
          })}
        >
          Track your practice sessions over time
        </p>

        {recentSessions.length === 0 ? (
          <p className={css({ color: isDark ? 'gray.500' : 'gray.500', fontStyle: 'italic' })}>
            No sessions recorded yet. Start practicing!
          </p>
        ) : (
          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              textAlign: 'left',
            })}
          >
            {recentSessions.slice(0, 10).map((session) => (
              <div
                key={session.id}
                className={css({
                  padding: '1rem',
                  borderRadius: '8px',
                  backgroundColor: isDark ? 'gray.700' : 'white',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.600' : 'gray.200',
                })}
              >
                <div
                  className={css({
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                  })}
                >
                  <span
                    className={css({ fontWeight: 'bold', color: isDark ? 'gray.100' : 'gray.900' })}
                  >
                    {new Date(session.completedAt || session.createdAt).toLocaleDateString()}
                  </span>
                  <span
                    className={css({
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 'medium',
                      backgroundColor:
                        session.problemsAttempted > 0 &&
                        session.problemsCorrect / session.problemsAttempted >= 0.8
                          ? isDark
                            ? 'green.900'
                            : 'green.100'
                          : isDark
                            ? 'yellow.900'
                            : 'yellow.100',
                      color:
                        session.problemsAttempted > 0 &&
                        session.problemsCorrect / session.problemsAttempted >= 0.8
                          ? isDark
                            ? 'green.300'
                            : 'green.700'
                          : isDark
                            ? 'yellow.300'
                            : 'yellow.700',
                    })}
                  >
                    {session.problemsCorrect}/{session.problemsAttempted} correct
                  </span>
                </div>
                <div
                  className={css({
                    fontSize: '0.75rem',
                    color: isDark ? 'gray.400' : 'gray.600',
                    display: 'flex',
                    gap: '1rem',
                  })}
                >
                  <span>{Math.round((session.totalTimeMs || 0) / 60000)} min</span>
                  <span>
                    {session.problemsAttempted > 0
                      ? Math.round((session.problemsCorrect / session.problemsAttempted) * 100)
                      : 0}
                    % accuracy
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function DashboardClient({
  studentId,
  player,
  curriculum,
  skills,
  recentSessions,
  activeSession: initialActiveSession,
  currentPracticingSkillIds,
  problemHistory,
  initialTab = 'overview',
}: DashboardClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // React Query: Use server props as initial data, get live updates from cache
  const { data: activeSession } = useActiveSessionPlan(studentId, initialActiveSession)

  // React Query mutations
  const abandonMutation = useAbandonSession()
  const setMasteredSkillsMutation = useSetMasteredSkills()
  const refreshSkillMutation = useRefreshSkillRecency()

  // Tab state - sync with URL
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)

  const handleTabChange = useCallback(
    (tab: TabId) => {
      setActiveTab(tab)
      const params = new URLSearchParams(searchParams.toString())
      if (tab === 'overview') {
        params.delete('tab')
      } else {
        params.set('tab', tab)
      }
      router.replace(
        `/practice/${studentId}/dashboard${params.toString() ? `?${params.toString()}` : ''}`,
        { scroll: false }
      )
    },
    [router, studentId, searchParams]
  )

  // Modal states
  const [showOfflineSessionModal, setShowOfflineSessionModal] = useState(false)
  const [showStartPracticeModal, setShowStartPracticeModal] = useState(false)
  const [showManualSkillModal, setShowManualSkillModal] = useState(false)
  const [isStartingOver, setIsStartingOver] = useState(false)

  // Build student object
  const selectedStudent: StudentWithProgress = {
    id: player.id,
    name: player.name,
    emoji: player.emoji,
    color: player.color,
    createdAt: player.createdAt,
  }

  // Build current phase info
  const currentPhase = curriculum
    ? getPhaseInfo(curriculum.currentPhaseId)
    : getPhaseInfo('L1.add.+1.direct')
  if (skills.length > 0) {
    const phaseSkills = skills.filter((s) => currentPhase.skillsToMaster.includes(s.skillId))
    currentPhase.masteredSkills = phaseSkills.filter(
      (s) => s.isPracticing && hasFluency(s.attempts, s.correct, s.consecutiveCorrect)
    ).length
    currentPhase.totalSkills = currentPhase.skillsToMaster.length
  }

  // Build active session state
  const activeSessionState: ActiveSessionState | null = activeSession
    ? (() => {
        const sessionSkillIds = activeSession.masteredSkillIds || []
        const sessionSet = new Set(sessionSkillIds)
        const currentSet = new Set(currentPracticingSkillIds)
        return {
          id: activeSession.id,
          status: activeSession.status as 'draft' | 'approved' | 'in_progress',
          completedCount: activeSession.results.length,
          totalCount: activeSession.summary.totalProblemCount,
          hasSkillMismatch:
            currentPracticingSkillIds.some((id) => !sessionSet.has(id)) ||
            sessionSkillIds.some((id) => !currentSet.has(id)),
          skillsAdded: currentPracticingSkillIds.filter((id) => !sessionSet.has(id)).length,
          skillsRemoved: sessionSkillIds.filter((id) => !currentSet.has(id)).length,
        }
      })()
    : null

  // Calculate avg seconds per problem
  const avgSecondsPerProblem = (() => {
    if (recentSessions.length === 0) return 40
    const totalTime = recentSessions.reduce((sum, s) => sum + (s.totalTimeMs || 0), 0)
    const totalProblems = recentSessions.reduce((sum, s) => sum + s.problemsAttempted, 0)
    return totalProblems === 0 ? 40 : Math.round(totalTime / 1000 / totalProblems)
  })()

  // Handlers
  const handleStartPractice = useCallback(() => setShowStartPracticeModal(true), [])
  const handleViewFullProgress = useCallback(() => {}, [])
  const handleGenerateWorksheet = useCallback(() => {
    window.location.href = '/create/worksheets/addition'
  }, [])
  const handleRunPlacementTest = useCallback(
    () => router.push(`/practice/${studentId}/placement-test`, { scroll: false }),
    [studentId, router]
  )
  const handleRecordOfflinePractice = useCallback(() => setShowOfflineSessionModal(true), [])
  const handleSubmitOfflineSession = useCallback(
    async (data: OfflineSessionData): Promise<void> => {
      console.log('Offline session recorded:', data)
      setShowOfflineSessionModal(false)
    },
    []
  )

  const handleStartOver = useCallback(async () => {
    if (!activeSession) return
    setIsStartingOver(true)
    try {
      await abandonMutation.mutateAsync({
        playerId: studentId,
        planId: activeSession.id,
      })
      router.push(`/practice/${studentId}/configure`)
    } catch (error) {
      console.error('Failed to start over:', error)
    } finally {
      setIsStartingOver(false)
    }
  }, [activeSession, studentId, abandonMutation, router])

  const handleResumeSession = useCallback(
    () => router.push(`/practice/${studentId}`),
    [studentId, router]
  )

  const handleSaveManualSkills = useCallback(
    async (masteredSkillIds: string[]): Promise<void> => {
      await setMasteredSkillsMutation.mutateAsync({
        playerId: studentId,
        masteredSkillIds,
      })
      setShowManualSkillModal(false)
    },
    [studentId, setMasteredSkillsMutation]
  )

  const handleRefreshSkill = useCallback(
    async (skillId: string): Promise<void> => {
      await refreshSkillMutation.mutateAsync({
        playerId: studentId,
        skillId,
      })
    },
    [studentId, refreshSkillMutation]
  )

  return (
    <PageWithNav>
      <PracticeSubNav
        student={selectedStudent}
        pageContext="dashboard"
        onStartPractice={handleStartPractice}
      />

      <main
        data-component="practice-dashboard-page"
        className={css({
          minHeight: '100vh',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          padding: '1.5rem',
        })}
      >
        <div className={css({ maxWidth: '900px', margin: '0 auto' })}>
          <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} isDark={isDark} />

          {activeTab === 'overview' && (
            <OverviewTab
              student={selectedStudent}
              currentPhase={currentPhase}
              activeSession={activeSessionState}
              isDark={isDark}
              onStartPractice={handleStartPractice}
              onResumePractice={handleResumeSession}
              onStartOver={handleStartOver}
              isStartingOver={isStartingOver}
              onViewFullProgress={handleViewFullProgress}
              onGenerateWorksheet={handleGenerateWorksheet}
              onRunPlacementTest={handleRunPlacementTest}
              onRecordOfflinePractice={handleRecordOfflinePractice}
            />
          )}

          {activeTab === 'skills' && (
            <SkillsTab
              skills={skills}
              problemHistory={problemHistory}
              isDark={isDark}
              onManageSkills={() => setShowManualSkillModal(true)}
            />
          )}

          {activeTab === 'history' && (
            <HistoryTab isDark={isDark} recentSessions={recentSessions} />
          )}
        </div>

        {/* Modals */}
        <OfflineSessionForm
          studentName={selectedStudent.name}
          playerId={selectedStudent.id}
          open={showOfflineSessionModal}
          onClose={() => setShowOfflineSessionModal(false)}
          onSubmit={handleSubmitOfflineSession}
        />

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
      </main>

      {showStartPracticeModal && (
        <StartPracticeModal
          studentId={studentId}
          studentName={player.name}
          focusDescription={currentPhase.phaseName}
          avgSecondsPerProblem={avgSecondsPerProblem}
          existingPlan={activeSession}
          onClose={() => setShowStartPracticeModal(false)}
          onStarted={() => setShowStartPracticeModal(false)}
        />
      )}
    </PageWithNav>
  )
}
