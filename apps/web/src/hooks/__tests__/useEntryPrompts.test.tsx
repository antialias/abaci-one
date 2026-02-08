import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { useEntryPrompts } from '../useEntryPrompts'
import type { EntryPrompt } from '../useEntryPrompts'
import { entryPromptKeys } from '@/lib/queryKeys'

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
  // Reset the Date mock if any
  vi.useRealTimers()
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

// ============================================================================
// Mock data helpers
// ============================================================================

function createMockPrompt(overrides: Partial<EntryPrompt> = {}): EntryPrompt {
  const futureDate = new Date(Date.now() + 3600000).toISOString() // 1 hour from now
  return {
    id: 'prompt-1',
    teacherId: 'teacher-1',
    playerId: 'player-1',
    classroomId: 'classroom-1',
    expiresAt: futureDate,
    status: 'pending',
    createdAt: new Date().toISOString(),
    player: { id: 'player-1', name: 'Alice', emoji: 'A' },
    classroom: { id: 'classroom-1', name: 'Math Class' },
    teacher: { displayName: 'Mr. Smith' },
    ...overrides,
  }
}

// ============================================================================
// entryPromptKeys
// ============================================================================

describe('entryPromptKeys', () => {
  it('has correct base key', () => {
    expect(entryPromptKeys.all).toEqual(['entry-prompts'])
  })

  it('generates pending key', () => {
    expect(entryPromptKeys.pending()).toEqual(['entry-prompts', 'pending'])
  })
})

// ============================================================================
// useEntryPrompts
// ============================================================================

describe('useEntryPrompts', () => {
  it('starts in loading state', () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useEntryPrompts(), { wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.prompts).toEqual([])
  })

  it('fetches pending entry prompts', async () => {
    const mockPrompt = createMockPrompt()

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ prompts: [mockPrompt] }),
    } as Response)

    const { result } = renderHook(() => useEntryPrompts(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.prompts).toHaveLength(1)
    expect(result.current.prompts[0].id).toBe('prompt-1')
    expect(global.fetch).toHaveBeenCalledWith('/api/entry-prompts', undefined)
  })

  it('filters out expired prompts on client side', async () => {
    const activePrompt = createMockPrompt({ id: 'active' })
    const expiredPrompt = createMockPrompt({
      id: 'expired',
      expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    })

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ prompts: [activePrompt, expiredPrompt] }),
    } as Response)

    const { result } = renderHook(() => useEntryPrompts(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.prompts).toHaveLength(1)
    expect(result.current.prompts[0].id).toBe('active')
  })

  it('filters out non-pending prompts on client side', async () => {
    const pendingPrompt = createMockPrompt({ id: 'pending', status: 'pending' })
    const acceptedPrompt = createMockPrompt({ id: 'accepted', status: 'accepted' })
    const declinedPrompt = createMockPrompt({ id: 'declined', status: 'declined' })

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ prompts: [pendingPrompt, acceptedPrompt, declinedPrompt] }),
    } as Response)

    const { result } = renderHook(() => useEntryPrompts(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.prompts).toHaveLength(1)
    expect(result.current.prompts[0].id).toBe('pending')
  })

  it('does not fetch when enabled is false', () => {
    const { result } = renderHook(() => useEntryPrompts(false), { wrapper })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.prompts).toEqual([])
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('handles fetch error', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      statusText: 'Unauthorized',
    } as Response)

    const { result } = renderHook(() => useEntryPrompts(), { wrapper })

    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
    })

    expect(result.current.error?.message).toBe('Failed to fetch entry prompts')
  })

  it('returns empty prompts when no pending prompts exist', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ prompts: [] }),
    } as Response)

    const { result } = renderHook(() => useEntryPrompts(), { wrapper })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.prompts).toEqual([])
  })

  // --------------------------------------------------------------------------
  // acceptPrompt mutation
  // --------------------------------------------------------------------------

  describe('acceptPrompt', () => {
    it('accepts a prompt successfully', async () => {
      const mockPrompt = createMockPrompt()

      // First call: fetch prompts; subsequent calls: mutation
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ prompts: [mockPrompt] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response)

      const { result } = renderHook(() => useEntryPrompts(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.acceptPrompt('prompt-1')
      })

      // Check the mutation call
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/entry-prompts/prompt-1/respond',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ action: 'accept' }),
        })
      )
    })

    it('invalidates queries after accepting', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ prompts: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response)

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useEntryPrompts(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.acceptPrompt('prompt-1')
      })

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: entryPromptKeys.pending(),
      })
    })

    it('throws on accept error', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ prompts: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Prompt already accepted' }),
        } as Response)

      const { result } = renderHook(() => useEntryPrompts(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await expect(
        act(async () => {
          await result.current.acceptPrompt('prompt-1')
        })
      ).rejects.toThrow('Prompt already accepted')
    })
  })

  // --------------------------------------------------------------------------
  // declinePrompt mutation
  // --------------------------------------------------------------------------

  describe('declinePrompt', () => {
    it('declines a prompt successfully', async () => {
      const mockPrompt = createMockPrompt()

      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ prompts: [mockPrompt] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response)

      const { result } = renderHook(() => useEntryPrompts(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.declinePrompt('prompt-1')
      })

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/entry-prompts/prompt-1/respond',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ action: 'decline' }),
        })
      )
    })

    it('invalidates queries after declining', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ prompts: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        } as Response)

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

      const { result } = renderHook(() => useEntryPrompts(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await act(async () => {
        await result.current.declinePrompt('prompt-1')
      })

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: entryPromptKeys.pending(),
      })
    })

    it('throws on decline error', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ prompts: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Prompt has expired' }),
        } as Response)

      const { result } = renderHook(() => useEntryPrompts(), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await expect(
        act(async () => {
          await result.current.declinePrompt('prompt-1')
        })
      ).rejects.toThrow('Prompt has expired')
    })
  })

  // --------------------------------------------------------------------------
  // Pending state tracking
  // --------------------------------------------------------------------------

  describe('pending state tracking', () => {
    it('tracks isAccepting and isDeclining states', () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ prompts: [] }),
      } as Response)

      const { result } = renderHook(() => useEntryPrompts(), { wrapper })

      expect(result.current.isAccepting).toBe(false)
      expect(result.current.isDeclining).toBe(false)
    })

    it('returns null for acceptingPromptId and decliningPromptId when idle', () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ prompts: [] }),
      } as Response)

      const { result } = renderHook(() => useEntryPrompts(), { wrapper })

      expect(result.current.acceptingPromptId).toBeNull()
      expect(result.current.decliningPromptId).toBeNull()
    })
  })
})
