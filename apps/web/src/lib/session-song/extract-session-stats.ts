/**
 * Extract session statistics for song prompt generation.
 *
 * Takes a session plan, player, recent history, and the session's game breaks
 * and produces a structured input object that gives the LLM concrete story
 * material instead of vague achievement summaries.
 */

import { PRACTICE_TYPES } from '@/constants/practiceTypes'
import type { GameResult } from '@/db/schema/game-results'
import { retryRoundOfRow } from '@/db/schema/legacy-try-fields'
import type { Player } from '@/db/schema/players'
import { countedTries } from '@/db/schema/session-plan-helpers'
import { distinctBreakResults } from '@/db/schema/session-plan-normalize'
import type {
  BreakRecord,
  GameBreakEndReason,
  GeneratedProblem,
  ProblemSlot,
  SessionPart,
  SessionPlan,
  SlotResult,
} from '@/db/schema/session-plans'
import type { GameResultsReport } from '@/lib/arcade/game-sdk/types'
import { describeTry } from '@/lib/curriculum/parts/registry'
import { type SessionReport, sessionBreaksOf } from '@/lib/curriculum/session-report'
import { getSkillDisplayName } from '@/utils/skillSearch'

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

export interface RecentSongSummary {
  title: string
  styles: string[]
  /** The first lines of the chorus (or the first section when there is none) */
  hook: string[]
}

export interface SongPromptInput {
  player: {
    name: string
    emoji: string
    /** Age in years (computed from birthday, if available) */
    age?: number
  }
  currentSession: {
    /**
     * Since Phase 4e: the session report's first-try accuracy (first try right
     * of problems attempted). Inputs stored before 4e: accuracy over counted tries.
     */
    accuracy: number
    /** Since 4e: problems attempted (report). Before 4e: counted tries, retries included */
    problemsDone: number
    /** Problems planned */
    problemsTotal: number
    /** Since 4e (report): first tries right */
    firstTryCorrect?: number
    /** Since 4e (report): first try wrong, fixed in a retry */
    fixedInRetries?: number
    /** Since 4e (report): minutes spent answering (Σ effective response time), breaks excluded */
    activeMinutes?: number
    /**
     * @deprecated The planned length, which inputs stored before Phase 4e
     * carry. Never written since; read it only as "planned minutes".
     */
    durationMinutes?: number
    skillsPracticed: string[]
    bestCorrectStreak: number
    partTypes: string[]
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
  /** The kid's latest songs, newest first, so the writer can make this one different. */
  recentSongs?: RecentSongSummary[]
  history: {
    recentSessionCount: number
    averageAccuracy: number
    trend: 'improving' | 'steady' | 'declining'
  }
  /**
   * Every game break of this session, in the order played (§3.1: the plan's
   * `breaks`, played, skipped or timed out; for rows written before it, one
   * per `practice-break` game result, else the legacy break columns as at most
   * one). Absent when the session had no break.
   */
  gameBreaks?: SongGameBreak[]
  /**
   * @deprecated The single break that inputs stored before Phase 3b carry.
   * Never written; read only through `gameBreaksOf`.
   */
  gameBreak?: SongGameBreak
  /**
   * The session report the facts were read from (Phase 4e): its `rowVersion`
   * when the song task snapshotted it. Absent on inputs stored before 4e.
   */
  reportSnapshot?: { rowVersion: number }
}

/** The session facts a song states, which come from the session report (Phase 4e). */
export type SongReportFactKey =
  | 'accuracy'
  | 'problemsDone'
  | 'problemsTotal'
  | 'firstTryCorrect'
  | 'fixedInRetries'
  | 'activeMinutes'

/** `extractSessionStats`' output: the song input without the report's facts. */
export type ExtractedSessionStats = Omit<SongPromptInput, 'currentSession'> & {
  currentSession: Omit<SongPromptInput['currentSession'], SongReportFactKey | 'durationMinutes'>
}

/** Active time in whole minutes; a session with any active time says at least 1 */
export function activeMinutesOf(activeMs: number): number {
  if (!(activeMs > 0)) return 0
  return Math.max(1, Math.round(activeMs / 60_000))
}

/**
 * The session facts a song states, from the report: problems attempted of
 * planned, first try right, fixed in retries, first-try accuracy, active minutes.
 */
export function songFactsOf(
  report: Pick<SessionReport, 'totals' | 'time'>
): Pick<SongPromptInput['currentSession'], SongReportFactKey> {
  const { totals, time } = report
  return {
    accuracy: totals.firstTryAccuracy ?? 0,
    problemsDone: totals.problems,
    problemsTotal: totals.plannedProblems,
    firstTryCorrect: totals.firstTryCorrect,
    fixedInRetries: totals.fixedInRetries,
    activeMinutes: activeMinutesOf(time.activeMs),
  }
}

/**
 * The song's input: the story material `extractSessionStats` reads from the
 * tries, plus the session facts from the report the task snapshotted.
 */
export function songPromptInputOf(
  stats: ExtractedSessionStats,
  report: Pick<SessionReport, 'totals' | 'time' | 'rowVersion'>,
  recentSongs?: RecentSongSummary[]
): SongPromptInput {
  return {
    ...stats,
    currentSession: { ...stats.currentSession, ...songFactsOf(report) },
    ...(recentSongs && { recentSongs }),
    reportSnapshot: { rowVersion: report.rowVersion },
  }
}

export interface SongGameBreak {
  gameName: string
  headline: string
  accuracy?: number
  highlights: string[]
  details: string[]
  moments: string[]
  outcome?: string
}

/**
 * The breaks a song input names, in the order played. Reads `gameBreaks`, or
 * the single `gameBreak` of an input stored before Phase 3b (the backtest and
 * the share page read stored inputs).
 */
export function gameBreaksOf(
  input: Pick<SongPromptInput, 'gameBreaks' | 'gameBreak'>
): SongGameBreak[] {
  if (input.gameBreaks && input.gameBreaks.length > 0) return input.gameBreaks
  return input.gameBreak ? [input.gameBreak] : []
}

/** "A", "A and B", "A, B and C"; a name repeated is named once */
export function joinGameNames(gameBreaks: readonly SongGameBreak[]): string {
  const names = [...new Set(gameBreaks.map((gb) => gb.gameName))]
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
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

interface ProblemAttemptSummary {
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

function summarizeProblemAttempts(plan: SessionPlan): ProblemAttemptSummary[] {
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
    // A row's retry round as `epochNumber` read it: 0 outside a retry round, so
    // nearly every problem has one (only rows from before the retry system
    // have none); kept as it was (§10 P6a-3)
    const retryEpochs = uniqueNumbers(group.map(({ result }) => retryRoundOfRow(result)))
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
      problemText: describeTry(
        slotMeta?.part ?? plan.parts[(finalResult.partNumber ?? 1) - 1],
        finalResult
      ),
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

function scoreProblemMoment(summary: ProblemAttemptSummary, responseMedian?: number): number {
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

function kindForSummary(
  summary: ProblemAttemptSummary,
  responseMedian?: number
): SongProblemMomentKind {
  if (summary.outcome === 'eventually_correct') return 'comeback'
  if (summary.hadHelp || summary.usedOnScreenAbacus) return 'help_breakthrough'
  if (responseMedian && summary.responseTimeMs > responseMedian * 1.6) return 'slow_burn'
  return 'hard_problem'
}

function reasonForSummary(
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
  gameBreaks: SongGameBreak[]
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
  for (const gameBreak of gameBreaks) {
    arcs.push(`Side quest: ${gameBreak.gameName} - ${gameBreak.headline}.`)
  }

  // At most four practice arcs, then one per break: no cap, so every break keeps its arc.
  return uniqueStrings(arcs)
}

function buildStoryAngle(
  summaries: ProblemAttemptSummary[],
  bestCorrectStreak: number,
  gameBreaks: SongGameBreak[]
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

  if (gameBreaks.length === 1) return `practice quest with a ${gameBreaks[0].gameName} side quest`
  if (gameBreaks.length > 1) return `practice quest with ${joinGameNames(gameBreaks)} side quests`

  return 'the steady bead-building mission'
}

function buildPracticeDrama(
  plan: SessionPlan,
  bestCorrectStreak: number,
  gameBreaks: SongGameBreak[]
): SongPromptInput['practiceDrama'] {
  const summaries = summarizeProblemAttempts(plan)
  return {
    storyAngle: buildStoryAngle(summaries, bestCorrectStreak, gameBreaks),
    arcs: buildSessionArcs(summaries, bestCorrectStreak, gameBreaks),
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
  /** The session's first-try accuracy (its report), as the current session's */
  accuracy: number
}

/** A break's game and how it ended, when no game result row tells more */
interface BreakGameAndReason {
  game: string | null
  reason: GameBreakEndReason | null
}

/**
 * Extract the story material of a session for song generation: skills, streak,
 * moments, arcs, breaks and the trend. The session facts the song states
 * (problems, accuracy, fixed, minutes) are not here: they come from the
 * session report (`songPromptInputOf`, Phase 4e).
 *
 * @param plan - The current session plan (may be in-progress or completed)
 * @param player - The player profile
 * @param recentSessions - The kid's latest completed sessions, newest first, for the trend
 * @param gameBreakResults - The session's `practice-break` game results, in `played_at` order (a
 *   played break's facts; the breaks themselves come from `plan.breaks` when it has any)
 */
export function extractSessionStats(
  sessionPlan: SessionPlan,
  player: Player,
  recentSessions: RecentSessionSummary[],
  gameBreakResults: readonly GameResult[] = []
): ExtractedSessionStats {
  // Practice-only do-overs (problems already answered correctly, done again)
  // count toward nothing the song says: accuracy, streaks, moments, comebacks.
  const plan: SessionPlan = {
    ...sessionPlan,
    results: countedTries(sessionPlan.results),
  }
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

  const recentCount = recentSessions.length
  let averageAccuracy = 0
  let trend: 'improving' | 'steady' | 'declining' = 'steady'

  if (recentCount > 0) {
    averageAccuracy = recentSessions.reduce((sum, s) => sum + s.accuracy, 0) / recentCount

    if (recentCount >= 3) {
      const chronological = [...recentSessions].reverse()
      const mid = Math.floor(recentCount / 2)
      const olderAvg = chronological.slice(0, mid).reduce((sum, s) => sum + s.accuracy, 0) / mid
      const newerAvg =
        chronological.slice(mid).reduce((sum, s) => sum + s.accuracy, 0) / (recentCount - mid)

      const diff = newerAvg - olderAvg
      if (diff > 0.05) trend = 'improving'
      else if (diff < -0.05) trend = 'declining'
    }
  }

  const gameBreaks = songGameBreaksOf(sessionPlan, gameBreakResults)
  const practiceDrama = buildPracticeDrama(plan, bestCorrectStreak, gameBreaks)
  const attemptStats = getCurrentSessionAttemptStats(plan)
  const age = computeAge(player.birthday)

  return {
    player: {
      name: player.name,
      emoji: player.emoji,
      ...(age != null && { age }),
    },
    currentSession: {
      skillsPracticed: [...skillNames],
      bestCorrectStreak,
      partTypes: partTypeLabels,
      helpUsed,
      ...attemptStats,
    },
    practiceDrama,
    history: {
      recentSessionCount: recentCount,
      averageAccuracy,
      trend,
    },
    ...(gameBreaks.length > 0 && { gameBreaks }),
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
): SongGameBreak | undefined {
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

function extractGameBreak(result?: GameResult | null): SongGameBreak | undefined {
  if (!result?.fullReport) return undefined
  return extractGameBreakFromReport(result.fullReport as GameResultsReport, result.accuracy)
}

/**
 * The song's breaks, in the order played: the session's breaks as the report
 * reads them (`sessionBreaksOf`, Phase 5c). From the machine's list, every
 * break is named, played, skipped or timed out (a break whose kid never chose
 * a game has nothing to sing and is left out, as before); a played one takes
 * its facts from its game's result row (the same report, matched by game and
 * end time), else from the report the break stored. A row written before
 * `breaks` existed reads the legacy path: one break per distinct game result
 * (until Phase 6b-0, else the legacy break columns as at most one; §10 P6b-4).
 */
function songGameBreaksOf(
  plan: SessionPlan,
  gameBreakResults: readonly GameResult[]
): SongGameBreak[] {
  const distinct = distinctBreakResults(gameBreakResults)
  const { source, records } = sessionBreaksOf(plan, distinct)
  if (source === 'breaks') {
    return records
      .map((record) => songBreakOfRecord(record, distinct))
      .filter((gb): gb is SongGameBreak => gb != null)
  }
  return distinct.map(extractGameBreak).filter((gb): gb is SongGameBreak => gb != null)
}

function songBreakOfRecord(
  record: BreakRecord,
  gameResults: readonly GameResult[]
): SongGameBreak | undefined {
  // A break played before Phase 3a, listed from its game result row (§10 P5c-7)
  if (record.gameResultId != null) {
    const row = gameResults.find((g) => g.id === record.gameResultId)
    const fromRow = row && extractGameBreak(row)
    if (fromRow) return fromRow
  }
  const report = record.results
  if (report) {
    const row = gameResults.find((g) => {
      const stored = g.fullReport as Partial<GameResultsReport> | null | undefined
      return stored?.endedAt === report.endedAt && stored?.gameName === report.gameName
    })
    return (row && extractGameBreak(row)) ?? extractGameBreakFromReport(report)
  }
  return extractGameBreakFallback({ game: record.game ?? null, reason: record.reason ?? null })
}

const BREAK_REASON_LABELS: Record<GameBreakEndReason, string> = {
  timeout: 'timed out',
  skipped: 'ended early',
  gameFinished: 'completed',
}

function extractGameBreakFallback(fallback: BreakGameAndReason): SongGameBreak | undefined {
  if (!fallback.game) return undefined

  const gameName = fallback.game
  const reasonLabel = fallback.reason ? BREAK_REASON_LABELS[fallback.reason] : 'played'

  return {
    gameName,
    headline: `Played ${gameName} (${reasonLabel})`,
    highlights: [],
    details: [],
    moments: [],
    outcome: reasonLabel,
  }
}
