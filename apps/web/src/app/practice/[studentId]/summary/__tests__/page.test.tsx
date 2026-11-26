/** The latest-session summary page (Phase 4b): report first render, trend, failure. */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadSessionReport = vi.fn()
const getSessionReport = vi.fn()

vi.mock('@/lib/feature-flags', () => ({ isEnabled: async () => false }))
vi.mock('@/lib/subscription', () => ({
  getEffectiveTierForStudent: async () => ({ tier: 'free' }),
}))
vi.mock('@/lib/viewer', () => ({ getUserId: async () => 'viewer-1' }))
vi.mock('@/lib/classroom/access-control', () => ({ canPerformAction: async () => true }))
vi.mock('@/lib/curriculum/server', () => ({
  getPracticeStudent: async () => ({ id: 'kid-1', name: 'Kid' }),
  getActiveSessionPlan: async () => null,
  getMostRecentCompletedSession: async () => ({ id: 'plan-2', playerId: 'kid-1' }),
  getRecentSessionResults: async () => [],
  // Newest first: the shown session, then the previous one
  getRecentSessions: async () => [{ id: 'plan-2' }, { id: 'plan-1' }],
  getPaceAssessment: async () => ({ avgSecondsPerProblem: 5 }),
}))
vi.mock('@/lib/curriculum/session-report-server', () => ({
  loadSessionReport: (...a: unknown[]) => loadSessionReport(...a),
  getSessionReport: (...a: unknown[]) => getSessionReport(...a),
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
}))
vi.mock('../SummaryClient', () => ({ SummaryClient: () => null }))

import SummaryPage from '../page'

async function render() {
  const el = await SummaryPage({
    params: Promise.resolve({ studentId: 'kid-1' }),
    searchParams: Promise.resolve({}),
  })
  return el.props as {
    initialReport: { sessionId: string } | null
    previousAccuracy: number | null
    viewerId: string
  }
}

describe('summary page', () => {
  beforeEach(() => {
    loadSessionReport.mockReset()
    getSessionReport.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it("passes the report and the previous session's first-try accuracy for the trend", async () => {
    loadSessionReport.mockResolvedValue({ sessionId: 'plan-2', totals: { firstTryAccuracy: 0.7 } })
    getSessionReport.mockResolvedValue({ sessionId: 'plan-1', totals: { firstTryAccuracy: 0.6 } })
    const props = await render()
    expect(props.initialReport?.sessionId).toBe('plan-2')
    expect(getSessionReport).toHaveBeenCalledWith('plan-1')
    expect(props.previousAccuracy).toBe(0.6)
    expect(props.viewerId).toBe('viewer-1')
  })

  it('renders when a report fails to build (the live hook fills in)', async () => {
    loadSessionReport.mockRejectedValue(new Error('boom'))
    getSessionReport.mockRejectedValue(new Error('boom'))
    const props = await render()
    expect(props.initialReport).toBeNull()
    expect(props.previousAccuracy).toBeNull()
  })
})
