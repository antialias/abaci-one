'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import {
  type ActiveSessionState,
  type CurrentPhaseInfo,
  PracticeSubNav,
  ProgressDashboard,
  type SkillHealthSummary,
  StartPracticeModal,
  type StudentWithProgress,
} from '@/components/practice'
import { ContentBannerSlot, ProjectingBanner } from '@/components/practice/BannerSlots'
import {
  SessionModeBannerProvider,
  useSessionModeBanner,
} from '@/contexts/SessionModeBannerContext'
import { ManualSkillSelector } from '@/components/practice/ManualSkillSelector'
import { useTheme } from '@/contexts/ThemeContext'
import type { PlayerCurriculum } from '@/db/schema/player-curriculum'
import type { PlayerSkillMastery } from '@/db/schema/player-skill-mastery'
import type { Player } from '@/db/schema/players'
import type { PracticeSession } from '@/db/schema/practice-sessions'
import type { SessionPlan } from '@/db/schema/session-plans'
import { useSessionMode } from '@/hooks/useSessionMode'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import { useRefreshSkillRecency, useSetMasteredSkills } from '@/hooks/usePlayerCurriculum'
import { useActiveSessionPlan } from '@/hooks/useSessionPlan'
import {
  type BktComputeOptions,
  computeBktFromHistory,
  getConfidenceLabel,
  getStalenessWarning,
  type SkillBktResult,
} from '@/lib/curriculum/bkt'
import {
  calculateBktMultiplier,
  isBktConfident,
  ROTATION_MULTIPLIERS,
} from '@/lib/curriculum/config'
import type { ProblemResultWithContext } from '@/lib/curriculum/server'
import { computeSkillChanges } from '@/lib/curriculum/skill-changes'
import { api } from '@/lib/queryClient'
import { curriculumKeys } from '@/lib/queryKeys'
import { css } from '../../../../../styled-system/css'

// ============================================================================
// Types
// ============================================================================

type TabId = 'overview' | 'skills' | 'history' | 'notes'

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
  bktClassification: 'strong' | 'developing' | 'weak' | null
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

// Combined height of sticky elements above content area
// Main nav (80px) + Sub-nav (~56px with padding)
const STICKY_HEADER_OFFSET = 136

const SKILL_CATEGORIES: Record<string, SkillCategory> = {
  basic: { id: 'basic', name: 'Basic', emoji: '🔢', order: 1 },
  fiveComplements: {
    id: 'fiveComplements',
    name: 'Five Complements (+)',
    emoji: '✋',
    order: 2,
  },
  fiveComplementsSub: {
    id: 'fiveComplementsSub',
    name: 'Five Complements (-)',
    emoji: '✋',
    order: 3,
  },
  tenComplements: {
    id: 'tenComplements',
    name: 'Ten Complements (+)',
    emoji: '🔟',
    order: 4,
  },
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
  return (
    SKILL_CATEGORIES[categoryKey] ?? {
      id: 'other',
      name: 'Other',
      emoji: '❓',
      order: 99,
    }
  )
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

/**
 * Compute skill health summary from session mode and BKT results
 */
function computeSkillHealthSummary(
  sessionMode: SessionMode,
  practicingSkills: { bktClassification: string | null }[]
): SkillHealthSummary {
  // Count skills by BKT classification
  const counts = {
    strong: practicingSkills.filter((s) => s.bktClassification === 'strong').length,
    developing: practicingSkills.filter((s) => s.bktClassification === 'developing').length,
    weak: practicingSkills.filter((s) => s.bktClassification === 'weak').length,
    total: practicingSkills.length,
  }

  switch (sessionMode.type) {
    case 'remediation': {
      const weakest = sessionMode.weakSkills[0]
      return {
        mode: 'remediation',
        counts,
        context: {
          headline: 'Strengthening Skills',
          detail: sessionMode.focusDescription,
        },
        weakestSkill: weakest
          ? { displayName: weakest.displayName, pKnown: weakest.pKnown }
          : undefined,
      }
    }

    case 'progression': {
      return {
        mode: 'progression',
        counts,
        context: {
          headline: `Learning: ${sessionMode.nextSkill.displayName}`,
          detail: sessionMode.tutorialRequired ? 'Tutorial available' : 'Ready to practice',
        },
        nextSkill: {
          displayName: sessionMode.nextSkill.displayName,
          tutorialRequired: sessionMode.tutorialRequired,
        },
      }
    }

    case 'maintenance': {
      return {
        mode: 'maintenance',
        counts,
        context: {
          headline: 'Great progress!',
          detail: sessionMode.focusDescription,
        },
      }
    }
  }
}

function processSkills(
  skills: PlayerSkillMastery[],
  problemHistory: ProblemResultWithContext[],
  bktResults: Map<string, SkillBktResult>
): ProcessedSkill[] {
  const now = new Date()

  // Group problems by skill and compute stats on-the-fly
  const skillStats = new Map<
    string,
    {
      problems: ProblemResultWithContext[]
      attempts: number
      correct: number
      responseTimes: number[]
    }
  >()

  for (const problem of problemHistory) {
    for (const skillId of problem.skillsExercised) {
      if (!skillStats.has(skillId)) {
        skillStats.set(skillId, { problems: [], attempts: 0, correct: 0, responseTimes: [] })
      }
      const stats = skillStats.get(skillId)!
      stats.problems.push(problem)
      stats.attempts++
      if (problem.isCorrect) {
        stats.correct++
      }
      if (problem.responseTimeMs > 0) {
        stats.responseTimes.push(problem.responseTimeMs)
      }
    }
  }

  return skills.map((skill) => {
    const category = getCategoryFromSkillId(skill.skillId)
    const daysSinceLastPractice = skill.lastPracticedAt
      ? Math.floor(
          (now.getTime() - new Date(skill.lastPracticedAt).getTime()) / (1000 * 60 * 60 * 24)
        )
      : null

    // Get computed stats from problem history
    const stats = skillStats.get(skill.skillId)
    const attempts = stats?.attempts ?? 0
    const correct = stats?.correct ?? 0
    const accuracy = attempts > 0 ? correct / attempts : 0
    const avgResponseTimeMs =
      stats && stats.responseTimes.length > 0
        ? stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length
        : null
    const problems = stats?.problems ?? []

    const bkt = bktResults.get(skill.skillId)
    const stalenessWarning = getStalenessWarning(daysSinceLastPractice)
    const usingBktMultiplier = bkt !== undefined && isBktConfident(bkt.confidence)

    let complexityMultiplier: number
    if (usingBktMultiplier) {
      complexityMultiplier = calculateBktMultiplier(bkt.pKnown)
    } else {
      // Default discrete multiplier based on practice rotation status
      complexityMultiplier = skill.isPracticing
        ? ROTATION_MULTIPLIERS.inRotation
        : ROTATION_MULTIPLIERS.outOfRotation
    }

    return {
      id: skill.id,
      skillId: skill.skillId,
      displayName: formatSkillDisplayName(skill.skillId),
      category: category.name,
      categoryOrder: category.order,
      accuracy,
      attempts,
      correct,
      consecutiveCorrect: 0, // No longer tracked - would need session history analysis
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
    { id: 'notes', label: 'Notes', icon: '📝' },
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
        marginBottom: { base: '1rem', md: '1.5rem' },
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
            flexDirection: { base: 'column', sm: 'row' },
            alignItems: 'center',
            justifyContent: 'center',
            gap: { base: '0.125rem', sm: '0.5rem' },
            padding: { base: '0.5rem 0.25rem', sm: '0.75rem 1rem' },
            fontSize: { base: '0.6875rem', sm: '0.875rem' },
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
          <span className={css({ fontSize: { base: '1rem', sm: '1rem' } })}>{tab.icon}</span>
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
    if (skill.bktClassification === 'strong')
      return { bg: 'green.100', border: 'green.400', text: 'green.700' }
    if (skill.bktClassification === 'weak')
      return { bg: 'red.100', border: 'red.400', text: 'red.700' }
    if (skill.bktClassification === 'developing')
      return { bg: 'yellow.100', border: 'yellow.400', text: 'yellow.700' }
    // null = insufficient data, show as neutral
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
        _hover: {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        },
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
              className={css({
                color: isDark ? 'gray.500' : 'gray.500',
                fontSize: '0.625rem',
              })}
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
  onMarkCurrent,
  isMarkingCurrent,
}: {
  skill: ProcessedSkill | null
  isDark: boolean
  onClose: () => void
  onMarkCurrent?: (skillId: string) => void
  isMarkingCurrent?: boolean
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
              _hover: { backgroundColor: isDark ? 'gray.800' : 'gray.100' },
            })}
          >
            ✕
          </button>
        </div>

        {/* Staleness Alert with Mark Current action */}
        {skill.stalenessWarning && onMarkCurrent && (
          <div
            className={css({
              padding: '1rem',
              borderBottom: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
              backgroundColor: isDark ? 'orange.900/30' : 'orange.50',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            })}
          >
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              })}
            >
              <span className={css({ fontSize: '1.25rem' })}>⏰</span>
              <div>
                <div
                  className={css({
                    fontSize: '0.875rem',
                    fontWeight: 'bold',
                    color: isDark ? 'orange.300' : 'orange.700',
                  })}
                >
                  Not Practiced Recently
                </div>
                <div
                  className={css({
                    fontSize: '0.75rem',
                    color: isDark ? 'orange.400' : 'orange.600',
                  })}
                >
                  {skill.stalenessWarning}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onMarkCurrent(skill.skillId)}
              disabled={isMarkingCurrent}
              data-action="mark-current"
              className={css({
                alignSelf: 'flex-start',
                fontSize: '0.875rem',
                fontWeight: 'medium',
                px: '1rem',
                py: '0.5rem',
                border: '1px solid',
                borderColor: isDark ? 'blue.600' : 'blue.400',
                borderRadius: 'md',
                bg: isDark ? 'blue.800' : 'blue.100',
                color: isDark ? 'blue.200' : 'blue.700',
                cursor: 'pointer',
                _hover: {
                  bg: isDark ? 'blue.700' : 'blue.200',
                },
                _disabled: {
                  opacity: 0.5,
                  cursor: 'wait',
                },
              })}
            >
              {isMarkingCurrent ? 'Marking...' : 'Mark as Current'}
            </button>
            <p
              className={css({
                fontSize: '0.75rem',
                color: isDark ? 'gray.400' : 'gray.600',
                lineHeight: '1.4',
              })}
            >
              If the student has practiced this skill offline, mark it as current to reset the
              staleness timer.
            </p>
          </div>
        )}

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
            {skill.usingBktMultiplier
              ? 'Using Bayesian estimate (high confidence)'
              : 'Using default multiplier (insufficient data)'}
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
            <div
              className={css({
                fontSize: '0.75rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
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
            <div
              className={css({
                fontSize: '0.75rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
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
            <div
              className={css({
                fontSize: '0.75rem',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
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
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              })}
            >
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
  skillHealth,
  onStartPractice,
}: {
  student: StudentWithProgress
  currentPhase?: CurrentPhaseInfo
  skillHealth?: SkillHealthSummary
  onStartPractice: () => void
}) {
  return (
    <ProgressDashboard
      student={student}
      currentPhase={currentPhase}
      skillHealth={skillHealth}
      onStartPractice={onStartPractice}
    />
  )
}

function SkillsTab({
  skills,
  problemHistory,
  isDark,
  onManageSkills,
  studentId,
}: {
  skills: PlayerSkillMastery[]
  problemHistory: ProblemResultWithContext[]
  isDark: boolean
  onManageSkills: () => void
  studentId: string
}) {
  const [selectedSkill, setSelectedSkill] = useState<ProcessedSkill | null>(null)
  const refreshSkillRecency = useRefreshSkillRecency()
  const isRefreshing = refreshSkillRecency.isPending
    ? (refreshSkillRecency.variables?.skillId ?? null)
    : null
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5)
  const [applyDecay, setApplyDecay] = useState(false)

  const bktResult = useMemo(() => {
    const options: BktComputeOptions = {
      confidenceThreshold,
      applyDecay,
      decayHalfLifeDays: 30,
      useCrossStudentPriors: false,
    }
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
          s.bktClassification === 'weak' ||
          s.needsReinforcement ||
          // Insufficient BKT data + low accuracy = likely needs help
          (s.bktClassification === null && s.accuracy < 0.7 && s.attempts >= 5)
      ),
    [practicingSkills]
  )

  const readyToAdvance = useMemo(
    () =>
      practicingSkills.filter(
        (s) =>
          s.bktClassification === 'strong' ||
          // Insufficient BKT data + high accuracy = likely strong
          (s.bktClassification === null && s.accuracy >= 0.85 && s.attempts >= 10)
      ),
    [practicingSkills]
  )

  const learningSkills = useMemo(
    () =>
      practicingSkills.filter(
        (s) =>
          s.bktClassification === 'developing' ||
          // Insufficient BKT data + moderate accuracy = developing
          (s.bktClassification === null && s.accuracy >= 0.5 && s.accuracy < 0.85)
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

  const handleRefreshSkill = useCallback(
    async (skillId: string): Promise<void> => {
      await refreshSkillRecency.mutateAsync({ playerId: studentId, skillId })
    },
    [studentId, refreshSkillRecency]
  )

  return (
    <div data-tab-content="skills">
      {/* Header with Manage button */}
      <div
        className={css({
          display: 'flex',
          flexDirection: { base: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { base: 'stretch', sm: 'center' },
          gap: { base: '0.75rem', sm: '1rem' },
          marginBottom: '1rem',
        })}
      >
        <p
          className={css({
            fontSize: { base: '0.8125rem', sm: '0.875rem' },
            color: isDark ? 'gray.400' : 'gray.600',
          })}
        >
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
            flexShrink: 0,
            _hover: { backgroundColor: isDark ? 'purple.800' : 'purple.200' },
          })}
        >
          Manage Skills
        </button>
      </div>

      {/* BKT Controls */}
      <div
        className={css({
          padding: { base: '0.625rem 0.75rem', sm: '0.75rem 1rem' },
          borderRadius: '8px',
          backgroundColor: isDark ? 'gray.800' : 'gray.100',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: { base: '0.75rem', sm: '1rem' },
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
          gridTemplateColumns: { base: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
          gap: { base: '0.5rem', sm: '0.75rem' },
          marginBottom: { base: '1rem', sm: '1.5rem' },
        })}
      >
        {[
          { label: 'Weak', count: interventionNeeded.length, color: 'red' },
          {
            label: 'Developing',
            count: learningSkills.length,
            color: 'yellow',
          },
          { label: 'Stale', count: rustySkills.length, color: 'orange' },
          { label: 'Strong', count: readyToAdvance.length, color: 'green' },
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
            padding: { base: '0.75rem', sm: '1rem' },
            borderRadius: '12px',
            backgroundColor: isDark ? 'gray.800' : 'gray.50',
            marginBottom: '1rem',
          })}
        >
          <h3
            className={css({
              fontSize: { base: '0.875rem', sm: '1rem' },
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.900',
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
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
              gridTemplateColumns: {
                base: 'repeat(auto-fill, minmax(120px, 1fr))',
                sm: 'repeat(auto-fill, minmax(140px, 1fr))',
              },
              gap: { base: '0.5rem', sm: '0.75rem' },
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

      {/* Stale skills - using consistent SkillCard presentation */}
      {rustySkills.length > 0 && (
        <div
          className={css({
            padding: { base: '0.75rem', sm: '1rem' },
            borderRadius: '12px',
            backgroundColor: isDark ? 'gray.800' : 'white',
            border: '1px solid',
            borderColor: isDark ? 'orange.800' : 'orange.200',
            marginBottom: '1rem',
          })}
        >
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
            })}
          >
            <span className={css({ fontSize: '1.25rem' })}>⏰</span>
            <h3
              className={css({
                fontSize: { base: '0.875rem', sm: '1rem' },
                fontWeight: 'bold',
                color: isDark ? 'gray.100' : 'gray.900',
              })}
            >
              Skills Not Practiced Recently
            </h3>
            <span
              className={css({
                fontSize: '0.75rem',
                backgroundColor: isDark ? 'orange.900' : 'orange.100',
                color: isDark ? 'orange.300' : 'orange.700',
                padding: '0.125rem 0.5rem',
                borderRadius: 'full',
                fontWeight: 'medium',
              })}
            >
              {rustySkills.length}
            </span>
          </div>

          <p
            className={css({
              fontSize: '0.8125rem',
              color: isDark ? 'gray.400' : 'gray.600',
              marginBottom: '0.75rem',
              lineHeight: '1.4',
            })}
          >
            Click any skill for details and to mark as current if practiced offline.
          </p>

          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: {
                base: 'repeat(auto-fill, minmax(140px, 1fr))',
                sm: 'repeat(auto-fill, minmax(160px, 1fr))',
              },
              gap: '0.5rem',
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
      <div className={css({ marginTop: { base: '1rem', sm: '1.5rem' } })}>
        <h2
          className={css({
            fontSize: { base: '1rem', sm: '1.125rem' },
            fontWeight: 'bold',
            color: isDark ? 'gray.100' : 'gray.900',
            marginBottom: { base: '0.75rem', sm: '1rem' },
          })}
        >
          All Skills by Category
        </h2>
        {skillsByCategory.length === 0 ? (
          <p
            className={css({
              padding: { base: '1.5rem', sm: '2rem' },
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
                padding: { base: '0.75rem', sm: '1rem' },
                borderRadius: '12px',
                backgroundColor: isDark ? 'gray.800' : 'gray.50',
                marginBottom: '1rem',
              })}
            >
              <h3
                className={css({
                  fontSize: { base: '0.875rem', sm: '1rem' },
                  fontWeight: 'bold',
                  color: isDark ? 'gray.100' : 'gray.900',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
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
                  gridTemplateColumns: {
                    base: 'repeat(auto-fill, minmax(120px, 1fr))',
                    sm: 'repeat(auto-fill, minmax(140px, 1fr))',
                  },
                  gap: { base: '0.5rem', sm: '0.75rem' },
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
        onMarkCurrent={handleRefreshSkill}
        isMarkingCurrent={isRefreshing === selectedSkill?.skillId}
      />
    </div>
  )
}

function HistoryTab({
  isDark,
  recentSessions,
  studentId,
}: {
  isDark: boolean
  recentSessions: PracticeSession[]
  studentId: string
}) {
  return (
    <div data-tab-content="history">
      <div
        className={css({
          padding: { base: '1.25rem', sm: '2rem' },
          textAlign: 'center',
          borderRadius: '12px',
          backgroundColor: isDark ? 'gray.800' : 'gray.50',
        })}
      >
        <div
          className={css({
            fontSize: { base: '2.5rem', sm: '3rem' },
            marginBottom: '1rem',
          })}
        >
          📈
        </div>
        <h2
          className={css({
            fontSize: { base: '1.125rem', sm: '1.25rem' },
            fontWeight: 'bold',
            color: isDark ? 'gray.100' : 'gray.900',
            marginBottom: '0.5rem',
          })}
        >
          Session History
        </h2>
        <p
          className={css({
            fontSize: { base: '0.8125rem', sm: '0.875rem' },
            color: isDark ? 'gray.400' : 'gray.600',
            marginBottom: { base: '1rem', sm: '1.5rem' },
          })}
        >
          Track your practice sessions over time
        </p>

        {recentSessions.length === 0 ? (
          <p
            className={css({
              color: isDark ? 'gray.500' : 'gray.500',
              fontStyle: 'italic',
            })}
          >
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
              <Link
                key={session.id}
                href={`/practice/${studentId}/session/${session.id}`}
                data-element="session-history-item"
                data-session-id={session.id}
                className={css({
                  display: 'block',
                  padding: '1rem',
                  borderRadius: '8px',
                  backgroundColor: isDark ? 'gray.700' : 'white',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.600' : 'gray.200',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  _hover: {
                    backgroundColor: isDark ? 'gray.650' : 'gray.50',
                    borderColor: isDark ? 'gray.500' : 'gray.300',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  },
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
                    className={css({
                      fontWeight: 'bold',
                      color: isDark ? 'gray.100' : 'gray.900',
                    })}
                  >
                    {new Date(session.completedAt || session.startedAt).toLocaleDateString()}
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
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NotesTab({
  isDark,
  notes,
  studentName,
  playerId,
  onNotesSaved,
}: {
  isDark: boolean
  notes: string | null
  studentName: string
  playerId: string
  onNotesSaved: (notes: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedNotes, setEditedNotes] = useState(notes ?? '')
  const [isSaving, setIsSaving] = useState(false)

  const handleStartEditing = useCallback(() => {
    setEditedNotes(notes ?? '')
    setIsEditing(true)
  }, [notes])

  const handleCancel = useCallback(() => {
    setEditedNotes(notes ?? '')
    setIsEditing(false)
  }, [notes])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/players/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: editedNotes || null }),
      })
      if (!response.ok) throw new Error('Failed to save notes')
      onNotesSaved(editedNotes)
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to save notes:', error)
    } finally {
      setIsSaving(false)
    }
  }, [playerId, editedNotes, onNotesSaved])

  return (
    <div data-tab-content="notes">
      <div
        className={css({
          padding: { base: '1rem', sm: '1.5rem' },
          borderRadius: '12px',
          backgroundColor: isDark ? 'gray.800' : 'gray.50',
        })}
      >
        <div
          className={css({
            display: 'flex',
            flexDirection: { base: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { base: 'stretch', sm: 'center' },
            gap: { base: '0.75rem', sm: '1rem' },
            marginBottom: '1rem',
          })}
        >
          <h2
            className={css({
              fontSize: { base: '1.125rem', sm: '1.25rem' },
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.900',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            })}
          >
            <span>📝</span> Notes for {studentName}
          </h2>
          {!isEditing && (
            <button
              type="button"
              data-action="edit-notes"
              onClick={handleStartEditing}
              className={css({
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                backgroundColor: isDark ? 'blue.900' : 'blue.100',
                color: isDark ? 'blue.200' : 'blue.700',
                fontSize: '0.875rem',
                fontWeight: 'medium',
                border: '1px solid',
                borderColor: isDark ? 'blue.700' : 'blue.300',
                cursor: 'pointer',
                _hover: { backgroundColor: isDark ? 'blue.800' : 'blue.200' },
              })}
            >
              {notes ? 'Edit Notes' : 'Add Notes'}
            </button>
          )}
        </div>

        {isEditing ? (
          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            })}
          >
            <textarea
              data-element="notes-editor"
              value={editedNotes}
              onChange={(e) => setEditedNotes(e.target.value)}
              placeholder="Add notes about this student... observations, reminders, learning preferences, etc."
              className={css({
                width: '100%',
                minHeight: '200px',
                padding: '1rem',
                borderRadius: '8px',
                border: '2px solid',
                borderColor: isDark ? 'gray.600' : 'gray.300',
                backgroundColor: isDark ? 'gray.700' : 'white',
                color: isDark ? 'gray.100' : 'gray.900',
                fontSize: '0.9375rem',
                lineHeight: '1.6',
                resize: 'vertical',
                fontFamily: 'inherit',
                _focus: {
                  outline: 'none',
                  borderColor: 'blue.500',
                },
                _placeholder: {
                  color: isDark ? 'gray.500' : 'gray.400',
                },
              })}
            />
            <div
              className={css({
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
              })}
            >
              <button
                type="button"
                data-action="cancel-notes"
                onClick={handleCancel}
                disabled={isSaving}
                className={css({
                  padding: '0.625rem 1.25rem',
                  borderRadius: '8px',
                  backgroundColor: isDark ? 'gray.700' : 'gray.200',
                  color: isDark ? 'gray.300' : 'gray.700',
                  fontSize: '0.875rem',
                  fontWeight: 'medium',
                  border: 'none',
                  cursor: 'pointer',
                  _hover: { backgroundColor: isDark ? 'gray.600' : 'gray.300' },
                  _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                })}
              >
                Cancel
              </button>
              <button
                type="button"
                data-action="save-notes"
                onClick={handleSave}
                disabled={isSaving}
                className={css({
                  padding: '0.625rem 1.25rem',
                  borderRadius: '8px',
                  backgroundColor: isDark ? 'green.700' : 'green.500',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: 'medium',
                  border: 'none',
                  cursor: 'pointer',
                  _hover: {
                    backgroundColor: isDark ? 'green.600' : 'green.600',
                  },
                  _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                })}
              >
                {isSaving ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>
        ) : notes ? (
          <div
            data-element="notes-display"
            className={css({
              padding: '1rem',
              borderRadius: '8px',
              backgroundColor: isDark ? 'gray.700' : 'white',
              border: '1px solid',
              borderColor: isDark ? 'gray.600' : 'gray.200',
              whiteSpace: 'pre-wrap',
              fontSize: '0.9375rem',
              lineHeight: '1.6',
              color: isDark ? 'gray.200' : 'gray.700',
            })}
          >
            {notes}
          </div>
        ) : (
          <div
            data-element="notes-empty"
            className={css({
              padding: '2rem',
              textAlign: 'center',
              color: isDark ? 'gray.500' : 'gray.400',
              fontStyle: 'italic',
            })}
          >
            No notes yet. Click "Add Notes" to add observations about this student.
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Banner Action Helper
// ============================================================================

interface BannerActionRegistrarProps {
  onAction: () => void
  onResume: () => void
  onStartFresh: () => void
}

/**
 * Helper component that registers the banner action callbacks.
 * Must be used inside SessionModeBannerProvider.
 */
function BannerActionRegistrar({ onAction, onResume, onStartFresh }: BannerActionRegistrarProps) {
  const { setOnAction, setOnResume, setOnStartFresh } = useSessionModeBanner()

  useEffect(() => {
    setOnAction(onAction)
  }, [onAction, setOnAction])

  useEffect(() => {
    setOnResume(onResume)
  }, [onResume, setOnResume])

  useEffect(() => {
    setOnStartFresh(onStartFresh)
  }, [onStartFresh, setOnStartFresh])

  return null
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

  // React Query: Skills data with SSR props as initial data
  // This ensures mutations that invalidate the cache will trigger re-renders
  const { data: skillsQueryData } = useQuery({
    queryKey: curriculumKeys.detail(studentId),
    queryFn: async () => {
      const response = await api(`curriculum/${studentId}`)
      if (!response.ok) throw new Error('Failed to fetch curriculum')
      return response.json()
    },
    initialData: { skills },
    staleTime: 0, // Always refetch when invalidated
  })

  // Use skills from React Query cache (falls back to SSR prop structure)
  const liveSkills: PlayerSkillMastery[] = skillsQueryData?.skills ?? skills

  // React Query mutations
  const setMasteredSkillsMutation = useSetMasteredSkills()

  // Session mode - single source of truth for session planning decisions
  const { data: sessionMode, isLoading: isLoadingSessionMode } = useSessionMode(studentId)

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
  const [showStartPracticeModal, setShowStartPracticeModal] = useState(false)
  const [showManualSkillModal, setShowManualSkillModal] = useState(false)

  // Notes state (local, updated when saved)
  const [currentNotes, setCurrentNotes] = useState<string | null>(player.notes ?? null)

  // Build student object
  const selectedStudent: StudentWithProgress = {
    id: player.id,
    name: player.name,
    emoji: player.emoji,
    color: player.color,
    createdAt: player.createdAt,
  }

  // Build current phase info (deprecated - use skillHealth instead)
  const currentPhase = curriculum
    ? getPhaseInfo(curriculum.currentPhaseId)
    : getPhaseInfo('L1.add.+1.direct')
  if (liveSkills.length > 0) {
    const phaseSkills = liveSkills.filter((s) => currentPhase.skillsToMaster.includes(s.skillId))
    // Use BKT classification for "mastered" count
    currentPhase.masteredSkills = phaseSkills.filter((s) => {
      const bkt = bktResultsMap.get(s.skillId)
      return s.isPracticing && bkt?.masteryClassification === 'strong'
    }).length
    currentPhase.totalSkills = currentPhase.skillsToMaster.length
  }

  // Derive practicing skill IDs from live skills data (reactive to mutations)
  const livePracticingSkillIds = useMemo(
    () => liveSkills.filter((s) => s.isPracticing).map((s) => s.skillId),
    [liveSkills]
  )

  // Compute BKT results for skill changes calculation
  const bktResultsMap = useMemo(() => {
    const result = computeBktFromHistory(problemHistory, {
      confidenceThreshold: 0.5,
      applyDecay: false,
    })
    const map = new Map<string, SkillBktResult>()
    for (const skill of result.skills) {
      map.set(skill.skillId, skill)
    }
    return map
  }, [problemHistory])

  // Process skills with BKT classification for skill health
  const processedSkillsForHealth = useMemo(
    () => processSkills(liveSkills, problemHistory, bktResultsMap),
    [liveSkills, problemHistory, bktResultsMap]
  )

  // Compute skill health summary from session mode + BKT
  const skillHealth = useMemo(() => {
    if (!sessionMode) return undefined
    const practicingSkills = processedSkillsForHealth.filter((s) => s.isPracticing)
    return computeSkillHealthSummary(sessionMode, practicingSkills)
  }, [sessionMode, processedSkillsForHealth])

  // Build active session state for the banner
  const activeSessionState: ActiveSessionState | null = useMemo(() => {
    if (!activeSession) return null

    const sessionSkillIds = activeSession.masteredSkillIds || []

    // Compute skill changes
    const skillChanges = computeSkillChanges(sessionSkillIds, livePracticingSkillIds, bktResultsMap)

    // Determine last activity - use the last result's timestamp if available
    const lastResult = activeSession.results[activeSession.results.length - 1]
    const lastActivityAt = lastResult
      ? new Date(lastResult.timestamp || activeSession.startedAt || activeSession.createdAt)
      : activeSession.startedAt
        ? new Date(activeSession.startedAt)
        : null

    return {
      id: activeSession.id,
      completedCount: activeSession.results.length,
      totalCount: activeSession.summary.totalProblemCount,
      createdAt: new Date(activeSession.createdAt),
      startedAt: activeSession.startedAt ? new Date(activeSession.startedAt) : null,
      lastActivityAt,
      focusDescription: activeSession.summary?.focusDescription ?? 'Practice session',
      sessionSkillIds,
      skillChanges,
    }
  }, [activeSession, livePracticingSkillIds, bktResultsMap])

  // Calculate avg seconds per problem
  const avgSecondsPerProblem = (() => {
    if (recentSessions.length === 0) return 40
    const totalTime = recentSessions.reduce((sum, s) => sum + (s.totalTimeMs || 0), 0)
    const totalProblems = recentSessions.reduce((sum, s) => sum + s.problemsAttempted, 0)
    return totalProblems === 0 ? 40 : Math.round(totalTime / 1000 / totalProblems)
  })()

  // Handlers
  const handleStartPractice = useCallback(() => setShowStartPracticeModal(true), [])

  const handleResumeSession = useCallback(
    () => router.push(`/practice/${studentId}`),
    [studentId, router]
  )

  const handleSaveManualSkills = useCallback(
    async (masteredSkillIds: string[]): Promise<void> => {
      // Optimistic update in the mutation handles immediate UI feedback
      await setMasteredSkillsMutation.mutateAsync({
        playerId: studentId,
        masteredSkillIds,
      })
      setShowManualSkillModal(false)
    },
    [studentId, setMasteredSkillsMutation]
  )

  return (
    <SessionModeBannerProvider
      sessionMode={sessionMode ?? null}
      isLoading={isLoadingSessionMode}
      activeSession={activeSessionState}
    >
      <BannerActionRegistrar
        onAction={handleStartPractice}
        onResume={handleResumeSession}
        onStartFresh={handleStartPractice}
      />
      {/* Single ProjectingBanner renders at provider level */}
      <ProjectingBanner />
      <PageWithNav>
        <PracticeSubNav student={selectedStudent} pageContext="dashboard" />

        <main
          data-component="practice-dashboard-page"
          className={css({
            minHeight: '100vh',
            backgroundColor: isDark ? 'gray.900' : 'gray.50',
            padding: { base: '0.75rem', sm: '1rem', md: '1.5rem' },
          })}
        >
          <div className={css({ maxWidth: '900px', margin: '0 auto' })}>
            {/* Session mode banner - renders in-flow, projects to nav on scroll */}
            <ContentBannerSlot
              stickyOffset={STICKY_HEADER_OFFSET}
              className={css({ marginBottom: '1rem' })}
            />

            <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} isDark={isDark} />

            {activeTab === 'overview' && (
              <OverviewTab
                student={selectedStudent}
                currentPhase={currentPhase}
                skillHealth={skillHealth}
                onStartPractice={handleStartPractice}
              />
            )}

            {activeTab === 'skills' && (
              <SkillsTab
                skills={liveSkills}
                problemHistory={problemHistory}
                isDark={isDark}
                onManageSkills={() => setShowManualSkillModal(true)}
                studentId={studentId}
              />
            )}

            {activeTab === 'history' && (
              <HistoryTab isDark={isDark} recentSessions={recentSessions} studentId={studentId} />
            )}

            {activeTab === 'notes' && (
              <NotesTab
                isDark={isDark}
                notes={currentNotes}
                studentName={player.name}
                playerId={player.id}
                onNotesSaved={setCurrentNotes}
              />
            )}
          </div>

          {/* Modals */}
          <ManualSkillSelector
            studentName={player.name}
            playerId={player.id}
            open={showManualSkillModal}
            onClose={() => setShowManualSkillModal(false)}
            onSave={handleSaveManualSkills}
            currentMasteredSkills={liveSkills.filter((s) => s.isPracticing).map((s) => s.skillId)}
            skillMasteryData={liveSkills}
            bktResultsMap={bktResultsMap}
          />
        </main>

        {showStartPracticeModal && sessionMode && (
          <StartPracticeModal
            studentId={studentId}
            studentName={player.name}
            focusDescription={sessionMode.focusDescription}
            sessionMode={sessionMode}
            avgSecondsPerProblem={avgSecondsPerProblem}
            existingPlan={activeSession}
            problemHistory={problemHistory}
            onClose={() => setShowStartPracticeModal(false)}
            onStarted={() => setShowStartPracticeModal(false)}
          />
        )}
      </PageWithNav>
    </SessionModeBannerProvider>
  )
}
