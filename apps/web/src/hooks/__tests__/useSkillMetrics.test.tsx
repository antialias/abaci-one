import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import {
  usePlayerSkillMetrics,
  useClassroomSkillsLeaderboard,
  skillMetricsKeys,
} from '../useSkillMetrics'

// ============================================================================
// Setup
// ============================================================================

let queryClient: QueryClient

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

// ============================================================================
// Mock data
// ============================================================================

const mockSkillMetrics = {
  computedAt: new Date().toISOString(),
  overallMastery: 0.72,
  categoryMastery: {
    basic: {
      mastery: 0.95,
      totalSkills: 5,
      practicedSkills: 5,
      trend: 'stable',
    },
    fiveComplements: {
      mastery: 0.8,
      totalSkills: 4,
      practicedSkills: 3,
      trend: 'improving',
    },
  },
  timing: {
    avgSecondsPerTerm: 2.5,
    trend: 'improving',
  },
  accuracy: {
    overallPercent: 85,
    recentPercent: 90,
    trend: 'improving',
  },
  progress: {
    improvementRate: 0.05,
    currentStreak: 3,
    weeklyProblems: 45,
    totalProblems: 200,
  },
}

const mockLeaderboard = {
  computedAt: new Date().toISOString(),
  playerCount: 5,
  byWeeklyProblems: [
    { playerId: 'p1', playerName: 'Alice', rank: 1, value: 100 },
    { playerId: 'p2', playerName: 'Bob', rank: 2, value: 80 },
  ],
  byTotalProblems: [{ playerId: 'p1', playerName: 'Alice', rank: 1, value: 500 }],
  byPracticeStreak: [{ playerId: 'p2', playerName: 'Bob', rank: 1, value: 10 }],
  byImprovementRate: [{ playerId: 'p1', playerName: 'Alice', rank: 1, value: 0.1 }],
  speedChampions: [],
}

// ============================================================================
// usePlayerSkillMetrics
// ============================================================================

describe('usePlayerSkillMetrics', () => {
  it('fetches player skill metrics when playerId is provided', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ metrics: mockSkillMetrics }),
    } as Response)

    const { result } = renderHook(() => usePlayerSkillMetrics('player-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockSkillMetrics)
    expect(global.fetch).toHaveBeenCalledWith('/api/curriculum/player-1/skills/metrics', undefined)
  })

  it('does not fetch when playerId is null', () => {
    const { result } = renderHook(() => usePlayerSkillMetrics(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('handles fetch error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    } as Response)

    const { result } = renderHook(() => usePlayerSkillMetrics('player-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toContain('Failed to fetch skill metrics')
  })

  it('extracts metrics from the response data wrapper', async () => {
    const metricsPayload = {
      metrics: {
        ...mockSkillMetrics,
        overallMastery: 0.55,
      },
    }

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => metricsPayload,
    } as Response)

    const { result } = renderHook(() => usePlayerSkillMetrics('player-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // Should return data.metrics, not the raw response
    expect(result.current.data?.overallMastery).toBe(0.55)
  })

  it('uses correct query key', () => {
    expect(skillMetricsKeys.player('player-1')).toEqual(['skill-metrics', 'player', 'player-1'])
  })
})

// ============================================================================
// useClassroomSkillsLeaderboard
// ============================================================================

describe('useClassroomSkillsLeaderboard', () => {
  it('fetches classroom skills leaderboard when classroomId is provided', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ leaderboard: mockLeaderboard }),
    } as Response)

    const { result } = renderHook(() => useClassroomSkillsLeaderboard('classroom-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockLeaderboard)
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/classroom/classroom-1/skills/leaderboard',
      undefined
    )
  })

  it('does not fetch when classroomId is null', () => {
    const { result } = renderHook(() => useClassroomSkillsLeaderboard(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('handles fetch error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      statusText: 'Forbidden',
    } as Response)

    const { result } = renderHook(() => useClassroomSkillsLeaderboard('classroom-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toContain('Failed to fetch skills leaderboard')
  })

  it('extracts leaderboard from the response data wrapper', async () => {
    const leaderboardPayload = {
      leaderboard: {
        ...mockLeaderboard,
        playerCount: 99,
      },
    }

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => leaderboardPayload,
    } as Response)

    const { result } = renderHook(() => useClassroomSkillsLeaderboard('classroom-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // Should return data.leaderboard, not the raw response
    expect(result.current.data?.playerCount).toBe(99)
  })

  it('uses correct query key', () => {
    expect(skillMetricsKeys.classroomLeaderboard('classroom-1')).toEqual([
      'skill-metrics',
      'leaderboard',
      'classroom',
      'classroom-1',
    ])
  })
})

// ============================================================================
// Query key factory
// ============================================================================

describe('skillMetricsKeys', () => {
  it('has correct base key', () => {
    expect(skillMetricsKeys.all).toEqual(['skill-metrics'])
  })

  it('generates player keys correctly', () => {
    expect(skillMetricsKeys.player('abc')).toEqual(['skill-metrics', 'player', 'abc'])
  })

  it('generates classroom leaderboard keys correctly', () => {
    expect(skillMetricsKeys.classroomLeaderboard('xyz')).toEqual([
      'skill-metrics',
      'leaderboard',
      'classroom',
      'xyz',
    ])
  })
})
