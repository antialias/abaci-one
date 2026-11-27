/**
 * Phase 4c acceptance (session architecture §7): the live observer renders
 * every number from the shared session report fixture, and at the session's
 * end keeps the final report on screen (the ended view), not "Disconnected".
 */

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionEndedEvent } from '@/lib/classroom/socket-events'
import { observedResultsFromReport } from '@/lib/curriculum/observer-report'
import type { SessionReport } from '@/lib/curriculum/session-report'
import {
  abandonedSession,
  fixtureParts,
  reportOf,
  TEN_PROBLEM_EXPECTED,
  tenProblemSession,
  tenProblemSessionReport,
} from '@/test/fixtures/session-report'
import { LiveResultsPanel } from '../../practice/LiveResultsPanel'
import { LiveSessionReportInline } from '../../practice/LiveSessionReportModal'
import { MobileResultsSummary } from '../../practice/MobileResultsSummary'
import { SessionEndedSummary } from '../SessionEndedSummary'

// --- the observer's sources, controlled per test ---------------------------
const observer = vi.hoisted(() => ({
  state: null as unknown,
  ended: null as SessionEndedEvent | null,
  isConnected: false,
  isObserving: false,
}))
const reportQuery = vi.hoisted(() => ({
  data: undefined as SessionReport | undefined,
  source: null as unknown,
}))

vi.mock('@/hooks/useSessionObserver', () => ({
  useSessionObserver: () => ({
    state: observer.state,
    transitionState: null,
    flowState: 'completed',
    breakState: null,
    visionFrame: null,
    isConnected: observer.isConnected,
    isObserving: observer.isObserving,
    error: null,
    ended: observer.ended,
    stopObserving: vi.fn(),
    sendControl: vi.fn(),
    sendPause: vi.fn(),
    sendResume: vi.fn(),
    dvrBufferInfo: null,
    isLive: true,
    scrubTo: vi.fn(),
    goLive: vi.fn(),
    sendCoPlayReady: vi.fn(),
    sendCoPlayLeave: vi.fn(),
  }),
}))
vi.mock('@/hooks/useSessionReport', () => ({
  useSessionReport: (source: unknown) => {
    reportQuery.source = source
    return { data: reportQuery.data }
  },
}))
vi.mock('@/hooks/useObserverCoPlayProfile', () => ({
  useObserverCoPlayProfile: () => ({ profile: null }),
}))
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light', setTheme: vi.fn() }),
}))
vi.mock('@/contexts/MyAbacusContext', () => ({
  useMyAbacus: () => ({
    requestDock: vi.fn(),
    dock: null,
    setDockedValue: vi.fn(),
    isDockedByUser: false,
  }),
}))
vi.mock('@/components/common/ToastContext', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}))
vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
vi.mock('@/lib/queryClient', () => ({ api: vi.fn() }))
vi.mock('../../vision/ObserverVisionFeed', () => ({ ObserverVisionFeed: () => null }))
vi.mock('../../vision/ProblemVideoPlayer', () => ({ ProblemVideoPlayer: () => null }))
vi.mock('../../debug/ObserverDebugPanel', () => ({ ObserverDebugPanel: () => null }))
vi.mock('../SessionShareButton', () => ({ SessionShareButton: () => null }))
vi.mock('../GameBreakSpectatorView', () => ({ GameBreakSpectatorView: () => null }))
vi.mock('../ObserverOnboardingCard', () => ({ ObserverOnboardingCard: () => null }))
vi.mock('../../AbacusDock', () => ({ AbacusDock: () => null }))

import { SessionObserverView } from '../SessionObserverModal'

const E = TEN_PROBLEM_EXPECTED
const student = { name: 'Alice', emoji: '🐱', color: '#FF6B6B' }

/** The rendered text, one line per block, for text snapshots. */
function textOf(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function endedEvent(reason: SessionEndedEvent['reason']): SessionEndedEvent {
  return {
    sessionId: 'fx-ten-problems',
    playerId: 'fx-player',
    playerName: 'Alice',
    reason,
    rowVersion: 14,
  }
}

/** The ten-problem session mid-way: part 3, slot 2, the first ten tries. */
function liveReport(): SessionReport {
  const fx = tenProblemSession()
  return reportOf({
    ...fx,
    plan: {
      ...fx.plan,
      status: 'in_progress',
      flowState: 'practicing',
      completedAt: null,
      currentPartIndex: 2,
      partStates: { 2: { slotIndex: 1 } },
      results: fx.plan.results.slice(0, 10),
    },
  })
}

/**
 * The ten-problem session with an adult-excluded wrong first try (#3) and a
 * practice-only do-over of #1 (Phase 4c review: views use the totals' rule).
 */
function filteredReport(): SessionReport {
  const fx = tenProblemSession()
  const results = fx.plan.results.map((r, i) =>
    i === 2 ? { ...r, isCorrect: false, source: 'teacher-excluded' as const } : r
  )
  results.splice(12, 0, {
    ...results[0],
    tryId: '00000000-0000-4000-8000-000000000099',
    kind: 'do_over',
    practiceOnly: true,
    timestamp: new Date(results[11].timestamp.getTime() + 1000),
  })
  return reportOf({ ...fx, plan: { ...fx.plan, results } })
}

/** The ten-problem report as it would read had the kid ended it early. */
function endedEarlyReport(): SessionReport {
  return { ...tenProblemSessionReport(), endedEarly: true }
}

describe('SessionEndedSummary (the ended view) from the shared fixture', () => {
  it('shows the acceptance numbers', () => {
    const report = tenProblemSessionReport()
    const { container } = render(<SessionEndedSummary report={report} studentName="Alice" />)
    const stat = (key: string) => textOf(container.querySelector(`[data-stat="${key}"]`)!)
    expect(stat('problems')).toBe(`${E.problems}/${E.plannedProblems}Problems`)
    expect(stat('first-try')).toBe('70%First try (7/10)')
    expect(stat('fixed')).toBe('3Fixed in retries')
    expect(stat('final')).toBe('100%Final (10/10)')
    expect(stat('minutes')).toBe('12Minutes')
    expect(textOf(container)).toMatchSnapshot()
  })

  it('a session under a minute shows "< 1", not "0" (as the summary does)', () => {
    const full = tenProblemSessionReport()
    const report = { ...full, time: { ...full.time, wallMs: 4_000, activeMs: 4_000 } }
    const { container } = render(<SessionEndedSummary report={report} studentName="Alice" />)
    expect(textOf(container.querySelector('[data-stat="minutes"]')!)).toBe('< 1Minute')
  })
})

describe('SessionObserverView: the session ends', () => {
  beforeEach(() => {
    observer.state = null
    observer.ended = null
    observer.isConnected = false
    observer.isObserving = false
    reportQuery.data = undefined
  })

  const cases: Array<[string, SessionEndedEvent['reason'], () => SessionReport, string]> = [
    ['natural completion', 'completed', tenProblemSessionReport, 'Alice finished practicing!'],
    ['end early', 'ended_early', endedEarlyReport, 'Alice ended the session early'],
    [
      'abandon',
      'abandoned',
      () => reportOf(abandonedSession()),
      "Alice's session was left unfinished",
    ],
  ]

  it.each(cases)(
    '%s: the final report stays on screen, not "Disconnected"',
    (_, reason, build, title) => {
      observer.ended = endedEvent(reason)
      reportQuery.data = build()
      const { container } = render(
        <SessionObserverView
          session={{ sessionId: 'fx-ten-problems', playerId: 'fx-player' }}
          student={student}
          observerId="viewer-1"
          variant="page"
        />
      )
      expect(screen.getByText(title, { exact: false })).toBeTruthy()
      expect(container.querySelector('[data-component="session-ended-summary"]')).not.toBeNull()
      expect(screen.getByText('Session ended')).toBeTruthy()
      expect(screen.queryByText('Disconnected')).toBeNull()
      expect(screen.queryByText(/Waiting for student activity/)).toBeNull()
    }
  )

  it('the ended view shows the fixture totals (snapshot)', () => {
    observer.ended = endedEvent('completed')
    reportQuery.data = tenProblemSessionReport()
    const { container } = render(
      <SessionObserverView
        session={{ sessionId: 'fx-ten-problems', playerId: 'fx-player' }}
        student={student}
        observerId="viewer-1"
        variant="page"
      />
    )
    const summary = container.querySelector('[data-component="session-ended-summary"]')!
    expect(textOf(summary)).toContain('70%First try (7/10)')
    expect(textOf(summary)).toMatchSnapshot()
    // The header reads the report too
    expect(screen.getByText('Session complete')).toBeTruthy()
  })

  it('an already-ended session (no socket end) shows the ended view from the report', () => {
    reportQuery.data = tenProblemSessionReport()
    render(
      <SessionObserverView
        session={{ sessionId: 'fx-ten-problems', playerId: 'fx-player' }}
        student={student}
        observerId="viewer-1"
        variant="page"
      />
    )
    expect(screen.getByText('Alice finished practicing!', { exact: false })).toBeTruthy()
    expect(screen.queryByText('Disconnected')).toBeNull()
  })

  it('reads the report with the viewer credential, or the share token', () => {
    render(
      <SessionObserverView
        session={{ sessionId: 's-1', playerId: 'p-1' }}
        student={student}
        observerId="viewer-1"
        variant="page"
      />
    )
    expect(reportQuery.source).toEqual({ playerId: 'p-1', planId: 's-1', viewerId: 'viewer-1' })
    render(
      <SessionObserverView
        session={{ sessionId: 's-1', playerId: 'p-1' }}
        student={student}
        observerId=""
        shareToken="tok-1"
        isViewOnly
        variant="page"
      />
    )
    expect(reportQuery.source).toEqual({ token: 'tok-1' })
  })
})

describe('observer modal totals from the shared fixture', () => {
  const report = tenProblemSessionReport()
  const results = observedResultsFromReport(report, fixtureParts())

  it('joins tries to problems by item identity: a do-over keeps its number', () => {
    expect(results).toHaveLength(E.tries)
    // Part 1: slots 1..4, the wrong first try of #2 then its retry
    expect(results.map((r) => `${r.problemNumber}${r.isRetry ? 'r' : ''}`)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '2r',
      '5',
      '6',
      '7',
      '6r',
      '8',
      '9',
      '10',
      '8r',
    ])
  })

  it('LiveResultsPanel: progress, first try and wrong first tries from the report', () => {
    const { container } = render(
      <LiveResultsPanel report={report} results={results} isDark={false} />
    )
    const text = textOf(container)
    expect(text).toContain('10/10')
    expect(text).toContain('70%')
    expect(text).toMatchSnapshot()
  })

  it('MobileResultsSummary: the same numbers', () => {
    const { container } = render(
      <MobileResultsSummary report={report} isDark={false} onExpand={vi.fn()} />
    )
    expect(textOf(container)).toBe('10/1070%✗3Report →')
  })

  it('LiveSessionReportInline: first try, final, minutes, tries from the report', () => {
    const { container } = render(
      <LiveSessionReportInline report={report} results={results} isDark={false} onBack={vi.fn()} />
    )
    const stat = (el: string) => textOf(container.querySelector(`[data-element="${el}"]`)!)
    expect(stat('stat-accuracy')).toBe('70%First try')
    expect(stat('stat-problems')).toBe('10/10Final')
    expect(stat('stat-time')).toBe('12Minutes')
    expect(textOf(container)).toContain('Problems to Review (3)')
    expect(textOf(container)).toContain(`All Tries (${E.tries})`)
    expect(textOf(container)).toMatchSnapshot()
  })

  it('LiveSessionReportInline: a session under a minute shows "< 1" minutes', () => {
    const short = { ...report, time: { ...report.time, wallMs: 4_000, activeMs: 4_000 } }
    const { container } = render(
      <LiveSessionReportInline report={short} results={results} isDark={false} onBack={vi.fn()} />
    )
    expect(textOf(container.querySelector('[data-element="stat-time"]')!)).toBe('< 1Minute')
  })

  it('a live report shows live progress (position), not attempted/planned', () => {
    const live = liveReport()
    const { container } = render(
      <MobileResultsSummary report={live} isDark={false} onExpand={vi.fn()} />
    )
    // 8 items done of 10 planned (the position's); first try 5/8 (#2, #6, #8 wrong)
    expect(textOf(container)).toBe('8/1063%✗3Report →')
  })
})

describe("views use the report totals' rule (excluded and practice-only tries)", () => {
  const report = filteredReport()
  const results = observedResultsFromReport(report, fixtureParts())

  it('the fixture: 9 attempted, 6 right first time, 14 tries', () => {
    expect(report.totals).toMatchObject({ problems: 9, firstTryCorrect: 6, tries: 14 })
  })

  it('LiveResultsPanel: wrong-first-try rows match the count; per-purpose % agrees with the headline', () => {
    const { container } = render(
      <LiveResultsPanel report={report} results={results} isDark={false} />
    )
    // One purpose (focus): its first-try figure is the headline's
    expect(textOf(container.querySelector('[data-purpose="focus"]')!)).toBe('🎯 6/9')
    // The excluded wrong first try (#3) is not in the review list
    const listed = textOf(container.querySelector('[data-element="results-content"]')!)
    expect(listed).not.toContain('#3')
    expect(textOf(container)).toContain('Incorrect (3)')
  })

  it('LiveSessionReportInline: headings count the rows shown; practice-only and excluded are marked', () => {
    const { container } = render(
      <LiveSessionReportInline report={report} results={results} isDark={false} onBack={vi.fn()} />
    )
    const text = textOf(container)
    expect(text).toContain('Problems to Review (3)')
    expect(text).toContain(`All Tries (${results.length})`)
    expect(results).toHaveLength(14)
    expect(container.querySelectorAll('[data-element="practice-only-mark"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-element="excluded-mark"]')).toHaveLength(1)
    expect(text).toContain('#1 ↻ (practice)')
    expect(text).toContain('#3 (excluded)')
  })

  it('observedResultsFromReport: first-try flags follow the totals', () => {
    expect(results.filter((r) => r.isFirstTry)).toHaveLength(report.totals.problems)
    expect(results.find((r) => r.practiceOnly)).toMatchObject({
      problemNumber: 1,
      isRetry: true,
      isFirstTry: false,
    })
    expect(results.find((r) => r.excluded)).toMatchObject({
      problemNumber: 3,
      isRetry: false,
      isFirstTry: false,
    })
  })
})

describe('SessionObserverView: live, with a broadcast state', () => {
  beforeEach(() => {
    observer.ended = null
    observer.isConnected = true
    observer.isObserving = true
    reportQuery.data = liveReport()
    observer.state = {
      sessionId: 'fx-ten-problems',
      currentProblem: { terms: [31, 4], answer: 35 },
      phase: 'problem',
      studentAnswer: '',
      isCorrect: null,
      timing: { startedAt: 1, elapsed: 2000 },
      purpose: 'focus',
      currentProblemNumber: 9,
      totalProblems: 10,
      sessionParts: fixtureParts(),
      currentPartIndex: 2,
      currentSlotIndex: 1,
    }
  })

  it('header and results read the report; no ended view', () => {
    const { container } = render(
      <SessionObserverView
        session={{ sessionId: 'fx-ten-problems', playerId: 'fx-player' }}
        student={student}
        observerId="viewer-1"
        variant="page"
      />
    )
    expect(screen.getByText('Problem 9 of 10')).toBeTruthy()
    expect(container.querySelector('[data-component="session-ended-summary"]')).toBeNull()
    expect(screen.queryByText('Session ended')).toBeNull()
  })
})
