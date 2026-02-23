'use client'

/**
 * React Query hook for session song status.
 *
 * Polls the song API when generation is in progress and listens
 * for Socket.IO events for instant notification when ready.
 */

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createSocket } from '@/lib/socket'
import { sessionSongKeys } from '@/lib/queryKeys'
import { api } from '@/lib/queryClient'

interface SessionSongData {
  id: string
  status: string
  title: string | null
  durationSeconds: number | null
  audioPath: string | null
  triggerSource: string | null
  createdAt: number | null
  completedAt: number | null
}

interface SessionSongResponse {
  song: SessionSongData | null
}

interface UseSessionSongOptions {
  playerId: string
  planId: string | undefined
  enabled?: boolean
}

export function useSessionSong({ playerId, planId, enabled = true }: UseSessionSongOptions) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: sessionSongKeys.forPlan(planId ?? ''),
    queryFn: async (): Promise<SessionSongResponse> => {
      const res = await api(`curriculum/${playerId}/sessions/plans/${planId}/song`)
      if (!res.ok) return { song: null }
      return res.json() as Promise<SessionSongResponse>
    },
    enabled: enabled && !!planId,
    // Poll every 5s while generating
    refetchInterval: (query) => {
      const song = query.state.data?.song
      if (!song) return false
      if (song.status === 'completed' || song.status === 'failed') return false
      return 5000
    },
  })

  // Listen for Socket.IO instant notification
  useEffect(() => {
    if (!planId || !enabled) return

    const socket = createSocket()

    const eventName = `session-song:ready:${planId}`
    socket.on(eventName, () => {
      queryClient.invalidateQueries({
        queryKey: sessionSongKeys.forPlan(planId),
      })
    })

    return () => {
      socket.off(eventName)
      socket.disconnect()
    }
  }, [planId, enabled, queryClient])

  const song = query.data?.song ?? null
  const isGenerating = !!song && song.status !== 'completed' && song.status !== 'failed'
  const isReady = song?.status === 'completed'
  const hasFailed = song?.status === 'failed'

  return {
    song,
    isGenerating,
    isReady,
    hasFailed,
    isLoading: query.isLoading,
  }
}
