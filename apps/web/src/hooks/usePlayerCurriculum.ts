/**
 * Hook for managing player curriculum progress
 *
 * Provides access to curriculum position, skill mastery, and practice sessions
 * for the currently selected student (player).
 *
 * Uses React Query for data fetching and caching, enabling SSR prefetching.
 */

'use client'

import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import type { FluencyState } from '@/db/schema/player-skill-mastery'
import { api } from '@/lib/queryClient'
import { curriculumKeys } from '@/lib/queryKeys'

// Re-export query keys for consumers
export { curriculumKeys } from '@/lib/queryKeys'

// ============================================================================
// Types
// ============================================================================

export interface CurriculumPosition {
  playerId: string
  currentLevel: number
  currentPhaseId: string
  worksheetPreset: string | null
  visualizationMode: boolean
}

export interface SkillMasteryData {
  skillId: string
  attempts: number
  correct: number
  consecutiveCorrect: number
  /** Whether this skill is in the student's active practice rotation */
  isPracticing: boolean
  lastPracticedAt: Date | null
}

export interface PracticeSessionData {
  id: string
  phaseId: string
  problemsAttempted: number
  problemsCorrect: number
  skillsUsed: string[]
  visualizationMode: boolean
  startedAt: Date
  completedAt: Date | null
}

export interface CurriculumData {
  curriculum: CurriculumPosition | null
  skills: SkillMasteryData[]
  recentSessions: PracticeSessionData[]
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchCurriculum(playerId: string): Promise<CurriculumData> {
  const response = await api(`curriculum/${playerId}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch curriculum: ${response.statusText}`)
  }

  const data = await response.json()

  return {
    curriculum: data.curriculum,
    skills: data.skills || [],
    recentSessions: data.recentSessions || [],
  }
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for fetching curriculum data (useQuery version)
 * Use this when you need loading/error states
 */
export function usePlayerCurriculumQuery(playerId: string | null) {
  return useQuery({
    queryKey: curriculumKeys.detail(playerId ?? ''),
    queryFn: () => fetchCurriculum(playerId!),
    enabled: !!playerId,
  })
}

/**
 * Hook for fetching curriculum data (useSuspenseQuery version)
 * Use this in SSR contexts where data is prefetched
 */
export function usePlayerCurriculumSuspense(playerId: string) {
  return useSuspenseQuery({
    queryKey: curriculumKeys.detail(playerId),
    queryFn: () => fetchCurriculum(playerId),
  })
}

/**
 * Hook for curriculum mutations (advance phase, record attempts, etc.)
 */
export function usePlayerCurriculumMutations(playerId: string | null) {
  const queryClient = useQueryClient()

  const invalidate = () => {
    if (playerId) {
      queryClient.invalidateQueries({ queryKey: curriculumKeys.detail(playerId) })
    }
  }

  // Advance to next phase
  const advancePhase = useMutation({
    mutationFn: async ({ nextPhaseId, nextLevel }: { nextPhaseId: string; nextLevel?: number }) => {
      if (!playerId) throw new Error('No player selected')

      const response = await api(`curriculum/${playerId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextPhaseId, nextLevel }),
      })

      if (!response.ok) {
        throw new Error(`Failed to advance phase: ${response.statusText}`)
      }

      return response.json()
    },
    onSuccess: invalidate,
  })

  // Record a single skill attempt
  const recordAttempt = useMutation({
    mutationFn: async ({ skillId, isCorrect }: { skillId: string; isCorrect: boolean }) => {
      if (!playerId) throw new Error('No player selected')

      const response = await api(`curriculum/${playerId}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId, isCorrect }),
      })

      if (!response.ok) {
        throw new Error(`Failed to record attempt: ${response.statusText}`)
      }

      return response.json()
    },
    onSuccess: (updatedSkill) => {
      // Optimistically update the skill in cache
      if (playerId) {
        queryClient.setQueryData<CurriculumData>(curriculumKeys.detail(playerId), (old) => {
          if (!old) return old
          return {
            ...old,
            skills: old.skills.some((s) => s.skillId === updatedSkill.skillId)
              ? old.skills.map((s) => (s.skillId === updatedSkill.skillId ? updatedSkill : s))
              : [...old.skills, updatedSkill],
          }
        })
      }
    },
  })

  // Record multiple skill attempts
  const recordAttempts = useMutation({
    mutationFn: async (results: Array<{ skillId: string; isCorrect: boolean }>) => {
      if (!playerId) throw new Error('No player selected')

      const response = await api(`curriculum/${playerId}/skills/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results }),
      })

      if (!response.ok) {
        throw new Error(`Failed to record attempts: ${response.statusText}`)
      }

      return response.json()
    },
    onSuccess: invalidate,
  })

  // Start a practice session
  const startSession = useMutation({
    mutationFn: async ({
      phaseId,
      visualizationMode = false,
    }: {
      phaseId: string
      visualizationMode?: boolean
    }) => {
      if (!playerId) throw new Error('No player selected')

      const response = await api(`curriculum/${playerId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phaseId, visualizationMode }),
      })

      if (!response.ok) {
        throw new Error(`Failed to start session: ${response.statusText}`)
      }

      return response.json()
    },
    onSuccess: (session) => {
      if (playerId) {
        queryClient.setQueryData<CurriculumData>(curriculumKeys.detail(playerId), (old) => {
          if (!old) return old
          return {
            ...old,
            recentSessions: [session, ...old.recentSessions].slice(0, 10),
          }
        })
      }
    },
  })

  // Complete a practice session
  const completeSession = useMutation({
    mutationFn: async ({
      sessionId,
      data,
    }: {
      sessionId: string
      data?: {
        problemsAttempted?: number
        problemsCorrect?: number
        skillsUsed?: string[]
      }
    }) => {
      if (!playerId) throw new Error('No player selected')

      const response = await api(`curriculum/${playerId}/sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data || {}),
      })

      if (!response.ok) {
        throw new Error(`Failed to complete session: ${response.statusText}`)
      }

      return response.json()
    },
    onSuccess: invalidate,
  })

  // Update curriculum settings (worksheet preset, visualization mode)
  const updateSettings = useMutation({
    mutationFn: async (settings: {
      worksheetPreset?: string | null
      visualizationMode?: boolean
    }) => {
      if (!playerId) throw new Error('No player selected')

      const response = await api(`curriculum/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        throw new Error(`Failed to update settings: ${response.statusText}`)
      }

      return response.json()
    },
    onSuccess: (updated) => {
      if (playerId) {
        queryClient.setQueryData<CurriculumData>(curriculumKeys.detail(playerId), (old) => {
          if (!old) return old
          return { ...old, curriculum: updated }
        })
      }
    },
  })

  return {
    advancePhase,
    recordAttempt,
    recordAttempts,
    startSession,
    completeSession,
    updateSettings,
  }
}

/**
 * Combined hook that provides both query and mutations
 * This maintains backwards compatibility with existing code
 */
export function usePlayerCurriculum(playerId: string | null) {
  const query = usePlayerCurriculumQuery(playerId)
  const mutations = usePlayerCurriculumMutations(playerId)
  const queryClient = useQueryClient()

  // Refresh function for backwards compatibility
  const refresh = async () => {
    if (playerId) {
      await queryClient.invalidateQueries({ queryKey: curriculumKeys.detail(playerId) })
    }
  }

  // Convenience wrappers for backwards compatibility
  const advancePhase = async (nextPhaseId: string, nextLevel?: number) => {
    await mutations.advancePhase.mutateAsync({ nextPhaseId, nextLevel })
  }

  const recordAttempt = async (skillId: string, isCorrect: boolean) => {
    await mutations.recordAttempt.mutateAsync({ skillId, isCorrect })
  }

  const recordAttempts = async (results: Array<{ skillId: string; isCorrect: boolean }>) => {
    await mutations.recordAttempts.mutateAsync(results)
  }

  const startSession = async (
    phaseId: string,
    visualizationMode: boolean = false
  ): Promise<string | null> => {
    try {
      const session = await mutations.startSession.mutateAsync({ phaseId, visualizationMode })
      return session.id
    } catch {
      return null
    }
  }

  const completeSession = async (
    sessionId: string,
    data?: {
      problemsAttempted?: number
      problemsCorrect?: number
      skillsUsed?: string[]
    }
  ) => {
    await mutations.completeSession.mutateAsync({ sessionId, data })
  }

  const updateWorksheetPreset = async (preset: string | null) => {
    await mutations.updateSettings.mutateAsync({ worksheetPreset: preset })
  }

  const toggleVisualizationMode = async () => {
    const current = query.data?.curriculum?.visualizationMode ?? false
    await mutations.updateSettings.mutateAsync({ visualizationMode: !current })
  }

  return {
    // Data from query
    curriculum: query.data?.curriculum ?? null,
    skills: query.data?.skills ?? [],
    recentSessions: query.data?.recentSessions ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,

    // Actions
    refresh,
    advancePhase,
    recordAttempt,
    recordAttempts,
    startSession,
    completeSession,
    updateWorksheetPreset,
    toggleVisualizationMode,
  }
}

export default usePlayerCurriculum
