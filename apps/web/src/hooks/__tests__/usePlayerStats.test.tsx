import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { usePlayerStats, useAllPlayerStats, useSinglePlayerStats } from '../usePlayerStats'

// ============================================================================
// Setup
// ============================================================================

let queryClient: QueryClient

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
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

const mockPlayerStats = {
  playerId: 'player-1',
  gamesPlayed: 10,
  totalWins: 7,
  totalLosses: 3,
  bestTime: 25000,
  highestAccuracy: 0.95,
  favoriteGameType: 'matching',
  gameStats: {},
  lastPlayedAt: '2025-01-01T00:00:00Z',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}

const mockPlayerStats2 = {
  playerId: 'player-2',
  gamesPlayed: 5,
  totalWins: 3,
  totalLosses: 2,
  bestTime: 30000,
  highestAccuracy: 0.88,
  favoriteGameType: 'memory-quiz',
  gameStats: {},
  lastPlayedAt: '2025-01-02T00:00:00Z',
  createdAt: '2024-02-01T00:00:00Z',
  updatedAt: '2025-01-02T00:00:00Z',
}

// ============================================================================
// usePlayerStats (overloaded: all players or specific player)
// ============================================================================

describe('usePlayerStats', () => {
  it('fetches all player stats when no playerId is provided', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ playerStats: [mockPlayerStats, mockPlayerStats2] }),
    } as Response)

    const { result } = renderHook(() => usePlayerStats(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([mockPlayerStats, mockPlayerStats2])
    expect(global.fetch).toHaveBeenCalledWith('/api/player-stats', undefined)
  })

  it('fetches specific player stats when playerId is provided', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ stats: mockPlayerStats }),
    } as Response)

    const { result } = renderHook(() => usePlayerStats('player-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockPlayerStats)
    expect(global.fetch).toHaveBeenCalledWith('/api/player-stats/player-1', undefined)
  })

  it('uses query key without playerId for all stats', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ playerStats: [] }),
    } as Response)

    renderHook(() => usePlayerStats(), { wrapper })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    // Verify the query exists in the cache with the right key
    const data = queryClient.getQueryData(['player-stats'])
    expect(data).toBeDefined()
  })

  it('uses query key with playerId for single player', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ stats: mockPlayerStats }),
    } as Response)

    renderHook(() => usePlayerStats('player-1'), { wrapper })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const data = queryClient.getQueryData(['player-stats', 'player-1'])
    expect(data).toBeDefined()
  })

  it('handles fetch error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      statusText: 'Server Error',
    } as Response)

    const { result } = renderHook(() => usePlayerStats(), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toBe('Failed to fetch player stats')
  })

  it('starts in loading state', () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => usePlayerStats(), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })
})

// ============================================================================
// useAllPlayerStats
// ============================================================================

describe('useAllPlayerStats', () => {
  it('fetches all players stats', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ playerStats: [mockPlayerStats, mockPlayerStats2] }),
    } as Response)

    const { result } = renderHook(() => useAllPlayerStats(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([mockPlayerStats, mockPlayerStats2])
    expect(global.fetch).toHaveBeenCalledWith('/api/player-stats', undefined)
  })

  it('returns empty array when no players exist', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ playerStats: [] }),
    } as Response)

    const { result } = renderHook(() => useAllPlayerStats(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([])
  })

  it('handles fetch error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error',
    } as Response)

    const { result } = renderHook(() => useAllPlayerStats(), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toBe('Failed to fetch player stats')
  })
})

// ============================================================================
// useSinglePlayerStats
// ============================================================================

describe('useSinglePlayerStats', () => {
  it('fetches stats for a specific player', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ stats: mockPlayerStats }),
    } as Response)

    const { result } = renderHook(() => useSinglePlayerStats('player-1'), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockPlayerStats)
    expect(global.fetch).toHaveBeenCalledWith('/api/player-stats/player-1', undefined)
  })

  it('does not fetch when playerId is empty string', () => {
    const { result } = renderHook(() => useSinglePlayerStats(''), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('handles fetch error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    } as Response)

    const { result } = renderHook(() => useSinglePlayerStats('player-1'), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toBe('Failed to fetch player stats')
  })

  it('uses correct query key with playerId', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ stats: mockPlayerStats }),
    } as Response)

    renderHook(() => useSinglePlayerStats('player-1'), { wrapper })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const data = queryClient.getQueryData(['player-stats', 'player-1'])
    expect(data).toBeDefined()
  })
})
