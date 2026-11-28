/**
 * The summary hero reads the session report (session architecture §7 Phase
 * 4b): rendered from the shared fixture, so it shows the numbers every other
 * view shows (10 problems, 13 tries, 70 % first try, 3 fixed, 100 % final,
 * a 5-minute break).
 */

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SlotResult } from '@/db/schema/session-plans'
import type { SessionReport } from '@/lib/curriculum/session-report'
import {
  abandonedSession,
  legacyTenProblemSession,
  offlineSession,
  offlineWorksheetSession,
  reportOf,
  tenProblemSession,
  tenProblemSessionReport,
} from '@/test/fixtures/session-report'
import { SessionHero } from '../SessionHero'

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light', setTheme: vi.fn() }),
}))

vi.mock('../../../../styled-system/css', () => ({
  css: vi.fn(() => 'mocked-css-class'),
}))

/** An element's text, its child elements' texts separated by one space. */
function textOf(el: Node): string {
  const parts: string[] = []
  let run = ''
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      run += child.textContent ?? ''
    } else {
      parts.push(run, textOf(child))
      run = ''
    }
  }
  parts.push(run)
  return parts
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
}

/** Each stat's text, by `data-element`, in document order. */
function statsOf(container: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {}
  for (const el of container.querySelectorAll(
    '[data-element^="stat-"], [data-element="session-outcome"], [data-element="practice-types"]'
  )) {
    out[el.getAttribute('data-element')!] = textOf(el)
  }
  return out
}

function renderHero(report: SessionReport, props: Partial<Parameters<typeof SessionHero>[0]> = {}) {
  return render(
    <SessionHero
      report={report}
      studentName="Fern"
      previousAccuracy={null}
      isDark={false}
      {...props}
    />
  )
}

describe('SessionHero from the session report', () => {
  it('shows the ten-problem acceptance numbers', () => {
    const { container } = renderHero(tenProblemSessionReport())
    const stats = statsOf(container)
    expect(stats).toMatchSnapshot()
    expect(stats['stat-first-try']).toBe('70% First try')
    expect(stats['stat-problems']).toBe('10 Problems · 13 tries')
    expect(stats['stat-fixed']).toBe('3 fixed in retries')
    expect(stats['stat-final']).toBe('100% right by the end')
    expect(stats['stat-break']).toBe('5 minutes break')
    expect(stats['stat-wall']).toBe('12 minutes total')
    // Active time is Σ effective response time (58 s), not wall time
    expect(stats['stat-time']).toBe('< 1 Active minute')
    // A completed session that planned 10 and did 10: no outcome, no "of planned"
    expect(stats['session-outcome']).toBeUndefined()
    expect(stats['stat-planned']).toBeUndefined()
  })

  it('a pre-Phase-1 session shows the same numbers', () => {
    const legacy = statsOf(renderHero(reportOf(legacyTenProblemSession())).container)
    const current = statsOf(renderHero(tenProblemSessionReport()).container)
    expect(legacy).toEqual(current)
  })

  it('an abandoned session shows its real outcome and wall time to the last activity', () => {
    const report = reportOf(abandonedSession())
    const { container } = renderHero(report)
    const stats = statsOf(container)
    expect(stats).toMatchSnapshot()
    expect(stats['session-outcome']).toBe('Not finished')
    expect(stats['stat-planned']).toBe('7 of 10 planned')
    expect(stats['stat-problems']).toBe('7 Problems · 9 tries')
    // Last try at 10 min; auto-abandoned three days later does not count
    expect(stats['stat-wall']).toBe('10 minutes total')
    expect(stats['stat-break']).toBe('5 minutes break')
  })

  it('an ended-early session says so', () => {
    const report = { ...tenProblemSessionReport(), endedEarly: true }
    expect(statsOf(renderHero(report).container)['session-outcome']).toBe('Ended early')
  })

  it('an offline session renders', () => {
    const stats = statsOf(renderHero(reportOf(offlineSession())).container)
    expect(stats['stat-problems']).toBe('0 Problems · 0 tries')
    expect(stats['stat-final']).toBeUndefined()
  })

  it('a completed session with an excluded item does not read "of planned"', () => {
    const fixture = tenProblemSession()
    const results = fixture.plan.results.map(
      (r, i): SlotResult => (i === 0 ? { ...r, source: 'teacher-excluded' } : r)
    )
    const report = reportOf({ ...fixture, plan: { ...fixture.plan, results } })
    expect(report.totals).toMatchObject({ problems: 9, plannedProblems: 10 })
    const stats = statsOf(renderHero(report).container)
    expect(stats['stat-planned']).toBeUndefined()
    expect(stats['stat-problems']).toBe('9 Problems · 13 tries')
  })

  it('an offline worksheet session with problems shows no time stats', () => {
    const report = reportOf(offlineWorksheetSession())
    const stats = statsOf(renderHero(report).container)
    expect(stats['stat-first-try']).toBe('70% First try')
    expect(stats['stat-problems']).toBe('10 Problems · 10 tries')
    expect(stats['stat-time']).toBeUndefined()
    expect(stats['stat-wall']).toBeUndefined()
  })

  it('no counted problem (all tries excluded) shows "—" for first try', () => {
    const fixture = tenProblemSession()
    const results = fixture.plan.results.map(
      (r): SlotResult => ({ ...r, source: 'teacher-excluded' })
    )
    const report = reportOf({ ...fixture, plan: { ...fixture.plan, results } })
    expect(report.totals.problems).toBe(0)
    expect(statsOf(renderHero(report).container)['stat-first-try']).toBe('— First try')
  })

  it('compares first-try accuracy with the previous session', () => {
    const { container } = renderHero(tenProblemSessionReport(), { previousAccuracy: 0.6 })
    expect(container.querySelector('[data-element="trend-row"]')).not.toBeNull()
  })

  // Practice-kinds K3 (R3): a part row carries `presentation` beside `type`.
  // The open bundles' hero reads `type`; it shows the same chips whatever the
  // new field says, and a report from before K3 (no field) reads the same.
  it('the practice-type chips read `type`, never the K3 `presentation` beside it', () => {
    const report = tenProblemSessionReport()
    const chips = statsOf(renderHero(report).container)['practice-types']
    const strange: SessionReport = {
      ...report,
      parts: report.parts.map((p) => ({ ...p, presentation: 'flash_anzan' })),
    }
    const preK3 = {
      ...report,
      parts: report.parts.map(({ presentation: _p, ...rest }) => rest),
    } as unknown as SessionReport
    expect(chips).toContain('Use Abacus')
    expect(statsOf(renderHero(strange).container)['practice-types']).toBe(chips)
    expect(statsOf(renderHero(preK3).container)['practice-types']).toBe(chips)
  })
})
