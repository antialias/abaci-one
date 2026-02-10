import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import {
  usePlayerGameHistory,
  useClassroomLeaderboard,
  useSaveGameResult,
  usePlayerClassroomRank,
  gameResultsKeys,
} from '../useGameResults'
import type { SaveGameResultParams } from '../useGameResults'

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
// usePlayerGameHistory
// ============================================================================

describe('usePlayerGameHistory', () => {
  it('fetches player game history when playerId is provided', async () => {
    const mockData = {
      history: [
        {
          id: 'result-1',
          playerId: 'player-1',
          gameName: 'matching',
          score: 100,
        },
      ],
      personalBests: {
        matching: { bestScore: 100, gamesPlayed: 5, displayName: 'Matching', icon: null },
      },
      totalGames: 5,
    }

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as Response)

    const { result } = renderHook(() => usePlayerGameHistory('player-1'), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
    expect(global.fetch).toHaveBeenCalledWith('/api/game-results/player/player-1', undefined)
  })

  it('does not fetch when playerId is null', () => {
    const { result } = renderHook(() => usePlayerGameHistory(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('handles fetch error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    } as Response)

    const { result } = renderHook(() => usePlayerGameHistory('player-1'), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toContain('Failed to fetch game history')
  })

  it('uses correct query keys', () => {
    expect(gameResultsKeys.all).toEqual(['game-results'])
    expect(gameResultsKeys.playerHistory('player-1')).toEqual([
      'game-results',
      'player',
      'player-1',
    ])
  })
})

// ============================================================================
// useClassroomLeaderboard
// ============================================================================

describe('useClassroomLeaderboard', () => {
  it('fetches classroom leaderboard when classroomId is provided', async () => {
    const mockData = {
      rankings: [
        {
          playerId: 'player-1',
          playerName: 'Alice',
          playerEmoji: '🎯',
          bestScore: 200,
          gamesPlayed: 10,
          avgScore: 150,
          totalDuration: 3000,
          rank: 1,
        },
        {
          playerId: 'player-2',
          playerName: 'Bob',
          playerEmoji: '🎮',
          bestScore: 180,
          gamesPlayed: 8,
          avgScore: 140,
          totalDuration: 2500,
          rank: 2,
        },
      ],
      playerCount: 2,
      gamesAvailable: [{ gameName: 'matching', gameDisplayName: 'Matching', gameIcon: null }],
    }

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as Response)

    const { result } = renderHook(() => useClassroomLeaderboard('classroom-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockData)
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/game-results/leaderboard/classroom/classroom-1',
      undefined
    )
  })

  it('includes gameName in query params when provided', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ rankings: [], playerCount: 0, gamesAvailable: [] }),
    } as Response)

    renderHook(() => useClassroomLeaderboard('classroom-1', 'matching'), { wrapper })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/game-results/leaderboard/classroom/classroom-1?gameName=matching',
        undefined
      )
    })
  })

  it('does not fetch when classroomId is null', () => {
    const { result } = renderHook(() => useClassroomLeaderboard(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('handles fetch error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      statusText: 'Server Error',
    } as Response)

    const { result } = renderHook(() => useClassroomLeaderboard('classroom-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toContain('Failed to fetch leaderboard')
  })

  it('uses correct query keys with gameName', () => {
    expect(gameResultsKeys.classroomLeaderboard('classroom-1', 'matching')).toEqual([
      'game-results',
      'leaderboard',
      'classroom',
      'classroom-1',
      'matching',
    ])

    expect(gameResultsKeys.classroomLeaderboard('classroom-1')).toEqual([
      'game-results',
      'leaderboard',
      'classroom',
      'classroom-1',
      undefined,
    ])
  })
})

// ============================================================================
// useSaveGameResult
// ============================================================================

describe('useSaveGameResult', () => {
  it('saves a game result successfully', async () => {
    const mockResponse = { id: 'result-123', success: true }

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const { result } = renderHook(() => useSaveGameResult(), { wrapper })

    const params: SaveGameResultParams = {
      playerId: 'player-1',
      sessionType: 'practice-break',
      sessionId: 'session-123',
      report: {
        gameName: 'matching',
        score: 100,
        duration: 60000,
        events: [],
      } as any,
    }

    await act(async () => {
      result.current.mutate(params)
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/game-results',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
    )
  })

  it('handles save error with error message from server', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid score' }),
    } as Response)

    const { result } = renderHook(() => useSaveGameResult(), { wrapper })

    let caughtError: any
    await act(async () => {
      result.current.mutate(
        {
          playerId: 'player-1',
          sessionType: 'standalone',
          report: { gameName: 'matching', score: -1 } as any,
        },
        {
          onError: (err) => {
            caughtError = err
          },
        }
      )
    })

    await waitFor(() => {
      expect(caughtError).toBeDefined()
    })

    expect(caughtError.message).toBe('Invalid score')
  })

  it('falls back to generic error message when response has no error field', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error('not json')
      },
    } as unknown as Response)

    const { result } = renderHook(() => useSaveGameResult(), { wrapper })

    let caughtError: any
    await act(async () => {
      result.current.mutate(
        {
          playerId: 'player-1',
          sessionType: 'standalone',
          report: { gameName: 'matching', score: 0 } as any,
        },
        {
          onError: (err) => {
            caughtError = err
          },
        }
      )
    })

    await waitFor(() => {
      expect(caughtError).toBeDefined()
    })

    expect(caughtError.message).toBe('Failed to save game result')
  })

  it('invalidates player history and leaderboard queries on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'result-123' }),
    } as Response)

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useSaveGameResult(), { wrapper })

    await act(async () => {
      result.current.mutate({
        playerId: 'player-1',
        sessionType: 'standalone',
        report: { gameName: 'matching', score: 100 } as any,
      })
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // Should invalidate player history
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: gameResultsKeys.playerHistory('player-1'),
    })

    // Should invalidate leaderboards
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [...gameResultsKeys.all, 'leaderboard'],
    })
  })
})

// ============================================================================
// usePlayerClassroomRank
// ============================================================================

describe('usePlayerClassroomRank', () => {
  it('returns the player ranking from the leaderboard', async () => {
    const mockData = {
      rankings: [
        {
          playerId: 'player-1',
          playerName: 'Alice',
          playerEmoji: '🎯',
          bestScore: 200,
          gamesPlayed: 10,
          avgScore: 150,
          totalDuration: 3000,
          rank: 1,
        },
        {
          playerId: 'player-2',
          playerName: 'Bob',
          playerEmoji: '🎮',
          bestScore: 180,
          gamesPlayed: 8,
          avgScore: 140,
          totalDuration: 2500,
          rank: 2,
        },
      ],
      playerCount: 2,
      gamesAvailable: [],
    }

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as Response)

    const { result } = renderHook(() => usePlayerClassroomRank('classroom-1', 'player-2'), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.playerRanking).not.toBeNull()
    })

    expect(result.current.playerRanking?.rank).toBe(2)
    expect(result.current.playerRanking?.playerName).toBe('Bob')
    expect(result.current.totalPlayers).toBe(2)
    expect(result.current.rankings).toHaveLength(2)
  })

  it('returns null playerRanking when player is not in leaderboard', async () => {
    const mockData = {
      rankings: [
        {
          playerId: 'player-1',
          playerName: 'Alice',
          playerEmoji: '🎯',
          bestScore: 200,
          gamesPlayed: 10,
          avgScore: 150,
          totalDuration: 3000,
          rank: 1,
        },
      ],
      playerCount: 1,
      gamesAvailable: [],
    }

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as Response)

    const { result } = renderHook(() => usePlayerClassroomRank('classroom-1', 'player-999'), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.rankings).toHaveLength(1)
    })

    expect(result.current.playerRanking).toBeNull()
    expect(result.current.totalPlayers).toBe(1)
  })

  it('returns defaults when classroomId is null', () => {
    const { result } = renderHook(() => usePlayerClassroomRank(null, 'player-1'), { wrapper })

    expect(result.current.playerRanking).toBeNull()
    expect(result.current.totalPlayers).toBe(0)
    expect(result.current.rankings).toEqual([])
  })

  it('returns defaults when playerId is null', async () => {
    const mockData = {
      rankings: [
        {
          playerId: 'player-1',
          playerName: 'Alice',
          playerEmoji: '🎯',
          bestScore: 200,
          gamesPlayed: 10,
          avgScore: 150,
          totalDuration: 3000,
          rank: 1,
        },
      ],
      playerCount: 1,
      gamesAvailable: [],
    }

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as Response)

    const { result } = renderHook(() => usePlayerClassroomRank('classroom-1', null), { wrapper })

    await waitFor(() => {
      expect(result.current.rankings).toHaveLength(1)
    })

    // null playerId won't match any ranking
    expect(result.current.playerRanking).toBeNull()
  })
})
