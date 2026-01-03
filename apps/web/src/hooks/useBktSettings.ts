'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'

/** Query key for BKT settings */
export const bktSettingsKeys = {
  all: ['bkt-settings'] as const,
  threshold: () => [...bktSettingsKeys.all, 'threshold'] as const,
}

interface BktSettingsResponse {
  bktConfidenceThreshold: number
}

/**
 * Fetch BKT settings from the API
 */
async function fetchBktSettings(): Promise<BktSettingsResponse> {
  const res = await api('settings/bkt')
  if (!res.ok) throw new Error('Failed to fetch BKT settings')
  return res.json()
}

/**
 * Update BKT settings via the API
 */
async function updateBktSettings(threshold: number): Promise<BktSettingsResponse> {
  const res = await api('settings/bkt', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bktConfidenceThreshold: threshold }),
  })
  if (!res.ok) throw new Error('Failed to update BKT settings')
  return res.json()
}

/**
 * Hook to fetch the saved BKT confidence threshold.
 *
 * Uses a long stale time since this setting rarely changes.
 */
export function useBktSettings() {
  return useQuery({
    queryKey: bktSettingsKeys.threshold(),
    queryFn: fetchBktSettings,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  })
}

/**
 * Hook to update the saved BKT confidence threshold.
 *
 * Supports optimistic updates for immediate UI feedback.
 */
export function useUpdateBktSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateBktSettings,
    // Optimistic update
    onMutate: async (newThreshold) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: bktSettingsKeys.threshold(),
      })

      // Snapshot the previous value
      const previousSettings = queryClient.getQueryData<BktSettingsResponse>(
        bktSettingsKeys.threshold()
      )

      // Optimistically update to the new value
      queryClient.setQueryData<BktSettingsResponse>(bktSettingsKeys.threshold(), {
        bktConfidenceThreshold: newThreshold,
      })

      // Return context with the previous value
      return { previousSettings }
    },
    // If the mutation fails, roll back to the previous value
    onError: (_err, _newThreshold, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(bktSettingsKeys.threshold(), context.previousSettings)
      }
    },
    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: bktSettingsKeys.threshold() })
    },
  })
}
