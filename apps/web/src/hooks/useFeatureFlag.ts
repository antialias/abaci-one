'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { featureFlagKeys } from '@/lib/queryKeys'

export interface FlagValue {
  enabled: boolean
  config: unknown
}

export type FlagsResponse = {
  flags: Record<string, FlagValue>
}

const EMPTY_FLAGS: Record<string, FlagValue> = {}

async function fetchFlags(): Promise<FlagsResponse> {
  const res = await fetch('/api/feature-flags')
  if (!res.ok) throw new Error('Failed to fetch feature flags')
  return res.json()
}

/**
 * Hook to get all feature flags (bulk fetch).
 * Uses React Query with 60s stale time.
 */
export function useFeatureFlags() {
  const { data, isLoading } = useQuery({
    queryKey: featureFlagKeys.all,
    queryFn: fetchFlags,
    staleTime: 60_000,
  })

  return {
    flags: data?.flags ?? EMPTY_FLAGS,
    isLoading,
  }
}

/**
 * Hook to get a single feature flag by key.
 *
 * Performance: shares the bulk flags query (single HTTP request for all flags).
 * Uses React Query `select` to extract one flag, and `useMemo` on the return
 * value so consumers only re-render when `enabled` or `config` actually change.
 */
export function useFeatureFlag(key: string) {
  const { data, isLoading } = useQuery({
    queryKey: featureFlagKeys.all,
    queryFn: fetchFlags,
    staleTime: 60_000,
    select: (data) => data.flags[key] ?? null,
    // React Query uses referential equality on select output by default.
    // structuralSharing deep-compares the selected value so a refetch that
    // returns identical data won't produce a new reference.
    structuralSharing: true,
  })

  const enabled = data?.enabled ?? false
  const config = data?.config ?? null

  // Stable reference — only changes when the primitive `enabled` or
  // the structurally-shared `config` actually differ.
  return useMemo(() => ({ enabled, config, isLoading }), [enabled, config, isLoading])
}
