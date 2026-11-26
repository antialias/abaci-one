/**
 * What the share link and the live observers show, read from the session
 * report (session architecture §4, Phase 4c). Pure and client-safe.
 *
 * Every count, progress figure and time comes from the report. The per-try
 * list joins the report's tries to the problems they asked (the slots, from
 * the kid's broadcast `sessionParts`) by the report's item identity, so a
 * do-over carries its item's number instead of the next one (P1 follow-up).
 */

import type { SessionPart } from '@/db/schema/session-plans'
import { firstTryRows, type SessionReport } from './session-report'

/** One try of the session as the observer lists it. */
export interface ObservedResult {
  tryId: string
  /** The report's item identity (arithmetic: the slot id) */
  itemId: string
  /** The item's place in the plan (1-indexed); a do-over keeps its item's number */
  problemNumber: number
  /** A do-over (retry round or redo) of the item, not its first try */
  isRetry: boolean
  /**
   * The try the item's first-try verdict comes from, by the totals' rule
   * (`firstTryRows`): first-try lists and per-purpose figures use only these
   */
  isFirstTry: boolean
  /** Practice-only (a do-over that never counts) */
  practiceOnly: boolean
  /** An adult excluded it: listed, never in an accuracy figure */
  excluded: boolean
  /** The problem's terms */
  terms: number[]
  /** Correct answer */
  answer: number
  /** The kid's submitted answer */
  studentAnswer: string
  isCorrect: boolean
  /** Purpose of the item's slot */
  purpose: 'focus' | 'reinforce' | 'review' | 'challenge'
  /** The try's effective response time (its share of active time) */
  responseTimeMs: number
  /** When recorded (epoch ms), when known */
  recordedAt: number | null
}

/**
 * The report's tries joined to the planned problems, in the order they were
 * recorded. Tries whose item is not in `parts` (no broadcast yet, or a kind
 * without slots) are left out: their content is unknown here. Counts never
 * come from this list; they come from `report.totals`.
 */
export function observedResultsFromReport(
  report: SessionReport | null | undefined,
  parts: readonly SessionPart[] | null | undefined
): ObservedResult[] {
  if (!report || !parts?.length) return []
  const items = new Map<
    string,
    { number: number; slot: NonNullable<SessionPart['slots']>[number] }
  >()
  let n = 0
  for (const part of parts) {
    for (const slot of Array.isArray(part?.slots) ? part.slots : []) {
      n++
      if (slot?.slotId) items.set(slot.slotId, { number: n, slot })
    }
  }
  const firsts = firstTryRows(report.tries)
  const out: ObservedResult[] = []
  for (const t of report.tries) {
    const item = items.get(t.itemId)
    const problem = item?.slot.problem
    if (!item || !problem) continue
    out.push({
      tryId: t.tryId,
      itemId: t.itemId,
      problemNumber: item.number,
      isRetry: !firsts.first.has(t.tryId),
      isFirstTry: firsts.verdict.has(t.tryId),
      practiceOnly: t.practiceOnly,
      excluded: t.excluded,
      terms: problem.terms,
      answer: problem.answer,
      studentAnswer: String(t.answer),
      isCorrect: t.isCorrect,
      purpose: item.slot.purpose ?? 'focus',
      responseTimeMs: t.effectiveMs ?? 0,
      recordedAt: t.recordedAt,
    })
  }
  return out
}

/** Items done of planned: the live position's, else (ended) attempted of planned. */
export function reportProgress(report: SessionReport): { done: number; total: number } {
  return (
    report.position?.progress ?? {
      done: report.totals.problems,
      total: report.totals.plannedProblems,
    }
  )
}

/** The problem the kid is on (1-indexed, at most the planned total), while live. */
export function reportCurrentProblemNumber(report: SessionReport): number | null {
  if (!report.position) return null
  const { done, total } = report.position.progress
  return total > 0 ? Math.min(done + 1, total) : null
}

export type ReportEnding = 'completed' | 'ended_early' | 'abandoned' | null

/** How the session ended, or null while it has not. */
export function reportEnding(report: SessionReport | null | undefined): ReportEnding {
  if (!report) return null
  if (report.outcome === 'abandoned') return 'abandoned'
  if (report.outcome === 'completed') return report.endedEarly ? 'ended_early' : 'completed'
  return null
}

/** A ratio as a whole percent; '—' when there is nothing to divide. */
export function formatPercent(ratio: number | null | undefined): string {
  return ratio == null ? '—' : `${Math.round(ratio * 100)}%`
}

/** Whole minutes of a duration. */
export function wholeMinutes(ms: number): number {
  return Math.round(ms / 60000)
}

/**
 * Minutes as every report view shows them: "< 1" under a minute (never "0"
 * beside a few active seconds), else whole minutes; `plural` picks the unit.
 */
export function formatMinutes(ms: number): { value: string; plural: boolean } {
  const minutes = ms / 60_000
  if (minutes < 1) return { value: '< 1', plural: false }
  const rounded = Math.round(minutes)
  return { value: String(rounded), plural: rounded !== 1 }
}

/** A short duration: "58s", "4m 10s", "12m". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`
}

/** The listed tries the totals count as wrong first tries (the review list). */
export function wrongFirstTries(results: readonly ObservedResult[]): ObservedResult[] {
  return results.filter((r) => r.isFirstTry && !r.isCorrect)
}

/** First tries that were wrong (fixed later or not). */
export function firstTriesWrong(report: SessionReport): number {
  return report.totals.problems - report.totals.firstTryCorrect
}

/** Mean effective time per try. */
export function averageTryMs(report: SessionReport): number {
  return report.totals.tries > 0 ? report.time.activeMs / report.totals.tries : 0
}
