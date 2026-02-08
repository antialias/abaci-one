/**
 * Hook for fetching the session mode for a student
 *
 * This is the single source of truth for session planning decisions.
 * It replaces the separate useNextSkillToLearn hook and local BKT computations.
 *
 * The session mode determines:
 * - Dashboard banner content
 * - StartPracticeModal CTA
 * - Session planner problem generation
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import type { SessionModeResponse } from '@/app/api/curriculum/[playerId]/session-mode/route'

export const sessionModeKeys = {
  all: ['sessionMode'] as const,
  forPlayer: (playerId: string) => [...sessionModeKeys.all, playerId] as const,
}

export interface SessionModeWithComfort {
  sessionMode: SessionMode
  comfortLevel: number
}

/**
 * Fetch the session mode for a player
 */
async function fetchSessionMode(playerId: string): Promise<SessionModeWithComfort> {
  const response = await fetch(`/api/curriculum/${playerId}/session-mode`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to fetch session mode')
  }

  const data: SessionModeResponse = await response.json()
  return {
    sessionMode: data.sessionMode,
    comfortLevel: data.comfortLevel,
  }
}

/**
 * Hook to get the session mode for a student.
 *
 * Returns one of three modes:
 * - remediation: Student has weak skills that need strengthening
 * - progression: Student is ready to learn a new skill
 * - maintenance: All skills are strong, mixed practice
 *
 * @param playerId - The player ID
 * @param enabled - Whether to enable the query (default: true)
 * @returns Query result with session mode
 */
export function useSessionMode(playerId: string, enabled = true) {
  return useQuery({
    queryKey: sessionModeKeys.forPlayer(playerId),
    queryFn: () => fetchSessionMode(playerId),
    enabled: enabled && !!playerId,
    staleTime: 30_000, // 30 seconds - skill state doesn't change frequently
    refetchOnWindowFocus: false,
  })
}

/**
 * Prefetch session mode for SSR
 */
export function prefetchSessionMode(playerId: string) {
  return {
    queryKey: sessionModeKeys.forPlayer(playerId),
    queryFn: () => fetchSessionMode(playerId),
  }
}

/**
 * Mutation to defer progression for a skill.
 * Invalidates the session mode query so the UI updates immediately.
 */
export function useDeferProgression(playerId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (skillId: string) => {
      const response = await fetch(`/api/curriculum/${playerId}/defer-progression`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to defer progression')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionModeKeys.forPlayer(playerId) })
    },
  })
}
