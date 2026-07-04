/**
 * Hook for linear-readiness (L3): which skill categories have "aged out" onto
 * number sentences for a student, and the per-category teacher veto.
 *
 * Reads/writes `/api/curriculum/[playerId]/linear-veto`. All server state via React
 * Query (no `fetch()` in components, no `useState` for server data).
 */

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'
import { curriculumKeys, sessionPlanKeys } from '@/lib/queryKeys'
import type {
  LinearReadinessState,
  LinearReadyCategory,
} from '@/lib/curriculum/linear-readiness-service'

export type { LinearReadinessState, LinearReadyCategory }

async function fetchLinearReadiness(playerId: string): Promise<LinearReadinessState> {
  const response = await api(`curriculum/${playerId}/linear-veto`)
  if (!response.ok) {
    throw new Error(`Failed to load linear readiness: ${response.statusText}`)
  }
  return response.json()
}

/** Fetch the derived linear-ready categories + veto state for a student. */
export function useLinearReadiness(playerId: string | null) {
  return useQuery({
    queryKey: curriculumKeys.linearReadiness(playerId ?? ''),
    queryFn: () => fetchLinearReadiness(playerId!),
    enabled: !!playerId,
  })
}

/** Mutations to veto / un-veto a skill category off number sentences. */
export function useLinearReadinessVeto(playerId: string | null) {
  const queryClient = useQueryClient()

  const invalidate = () => {
    if (!playerId) return
    queryClient.invalidateQueries({ queryKey: curriculumKeys.linearReadiness(playerId) })
    // Re-planning depends on vetoes; refresh any session-plan views too.
    queryClient.invalidateQueries({ queryKey: sessionPlanKeys.list(playerId) })
  }

  const setVeto = useMutation({
    mutationFn: async ({ category, reason }: { category: string; reason?: string }) => {
      if (!playerId) throw new Error('No player selected')
      const response = await api(`curriculum/${playerId}/linear-veto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, reason }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to veto category')
      }
      return response.json()
    },
    onSuccess: invalidate,
  })

  const clearVeto = useMutation({
    mutationFn: async ({ category }: { category: string }) => {
      if (!playerId) throw new Error('No player selected')
      const response = await api(`curriculum/${playerId}/linear-veto`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to lift veto')
      }
      return response.json()
    },
    onSuccess: invalidate,
  })

  return { setVeto, clearVeto }
}
