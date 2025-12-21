'use client'

import ReactECharts from 'echarts-for-react'
import { useCallback, useMemo, useState } from 'react'
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
// Types
// ============================================================================

export type SkillClassification = 'strong' | 'stale' | 'developing' | 'weak' | 'unassessed'

export interface SkillDistribution {
  strong: number
  stale: number
  developing: number
  weak: number
  unassessed: number
  total: number
}

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

const CLASSIFICATION_CONFIG: Record<
  SkillClassification,
  { label: string; emoji: string; color: string; lightColor: string; darkColor: string }
> = {
  strong: {
    label: 'Strong',
    emoji: '🟢',
    color: '#22c55e',
    lightColor: 'green.500',
    darkColor: 'green.400',
  },
  stale: {
    label: 'Stale',
    emoji: '🟡',
    color: '#eab308',
    lightColor: 'yellow.500',
    darkColor: 'yellow.400',
  },
  developing: {
    label: 'Developing',
    emoji: '🔵',
    color: '#3b82f6',
    lightColor: 'blue.500',
    darkColor: 'blue.400',
  },
  weak: {
    label: 'Weak',
    emoji: '🔴',
    color: '#ef4444',
    lightColor: 'red.500',
    darkColor: 'red.400',
  },
  unassessed: {
    label: 'Unassessed',
    emoji: '⚪',
    color: '#9ca3af',
    lightColor: 'gray.400',
    darkColor: 'gray.500',
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
    const variance = gaps.reduce((acc, g) => acc + Math.pow(g - averageGapDays, 2), 0) / gaps.length
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

  // Track weak skill reduction
  const weakCounts = snapshots.map((s) => s.distribution.weak)
  const weakTrendSlope = calculateTrendSlope(weakCounts)
  const weakImproving = weakTrendSlope < -totalSkills * 0.03 // Declining weak is good

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

  // PRIORITY 3: Strong positive momentum (both trend and recent gains)
  if (achievedTrend === 'improving' && achievedGain > 0) {
    if (weakImproving && weakReduction > 0) {
      return `📈 Excellent momentum ${scope}! Gained ${achievedGain} strong skill${achievedGain > 1 ? 's' : ''} while reducing weak skills by ${weakReduction}.`
    }
    return `📈 Strong upward trend ${scope}! You've mastered ${achievedGain} more skill${achievedGain > 1 ? 's' : ''}.`
  }

  // PRIORITY 4: Recent gains even if trend is stable
  if (achievedGain > 0) {
    if (currentStale > 0) {
      return `📈 Gained ${achievedGain} skill${achievedGain > 1 ? 's' : ''} ${scope}, but ${currentStale} ${currentStale > 1 ? 'are' : 'is'} now stale. A quick review will refresh them!`
    }
    return `📈 Great progress ${scope}! ${achievedGain} more skill${achievedGain > 1 ? 's' : ''} mastered.`
  }

  // PRIORITY 5: Skills becoming stale (lost freshness but not mastery)
  if (lostToStaleness > 0 && currentStale > 0) {
    if (timing && timing.isRecentGapLarger) {
      return `⏰ ${currentStale} skill${currentStale > 1 ? 's' : ''} became stale during the longer gap between sessions.`
    }
    return `⏰ ${currentStale} skill${currentStale > 1 ? 's' : ''} became stale. Practice soon to keep them fresh!`
  }

  // PRIORITY 6: Weak skill improvement
  if (weakImproving && weakReduction > 0) {
    return `💪 ${weakReduction} fewer weak skill${weakReduction > 1 ? 's' : ''} ${scope}. Keep building!`
  }

  // PRIORITY 7: Current stale skills (even without recent loss)
  if (currentStale > 0) {
    return `⏰ ${currentStale} skill${currentStale > 1 ? 's are' : ' is'} stale. A quick practice session will refresh them!`
  }

  // PRIORITY 8: Stable trend with good state
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
        border: '2px solid',
        borderColor: isActive
          ? isDark
            ? config.darkColor
            : config.lightColor
          : isDark
            ? 'gray.600'
            : 'gray.200',
        backgroundColor: isActive
          ? isDark
            ? `${config.lightColor}/20`
            : `${config.lightColor}/10`
          : isDark
            ? 'gray.800'
            : 'white',
        cursor: 'pointer',
        transition: 'all 0.2s',
        position: 'relative',
        _hover: {
          borderColor: isDark ? config.darkColor : config.lightColor,
          backgroundColor: isDark ? 'gray.700' : 'gray.50',
        },
      })}
    >
      {/* Active indicator */}
      {isActive && (
        <span
          className={css({
            position: 'absolute',
            top: '4px',
            right: '4px',
            fontSize: '0.625rem',
          })}
        >
          ✓
        </span>
      )}

      {/* Count */}
      <span
        className={css({
          fontSize: '1.5rem',
          fontWeight: 'bold',
          color: isDark ? config.darkColor : config.lightColor,
          lineHeight: 1,
        })}
      >
        {count}
      </span>

      {/* Label with emoji */}
      <span
        className={css({
          fontSize: '0.75rem',
          color: isDark ? 'gray.300' : 'gray.600',
          marginTop: '0.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
        })}
      >
        <span>{config.emoji}</span>
        <span>{config.label}</span>
      </span>
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
      return {
        name: config.label,
        type: 'line',
        stack: 'total',
        areaStyle: {
          opacity: 0.8,
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
          color: config.color,
        },
        data: snapshots.map((s) => toPercent(s.distribution[classification], s.distribution.total)),
      }
    })

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (
          params: Array<{ seriesName: string; value: number; color: string; marker: string }>
        ) => {
          const idx = (params[0] as unknown as { dataIndex: number }).dataIndex
          const snapshot = snapshots[idx]
          if (!snapshot) return ''

          let html = `<strong>${dates[idx]}</strong><br/>`
          // Reverse order for tooltip (show from top of stack to bottom)
          for (const p of [...params].reverse()) {
            const count =
              snapshot.distribution[p.seriesName.toLowerCase() as SkillClassification] ?? 0
            html += `${p.marker} ${p.seriesName}: ${count} (${p.value}%)<br/>`
          }
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

      {/* Legend cards */}
      <div
        data-element="legend-cards"
        className={css({
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          justifyContent: 'center',
          marginBottom: '0.75rem',
        })}
      >
        {legendClassifications.map((classification) => (
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

// Export helper for use in parent component
export function getSkillClassification(
  bktClassification: 'strong' | 'developing' | 'weak' | null,
  stalenessWarning: string | null
): SkillClassification {
  if (bktClassification === null) return 'unassessed'
  if (bktClassification === 'strong' && stalenessWarning) return 'stale'
  return bktClassification
}
