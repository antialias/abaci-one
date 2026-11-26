/**
 * The paused modal's progress reads the session report's `position.progress`
 * (session architecture §7 Phase 4b), not a count of the plan's `results`.
 */

import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionReport } from '@/lib/curriculum/session-report'
import {
  pausedTenProblemSession,
  pausedTenProblemSessionReport,
  tenProblemSession,
  tenProblemSessionReport,
} from '@/test/fixtures/session-report'
import { SessionPausedModal } from '../SessionPausedModal'

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light', setTheme: vi.fn() }),
}))

vi.mock('../../../../styled-system/css', () => ({
  css: vi.fn(() => 'mocked-css-class'),
}))

const hooks = vi.hoisted(() => ({
  report: undefined as SessionReport | undefined,
  useSessionReport: vi.fn(),
}))

vi.mock('@/hooks/useUserId', () => ({
  useUserId: () => ({ data: 'viewer-1' }),
}))

vi.mock('@/hooks/useSessionReport', () => ({
  useSessionReport: (...args: unknown[]) => {
    hooks.useSessionReport(...args)
    return { data: hooks.report }
  },
}))

const student = { name: 'Fern', emoji: '🦊', color: '#fff' }

function progressText(container: HTMLElement): string {
  const bar = container.querySelector('[data-element="progress-bar"]')!
  return Array.from(bar.parentElement?.children ?? [])
    .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' | ')
}

describe('SessionPausedModal progress from the session report', () => {
  beforeEach(() => {
    hooks.useSessionReport.mockClear()
  })

  it('shows position.progress of the paused ten-problem session', () => {
    const fixture = pausedTenProblemSession()
    hooks.report = pausedTenProblemSessionReport()
    const { container } = render(
      <SessionPausedModal
        isOpen
        student={student}
        session={fixture.plan}
        onResume={vi.fn()}
        onEndSession={vi.fn()}
      />
    )
    const text = progressText(container)
    expect(text).toMatchSnapshot()
    // 12 tries recorded (2 retries), 10 of 10 planned problems passed
    expect(fixture.plan.results).toHaveLength(12)
    expect(text).toContain('10 of 10 done!')
    const fill = container.querySelector('[data-element="progress-bar"] > div') as HTMLElement
    expect(fill.style.width).toBe('100%')
    expect(hooks.useSessionReport).toHaveBeenCalledWith(
      { playerId: 'fx-player', planId: 'fx-paused', viewerId: 'viewer-1' },
      { enabled: true }
    )
  })

  it('an ended report (the shared ten-problem fixture) has no position: no count', () => {
    hooks.report = tenProblemSessionReport()
    const { container } = render(
      <SessionPausedModal
        isOpen
        student={student}
        session={tenProblemSession().plan}
        onResume={vi.fn()}
        onEndSession={vi.fn()}
      />
    )
    expect(progressText(container)).not.toContain('done!')
  })

  it('a cached report older than the plan (an earlier pause) shows no count', () => {
    const fixture = pausedTenProblemSession()
    hooks.report = pausedTenProblemSessionReport()
    const props = { isOpen: true, student, onResume: vi.fn(), onEndSession: vi.fn() }
    // The plan moved on since the cached report was built
    const stale = render(
      <SessionPausedModal
        {...props}
        session={{ ...fixture.plan, rowVersion: hooks.report.rowVersion + 1 }}
      />
    )
    expect(progressText(stale.container)).not.toContain('done!')
    stale.unmount()
    // A report as new as the plan shows its count
    const fresh = render(<SessionPausedModal {...props} session={fixture.plan} />)
    expect(hooks.report.rowVersion).toBe(fixture.plan.rowVersion)
    expect(progressText(fresh.container)).toContain('10 of 10 done!')
  })

  it("ignores another session's report", () => {
    hooks.report = pausedTenProblemSessionReport()
    const { container } = render(
      <SessionPausedModal
        isOpen
        student={student}
        session={{ ...pausedTenProblemSession().plan, id: 'other' }}
        onResume={vi.fn()}
        onEndSession={vi.fn()}
      />
    )
    expect(progressText(container)).not.toContain('done!')
  })
})
