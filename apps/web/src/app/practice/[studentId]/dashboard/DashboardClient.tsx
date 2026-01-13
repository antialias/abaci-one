'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SessionObserverModal } from '@/components/classroom/SessionObserverModal'
import { PageWithNav } from '@/components/PageWithNav'
import { useIncomingTransition } from '@/contexts/PageTransitionContext'
import {
  type ActiveSessionState,
  type CurrentPhaseInfo,
  getSkillClassification,
  OfflineSessionModal,
  PracticeErrorBoundary,
  PracticeSubNav,
  ProgressDashboard,
  type SkillClassification,
  type SkillHealthSummary,
  SkillProgressChart,
  StartPracticeModal,
  type StudentWithProgress,
  VirtualizedSessionList,
} from '@/components/practice'
import { getExtendedClassification, type SkillDistribution } from '@/contexts/BktContext'
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
import { useMyClassroom } from '@/hooks/useClassroom'
import { usePlayerPresenceSocket } from '@/hooks/usePlayerPresenceSocket'
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
import { ScoreboardTab } from './ScoreboardTab'

// ============================================================================
// Types
// ============================================================================

type TabId = 'overview' | 'skills' | 'history' | 'scoreboard' | 'notes'

/**
 * Reason why BKT classification is unavailable.
 * Used to provide honest, specific explanations to users.
 */
type InsufficientDataReason =
  | { type: 'never-practiced' }
  | { type: 'too-few-attempts'; attempts: number; needed: number }
  | { type: 'low-confidence'; confidence: number; threshold: number }
  | null

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
  /** Database user ID for session observation authorization */
  userId: string
}

/** Processed skill with computed metrics (for Skills tab) */
interface ProcessedSkill {
  id: string
  skillId: string
  displayName: string
  category: string
  categoryOrder: number
  attempts: number
  correct: number
  isPracticing: boolean
  lastPracticedAt: Date | null
  daysSinceLastPractice: number | null
  avgResponseTimeMs: number | null
  problems: ProblemResultWithContext[]
  pKnown: number | null
  confidence: number | null
  uncertaintyRange: { low: number; high: number } | null
  bktClassification: 'strong' | 'developing' | 'weak' | null
  /** Why BKT classification is unavailable (null if classification exists) */
  insufficientDataReason: InsufficientDataReason
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

// Minimum attempts needed for reliable BKT assessment
// Based on confidence calculation: ~10-15 opportunities gives ~40-50% data confidence
const MIN_ATTEMPTS_FOR_ASSESSMENT = 10

// Confidence threshold for BKT classification
const DEFAULT_CONFIDENCE_THRESHOLD = 0.5

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

/** Skill data needed for computing health summary */
interface SkillForHealthSummary {
  bktClassification: string | null
  stalenessWarning: string | null
}

/**
 * Compute skill health summary from session mode and BKT results.
 * Uses the shared getExtendedClassification for 5-category classification.
 */
function computeSkillHealthSummary(
  sessionMode: SessionMode,
  practicingSkills: SkillForHealthSummary[]
): SkillHealthSummary {
  // Count skills by extended 5-category classification
  const distribution: SkillDistribution = {
    strong: 0,
    stale: 0,
    developing: 0,
    weak: 0,
    unassessed: 0,
    total: practicingSkills.length,
  }

  for (const skill of practicingSkills) {
    const extClass = getExtendedClassification(
      skill.bktClassification as 'strong' | 'developing' | 'weak' | null,
      skill.stalenessWarning
    )
    distribution[extClass]++
  }

  // Legacy counts (deprecated, for backwards compatibility)
  const counts = {
    strong: distribution.strong + distribution.stale, // Legacy: stale was part of strong
    developing: distribution.developing,
    weak: distribution.weak,
    total: practicingSkills.length,
  }

  switch (sessionMode.type) {
    case 'remediation': {
      const weakest = sessionMode.weakSkills[0]
      return {
        mode: 'remediation',
        distribution,
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
        distribution,
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
        distribution,
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
        skillStats.set(skillId, {
          problems: [],
          attempts: 0,
          correct: 0,
          responseTimes: [],
        })
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

    // Get computed stats from problem history
    const stats = skillStats.get(skill.skillId)
    const attempts = stats?.attempts ?? 0
    const correct = stats?.correct ?? 0
    const avgResponseTimeMs =
      stats && stats.responseTimes.length > 0
        ? stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length
        : null
    const problems = stats?.problems ?? []

    const bkt = bktResults.get(skill.skillId)

    // Use BKT's lastPracticedAt (from problem history) as single source of truth
    // This ensures consistency with the chart's staleness calculation
    const lastPracticedAt = bkt?.lastPracticedAt ?? null
    const daysSinceLastPractice = lastPracticedAt
      ? Math.floor((now.getTime() - lastPracticedAt.getTime()) / (1000 * 60 * 60 * 24))
      : null
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

    // Determine why BKT classification is unavailable (if applicable)
    let insufficientDataReason: InsufficientDataReason = null
    if (bkt?.masteryClassification === undefined || bkt?.masteryClassification === null) {
      if (attempts === 0) {
        insufficientDataReason = { type: 'never-practiced' }
      } else if (attempts < MIN_ATTEMPTS_FOR_ASSESSMENT) {
        insufficientDataReason = {
          type: 'too-few-attempts',
          attempts,
          needed: MIN_ATTEMPTS_FOR_ASSESSMENT,
        }
      } else if (bkt && bkt.confidence < DEFAULT_CONFIDENCE_THRESHOLD) {
        insufficientDataReason = {
          type: 'low-confidence',
          confidence: bkt.confidence,
          threshold: DEFAULT_CONFIDENCE_THRESHOLD,
        }
      }
    }

    return {
      id: skill.id,
      skillId: skill.skillId,
      displayName: formatSkillDisplayName(skill.skillId),
      category: category.name,
      categoryOrder: category.order,
      attempts,
      correct,
      isPracticing: skill.isPracticing,
      lastPracticedAt, // Use BKT value (single source of truth from problem history)
      daysSinceLastPractice,
      avgResponseTimeMs,
      problems,
      pKnown: bkt?.pKnown ?? null,
      confidence: bkt?.confidence ?? null,
      uncertaintyRange: bkt?.uncertaintyRange ?? null,
      bktClassification: bkt?.masteryClassification ?? null,
      insufficientDataReason,
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
    { id: 'scoreboard', label: 'Scoreboard', icon: '🏆' },
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

/**
 * Get short display text for insufficient data reason (for skill card)
 */
function getInsufficientDataShortText(reason: InsufficientDataReason): string {
  if (!reason) return ''
  switch (reason.type) {
    case 'never-practiced':
      return 'Not yet practiced'
    case 'too-few-attempts':
      return `${reason.attempts}/${reason.needed} attempts`
    case 'low-confidence':
      return 'Inconclusive'
  }
}

/**
 * Get badge label for insufficient data (for skill card)
 */
function getInsufficientDataBadge(reason: InsufficientDataReason): string {
  if (!reason) return ''
  switch (reason.type) {
    case 'never-practiced':
      return 'New'
    case 'too-few-attempts':
    case 'low-confidence':
      return '?'
  }
}

type AttentionBadge = 'weak' | 'stale'

function SkillCard({
  skill,
  isDark,
  onClick,
  badges,
}: {
  skill: ProcessedSkill
  isDark: boolean
  onClick: () => void
  badges?: AttentionBadge[]
}) {
  const errorCount = skill.attempts - skill.correct

  const getStatusColor = () => {
    if (skill.bktClassification === 'strong')
      return { bg: 'green.100', border: 'green.400', text: 'green.700' }
    if (skill.bktClassification === 'weak')
      return { bg: 'red.100', border: 'red.400', text: 'red.700' }
    if (skill.bktClassification === 'developing')
      return { bg: 'yellow.100', border: 'yellow.400', text: 'yellow.700' }
    // null = insufficient data, show as neutral gray
    return { bg: 'gray.100', border: 'gray.400', text: 'gray.600' }
  }

  const colors = getStatusColor()
  const confidenceLabel = skill.confidence !== null ? getConfidenceLabel(skill.confidence) : null
  const hasInsufficientData =
    skill.bktClassification === null && skill.insufficientDataReason !== null

  return (
    <button
      type="button"
      data-element="skill-card"
      data-skill-id={skill.skillId}
      data-insufficient-data={hasInsufficientData ? 'true' : undefined}
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

      {/* Attention badges (shown in consolidated "Needs Attention" section) */}
      {badges && badges.length > 0 && (
        <div
          className={css({
            display: 'flex',
            gap: '0.25rem',
            marginBottom: '0.25rem',
            flexWrap: 'wrap',
          })}
        >
          {badges.includes('weak') && (
            <span
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.125rem',
                padding: '0.0625rem 0.375rem',
                borderRadius: '999px',
                fontSize: '0.625rem',
                fontWeight: 'medium',
                backgroundColor: isDark ? 'red.900' : 'red.100',
                color: isDark ? 'red.300' : 'red.700',
                border: '1px solid',
                borderColor: isDark ? 'red.700' : 'red.300',
              })}
            >
              Weak <span>🔴</span>
            </span>
          )}
          {badges.includes('stale') && (
            <span
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.125rem',
                padding: '0.0625rem 0.375rem',
                borderRadius: '999px',
                fontSize: '0.625rem',
                fontWeight: 'medium',
                backgroundColor: isDark ? 'orange.900' : 'orange.100',
                color: isDark ? 'orange.300' : 'orange.700',
                border: '1px solid',
                borderColor: isDark ? 'orange.700' : 'orange.300',
              })}
            >
              Stale <span>🕐</span>
            </span>
          )}
        </div>
      )}

      {/* Show BKT estimate if available and valid */}
      {skill.pKnown !== null && Number.isFinite(skill.pKnown) && skill.bktClassification && (
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

      {/* Show insufficient data reason instead of BKT estimate */}
      {hasInsufficientData && (
        <div
          className={css({
            fontSize: '0.75rem',
            color: isDark ? 'gray.400' : 'gray.500',
            marginBottom: '0.25rem',
            fontStyle: 'italic',
          })}
        >
          {getInsufficientDataShortText(skill.insufficientDataReason)}
        </div>
      )}

      {/* Show data error if BKT calculation failed */}
      {skill.pKnown !== null && !Number.isFinite(skill.pKnown) && (
        <span
          className={css({
            fontWeight: 'bold',
            color: isDark ? 'orange.400' : 'orange.600',
            fontSize: '0.75rem',
            marginBottom: '0.25rem',
          })}
          title="BKT calculation error - check browser console for details"
        >
          ⚠️ Data Error
        </span>
      )}

      {/* Stats row */}
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

      {/* Staleness proof - show days since practice */}
      {skill.stalenessWarning && skill.daysSinceLastPractice !== null && (
        <span
          className={css({
            marginTop: '0.25rem',
            fontSize: '0.625rem',
            color: isDark ? 'orange.400' : 'orange.600',
            fontStyle: 'italic',
          })}
        >
          {Math.round(skill.daysSinceLastPractice)}d since practice
        </span>
      )}

      {/* Classification badge - either BKT classification or insufficient data indicator */}
      {skill.bktClassification ? (
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
      ) : hasInsufficientData ? (
        <span
          className={css({
            marginTop: '0.375rem',
            padding: '0.125rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.625rem',
            fontWeight: 'bold',
            backgroundColor: isDark ? 'gray.700' : 'gray.200',
            color: isDark ? 'gray.400' : 'gray.600',
            alignSelf: 'flex-start',
          })}
        >
          {getInsufficientDataBadge(skill.insufficientDataReason)}
        </span>
      ) : null}
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
                  {skill.stalenessWarning}
                </div>
                {skill.lastPracticedAt && skill.daysSinceLastPractice !== null && (
                  <div
                    className={css({
                      fontSize: '0.75rem',
                      color: isDark ? 'orange.400' : 'orange.600',
                    })}
                  >
                    Last practiced{' '}
                    {new Date(skill.lastPracticedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    ({Math.round(skill.daysSinceLastPractice)} days ago)
                  </div>
                )}
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

        {/* Insufficient Data Alert - shown when we can't classify the skill */}
        {skill.insufficientDataReason && (
          <div
            data-section="insufficient-data-alert"
            className={css({
              padding: '1rem',
              borderBottom: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
              backgroundColor: isDark ? 'gray.800' : 'gray.50',
            })}
          >
            <div
              className={css({
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                marginBottom: '1rem',
              })}
            >
              <span className={css({ fontSize: '1.5rem' })}>ℹ️</span>
              <div>
                <div
                  className={css({
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    color: isDark ? 'gray.200' : 'gray.800',
                    marginBottom: '0.25rem',
                  })}
                >
                  Not Enough Data to Assess Mastery
                </div>
                <div
                  className={css({
                    fontSize: '0.875rem',
                    color: isDark ? 'gray.400' : 'gray.600',
                    lineHeight: '1.5',
                  })}
                >
                  {skill.insufficientDataReason.type === 'never-practiced' && (
                    <>
                      This skill hasn&apos;t been practiced yet. We can&apos;t assess mastery
                      without practice data.
                    </>
                  )}
                  {skill.insufficientDataReason.type === 'too-few-attempts' && (
                    <>
                      Only {skill.insufficientDataReason.attempts} attempts recorded. Reliable
                      assessment requires approximately {skill.insufficientDataReason.needed}+
                      attempts.
                    </>
                  )}
                  {skill.insufficientDataReason.type === 'low-confidence' && (
                    <>
                      Results have been mixed ({skill.correct}/{skill.attempts} correct). We
                      can&apos;t confidently classify this skill yet.
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* What we know */}
            {skill.attempts > 0 && (
              <div
                className={css({
                  backgroundColor: isDark ? 'gray.900' : 'white',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                })}
              >
                <div
                  className={css({
                    fontSize: '0.75rem',
                    fontWeight: 'medium',
                    color: isDark ? 'gray.400' : 'gray.600',
                    marginBottom: '0.5rem',
                  })}
                >
                  What we know:
                </div>
                <div
                  className={css({
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                  })}
                >
                  <div className={css({ textAlign: 'center' })}>
                    <div
                      className={css({
                        fontWeight: 'bold',
                        color: isDark ? 'gray.200' : 'gray.800',
                      })}
                    >
                      {skill.attempts}
                    </div>
                    <div
                      className={css({
                        fontSize: '0.6875rem',
                        color: isDark ? 'gray.500' : 'gray.500',
                      })}
                    >
                      Attempts
                    </div>
                  </div>
                  <div className={css({ textAlign: 'center' })}>
                    <div
                      className={css({
                        fontWeight: 'bold',
                        color: isDark ? 'gray.200' : 'gray.800',
                      })}
                    >
                      {skill.correct}
                    </div>
                    <div
                      className={css({
                        fontSize: '0.6875rem',
                        color: isDark ? 'gray.500' : 'gray.500',
                      })}
                    >
                      Correct
                    </div>
                  </div>
                  <div className={css({ textAlign: 'center' })}>
                    <div
                      className={css({
                        fontWeight: 'bold',
                        color: isDark ? 'gray.200' : 'gray.800',
                      })}
                    >
                      {skill.confidence !== null ? `${Math.round(skill.confidence * 100)}%` : '—'}
                    </div>
                    <div
                      className={css({
                        fontSize: '0.6875rem',
                        color: isDark ? 'gray.500' : 'gray.500',
                      })}
                    >
                      Confidence
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Remediation guidance */}
            <div
              className={css({
                backgroundColor: isDark ? 'blue.900/30' : 'blue.50',
                borderRadius: '8px',
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
              })}
            >
              <span className={css({ fontSize: '1rem' })}>📝</span>
              <div>
                <div
                  className={css({
                    fontSize: '0.875rem',
                    fontWeight: 'medium',
                    color: isDark ? 'blue.200' : 'blue.700',
                    marginBottom: '0.25rem',
                  })}
                >
                  Recommendation
                </div>
                <div
                  className={css({
                    fontSize: '0.8125rem',
                    color: isDark ? 'blue.300' : 'blue.600',
                    lineHeight: '1.4',
                  })}
                >
                  {skill.insufficientDataReason.type === 'never-practiced' && (
                    <>Start practicing this skill to build mastery.</>
                  )}
                  {skill.insufficientDataReason.type === 'too-few-attempts' && (
                    <>
                      Practice{' '}
                      {skill.insufficientDataReason.needed - skill.insufficientDataReason.attempts}{' '}
                      more problems to get a reliable assessment.
                    </>
                  )}
                  {skill.insufficientDataReason.type === 'low-confidence' && (
                    <>Keep practicing — consistent results will help us assess your mastery.</>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BKT Mastery Estimate - only show if we have confident classification */}
        {skill.pKnown !== null && skill.bktClassification !== null && (
          <div
            className={css({
              padding: '1rem',
              borderBottom: '1px solid',
              borderColor: isDark ? 'gray.700' : 'gray.200',
              backgroundColor: !Number.isFinite(skill.pKnown)
                ? isDark
                  ? 'orange.900/20'
                  : 'orange.50'
                : skill.pKnown >= 0.8
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
            {!Number.isFinite(skill.pKnown) ? (
              <div
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                })}
              >
                <span
                  className={css({
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: isDark ? 'orange.400' : 'orange.600',
                  })}
                >
                  ⚠️ Data Error
                </span>
                <span
                  className={css({
                    fontSize: '0.75rem',
                    color: isDark ? 'gray.400' : 'gray.600',
                  })}
                >
                  BKT calculation failed. Check browser console for details.
                </span>
              </div>
            ) : (
              <>
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
                {skill.uncertaintyRange && Number.isFinite(skill.uncertaintyRange.low) && (
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
              </>
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
  recentSessions,
  isDark,
  onManageSkills,
  studentId,
}: {
  skills: PlayerSkillMastery[]
  problemHistory: ProblemResultWithContext[]
  recentSessions: PracticeSession[]
  isDark: boolean
  onManageSkills: () => void
  studentId: string
}) {
  const [selectedSkill, setSelectedSkill] = useState<ProcessedSkill | null>(null)
  const [activeFilters, setActiveFilters] = useState<Set<SkillClassification>>(new Set())
  const refreshSkillRecency = useRefreshSkillRecency()
  const isRefreshing = refreshSkillRecency.isPending
    ? (refreshSkillRecency.variables?.skillId ?? null)
    : null
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5)
  const [applyDecay, setApplyDecay] = useState(false)

  const bktOptions = useMemo<BktComputeOptions>(
    () => ({
      confidenceThreshold,
      applyDecay,
      decayHalfLifeDays: 30,
      useCrossStudentPriors: false,
    }),
    [confidenceThreshold, applyDecay]
  )

  const bktResult = useMemo(() => {
    return computeBktFromHistory(problemHistory, bktOptions)
  }, [problemHistory, bktOptions])

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

  // Group skills by BKT classification - NO fallback to accuracy heuristics
  // Skills without confident BKT classification go in "needs assessment" group
  const interventionNeeded = useMemo(
    () => practicingSkills.filter((s) => s.bktClassification === 'weak'),
    [practicingSkills]
  )

  const readyToAdvance = useMemo(
    () => practicingSkills.filter((s) => s.bktClassification === 'strong'),
    [practicingSkills]
  )

  const learningSkills = useMemo(
    () => practicingSkills.filter((s) => s.bktClassification === 'developing'),
    [practicingSkills]
  )

  // NEW: Skills that need more practice data before we can assess them
  const needsAssessment = useMemo(
    () =>
      practicingSkills.filter(
        (s) => s.bktClassification === null && s.insufficientDataReason !== null
      ),
    [practicingSkills]
  )

  const rustySkills = useMemo(
    () => practicingSkills.filter((s) => s.stalenessWarning !== null),
    [practicingSkills]
  )

  // Consolidated list of skills needing attention (weak, stale, or both)
  // Deduplicated with priority sorting: weak+stale first, then weak only, then stale only
  const skillsNeedingAttention = useMemo(() => {
    const weakSkillIds = new Set(interventionNeeded.map((s) => s.skillId))
    const staleSkillIds = new Set(rustySkills.map((s) => s.skillId))

    // Collect unique skills with their badge flags
    const skillMap = new Map<string, { skill: ProcessedSkill; isWeak: boolean; isStale: boolean }>()

    for (const skill of interventionNeeded) {
      skillMap.set(skill.skillId, {
        skill,
        isWeak: true,
        isStale: staleSkillIds.has(skill.skillId),
      })
    }

    for (const skill of rustySkills) {
      if (!skillMap.has(skill.skillId)) {
        skillMap.set(skill.skillId, {
          skill,
          isWeak: false,
          isStale: true,
        })
      }
    }

    // Sort by priority: weak+stale > weak only > stale only
    return Array.from(skillMap.values()).sort((a, b) => {
      const priorityA = (a.isWeak ? 2 : 0) + (a.isStale ? 1 : 0)
      const priorityB = (b.isWeak ? 2 : 0) + (b.isStale ? 1 : 0)
      return priorityB - priorityA // Higher priority first
    })
  }, [interventionNeeded, rustySkills])

  // Skills shown in higher-priority sections, grouped by category and section
  const shownElsewhereByCategory = useMemo(() => {
    const byCategory = new Map<string, { attention: number; assessment: number }>()
    for (const { skill } of skillsNeedingAttention) {
      const category = getCategoryFromSkillId(skill.skillId)
      const current = byCategory.get(category.id) ?? {
        attention: 0,
        assessment: 0,
      }
      current.attention++
      byCategory.set(category.id, current)
    }
    for (const skill of needsAssessment) {
      const category = getCategoryFromSkillId(skill.skillId)
      const current = byCategory.get(category.id) ?? {
        attention: 0,
        assessment: 0,
      }
      current.assessment++
      byCategory.set(category.id, current)
    }
    return byCategory
  }, [skillsNeedingAttention, needsAssessment])

  // Set of skill IDs shown elsewhere (for filtering)
  const shownElsewhereIds = useMemo(() => {
    const ids = new Set<string>()
    for (const { skill } of skillsNeedingAttention) {
      ids.add(skill.skillId)
    }
    for (const skill of needsAssessment) {
      ids.add(skill.skillId)
    }
    return ids
  }, [skillsNeedingAttention, needsAssessment])

  // "All Skills by Category" only shows skills NOT in Needs Attention or Needs Assessment
  const skillsByCategory = useMemo(() => {
    const remainingSkills = practicingSkills.filter((s) => !shownElsewhereIds.has(s.skillId))
    const groups = new Map<string, ProcessedSkill[]>()
    for (const skill of remainingSkills) {
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
  }, [practicingSkills, shownElsewhereIds])

  const handleRefreshSkill = useCallback(
    async (skillId: string): Promise<void> => {
      await refreshSkillRecency.mutateAsync({ playerId: studentId, skillId })
    },
    [studentId, refreshSkillRecency]
  )

  // Compute current skill distribution for the chart
  const currentDistribution = useMemo<SkillDistribution>(() => {
    const dist: SkillDistribution = {
      strong: 0,
      stale: 0,
      developing: 0,
      weak: 0,
      unassessed: 0,
      total: practicingSkills.length,
    }

    for (const skill of practicingSkills) {
      const classification = getSkillClassification(skill.bktClassification, skill.stalenessWarning)
      dist[classification]++
    }

    return dist
  }, [practicingSkills])

  // All skill IDs for chart computation
  const allSkillIds = useMemo(() => practicingSkills.map((s) => s.skillId), [practicingSkills])

  // Filter toggle handler
  const handleFilterToggle = useCallback((classification: SkillClassification) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(classification)) {
        next.delete(classification)
      } else {
        next.add(classification)
      }
      return next
    })
  }, [])

  // Check if a skill passes the active filters
  const passesFilter = useCallback(
    (skill: ProcessedSkill): boolean => {
      if (activeFilters.size === 0) return true
      const classification = getSkillClassification(skill.bktClassification, skill.stalenessWarning)
      return activeFilters.has(classification)
    },
    [activeFilters]
  )

  // Filtered versions of skill lists
  const filteredSkillsNeedingAttention = useMemo(
    () => skillsNeedingAttention.filter(({ skill }) => passesFilter(skill)),
    [skillsNeedingAttention, passesFilter]
  )

  const filteredNeedsAssessment = useMemo(
    () => needsAssessment.filter(passesFilter),
    [needsAssessment, passesFilter]
  )

  const filteredSkillsByCategory = useMemo(
    () =>
      skillsByCategory
        .map(({ category, skills }) => ({
          category,
          skills: skills.filter(passesFilter),
        }))
        .filter(({ skills }) => skills.length > 0),
    [skillsByCategory, passesFilter]
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

      {/* Skill Progress Chart with interactive legend */}
      <SkillProgressChart
        sessions={recentSessions}
        problemHistory={problemHistory}
        allSkillIds={allSkillIds}
        currentDistribution={currentDistribution}
        activeFilters={activeFilters}
        onFilterToggle={handleFilterToggle}
        isDark={isDark}
        bktOptions={bktOptions}
      />

      {/* Consolidated: Skills needing attention (weak, stale, or both) */}
      {filteredSkillsNeedingAttention.length > 0 && (
        <div
          data-section="needs-attention"
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
            <span>⚠️</span> Needs Attention{' '}
            <span
              className={css({
                padding: '0.125rem 0.5rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                backgroundColor: isDark ? 'gray.700' : 'gray.200',
                color: isDark ? 'gray.300' : 'gray.600',
              })}
            >
              {filteredSkillsNeedingAttention.length}
            </span>
          </h3>
          <p
            className={css({
              fontSize: '0.8125rem',
              color: isDark ? 'gray.400' : 'gray.600',
              marginBottom: '0.75rem',
              lineHeight: '1.4',
            })}
          >
            Skills that are weak or haven't been practiced recently.
          </p>
          <div
            data-element="skill-grid"
            className={css({
              display: 'grid',
              gridTemplateColumns: {
                base: 'repeat(auto-fill, minmax(140px, 1fr))',
                sm: 'repeat(auto-fill, minmax(160px, 1fr))',
              },
              gap: { base: '0.5rem', sm: '0.75rem' },
            })}
          >
            {filteredSkillsNeedingAttention.map(({ skill, isWeak, isStale }) => {
              const badges: AttentionBadge[] = []
              if (isWeak) badges.push('weak')
              if (isStale) badges.push('stale')
              return (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  isDark={isDark}
                  onClick={() => setSelectedSkill(skill)}
                  badges={badges}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Needs Assessment - skills without enough data to classify */}
      {filteredNeedsAssessment.length > 0 && (
        <div
          data-section="needs-assessment"
          className={css({
            padding: { base: '0.75rem', sm: '1rem' },
            borderRadius: '12px',
            backgroundColor: isDark ? 'gray.800' : 'white',
            border: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
            marginBottom: '1rem',
          })}
        >
          <h3
            className={css({
              fontSize: { base: '0.875rem', sm: '1rem' },
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.900',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
            })}
          >
            <span>📊</span> Needs Assessment{' '}
            <span
              className={css({
                padding: '0.125rem 0.5rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                backgroundColor: isDark ? 'gray.700' : 'gray.200',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              {filteredNeedsAssessment.length}
            </span>
          </h3>
          <p
            className={css({
              fontSize: '0.8125rem',
              color: isDark ? 'gray.400' : 'gray.600',
              marginBottom: '0.75rem',
              lineHeight: '1.4',
            })}
          >
            These skills need more practice before we can assess mastery.
          </p>
          <div
            data-element="skill-grid"
            className={css({
              display: 'grid',
              gridTemplateColumns: {
                base: 'repeat(auto-fill, minmax(120px, 1fr))',
                sm: 'repeat(auto-fill, minmax(140px, 1fr))',
              },
              gap: { base: '0.5rem', sm: '0.75rem' },
            })}
          >
            {filteredNeedsAssessment.map((skill) => (
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

      {/* On Track - skills not needing attention, organized by category */}
      {filteredSkillsByCategory.length > 0 && (
        <div data-section="on-track" className={css({ marginTop: { base: '1rem', sm: '1.5rem' } })}>
          <h2
            className={css({
              fontSize: { base: '1rem', sm: '1.125rem' },
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.900',
              marginBottom: { base: '0.75rem', sm: '1rem' },
            })}
          >
            On Track
          </h2>
          {filteredSkillsByCategory.map(({ category, skills }) => {
            const elsewhere = shownElsewhereByCategory.get(category.id)
            const hasElsewhere = elsewhere && (elsewhere.attention > 0 || elsewhere.assessment > 0)
            return (
              <div
                key={category.id}
                data-category={category.id}
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
                  data-element="skill-grid"
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
                  {hasElsewhere && (
                    <div
                      data-element="elsewhere-placeholder"
                      data-attention-count={elsewhere.attention}
                      data-assessment-count={elsewhere.assessment}
                      className={css({
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: '2px dashed',
                        borderColor: isDark ? 'gray.600' : 'gray.300',
                        color: isDark ? 'gray.500' : 'gray.500',
                        fontSize: '0.6875rem',
                        textAlign: 'center',
                        gap: '0.125rem',
                      })}
                    >
                      {elsewhere.attention > 0 && (
                        <span>+{elsewhere.attention} in Needs Attention</span>
                      )}
                      {elsewhere.assessment > 0 && (
                        <span>+{elsewhere.assessment} in Needs Assessment</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

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
  studentId,
  activeSession,
  onOpenActiveSession,
}: {
  isDark: boolean
  studentId: string
  activeSession?: SessionPlan | null
  onOpenActiveSession?: () => void
}) {
  const [showOfflineModal, setShowOfflineModal] = useState(false)
  const router = useRouter()

  const handleOfflineComplete = useCallback(() => {
    // Refresh the page to show the new session in the list
    router.refresh()
  }, [router])

  return (
    <div data-tab-content="history">
      <div
        className={css({
          padding: { base: '1.25rem', sm: '2rem' },
          borderRadius: '12px',
          backgroundColor: isDark ? 'gray.800' : 'gray.50',
        })}
      >
        <div
          className={css({
            textAlign: 'center',
            marginBottom: { base: '1rem', sm: '1.5rem' },
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
            })}
          >
            Track your practice sessions over time
          </p>
        </div>

        {/* Log Offline Practice button */}
        <div
          className={css({
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '1rem',
          })}
        >
          <button
            type="button"
            data-action="log-offline-practice"
            onClick={() => setShowOfflineModal(true)}
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              px: 4,
              py: 2,
              bg: isDark ? 'gray.700' : 'white',
              color: isDark ? 'gray.100' : 'gray.700',
              border: '1px solid',
              borderColor: isDark ? 'gray.600' : 'gray.300',
              borderRadius: 'md',
              fontSize: 'sm',
              fontWeight: 'medium',
              cursor: 'pointer',
              transition: 'all 0.15s',
              _hover: {
                bg: isDark ? 'gray.600' : 'gray.100',
                borderColor: isDark ? 'gray.500' : 'gray.400',
              },
            })}
          >
            <span>📷</span>
            Log Offline Practice
          </button>
        </div>

        <VirtualizedSessionList
          studentId={studentId}
          isDark={isDark}
          height={400}
          activeSession={activeSession}
          onOpenActiveSession={onOpenActiveSession}
        />
      </div>

      {/* Offline Session Modal */}
      <OfflineSessionModal
        playerId={studentId}
        isOpen={showOfflineModal}
        onClose={() => setShowOfflineModal(false)}
        onComplete={handleOfflineComplete}
      />
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
  userId,
}: DashboardClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Get teacher's classroom for entry prompts
  const { data: myClassroom } = useMyClassroom()
  const classroomId = myClassroom?.id

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

  // Subscribe to player presence updates via WebSocket
  // This ensures the UI updates when teacher removes student from classroom
  usePlayerPresenceSocket(studentId)

  // Handle incoming page transition (from QuickLook modal)
  const { hasTransition, isRevealing, signalReady } = useIncomingTransition()

  // Signal ready when critical data is loaded
  // This triggers the overlay fade-out on the transition
  useEffect(() => {
    if (hasTransition && !isLoadingSessionMode) {
      // Small delay to ensure DOM is painted
      const timer = setTimeout(() => {
        signalReady()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [hasTransition, isLoadingSessionMode, signalReady])

  // Content opacity for cross-fade with transition overlay
  // Starts at 0 when transitioning, fades to 1 when revealing
  const shouldFadeIn = !hasTransition || isRevealing
  const contentOpacity = shouldFadeIn ? 1 : 0
  const contentTransition = isRevealing ? 'opacity 300ms ease-out' : 'none'

  // Debug logging
  useEffect(() => {
    console.log(
      '[DashboardClient] hasTransition:',
      hasTransition,
      'isRevealing:',
      isRevealing,
      'contentOpacity:',
      contentOpacity
    )
  }, [hasTransition, isRevealing, contentOpacity])

  // Tab state - sync with URL
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)

  // Session observer state
  const [isObserving, setIsObserving] = useState(false)

  // Handle session observation from PracticeSubNav action menu
  const handleObserveSession = useCallback(
    (sessionId: string) => {
      // We're already on this student's page, just open the observer modal
      if (activeSession?.id === sessionId) {
        setIsObserving(true)
      }
    },
    [activeSession?.id]
  )

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

  // Auto-open start practice modal if startPractice query param is set
  useEffect(() => {
    if (searchParams.get('startPractice') === 'true') {
      setShowStartPracticeModal(true)
      // Remove the param from URL to prevent re-triggering
      const params = new URLSearchParams(searchParams.toString())
      params.delete('startPractice')
      const newUrl = params.toString()
        ? `/practice/${studentId}/dashboard?${params.toString()}`
        : `/practice/${studentId}/dashboard`
      router.replace(newUrl, { scroll: false })
    }
  }, [searchParams, router, studentId])

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

  // Calculate avg seconds per problem (clamped to MIN_SECONDS_PER_PROBLEM to prevent excessive estimates)
  const avgSecondsPerProblem = (() => {
    if (recentSessions.length === 0) return 40
    const totalTime = recentSessions.reduce((sum, s) => sum + (s.totalTimeMs || 0), 0)
    const totalProblems = recentSessions.reduce((sum, s) => sum + s.problemsAttempted, 0)
    if (totalProblems === 0) return 40
    const calculated = Math.round(totalTime / 1000 / totalProblems)
    return Math.max(10, calculated) // MIN_SECONDS_PER_PROBLEM = 10
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
        <PracticeSubNav
          student={selectedStudent}
          pageContext="dashboard"
          onObserveSession={handleObserveSession}
        />

        <PracticeErrorBoundary studentName={player.name}>
          <main
            data-component="practice-dashboard-page"
            style={{
              opacity: contentOpacity,
              transition: contentTransition,
            }}
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
                  recentSessions={recentSessions}
                  isDark={isDark}
                  onManageSkills={() => setShowManualSkillModal(true)}
                  studentId={studentId}
                />
              )}

              {activeTab === 'history' && (
                <HistoryTab
                  isDark={isDark}
                  studentId={studentId}
                  activeSession={activeSession}
                  onOpenActiveSession={() => setIsObserving(true)}
                />
              )}

              {activeTab === 'scoreboard' && (
                <ScoreboardTab studentId={studentId} classroomId={classroomId} isDark={isDark} />
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

          {/* Session Observer Modal */}
          {isObserving && activeSession && (
            <SessionObserverModal
              isOpen={isObserving}
              onClose={() => setIsObserving(false)}
              session={{
                sessionId: activeSession.id,
                playerId: studentId,
                startedAt:
                  typeof activeSession.createdAt === 'string'
                    ? activeSession.createdAt
                    : activeSession.createdAt instanceof Date
                      ? activeSession.createdAt.toISOString()
                      : new Date().toISOString(),
                currentPartIndex: activeSession.currentPartIndex ?? 0,
                currentSlotIndex: activeSession.currentSlotIndex ?? 0,
                totalParts: activeSession.parts?.length ?? 1,
                totalProblems:
                  activeSession.parts?.reduce((sum, p) => sum + p.slots.length, 0) ?? 0,
                completedProblems:
                  activeSession.results?.filter((r) => r.isCorrect !== null).length ?? 0,
              }}
              student={{
                name: player.name,
                emoji: player.emoji,
                color: player.color,
              }}
              observerId={userId}
              canShare={true}
              classroomId={classroomId}
            />
          )}
        </PracticeErrorBoundary>
      </PageWithNav>
    </SessionModeBannerProvider>
  )
}
