'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'
import { practiceConfigKeys } from '@/lib/queryKeys'
import type { TermCountScalingConfig } from '@/lib/curriculum/config/term-count-scaling'

interface PracticeConfigResponse {
  config: TermCountScalingConfig
  isCustom: boolean
}

/**
 * Fetch practice config from the API
 */
async function fetchPracticeConfig(): Promise<PracticeConfigResponse> {
  const res = await api('settings/practice-config')
  if (!res.ok) throw new Error('Failed to fetch practice config')
  return res.json()
}

/**
 * Update practice config via the API
 */
async function updatePracticeConfig(
  config: TermCountScalingConfig
): Promise<PracticeConfigResponse> {
  const res = await api('settings/practice-config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to update practice config')
  }
  return res.json()
}

/**
 * Reset practice config to defaults via the API
 */
async function resetPracticeConfig(): Promise<PracticeConfigResponse> {
  const res = await api('settings/practice-config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: null }),
  })
  if (!res.ok) throw new Error('Failed to reset practice config')
  return res.json()
}

/**
 * Hook to fetch the saved practice config (term count scaling).
 */
export function usePracticeConfig() {
  return useQuery({
    queryKey: practiceConfigKeys.config(),
    queryFn: fetchPracticeConfig,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

/**
 * Hook to update the practice config.
 * Supports optimistic updates for immediate UI feedback.
 */
export function useUpdatePracticeConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updatePracticeConfig,
    onMutate: async (newConfig) => {
      await queryClient.cancelQueries({ queryKey: practiceConfigKeys.config() })

      const previous = queryClient.getQueryData<PracticeConfigResponse>(practiceConfigKeys.config())

      queryClient.setQueryData<PracticeConfigResponse>(practiceConfigKeys.config(), {
        config: newConfig,
        isCustom: true,
      })

      return { previous }
    },
    onError: (_err, _newConfig, context) => {
      if (context?.previous) {
        queryClient.setQueryData(practiceConfigKeys.config(), context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: practiceConfigKeys.config() })
    },
  })
}

/**
 * Hook to reset practice config to defaults.
 */
export function useResetPracticeConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: resetPracticeConfig,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: practiceConfigKeys.config() })
    },
  })
}
