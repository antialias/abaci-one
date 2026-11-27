/**
 * Phase 4c acceptance (session architecture §7): the share link's ended page
 * and its OG card show the shared session report's numbers.
 */

import { render } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  abandonedSession,
  legacyTenProblemSession,
  reportOf,
  tenProblemSession,
  tenProblemSessionReport,
} from '@/test/fixtures/session-report'
import { ObserveOgCard, ogCardFromReport } from '../opengraph-card'

vi.mock('@/components/practice/SessionSongPlayer', () => ({ SessionSongPlayer: () => null }))
vi.mock('@/components/notifications/SubscribeButton', () => ({ SubscribeButton: () => null }))

import { SessionEndedClient } from '../SessionEndedClient'

function textOf(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function sharePage(report: ReturnType<typeof tenProblemSessionReport> | null) {
  return render(
    <SessionEndedClient
      studentName="Alice"
      studentEmoji="🐱"
      report={report}
      playerId="fx-player"
      sessionPlanId="fx-ten-problems"
      shareToken="tok-1"
    />
  )
}

/** The card's visible text: its markup with the tags dropped. */
function cardText(report: ReturnType<typeof tenProblemSessionReport> | null) {
  const html = renderToStaticMarkup(
    <ObserveOgCard
      studentName="Alice"
      studentEmoji="🐱"
      songTitle={null}
      sampleProblems={['10 + 3 = 13', '11 + 4 = 15']}
      {...ogCardFromReport(report)}
    />
  )
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('share page (ended) from the session report', () => {
  it('ten-problem fixture: the acceptance numbers', () => {
    const { container } = sharePage(tenProblemSessionReport())
    const stat = (key: string) => textOf(container.querySelector(`[data-stat="${key}"]`)!)
    expect(stat('problems')).toBe('10/10Problems')
    expect(stat('first-try')).toBe('70%First try (7/10)')
    expect(stat('fixed')).toBe('3Fixed in retries')
    expect(stat('final')).toBe('100%Final (10/10)')
    expect(stat('minutes')).toBe('12Minutes')
    expect(textOf(container)).toContain('Active 58s · Breaks 5m')
    expect(textOf(container)).toMatchSnapshot()
  })

  it('abandoned fixture: left unfinished, its own totals', () => {
    const report = reportOf(abandonedSession())
    const { container } = sharePage(report)
    expect(
      container
        .querySelector('[data-component="session-ended-summary"]')!
        .getAttribute('data-outcome')
    ).toBe('abandoned')
    expect(textOf(container)).toContain("Alice's session was left unfinished")
    expect(textOf(container)).toContain(
      `${report.totals.problems}/${report.totals.plannedProblems}`
    )
    expect(textOf(container)).toMatchSnapshot()
  })

  it('a pre-Phase-1 session still renders the same numbers', () => {
    const { container } = sharePage(reportOf(legacyTenProblemSession()))
    expect(textOf(container)).toContain('70%First try (7/10)')
  })

  it('not started: no numbers, the old copy', () => {
    const { container } = sharePage(null)
    expect(textOf(container)).toContain('Session Not Started')
    expect(container.querySelector('[data-component="session-ended-summary"]')).toBeNull()
  })
})

describe('OG card from the session report', () => {
  it('ten-problem fixture: the same numbers as the page (text snapshot)', () => {
    const text = cardText(tenProblemSessionReport())
    expect(text).toContain('Practice session complete')
    expect(text).toContain('70% first try')
    expect(text).toContain('10/10 problems')
    expect(text).toContain('3 fixed in retries')
    expect(text).toContain('12m')
    expect(text).not.toContain('streak')
    expect(text).toMatchSnapshot()
  })

  it('abandoned fixture', () => {
    expect(cardText(reportOf(abandonedSession()))).toContain('Session left unfinished')
  })

  it('a live session shows its live progress', () => {
    const live = reportOf({
      ...tenProblemSession(),
      plan: {
        ...tenProblemSession().plan,
        status: 'in_progress',
        flowState: 'practicing',
        completedAt: null,
        currentPartIndex: 2,
        partStates: { 2: { slotIndex: 1 } },
        results: tenProblemSession().plan.results.slice(0, 10),
      },
    })
    const { stats, status } = ogCardFromReport(live)
    expect(status).toBe('live')
    // 8 items done of 10 planned; first try 5/8; wall to the fixture's now (60 min)
    expect(stats).toEqual({ problems: '8/10', firstTryPct: 63, fixedInRetries: 2, minutes: 60 })
  })
})
