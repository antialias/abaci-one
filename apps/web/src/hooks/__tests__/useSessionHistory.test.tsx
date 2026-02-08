import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { useSessionHistory } from '../useSessionHistory'
import { sessionHistoryKeys } from '@/lib/queryKeys'

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

const mockSession1 = {
  id: 'session-1',
  playerId: 'player-1',
  startedAt: '2025-01-01T00:00:00Z',
  completedAt: '2025-01-01T00:30:00Z',
  totalProblems: 20,
  correctCount: 18,
}

const mockSession2 = {
  id: 'session-2',
  playerId: 'player-1',
  startedAt: '2025-01-02T00:00:00Z',
  completedAt: '2025-01-02T00:25:00Z',
  totalProblems: 15,
  correctCount: 14,
}

const mockSession3 = {
  id: 'session-3',
  playerId: 'player-1',
  startedAt: '2025-01-03T00:00:00Z',
  completedAt: '2025-01-03T00:20:00Z',
  totalProblems: 10,
  correctCount: 10,
}

const mockPage1 = {
  sessions: [mockSession1, mockSession2],
  nextCursor: 'cursor-abc',
  hasMore: true,
}

const mockPage2 = {
  sessions: [mockSession3],
  nextCursor: null,
  hasMore: false,
}

// ============================================================================
// sessionHistoryKeys
// ============================================================================

describe('sessionHistoryKeys', () => {
  it('has correct base key', () => {
    expect(sessionHistoryKeys.all).toEqual(['sessionHistory'])
  })

  it('generates list keys with playerId', () => {
    expect(sessionHistoryKeys.list('player-1')).toEqual(['sessionHistory', 'player-1'])
  })
})

// ============================================================================
// useSessionHistory
// ============================================================================

describe('useSessionHistory', () => {
  it('starts in loading state', () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useSessionHistory('player-1'), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.sessions).toEqual([])
    expect(result.current.totalLoaded).toBe(0)
  })

  it('fetches the first page of session history', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockPage1,
    } as Response)

    const { result } = renderHook(() => useSessionHistory('player-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.sessions).toEqual([mockSession1, mockSession2])
    expect(result.current.totalLoaded).toBe(2)
    expect(result.current.hasNextPage).toBe(true)

    // Should use the api() helper with /api/ prefix and default limit=20
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/curriculum/player-1/sessions?limit=20',
      undefined
    )
  })

  it('fetches the next page when fetchNextPage is called', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPage1,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPage2,
      } as Response)

    const { result } = renderHook(() => useSessionHistory('player-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.sessions).toHaveLength(2)
    expect(result.current.hasNextPage).toBe(true)

    // Fetch the next page
    await act(async () => {
      await result.current.fetchNextPage()
    })

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(3)
    })

    expect(result.current.sessions).toEqual([mockSession1, mockSession2, mockSession3])
    expect(result.current.totalLoaded).toBe(3)
    expect(result.current.hasNextPage).toBe(false)

    // Second call should include cursor
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/curriculum/player-1/sessions?cursor=cursor-abc&limit=20',
      undefined
    )
  })

  it('uses custom pageSize option', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ sessions: [], nextCursor: null, hasMore: false }),
    } as Response)

    renderHook(() => useSessionHistory('player-1', { pageSize: 10 }), {
      wrapper,
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/curriculum/player-1/sessions?limit=10',
        undefined
      )
    })
  })

  it('does not fetch when playerId is empty', () => {
    const { result } = renderHook(() => useSessionHistory(''), { wrapper })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.sessions).toEqual([])
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('does not fetch when enabled is false', () => {
    const { result } = renderHook(
      () => useSessionHistory('player-1', { enabled: false }),
      { wrapper }
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.sessions).toEqual([])
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('handles fetch error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response)

    const { result } = renderHook(() => useSessionHistory('player-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toContain('Failed to fetch session history')
    expect(result.current.sessions).toEqual([])
  })

  it('returns empty sessions array when page has no sessions', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ sessions: [], nextCursor: null, hasMore: false }),
    } as Response)

    const { result } = renderHook(() => useSessionHistory('player-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.sessions).toEqual([])
    expect(result.current.totalLoaded).toBe(0)
    expect(result.current.hasNextPage).toBe(false)
  })
})
