'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { billingKeys } from '@/lib/queryKeys'
import type { TierName, DurationOption } from '@/lib/tier-limits'

export interface TierLimitsResponse {
  maxPracticeStudents: number | null // null = unlimited
  maxSessionMinutes: DurationOption
  maxSessionsPerWeek: number | null // null = unlimited
  maxOfflineParsingPerMonth: number
}

export interface TierResponse {
  tier: TierName
  limits: TierLimitsResponse
}

const DEFAULT_TIER: TierResponse = {
  tier: 'guest',
  limits: {
    maxPracticeStudents: 1,
    maxSessionMinutes: 10,
    maxSessionsPerWeek: null,
    maxOfflineParsingPerMonth: 3,
  },
}

async function fetchTier(): Promise<TierResponse> {
  const res = await fetch('/api/billing/tier')
  if (!res.ok) throw new Error('Failed to fetch tier')
  return res.json()
}

/**
 * Hook to get the current user's subscription tier and limits.
 *
 * Prefetched server-side in root layout — no extra request on initial load.
 * Revalidates in background after 60s stale time.
 */
export function useTier() {
  const { data, isLoading } = useQuery({
    queryKey: billingKeys.tier(),
    queryFn: fetchTier,
    staleTime: 60_000,
  })

  return useMemo(
    () => ({
      tier: data?.tier ?? DEFAULT_TIER.tier,
      limits: data?.limits ?? DEFAULT_TIER.limits,
      isLoading,
    }),
    [data?.tier, data?.limits, isLoading]
  )
}
