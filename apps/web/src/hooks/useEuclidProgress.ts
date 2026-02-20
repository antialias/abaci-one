'use client'

import { useCallback, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'
import { euclidKeys } from '@/lib/queryKeys'

const EMPTY_COMPLETED: number[] = []

/**
 * Fetch completed proposition IDs for a player.
 * Returns an empty array when playerId is null (anonymous mode).
 * In anonymous mode the query is disabled but placeholderData ensures
 * `data` is always `[]` (not `undefined`). Completions written to the
 * cache by useMarkEuclidComplete are returned on subsequent reads.
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
    placeholderData: playerId ? undefined : EMPTY_COMPLETED,
  })
}

/**
 * Mark a proposition as completed.
 * With a player: persists to the server and updates the cache.
 * Anonymous (no player): updates only the React Query cache so
 * completions survive client-side navigation within the session.
 */
export function useMarkEuclidComplete(playerId: string | null) {
  const queryClient = useQueryClient()
  const playerIdRef = useRef(playerId)
  playerIdRef.current = playerId

  const mutationFn = useCallback(
    async (propositionId: number) => {
      const pid = playerIdRef.current
      if (!pid) {
        // Anonymous mode: accumulate in the query cache (no server call)
        const current = queryClient.getQueryData<number[]>(euclidKeys.all) ?? []
        return current.includes(propositionId) ? current : [...current, propositionId]
      }
      const res = await api(`euclid/progress/${pid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propositionId }),
      })
      if (!res.ok) throw new Error('Failed to mark proposition complete')
      const data = await res.json()
      return data.completed as number[]
    },
    [queryClient]
  )

  return useMutation({
    mutationFn,
    onSuccess: (completed) => {
      const pid = playerIdRef.current
      const key = pid ? euclidKeys.progress(pid) : euclidKeys.all
      queryClient.setQueryData(key, completed)
    },
  })
}
