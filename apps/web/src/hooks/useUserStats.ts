'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'
import type { UserStats } from '@/db/schema/user-stats'

/**
 * Query key factory for user stats
 */
export const statsKeys = {
  all: ['user-stats'] as const,
  detail: () => [...statsKeys.all, 'detail'] as const,
}

/**
 * Fetch user statistics
 */
async function fetchUserStats(): Promise<UserStats> {
  const res = await api('user-stats')
  if (!res.ok) throw new Error('Failed to fetch user stats')
  const data = await res.json()
  return data.stats
}

/**
 * Update user statistics
 */
async function updateUserStats(
  updates: Partial<Omit<UserStats, 'userId'>>
): Promise<UserStats> {
  const res = await api('user-stats', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update user stats')
  const data = await res.json()
  return data.stats
}

/**
 * Hook: Fetch user statistics
 */
export function useUserStats() {
  return useQuery({
    queryKey: statsKeys.detail(),
    queryFn: fetchUserStats,
  })
}

/**
 * Hook: Update user statistics
 */
export function useUpdateUserStats() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateUserStats,
    onSuccess: (updatedStats) => {
      // Update cache with new stats
      queryClient.setQueryData(statsKeys.detail(), updatedStats)
    },
  })
}

/**
 * Hook: Increment games played
 */
export function useIncrementGamesPlayed() {
  const { data: stats } = useUserStats()
  const { mutate: updateStats } = useUpdateUserStats()

  return {
    incrementGamesPlayed: () => {
      if (stats) {
        updateStats({ gamesPlayed: stats.gamesPlayed + 1 })
      }
    },
  }
}

/**
 * Hook: Record a win
 */
export function useRecordWin() {
  const { data: stats } = useUserStats()
  const { mutate: updateStats } = useUpdateUserStats()

  return {
    recordWin: () => {
      if (stats) {
        updateStats({
          gamesPlayed: stats.gamesPlayed + 1,
          totalWins: stats.totalWins + 1,
        })
      }
    },
  }
}

/**
 * Hook: Update best time if faster
 */
export function useUpdateBestTime() {
  const { data: stats } = useUserStats()
  const { mutate: updateStats } = useUpdateUserStats()

  return {
    updateBestTime: (newTime: number) => {
      if (stats && (stats.bestTime === null || newTime < stats.bestTime)) {
        updateStats({ bestTime: newTime })
      }
    },
  }
}

/**
 * Hook: Update highest accuracy if better
 */
export function useUpdateHighestAccuracy() {
  const { data: stats } = useUserStats()
  const { mutate: updateStats } = useUpdateUserStats()

  return {
    updateHighestAccuracy: (newAccuracy: number) => {
      if (stats && newAccuracy > stats.highestAccuracy) {
        updateStats({ highestAccuracy: newAccuracy })
      }
    },
  }
}
