/**
 * Shape tests for the single-source linear-readiness contract the modal and the
 * dashboard consume. DB-backed inputs are mocked; the derivation itself is real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCategorySkillIds } from '@/constants/skillCategories'
import type { PlayerSkillMastery } from '@/db/schema/player-skill-mastery'

const mocks = vi.hoisted(() => ({
  isEnabled: vi.fn(),
  getAllSkillMastery: vi.fn(),
  getLinearReadinessVetoes: vi.fn(),
  getRecentSessionResults: vi.fn(),
}))

vi.mock('@/lib/feature-flags', () => ({ isEnabled: mocks.isEnabled }))
vi.mock('../progress-manager', () => ({
  getAllSkillMastery: mocks.getAllSkillMastery,
  getLinearReadinessVetoes: mocks.getLinearReadinessVetoes,
}))
vi.mock('../session-planner', () => ({
  getRecentSessionResults: mocks.getRecentSessionResults,
}))
vi.mock('../linear-readiness', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../linear-readiness')>()
  return { ...orig, explainLinearReadiness: vi.fn(orig.explainLinearReadiness) }
})

import { explainLinearReadiness } from '../linear-readiness'
import { getLinearReadinessState } from '../linear-readiness-service'

const BASIC = getCategorySkillIds('basic')
const FIVE = getCategorySkillIds('fiveComplements')

function mastery(ids: string[]): Pick<PlayerSkillMastery, 'skillId' | 'practiceLevel'>[] {
  return ids.map((skillId) => ({ skillId, practiceLevel: 'abacus' as const }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isEnabled.mockResolvedValue(true)
  mocks.getAllSkillMastery.mockResolvedValue(mastery(BASIC))
  mocks.getLinearReadinessVetoes.mockResolvedValue(new Set())
  mocks.getRecentSessionResults.mockResolvedValue([])
})

describe('getLinearReadinessState', () => {
  it('flag off → disabled, empty contract', async () => {
    mocks.isEnabled.mockResolvedValue(false)
    await expect(getLinearReadinessState('p1')).resolves.toEqual({
      enabled: false,
      frontier: null,
      categories: [],
      skills: [],
    })
  })

  it('beginner with no history → Basic Skills frontier, locked category, a named row per skill', async () => {
    const state = await getLinearReadinessState('p1')
    expect(state.enabled).toBe(true)
    expect(state.frontier).toMatchObject({
      rank: 0,
      category: 'basic',
      name: 'Basic Skills',
      solidCount: 0,
      total: BASIC.length,
    })
    expect(state.categories).toEqual([
      expect.objectContaining({ category: 'basic', status: 'locked', vetoed: false }),
    ])
    expect(state.skills.map((s) => s.skillId)).toEqual(BASIC)
    for (const s of state.skills) {
      expect(s.stage).toBe(0)
      expect(typeof s.name).toBe('string')
      expect(s.name.length).toBeGreaterThan(0)
      expect(s.readiness.dimensions.volume.opportunities).toBe(0)
    }
  })

  it('a vetoed frontier category stays "vetoed" so the veto is visible and liftable', async () => {
    mocks.getLinearReadinessVetoes.mockResolvedValue(new Set(['basic']))
    const state = await getLinearReadinessState('p1')
    expect(state.frontier?.category).toBe('basic')
    expect(state.categories).toContainEqual(
      expect.objectContaining({ category: 'basic', status: 'vetoed', vetoed: true })
    )
  })

  it('graduated categories are "ready" or "vetoed"; the frontier category is "locked"', async () => {
    const explanation = {
      frontier: {
        rank: 1,
        category: 'fiveComplements' as const,
        name: 'Five Complements (Addition)',
        skillIds: FIVE,
        solidCount: 1,
        total: FIVE.length,
      },
      readySkillIds: new Set<string>(),
      readyBeforeVetoSkillIds: new Set(BASIC),
      frontierSkills: [],
    }
    vi.mocked(explainLinearReadiness).mockReturnValueOnce(explanation)
    mocks.getLinearReadinessVetoes.mockResolvedValue(new Set(['basic']))
    const vetoedState = await getLinearReadinessState('p1')
    expect(vetoedState.categories).toEqual([
      expect.objectContaining({ category: 'basic', status: 'vetoed', vetoed: true }),
      expect.objectContaining({ category: 'fiveComplements', status: 'locked', vetoed: false }),
    ])
    expect(vi.mocked(explainLinearReadiness).mock.calls[0][0].vetoedCategories).toEqual(
      new Set(['basic'])
    )

    vi.mocked(explainLinearReadiness).mockReturnValueOnce({
      ...explanation,
      readySkillIds: new Set(BASIC),
    })
    mocks.getLinearReadinessVetoes.mockResolvedValue(new Set())
    const readyState = await getLinearReadinessState('p1')
    expect(readyState.categories[0]).toMatchObject({
      category: 'basic',
      status: 'ready',
      vetoed: false,
      skillIds: BASIC,
    })
  })
})
