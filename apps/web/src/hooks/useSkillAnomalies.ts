/**
 * Hook for fetching skill anomalies for teacher review
 *
 * Anomalies include:
 * - Skills that have been repeatedly skipped (student avoiding tutorials)
 * - Skills that are mastered but not being practiced (unusual state)
 */

import { useQuery } from '@tanstack/react-query'
import type { SkillAnomaly } from '@/lib/curriculum/skill-unlock'

interface AnomaliesResponse {
  anomalies: SkillAnomaly[]
}

export const skillAnomaliesKeys = {
  all: ['skillAnomalies'] as const,
  forPlayer: (playerId: string) => [...skillAnomaliesKeys.all, playerId] as const,
}

/**
 * Fetch skill anomalies for a student.
 * Returns anomalies that teachers may want to review.
 */
async function fetchSkillAnomalies(playerId: string): Promise<SkillAnomaly[]> {
  const response = await fetch(`/api/curriculum/${playerId}/anomalies`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to fetch skill anomalies')
  }

  const data: AnomaliesResponse = await response.json()
  return data.anomalies
}

/**
 * Hook to get skill anomalies for a student.
 *
 * @param playerId - The player ID
 * @param enabled - Whether to enable the query (default: true)
 * @returns Query result with anomalies array
 */
export function useSkillAnomalies(playerId: string, enabled = true) {
  return useQuery({
    queryKey: skillAnomaliesKeys.forPlayer(playerId),
    queryFn: () => fetchSkillAnomalies(playerId),
    enabled: enabled && !!playerId,
    staleTime: 60_000, // 1 minute - anomalies don't change frequently
    refetchOnWindowFocus: false,
  })
}
