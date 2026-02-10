import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { useRecordGameResult } from '../useRecordGameResult'
import type { GameResult } from '@/lib/arcade/stats/types'

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

const mockGameResult: GameResult = {
  gameType: 'matching',
  playerResults: [
    {
      playerId: 'player-1',
      won: true,
      score: 100,
      accuracy: 0.95,
      completionTime: 30000,
    },
  ],
  completedAt: Date.now(),
  duration: 30000,
  metadata: {
    gameMode: 'solo',
  },
}

const mockResponse = {
  success: true,
  updates: [
    {
      playerId: 'player-1',
      previousStats: { gamesPlayed: 4, totalWins: 3, totalLosses: 1 },
      newStats: { gamesPlayed: 5, totalWins: 4, totalLosses: 1 },
      changes: { gamesPlayed: 1, wins: 1, losses: 0 },
    },
  ],
}

// ============================================================================
// useRecordGameResult
// ============================================================================

describe('useRecordGameResult', () => {
  it('records a game result successfully', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const { result } = renderHook(() => useRecordGameResult(), { wrapper })

    await act(async () => {
      result.current.mutate(mockGameResult)
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/player-stats/record-game',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameResult: mockGameResult }),
      })
    )
  })

  it('returns the response data on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const { result } = renderHook(() => useRecordGameResult(), { wrapper })

    await act(async () => {
      result.current.mutate(mockGameResult)
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockResponse)
  })

  it('handles error response with server error message', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid game type' }),
    } as Response)

    const { result } = renderHook(() => useRecordGameResult(), { wrapper })

    let caughtError: Error | undefined
    await act(async () => {
      result.current.mutate(mockGameResult, {
        onError: (err) => {
          caughtError = err
        },
      })
    })

    await waitFor(() => {
      expect(caughtError).toBeDefined()
    })

    expect(caughtError!.message).toBe('Invalid game type')
  })

  it('falls back to generic error when response JSON parsing fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error('not json')
      },
    } as unknown as Response)

    const { result } = renderHook(() => useRecordGameResult(), { wrapper })

    let caughtError: Error | undefined
    await act(async () => {
      result.current.mutate(mockGameResult, {
        onError: (err) => {
          caughtError = err
        },
      })
    })

    await waitFor(() => {
      expect(caughtError).toBeDefined()
    })

    expect(caughtError!.message).toBe('Failed to record game result')
  })

  it('invalidates player-stats queries on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useRecordGameResult(), { wrapper })

    await act(async () => {
      result.current.mutate(mockGameResult)
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['player-stats'] })
  })

  it('does not invalidate queries on error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    } as Response)

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useRecordGameResult(), { wrapper })

    await act(async () => {
      result.current.mutate(mockGameResult, { onError: () => {} })
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('tracks isPending state during mutation', async () => {
    let resolvePromise: (value: Response) => void
    const promise = new Promise<Response>((resolve) => {
      resolvePromise = resolve
    })
    vi.mocked(global.fetch).mockReturnValue(promise)

    const { result } = renderHook(() => useRecordGameResult(), { wrapper })

    expect(result.current.isPending).toBe(false)

    act(() => {
      result.current.mutate(mockGameResult)
    })

    await waitFor(() => {
      expect(result.current.isPending).toBe(true)
    })

    await act(async () => {
      resolvePromise!({
        ok: true,
        json: async () => mockResponse,
      } as Response)
    })

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })
  })
})
