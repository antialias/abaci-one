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

export interface EffectiveTierResponse extends TierResponse {
  /** Non-null when a different parent provides the best tier for this student. */
  providedBy: { name: string } | null
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

const DEFAULT_EFFECTIVE: EffectiveTierResponse = {
  ...DEFAULT_TIER,
  providedBy: null,
}

async function fetchEffectiveTier(playerId: string): Promise<EffectiveTierResponse> {
  const res = await fetch(`/api/players/${playerId}/effective-tier`)
  if (!res.ok) throw new Error('Failed to fetch effective tier')
  return res.json()
}

/**
 * Hook to get the effective subscription tier for a *student*,
 * considering all linked parents' plans (not just the logged-in user).
 *
 * Use this in student-scoped UI (StartPracticeModal, DurationSelector)
 * instead of `useTier()` which only returns the acting user's own tier.
 */
export function useEffectiveTier(playerId: string) {
  const { data, isLoading } = useQuery({
    queryKey: billingKeys.effectiveTier(playerId),
    queryFn: () => fetchEffectiveTier(playerId),
    staleTime: 60_000,
  })

  return useMemo(
    () => ({
      tier: data?.tier ?? DEFAULT_EFFECTIVE.tier,
      limits: data?.limits ?? DEFAULT_EFFECTIVE.limits,
      providedBy: data?.providedBy ?? null,
      isLoading,
    }),
    [data?.tier, data?.limits, data?.providedBy, isLoading]
  )
}
