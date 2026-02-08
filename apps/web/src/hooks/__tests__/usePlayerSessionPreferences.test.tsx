import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import type { PlayerSessionPreferencesConfig } from '@/db/schema/player-session-preferences'
import { DEFAULT_SESSION_PREFERENCES } from '@/db/schema/player-session-preferences'
import { sessionPreferencesKeys } from '@/lib/queryKeys'
import {
  usePlayerSessionPreferences,
  useSavePlayerSessionPreferences,
} from '../usePlayerSessionPreferences'

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

const mockPreferences: PlayerSessionPreferencesConfig = {
  durationMinutes: 15,
  problemLengthPreference: 'shorter',
  partWeights: { abacus: 1, visualization: 1, linear: 1 },
  purposeWeights: { focus: 2, reinforce: 2, review: 1, challenge: 0 },
  shufflePurposes: false,
  gameBreakEnabled: false,
  gameBreakMinutes: 3,
  gameBreakSelectionMode: 'auto-start',
  gameBreakSelectedGame: 'matching',
  gameBreakDifficultyPreset: 'hard',
}

// ============================================================================
// sessionPreferencesKeys
// ============================================================================

describe('sessionPreferencesKeys', () => {
  it('has correct base key', () => {
    expect(sessionPreferencesKeys.all).toEqual(['session-preferences'])
  })

  it('generates player-specific keys', () => {
    expect(sessionPreferencesKeys.detail('player-1')).toEqual([
      'session-preferences',
      'player-1',
    ])
  })
})

// ============================================================================
// usePlayerSessionPreferences
// ============================================================================

describe('usePlayerSessionPreferences', () => {
  it('starts in loading state', () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => usePlayerSessionPreferences('player-1'), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('fetches preferences successfully', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ preferences: mockPreferences }),
    } as Response)

    const { result } = renderHook(() => usePlayerSessionPreferences('player-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockPreferences)
  })

  it('returns null when no preferences saved', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ preferences: null }),
    } as Response)

    const { result } = renderHook(() => usePlayerSessionPreferences('player-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeNull()
  })

  it('handles fetch errors', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' }),
    } as Response)

    const { result } = renderHook(() => usePlayerSessionPreferences('player-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeDefined()
  })

  it('calls the correct API endpoint', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ preferences: null }),
    } as Response)

    renderHook(() => usePlayerSessionPreferences('player-123'), { wrapper })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/curriculum/player-123/session-preferences',
        undefined
      )
    })
  })
})

// ============================================================================
// useSavePlayerSessionPreferences
// ============================================================================

describe('useSavePlayerSessionPreferences', () => {
  it('sends PUT request with preferences', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ preferences: mockPreferences }),
    } as Response)

    const { result } = renderHook(() => useSavePlayerSessionPreferences('player-1'), {
      wrapper,
    })

    await act(async () => {
      result.current.mutate(mockPreferences)
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/curriculum/player-1/session-preferences',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: mockPreferences }),
      })
    )
  })

  it('performs optimistic update on mutate', async () => {
    // Set up initial cache data
    queryClient.setQueryData(sessionPreferencesKeys.detail('player-1'), DEFAULT_SESSION_PREFERENCES)

    // Slow response so we can check optimistic state
    vi.mocked(global.fetch).mockReturnValue(
      new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              ok: true,
              json: async () => ({ preferences: mockPreferences }),
            } as Response),
          100
        )
      )
    )

    const { result } = renderHook(() => useSavePlayerSessionPreferences('player-1'), {
      wrapper,
    })

    act(() => {
      result.current.mutate(mockPreferences)
    })

    // Optimistic update should be immediate
    await waitFor(() => {
      const cached = queryClient.getQueryData(sessionPreferencesKeys.detail('player-1'))
      expect(cached).toEqual(mockPreferences)
    })
  })

  it('rolls back on error', async () => {
    const originalPrefs = { ...DEFAULT_SESSION_PREFERENCES }
    queryClient.setQueryData(sessionPreferencesKeys.detail('player-1'), originalPrefs)

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' }),
    } as Response)

    const { result } = renderHook(() => useSavePlayerSessionPreferences('player-1'), {
      wrapper,
    })

    await act(async () => {
      result.current.mutate(mockPreferences)
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    // Should have rolled back to original
    const cached = queryClient.getQueryData(sessionPreferencesKeys.detail('player-1'))
    expect(cached).toEqual(originalPrefs)
  })

  it('updates cache with server response on success', async () => {
    const serverResponse = { ...mockPreferences, durationMinutes: 20 }

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ preferences: serverResponse }),
    } as Response)

    const { result } = renderHook(() => useSavePlayerSessionPreferences('player-1'), {
      wrapper,
    })

    await act(async () => {
      result.current.mutate(mockPreferences)
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    const cached = queryClient.getQueryData(sessionPreferencesKeys.detail('player-1'))
    expect(cached).toEqual(serverResponse)
  })
})
