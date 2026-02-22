'use client'

import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import type { Player } from '@/db/schema/players'
import { api } from '@/lib/queryClient'
import { playerKeys } from '@/lib/queryKeys'
import type { StudentWithSkillData } from '@/utils/studentGrouping'

// Re-export query keys for consumers
export { playerKeys } from '@/lib/queryKeys'

/**
 * Fetch all players for the current user
 */
async function fetchPlayers(): Promise<Player[]> {
  const res = await api('players')
  if (!res.ok) throw new Error('Failed to fetch players')
  const data = await res.json()
  return data.players
}

/**
 * Fetch all players with skill data for the current user
 */
async function fetchPlayersWithSkillData(): Promise<StudentWithSkillData[]> {
  const res = await api('players/with-skill-data')
  if (!res.ok) throw new Error('Failed to fetch players with skill data')
  const data = await res.json()
  return data.players
}

/**
 * Create a new player
 */
/** Error with a machine-readable code for limit-reached responses */
export class ApiError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

async function createPlayer(
  newPlayer: Pick<Player, 'name' | 'emoji' | 'color'> & {
    isActive?: boolean
    isPracticeStudent?: boolean
  }
): Promise<Player> {
  const res = await api('players', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newPlayer),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(data.error || 'Failed to create player', data.code)
  }
  const data = await res.json()
  return data.player
}

/**
 * Update a player
 */
async function updatePlayer({
  id,
  updates,
}: {
  id: string
  updates: Partial<
    Pick<Player, 'name' | 'emoji' | 'color' | 'isActive' | 'isArchived' | 'notes' | 'age'>
  >
}): Promise<Player> {
  const res = await api(`players/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    // Extract error message from response if available
    try {
      const errorData = await res.json()
      throw new Error(errorData.error || 'Failed to update player')
    } catch (_jsonError) {
      throw new Error('Failed to update player')
    }
  }
  const data = await res.json()
  return data.player
}

/**
 * Delete a player
 */
async function deletePlayer(id: string): Promise<void> {
  const res = await api(`players/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete player')
}

/**
 * Hook: Fetch all players
 */
export function useUserPlayers() {
  return useQuery({
    queryKey: playerKeys.list(),
    queryFn: fetchPlayers,
  })
}

/**
 * Hook: Fetch all players with Suspense (for SSR contexts)
 */
export function useUserPlayersSuspense() {
  return useSuspenseQuery({
    queryKey: playerKeys.list(),
    queryFn: fetchPlayers,
  })
}

/**
 * Hook: Fetch all players with skill data
 * Used by the practice page for grouping/filtering
 *
 * When data arrives with batch-fetched enrichment fields, seeds per-student
 * React Query caches so downstream hooks (useEnrolledClassrooms, useStudentPresence)
 * find cached data and skip individual HTTP requests.
 */
export function usePlayersWithSkillData(options?: { initialData?: StudentWithSkillData[] }) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: playerKeys.listWithSkillData(),
    queryFn: fetchPlayersWithSkillData,
    initialData: options?.initialData,
    // Keep data fresh but don't refetch too aggressively
    staleTime: 30_000, // 30 seconds
  })

  // Seed per-student caches synchronously during render.
  // This MUST happen before child components (StudentActionMenu) mount and fire
  // their useEnrolledClassrooms/useStudentPresence hooks. useEffect is too late.
  const lastSeededDataRef = useRef<StudentWithSkillData[] | undefined>()
  if (query.data && query.data !== lastSeededDataRef.current) {
    lastSeededDataRef.current = query.data
    for (const player of query.data) {
      if (player.enrolledClassrooms !== undefined) {
        queryClient.setQueryData(
          playerKeys.enrolledClassrooms(player.id),
          player.enrolledClassrooms
        )
      }
      if (player.currentPresence !== undefined) {
        queryClient.setQueryData(playerKeys.presence(player.id), player.currentPresence)
      }
    }
  }

  return query
}

/**
 * Hook: Fetch a single player with Suspense (for SSR contexts)
 */
export function usePlayerSuspense(playerId: string) {
  return useSuspenseQuery({
    queryKey: playerKeys.detail(playerId),
    queryFn: async () => {
      const res = await api(`players/${playerId}`)
      if (!res.ok) throw new Error('Failed to fetch player')
      const data = await res.json()
      return data.player as Player
    },
  })
}

/**
 * Hook: Create a new player
 */
export function useCreatePlayer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createPlayer,
    onMutate: async (newPlayer) => {
      // Cancel outgoing refetches for all player queries
      await queryClient.cancelQueries({ queryKey: playerKeys.all })

      // Snapshot previous values
      const previousPlayers = queryClient.getQueryData<Player[]>(playerKeys.list())
      const previousPlayersWithSkillData = queryClient.getQueryData<StudentWithSkillData[]>(
        playerKeys.listWithSkillData()
      )

      // Create optimistic player
      const optimisticPlayer: Player = {
        id: `temp-${Date.now()}`, // Temporary ID
        ...newPlayer,
        createdAt: new Date(),
        isActive: newPlayer.isActive ?? false,
        isPracticeStudent: newPlayer.isPracticeStudent ?? true,
        isArchived: false,
        userId: 'temp-user', // Temporary userId, will be replaced by server response
        helpSettings: null, // Will be set by server with default values
        notes: null,
        age: null,
        familyCode: null, // Will be generated by server
        familyCodeGeneratedAt: null,
      }

      // Optimistically update player list
      if (previousPlayers) {
        queryClient.setQueryData<Player[]>(playerKeys.list(), [
          ...previousPlayers,
          optimisticPlayer,
        ])
      }

      // Optimistically update players with skill data (used by practice page)
      if (previousPlayersWithSkillData) {
        const optimisticPlayerWithSkillData: StudentWithSkillData = {
          ...optimisticPlayer,
          practicingSkills: [],
          lastPracticedAt: null,
          skillCategory: null,
          intervention: null,
          enrolledClassrooms: [],
          currentPresence: null,
          activeSession: null,
        }
        queryClient.setQueryData<StudentWithSkillData[]>(playerKeys.listWithSkillData(), [
          ...previousPlayersWithSkillData,
          optimisticPlayerWithSkillData,
        ])
      }

      return { previousPlayers, previousPlayersWithSkillData }
    },
    onError: (_err, _newPlayer, context) => {
      // Rollback on error
      if (context?.previousPlayers) {
        queryClient.setQueryData(playerKeys.list(), context.previousPlayers)
      }
      if (context?.previousPlayersWithSkillData) {
        queryClient.setQueryData(
          playerKeys.listWithSkillData(),
          context.previousPlayersWithSkillData
        )
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      // Invalidate ALL player queries (including listWithSkillData used by practice page)
      queryClient.invalidateQueries({ queryKey: playerKeys.all })
    },
  })
}

/**
 * Hook: Update a player
 */
export function useUpdatePlayer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updatePlayer,
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing refetches for all player lists
      await queryClient.cancelQueries({ queryKey: playerKeys.all })

      // Snapshot previous values
      const previousPlayers = queryClient.getQueryData<Player[]>(playerKeys.list())
      const previousPlayersWithSkillData = queryClient.getQueryData<StudentWithSkillData[]>(
        playerKeys.listWithSkillData()
      )

      // Optimistically update player list
      if (previousPlayers) {
        const optimisticPlayers = previousPlayers.map((player) =>
          player.id === id ? { ...player, ...updates } : player
        )
        queryClient.setQueryData<Player[]>(playerKeys.list(), optimisticPlayers)
      }

      // Optimistically update players with skill data
      if (previousPlayersWithSkillData) {
        const optimisticPlayers = previousPlayersWithSkillData.map((player) =>
          player.id === id ? { ...player, ...updates } : player
        )
        queryClient.setQueryData<StudentWithSkillData[]>(
          playerKeys.listWithSkillData(),
          optimisticPlayers
        )
      }

      return { previousPlayers, previousPlayersWithSkillData }
    },
    onError: (err, _variables, context) => {
      // Log error for debugging
      console.error('Failed to update player:', err.message)

      // Rollback on error
      if (context?.previousPlayers) {
        queryClient.setQueryData(playerKeys.list(), context.previousPlayers)
      }
      if (context?.previousPlayersWithSkillData) {
        queryClient.setQueryData(
          playerKeys.listWithSkillData(),
          context.previousPlayersWithSkillData
        )
      }
    },
    onSettled: (_data, _error, { id }) => {
      // Refetch after error or success - invalidate all player queries
      queryClient.invalidateQueries({ queryKey: playerKeys.all })
      if (_data) {
        queryClient.setQueryData(playerKeys.detail(id), _data)
      }
    },
  })
}

/**
 * Hook: Delete a player
 */
export function useDeletePlayer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deletePlayer,
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: playerKeys.lists() })

      // Snapshot previous value
      const previousPlayers = queryClient.getQueryData<Player[]>(playerKeys.list())

      // Optimistically remove from list
      if (previousPlayers) {
        const optimisticPlayers = previousPlayers.filter((player) => player.id !== id)
        queryClient.setQueryData<Player[]>(playerKeys.list(), optimisticPlayers)
      }

      return { previousPlayers }
    },
    onError: (_err, _id, context) => {
      // Rollback on error
      if (context?.previousPlayers) {
        queryClient.setQueryData(playerKeys.list(), context.previousPlayers)
      }
    },
    onSettled: () => {
      // Refetch after error or success
      // Invalidate ALL player queries (including listWithSkillData used by practice page)
      queryClient.invalidateQueries({ queryKey: playerKeys.all })
    },
  })
}

/**
 * Hook: Set player active status
 */
export function useSetPlayerActive() {
  const { mutate: updatePlayer } = useUpdatePlayer()

  return {
    setActive: (id: string, isActive: boolean) => {
      updatePlayer({ id, updates: { isActive } })
    },
  }
}

/**
 * Link to an existing child via family code
 */
interface LinkChildResult {
  success: boolean
  player?: Player
  error?: string
}

async function linkChild(familyCode: string): Promise<LinkChildResult> {
  const res = await api('family/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ familyCode }),
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    return { success: false, error: data.error || 'Failed to link child' }
  }
  return { success: true, player: data.player }
}

/**
 * Hook: Link to an existing child via family code
 */
export function useLinkChild() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: linkChild,
    onSuccess: (data) => {
      if (data.success) {
        // Invalidate ALL player queries to show the newly linked child
        // This includes both playerKeys.list() and playerKeys.listWithSkillData()
        queryClient.invalidateQueries({ queryKey: playerKeys.all })
      }
    },
  })
}
