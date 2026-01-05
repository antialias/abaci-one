'use client'

import { useQuery } from '@tanstack/react-query'
import type {
  GetAllPlayerStatsResponse,
  GetPlayerStatsResponse,
  PlayerStatsData,
} from '@/lib/arcade/stats/types'
import { api } from '@/lib/queryClient'

/**
 * Hook to fetch stats for a specific player or all user's players
 *
 * Usage:
 * ```tsx
 * // Fetch all players' stats
 * const { data, isLoading } = usePlayerStats()
 * // data is PlayerStatsData[]
 *
 * // Fetch specific player's stats
 * const { data, isLoading } = usePlayerStats('player-id')
 * // data is PlayerStatsData
 * ```
 */
export function usePlayerStats(playerId?: string) {
  return useQuery<PlayerStatsData | PlayerStatsData[]>({
    queryKey: playerId ? ['player-stats', playerId] : ['player-stats'],
    queryFn: async () => {
      const url = playerId ? `player-stats/${playerId}` : 'player-stats'

      const res = await api(url)
      if (!res.ok) {
        throw new Error('Failed to fetch player stats')
      }

      const data: GetPlayerStatsResponse | GetAllPlayerStatsResponse = await res.json()

      // Return single player stats or array of all stats
      return 'stats' in data ? data.stats : data.playerStats
    },
  })
}

/**
 * Hook to fetch stats for all user's players (typed as array)
 *
 * Convenience wrapper around usePlayerStats() with better typing.
 */
export function useAllPlayerStats() {
  const query = useQuery<PlayerStatsData[]>({
    queryKey: ['player-stats'],
    queryFn: async () => {
      const res = await api('player-stats')
      if (!res.ok) {
        throw new Error('Failed to fetch player stats')
      }

      const data: GetAllPlayerStatsResponse = await res.json()
      return data.playerStats
    },
  })

  return query
}

/**
 * Hook to fetch stats for a specific player (typed as single object)
 *
 * Convenience wrapper around usePlayerStats() with better typing.
 */
export function useSinglePlayerStats(playerId: string) {
  const query = useQuery<PlayerStatsData>({
    queryKey: ['player-stats', playerId],
    queryFn: async () => {
      const res = await api(`player-stats/${playerId}`)
      if (!res.ok) {
        throw new Error('Failed to fetch player stats')
      }

      const data: GetPlayerStatsResponse = await res.json()
      return data.stats
    },
    enabled: !!playerId, // Only run if playerId is provided
  })

  return query
}
