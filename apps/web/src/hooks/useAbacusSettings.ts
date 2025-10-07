'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AbacusSettings } from '@/db/schema/abacus-settings'
import { api } from '@/lib/queryClient'

/**
 * Query key factory for abacus settings
 */
export const abacusSettingsKeys = {
  all: ['abacus-settings'] as const,
  detail: () => [...abacusSettingsKeys.all, 'detail'] as const,
}

/**
 * Fetch abacus display settings
 */
async function fetchAbacusSettings(): Promise<AbacusSettings> {
  const res = await api('abacus-settings')
  if (!res.ok) throw new Error('Failed to fetch abacus settings')
  const data = await res.json()
  return data.settings
}

/**
 * Update abacus display settings
 */
async function updateAbacusSettings(
  updates: Partial<Omit<AbacusSettings, 'userId'>>
): Promise<AbacusSettings> {
  const res = await api('abacus-settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update abacus settings')
  const data = await res.json()
  return data.settings
}

/**
 * Hook: Fetch abacus display settings
 */
export function useAbacusSettings() {
  return useQuery({
    queryKey: abacusSettingsKeys.detail(),
    queryFn: fetchAbacusSettings,
  })
}

/**
 * Hook: Update abacus display settings
 */
export function useUpdateAbacusSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateAbacusSettings,
    onMutate: async (updates) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: abacusSettingsKeys.detail() })

      // Snapshot previous value
      const previousSettings = queryClient.getQueryData<AbacusSettings>(abacusSettingsKeys.detail())

      // Optimistically update
      if (previousSettings) {
        const optimisticSettings = { ...previousSettings, ...updates }
        queryClient.setQueryData<AbacusSettings>(abacusSettingsKeys.detail(), optimisticSettings)
      }

      return { previousSettings }
    },
    onError: (_err, _updates, context) => {
      // Rollback on error
      if (context?.previousSettings) {
        queryClient.setQueryData(abacusSettingsKeys.detail(), context.previousSettings)
      }
    },
    onSettled: (updatedSettings) => {
      // Update with server data on success
      if (updatedSettings) {
        queryClient.setQueryData(abacusSettingsKeys.detail(), updatedSettings)
      }
    },
  })
}
