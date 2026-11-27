/**
 * "N of M problems need attention" (Phase 4b): N counts only problems the
 * session report counts, so N ⊆ M = `totals.problems`.
 */

import { describe, expect, it } from 'vitest'
import type { SlotResult } from '@/db/schema/session-plans'
import { reportOf, tenProblemSession } from '@/test/fixtures/session-report'
import {
  filterProblemsNeedingAttention,
  getProblemsWithContext,
  reportedProblems,
} from '../sessionSummaryUtils'

describe('reportedProblems', () => {
  it('drops an excluded item that would need attention', () => {
    const fixture = tenProblemSession()
    // Part 3 slot 0: its wrong first try excluded by an adult, no retry
    const results = fixture.plan.results
      .slice(0, 12)
      .map((r, i): SlotResult => (i === 9 ? { ...r, source: 'teacher-excluded' } : r))
    const plan = { ...fixture.plan, results }
    const report = reportOf({ ...fixture, plan })
    expect(report.totals.problems).toBe(9)

    const all = filterProblemsNeedingAttention(getProblemsWithContext(plan), Infinity)
    expect(all.map((p) => p.slot.slotId)).toEqual(['fx-p2s0'])

    const counted = filterProblemsNeedingAttention(
      reportedProblems(getProblemsWithContext(plan), results),
      Infinity
    )
    expect(counted).toEqual([])
    expect(reportedProblems(getProblemsWithContext(plan), results)).toHaveLength(
      report.totals.problems
    )
  })

  it('keeps every problem of the ten-problem session', () => {
    const { plan } = tenProblemSession()
    expect(reportedProblems(getProblemsWithContext(plan), plan.results)).toHaveLength(10)
  })
})
