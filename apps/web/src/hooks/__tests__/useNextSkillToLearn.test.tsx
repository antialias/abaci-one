import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { useNextSkillToLearn, nextSkillKeys } from '../useNextSkillToLearn'

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

const mockSuggestion = {
  skillId: 'five-complement-1',
  phase: { id: 'phase-2', primarySkillId: 'five-complement-1', displayName: 'Five Complement' },
  tutorialReady: false,
  skipCount: 0,
}

// ============================================================================
// Query key factory
// ============================================================================

describe('nextSkillKeys', () => {
  it('has correct base key', () => {
    expect(nextSkillKeys.all).toEqual(['nextSkill'])
  })

  it('generates player-specific keys', () => {
    expect(nextSkillKeys.forPlayer('player-1')).toEqual(['nextSkill', 'player-1'])
  })
})

// ============================================================================
// useNextSkillToLearn
// ============================================================================

describe('useNextSkillToLearn', () => {
  it('starts in loading state', () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useNextSkillToLearn('player-1'), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('fetches the next skill to learn for a player', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ suggestion: mockSuggestion }),
    } as Response)

    const { result } = renderHook(() => useNextSkillToLearn('player-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockSuggestion)
    expect(global.fetch).toHaveBeenCalledWith('/api/curriculum/player-1/next-skill')
  })

  it('returns null when no suggestion is available', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ suggestion: null }),
    } as Response)

    const { result } = renderHook(() => useNextSkillToLearn('player-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeNull()
  })

  it('handles fetch error with server error message', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Player not found' }),
    } as Response)

    const { result } = renderHook(() => useNextSkillToLearn('player-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toBe('Player not found')
  })

  it('falls back to generic error message when server does not provide one', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response)

    const { result } = renderHook(() => useNextSkillToLearn('player-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toBe('Failed to fetch next skill')
  })

  it('does not fetch when enabled is false', () => {
    const { result } = renderHook(() => useNextSkillToLearn('player-1', false), {
      wrapper,
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('does not fetch when playerId is empty string', () => {
    const { result } = renderHook(() => useNextSkillToLearn(''), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fetches when enabled is true and playerId is non-empty', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ suggestion: null }),
    } as Response)

    const { result } = renderHook(() => useNextSkillToLearn('player-1', true), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})
