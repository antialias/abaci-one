/**
 * Extract session statistics for song prompt generation.
 *
 * Takes a session plan, player, recent history, and optional game-break report
 * and produces a structured input object that gives the LLM concrete story
 * material instead of vague achievement summaries.
 */

import { PRACTICE_TYPES } from '@/constants/practiceTypes'
import type { GameResult } from '@/db/schema/game-results'
import type { Player } from '@/db/schema/players'
import {
  getCompletedProblemCount,
  getSessionPlanAccuracy,
  getTotalProblemCount,
} from '@/db/schema/session-plan-helpers'
import type {
  GameBreakEndReason,
  GeneratedProblem,
  ProblemSlot,
  SessionPart,
  SessionPlan,
  SlotResult,
} from '@/db/schema/session-plans'
import type { GameResultsReport } from '@/lib/arcade/game-sdk/types'
import { getSkillDisplayName } from '@/utils/skillSearch'
import type { SongConcept } from './concept-selector'

// ============================================================================
// Types
// ============================================================================

export type SongProblemMomentKind =
  | 'comeback'
  | 'help_breakthrough'
  | 'hard_problem'
  | 'streak_peak'
  | 'slow_burn'
  | 'finale'

export interface SongProblemMoment {
  kind: SongProblemMomentKind
  reason: string
  problem: string
  partType: string
  purpose?: ProblemSlot['purpose']
  answer: number
  studentAnswers: number[]
  attempts: number
  incorrectAttempts: number
  outcome: 'correct' | 'eventually_correct' | 'incorrect'
  skills: string[]
  strategySteps: string[]
  responseSeconds?: number
}

export interface SongSkillSpotlight {
  skill: string
  attempts: number
  correct: number
  problems: number
  exampleProblems: string[]
}

export interface SongPromptInput {
  player: {
    name: string
    emoji: string
    /** Age in years (computed from birthday, if available) */
    age?: number
  }
  currentSession: {
    accuracy: number
    problemsDone: number
    problemsTotal: number
    skillsPracticed: string[]
    bestCorrectStreak: number
    partTypes: string[]
    durationMinutes: number
    helpUsed: boolean
    totalIncorrectAttempts: number
    helpMoments: number
    retryMoments: number
    averageResponseSeconds?: number
  }
  practiceDrama: {
    storyAngle: string
    arcs: string[]
    problemMoments: SongProblemMoment[]
    skillSpotlights: SongSkillSpotlight[]
  }
  /** Optional deterministic story concept selected after evidence extraction. */
  songConcept?: SongConcept
  history: {
    recentSessionCount: number
    averageAccuracy: number
    trend: 'improving' | 'steady' | 'declining'
  }
  /** Optional game break results from this session */
  gameBreak?: {
    gameName: string
    headline: string
    accuracy?: number
    highlights: string[]
    details: string[]
    moments: string[]
    outcome?: string
  }
}

// ============================================================================
// Generic helpers
// ============================================================================

function uniqueStrings(values: Array<string | null | undefined>, limit = Number.POSITIVE_INFINITY) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const trimmed = value?.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
    if (result.length >= limit) break
  }
  return result
}

function uniqueNumbers(values: Array<number | null | undefined>) {
  const seen = new Set<number>()
  const result: number[] = []
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isFinite(value) || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

function formatDurationSeconds(ms: number | null | undefined): number | undefined {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return undefined
  return Math.round(ms / 100) / 10
}

function median(values: number[]): number | undefined {
  const sorted = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b)
  if (sorted.length === 0) return undefined
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function getBestCorrectStreak(results: Array<{ isCorrect: boolean }>): number {
  return findBestCorrectStreak(results).length
}

function findBestCorrectStreak(results: Array<{ isCorrect: boolean }>): {
  length: number
  startIndex: number
  endIndex: number
} {
  let best = 0
  let bestStart = -1
  let bestEnd = -1
  let current = 0
  let currentStart = 0

  for (let i = 0; i < results.length; i++) {
    if (results[i].isCorrect) {
      if (current === 0) currentStart = i
      current++
      if (current > best) {
        best = current
        bestStart = currentStart
        bestEnd = i
      }
    } else {
      current = 0
    }
  }

  return { length: best, startIndex: bestStart, endIndex: bestEnd }
}

function getPartTypeLabel(partType: string): string {
  const found = PRACTICE_TYPES.find((t) => t.id === partType)
  return found?.label ?? partType
}

function computeAge(birthday: string | null | undefined): number | undefined {
  if (!birthday) return undefined
  const birth = new Date(birthday)
  if (Number.isNaN(birth.getTime())) return undefined
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--
  }
  return age >= 0 ? age : undefined
}

function formatProblemExpression(terms: number[], answer: number): string {
  const expression = terms
    .map((term, index) => {
      if (index === 0) return String(term)
      return term < 0 ? ` - ${Math.abs(term)}` : ` + ${term}`
    })
    .join('')
  return `${expression} = ${answer}`
}

function displaySkill(skillId: string): string {
  return getSkillDisplayName(skillId).replace(/\s+/g, ' ').trim()
}

function getProblemSkillIds(problem: GeneratedProblem, resultSkills: string[] = []): string[] {
  return uniqueStrings([
    ...(resultSkills ?? []),
    ...(problem.skillsRequired ?? []),
    ...(problem.generationTrace?.allSkills ?? []),
    ...(problem.generationTrace?.steps?.flatMap((step) => step.skillsUsed ?? []) ?? []),
  ])
}

function getStrategySteps(problem: GeneratedProblem): string[] {
  const trace = problem.generationTrace
  if (!trace?.steps?.length) {
    return uniqueStrings(
      (problem.skillsRequired ?? []).map((skill) => `Used ${displaySkill(skill)}`),
      3
    )
  }

  const stepNotes = trace.steps
    .filter((step) => step.skillsUsed?.length)
    .map((step) => {
      const skills = uniqueStrings(step.skillsUsed.map(displaySkill), 3).join(', ')
      return `${step.operation} using ${skills}`
    })

  return uniqueStrings(stepNotes, 4)
}

function slotLookup(plan: SessionPlan) {
  const byId = new Map<
    string,
    {
      slot: ProblemSlot
      part: SessionPart
      partIndex: number
      slotIndex: number
    }
  >()

  plan.parts.forEach((part, partIndex) => {
    part.slots.forEach((slot, slotIndex) => {
      if (slot.slotId) {
        byId.set(slot.slotId, { slot, part, partIndex, slotIndex })
      }
    })
  })

  return byId
}

// ============================================================================
// Practice drama extraction
// ============================================================================

export interface ProblemAttemptSummary {
  slotId: string
  resultIndex: number
  partType: string
  purpose?: ProblemSlot['purpose']
  problem: GeneratedProblem
  problemText: string
  answer: number
  studentAnswers: number[]
  attempts: number
  incorrectAttempts: number
  isCorrect: boolean
  outcome: SongProblemMoment['outcome']
  hadHelp: boolean
  usedOnScreenAbacus: boolean
  responseTimeMs: number
  totalResponseTimeMs: number
  complexityCost?: number
  skillIds: string[]
  skillLabels: string[]
  strategySteps: string[]
  retryEpochs: number[]
}

export function summarizeProblemAttempts(plan: SessionPlan): ProblemAttemptSummary[] {
  const lookup = slotLookup(plan)
  const groups = new Map<string, Array<{ result: SlotResult; resultIndex: number }>>()

  plan.results.forEach((result, resultIndex) => {
    const key = result.slotId || `${result.partNumber}-${result.slotIndex}-${resultIndex}`
    const group = groups.get(key) ?? []
    group.push({ result, resultIndex })
    groups.set(key, group)
  })

  const summaries: ProblemAttemptSummary[] = []

  for (const [slotId, group] of groups) {
    const final = group[group.length - 1]
    if (!final?.result?.problem) continue

    const finalResult = final.result
    const problem = finalResult.problem
    const slotMeta = lookup.get(slotId)
    const partType =
      slotMeta?.part.type ??
      plan.parts[(finalResult.partNumber ?? 1) - 1]?.type ??
      String(finalResult.partNumber ?? 'practice')

    const perResultAttemptCounts = group.map(({ result }) =>
      Math.max(1, (result.incorrectAttempts ?? 0) + (result.isCorrect ? 1 : 0))
    )
    const attempts = Math.max(group.length, ...perResultAttemptCounts)
    const incorrectAttempts = Math.max(
      group.filter(({ result }) => !result.isCorrect).length,
      ...group.map(({ result }) => result.incorrectAttempts ?? 0),
      attempts - (finalResult.isCorrect ? 1 : 0)
    )
    const skillIds = getProblemSkillIds(
      problem,
      group.flatMap(({ result }) => result.skillsExercised ?? [])
    )
    const retryEpochs = uniqueNumbers(group.map(({ result }) => result.epochNumber))
    const totalResponseTimeMs = group.reduce(
      (sum, { result }) => sum + (result.responseTimeMs ?? 0),
      0
    )

    summaries.push({
      slotId,
      resultIndex: final.resultIndex,
      partType: getPartTypeLabel(partType),
      purpose: slotMeta?.slot.purpose,
      problem,
      problemText: formatProblemExpression(problem.terms, problem.answer),
      answer: problem.answer,
      studentAnswers: uniqueNumbers(group.map(({ result }) => result.studentAnswer)),
      attempts,
      incorrectAttempts,
      isCorrect: finalResult.isCorrect,
      outcome: finalResult.isCorrect
        ? attempts > 1 || incorrectAttempts > 0
          ? 'eventually_correct'
          : 'correct'
        : 'incorrect',
      hadHelp: group.some(({ result }) => result.hadHelp),
      usedOnScreenAbacus: group.some(({ result }) => result.usedOnScreenAbacus),
      responseTimeMs: finalResult.responseTimeMs ?? 0,
      totalResponseTimeMs,
      complexityCost: problem.generationTrace?.totalComplexityCost,
      skillIds,
      skillLabels: skillIds.map(displaySkill),
      strategySteps: getStrategySteps(problem),
      retryEpochs,
    })
  }

  return summaries.sort((a, b) => a.resultIndex - b.resultIndex)
}

function isHardSkill(skillId: string): boolean {
  return (
    skillId.startsWith('tenComplements') ||
    skillId.startsWith('advanced') ||
    skillId.startsWith('mixedComplements')
  )
}

export function scoreProblemMoment(
  summary: ProblemAttemptSummary,
  responseMedian?: number
): number {
  let score = 0

  if (summary.outcome === 'eventually_correct') score += 10
  if (summary.outcome === 'incorrect' && summary.incorrectAttempts > 0) score += 7
  if (summary.hadHelp || summary.usedOnScreenAbacus) score += 5
  if (summary.attempts >= 3) score += 3
  if ((summary.complexityCost ?? 0) >= 5) score += 4
  else if ((summary.complexityCost ?? 0) >= 3) score += 2
  if (summary.skillIds.some(isHardSkill)) score += 3
  if (summary.purpose === 'challenge') score += 2
  if (summary.retryEpochs.length > 0) score += 2
  if (responseMedian && summary.responseTimeMs > responseMedian * 1.6) score += 2

  return score
}

export function kindForSummary(
  summary: ProblemAttemptSummary,
  responseMedian?: number
): SongProblemMomentKind {
  if (summary.outcome === 'eventually_correct') return 'comeback'
  if (summary.hadHelp || summary.usedOnScreenAbacus) return 'help_breakthrough'
  if (responseMedian && summary.responseTimeMs > responseMedian * 1.6) return 'slow_burn'
  return 'hard_problem'
}

export function reasonForSummary(
  summary: ProblemAttemptSummary,
  kind: SongProblemMomentKind,
  streakLength?: number
): string {
  if (kind === 'streak_peak') {
    return `sealed a ${streakLength ?? 0}-problem correct streak`
  }
  if (kind === 'comeback') {
    return `came back on this problem after ${summary.attempts} attempts`
  }
  if (kind === 'help_breakthrough') {
    return `used help as a strategy instead of getting stuck`
  }
  if (kind === 'slow_burn') {
    const seconds = formatDurationSeconds(summary.responseTimeMs)
    return seconds ? `stayed with it for ${seconds} seconds` : 'stayed with a slower problem'
  }
  if (kind === 'finale') return 'closed the session with a final push'
  if ((summary.complexityCost ?? 0) >= 5) {
    return `high-complexity problem with cost ${summary.complexityCost}`
  }
  if (summary.skillLabels.length > 0) {
    return `spotlighted ${summary.skillLabels.slice(0, 2).join(' and ')}`
  }
  return 'stood out as a specific session moment'
}

function toProblemMoment(
  summary: ProblemAttemptSummary,
  kind: SongProblemMomentKind,
  reason: string
): SongProblemMoment {
  return {
    kind,
    reason,
    problem: summary.problemText,
    partType: summary.partType,
    ...(summary.purpose && { purpose: summary.purpose }),
    answer: summary.answer,
    studentAnswers: summary.studentAnswers,
    attempts: summary.attempts,
    incorrectAttempts: summary.incorrectAttempts,
    outcome: summary.outcome,
    skills: summary.skillLabels.slice(0, 5),
    strategySteps: summary.strategySteps.slice(0, 4),
    ...(formatDurationSeconds(summary.responseTimeMs) != null && {
      responseSeconds: formatDurationSeconds(summary.responseTimeMs),
    }),
  }
}

function selectProblemMoments(
  summaries: ProblemAttemptSummary[],
  results: SlotResult[]
): SongProblemMoment[] {
  if (summaries.length === 0) return []

  const responseMedian = median(summaries.map((s) => s.responseTimeMs))
  const scored = summaries
    .map((summary) => ({
      summary,
      score: scoreProblemMoment(summary, responseMedian),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.summary.resultIndex - a.summary.resultIndex)

  const selected = scored.slice(0, 3).map(({ summary }) => {
    const kind = kindForSummary(summary, responseMedian)
    return { summary, kind, reason: reasonForSummary(summary, kind) }
  })

  if (selected.length === 0) {
    const fallback = [...summaries].sort(
      (a, b) => (b.complexityCost ?? 0) - (a.complexityCost ?? 0) || b.resultIndex - a.resultIndex
    )[0]
    if (fallback) {
      selected.push({
        summary: fallback,
        kind: 'hard_problem',
        reason: reasonForSummary(fallback, 'hard_problem'),
      })
    }
  }

  const streak = findBestCorrectStreak(results)
  if (streak.length >= 3) {
    const streakSummary = summaries.find((summary) => summary.resultIndex === streak.endIndex)
    if (streakSummary && !selected.some(({ summary }) => summary.slotId === streakSummary.slotId)) {
      selected.push({
        summary: streakSummary,
        kind: 'streak_peak',
        reason: reasonForSummary(streakSummary, 'streak_peak', streak.length),
      })
    }
  }

  const last = summaries[summaries.length - 1]
  if (
    last &&
    selected.length < 4 &&
    !selected.some(({ summary }) => summary.slotId === last.slotId) &&
    (last.outcome === 'eventually_correct' || (last.complexityCost ?? 0) >= 3)
  ) {
    selected.push({
      summary: last,
      kind: 'finale',
      reason: reasonForSummary(last, 'finale'),
    })
  }

  return selected
    .slice(0, 4)
    .map(({ summary, kind, reason }) => toProblemMoment(summary, kind, reason))
}

function buildSkillSpotlights(summaries: ProblemAttemptSummary[]): SongSkillSpotlight[] {
  const stats = new Map<
    string,
    {
      skill: string
      attempts: number
      correct: number
      problems: number
      exampleProblems: string[]
    }
  >()

  for (const summary of summaries) {
    for (const skillId of uniqueStrings(summary.skillIds)) {
      const existing =
        stats.get(skillId) ??
        ({
          skill: displaySkill(skillId),
          attempts: 0,
          correct: 0,
          problems: 0,
          exampleProblems: [],
        } satisfies SongSkillSpotlight)

      existing.attempts += summary.attempts
      existing.correct += summary.isCorrect ? 1 : 0
      existing.problems += 1
      if (!existing.exampleProblems.includes(summary.problemText)) {
        existing.exampleProblems.push(summary.problemText)
      }
      stats.set(skillId, existing)
    }
  }

  return [...stats.entries()]
    .sort(([aId, a], [bId, b]) => {
      const hardDiff = Number(isHardSkill(bId)) - Number(isHardSkill(aId))
      return (
        hardDiff ||
        b.problems - a.problems ||
        b.attempts - a.attempts ||
        a.skill.localeCompare(b.skill)
      )
    })
    .slice(0, 6)
    .map(([, stat]) => ({
      skill: stat.skill,
      attempts: stat.attempts,
      correct: stat.correct,
      problems: stat.problems,
      exampleProblems: stat.exampleProblems.slice(0, 2),
    }))
}

function buildSessionArcs(
  summaries: ProblemAttemptSummary[],
  bestCorrectStreak: number,
  gameBreak?: SongPromptInput['gameBreak']
): string[] {
  const arcs: string[] = []
  const comeback = summaries.find((s) => s.outcome === 'eventually_correct')
  const helpCount = summaries.filter((s) => s.hadHelp || s.usedOnScreenAbacus).length
  const hard = [...summaries].sort((a, b) => (b.complexityCost ?? 0) - (a.complexityCost ?? 0))[0]

  if (comeback) {
    arcs.push(
      `Comeback: ${comeback.problemText} took ${comeback.attempts} attempts and finished right.`
    )
  }
  if (bestCorrectStreak >= 3) {
    arcs.push(`Streak: ${bestCorrectStreak} correct answers in a row.`)
  }
  if (helpCount > 0) {
    arcs.push(
      `Strategy: used help on ${helpCount} problem${helpCount === 1 ? '' : 's'} and kept going.`
    )
  }
  if (hard?.complexityCost != null) {
    arcs.push(`Boss problem: ${hard.problemText} carried complexity cost ${hard.complexityCost}.`)
  }
  if (gameBreak) {
    arcs.push(`Side quest: ${gameBreak.gameName} - ${gameBreak.headline}.`)
  }

  return uniqueStrings(arcs, 5)
}

function buildStoryAngle(
  summaries: ProblemAttemptSummary[],
  bestCorrectStreak: number,
  gameBreak?: SongPromptInput['gameBreak']
): string {
  const comeback = summaries.find((s) => s.outcome === 'eventually_correct')
  if (comeback) return `the ${comeback.problemText} comeback`

  const helped = summaries.find((s) => s.hadHelp || s.usedOnScreenAbacus)
  if (helped) return `the strategy unlock on ${helped.problemText}`

  if (bestCorrectStreak >= 4) return `the ${bestCorrectStreak}-in-a-row run`

  const hard = [...summaries]
    .filter((s) => s.skillIds.some(isHardSkill) || (s.complexityCost ?? 0) >= 3)
    .sort((a, b) => (b.complexityCost ?? 0) - (a.complexityCost ?? 0))[0]
  if (hard) return `the ${hard.problemText} boss level`

  if (gameBreak) return `practice quest with a ${gameBreak.gameName} side quest`

  return 'the steady bead-building mission'
}

function buildPracticeDrama(
  plan: SessionPlan,
  bestCorrectStreak: number,
  gameBreak?: SongPromptInput['gameBreak']
): SongPromptInput['practiceDrama'] {
  const summaries = summarizeProblemAttempts(plan)
  return {
    storyAngle: buildStoryAngle(summaries, bestCorrectStreak, gameBreak),
    arcs: buildSessionArcs(summaries, bestCorrectStreak, gameBreak),
    problemMoments: selectProblemMoments(summaries, plan.results),
    skillSpotlights: buildSkillSpotlights(summaries),
  }
}

function getCurrentSessionAttemptStats(plan: SessionPlan) {
  const summaries = summarizeProblemAttempts(plan)
  const responseTimes = plan.results
    .map((result) => result.responseTimeMs)
    .filter((ms): ms is number => typeof ms === 'number' && Number.isFinite(ms) && ms > 0)

  return {
    totalIncorrectAttempts: summaries.reduce((sum, summary) => sum + summary.incorrectAttempts, 0),
    helpMoments: summaries.filter((summary) => summary.hadHelp || summary.usedOnScreenAbacus)
      .length,
    retryMoments: summaries.filter((summary) => summary.attempts > 1).length,
    averageResponseSeconds:
      responseTimes.length > 0
        ? Math.round(
            (responseTimes.reduce((sum, ms) => sum + ms, 0) / responseTimes.length / 1000) * 10
          ) / 10
        : undefined,
  }
}

// ============================================================================
// Main extractor
// ============================================================================

interface RecentSessionSummary {
  accuracy: number
}

/** Fallback break info from the session plan (when no gameResults record exists) */
interface PlanBreakFallback {
  breakSelectedGame: string | null
  breakReason: GameBreakEndReason | null
  breakResults?: GameResultsReport | null
}

/**
 * Extract statistics from a session plan and player for use in song generation.
 *
 * @param plan - The current session plan (may be in-progress or completed)
 * @param player - The player profile
 * @param recentSessions - Summary of recent sessions (past week) for trend calculation
 * @param gameBreakResult - Optional game result from the practice break
 * @param planBreakFallback - Fallback break info from the plan
 */
export function extractSessionStats(
  plan: SessionPlan,
  player: Player,
  recentSessions: RecentSessionSummary[],
  gameBreakResult?: GameResult | null,
  planBreakFallback?: PlanBreakFallback
): SongPromptInput {
  const accuracy = getSessionPlanAccuracy(plan)
  const problemsDone = getCompletedProblemCount(plan)
  const problemsTotal = getTotalProblemCount(plan)
  const bestCorrectStreak = getBestCorrectStreak(plan.results)

  const partTypeIds = [...new Set(plan.parts.map((p) => p.type))]
  const partTypeLabels = partTypeIds.map(getPartTypeLabel)

  const skillNames = new Set<string>()
  for (const result of plan.results) {
    for (const skill of result.skillsExercised ?? []) {
      skillNames.add(displaySkill(skill))
    }
  }

  const helpUsed = plan.results.some((r) => r.hadHelp)
  const durationMinutes = plan.targetDurationMinutes ?? 10

  const recentCount = recentSessions.length
  let averageAccuracy = 0
  let trend: 'improving' | 'steady' | 'declining' = 'steady'

  if (recentCount > 0) {
    averageAccuracy = recentSessions.reduce((sum, s) => sum + s.accuracy, 0) / recentCount

    if (recentCount >= 3) {
      const mid = Math.floor(recentCount / 2)
      const olderAvg = recentSessions.slice(0, mid).reduce((sum, s) => sum + s.accuracy, 0) / mid
      const newerAvg =
        recentSessions.slice(mid).reduce((sum, s) => sum + s.accuracy, 0) / (recentCount - mid)

      const diff = newerAvg - olderAvg
      if (diff > 0.05) trend = 'improving'
      else if (diff < -0.05) trend = 'declining'
    }
  }

  const gameBreak =
    extractGameBreak(gameBreakResult) ??
    extractGameBreakFromReport(planBreakFallback?.breakResults ?? null) ??
    extractGameBreakFallback(planBreakFallback)
  const practiceDrama = buildPracticeDrama(plan, bestCorrectStreak, gameBreak)
  const attemptStats = getCurrentSessionAttemptStats(plan)
  const age = computeAge(player.birthday)

  return {
    player: {
      name: player.name,
      emoji: player.emoji,
      ...(age != null && { age }),
    },
    currentSession: {
      accuracy,
      problemsDone,
      problemsTotal,
      skillsPracticed: [...skillNames],
      bestCorrectStreak,
      partTypes: partTypeLabels,
      durationMinutes,
      helpUsed,
      ...attemptStats,
    },
    practiceDrama,
    history: {
      recentSessionCount: recentCount,
      averageAccuracy,
      trend,
    },
    gameBreak,
  }
}

// ============================================================================
// Game break extraction
// ============================================================================

function normalizePercent(value: number | null | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return value <= 1 ? Math.round(value * 100) : Math.round(value)
}

function statToText(stat: NonNullable<GameResultsReport['customStats']>[number]): string {
  return `${stat.label}: ${String(stat.value)}`
}

function playerResultDetails(report: GameResultsReport): string[] {
  return (report.playerResults ?? []).slice(0, 3).map((player) => {
    const pieces = [`${player.playerName} scored ${player.score}`]
    if (player.correctCount != null && player.totalAttempts != null) {
      pieces.push(`${player.correctCount}/${player.totalAttempts} correct`)
    }
    if (player.accuracy != null) pieces.push(`${normalizePercent(player.accuracy)}% accuracy`)
    if (player.bestStreak != null && player.bestStreak > 1) {
      pieces.push(`${player.bestStreak}-streak`)
    }
    return pieces.join(', ')
  })
}

function extractGameBreakFromReport(
  report?: GameResultsReport | null,
  storedAccuracy?: number | null
): SongPromptInput['gameBreak'] {
  if (!report) return undefined

  const headline = report.headline ?? report.gameDisplayName
  const stats = report.customStats ?? []
  const highlighted = stats.filter((s) => s.highlight)
  const picks = (highlighted.length >= 2 ? highlighted : stats).slice(0, 5)
  const highlights = picks.map(statToText)
  const playerAccuracy = (report.playerResults ?? []).find((p) => p.accuracy != null)?.accuracy
  const accuracy = normalizePercent(storedAccuracy ?? report.teamAccuracy ?? playerAccuracy)

  const completion =
    report.itemsTotal && report.itemsTotal > 0
      ? `${report.itemsCompleted ?? 0}/${report.itemsTotal} completed`
      : undefined
  const difficulty = report.leaderboardEntry?.difficulty
    ? `Difficulty: ${report.leaderboardEntry.difficulty}`
    : undefined
  const winner = report.winnerId
    ? report.playerResults.find((p) => p.playerId === report.winnerId)?.playerName
    : undefined

  const details = uniqueStrings(
    [
      report.songContext?.summary,
      report.subheadline,
      completion,
      difficulty,
      winner ? `Winner: ${winner}` : undefined,
      report.winCondition ? `Win condition: ${report.winCondition}` : undefined,
      report.victoryType ? `Victory type: ${report.victoryType}` : undefined,
      ...playerResultDetails(report),
      ...(report.songContext?.details ?? []),
    ],
    8
  )

  const moments = uniqueStrings(
    [
      ...(report.songContext?.dramaticMoments ?? []),
      ...(report.songContext?.strategyNotes ?? []),
      ...(report.completedNormally
        ? ['Game reached its normal finish']
        : ['Game ended before a full finish']),
      ...(report.scoreBreakdown ?? [])
        .filter((part) => part.points > 0)
        .slice(0, 3)
        .map((part) =>
          part.maxPoints
            ? `${part.component}: ${part.points}/${part.maxPoints} points`
            : `${part.component}: ${part.points} points`
        ),
      ...highlighted.map(statToText),
    ],
    8
  )

  return {
    gameName: report.gameDisplayName,
    headline,
    ...(accuracy != null && { accuracy }),
    highlights,
    details,
    moments,
    ...(report.songContext?.outcome && { outcome: report.songContext.outcome }),
  }
}

export function extractGameBreak(result?: GameResult | null): SongPromptInput['gameBreak'] {
  if (!result?.fullReport) return undefined
  return extractGameBreakFromReport(result.fullReport as GameResultsReport, result.accuracy)
}

const BREAK_REASON_LABELS: Record<GameBreakEndReason, string> = {
  timeout: 'timed out',
  skipped: 'ended early',
  gameFinished: 'completed',
}

function extractGameBreakFallback(fallback?: PlanBreakFallback): SongPromptInput['gameBreak'] {
  if (!fallback?.breakSelectedGame) return undefined

  const gameName = fallback.breakSelectedGame
  const reasonLabel = fallback.breakReason ? BREAK_REASON_LABELS[fallback.breakReason] : 'played'

  return {
    gameName,
    headline: `Played ${gameName} (${reasonLabel})`,
    highlights: [],
    details: [],
    moments: [],
    outcome: reasonLabel,
  }
}
