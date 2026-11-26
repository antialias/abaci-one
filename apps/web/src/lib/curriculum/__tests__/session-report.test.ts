/**
 * The session report builder (session architecture §4, §7 Phase 4a), pure,
 * over the shared fixture (`src/test/fixtures/session-report.ts`).
 */

import { describe, expect, it, vi } from 'vitest'
import type { SlotResult } from '@/db/schema/session-plans'
import { readTriesSync } from '@/lib/curriculum/read-tries'
import { buildSessionReport } from '@/lib/curriculum/session-report'
import {
  abandonedSession,
  fixtureBreakGameResult,
  legacyTenProblemSession,
  offlineSession,
  reportOf,
  type SessionReportFixture,
  sentinelSession,
  T0,
  TEN_PROBLEM_EXPECTED,
  tenProblemSession,
  tenProblemSessionReport,
} from '@/test/fixtures/session-report'

vi.mock('@/db', () => ({ db: {}, schema: {} }))

const { computeReviewedResult } = await import('@/lib/curriculum/session-review')

function withResults(
  fixture: SessionReportFixture,
  edit: (results: SlotResult[]) => SlotResult[]
): SessionReportFixture {
  return { ...fixture, plan: { ...fixture.plan, results: edit([...fixture.plan.results]) } }
}

describe('buildSessionReport: the findings session (10 problems, 3 wrong fixed, 5-min break)', () => {
  const report = tenProblemSessionReport()

  it('counts the acceptance numbers', () => {
    const e = TEN_PROBLEM_EXPECTED
    expect(report.totals).toEqual({
      plannedProblems: e.plannedProblems,
      problems: e.problems,
      tries: e.tries,
      firstTryCorrect: e.firstTryCorrect,
      firstTryAccuracy: e.firstTryAccuracy,
      fixedInRetries: e.fixedInRetries,
      unresolved: e.unresolved,
      finalCorrect: e.finalCorrect,
      finalAccuracy: e.finalAccuracy,
    })
  })

  it('times: active = Σ effective response time, wall = end − start, one 5-minute break', () => {
    const { plan } = tenProblemSession()
    const sumEffective = plan.results.reduce((s, r) => s + r.responseTimeMs, 0)
    expect(report.time.activeMs).toBe(sumEffective)
    expect(report.time.activeMs).toBe(TEN_PROBLEM_EXPECTED.activeMs)
    expect(report.time.wallMs).toBe(plan.completedAt!.getTime() - plan.startedAt!.getTime())
    expect(report.time.wallMs).toBe(TEN_PROBLEM_EXPECTED.wallMs)
    expect(report.time.breakMs).toBe(5 * 60_000)
    expect(report.time.estimated).toBe(true)
    expect(report.breaks).toHaveLength(1)
    expect(report.breaks[0]).toMatchObject({
      game: 'memory-quiz',
      durationMs: 300_000,
      afterPartIndex: 0,
      open: false,
      startedAt: T0 + 180_000,
      endedAt: T0 + 480_000,
    })
  })

  it('carries outcome, rows per part, the song and no live position', () => {
    expect(report).toMatchObject({
      rowVersion: 14,
      sessionId: 'fx-ten-problems',
      outcome: 'completed',
      endedEarly: false,
      startedAt: T0,
      endedAt: T0 + 720_000,
      position: null,
      song: { status: 'ready', songId: 'fx-song', shareCode: 'fxShare001' },
    })
    expect(
      report.parts.map((p) => [p.problems, p.tries, p.firstTryCorrect, p.fixedInRetries])
    ).toEqual([
      [4, 5, 3, 1],
      [3, 4, 2, 1],
      [3, 4, 2, 1],
    ])
    expect(report.tries).toHaveLength(13)
  })

  it('a duplicated game result (double POST) is still one break', () => {
    const fixture = tenProblemSession()
    const dup = { ...fixtureBreakGameResult(fixture.plan.id), id: 'dup' }
    const r = reportOf({ ...fixture, gameResults: [...fixture.gameResults, dup] })
    expect(r.breaks).toHaveLength(1)
    expect(r.time.breakMs).toBe(300_000)
  })

  it('pre-Phase-1 rows (no tryId/kind/round) give the same numbers through normalizeTry', () => {
    const legacy = reportOf(legacyTenProblemSession())
    expect(legacy.totals).toEqual(report.totals)
    expect(legacy.time.activeMs).toBe(report.time.activeMs)
    expect(legacy.tries[0].tryId).toBe('legacy:fx-legacy:0')
  })
})

describe('buildSessionReport: definitions', () => {
  it('abandoned: outcome abandoned, wall to the last activity (not the late completedAt)', () => {
    const report = reportOf(abandonedSession())
    expect(report.outcome).toBe('abandoned')
    expect(report.time.wallMs).toBe(600_000)
    // endedAt is the same last-activity instant wall time ends at
    expect(report.endedAt! - report.startedAt!).toBe(report.time.wallMs)
    expect(report.endedAt).not.toBe(abandonedSession().plan.completedAt!.getTime())
    expect(report.totals.problems).toBe(7)
    expect(report.totals.plannedProblems).toBe(10)
  })

  it('legacy in_progress row with completedAt reads as abandoned', () => {
    const fixture = abandonedSession()
    const report = reportOf({ ...fixture, plan: { ...fixture.plan, status: 'in_progress' } })
    expect(report.outcome).toBe('abandoned')
  })

  it('an excluded first try drops the item from every denominator but stays in tries', () => {
    const report = reportOf(
      withResults(tenProblemSession(), (results) => {
        // part 1 slot 1: first try wrong, fixed in its retry; exclude the first try
        results[1] = { ...results[1], source: 'teacher-excluded' }
        return results
      })
    )
    expect(report.totals).toMatchObject({
      problems: 9,
      tries: 13,
      firstTryCorrect: 7,
      fixedInRetries: 2,
      finalCorrect: 9,
    })
    expect(report.totals.firstTryAccuracy).toBeCloseTo(7 / 9)
    expect(report.tries[1].excluded).toBe(true)
  })

  it('mark_correct flips firstTryCorrect (the review corrects the record)', () => {
    const fixture = tenProblemSession()
    const tries = readTriesSync(fixture.plan)
    const report = reportOf(
      withResults(fixture, (results) => {
        const t = tries[1]
        results[1] = computeReviewedResult(
          results[1],
          { action: 'mark_correct' },
          'reviewer',
          new Date(T0),
          { kind: t.kind, round: t.round, practiceOnly: t.practiceOnly }
        )
        return results
      })
    )
    expect(report.totals.firstTryCorrect).toBe(8)
    expect(report.totals.fixedInRetries).toBe(2)
    expect(report.totals.firstTryAccuracy).toBe(0.8)
  })

  it('voided tries count nowhere, not even in tries', () => {
    const report = reportOf(
      withResults(tenProblemSession(), (results) =>
        results.map((r, i) => (i >= 9 ? { ...r, voided: true } : r))
      )
    )
    expect(report.totals).toMatchObject({ tries: 9, problems: 7, finalCorrect: 7 })
    expect(report.tries).toHaveLength(9)
  })

  it('a practice-only do-over is a try but never moves a verdict (isCountedTry)', () => {
    const fixture = tenProblemSession()
    const first = fixture.plan.results[0]
    const report = reportOf(
      withResults(fixture, (results) => [
        ...results,
        {
          ...first,
          tryId: '00000000-0000-4000-8000-000000000099',
          kind: 'do_over',
          round: 1,
          practiceOnly: true,
          isCorrect: false,
          studentAnswer: first.problem.answer + 5,
          masteryWeight: 0,
          timestamp: new Date(T0 + 700_000),
        },
      ])
    )
    expect(report.totals).toMatchObject({ tries: 14, finalCorrect: 10, unresolved: 0 })
  })

  it('a wrong-item do-over that is counted (latest try wrong) fixes the item', () => {
    const fixture = tenProblemSession()
    // Drop part 3's retry, then fix s0 by a counted do-over instead
    const results = fixture.plan.results.slice(0, 12)
    const wrong = results[9]
    const report = reportOf(
      withResults(fixture, () => [
        ...results,
        {
          ...wrong,
          tryId: '00000000-0000-4000-8000-000000000098',
          kind: 'do_over',
          round: 1,
          practiceOnly: false,
          isCorrect: true,
          studentAnswer: wrong.problem.answer,
          timestamp: new Date(T0 + 715_000),
        },
      ])
    )
    expect(report.totals).toMatchObject({ tries: 13, fixedInRetries: 3, finalCorrect: 10 })
  })

  it('in progress: wall to now, an open break counts live only, position from the kind', () => {
    const fixture = tenProblemSession()
    const results = fixture.plan.results.slice(0, 5) // part 1 done
    const report = buildSessionReport({
      plan: {
        ...fixture.plan,
        results,
        status: 'in_progress',
        completedAt: null,
        flowState: 'break_active',
        currentPartIndex: 1,
        currentSlotIndex: 0,
        breakStartedAt: new Date(T0 + 180_000),
        breakSelectedGame: 'memory-quiz',
      },
      tries: readTriesSync({ ...fixture.plan, results }),
      gameResults: [],
      song: null,
      now: T0 + 300_000,
    })
    expect(report.outcome).toBe('in_progress')
    expect(report.endedAt).toBeNull()
    expect(report.time.wallMs).toBe(300_000)
    expect(report.time.breakMs).toBe(0)
    expect(report.breaks).toEqual([expect.objectContaining({ open: true, afterPartIndex: 0 })])
    expect(report.position).toMatchObject({
      flowState: 'break_active',
      segment: { kind: 'break', breakIndex: 0, afterPartIndex: 0 },
      progress: { done: 4, total: 10 },
    })
    expect(report.song).toEqual({ status: 'none' })
  })

  it('a second break while practicing names the current item', () => {
    const fixture = tenProblemSession()
    const results = fixture.plan.results.slice(0, 6)
    const plan = {
      ...fixture.plan,
      results,
      status: 'in_progress' as const,
      completedAt: null,
      flowState: 'practicing' as const,
      currentPartIndex: 1,
      currentSlotIndex: 1,
    }
    const report = buildSessionReport({
      plan,
      tries: readTriesSync(plan),
      gameResults: fixture.gameResults,
      now: T0 + 520_000,
    })
    expect(report.position?.currentItem).toEqual({ partIndex: 1, itemId: 'fx-p1s1' })
    expect(report.position?.progress).toEqual({ done: 5, total: 10 })
    expect(report.time.breakMs).toBe(300_000)
  })

  it('offline and sentinel sessions build', () => {
    const offline = reportOf(offlineSession())
    expect(offline).toMatchObject({ outcome: 'completed', tries: [], position: null })
    expect(offline.totals).toMatchObject({ plannedProblems: 0, problems: 0, tries: 0 })
    expect(offline.totals.firstTryAccuracy).toBeNull()
    expect(offline.time.wallMs).toBe(0)

    const sentinel = reportOf(sentinelSession())
    expect(sentinel.outcome).toBe('sentinel')
    expect(sentinel.totals.tries).toBe(0)
    expect(sentinel.parts).toEqual([])
  })

  it('ended early is completed + endedEarly', () => {
    const fixture = tenProblemSession()
    const report = reportOf({
      ...fixture,
      plan: {
        ...fixture.plan,
        adjustments: [
          {
            timestamp: new Date(T0 + 720_000),
            type: 'ended_early',
            previousHealth: {
              overall: 'good',
              accuracy: 1,
              pacePercent: 100,
              currentStreak: 0,
              avgResponseTimeMs: 0,
            },
          },
        ],
      },
    })
    expect(report).toMatchObject({ outcome: 'completed', endedEarly: true })
  })
})
