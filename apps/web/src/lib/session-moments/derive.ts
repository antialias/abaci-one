/**
 * Derive notable moments from a completed (or near-complete) practice session.
 *
 * Reads what's already persisted (`session_plans.results`, `game_results` for
 * practice-break sessions) and emits typed moment rows that can be:
 *   - persisted to `session_moments`
 *   - fed to the lyric LLM as a `MomentCatalogEntry[]`
 *   - referenced from lyric sections via `momentRefs: string[]`
 *
 * Stays pure — no DB writes — so callers can dry-run for inspection.
 */

import type { GameResult } from '@/db/schema/game-results'
import type { SessionPlan } from '@/db/schema/session-plans'
import type { SessionMomentType } from '@/db/schema/session-moments'
import {
  extractGameBreak,
  kindForSummary,
  type ProblemAttemptSummary,
  reasonForSummary,
  scoreProblemMoment,
  summarizeProblemAttempts,
} from '@/lib/session-song/extract-session-stats'
import type {
  AbacusProblemSnapshot,
  GameBreakSnapshot,
} from './types'

// ============================================================================
// Public shape — a "to-be-persisted" moment row
// ============================================================================

export interface DerivedMoment {
  shortId: string
  type: SessionMomentType
  significance: number
  timestampMs: number
  summary: string
  snapshot: AbacusProblemSnapshot | GameBreakSnapshot
}

export interface DeriveOptions {
  /** Hard cap on how many moments to emit total. Defaults to 10. */
  limit?: number
}

// ============================================================================
// Driver
// ============================================================================

export function deriveSessionMoments(
  plan: SessionPlan,
  gameBreakResult: GameResult | null,
  options: DeriveOptions = {}
): DerivedMoment[] {
  const limit = options.limit ?? 10
  const moments: DerivedMoment[] = []

  // 1. Abacus problems — re-use the existing classifier.
  moments.push(...deriveAbacusProblemMoments(plan))

  // 2. Game break — at most one moment for v1.
  const breakMoment = deriveGameBreakMoment(plan, gameBreakResult)
  if (breakMoment) moments.push(breakMoment)

  // 3. Sort by significance, take the top N.
  moments.sort((a, b) => b.significance - a.significance)
  return moments.slice(0, limit)
}

// ============================================================================
// Abacus problem moments
// ============================================================================

function deriveAbacusProblemMoments(plan: SessionPlan): DerivedMoment[] {
  const summaries = summarizeProblemAttempts(plan)
  if (summaries.length === 0) return []

  // Use median response time to seed the slow-burn classifier (same heuristic
  // the existing lyric stats path uses).
  const responseTimes = summaries
    .map((s) => s.responseTimeMs)
    .filter((n) => Number.isFinite(n) && n > 0)
  const responseMedian = responseTimes.length > 0 ? median(responseTimes) : undefined

  return summaries.map((summary, idx) => {
    const kind = kindForSummary(summary, responseMedian)
    const significance = scoreProblemMoment(summary, responseMedian)
    const reason = reasonForSummary(summary, kind)
    const shortId = buildAbacusShortId(summary)
    const summaryText = buildProblemSummaryText(summary, kind, reason)

    const snapshot: AbacusProblemSnapshot = {
      problemIndex: idx + 1,
      partIndex: partIndexFromResultIndex(plan, summary.resultIndex),
      partType: summary.partType,
      terms: summary.problem.terms,
      answer: summary.answer,
      studentAnswers: summary.studentAnswers,
      attempts: summary.attempts,
      incorrectAttempts: summary.incorrectAttempts,
      outcome: summary.outcome,
      responseSeconds: summary.responseTimeMs > 0 ? summary.responseTimeMs / 1000 : undefined,
      hadHelp: summary.hadHelp,
      skills: summary.skillLabels.slice(0, 5),
      strategySteps: summary.strategySteps.slice(0, 4),
      storyKind: kind,
      reason,
    }

    return {
      shortId,
      type: 'abacus-problem',
      significance,
      timestampMs: 0, // session_plans.results doesn't carry a stable wall-clock offset
      summary: summaryText,
      snapshot,
    }
  })
}

/**
 * Build a memorable short ID. Format: `m_p{partIndex}q{problemIndex}` —
 * "moment, part 1, question 3" → `m_p1q3`. Falls back to slotId hash when
 * partIndex isn't available so we never produce duplicates within a session.
 */
function buildAbacusShortId(summary: ProblemAttemptSummary): string {
  const slotIdSuffix = summary.slotId.slice(-4)
  return `m_${summary.partType.replace(/\s+/g, '').slice(0, 6)}-${slotIdSuffix}`
}

/**
 * Best-effort 1-based part index. SlotResult tracks `partNumber` so we can
 * usually recover it, but we don't have it directly on the summary — derive
 * by walking plan.results around the result index.
 */
function partIndexFromResultIndex(plan: SessionPlan, resultIndex: number): number {
  const result = plan.results?.[resultIndex]
  return result?.partNumber ?? 1
}

function buildProblemSummaryText(
  summary: ProblemAttemptSummary,
  kind: string,
  reason: string
): string {
  const verb =
    summary.outcome === 'correct'
      ? 'Nailed'
      : summary.outcome === 'eventually_correct'
        ? 'Stuck with'
        : 'Wrestled with'
  return `${verb} ${summary.problemText} — ${reason} (${kind.replace('_', ' ')})`
}

// ============================================================================
// Game break moment
// ============================================================================

function deriveGameBreakMoment(
  plan: SessionPlan,
  gameBreakResult: GameResult | null
): DerivedMoment | null {
  const gameBreak = extractGameBreak(gameBreakResult)
  if (!gameBreak || !gameBreakResult) return null

  const snapshot: GameBreakSnapshot = {
    gameName: gameBreakResult.gameName,
    gameDisplayName: gameBreakResult.gameDisplayName ?? gameBreakResult.gameName,
    gameIcon: gameBreakResult.gameIcon ?? undefined,
    category: gameBreakResult.category ?? 'puzzle',
    normalizedScore: gameBreakResult.normalizedScore ?? 0,
    accuracy: gameBreakResult.accuracy ?? undefined,
    outcome: gameBreak.outcome,
    headline: gameBreak.headline,
    highlights: gameBreak.highlights,
    durationMs: gameBreakResult.durationMs ?? undefined,
  }

  // Significance is "the kid played and we have a result" — moderate base score
  // bumped by accuracy/score so a strong break is preferred over a weak one.
  const accuracyBoost = (snapshot.accuracy ?? 0) * 4
  const scoreBoost = snapshot.normalizedScore / 25 // up to +4 for a perfect run
  const significance = 6 + accuracyBoost + scoreBoost

  return {
    shortId: `m_break-${slugify(snapshot.gameName)}`,
    type: 'game-break',
    significance,
    timestampMs: 0,
    summary:
      snapshot.headline ??
      `Game break: ${snapshot.gameDisplayName}${
        snapshot.accuracy != null ? ` (${Math.round(snapshot.accuracy * 100)}% accuracy)` : ''
      }`,
    snapshot,
  }
}

// ============================================================================
// Helpers
// ============================================================================

function median(values: number[]): number | undefined {
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 0) return undefined
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20)
}
