/**
 * Hook for managing player curriculum progress
 *
 * Provides access to curriculum position, skill mastery, and practice sessions
 * for the currently selected student (player).
 */

import { useCallback, useEffect, useState } from 'react'
import type { MasteryLevel } from '@/db/schema/player-skill-mastery'

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
  masteryLevel: MasteryLevel
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

export interface CurriculumState {
  curriculum: CurriculumPosition | null
  skills: SkillMasteryData[]
  recentSessions: PracticeSessionData[]
  isLoading: boolean
  error: string | null
}

export interface CurriculumActions {
  /** Refresh curriculum data from server */
  refresh: () => Promise<void>
  /** Advance to the next phase */
  advancePhase: (nextPhaseId: string, nextLevel?: number) => Promise<void>
  /** Record a skill attempt */
  recordAttempt: (skillId: string, isCorrect: boolean) => Promise<void>
  /** Record multiple skill attempts at once */
  recordAttempts: (results: Array<{ skillId: string; isCorrect: boolean }>) => Promise<void>
  /** Start a new practice session */
  startSession: (phaseId: string, visualizationMode?: boolean) => Promise<string | null>
  /** Complete the current practice session */
  completeSession: (
    sessionId: string,
    data?: {
      problemsAttempted?: number
      problemsCorrect?: number
      skillsUsed?: string[]
    }
  ) => Promise<void>
  /** Update worksheet preset */
  updateWorksheetPreset: (preset: string | null) => Promise<void>
  /** Toggle visualization mode */
  toggleVisualizationMode: () => Promise<void>
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing a player's curriculum progress
 *
 * @param playerId - The ID of the player (student) to manage
 * @returns Curriculum state and actions
 */
export function usePlayerCurriculum(playerId: string | null): CurriculumState & CurriculumActions {
  const [state, setState] = useState<CurriculumState>({
    curriculum: null,
    skills: [],
    recentSessions: [],
    isLoading: false,
    error: null,
  })

  // Fetch curriculum data
  const fetchCurriculum = useCallback(async () => {
    if (!playerId) {
      setState({
        curriculum: null,
        skills: [],
        recentSessions: [],
        isLoading: false,
        error: null,
      })
      return
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await fetch(`/api/curriculum/${playerId}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch curriculum: ${response.statusText}`)
      }

      const data = await response.json()

      setState({
        curriculum: data.curriculum,
        skills: data.skills || [],
        recentSessions: data.recentSessions || [],
        isLoading: false,
        error: null,
      })
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }))
    }
  }, [playerId])

  // Initial fetch
  useEffect(() => {
    fetchCurriculum()
  }, [fetchCurriculum])

  // Advance to next phase
  const advancePhase = useCallback(
    async (nextPhaseId: string, nextLevel?: number) => {
      if (!playerId) return

      try {
        const response = await fetch(`/api/curriculum/${playerId}/advance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nextPhaseId, nextLevel }),
        })

        if (!response.ok) {
          throw new Error(`Failed to advance phase: ${response.statusText}`)
        }

        await fetchCurriculum()
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Unknown error',
        }))
      }
    },
    [playerId, fetchCurriculum]
  )

  // Record a single skill attempt
  const recordAttempt = useCallback(
    async (skillId: string, isCorrect: boolean) => {
      if (!playerId) return

      try {
        const response = await fetch(`/api/curriculum/${playerId}/skills`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skillId, isCorrect }),
        })

        if (!response.ok) {
          throw new Error(`Failed to record attempt: ${response.statusText}`)
        }

        // Update local state with new skill data
        const updatedSkill = await response.json()
        setState((prev) => ({
          ...prev,
          skills: prev.skills.some((s) => s.skillId === skillId)
            ? prev.skills.map((s) => (s.skillId === skillId ? updatedSkill : s))
            : [...prev.skills, updatedSkill],
        }))
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Unknown error',
        }))
      }
    },
    [playerId]
  )

  // Record multiple skill attempts
  const recordAttempts = useCallback(
    async (results: Array<{ skillId: string; isCorrect: boolean }>) => {
      if (!playerId) return

      try {
        const response = await fetch(`/api/curriculum/${playerId}/skills/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ results }),
        })

        if (!response.ok) {
          throw new Error(`Failed to record attempts: ${response.statusText}`)
        }

        await fetchCurriculum()
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Unknown error',
        }))
      }
    },
    [playerId, fetchCurriculum]
  )

  // Start a practice session
  const startSession = useCallback(
    async (phaseId: string, visualizationMode: boolean = false): Promise<string | null> => {
      if (!playerId) return null

      try {
        const response = await fetch(`/api/curriculum/${playerId}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phaseId, visualizationMode }),
        })

        if (!response.ok) {
          throw new Error(`Failed to start session: ${response.statusText}`)
        }

        const session = await response.json()
        setState((prev) => ({
          ...prev,
          recentSessions: [session, ...prev.recentSessions].slice(0, 10),
        }))

        return session.id
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Unknown error',
        }))
        return null
      }
    },
    [playerId]
  )

  // Complete a practice session
  const completeSession = useCallback(
    async (
      sessionId: string,
      data?: {
        problemsAttempted?: number
        problemsCorrect?: number
        skillsUsed?: string[]
      }
    ) => {
      if (!playerId) return

      try {
        const response = await fetch(`/api/curriculum/${playerId}/sessions/${sessionId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data || {}),
        })

        if (!response.ok) {
          throw new Error(`Failed to complete session: ${response.statusText}`)
        }

        await fetchCurriculum()
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Unknown error',
        }))
      }
    },
    [playerId, fetchCurriculum]
  )

  // Update worksheet preset
  const updateWorksheetPreset = useCallback(
    async (preset: string | null) => {
      if (!playerId) return

      try {
        const response = await fetch(`/api/curriculum/${playerId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ worksheetPreset: preset }),
        })

        if (!response.ok) {
          throw new Error(`Failed to update preset: ${response.statusText}`)
        }

        const updated = await response.json()
        setState((prev) => ({
          ...prev,
          curriculum: updated,
        }))
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Unknown error',
        }))
      }
    },
    [playerId]
  )

  // Toggle visualization mode
  const toggleVisualizationMode = useCallback(async () => {
    if (!playerId || !state.curriculum) return

    try {
      const response = await fetch(`/api/curriculum/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visualizationMode: !state.curriculum.visualizationMode,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to toggle visualization: ${response.statusText}`)
      }

      const updated = await response.json()
      setState((prev) => ({
        ...prev,
        curriculum: updated,
      }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Unknown error',
      }))
    }
  }, [playerId, state.curriculum])

  return {
    ...state,
    refresh: fetchCurriculum,
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
