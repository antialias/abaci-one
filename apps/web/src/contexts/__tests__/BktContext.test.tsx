import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React, { type ReactNode } from 'react'

// Mock BKT dependencies
vi.mock('@/lib/curriculum/bkt', () => ({
  computeBktFromHistory: vi.fn((history: any[], options?: any) => {
    // Simulate BKT computation based on problem history
    if (!history || history.length === 0) return { skills: [] }

    const skillMap = new Map<string, { correct: number; total: number }>()
    for (const problem of history) {
      const skillId = problem.skillId || 'unknown'
      const entry = skillMap.get(skillId) || { correct: 0, total: 0 }
      entry.total += 1
      if (problem.isCorrect) entry.correct += 1
      skillMap.set(skillId, entry)
    }

    const skills = Array.from(skillMap.entries()).map(([skillId, stats]) => ({
      skillId,
      pKnown: stats.correct / stats.total,
      confidence: Math.min(1, stats.total / 10),
    }))

    return { skills }
  }),
  getStalenessWarning: vi.fn((days: number | null) => {
    if (days === null) return null
    if (days < 7) return null
    if (days < 14) return 'Not practiced recently'
    return 'Stale skill'
  }),
  DEFAULT_BKT_OPTIONS: {},
}))

vi.mock('@/lib/curriculum/config/bkt-integration', () => ({
  BKT_THRESHOLDS: {
    strong: 0.8,
    developing: 0.5,
    confidence: 0.3,
  },
  classifySkill: vi.fn((pKnown: number, confidence: number) => {
    if (confidence < 0.3) return null
    if (pKnown >= 0.8) return 'strong'
    if (pKnown >= 0.5) return 'developing'
    return 'weak'
  }),
}))

vi.mock('@/lib/curriculum/skill-tutorial-config', () => ({
  getSkillDisplayName: vi.fn((skillId: string) => `Display: ${skillId}`),
}))

import {
  BktProvider,
  useBktConfig,
  useBktData,
  useSkillsByClassification,
  useBktExtendedData,
  useSkillDistribution,
  getExtendedClassification,
  BKT_THRESHOLDS,
} from '../BktContext'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'

// Helper to create problem history
function createProblemHistory(
  items: Array<{ skillId: string; isCorrect: boolean }>
): ProblemResultWithContext[] {
  return items.map((item, i) => ({
    skillId: item.skillId,
    isCorrect: item.isCorrect,
    // Minimal fields to satisfy the type
    problemId: `p${i}`,
    answer: item.isCorrect ? 'correct' : 'wrong',
    timeMs: 1000,
    timestamp: Date.now(),
  })) as unknown as ProblemResultWithContext[]
}

function createWrapper(
  problemHistory: ProblemResultWithContext[],
  options: { initialThreshold?: number; skillMasteryData?: any[] } = {}
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <BktProvider
        problemHistory={problemHistory}
        initialThreshold={options.initialThreshold}
        skillMasteryData={options.skillMasteryData}
      >
        {children}
      </BktProvider>
    )
  }
}

describe('BktContext', () => {
  describe('getExtendedClassification (pure function)', () => {
    it('returns unassessed for null classification', () => {
      expect(getExtendedClassification(null, null)).toBe('unassessed')
    })

    it('returns stale for strong classification with staleness warning', () => {
      expect(getExtendedClassification('strong', 'Not practiced recently')).toBe('stale')
    })

    it('returns strong for strong classification without staleness', () => {
      expect(getExtendedClassification('strong', null)).toBe('strong')
    })

    it('returns developing for developing classification', () => {
      expect(getExtendedClassification('developing', null)).toBe('developing')
    })

    it('returns weak for weak classification', () => {
      expect(getExtendedClassification('weak', null)).toBe('weak')
    })
  })

  describe('useBktConfig', () => {
    it('throws when used outside provider', () => {
      expect(() => {
        renderHook(() => useBktConfig())
      }).toThrow('useBktConfig must be used within a BktProvider')
    })

    it('provides default confidence threshold', () => {
      const history = createProblemHistory([])
      const { result } = renderHook(() => useBktConfig(), {
        wrapper: createWrapper(history),
      })
      expect(result.current.confidenceThreshold).toBe(0.3) // BKT_THRESHOLDS.confidence
    })

    it('allows setting preview threshold', () => {
      const history = createProblemHistory([])
      const { result } = renderHook(() => useBktConfig(), {
        wrapper: createWrapper(history),
      })

      act(() => {
        result.current.setPreviewThreshold(0.5)
      })

      expect(result.current.confidenceThreshold).toBe(0.5)
    })

    it('resets to initial threshold', () => {
      const history = createProblemHistory([])
      const { result } = renderHook(() => useBktConfig(), {
        wrapper: createWrapper(history),
      })

      act(() => {
        result.current.setPreviewThreshold(0.9)
      })
      expect(result.current.confidenceThreshold).toBe(0.9)

      act(() => {
        result.current.resetThreshold()
      })
      expect(result.current.confidenceThreshold).toBe(0.3)
    })

    it('uses custom initial threshold', () => {
      const history = createProblemHistory([])
      const { result } = renderHook(() => useBktConfig(), {
        wrapper: createWrapper(history, { initialThreshold: 0.6 }),
      })
      expect(result.current.confidenceThreshold).toBe(0.6)
    })
  })

  describe('useBktData', () => {
    it('throws when used outside provider', () => {
      expect(() => {
        renderHook(() => useBktData())
      }).toThrow('useBktData must be used within a BktProvider')
    })

    it('returns empty data for empty history', () => {
      const history = createProblemHistory([])
      const { result } = renderHook(() => useBktData(), {
        wrapper: createWrapper(history),
      })
      expect(result.current.skills).toEqual([])
      expect(result.current.hasData).toBe(false)
      expect(result.current.weak).toEqual([])
      expect(result.current.developing).toEqual([])
      expect(result.current.strong).toEqual([])
    })

    it('classifies skills based on history', () => {
      // Create history with enough data for confident classification
      const history = createProblemHistory([
        // Weak skill: 2/10 correct
        ...Array(8).fill({ skillId: 'add-1', isCorrect: false }),
        ...Array(2).fill({ skillId: 'add-1', isCorrect: true }),
        // Strong skill: 9/10 correct
        ...Array(9).fill({ skillId: 'add-2', isCorrect: true }),
        ...Array(1).fill({ skillId: 'add-2', isCorrect: false }),
        // Developing skill: 6/10 correct
        ...Array(6).fill({ skillId: 'add-3', isCorrect: true }),
        ...Array(4).fill({ skillId: 'add-3', isCorrect: false }),
      ])

      const { result } = renderHook(() => useBktData(), {
        wrapper: createWrapper(history),
      })

      expect(result.current.hasData).toBe(true)
      expect(result.current.skills.length).toBe(3)

      // Check classification groups
      expect(result.current.weak.length).toBe(1)
      expect(result.current.weak[0].skillId).toBe('add-1')

      expect(result.current.strong.length).toBe(1)
      expect(result.current.strong[0].skillId).toBe('add-2')

      expect(result.current.developing.length).toBe(1)
      expect(result.current.developing[0].skillId).toBe('add-3')
    })

    it('provides raw BKT results', () => {
      const history = createProblemHistory([
        { skillId: 'add-1', isCorrect: true },
        { skillId: 'add-1', isCorrect: true },
      ])

      const { result } = renderHook(() => useBktData(), {
        wrapper: createWrapper(history),
      })

      expect(result.current.rawBktResults).toBeDefined()
      expect(Array.isArray(result.current.rawBktResults)).toBe(true)
    })
  })

  describe('useSkillsByClassification', () => {
    it('provides legacy aliases', () => {
      const history = createProblemHistory([
        ...Array(10).fill({ skillId: 'add-1', isCorrect: false }),
      ])

      const { result } = renderHook(() => useSkillsByClassification(), {
        wrapper: createWrapper(history),
      })

      // Legacy aliases should match the new names
      expect(result.current.struggling).toBe(result.current.weak)
      expect(result.current.learning).toBe(result.current.developing)
      expect(result.current.mastered).toBe(result.current.strong)
    })
  })

  describe('useBktExtendedData', () => {
    it('returns null when no skillMasteryData provided', () => {
      const history = createProblemHistory([])
      const { result } = renderHook(() => useBktExtendedData(), {
        wrapper: createWrapper(history),
      })
      expect(result.current).toBeNull()
    })

    it('returns extended data when skillMasteryData is provided', () => {
      const history = createProblemHistory([
        ...Array(10).fill({ skillId: 'add-1', isCorrect: true }),
      ])

      const skillMasteryData = [
        {
          skillId: 'add-1',
          lastPracticedAt: new Date(),
          isPracticing: true,
        },
      ]

      const { result } = renderHook(() => useBktExtendedData(), {
        wrapper: createWrapper(history, { skillMasteryData }),
      })

      expect(result.current).not.toBeNull()
      expect(result.current!.hasExtendedData).toBe(true)
      expect(result.current!.extendedSkills.length).toBe(1)
    })

    it('classifies stale skills correctly', () => {
      const history = createProblemHistory([
        ...Array(10).fill({ skillId: 'add-1', isCorrect: true }),
      ])

      const tenDaysAgo = new Date()
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)

      const skillMasteryData = [
        {
          skillId: 'add-1',
          lastPracticedAt: tenDaysAgo,
          isPracticing: true,
        },
      ]

      const { result } = renderHook(() => useBktExtendedData(), {
        wrapper: createWrapper(history, { skillMasteryData }),
      })

      expect(result.current).not.toBeNull()
      // The skill is strong (1.0 pKnown) but stale (10 days)
      const staleSkills = result.current!.byClassification.stale
      expect(staleSkills.length).toBe(1)
      expect(staleSkills[0].stalenessWarning).not.toBeNull()
    })

    it('classifies unassessed skills', () => {
      const history = createProblemHistory([])

      const skillMasteryData = [
        {
          skillId: 'new-skill',
          lastPracticedAt: null,
          isPracticing: true,
        },
      ]

      const { result } = renderHook(() => useBktExtendedData(), {
        wrapper: createWrapper(history, { skillMasteryData }),
      })

      expect(result.current).not.toBeNull()
      // The skill has no BKT data (null classification) -> unassessed
      const unassessed = result.current!.byClassification.unassessed
      expect(unassessed.length).toBe(1)
    })

    it('provides distribution counts', () => {
      const history = createProblemHistory([
        ...Array(10).fill({ skillId: 'add-1', isCorrect: true }),
      ])

      const skillMasteryData = [
        {
          skillId: 'add-1',
          lastPracticedAt: new Date(),
          isPracticing: true,
        },
        {
          skillId: 'add-2',
          lastPracticedAt: null,
          isPracticing: true,
        },
      ]

      const { result } = renderHook(() => useBktExtendedData(), {
        wrapper: createWrapper(history, { skillMasteryData }),
      })

      expect(result.current).not.toBeNull()
      const dist = result.current!.distribution
      expect(dist.total).toBe(2)
      expect(typeof dist.strong).toBe('number')
      expect(typeof dist.stale).toBe('number')
      expect(typeof dist.developing).toBe('number')
      expect(typeof dist.weak).toBe('number')
      expect(typeof dist.unassessed).toBe('number')
    })

    it('only includes practicing skills', () => {
      const history = createProblemHistory([
        ...Array(10).fill({ skillId: 'add-1', isCorrect: true }),
      ])

      const skillMasteryData = [
        {
          skillId: 'add-1',
          lastPracticedAt: new Date(),
          isPracticing: true,
        },
        {
          skillId: 'add-2',
          lastPracticedAt: null,
          isPracticing: false, // Not practicing
        },
      ]

      const { result } = renderHook(() => useBktExtendedData(), {
        wrapper: createWrapper(history, { skillMasteryData }),
      })

      expect(result.current).not.toBeNull()
      // Only practicing skills should be included
      expect(result.current!.extendedSkills.length).toBe(1)
      expect(result.current!.distribution.total).toBe(1)
    })
  })

  describe('useSkillDistribution', () => {
    it('returns null when no extended data', () => {
      const history = createProblemHistory([])
      const { result } = renderHook(() => useSkillDistribution(), {
        wrapper: createWrapper(history),
      })
      expect(result.current).toBeNull()
    })

    it('returns distribution when extended data is available', () => {
      const history = createProblemHistory([])
      const skillMasteryData = [
        { skillId: 'add-1', lastPracticedAt: null, isPracticing: true },
      ]

      const { result } = renderHook(() => useSkillDistribution(), {
        wrapper: createWrapper(history, { skillMasteryData }),
      })

      expect(result.current).not.toBeNull()
      expect(result.current!.total).toBe(1)
    })
  })

  describe('BKT_THRESHOLDS re-export', () => {
    it('re-exports BKT_THRESHOLDS', () => {
      expect(BKT_THRESHOLDS).toBeDefined()
      expect(BKT_THRESHOLDS.strong).toBe(0.8)
      expect(BKT_THRESHOLDS.confidence).toBe(0.3)
    })
  })
})
