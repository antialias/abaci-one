'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { versionHistoryKeys } from '@/lib/queryKeys'

// Re-export query keys for consumers
export { versionHistoryKeys } from '@/lib/queryKeys'

export interface FlowchartVersion {
  id: string
  versionNumber: number
  source: 'generate' | 'refine'
  sourceRequest: string | null
  emoji: string | null
  title: string | null
  description: string | null
  difficulty: string | null
  notes: string | null
  validationPassed: boolean | null
  coveragePercent: number | null
  createdAt: string
  isCurrent: boolean
  // Full data for preview (returned by API but may be large)
  definitionJson: string
  mermaidContent: string
}

interface VersionHistoryResponse {
  versions: FlowchartVersion[]
  currentVersion: number
}

/**
 * Fetch version history for a session
 */
async function fetchVersionHistory(sessionId: string): Promise<VersionHistoryResponse> {
  const res = await fetch(`/api/flowchart-workshop/sessions/${sessionId}/versions`)
  if (!res.ok) {
    throw new Error('Failed to fetch version history')
  }
  return res.json()
}

/**
 * Restore a specific version
 */
async function restoreVersion({
  sessionId,
  versionNumber,
}: {
  sessionId: string
  versionNumber: number
}): Promise<{ success: boolean }> {
  const res = await fetch(`/api/flowchart-workshop/sessions/${sessionId}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ versionNumber }),
  })
  if (!res.ok) {
    throw new Error('Failed to restore version')
  }
  return res.json()
}

/**
 * Hook: Fetch version history for a session
 */
export function useVersionHistory(sessionId: string) {
  return useQuery({
    queryKey: versionHistoryKeys.session(sessionId),
    queryFn: () => fetchVersionHistory(sessionId),
    // Refetch when window regains focus (catches versions created in other tabs)
    refetchOnWindowFocus: true,
  })
}

/**
 * Hook: Restore a version
 */
export function useRestoreVersion(sessionId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (versionNumber: number) => restoreVersion({ sessionId, versionNumber }),
    onSuccess: () => {
      // Invalidate the version history to refresh the list with new current marker
      queryClient.invalidateQueries({
        queryKey: versionHistoryKeys.session(sessionId),
      })
    },
  })
}

/**
 * Hook: Get a function to invalidate version history cache
 * Call this after generate/refine completes to refresh the history tab
 */
export function useInvalidateVersionHistory() {
  const queryClient = useQueryClient()

  return (sessionId: string) => {
    queryClient.invalidateQueries({
      queryKey: versionHistoryKeys.session(sessionId),
    })
  }
}
