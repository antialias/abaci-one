/**
 * Skill Metrics Computation
 *
 * Functions for computing skill metrics for scoreboard display.
 * All metrics are computed on-the-fly from session results - no new database tables.
 *
 * Key design decisions:
 * - Normalized response times use "seconds per term" for fair comparison across problems
 * - Overall mastery is weighted by confidence (more certain estimates count more)
 * - Improvement rate compares BKT from now vs 7 days ago
 * - Practice streak counts consecutive days with completed sessions
 */

import type { SessionPlan } from '@/db/schema/session-plans'
import { BKT_THRESHOLDS } from './config/bkt-integration'
import type { SkillBktResult } from './bkt/types'
import { computeBktFromHistory } from './bkt/compute-bkt'
import type { ProblemResultWithContext } from './session-planner'

// ============================================================================
// Types
// ============================================================================

/**
 * Skill category names that map to SkillSet structure
 */
export type SkillCategory =
  | 'basic'
  | 'fiveComplements'
  | 'fiveComplementsSub'
  | 'tenComplements'
  | 'tenComplementsSub'
  | 'advanced'

/**
 * Display-friendly category information
 */
export const SKILL_CATEGORY_INFO: Record<
  SkillCategory,
  { name: string; shortName: string; emoji: string }
> = {
  basic: { name: 'Basic Operations', shortName: 'Basic', emoji: '🔢' },
  fiveComplements: {
    name: "Five's (Addition)",
    shortName: "5's Add",
    emoji: '✋',
  },
  fiveComplementsSub: {
    name: "Five's (Subtraction)",
    shortName: "5's Sub",
    emoji: '✋',
  },
  tenComplements: {
    name: "Ten's (Addition)",
    shortName: "10's Add",
    emoji: '🔟',
  },
  tenComplementsSub: {
    name: "Ten's (Subtraction)",
    shortName: "10's Sub",
    emoji: '🔟',
  },
  advanced: {
    name: 'Advanced (Cascading)',
    shortName: 'Advanced',
    emoji: '⚡',
  },
}

/**
 * Metrics for a single skill category
 */
export interface CategoryMetrics {
  /** Average pKnown across all skills in this category */
  pKnownAvg: number
  /** Total number of skills in this category */
  skillCount: number
  /** How many skills are classified as "strong" */
  masteredCount: number
  /** How many skills have been practiced at all */
  practicedCount: number
}

/**
 * Trend direction for time-series metrics
 */
export type Trend = 'improving' | 'stable' | 'declining'

/**
 * Complete skill metrics for a student
 */
export interface StudentSkillMetrics {
  /** When these metrics were computed */
  computedAt: Date

  /** Overall mastery (weighted average of pKnown across all practiced skills) */
  overallMastery: number

  /** Mastery breakdown by skill category */
  categoryMastery: Record<SkillCategory, CategoryMetrics>

  /** Normalized response time metrics */
  timing: {
    /** Average seconds per term across all problems */
    avgSecondsPerTerm: number | null
    /** Trend over recent sessions */
    trend: Trend
  }

  /** Accuracy metrics */
  accuracy: {
    /** Overall accuracy percentage (0-100) */
    overallPercent: number
    /** Accuracy in last 50 problems */
    recentPercent: number
    /** Trend over recent sessions */
    trend: Trend
  }

  /** Progress metrics for fair comparison across ability levels */
  progress: {
    /** Change in overall mastery per week */
    improvementRate: number
    /** Consecutive days with practice */
    practiceStreak: number
    /** Total problems ever completed */
    totalProblems: number
    /** Problems completed in last 7 days */
    weeklyProblems: number
  }
}

// ============================================================================
// Category Extraction
// ============================================================================

/**
 * Extract the category from a skill ID
 * Skill IDs follow pattern: "category.skillName" (e.g., "fiveComplements.4=5-1")
 */
export function getSkillCategory(skillId: string): SkillCategory {
  const parts = skillId.split('.')
  const category = parts[0]

  if (
    category === 'basic' ||
    category === 'fiveComplements' ||
    category === 'fiveComplementsSub' ||
    category === 'tenComplements' ||
    category === 'tenComplementsSub' ||
    category === 'advanced'
  ) {
    return category
  }

  // Default to basic for unknown categories
  return 'basic'
}

// ============================================================================
// Core Computation Functions
// ============================================================================

/**
 * Calculate overall mastery as a weighted average of pKnown values.
 * Weights by confidence * opportunities to give more weight to well-established estimates.
 */
export function calculateOverallMastery(bktResults: SkillBktResult[]): number {
  if (bktResults.length === 0) return 0

  let weightedSum = 0
  let totalWeight = 0

  for (const skill of bktResults) {
    // Weight by confidence and opportunities
    // This gives more influence to skills with more data
    const weight = skill.confidence * Math.max(1, skill.opportunities)
    weightedSum += skill.pKnown * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0
}

/**
 * Calculate mastery metrics broken down by skill category.
 */
export function calculateCategoryMastery(
  bktResults: SkillBktResult[]
): Record<SkillCategory, CategoryMetrics> {
  // Initialize all categories
  const categories: Record<SkillCategory, CategoryMetrics> = {
    basic: { pKnownAvg: 0, skillCount: 0, masteredCount: 0, practicedCount: 0 },
    fiveComplements: {
      pKnownAvg: 0,
      skillCount: 0,
      masteredCount: 0,
      practicedCount: 0,
    },
    fiveComplementsSub: {
      pKnownAvg: 0,
      skillCount: 0,
      masteredCount: 0,
      practicedCount: 0,
    },
    tenComplements: {
      pKnownAvg: 0,
      skillCount: 0,
      masteredCount: 0,
      practicedCount: 0,
    },
    tenComplementsSub: {
      pKnownAvg: 0,
      skillCount: 0,
      masteredCount: 0,
      practicedCount: 0,
    },
    advanced: {
      pKnownAvg: 0,
      skillCount: 0,
      masteredCount: 0,
      practicedCount: 0,
    },
  }

  // Group skills by category and compute averages
  const categorySkills: Record<SkillCategory, SkillBktResult[]> = {
    basic: [],
    fiveComplements: [],
    fiveComplementsSub: [],
    tenComplements: [],
    tenComplementsSub: [],
    advanced: [],
  }

  for (const skill of bktResults) {
    const category = getSkillCategory(skill.skillId)
    categorySkills[category].push(skill)
  }

  // Calculate metrics for each category
  for (const [category, skills] of Object.entries(categorySkills) as [
    SkillCategory,
    SkillBktResult[],
  ][]) {
    if (skills.length === 0) continue

    const pKnownSum = skills.reduce((sum, s) => sum + s.pKnown, 0)
    categories[category] = {
      pKnownAvg: pKnownSum / skills.length,
      skillCount: skills.length,
      masteredCount: skills.filter((s) => s.pKnown >= BKT_THRESHOLDS.strong).length,
      practicedCount: skills.filter((s) => s.opportunities > 0).length,
    }
  }

  return categories
}

/**
 * Calculate normalized response time (seconds per term).
 * This normalizes for problem complexity - a 7-term problem taking 14 seconds
 * has the same normalized time as a 3-term problem taking 6 seconds.
 *
 * Only includes problems where help was NOT used for accurate timing.
 */
export function calculateNormalizedResponseTime(results: ProblemResultWithContext[]): {
  avgSecondsPerTerm: number | null
  trend: Trend
} {
  // Filter to problems without help for accurate timing
  const validResults = results.filter(
    (r) =>
      !r.hadHelp &&
      r.responseTimeMs > 0 &&
      r.problem?.terms?.length > 0 &&
      r.responseTimeMs < 120000 // Exclude >2 min (likely distracted)
  )

  if (validResults.length < 5) {
    return { avgSecondsPerTerm: null, trend: 'stable' }
  }

  // Calculate seconds per term for each problem
  const sptValues = validResults.map((r) => r.responseTimeMs / 1000 / r.problem.terms.length)

  // Overall average
  const avgSecondsPerTerm = sptValues.reduce((sum, v) => sum + v, 0) / sptValues.length

  // Calculate trend: compare first half vs second half (results are newest first)
  const midpoint = Math.floor(validResults.length / 2)
  const recentSptAvg = sptValues.slice(0, midpoint).reduce((sum, v) => sum + v, 0) / midpoint
  const olderSptAvg =
    sptValues.slice(midpoint).reduce((sum, v) => sum + v, 0) / (sptValues.length - midpoint)

  // Faster = improving, slower = declining (lower is better for response time)
  const changePercent = ((olderSptAvg - recentSptAvg) / olderSptAvg) * 100
  let trend: Trend = 'stable'
  if (changePercent > 10) trend = 'improving' // >10% faster
  if (changePercent < -10) trend = 'declining' // >10% slower

  return { avgSecondsPerTerm, trend }
}

/**
 * Calculate accuracy metrics.
 */
export function calculateAccuracy(results: ProblemResultWithContext[]): {
  overallPercent: number
  recentPercent: number
  trend: Trend
} {
  if (results.length === 0) {
    return { overallPercent: 0, recentPercent: 0, trend: 'stable' }
  }

  // Overall accuracy
  const correctCount = results.filter((r) => r.isCorrect).length
  const overallPercent = (correctCount / results.length) * 100

  // Recent accuracy (last 50 problems, results are newest first)
  const recentResults = results.slice(0, Math.min(50, results.length))
  const recentCorrect = recentResults.filter((r) => r.isCorrect).length
  const recentPercent = (recentCorrect / recentResults.length) * 100

  // Trend: compare first half vs second half of recent results
  if (recentResults.length < 20) {
    return { overallPercent, recentPercent, trend: 'stable' }
  }

  const midpoint = Math.floor(recentResults.length / 2)
  const newerCorrect = recentResults.slice(0, midpoint).filter((r) => r.isCorrect).length
  const olderCorrect = recentResults.slice(midpoint).filter((r) => r.isCorrect).length
  const newerPercent = (newerCorrect / midpoint) * 100
  const olderPercent = (olderCorrect / (recentResults.length - midpoint)) * 100

  const changePercent = newerPercent - olderPercent
  let trend: Trend = 'stable'
  if (changePercent > 5) trend = 'improving' // >5% better
  if (changePercent < -5) trend = 'declining' // >5% worse

  return { overallPercent, recentPercent, trend }
}

/**
 * Calculate improvement rate: change in overall mastery over the last 7 days.
 * Returns a value between -1 and 1 representing pKnown change.
 */
export function calculateImprovementRate(
  allResults: ProblemResultWithContext[],
  windowDays: number = 7
): number {
  if (allResults.length < 10) return 0 // Not enough data

  const cutoffTime = Date.now() - windowDays * 24 * 60 * 60 * 1000

  // Split results into before and after cutoff
  const olderResults = allResults.filter((r) => new Date(r.timestamp).getTime() < cutoffTime)

  if (olderResults.length < 5) return 0 // Not enough historical data

  // Compute BKT for older results only
  const olderBkt = computeBktFromHistory(olderResults)
  const olderMastery = calculateOverallMastery(olderBkt.skills)

  // Current mastery uses all results
  const currentBkt = computeBktFromHistory(allResults)
  const currentMastery = calculateOverallMastery(currentBkt.skills)

  return currentMastery - olderMastery
}

/**
 * Calculate practice streak: consecutive days with completed sessions.
 * Days are calculated in local timezone.
 */
export function calculatePracticeStreak(sessions: SessionPlan[]): number {
  // Get completed sessions sorted by date (most recent first)
  const completedSessions = sessions
    .filter((s) => s.status === 'completed' && s.completedAt)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())

  if (completedSessions.length === 0) return 0

  // Get unique days (local timezone)
  const uniqueDays = new Set<string>()
  for (const session of completedSessions) {
    const date = new Date(session.completedAt!)
    const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    uniqueDays.add(dayKey)
  }

  const sortedDays = Array.from(uniqueDays).sort().reverse() // Most recent first
  if (sortedDays.length === 0) return 0

  // Count consecutive days from today
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`

  // Check if practiced today or yesterday (allow 1-day gap)
  const mostRecentDay = sortedDays[0]
  const daysSinceMostRecent = getDaysDifference(mostRecentDay, todayKey)

  if (daysSinceMostRecent > 1) {
    // Streak is broken - more than 1 day since last practice
    return 0
  }

  // Count consecutive days
  let streak = 1
  for (let i = 1; i < sortedDays.length; i++) {
    const prevDay = sortedDays[i - 1]
    const currDay = sortedDays[i]
    const diff = getDaysDifference(currDay, prevDay)

    if (diff === 1) {
      streak++
    } else {
      break // Streak broken
    }
  }

  return streak
}

/**
 * Helper: Get days difference between two day keys
 */
function getDaysDifference(day1: string, day2: string): number {
  const parts1 = day1.split('-').map(Number)
  const parts2 = day2.split('-').map(Number)
  const date1 = new Date(parts1[0], parts1[1], parts1[2])
  const date2 = new Date(parts2[0], parts2[1], parts2[2])
  return Math.abs(Math.round((date2.getTime() - date1.getTime()) / (24 * 60 * 60 * 1000)))
}

/**
 * Calculate weekly problem count (problems in last 7 days)
 */
export function calculateWeeklyProblems(results: ProblemResultWithContext[]): number {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  return results.filter((r) => new Date(r.timestamp).getTime() > weekAgo).length
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Compute all skill metrics for a student.
 *
 * @param results - Problem results from getRecentSessionResults()
 * @param sessions - Session plans for streak calculation
 * @returns Complete skill metrics
 */
export function computeStudentSkillMetrics(
  results: ProblemResultWithContext[],
  sessions: SessionPlan[]
): StudentSkillMetrics {
  // Compute BKT from all results
  const bktResult = computeBktFromHistory(results)

  // Calculate all metrics
  const overallMastery = calculateOverallMastery(bktResult.skills)
  const categoryMastery = calculateCategoryMastery(bktResult.skills)
  const timing = calculateNormalizedResponseTime(results)
  const accuracy = calculateAccuracy(results)
  const improvementRate = calculateImprovementRate(results)
  const practiceStreak = calculatePracticeStreak(sessions)
  const weeklyProblems = calculateWeeklyProblems(results)

  return {
    computedAt: new Date(),
    overallMastery,
    categoryMastery,
    timing,
    accuracy,
    progress: {
      improvementRate,
      practiceStreak,
      totalProblems: results.length,
      weeklyProblems,
    },
  }
}

// ============================================================================
// Classroom Leaderboard Types
// ============================================================================

/**
 * A ranked student entry for leaderboards
 */
export interface StudentRank {
  playerId: string
  playerName: string
  playerEmoji: string
  value: number
  rank: number
}

/**
 * Speed champion entry - only for students who mastered the category
 */
export interface SpeedChampion {
  category: SkillCategory
  categoryName: string
  leaders: StudentRank[]
}

/**
 * Complete classroom skills leaderboard
 */
export interface ClassroomSkillsLeaderboard {
  /** When this leaderboard was computed */
  computedAt: Date

  /** Number of players in classroom */
  playerCount: number

  // Effort-based rankings (fair across all levels)
  /** Most problems completed this week */
  byWeeklyProblems: StudentRank[]
  /** Most total problems ever */
  byTotalProblems: StudentRank[]
  /** Longest practice streak */
  byPracticeStreak: StudentRank[]

  // Improvement-based rankings (fair across all levels)
  /** Best improvement rate (pKnown delta per week) */
  byImprovementRate: StudentRank[]

  // Speed champions per category (only mastered students compete)
  speedChampions: SpeedChampion[]
}

// ============================================================================
// Classroom Leaderboard Computation
// ============================================================================

/**
 * Player data needed for classroom leaderboard computation
 */
export interface PlayerLeaderboardData {
  playerId: string
  playerName: string
  playerEmoji: string
  metrics: StudentSkillMetrics
  /** Average seconds per term for each mastered category */
  categorySpeedByMastered: Map<SkillCategory, number>
}

/**
 * Calculate average speed for a category (only for mastered skills).
 * Returns null if the student hasn't mastered this category.
 */
export function calculateCategorySpeed(
  results: ProblemResultWithContext[],
  category: SkillCategory,
  masteredSkillIds: Set<string>
): number | null {
  // Filter to problems that exercise skills in this category AND are mastered
  const validResults = results.filter((r) => {
    if (r.hadHelp || r.responseTimeMs <= 0 || !r.problem?.terms?.length) return false
    if (r.responseTimeMs > 120000) return false // Exclude >2 min

    // Check if any exercised skill is in this category and mastered
    return r.skillsExercised?.some((skillId) => {
      const skillCategory = getSkillCategory(skillId)
      return skillCategory === category && masteredSkillIds.has(skillId)
    })
  })

  if (validResults.length < 3) return null // Need at least 3 problems for reliable speed

  // Calculate average seconds per term
  const totalSpt = validResults.reduce(
    (sum, r) => sum + r.responseTimeMs / 1000 / r.problem.terms.length,
    0
  )

  return totalSpt / validResults.length
}

/**
 * Compute classroom skills leaderboard from all players' data.
 */
export function computeClassroomLeaderboard(
  playersData: PlayerLeaderboardData[]
): ClassroomSkillsLeaderboard {
  // Helper to create ranked list
  const createRanking = (
    players: PlayerLeaderboardData[],
    getValue: (p: PlayerLeaderboardData) => number,
    ascending: boolean = false
  ): StudentRank[] => {
    const sorted = [...players]
      .map((p) => ({
        playerId: p.playerId,
        playerName: p.playerName,
        playerEmoji: p.playerEmoji,
        value: getValue(p),
      }))
      .filter((p) => Number.isFinite(p.value))
      .sort((a, b) => (ascending ? a.value - b.value : b.value - a.value))

    return sorted.map((p, idx) => ({ ...p, rank: idx + 1 }))
  }

  // Effort-based rankings
  const byWeeklyProblems = createRanking(playersData, (p) => p.metrics.progress.weeklyProblems)
  const byTotalProblems = createRanking(playersData, (p) => p.metrics.progress.totalProblems)
  const byPracticeStreak = createRanking(playersData, (p) => p.metrics.progress.practiceStreak)

  // Improvement-based rankings
  const byImprovementRate = createRanking(
    playersData,
    (p) => p.metrics.progress.improvementRate * 100 // Convert to percentage
  )

  // Speed champions per category
  const categories: SkillCategory[] = [
    'basic',
    'fiveComplements',
    'fiveComplementsSub',
    'tenComplements',
    'tenComplementsSub',
    'advanced',
  ]

  const speedChampions: SpeedChampion[] = []

  for (const category of categories) {
    // Get players who have mastered this category (at least some skills with pKnown >= 0.8)
    const playersWithSpeed = playersData
      .filter((p) => p.categorySpeedByMastered.has(category))
      .map((p) => ({
        playerId: p.playerId,
        playerName: p.playerName,
        playerEmoji: p.playerEmoji,
        value: p.categorySpeedByMastered.get(category)!,
      }))
      .filter((p) => Number.isFinite(p.value))
      .sort((a, b) => a.value - b.value) // Faster (lower) is better

    if (playersWithSpeed.length > 0) {
      speedChampions.push({
        category,
        categoryName: SKILL_CATEGORY_INFO[category].name,
        leaders: playersWithSpeed.slice(0, 5).map((p, idx) => ({ ...p, rank: idx + 1 })),
      })
    }
  }

  return {
    computedAt: new Date(),
    playerCount: playersData.length,
    byWeeklyProblems: byWeeklyProblems.slice(0, 10),
    byTotalProblems: byTotalProblems.slice(0, 10),
    byPracticeStreak: byPracticeStreak.slice(0, 10),
    byImprovementRate: byImprovementRate.slice(0, 10),
    speedChampions,
  }
}
