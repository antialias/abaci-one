/**
 * The song's smart trigger reads where the kid is from the session report's
 * `position` (Phase 5b): last part, practicing, at least 60% of the planned
 * items done, at most 180 s left.
 */
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionReport } from '@/lib/curriculum/session-report'
import { useSessionSongTrigger } from '../useSessionSongTrigger'

const fetchMock = vi.fn(() => Promise.resolve(new Response('{}')))

function report(over: {
  outcome?: SessionReport['outcome']
  position?: Partial<NonNullable<SessionReport['position']>> | null
  parts?: number
  sessionId?: string
}): SessionReport {
  const position =
    over.position === null
      ? null
      : {
          segment: { kind: 'part' as const, partIndex: 1 },
          flowState: 'practicing' as const,
          progress: { done: 8, total: 10 },
          ...over.position,
        }
  return {
    sessionId: over.sessionId ?? 'plan-1',
    outcome: over.outcome ?? 'in_progress',
    parts: Array.from({ length: over.parts ?? 2 }, (_, partIndex) => ({ partIndex })),
    position,
  } as unknown as SessionReport
}

function run(r: SessionReport | undefined, avgSecondsPerProblem: number | null = 20) {
  return renderHook(
    ({ rep }) =>
      useSessionSongTrigger({
        studentId: 'kid-1',
        planId: 'plan-1',
        report: rep,
        avgSecondsPerProblem,
        songEnabled: true,
      }),
    { initialProps: { rep: r } }
  )
}

describe('useSessionSongTrigger', () => {
  beforeEach(() => {
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('fires once in the last part with enough done and little left', () => {
    const { rerender } = run(report({}))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/curriculum/kid-1/sessions/plans/plan-1/song',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ triggerSource: 'smart_trigger' }),
      })
    )
    rerender({ rep: report({ position: { progress: { done: 9, total: 10 } } }) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('waits for the report', () => {
    run(undefined)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('waits for the last part', () => {
    run(report({ position: { segment: { kind: 'part', partIndex: 0 } } }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not fire during a break or a transition', () => {
    run(report({ position: { segment: { kind: 'break', breakIndex: 0, afterPartIndex: 0 } } }))
    run(report({ position: { flowState: 'part_transition' } }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('needs 60% of the planned items done', () => {
    run(report({ position: { progress: { done: 5, total: 10 } } }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('needs the time left at most 180 s (30 s a problem by default)', () => {
    run(report({ position: { progress: { done: 12, total: 20 } } }), 30)
    expect(fetchMock).not.toHaveBeenCalled()
    run(report({ position: { progress: { done: 14, total: 20 } } }), null)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not fire for an ended session or another session’s report', () => {
    run(report({ outcome: 'completed', position: null }))
    run(report({ sessionId: 'plan-2' }))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
