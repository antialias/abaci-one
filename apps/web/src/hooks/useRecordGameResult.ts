'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { GameResult, RecordGameResponse } from '@/lib/arcade/stats/types'
import { api } from '@/lib/queryClient'

/**
 * Hook to record a game result and update player stats
 *
 * Usage:
 * ```tsx
 * const { mutate: recordGame, isPending } = useRecordGameResult()
 *
 * recordGame(gameResult, {
 *   onSuccess: (updates) => {
 *     console.log('Stats recorded:', updates)
 *   }
 * })
 * ```
 */
export function useRecordGameResult() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (gameResult: GameResult): Promise<RecordGameResponse> => {
      const res = await api('player-stats/record-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameResult }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to record game result' }))
        throw new Error(error.error || 'Failed to record game result')
      }

      return res.json()
    },

    onSuccess: (response) => {
      // Invalidate player stats queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['player-stats'] })

      console.log('✅ Game result recorded successfully:', response.updates)
    },

    onError: (error) => {
      console.error('❌ Failed to record game result:', error)
    },
  })
}
