'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/queryClient'

interface CreateSessionParams {
  topicDescription?: string
  remixFromId?: string
  editPublishedId?: string
}

interface WorkshopSession {
  id: string
  state: string
  topicDescription: string | null
}

/**
 * Hook for creating a new workshop session and navigating to it.
 *
 * Usage:
 * ```tsx
 * const { mutate: createSession, isPending } = useCreateWorkshopSession()
 * createSession({ topicDescription: 'Long division' })
 * ```
 */
export function useCreateWorkshopSession() {
  const router = useRouter()

  return useMutation({
    mutationFn: async (params: CreateSessionParams): Promise<WorkshopSession> => {
      const res = await api('flowchart-workshop/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to create session' }))
        throw new Error(data.error || 'Failed to create session')
      }

      const { session } = await res.json()
      return session
    },

    onSuccess: (session) => {
      router.push(`/flowchart/workshop/${session.id}`)
    },

    onError: (error) => {
      console.error('Failed to create workshop session:', error)
    },
  })
}
