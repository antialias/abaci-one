'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PlayerSessionPreferencesConfig } from '@/db/schema/player-session-preferences'
import { api } from '@/lib/queryClient'
import { sessionPreferencesKeys } from '@/lib/queryKeys'

interface SessionPreferencesResponse {
  preferences: PlayerSessionPreferencesConfig | null
}

async function fetchSessionPreferences(
  playerId: string
): Promise<PlayerSessionPreferencesConfig | null> {
  const res = await api(`curriculum/${playerId}/session-preferences`)
  if (!res.ok) throw new Error('Failed to fetch session preferences')
  const data: SessionPreferencesResponse = await res.json()
  return data.preferences
}

async function saveSessionPreferences(
  playerId: string,
  preferences: PlayerSessionPreferencesConfig
): Promise<PlayerSessionPreferencesConfig> {
  const res = await api(`curriculum/${playerId}/session-preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preferences }),
  })
  if (!res.ok) throw new Error('Failed to save session preferences')
  const data: SessionPreferencesResponse = await res.json()
  return data.preferences!
}

/**
 * Hook: Fetch persisted session preferences for a student
 */
export function usePlayerSessionPreferences(playerId: string | null) {
  return useQuery({
    queryKey: sessionPreferencesKeys.detail(playerId ?? 'anonymous'),
    queryFn: () => fetchSessionPreferences(playerId as string),
    enabled: Boolean(playerId),
    // Preferences don't change often — keep stale longer
    staleTime: 1000 * 60 * 30,
  })
}

/**
 * Hook: Save session preferences with optimistic update
 */
export function useSavePlayerSessionPreferences(playerId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (preferences: PlayerSessionPreferencesConfig) =>
      saveSessionPreferences(playerId, preferences),
    onMutate: async (preferences) => {
      await queryClient.cancelQueries({
        queryKey: sessionPreferencesKeys.detail(playerId),
      })

      const previous = queryClient.getQueryData<PlayerSessionPreferencesConfig | null>(
        sessionPreferencesKeys.detail(playerId)
      )

      queryClient.setQueryData(sessionPreferencesKeys.detail(playerId), preferences)

      return { previous }
    },
    onError: (_err, _prefs, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(sessionPreferencesKeys.detail(playerId), context.previous)
      }
    },
    onSettled: (savedPreferences) => {
      if (savedPreferences) {
        queryClient.setQueryData(sessionPreferencesKeys.detail(playerId), savedPreferences)
      }
    },
  })
}
