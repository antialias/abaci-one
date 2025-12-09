'use client'

import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import type { Player } from '@/db/schema/players'
import { api } from '@/lib/queryClient'
import { playerKeys } from '@/lib/queryKeys'

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
 * Create a new player
 */
async function createPlayer(
  newPlayer: Pick<Player, 'name' | 'emoji' | 'color'> & { isActive?: boolean }
): Promise<Player> {
  const res = await api('players', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newPlayer),
  })
  if (!res.ok) throw new Error('Failed to create player')
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
  updates: Partial<Pick<Player, 'name' | 'emoji' | 'color' | 'isActive'>>
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
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: playerKeys.lists() })

      // Snapshot previous value
      const previousPlayers = queryClient.getQueryData<Player[]>(playerKeys.list())

      // Optimistically update to new value
      if (previousPlayers) {
        const optimisticPlayer: Player = {
          id: `temp-${Date.now()}`, // Temporary ID
          ...newPlayer,
          createdAt: new Date(),
          isActive: newPlayer.isActive ?? false,
          userId: 'temp-user', // Temporary userId, will be replaced by server response
          helpSettings: null, // Will be set by server with default values
        }
        queryClient.setQueryData<Player[]>(playerKeys.list(), [
          ...previousPlayers,
          optimisticPlayer,
        ])
      }

      return { previousPlayers }
    },
    onError: (_err, _newPlayer, context) => {
      // Rollback on error
      if (context?.previousPlayers) {
        queryClient.setQueryData(playerKeys.list(), context.previousPlayers)
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: playerKeys.lists() })
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
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: playerKeys.lists() })

      // Snapshot previous value
      const previousPlayers = queryClient.getQueryData<Player[]>(playerKeys.list())

      // Optimistically update
      if (previousPlayers) {
        const optimisticPlayers = previousPlayers.map((player) =>
          player.id === id ? { ...player, ...updates } : player
        )
        queryClient.setQueryData<Player[]>(playerKeys.list(), optimisticPlayers)
      }

      return { previousPlayers }
    },
    onError: (err, _variables, context) => {
      // Log error for debugging
      console.error('Failed to update player:', err.message)

      // Rollback on error
      if (context?.previousPlayers) {
        queryClient.setQueryData(playerKeys.list(), context.previousPlayers)
      }
    },
    onSettled: (_data, _error, { id }) => {
      // Refetch after error or success
      queryClient.invalidateQueries({ queryKey: playerKeys.lists() })
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
      queryClient.invalidateQueries({ queryKey: playerKeys.lists() })
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
