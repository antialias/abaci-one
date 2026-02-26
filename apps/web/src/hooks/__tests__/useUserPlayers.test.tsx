import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Player } from '@/db/schema/players'
import type { StudentWithSkillData } from '@/utils/studentGrouping'

// Mock React's cache function (not available in test environment)
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  }
})

import { useCreatePlayer, useUpdatePlayer, useDeletePlayer, playerKeys } from '../useUserPlayers'

describe('useUserPlayers hooks', () => {
  let queryClient: QueryClient

  const mockPlayer: Player = {
    id: 'player-1',
    name: 'Test Player',
    emoji: '🎮',
    color: '#ff0000',
    userId: 'user-1',
    isActive: true,
    isArchived: false,
    isPracticeStudent: true,
    createdAt: new Date('2024-01-01'),
    helpSettings: null,
    notes: null,
    birthday: null,
    familyCode: 'FAM-123456',
    familyCodeGeneratedAt: null,
  }

  const mockPlayerWithSkillData: StudentWithSkillData = {
    ...mockPlayer,
    practicingSkills: ['skill-1', 'skill-2'],
    lastPracticedAt: new Date('2024-01-15'),
    skillCategory: 'basic',
    intervention: null,
  }

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

  describe('useCreatePlayer', () => {
    const newPlayerInput = {
      name: 'New Player',
      emoji: '🚀',
      color: '#00ff00',
    }

    const serverResponse: Player = {
      id: 'player-new-123',
      ...newPlayerInput,
      userId: 'user-1',
      isActive: false,
      isArchived: false,
      isPracticeStudent: true,
      createdAt: new Date('2024-01-20'),
      helpSettings: null,
      notes: null,
      birthday: null,
      familyCode: 'FAM-NEW123',
      familyCodeGeneratedAt: null,
    }

    describe('optimistic updates', () => {
      test('adds optimistic player to list() query', async () => {
        // Pre-populate cache with existing players
        queryClient.setQueryData<Player[]>(playerKeys.list(), [mockPlayer])

        // Use a promise we can control to keep mutation pending
        let resolveRequest: (value: unknown) => void
        const pendingRequest = new Promise((resolve) => {
          resolveRequest = resolve
        })
        global.fetch = vi.fn().mockImplementation(() => pendingRequest)

        const { result } = renderHook(() => useCreatePlayer(), { wrapper })

        act(() => {
          result.current.mutate(newPlayerInput)
        })

        // Wait for optimistic update (onMutate is async)
        await waitFor(() => {
          const list = queryClient.getQueryData<Player[]>(playerKeys.list())
          expect(list).toHaveLength(2)
        })

        // Check optimistic update was applied
        const optimisticList = queryClient.getQueryData<Player[]>(playerKeys.list())
        expect(optimisticList?.[1]).toMatchObject({
          name: 'New Player',
          emoji: '🚀',
          color: '#00ff00',
          isActive: false,
          isArchived: false,
        })
        // Optimistic player has temp ID
        expect(optimisticList?.[1]?.id).toMatch(/^temp-\d+$/)

        // Now resolve the request
        resolveRequest!({
          ok: true,
          json: async () => ({ player: serverResponse }),
        })

        // Wait for mutation to complete
        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true)
        })
      })

      test('adds optimistic player to listWithSkillData() query', async () => {
        // Pre-populate cache with existing players (both queries)
        queryClient.setQueryData<Player[]>(playerKeys.list(), [mockPlayer])
        queryClient.setQueryData<StudentWithSkillData[]>(playerKeys.listWithSkillData(), [
          mockPlayerWithSkillData,
        ])

        let resolveRequest: (value: unknown) => void
        const pendingRequest = new Promise((resolve) => {
          resolveRequest = resolve
        })
        global.fetch = vi.fn().mockImplementation(() => pendingRequest)

        const { result } = renderHook(() => useCreatePlayer(), { wrapper })

        act(() => {
          result.current.mutate(newPlayerInput)
        })

        // Wait for optimistic update
        await waitFor(() => {
          const list = queryClient.getQueryData<StudentWithSkillData[]>(
            playerKeys.listWithSkillData()
          )
          expect(list).toHaveLength(2)
        })

        // Check optimistic update was applied to listWithSkillData
        const optimisticList = queryClient.getQueryData<StudentWithSkillData[]>(
          playerKeys.listWithSkillData()
        )
        expect(optimisticList?.[1]).toMatchObject({
          name: 'New Player',
          emoji: '🚀',
          color: '#00ff00',
          // New players have empty skill data
          practicingSkills: [],
          lastPracticedAt: null,
          skillCategory: null,
          intervention: null,
        })

        resolveRequest!({
          ok: true,
          json: async () => ({ player: serverResponse }),
        })

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true)
        })
      })

      test('handles case where listWithSkillData is not cached (graceful degradation)', async () => {
        // Only list() is cached, NOT listWithSkillData()
        queryClient.setQueryData<Player[]>(playerKeys.list(), [mockPlayer])
        // listWithSkillData is NOT in cache

        let resolveRequest: (value: unknown) => void
        const pendingRequest = new Promise((resolve) => {
          resolveRequest = resolve
        })
        global.fetch = vi.fn().mockImplementation(() => pendingRequest)

        const { result } = renderHook(() => useCreatePlayer(), { wrapper })

        act(() => {
          result.current.mutate(newPlayerInput)
        })

        // Wait for optimistic update on list()
        await waitFor(() => {
          const list = queryClient.getQueryData<Player[]>(playerKeys.list())
          expect(list).toHaveLength(2)
        })

        // listWithSkillData should still be undefined (not crashed)
        const skillDataList = queryClient.getQueryData<StudentWithSkillData[]>(
          playerKeys.listWithSkillData()
        )
        expect(skillDataList).toBeUndefined()

        resolveRequest!({
          ok: true,
          json: async () => ({ player: serverResponse }),
        })

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true)
        })
      })
    })

    describe('error handling and rollback', () => {
      test('rolls back list() on server error', async () => {
        // Pre-populate cache
        queryClient.setQueryData<Player[]>(playerKeys.list(), [mockPlayer])

        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          json: async () => ({ error: 'Server error' }),
        })

        const { result } = renderHook(() => useCreatePlayer(), { wrapper })

        let errorReceived: Error | undefined
        act(() => {
          result.current.mutate(newPlayerInput, {
            onError: (err) => {
              errorReceived = err
            },
          })
        })

        // Wait for error
        await waitFor(() => {
          expect(result.current.isError).toBe(true)
        })

        // After error, should roll back to original
        const rolledBackList = queryClient.getQueryData<Player[]>(playerKeys.list())
        expect(rolledBackList).toHaveLength(1)
        expect(rolledBackList?.[0]).toEqual(mockPlayer)
        expect(errorReceived?.message).toBe('Server error')
      })

      test('rolls back listWithSkillData() on server error', async () => {
        // Pre-populate both caches
        queryClient.setQueryData<Player[]>(playerKeys.list(), [mockPlayer])
        queryClient.setQueryData<StudentWithSkillData[]>(playerKeys.listWithSkillData(), [
          mockPlayerWithSkillData,
        ])

        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          json: async () => ({ error: 'Server error' }),
        })

        const { result } = renderHook(() => useCreatePlayer(), { wrapper })

        act(() => {
          result.current.mutate(newPlayerInput)
        })

        // Wait for error
        await waitFor(() => {
          expect(result.current.isError).toBe(true)
        })

        // Both should be rolled back to original data
        expect(queryClient.getQueryData<Player[]>(playerKeys.list())).toHaveLength(1)
        expect(
          queryClient.getQueryData<StudentWithSkillData[]>(playerKeys.listWithSkillData())
        ).toHaveLength(1)
        expect(
          queryClient.getQueryData<StudentWithSkillData[]>(playerKeys.listWithSkillData())?.[0]
        ).toEqual(mockPlayerWithSkillData)
      })

      test('handles network error gracefully', async () => {
        queryClient.setQueryData<Player[]>(playerKeys.list(), [mockPlayer])

        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

        const { result } = renderHook(() => useCreatePlayer(), { wrapper })

        act(() => {
          result.current.mutate(newPlayerInput)
        })

        await waitFor(() => {
          expect(result.current.isError).toBe(true)
        })

        // Should roll back
        expect(queryClient.getQueryData<Player[]>(playerKeys.list())).toHaveLength(1)
      })
    })

    describe('cache invalidation', () => {
      test('invalidates all player queries on success', async () => {
        queryClient.setQueryData<Player[]>(playerKeys.list(), [mockPlayer])
        queryClient.setQueryData<StudentWithSkillData[]>(playerKeys.listWithSkillData(), [
          mockPlayerWithSkillData,
        ])

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ player: serverResponse }),
        })

        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(() => useCreatePlayer(), { wrapper })

        act(() => {
          result.current.mutate(newPlayerInput)
        })

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true)
        })

        // Should have invalidated with playerKeys.all
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: playerKeys.all,
        })
      })

      test('invalidates all player queries even on error', async () => {
        queryClient.setQueryData<Player[]>(playerKeys.list(), [mockPlayer])

        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          json: async () => ({ error: 'Server error' }),
        })

        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(() => useCreatePlayer(), { wrapper })

        act(() => {
          result.current.mutate(newPlayerInput)
        })

        await waitFor(() => {
          expect(result.current.isError).toBe(true)
        })

        // onSettled runs on both success and error
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: playerKeys.all,
        })
      })
    })

    describe('API integration', () => {
      test('calls correct API endpoint', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ player: serverResponse }),
        })

        const { result } = renderHook(() => useCreatePlayer(), { wrapper })

        act(() => {
          result.current.mutate(newPlayerInput)
        })

        await waitFor(() => {
          expect(result.current.isSuccess).toBe(true)
        })

        expect(global.fetch).toHaveBeenCalledWith(
          '/api/players',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newPlayerInput),
          })
        )
      })

      test('returns created player from mutation', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ player: serverResponse }),
        })

        const { result } = renderHook(() => useCreatePlayer(), { wrapper })

        let createdPlayer: Player | undefined
        act(() => {
          result.current.mutate(newPlayerInput, {
            onSuccess: (data) => {
              createdPlayer = data
            },
          })
        })

        await waitFor(() => {
          expect(createdPlayer).toBeDefined()
        })

        expect(createdPlayer).toEqual(serverResponse)
      })
    })
  })

  describe('useUpdatePlayer', () => {
    test('optimistically updates player in both queries', async () => {
      queryClient.setQueryData<Player[]>(playerKeys.list(), [mockPlayer])
      queryClient.setQueryData<StudentWithSkillData[]>(playerKeys.listWithSkillData(), [
        mockPlayerWithSkillData,
      ])

      let resolveRequest: (value: unknown) => void
      const pendingRequest = new Promise((resolve) => {
        resolveRequest = resolve
      })
      global.fetch = vi.fn().mockImplementation(() => pendingRequest)

      const { result } = renderHook(() => useUpdatePlayer(), { wrapper })

      act(() => {
        result.current.mutate({
          id: 'player-1',
          updates: { name: 'Updated Name' },
        })
      })

      // Wait for optimistic update
      await waitFor(() => {
        expect(queryClient.getQueryData<Player[]>(playerKeys.list())?.[0]?.name).toBe(
          'Updated Name'
        )
      })

      // Check optimistic update in listWithSkillData()
      expect(
        queryClient.getQueryData<StudentWithSkillData[]>(playerKeys.listWithSkillData())?.[0]?.name
      ).toBe('Updated Name')

      resolveRequest!({
        ok: true,
        json: async () => ({ player: { ...mockPlayer, name: 'Updated Name' } }),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
    })

    test('rolls back both queries on error', async () => {
      queryClient.setQueryData<Player[]>(playerKeys.list(), [mockPlayer])
      queryClient.setQueryData<StudentWithSkillData[]>(playerKeys.listWithSkillData(), [
        mockPlayerWithSkillData,
      ])

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Update failed' }),
      })

      const { result } = renderHook(() => useUpdatePlayer(), { wrapper })

      act(() => {
        result.current.mutate({
          id: 'player-1',
          updates: { name: 'Updated Name' },
        })
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      // Should roll back to original
      expect(queryClient.getQueryData<Player[]>(playerKeys.list())?.[0]?.name).toBe('Test Player')
      expect(
        queryClient.getQueryData<StudentWithSkillData[]>(playerKeys.listWithSkillData())?.[0]?.name
      ).toBe('Test Player')
    })
  })

  describe('useDeletePlayer', () => {
    test('optimistically removes player from list', async () => {
      queryClient.setQueryData<Player[]>(playerKeys.list(), [mockPlayer])

      let resolveRequest: (value: unknown) => void
      const pendingRequest = new Promise((resolve) => {
        resolveRequest = resolve
      })
      global.fetch = vi.fn().mockImplementation(() => pendingRequest)

      const { result } = renderHook(() => useDeletePlayer(), { wrapper })

      act(() => {
        result.current.mutate('player-1')
      })

      // Wait for optimistic delete
      await waitFor(() => {
        expect(queryClient.getQueryData<Player[]>(playerKeys.list())).toHaveLength(0)
      })

      resolveRequest!({ ok: true })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
    })

    test('rolls back on error', async () => {
      queryClient.setQueryData<Player[]>(playerKeys.list(), [mockPlayer])

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Delete failed' }),
      })

      const { result } = renderHook(() => useDeletePlayer(), { wrapper })

      act(() => {
        result.current.mutate('player-1')
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      // Player should be restored
      expect(queryClient.getQueryData<Player[]>(playerKeys.list())).toHaveLength(1)
      expect(queryClient.getQueryData<Player[]>(playerKeys.list())?.[0]).toEqual(mockPlayer)
    })
  })
})
