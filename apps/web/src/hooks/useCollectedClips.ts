'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'
import { collectedClipKeys } from '@/lib/queryKeys'

// Re-export keys for consumers
export { collectedClipKeys } from '@/lib/queryKeys'

// ============================================================================
// Types
// ============================================================================

export interface CollectedClipEntry {
  id: string
  text: string
  tone: string
  playCount: number
  firstSeenAt: string
  lastSeenAt: string
}

interface CollectedClipsResponse {
  clips: CollectedClipEntry[]
  generatedFor?: Record<string, boolean>
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchCollectedClips(voice?: string): Promise<CollectedClipsResponse> {
  const path = voice
    ? `audio/collected-clips?voice=${encodeURIComponent(voice)}`
    : 'audio/collected-clips'
  const res = await api(path)
  if (!res.ok) throw new Error('Failed to fetch collected clips')
  return res.json()
}

async function generateCollectedClips(params: {
  voice: string
  clipIds: string[]
}): Promise<{ taskId: string }> {
  const res = await api('admin/audio/generate-collected', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.error || 'Generation failed')
  }
  return res.json()
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch collected clips with optional per-voice generation status.
 *
 * When `voice` is provided, the response includes `generatedFor` —
 * a map of clipId → boolean indicating whether an mp3 exists for that voice.
 */
export function useCollectedClips(voice?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: collectedClipKeys.list(voice),
    queryFn: () => fetchCollectedClips(voice),
    enabled: options?.enabled ?? true,
  })
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Trigger background generation of OpenAI TTS mp3s for collected clips.
 *
 * On success, invalidates the collected clips query so the status dots
 * refresh once the background task finishes.
 */
export function useGenerateCollectedClips(voice?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: generateCollectedClips,
    onSuccess: () => {
      // The task runs in the background; we invalidate so that when
      // the caller re-fetches (e.g. after task completion) the cache is stale.
      queryClient.invalidateQueries({
        queryKey: collectedClipKeys.list(voice),
      })
    },
  })
}
