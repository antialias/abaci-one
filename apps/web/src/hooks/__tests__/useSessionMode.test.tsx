import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import {
  useSessionMode,
  useDeferProgression,
  sessionModeKeys,
  prefetchSessionMode,
} from '../useSessionMode'

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

const mockRemediationMode = {
  type: 'remediation' as const,
  weakSkills: [
    { skillId: 'basic-add-1', displayName: 'Simple Addition', pKnown: 0.3 },
  ],
  focusDescription: 'Strengthening: Simple Addition',
  blockedPromotion: {
    nextSkill: { skillId: 'five-complement-1', displayName: 'Five Complement', pKnown: 0 },
    reason: 'Strengthen Simple Addition first',
    phase: { id: 'phase-2', primarySkillId: 'five-complement-1', displayName: 'Five Complement' },
    tutorialReady: false,
  },
}

const mockProgressionMode = {
  type: 'progression' as const,
  nextSkill: { skillId: 'five-complement-1', displayName: 'Five Complement', pKnown: 0 },
  phase: { id: 'phase-2', primarySkillId: 'five-complement-1', displayName: 'Five Complement' },
  tutorialRequired: true,
  skipCount: 0,
  focusDescription: 'Learning: Five Complement',
  canSkipTutorial: true,
}

const mockMaintenanceMode = {
  type: 'maintenance' as const,
  focusDescription: 'Mixed practice',
  skillCount: 5,
}

// ============================================================================
// sessionModeKeys
// ============================================================================

describe('sessionModeKeys', () => {
  it('has correct base key', () => {
    expect(sessionModeKeys.all).toEqual(['sessionMode'])
  })

  it('generates player-specific keys', () => {
    expect(sessionModeKeys.forPlayer('player-1')).toEqual(['sessionMode', 'player-1'])
  })
})

// ============================================================================
// prefetchSessionMode
// ============================================================================

describe('prefetchSessionMode', () => {
  it('returns query key and query function for SSR prefetching', () => {
    const prefetchConfig = prefetchSessionMode('player-1')

    expect(prefetchConfig.queryKey).toEqual(['sessionMode', 'player-1'])
    expect(typeof prefetchConfig.queryFn).toBe('function')
  })
})

// ============================================================================
// useSessionMode
// ============================================================================

describe('useSessionMode', () => {
  it('starts in loading state', () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useSessionMode('player-1'), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('fetches remediation mode', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ sessionMode: mockRemediationMode, comfortLevel: 0.3 }),
    } as Response)

    const { result } = renderHook(() => useSessionMode('player-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.sessionMode).toEqual(mockRemediationMode)
    expect(result.current.data?.sessionMode.type).toBe('remediation')
    expect(result.current.data?.comfortLevel).toBe(0.3)
    expect(global.fetch).toHaveBeenCalledWith('/api/curriculum/player-1/session-mode')
  })

  it('fetches progression mode', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ sessionMode: mockProgressionMode, comfortLevel: 0.5 }),
    } as Response)

    const { result } = renderHook(() => useSessionMode('player-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.sessionMode).toEqual(mockProgressionMode)
    expect(result.current.data?.sessionMode.type).toBe('progression')
    expect(result.current.data?.comfortLevel).toBe(0.5)
  })

  it('fetches maintenance mode', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ sessionMode: mockMaintenanceMode, comfortLevel: 0.8 }),
    } as Response)

    const { result } = renderHook(() => useSessionMode('player-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.sessionMode).toEqual(mockMaintenanceMode)
    expect(result.current.data?.sessionMode.type).toBe('maintenance')
    expect(result.current.data?.comfortLevel).toBe(0.8)
  })

  it('handles error with server message', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Player not found' }),
    } as Response)

    const { result } = renderHook(() => useSessionMode('player-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toBe('Player not found')
  })

  it('falls back to generic error message', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response)

    const { result } = renderHook(() => useSessionMode('player-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toBe('Failed to fetch session mode')
  })

  it('does not fetch when enabled is false', () => {
    const { result } = renderHook(() => useSessionMode('player-1', false), {
      wrapper,
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('does not fetch when playerId is empty string', () => {
    const { result } = renderHook(() => useSessionMode(''), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// ============================================================================
// useDeferProgression
// ============================================================================

describe('useDeferProgression', () => {
  it('defers progression for a skill', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)

    const { result } = renderHook(() => useDeferProgression('player-1'), {
      wrapper,
    })

    await act(async () => {
      result.current.mutate('five-complement-1')
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/curriculum/player-1/defer-progression',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: 'five-complement-1' }),
      })
    )
  })

  it('invalidates session mode query on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeferProgression('player-1'), {
      wrapper,
    })

    await act(async () => {
      result.current.mutate('five-complement-1')
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: sessionModeKeys.forPlayer('player-1'),
    })
  })

  it('handles error with server message', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Cannot defer at this time' }),
    } as Response)

    const { result } = renderHook(() => useDeferProgression('player-1'), {
      wrapper,
    })

    let caughtError: Error | undefined
    await act(async () => {
      result.current.mutate('five-complement-1', {
        onError: (err) => {
          caughtError = err
        },
      })
    })

    await waitFor(() => {
      expect(caughtError).toBeDefined()
    })

    expect(caughtError!.message).toBe('Cannot defer at this time')
  })

  it('falls back to generic error message', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response)

    const { result } = renderHook(() => useDeferProgression('player-1'), {
      wrapper,
    })

    let caughtError: Error | undefined
    await act(async () => {
      result.current.mutate('five-complement-1', {
        onError: (err) => {
          caughtError = err
        },
      })
    })

    await waitFor(() => {
      expect(caughtError).toBeDefined()
    })

    expect(caughtError!.message).toBe('Failed to defer progression')
  })

  it('does not invalidate queries on error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Error' }),
    } as Response)

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeferProgression('player-1'), {
      wrapper,
    })

    await act(async () => {
      result.current.mutate('five-complement-1', { onError: () => {} })
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})
