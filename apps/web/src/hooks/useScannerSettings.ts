'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'
import type { QuadDetectorConfig } from '@/lib/vision/quadDetector'

/**
 * Scanner settings as returned by API (QuadDetectorConfig format)
 */
export type ScannerConfig = Pick<
  QuadDetectorConfig,
  | 'preprocessing'
  | 'enableHistogramEqualization'
  | 'enableAdaptiveThreshold'
  | 'enableMorphGradient'
  | 'cannyThresholds'
  | 'adaptiveBlockSize'
  | 'adaptiveC'
  | 'enableHoughLines'
>

/**
 * Query key factory for scanner settings
 */
export const scannerSettingsKeys = {
  all: ['scanner-settings'] as const,
  detail: () => [...scannerSettingsKeys.all, 'detail'] as const,
}

/**
 * Fetch scanner settings
 */
async function fetchScannerSettings(): Promise<ScannerConfig> {
  const res = await api('scanner-settings')
  if (!res.ok) throw new Error('Failed to fetch scanner settings')
  const data = await res.json()
  return data.settings
}

/**
 * Update scanner settings
 */
async function updateScannerSettings(updates: Partial<ScannerConfig>): Promise<ScannerConfig> {
  const res = await api('scanner-settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update scanner settings')
  const data = await res.json()
  return data.settings
}

/**
 * Hook: Fetch scanner settings
 */
export function useScannerSettings() {
  return useQuery({
    queryKey: scannerSettingsKeys.detail(),
    queryFn: fetchScannerSettings,
  })
}

/**
 * Hook: Update scanner settings
 *
 * Uses optimistic updates for instant UI feedback
 */
export function useUpdateScannerSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateScannerSettings,
    onMutate: async (updates) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: scannerSettingsKeys.detail(),
      })

      // Snapshot previous value
      const previousSettings = queryClient.getQueryData<ScannerConfig>(scannerSettingsKeys.detail())

      // Optimistically update
      if (previousSettings) {
        const optimisticSettings = { ...previousSettings, ...updates }
        queryClient.setQueryData<ScannerConfig>(scannerSettingsKeys.detail(), optimisticSettings)
      }

      return { previousSettings }
    },
    onError: (_err, _updates, context) => {
      // Rollback on error
      if (context?.previousSettings) {
        queryClient.setQueryData(scannerSettingsKeys.detail(), context.previousSettings)
      }
    },
    onSettled: (updatedSettings) => {
      // Update with server data on success
      if (updatedSettings) {
        queryClient.setQueryData(scannerSettingsKeys.detail(), updatedSettings)
      }
    },
  })
}
