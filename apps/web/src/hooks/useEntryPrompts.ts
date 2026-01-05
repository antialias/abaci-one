'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'
import { entryPromptKeys } from '@/lib/queryKeys'

export interface EntryPrompt {
  id: string
  teacherId: string
  playerId: string
  classroomId: string
  expiresAt: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  createdAt: string
  player: {
    id: string
    name: string
    emoji: string
  }
  classroom: {
    id: string
    name: string
  }
  teacher: {
    displayName: string
  }
}

/**
 * Hook for parents to manage entry prompts for their children
 *
 * - Fetches pending entry prompts
 * - Provides accept/decline mutations
 * - Real-time updates handled by useParentSocket via query invalidation
 */
export function useEntryPrompts(enabled = true) {
  const queryClient = useQueryClient()

  // Fetch pending prompts
  const {
    data: prompts = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: entryPromptKeys.pending(),
    queryFn: async () => {
      const response = await api('entry-prompts')
      if (!response.ok) {
        throw new Error('Failed to fetch entry prompts')
      }
      const data = await response.json()
      return data.prompts as EntryPrompt[]
    },
    enabled,
    refetchInterval: 30000, // Refresh every 30s to catch expired prompts
  })

  // Accept mutation
  const acceptPrompt = useMutation({
    mutationFn: async (promptId: string) => {
      const response = await api(`entry-prompts/${promptId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action: 'accept' }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to accept prompt')
      }
      return response.json()
    },
    onSuccess: () => {
      // Invalidate prompts query to refresh the list
      queryClient.invalidateQueries({ queryKey: entryPromptKeys.pending() })
    },
  })

  // Decline mutation
  const declinePrompt = useMutation({
    mutationFn: async (promptId: string) => {
      const response = await api(`entry-prompts/${promptId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action: 'decline' }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to decline prompt')
      }
      return response.json()
    },
    onSuccess: () => {
      // Invalidate prompts query to refresh the list
      queryClient.invalidateQueries({ queryKey: entryPromptKeys.pending() })
    },
  })

  // Filter out expired prompts on the client side
  const activePrompts = prompts.filter((p) => {
    const expiresAt = new Date(p.expiresAt)
    return expiresAt > new Date() && p.status === 'pending'
  })

  return {
    prompts: activePrompts,
    isLoading,
    error,
    acceptPrompt: acceptPrompt.mutateAsync,
    declinePrompt: declinePrompt.mutateAsync,
    isAccepting: acceptPrompt.isPending,
    isDeclining: declinePrompt.isPending,
    acceptingPromptId: acceptPrompt.isPending ? acceptPrompt.variables : null,
    decliningPromptId: declinePrompt.isPending ? declinePrompt.variables : null,
  }
}
