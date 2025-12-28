'use client'

import dynamic from 'next/dynamic'
import { useCallback, useMemo, useState } from 'react'

// Dynamic import echarts to avoid bundling 58MB library on pages that don't use charts
const ReactECharts = dynamic(() => import('echarts-for-react'), {
  ssr: false,
  loading: () => (
    <div
      style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      Loading chart...
    </div>
  ),
})
import {
  getExtendedClassification,
  type ExtendedSkillClassification,
  type SkillDistribution,
} from '@/contexts/BktContext'
import type { PracticeSession } from '@/db/schema/practice-sessions'
import {
  type BktComputeOptions,
  computeBktFromHistory,
  getStalenessWarning,
} from '@/lib/curriculum/bkt'
import type { ProblemResultWithContext } from '@/lib/curriculum/server'
import { css } from '../../../styled-system/css'

// ============================================================================
// Time Window Types
// ============================================================================

/** Represents a time window preset */
interface TimeWindowPreset {
  /** Unique key for this preset */
  key: string
  /** Display label (e.g., "Recent", "Last 15", "All") */
  label: string
  /** Number of sessions to show (null = all) */
  sessionCount: number | null
}

// ============================================================================
// Types (re-exported from BktContext for convenience)
// ============================================================================

/** @deprecated Use ExtendedSkillClassification from BktContext */
export type SkillClassification = ExtendedSkillClassification

// Re-export SkillDistribution for backwards compatibility
export type { SkillDistribution } from '@/contexts/BktContext'

interface SessionSnapshot {
  sessionId: string
  date: Date
  distribution: SkillDistribution
}

interface SkillProgressChartProps {
  sessions: PracticeSession[]
  problemHistory: ProblemResultWithContext[]
  allSkillIds: string[]
  currentDistribution: SkillDistribution
  activeFilters: Set<SkillClassification>
  onFilterToggle: (classification: SkillClassification) => void
  isDark: boolean
  bktOptions: BktComputeOptions
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Color design rationale:
 * - Strong & Stale are both "mastered" skills, so they share the green family
 *   - Strong: Vibrant emerald green (healthy, fresh)
 *   - Stale: Sage/olive green with gold undertone (aged, needs refresh)
 * - Developing & Weak are both "in progress", so they share the blue-violet family
 *   - Developing: Clear blue (learning, progressing)
 *   - Weak: Warm coral-red (struggling, needs attention)
 * - Unassessed: Neutral gray (not yet engaged)
 */
const CLASSIFICATION_CONFIG: Record<
  SkillClassification,
  {
    label: string
    emoji: string
    color: string
    lightColor: string
    darkColor: string
    /** Whether to show a subtle pattern in the chart (indicates warning/attention state) */
    hasPattern?: boolean
  }
> = {
  strong: {
    label: 'Strong',
    emoji: '🟢',
    color: '#22c55e', // emerald-500
    lightColor: 'green.500',
    darkColor: 'green.400',
  },
  stale: {
    label: 'Stale',
    emoji: '🌿', // leaf emoji to suggest "aging green"
    color: '#84cc16', // lime-500 - green trending toward yellow
    lightColor: 'lime.500',
    darkColor: 'lime.400',
    hasPattern: true, // subtle stripes to indicate "needs attention"
  },
  developing: {
    label: 'Developing',
    emoji: '🔵',
    color: '#3b82f6', // blue-500
    lightColor: 'blue.500',
    darkColor: 'blue.400',
  },
  weak: {
    label: 'Weak',
    emoji: '🔴',
    color: '#f87171', // red-400 - slightly softer red
    lightColor: 'red.400',
    darkColor: 'red.400',
    hasPattern: true, // subtle stripes to indicate "needs attention"
  },
  unassessed: {
    label: 'Unassessed',
    emoji: '⚪',
    color: 'transparent', // No color - just empty space
    lightColor: 'gray.200',
    darkColor: 'gray.700',
  },
}

// Order for stacking (bottom to top)
const CLASSIFICATION_ORDER: SkillClassification[] = [
  'strong',
  'stale',
  'developing',
  'weak',
  'unassessed',
]

// ============================================================================
// Time Window Helpers
// ============================================================================

/**
 * Calculate adaptive time window presets based on the student's session count.
 * Returns 2-3 sensible presets that give good decision-making views.
 */
function calculateTimeWindowPresets(totalSessions: number): TimeWindowPreset[] {
  // Not enough sessions for multiple windows
  if (totalSessions < 8) {
    return [{ key: 'all', label: `All (${totalSessions})`, sessionCount: null }]
  }

  // 8-15 sessions: Recent + All
  if (totalSessions <= 15) {
    return [
      { key: 'recent', label: 'Recent (5)', sessionCount: 5 },
      { key: 'all', label: `All (${totalSessions})`, sessionCount: null },
    ]
  }

  // 16-30 sessions: Recent + Medium + All
  if (totalSessions <= 30) {
    const medium = Math.min(15, Math.floor(totalSessions * 0.6))
    return [
      { key: 'recent', label: 'Recent (7)', sessionCount: 7 },
      { key: 'medium', label: `Last ${medium}`, sessionCount: medium },
      { key: 'all', label: `All (${totalSessions})`, sessionCount: null },
    ]
  }

  // 31+ sessions: Recent + Last 20 + All
  return [
    { key: 'recent', label: 'Recent (10)', sessionCount: 10 },
    { key: 'medium', label: 'Last 20', sessionCount: 20 },
    { key: 'all', label: `All (${totalSessions})`, sessionCount: null },
  ]
}

/**
 * Get the best default window for a given session count.
 * Aims to show enough context without overwhelming.
 */
function getDefaultWindowKey(totalSessions: number): string {
  if (totalSessions < 8) return 'all'
  if (totalSessions <= 20) return 'all'
  return 'medium' // For 20+ sessions, default to "Last 20"
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Compute the skill distribution at a specific point in time
 */
function computeDistributionAtPoint(
  problemsAtPoint: ProblemResultWithContext[],
  allSkillIds: string[],
  referenceDate: Date,
  bktOptions: BktComputeOptions
): SkillDistribution {
  const distribution: SkillDistribution = {
    strong: 0,
    stale: 0,
    developing: 0,
    weak: 0,
    unassessed: 0,
    total: allSkillIds.length,
  }

  if (allSkillIds.length === 0) return distribution

  // Compute BKT at this point - single source of truth for all skill data
  const bktResult = computeBktFromHistory(problemsAtPoint, bktOptions)
  const bktMap = new Map(bktResult.skills.map((s) => [s.skillId, s]))

  for (const skillId of allSkillIds) {
    const bkt = bktMap.get(skillId)

    // Use BKT's opportunities count to check if skill has been practiced
    if (!bkt || bkt.opportunities === 0) {
      distribution.unassessed++
      continue
    }

    // Use BKT's masteryClassification which respects confidence threshold
    const classification = bkt.masteryClassification ?? 'developing'

    // For strong skills, check staleness at reference date
    if (classification === 'strong') {
      // Use BKT's lastPracticedAt - single source of truth
      const lastPracticed = bkt.lastPracticedAt
      if (!lastPracticed) {
        distribution.strong++
      } else {
        const daysSinceLastPractice =
          (referenceDate.getTime() - lastPracticed.getTime()) / (1000 * 60 * 60 * 24)
        const stalenessWarning = getStalenessWarning(daysSinceLastPractice)
        if (stalenessWarning) {
          distribution.stale++
        } else {
          distribution.strong++
        }
      }
    } else {
      distribution[classification]++
    }
  }

  return distribution
}

/**
 * Compute historical snapshots for chart
 * @param sessionLimit - Max sessions to include (null = all)
 * @param currentDistribution - The distribution computed at "now" (for adding current snapshot)
 *
 * When today is after the last session, a synthetic "current" snapshot is appended
 * to ensure the chart's rightmost point matches the legend (which uses today's date).
 */
function computeSessionSnapshots(
  sessions: PracticeSession[],
  problemHistory: ProblemResultWithContext[],
  allSkillIds: string[],
  bktOptions: BktComputeOptions,
  sessionLimit: number | null = null,
  currentDistribution?: SkillDistribution
): SessionSnapshot[] {
  // Sort sessions chronologically
  const sortedSessions = [...sessions]
    .filter((s) => s.completedAt !== null)
    .sort((a, b) => new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime())

  // Apply session limit (take most recent N sessions)
  const recentSessions = sessionLimit ? sortedSessions.slice(-sessionLimit) : sortedSessions

  const snapshots = recentSessions.map((session) => {
    const sessionDate = new Date(session.completedAt!)

    // Filter problems up to this session's completion
    const problemsAtPoint = problemHistory.filter((p) => new Date(p.timestamp) <= sessionDate)

    return {
      sessionId: session.id,
      date: sessionDate,
      distribution: computeDistributionAtPoint(
        problemsAtPoint,
        allSkillIds,
        sessionDate,
        bktOptions
      ),
    }
  })

  // Add synthetic "current" snapshot if today is after the last session
  // This ensures the chart's rightmost point matches the legend's current distribution
  if (snapshots.length > 0 && currentDistribution) {
    const lastSessionDate = snapshots[snapshots.length - 1].date
    const now = new Date()

    // Check if we're on a different day than the last session
    const lastSessionDay = new Date(lastSessionDate).setHours(0, 0, 0, 0)
    const today = new Date(now).setHours(0, 0, 0, 0)

    if (today > lastSessionDay) {
      snapshots.push({
        sessionId: 'current',
        date: now,
        distribution: currentDistribution,
      })
    }
  }

  return snapshots
}

// ============================================================================
// Trend Analysis Helpers
// ============================================================================

/**
 * Calculate simple linear regression slope for a series of values.
 * Positive slope = improving trend, negative = declining trend.
 * Returns slope normalized per data point (not per day).
 */
function calculateTrendSlope(values: number[]): number {
  if (values.length < 2) return 0

  const n = values.length
  const indices = Array.from({ length: n }, (_, i) => i)

  const sumX = indices.reduce((a, b) => a + b, 0)
  const sumY = values.reduce((a, b) => a + b, 0)
  const sumXY = indices.reduce((acc, x, i) => acc + x * values[i], 0)
  const sumX2 = indices.reduce((acc, x) => acc + x * x, 0)

  const denominator = n * sumX2 - sumX * sumX
  if (denominator === 0) return 0

  return (n * sumXY - sumX * sumY) / denominator
}

/**
 * Classify the trend direction based on slope magnitude.
 * Uses thresholds relative to total skill count to determine significance.
 */
function classifyTrend(slope: number, totalSkills: number): 'improving' | 'declining' | 'stable' {
  // Threshold: consider a change of 5% of skills per session as significant
  const threshold = totalSkills * 0.05

  if (slope > threshold) return 'improving'
  if (slope < -threshold) return 'declining'
  return 'stable'
}

/**
 * Analyze session timing patterns.
 * Considers: days since last session, average gap between sessions, and gap variance.
 */
interface TimingAnalysis {
  daysSinceLastSession: number
  averageGapDays: number
  isRecentGapLarger: boolean // Is the most recent gap significantly larger than average?
  practiceFrequency: 'regular' | 'sporadic' | 'declining'
}

function analyzeSessionTiming(snapshots: SessionSnapshot[]): TimingAnalysis | null {
  if (snapshots.length < 2) return null

  const now = new Date()
  const lastSession = snapshots[snapshots.length - 1]
  const daysSinceLastSession = Math.floor(
    (now.getTime() - lastSession.date.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Calculate gaps between consecutive sessions
  const gaps: number[] = []
  for (let i = 1; i < snapshots.length; i++) {
    const gap =
      (snapshots[i].date.getTime() - snapshots[i - 1].date.getTime()) / (1000 * 60 * 60 * 24)
    gaps.push(gap)
  }

  const averageGapDays = gaps.reduce((a, b) => a + b, 0) / gaps.length
  const lastGap = gaps[gaps.length - 1]

  // Is the most recent gap significantly larger than average? (1.5x threshold)
  const isRecentGapLarger = lastGap > averageGapDays * 1.5

  // Determine practice frequency pattern
  let practiceFrequency: 'regular' | 'sporadic' | 'declining' = 'regular'

  // Check if gaps are increasing over time (declining engagement)
  if (gaps.length >= 3) {
    const recentGaps = gaps.slice(-3)
    const earlierGaps = gaps.slice(0, Math.max(1, gaps.length - 3))
    const recentAvg = recentGaps.reduce((a, b) => a + b, 0) / recentGaps.length
    const earlierAvg = earlierGaps.reduce((a, b) => a + b, 0) / earlierGaps.length

    if (recentAvg > earlierAvg * 2) {
      practiceFrequency = 'declining'
    }
  }

  // Check for high variance (sporadic)
  if (gaps.length >= 3) {
    const variance = gaps.reduce((acc, g) => acc + (g - averageGapDays) ** 2, 0) / gaps.length
    const stdDev = Math.sqrt(variance)
    // High coefficient of variation indicates sporadic practice
    if (stdDev / averageGapDays > 0.8) {
      practiceFrequency = 'sporadic'
    }
  }

  return {
    daysSinceLastSession,
    averageGapDays,
    isRecentGapLarger,
    practiceFrequency,
  }
}

/**
 * Context about the time window being analyzed.
 */
interface WindowContext {
  /** Number of sessions in the visible window (null = showing all) */
  sessionLimit: number | null
  /** Total number of completed sessions for this student */
  totalSessions: number
  /** Whether we're showing a subset of sessions */
  isSubset: boolean
}

/**
 * Format a time duration in human-readable form.
 * Examples: "2 days", "1 week", "3 weeks", "2 months"
 */
function formatDuration(days: number): string {
  if (days < 1) return 'today'
  if (days === 1) return '1 day'
  if (days < 7) return `${Math.round(days)} days`
  if (days < 14) return '1 week'
  if (days < 28) return `${Math.round(days / 7)} weeks`
  if (days < 60) return '1 month'
  return `${Math.round(days / 30)} months`
}

/**
 * Format the window scope for messaging using actual time span.
 * Examples: "over the past 2 weeks", "since Nov 15", "since you started"
 */
function formatWindowScope(ctx: WindowContext, snapshots: SessionSnapshot[]): string {
  if (snapshots.length === 0) return ''

  const firstDate = snapshots[0].date
  const lastDate = snapshots[snapshots.length - 1].date
  const spanDays = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)

  // If showing all sessions, say "since [start date]" or "since you started"
  if (!ctx.isSubset || snapshots.length === ctx.totalSessions) {
    // If span is very short (less than a week), just say "since you started"
    if (spanDays < 7) {
      return 'since you started'
    }
    // Otherwise reference the start date
    const startStr = firstDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `since ${startStr}`
  }

  // For a subset, describe the time span
  if (spanDays < 1) {
    return 'today'
  }

  return `over the past ${formatDuration(spanDays)}`
}

/**
 * Generate motivational message based on progress trends and timing.
 *
 * Analysis approach:
 * 1. Calculate linear trend of "strong" skills across visible window
 * 2. Analyze timing patterns (gap between sessions, recency)
 * 3. Compare current state to historical peak
 * 4. Generate contextually appropriate message
 *
 * The message is window-aware: it reflects whether we're looking at
 * "recent sessions", "the last N sessions", or "since you started".
 *
 * Priority order:
 * 1. Urgent timing issues (long gap + stale skills)
 * 2. Strong positive trends (recent gains)
 * 3. Staleness warnings (skills at risk)
 * 4. Steady progress acknowledgment
 * 5. Encouragement to maintain consistency
 */
function getMotivationalMessage(
  snapshots: SessionSnapshot[],
  currentDistribution: SkillDistribution,
  windowContext: WindowContext
): string {
  // No data yet
  if (snapshots.length === 0) {
    if (currentDistribution.total === 0) {
      return '🌟 Start practicing to track your progress!'
    }
    return '🌟 Complete a session to see your progress over time!'
  }

  const first = snapshots[0]
  const last = snapshots[snapshots.length - 1]
  const totalSkills = currentDistribution.total

  // Window scope text (e.g., "in recent sessions", "over the last 10 sessions", "since you started")
  const scope = formatWindowScope(windowContext, snapshots)

  // === Timing Analysis ===
  const timing = analyzeSessionTiming(snapshots)

  // === Trend Analysis ===
  // Track "strong" count trend (skills that are both mastered and fresh)
  const strongCounts = snapshots.map((s) => s.distribution.strong)
  const strongTrendSlope = calculateTrendSlope(strongCounts)
  const strongTrend = classifyTrend(strongTrendSlope, totalSkills)

  // Track "achieved" = strong + stale (total mastered, regardless of freshness)
  const achievedCounts = snapshots.map((s) => s.distribution.strong + s.distribution.stale)
  const achievedTrendSlope = calculateTrendSlope(achievedCounts)
  const achievedTrend = classifyTrend(achievedTrendSlope, totalSkills)

  // Track weak skill changes
  const weakCounts = snapshots.map((s) => s.distribution.weak)
  const weakTrendSlope = calculateTrendSlope(weakCounts)
  const weakImproving = weakTrendSlope < -totalSkills * 0.03 // Declining weak is good
  const weakWorsening = weakTrendSlope > totalSkills * 0.03 // Growing weak is bad
  const currentWeak = currentDistribution.weak
  const firstWeak = first.distribution.weak
  const weakGrowth = currentWeak - firstWeak

  // === Current State Analysis ===
  const peakStrong = Math.max(...strongCounts)
  const currentStrong = currentDistribution.strong
  const currentStale = currentDistribution.stale
  const currentAchieved = currentStrong + currentStale

  const firstAchieved = first.distribution.strong + first.distribution.stale
  const achievedGain = currentAchieved - firstAchieved

  const lostToStaleness = peakStrong - currentStrong
  const weakReduction = first.distribution.weak - last.distribution.weak

  // === Message Generation with Priority ===

  // PRIORITY 1: Urgent timing + staleness combination
  if (timing && timing.daysSinceLastSession > 7 && currentStale > 0) {
    const daysText =
      timing.daysSinceLastSession === 1
        ? '1 day'
        : `${Math.round(timing.daysSinceLastSession)} days`
    return `⏰ It's been ${daysText} since practice. ${currentStale} skill${currentStale > 1 ? 's are' : ' is'} now stale.`
  }

  // PRIORITY 2: Declining practice frequency warning
  if (
    timing &&
    timing.practiceFrequency === 'declining' &&
    timing.isRecentGapLarger &&
    currentStale > 0
  ) {
    return `⏰ Practice gaps are growing. ${currentStale} skill${currentStale > 1 ? 's' : ''} became stale during the break.`
  }

  // PRIORITY 3: Growing weak skills - this is a problem, don't celebrate
  if (weakWorsening && weakGrowth > 0 && currentWeak >= 2) {
    // If weak skills are outpacing mastery gains, that's concerning
    if (achievedGain > 0 && weakGrowth > achievedGain) {
      return `⚠️ ${currentWeak} weak skill${currentWeak > 1 ? 's' : ''} need${currentWeak === 1 ? 's' : ''} attention. Weak skills are growing faster than mastery.`
    }
    return `⚠️ ${currentWeak} skill${currentWeak > 1 ? 's are' : ' is'} weak ${scope}. Focus on these before adding new skills.`
  }

  // PRIORITY 4: Strong positive momentum (both trend and recent gains)
  // Only celebrate if weak skills aren't also growing
  if (achievedTrend === 'improving' && achievedGain > 0 && !weakWorsening) {
    if (weakImproving && weakReduction > 0) {
      return `📈 Excellent momentum ${scope}! Gained ${achievedGain} strong skill${achievedGain > 1 ? 's' : ''} while reducing weak skills by ${weakReduction}.`
    }
    return `📈 Strong upward trend ${scope}! You've mastered ${achievedGain} more skill${achievedGain > 1 ? 's' : ''}.`
  }

  // PRIORITY 5: Recent gains even if trend is stable (but not if weak is growing)
  if (achievedGain > 0 && !weakWorsening) {
    if (currentStale > 0) {
      return `📈 Gained ${achievedGain} skill${achievedGain > 1 ? 's' : ''} ${scope}, but ${currentStale} ${currentStale > 1 ? 'are' : 'is'} now stale. A quick review will refresh them!`
    }
    return `📈 Great progress ${scope}! ${achievedGain} more skill${achievedGain > 1 ? 's' : ''} mastered.`
  }

  // PRIORITY 6: Skills becoming stale (lost freshness but not mastery)
  if (lostToStaleness > 0 && currentStale > 0) {
    if (timing && timing.isRecentGapLarger) {
      return `⏰ ${currentStale} skill${currentStale > 1 ? 's' : ''} became stale during the longer gap between sessions.`
    }
    return `⏰ ${currentStale} skill${currentStale > 1 ? 's' : ''} became stale. Practice soon to keep them fresh!`
  }

  // PRIORITY 7: Weak skill improvement
  if (weakImproving && weakReduction > 0) {
    return `💪 ${weakReduction} fewer weak skill${weakReduction > 1 ? 's' : ''} ${scope}. Keep building!`
  }

  // PRIORITY 8: Current weak skills that need attention (fallback if not caught by PRIORITY 3)
  if (currentWeak > 0) {
    return `⚠️ ${currentWeak} skill${currentWeak > 1 ? 's are' : ' is'} weak. Practice these to build mastery!`
  }

  // PRIORITY 9: Current stale skills (even without recent loss)
  if (currentStale > 0) {
    return `⏰ ${currentStale} skill${currentStale > 1 ? 's are' : ' is'} stale. A quick practice session will refresh them!`
  }

  // PRIORITY 10: Stable trend with good state
  if (strongTrend === 'stable' && currentStrong > 0) {
    if (timing && timing.practiceFrequency === 'regular') {
      return `🎯 Consistent practice ${scope} is paying off. Keep up the steady rhythm!`
    }
    return '🎯 Steady progress! Regular practice builds lasting mastery.'
  }

  // PRIORITY 9: Declining trend warning
  if (strongTrend === 'declining' && snapshots.length >= 3) {
    return `📉 Strong skills are slipping ${scope}. More frequent practice can reverse this trend.`
  }

  // Default: Encourage continued practice
  return '🎯 Every session strengthens your foundation. Keep going!'
}

// ============================================================================
// Components
// ============================================================================

/**
 * Descriptors explain the classification criteria.
 * Stale needs special clarification since it's a time-based warning on Strong, not a mastery level.
 */
const CLASSIFICATION_DESCRIPTORS: Partial<Record<SkillClassification, string>> = {
  stale: '7+ days ago',
}

/**
 * Generate CSS for diagonal stripe pattern overlay.
 * Used for Stale and Weak to indicate "needs attention" state.
 */
function getStripePattern(isDark: boolean): string {
  const stripeColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.35)'
  return `repeating-linear-gradient(
    45deg,
    transparent,
    transparent 3px,
    ${stripeColor} 3px,
    ${stripeColor} 6px
  )`
}

/**
 * Get text colors that ensure readability against the colored background.
 */
function getTextColors(
  classification: SkillClassification,
  isDark: boolean
): { count: string; label: string; descriptor: string } {
  // For colored backgrounds, we need good contrast
  // Light mode: darker shades of the color
  // Dark mode: lighter shades or white
  switch (classification) {
    case 'strong':
      return {
        count: isDark ? '#bbf7d0' : '#14532d', // green-200 / green-900
        label: isDark ? '#86efac' : '#166534', // green-300 / green-800
        descriptor: isDark ? '#4ade80' : '#15803d', // green-400 / green-700
      }
    case 'stale':
      return {
        count: isDark ? '#ecfccb' : '#365314', // lime-100 / lime-900
        label: isDark ? '#d9f99d' : '#3f6212', // lime-200 / lime-800
        descriptor: isDark ? '#bef264' : '#4d7c0f', // lime-300 / lime-700
      }
    case 'developing':
      return {
        count: isDark ? '#bfdbfe' : '#1e3a5f', // blue-200 / custom dark blue
        label: isDark ? '#93c5fd' : '#1e40af', // blue-300 / blue-800
        descriptor: isDark ? '#60a5fa' : '#1d4ed8', // blue-400 / blue-700
      }
    case 'weak':
      return {
        count: isDark ? '#fecaca' : '#7f1d1d', // red-200 / red-900
        label: isDark ? '#fca5a5' : '#991b1b', // red-300 / red-800
        descriptor: isDark ? '#f87171' : '#b91c1c', // red-400 / red-700
      }
    case 'unassessed':
    default:
      return {
        count: isDark ? '#e5e7eb' : '#374151', // gray-200 / gray-700
        label: isDark ? '#d1d5db' : '#4b5563', // gray-300 / gray-600
        descriptor: isDark ? '#9ca3af' : '#6b7280', // gray-400 / gray-500
      }
  }
}

function LegendCard({
  classification,
  count,
  isActive,
  onToggle,
  isDark,
}: {
  classification: SkillClassification
  count: number
  isActive: boolean
  onToggle: () => void
  isDark: boolean
}) {
  const config = CLASSIFICATION_CONFIG[classification]
  const descriptor = CLASSIFICATION_DESCRIPTORS[classification]
  const textColors = getTextColors(classification, isDark)

  // Unassessed gets special treatment - subtle border instead of fill
  const isUnassessed = classification === 'unassessed'

  // Background color handling
  const bgStyle = isUnassessed
    ? {
        backgroundColor: isDark ? 'rgba(55, 65, 81, 0.3)' : 'rgba(229, 231, 235, 0.5)',
        border: `2px dashed ${isDark ? '#6b7280' : '#d1d5db'}`,
      }
    : {
        backgroundColor: `color-mix(in srgb, ${config.color} ${isDark ? 85 : 80}%, transparent)`,
      }

  return (
    <button
      type="button"
      data-element="legend-card"
      data-classification={classification}
      data-active={isActive}
      onClick={onToggle}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.75rem 1rem',
        minWidth: '90px',
        borderRadius: '12px',
        border: isUnassessed ? 'none' : '2px solid',
        borderColor: isActive ? (isDark ? 'white' : 'gray.800') : 'transparent',
        cursor: 'pointer',
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden',
        // Ring effect on hover
        _hover: {
          boxShadow: `0 0 0 2px ${isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)'}`,
        },
      })}
      style={bgStyle}
    >
      {/* Stripe pattern overlay for hasPattern categories */}
      {config.hasPattern && (
        <div
          className={css({
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderRadius: '10px', // slightly less than parent for clean edges
          })}
          style={{
            background: getStripePattern(isDark),
          }}
        />
      )}

      {/* Active indicator */}
      {isActive && (
        <span
          className={css({
            position: 'absolute',
            top: '4px',
            right: '6px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
          })}
          style={{ color: textColors.count }}
        >
          ✓
        </span>
      )}

      {/* Count */}
      <span
        className={css({
          fontSize: '1.5rem',
          fontWeight: 'bold',
          lineHeight: 1,
          position: 'relative', // Above pattern
          textShadow: isDark ? '0 1px 2px rgba(0,0,0,0.3)' : '0 1px 1px rgba(255,255,255,0.5)',
        })}
        style={{ color: textColors.count }}
      >
        {count}
      </span>

      {/* Label with emoji */}
      <span
        className={css({
          fontSize: '0.75rem',
          fontWeight: 'medium',
          marginTop: '0.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          position: 'relative', // Above pattern
        })}
        style={{ color: textColors.label }}
      >
        <span>{config.emoji}</span>
        <span>{config.label}</span>
      </span>

      {/* Descriptor (explains classification criteria) */}
      {descriptor && (
        <span
          className={css({
            fontSize: '0.625rem',
            fontWeight: 'medium',
            marginTop: '0.125rem',
            position: 'relative', // Above pattern
          })}
          style={{ color: textColors.descriptor }}
        >
          {descriptor}
        </span>
      )}
    </button>
  )
}

export function SkillProgressChart({
  sessions,
  problemHistory,
  allSkillIds,
  currentDistribution,
  activeFilters,
  onFilterToggle,
  isDark,
  bktOptions,
}: SkillProgressChartProps) {
  // Count completed sessions
  const completedSessions = useMemo(
    () => sessions.filter((s) => s.completedAt !== null),
    [sessions]
  )
  const totalSessionCount = completedSessions.length

  // Calculate adaptive time window presets
  const presets = useMemo(() => calculateTimeWindowPresets(totalSessionCount), [totalSessionCount])

  // State for selected time window
  const [selectedWindowKey, setSelectedWindowKey] = useState<string>(() =>
    getDefaultWindowKey(totalSessionCount)
  )

  // Get the current window's session limit
  const currentSessionLimit = useMemo(() => {
    const preset = presets.find((p) => p.key === selectedWindowKey)
    return preset?.sessionCount ?? null
  }, [presets, selectedWindowKey])

  // Compute historical snapshots with the selected window
  // Pass currentDistribution to add a "today" snapshot if we're past the last session date
  const snapshots = useMemo(
    () =>
      computeSessionSnapshots(
        sessions,
        problemHistory,
        allSkillIds,
        bktOptions,
        currentSessionLimit,
        currentDistribution
      ),
    [sessions, problemHistory, allSkillIds, bktOptions, currentSessionLimit, currentDistribution]
  )

  // Build window context for message generation
  const windowContext: WindowContext = useMemo(
    () => ({
      sessionLimit: currentSessionLimit,
      totalSessions: totalSessionCount,
      isSubset: currentSessionLimit !== null && currentSessionLimit < totalSessionCount,
    }),
    [currentSessionLimit, totalSessionCount]
  )

  // Generate motivational message (window-aware)
  const motivationalMessage = useMemo(
    () => getMotivationalMessage(snapshots, currentDistribution, windowContext),
    [snapshots, currentDistribution, windowContext]
  )

  // Chart should only show if we have 2+ sessions in the window
  const showChart = snapshots.length >= 2

  // Only show window selector if there are multiple presets
  const showWindowSelector = presets.length > 1

  // Handle filter toggle
  const handleToggle = useCallback(
    (classification: SkillClassification) => {
      onFilterToggle(classification)
    },
    [onFilterToggle]
  )

  // Build chart options
  const chartOption = useMemo(() => {
    if (!showChart) return null

    const dates = snapshots.map((s) =>
      s.sessionId === 'current'
        ? 'Today'
        : s.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    )

    // Convert to percentages for 100% stacked
    const toPercent = (value: number, total: number) =>
      total === 0 ? 0 : Math.round((value / total) * 100)

    const series = CLASSIFICATION_ORDER.map((classification) => {
      const config = CLASSIFICATION_CONFIG[classification]

      // Determine the fill color
      // Unassessed is transparent (shows chart background)
      const fillColor =
        classification === 'unassessed'
          ? isDark
            ? 'rgba(55, 65, 81, 0.3)' // very subtle gray in dark mode
            : 'rgba(229, 231, 235, 0.4)' // very subtle gray in light mode
          : config.color

      // Decal pattern ONLY for "needs attention" categories (Stale, Weak)
      // Other categories get no decal (solid fill)
      const decalConfig = config.hasPattern
        ? {
            symbol: 'rect',
            symbolSize: 1,
            rotation: Math.PI / 4, // 45 degree diagonal
            color: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.4)',
            dashArrayX: [1, 0],
            dashArrayY: [4, 3], // stripe pattern matching legend cards
          }
        : null // Explicitly null to prevent any default patterns

      // Base series configuration
      const seriesConfig: Record<string, unknown> = {
        name: config.label,
        type: 'line',
        stack: 'total',
        areaStyle: {
          opacity: classification === 'unassessed' ? 1 : 0.9,
        },
        emphasis: {
          focus: 'series',
        },
        smooth: true,
        symbol: 'none',
        lineStyle: {
          width: 0,
        },
        itemStyle: {
          color: fillColor,
          decal: decalConfig,
        },
        data: snapshots.map((s) => toPercent(s.distribution[classification], s.distribution.total)),
      }

      return seriesConfig
    })

    return {
      backgroundColor: 'transparent',
      // Note: We apply decal patterns per-series, not globally via aria
      // aria.decal.show would apply default patterns to ALL series
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        textStyle: {
          color: isDark ? '#e5e7eb' : '#1f2937',
        },
        formatter: (
          params: Array<{ seriesName: string; value: number; color: string; marker: string }>
        ) => {
          const idx = (params[0] as unknown as { dataIndex: number }).dataIndex
          const snapshot = snapshots[idx]
          if (!snapshot) return ''

          // Helper to find param by series name
          const findParam = (name: string) => params.find((p) => p.seriesName === name)

          // Helper to format a row
          const formatRow = (name: string, classification: SkillClassification) => {
            const p = findParam(name)
            if (!p) return ''
            const count = snapshot.distribution[classification] ?? 0
            if (count === 0 && p.value === 0) return '' // Skip if zero
            return `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;">
              ${p.marker}
              <span>${name}</span>
              <span style="margin-left:auto;font-weight:600;">${count}</span>
              <span style="color:${isDark ? '#9ca3af' : '#6b7280'};font-size:0.85em;">(${p.value}%)</span>
            </div>`
          }

          // Group header style
          const headerStyle = `font-size:0.7em;font-weight:600;color:${isDark ? '#6b7280' : '#9ca3af'};text-transform:uppercase;letter-spacing:0.05em;margin-top:8px;margin-bottom:2px;`

          let html = `<div style="min-width:160px;">
            <div style="font-weight:bold;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid ${isDark ? '#374151' : '#e5e7eb'};">${dates[idx]}</div>`

          // MASTERED group
          const strongRow = formatRow('Strong', 'strong')
          const staleRow = formatRow('Stale', 'stale')
          if (strongRow || staleRow) {
            html += `<div style="${headerStyle}">Mastered</div>`
            html += strongRow + staleRow
          }

          // IN PROGRESS group
          const developingRow = formatRow('Developing', 'developing')
          const weakRow = formatRow('Weak', 'weak')
          if (developingRow || weakRow) {
            html += `<div style="${headerStyle}">In Progress</div>`
            html += developingRow + weakRow
          }

          // NOT STARTED group
          const unassessedRow = formatRow('Unassessed', 'unassessed')
          if (unassessedRow) {
            html += `<div style="${headerStyle}">Not Started</div>`
            html += unassessedRow
          }

          html += '</div>'
          return html
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates,
        axisLabel: {
          color: isDark ? '#9ca3af' : '#6b7280',
          fontSize: 10,
        },
        axisLine: { lineStyle: { color: isDark ? '#374151' : '#e5e7eb' } },
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: {
          color: isDark ? '#9ca3af' : '#6b7280',
          formatter: '{value}%',
        },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: isDark ? '#374151' : '#e5e7eb', type: 'dashed' } },
      },
      series,
    }
  }, [showChart, snapshots, isDark])

  // Filter out classifications with zero count for legend
  const visibleClassifications = CLASSIFICATION_ORDER.filter((c) => currentDistribution[c] > 0)

  // Show all classifications if filters are active (so user can clear them)
  const legendClassifications =
    activeFilters.size > 0
      ? CLASSIFICATION_ORDER.filter((c) => currentDistribution[c] > 0 || activeFilters.has(c))
      : visibleClassifications

  return (
    <div
      data-component="skill-progress-chart"
      className={css({
        marginBottom: '1.5rem',
      })}
    >
      {/* Time window selector (only if multiple presets available) */}
      {showWindowSelector && showChart && (
        <div
          data-element="time-window-selector"
          className={css({
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '0.75rem',
          })}
        >
          <div
            className={css({
              display: 'inline-flex',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid',
              borderColor: isDark ? 'gray.600' : 'gray.300',
            })}
          >
            {presets.map((preset, index) => (
              <button
                key={preset.key}
                type="button"
                data-window={preset.key}
                data-selected={selectedWindowKey === preset.key}
                onClick={() => setSelectedWindowKey(preset.key)}
                className={css({
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: selectedWindowKey === preset.key ? '600' : '400',
                  backgroundColor:
                    selectedWindowKey === preset.key
                      ? isDark
                        ? 'blue.600'
                        : 'blue.500'
                      : isDark
                        ? 'gray.800'
                        : 'white',
                  color:
                    selectedWindowKey === preset.key ? 'white' : isDark ? 'gray.300' : 'gray.600',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  borderRight: index < presets.length - 1 ? '1px solid' : 'none',
                  borderRightColor: isDark ? 'gray.600' : 'gray.300',
                  _hover: {
                    backgroundColor:
                      selectedWindowKey === preset.key
                        ? isDark
                          ? 'blue.500'
                          : 'blue.600'
                        : isDark
                          ? 'gray.700'
                          : 'gray.100',
                  },
                })}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chart area (only if 2+ sessions in window) */}
      {showChart && chartOption && (
        <div
          data-element="chart-area"
          className={css({
            backgroundColor: isDark ? 'gray.800' : 'white',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '1rem',
            border: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          <ReactECharts option={chartOption} style={{ height: '200px' }} />
        </div>
      )}

      {/* Legend cards - grouped by mastery level to show hierarchy */}
      <div
        data-element="legend-cards"
        className={css({
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          justifyContent: 'center',
          alignItems: 'flex-start',
          marginBottom: '0.75rem',
        })}
      >
        {/* Mastered group (Strong + Stale) */}
        {(legendClassifications.includes('strong') || legendClassifications.includes('stale')) && (
          <div
            data-element="legend-group-mastered"
            className={css({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.25rem',
            })}
          >
            <span
              className={css({
                fontSize: '0.625rem',
                fontWeight: 'medium',
                color: isDark ? 'gray.500' : 'gray.400',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              })}
            >
              Mastered
            </span>
            <div className={css({ display: 'flex', gap: '0.5rem' })}>
              {legendClassifications
                .filter((c) => c === 'strong' || c === 'stale')
                .map((classification) => (
                  <LegendCard
                    key={classification}
                    classification={classification}
                    count={currentDistribution[classification]}
                    isActive={activeFilters.has(classification)}
                    onToggle={() => handleToggle(classification)}
                    isDark={isDark}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Divider between Mastered and In Progress */}
        {(legendClassifications.includes('strong') || legendClassifications.includes('stale')) &&
          (legendClassifications.includes('developing') ||
            legendClassifications.includes('weak')) && (
            <div
              data-element="legend-divider"
              className={css({
                width: '1px',
                alignSelf: 'stretch',
                marginTop: '1rem', // Skip the header height
                backgroundColor: isDark ? 'gray.700' : 'gray.200',
              })}
            />
          )}

        {/* In Progress group (Developing + Weak) */}
        {(legendClassifications.includes('developing') ||
          legendClassifications.includes('weak')) && (
          <div
            data-element="legend-group-in-progress"
            className={css({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.25rem',
            })}
          >
            <span
              className={css({
                fontSize: '0.625rem',
                fontWeight: 'medium',
                color: isDark ? 'gray.500' : 'gray.400',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              })}
            >
              In Progress
            </span>
            <div className={css({ display: 'flex', gap: '0.5rem' })}>
              {legendClassifications
                .filter((c) => c === 'developing' || c === 'weak')
                .map((classification) => (
                  <LegendCard
                    key={classification}
                    classification={classification}
                    count={currentDistribution[classification]}
                    isActive={activeFilters.has(classification)}
                    onToggle={() => handleToggle(classification)}
                    isDark={isDark}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Divider before Not Started */}
        {(legendClassifications.includes('developing') ||
          legendClassifications.includes('weak') ||
          legendClassifications.includes('strong') ||
          legendClassifications.includes('stale')) &&
          legendClassifications.includes('unassessed') && (
            <div
              data-element="legend-divider"
              className={css({
                width: '1px',
                alignSelf: 'stretch',
                marginTop: '1rem', // Skip the header height
                backgroundColor: isDark ? 'gray.700' : 'gray.200',
              })}
            />
          )}

        {/* Not Started group (Unassessed) */}
        {legendClassifications.includes('unassessed') && (
          <div
            data-element="legend-group-not-started"
            className={css({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.25rem',
            })}
          >
            <span
              className={css({
                fontSize: '0.625rem',
                fontWeight: 'medium',
                color: isDark ? 'gray.500' : 'gray.400',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              })}
            >
              Not Started
            </span>
            <LegendCard
              classification="unassessed"
              count={currentDistribution.unassessed}
              isActive={activeFilters.has('unassessed')}
              onToggle={() => handleToggle('unassessed')}
              isDark={isDark}
            />
          </div>
        )}
      </div>

      {/* Clear filters button */}
      {activeFilters.size > 0 && (
        <div
          className={css({
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '0.75rem',
          })}
        >
          <button
            type="button"
            data-action="clear-filters"
            onClick={() => {
              // Clear all filters by toggling each active one
              for (const f of activeFilters) {
                onFilterToggle(f)
              }
            }}
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'blue.400' : 'blue.600',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
              _hover: { color: isDark ? 'blue.300' : 'blue.700' },
            })}
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Motivational message */}
      <p
        data-element="motivational-message"
        className={css({
          textAlign: 'center',
          fontSize: '0.875rem',
          color: isDark ? 'gray.400' : 'gray.600',
          fontStyle: 'italic',
        })}
      >
        {motivationalMessage}
      </p>
    </div>
  )
}

/**
 * Get the 5-category skill classification from BKT classification and staleness.
 * Delegates to the shared getExtendedClassification from BktContext.
 *
 * @deprecated Import getExtendedClassification directly from @/contexts/BktContext
 */
export function getSkillClassification(
  bktClassification: 'strong' | 'developing' | 'weak' | null,
  stalenessWarning: string | null
): SkillClassification {
  return getExtendedClassification(bktClassification, stalenessWarning)
}
