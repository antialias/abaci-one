/**
 * Hook for fetching the next skill a student should learn
 *
 * This hook is used by the StartPracticeModal to show a tutorial gate
 * when a new skill is ready to be unlocked.
 */

import { useQuery } from '@tanstack/react-query'
import type { SkillSuggestion } from '@/lib/curriculum/skill-unlock'

interface NextSkillResponse {
  suggestion: SkillSuggestion | null
}

export const nextSkillKeys = {
  all: ['nextSkill'] as const,
  forPlayer: (playerId: string) => [...nextSkillKeys.all, playerId] as const,
}

/**
 * Fetch the next skill the student should learn.
 * Returns null if no new skill is available (student is working on current skills).
 */
async function fetchNextSkillToLearn(playerId: string): Promise<SkillSuggestion | null> {
  const response = await fetch(`/api/curriculum/${playerId}/next-skill`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to fetch next skill')
  }

  const data: NextSkillResponse = await response.json()
  return data.suggestion
}

/**
 * Hook to get the next skill the student should learn.
 *
 * @param playerId - The player ID
 * @param enabled - Whether to enable the query (default: true)
 * @returns Query result with suggestion or null
 */
export function useNextSkillToLearn(playerId: string, enabled = true) {
  return useQuery({
    queryKey: nextSkillKeys.forPlayer(playerId),
    queryFn: () => fetchNextSkillToLearn(playerId),
    enabled: enabled && !!playerId,
    staleTime: 30_000, // 30 seconds - skill state doesn't change frequently
    refetchOnWindowFocus: false,
  })
}
