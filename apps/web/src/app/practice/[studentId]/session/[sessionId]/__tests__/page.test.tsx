import { beforeEach, describe, expect, it, vi } from 'vitest'

const isEnabled = vi.fn()
const getEffectiveTierForStudent = vi.fn()

vi.mock('@/lib/feature-flags', () => ({ isEnabled: (...a: unknown[]) => isEnabled(...a) }))
vi.mock('@/lib/subscription', () => ({
  getEffectiveTierForStudent: (...a: unknown[]) => getEffectiveTierForStudent(...a),
}))
vi.mock('@/lib/viewer', () => ({ getUserId: async () => 'viewer-1' }))
vi.mock('@/lib/classroom/access-control', () => ({ canPerformAction: async () => true }))
vi.mock('@/lib/curriculum/server', () => ({
  getPracticeStudent: async () => ({ id: 'kid-1', name: 'Kid' }),
  getSessionPlan: async () => ({ id: 'plan-1', playerId: 'kid-1' }),
  getRecentSessionResults: async () => [],
  getPaceAssessment: async () => ({ avgSecondsPerProblem: 5 }),
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
}))
vi.mock('../../../summary/SummaryClient', () => ({ SummaryClient: () => null }))

import SessionPage from '../page'

async function render() {
  const el = await SessionPage({
    params: Promise.resolve({ studentId: 'kid-1', sessionId: 'plan-1' }),
  })
  return el.props as { songEnabled?: boolean; session: { id: string } }
}

describe('past session page', () => {
  beforeEach(() => {
    isEnabled.mockReset()
    getEffectiveTierForStudent.mockReset()
  })

  it('shows the session song for a family-tier student when songs are on', async () => {
    isEnabled.mockResolvedValue(true)
    getEffectiveTierForStudent.mockResolvedValue({ tier: 'family' })
    const props = await render()
    expect(props.session.id).toBe('plan-1')
    expect(props.songEnabled).toBe(true)
    expect(isEnabled).toHaveBeenCalledWith('session-song.enabled')
    expect(getEffectiveTierForStudent).toHaveBeenCalledWith('kid-1', 'viewer-1')
  })

  it('hides it when the flag is off or the student is not on the family tier', async () => {
    isEnabled.mockResolvedValue(false)
    getEffectiveTierForStudent.mockResolvedValue({ tier: 'family' })
    expect((await render()).songEnabled).toBe(false)

    isEnabled.mockResolvedValue(true)
    getEffectiveTierForStudent.mockResolvedValue({ tier: 'free' })
    expect((await render()).songEnabled).toBe(false)
  })
})
