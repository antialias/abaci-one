'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'
import type { Player } from '@/db/schema/players'

/**
 * Query key factory for players
 */
export const playerKeys = {
  all: ['players'] as const,
  lists: () => [...playerKeys.all, 'list'] as const,
  list: () => [...playerKeys.lists()] as const,
  detail: (id: string) => [...playerKeys.all, 'detail', id] as const,
}

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
  if (!res.ok) throw new Error('Failed to update player')
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
 * Hook: Create a new player
 */
export function useCreatePlayer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createPlayer,
    onSuccess: () => {
      // Invalidate and refetch players list
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
    onSuccess: (updatedPlayer) => {
      // Invalidate players list
      queryClient.invalidateQueries({ queryKey: playerKeys.lists() })
      // Update detail cache if it exists
      queryClient.setQueryData(playerKeys.detail(updatedPlayer.id), updatedPlayer)
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
    onSuccess: () => {
      // Invalidate players list
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
