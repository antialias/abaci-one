/**
 * Phase 5c (session architecture §7): the result grids read the session
 * report. Every number a grid shows (the problems planned, a part's count,
 * how many cells are right, wrong, not counted, not answered, an item's
 * attempt history) is pinned against the report built from the same
 * fixture, so a grid cannot drift from the totals every other view shows.
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  type ArithmeticItemStatus,
  arithmeticItemCells,
} from '@/lib/curriculum/parts/arithmetic/result-view'
import type { SessionReport } from '@/lib/curriculum/session-report'
import {
  abandonedSession,
  doOverSession,
  GRID_EXPECTED,
  gridSession,
  legacyTenProblemSession,
  liveTenProblemSession,
  mismatchedSlotIdSession,
  missingSlotIdSession,
  offlineSession,
  reportOf,
  type SessionReportFixture,
  sentinelSession,
  slotIdlessPlanSession,
  TEN_PROBLEM_EXPECTED,
  tenProblemSession,
} from '@/test/fixtures/session-report'
import { AllProblemsSection } from '../AllProblemsSection'
import { attemptHistoryOf, browseCells } from '../BrowseModeView'
import { SessionPlanOverview } from '../SessionPlanOverview'

function statusCounts(fixture: SessionReportFixture, report: SessionReport) {
  const counts: Record<ArithmeticItemStatus, number> = {
    correct: 0,
    incorrect: 0,
    'not-counted': 0,
    'practice-only': 0,
    unanswered: 0,
  }
  for (const cell of arithmeticItemCells(fixture.plan, report).flat()) counts[cell.status]++
  return counts
}

/** The cells' statuses agree with the report's totals, whatever the fixture. */
function expectCellsMatchTotals(fixture: SessionReportFixture) {
  const report = reportOf(fixture)
  const counts = statusCounts(fixture, report)
  const { totals } = report
  expect(counts.correct).toBe(totals.finalCorrect)
  expect(counts.incorrect).toBe(totals.unresolved)
  expect(counts.correct + counts.incorrect).toBe(totals.problems)
  expect(
    counts.correct +
      counts.incorrect +
      counts['not-counted'] +
      counts['practice-only'] +
      counts.unanswered
  ).toBe(totals.plannedProblems)
  // Every try the report lists sits in exactly one cell
  const tries = arithmeticItemCells(fixture.plan, report)
    .flat()
    .reduce((sum, cell) => sum + cell.tries.length, 0)
  expect(tries).toBe(totals.tries)
  return counts
}

describe('arithmetic result cells: the report decides every verdict', () => {
  it('the grid fixture: right, wrong, not counted, not answered', () => {
    const fixture = gridSession()
    const report = reportOf(fixture)
    expect(report.totals).toMatchObject({
      plannedProblems: GRID_EXPECTED.plannedProblems,
      problems: GRID_EXPECTED.problems,
      tries: GRID_EXPECTED.tries,
      firstTryCorrect: GRID_EXPECTED.firstTryCorrect,
      fixedInRetries: GRID_EXPECTED.fixedInRetries,
      unresolved: GRID_EXPECTED.unresolved,
      finalCorrect: GRID_EXPECTED.finalCorrect,
    })
    expect(expectCellsMatchTotals(fixture)).toEqual(GRID_EXPECTED.cells)
  })

  it.each([
    ['ten problems', tenProblemSession],
    ['pre-Phase-1 rows', legacyTenProblemSession],
    ['live', liveTenProblemSession],
    ['abandoned', abandonedSession],
    ['a practice-only do-over', doOverSession],
    ['stale slot ids on the tries', mismatchedSlotIdSession],
    ['no slot ids on the tries', missingSlotIdSession],
    ['no slot ids on the slots', slotIdlessPlanSession],
  ])('%s: the cells add up to the totals', (_name, make) => {
    expectCellsMatchTotals(make())
  })

  it('an excluded retry is not the verdict: the item stays wrong', () => {
    const fixture = gridSession()
    const cell = arithmeticItemCells(fixture.plan, reportOf(fixture))[0][1]
    expect(cell.tries.map((t) => [t.row.isCorrect, t.row.excluded])).toEqual([
      [false, false],
      [true, true],
    ])
    expect(cell.status).toBe('incorrect')
    expect(cell.verdict?.row.isCorrect).toBe(false)
  })

  it('every try is joined to its stored row, pre-Phase-1 rows without a tryId too', () => {
    for (const fixture of [legacyTenProblemSession(), tenProblemSession(), doOverSession()]) {
      const cells = arithmeticItemCells(fixture.plan, reportOf(fixture)).flat()
      for (const cell of cells) {
        for (const t of cell.tries) {
          expect(t.resultIndex).toBeGreaterThanOrEqual(0)
          expect(t.result).toBe(fixture.plan.results[t.resultIndex])
        }
        expect(attemptHistoryOf(cell)).toHaveLength(cell.tries.length)
      }
      expect(cells.every((c) => c.shown !== null)).toBe(true)
    }
  })

  it('an item whose only tries are practice-only says so (its counted try was voided)', () => {
    const fixture = tenProblemSession()
    const report = reportOf(fixture)
    const last = report.tries.find((t) => t.itemId === 'fx-p2s2')!
    const tries = [
      ...report.tries.filter((t) => t.itemId !== 'fx-p2s2'),
      // Its first try voided (voided rows are never listed); a practice-only do-over remains
      { ...last, kind: 'do_over' as const, round: 1, practiceOnly: true },
    ]
    const cell = arithmeticItemCells(fixture.plan, { tries })[2][2]
    expect(cell.status).toBe('practice-only')
    expect(cell.firstTry).toBeNull()
    expect(cell.shown).not.toBeNull()
  })

  it('a practice-only do-over is a try of its item but not its verdict', () => {
    const fixture = doOverSession()
    const report = reportOf(fixture)
    const first = arithmeticItemCells(fixture.plan, report)[0][0]
    expect(first.tries.map((t) => t.row.practiceOnly)).toEqual([false, true])
    expect(first.verdict?.row.practiceOnly).toBe(false)
  })

  it('without a report every cell is unanswered: nothing is recounted from results', () => {
    const fixture = tenProblemSession()
    const cells = arithmeticItemCells(fixture.plan, null).flat()
    expect(cells).toHaveLength(10)
    expect(cells.every((c) => c.status === 'unanswered' && c.shown === null)).toBe(true)
  })

  it('old sessions without slots have no cells: offline, sentinel', () => {
    for (const fixture of [offlineSession(), sentinelSession()]) {
      expect(arithmeticItemCells(fixture.plan, reportOf(fixture)).flat()).toEqual([])
    }
  })
})

describe('AllProblemsSection: counts and marks from the report', () => {
  function renderGrid(fixture: SessionReportFixture) {
    const report = reportOf(fixture)
    const view = render(<AllProblemsSection plan={fixture.plan} report={report} isDark={false} />)
    fireEvent.click(screen.getByText(/All Session Problems/))
    return { report, view }
  }

  it('the header and each part show the report planned problems', () => {
    const { report } = renderGrid(gridSession())
    expect(
      screen.getByText(`📝 All Session Problems (${report.totals.plannedProblems})`)
    ).toBeTruthy()
    report.parts.forEach((part, i) => {
      const section = document.querySelector(`[data-section="part-${i + 1}"]`) as HTMLElement
      expect(within(section).getByText(`(${part.plannedProblems} problems)`)).toBeTruthy()
    })
  })

  it("the cells' marks are the report's verdicts", () => {
    const { report } = renderGrid(gridSession())
    const items = [...document.querySelectorAll('[data-element="compact-problem-item"]')]
    const marked = (mark: string) =>
      items.filter((el) => el.textContent?.trimStart().includes(mark)).length
    expect(items).toHaveLength(report.totals.plannedProblems)
    expect(marked('✓')).toBe(report.totals.finalCorrect)
    expect(marked('❌')).toBe(report.totals.unresolved)
    expect(marked('⊘')).toBe(GRID_EXPECTED.cells['not-counted'])
    expect(marked('↻')).toBe(GRID_EXPECTED.cells['practice-only'])
    expect(marked('○')).toBe(GRID_EXPECTED.cells.unanswered)
    expect(items.map((el) => el.getAttribute('data-problem-number')).map(Number)).toEqual(
      Array.from({ length: 10 }, (_, i) => i + 1)
    )
  })

  it("an excluded item's detail is neutral: no red or green, no verdict", () => {
    renderGrid(gridSession())
    const excluded = document.querySelector('[data-status="not-counted"]') as HTMLElement
    fireEvent.click(excluded)
    const overlay = document.querySelector(
      '[data-component="problem-detail-overlay"]'
    ) as HTMLElement
    expect(overlay).toBeTruthy()
    expect(within(overlay).getByText('Excluded by an adult: does not count')).toBeTruthy()
    expect(overlay.textContent).not.toContain('Student answered')
    expect(overlay.innerHTML).not.toMatch(/(green|red)\.(50|300|700)/)

    // A counted wrong item keeps its red detail
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(document.querySelector('[data-status="incorrect"]') as HTMLElement)
    const wrong = document.querySelector('[data-component="problem-detail-overlay"]') as HTMLElement
    expect(wrong.textContent).toContain('Student answered')
    expect(wrong.innerHTML).toMatch(/red\.(50|700)/)
  })

  it('the ten-problem session: every cell right after its retries', () => {
    renderGrid(tenProblemSession())
    const items = [...document.querySelectorAll('[data-element="compact-problem-item"]')]
    expect(items.filter((el) => el.getAttribute('data-status') === 'correct')).toHaveLength(
      TEN_PROBLEM_EXPECTED.finalCorrect
    )
  })

  it('old sessions render: legacy, sentinel, offline, abandoned', () => {
    for (const fixture of [
      legacyTenProblemSession(),
      sentinelSession(),
      offlineSession(),
      abandonedSession(),
    ]) {
      const { report, view } = renderGrid(fixture)
      expect(
        screen.getByText(`📝 All Session Problems (${report.totals.plannedProblems})`)
      ).toBeTruthy()
      view.unmount()
    }
  })

  it('a plan not started (no report) shows its problems without verdicts', () => {
    const fixture = tenProblemSession()
    render(<AllProblemsSection plan={fixture.plan} isDark={false} />)
    fireEvent.click(screen.getByText(/All Session Problems/))
    expect(screen.getByText('📝 All Session Problems (10)')).toBeTruthy()
    const items = [...document.querySelectorAll('[data-element="compact-problem-item"]')]
    expect(items.every((el) => el.getAttribute('data-status') === 'unanswered')).toBe(true)
  })
})

describe('SessionPlanOverview: counts and the current part from the report', () => {
  it('the total and each part are the report planned problems; current = position', () => {
    const fixture = liveTenProblemSession()
    const report = reportOf(fixture)
    render(
      <SessionPlanOverview
        parts={fixture.plan.parts}
        report={report}
        currentPartIndex={0}
        isDark={false}
      />
    )
    expect(
      screen.getByText(new RegExp(`— ${report.totals.plannedProblems} problems$`))
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button'))
    const rows = [...document.querySelectorAll('[data-element="part-row"]')] as HTMLElement[]
    expect(rows).toHaveLength(report.parts.length)
    rows.forEach((row, i) => {
      expect(row.textContent).toContain(`${report.parts[i].plannedProblems} problems,`)
    })
    // The report's position (part 3), not the stale prop
    expect(report.position?.segment).toMatchObject({ kind: 'part', partIndex: 2 })
    expect(rows.map((r) => r.hasAttribute('data-current'))).toEqual([false, false, true])
  })
})

describe('BrowseModeView: an item and its attempts from the report', () => {
  it("browse index = the dots' order; history = the report's tries of the item", () => {
    const fixture = gridSession()
    const report = reportOf(fixture)
    const cells = browseCells(fixture.plan, report)
    expect(cells.map((c) => c.number)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1))
    for (const cell of cells) {
      const history = attemptHistoryOf(cell)
      expect(history.map((h) => h.result)).toEqual(
        history.map((h) => fixture.plan.results[h.globalIndex])
      )
      expect(history).toHaveLength(report.tries.filter((t) => t.itemId === cell.itemId).length)
    }
    // Part 2, slot 1: a wrong first try and a wrong retry, unresolved
    expect(attemptHistoryOf(cells[5]).map((h) => h.result.isCorrect)).toEqual([false, false])
    expect(cells[5].status).toBe('incorrect')
  })
})
