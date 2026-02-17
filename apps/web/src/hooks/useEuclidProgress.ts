'use client'

import { useCallback, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'
import { euclidKeys } from '@/lib/queryKeys'

const EMPTY_COMPLETED: number[] = []

/**
 * Fetch completed proposition IDs for a player.
 * Returns an empty array when playerId is null (anonymous mode).
 */
export function useEuclidProgress(playerId: string | null) {
  return useQuery({
    queryKey: playerId ? euclidKeys.progress(playerId) : euclidKeys.all,
    queryFn: async () => {
      if (!playerId) return EMPTY_COMPLETED
      const res = await api(`euclid/progress/${playerId}`)
      if (!res.ok) throw new Error('Failed to fetch euclid progress')
      const data = await res.json()
      return data.completed as number[]
    },
    enabled: !!playerId,
  })
}

/**
 * Mark a proposition as completed for a player.
 * Returns the full updated list of completed proposition IDs.
 */
export function useMarkEuclidComplete(playerId: string | null) {
  const queryClient = useQueryClient()
  const playerIdRef = useRef(playerId)
  playerIdRef.current = playerId

  const mutationFn = useCallback(async (propositionId: number) => {
    const pid = playerIdRef.current
    if (!pid) throw new Error('No player selected')
    const res = await api(`euclid/progress/${pid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propositionId }),
    })
    if (!res.ok) throw new Error('Failed to mark proposition complete')
    const data = await res.json()
    return data.completed as number[]
  }, [])

  return useMutation({
    mutationFn,
    onSuccess: (completed) => {
      const pid = playerIdRef.current
      if (pid) {
        queryClient.setQueryData(euclidKeys.progress(pid), completed)
      }
    },
  })
}
