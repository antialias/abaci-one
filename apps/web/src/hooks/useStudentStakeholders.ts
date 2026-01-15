'use client'

import { useQuery } from '@tanstack/react-query'
import type { StudentStakeholders, ViewerRelationshipSummary } from '@/types/student'

/**
 * Response from the stakeholders API
 */
interface StakeholdersResponse {
  stakeholders: StudentStakeholders
  viewerRelationship: ViewerRelationshipSummary
}

/**
 * Query key factory for stakeholders queries
 */
export const stakeholdersKeys = {
  all: ['stakeholders'] as const,
  player: (playerId: string) => [...stakeholdersKeys.all, playerId] as const,
}

/**
 * Fetch stakeholders data for a player
 */
async function fetchStakeholders(playerId: string): Promise<StakeholdersResponse> {
  const response = await fetch(`/api/players/${playerId}/stakeholders`)
  if (!response.ok) {
    throw new Error('Failed to fetch stakeholders')
  }
  return response.json()
}

/**
 * Hook to get complete stakeholder information for a student
 *
 * Returns:
 * - stakeholders: All parents, classrooms, pending requests, presence
 * - viewerRelationship: Summary of the current user's relationship to this student
 *
 * @param playerId - The player/student ID
 * @param options - React Query options
 */
export function useStudentStakeholders(
  playerId: string | null | undefined,
  options?: {
    enabled?: boolean
    staleTime?: number
    refetchInterval?: number | false
  }
) {
  return useQuery({
    queryKey: stakeholdersKeys.player(playerId ?? ''),
    queryFn: () => fetchStakeholders(playerId!),
    enabled: !!playerId && options?.enabled !== false,
    staleTime: options?.staleTime ?? 30_000, // 30 seconds
    refetchInterval: options?.refetchInterval,
  })
}

/**
 * Simplified hook that only returns stakeholders (without loading/error states)
 * Useful for components that only need the data when available
 */
export function useStakeholdersData(playerId: string | null | undefined) {
  const { data } = useStudentStakeholders(playerId)
  return {
    stakeholders: data?.stakeholders ?? null,
    viewerRelationship: data?.viewerRelationship ?? null,
  }
}
