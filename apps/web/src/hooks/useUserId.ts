'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'

/**
 * Query key for user identity
 */
export const identityKeys = {
  all: ['identity'] as const,
  id: () => [...identityKeys.all, 'id'] as const,
}

/**
 * Fetch the current user's stable database user.id
 */
async function fetchUserId(): Promise<string | null> {
  try {
    const res = await api('identity')
    if (!res.ok) return null
    const data = await res.json()
    return data.userId
  } catch {
    return null
  }
}

/**
 * Hook: Get the current user's stable database user.id
 *
 * Returns the database user.id for both authenticated users and guests.
 * Returns null if no valid session exists.
 */
export function useUserId() {
  return useQuery({
    queryKey: identityKeys.id(),
    queryFn: fetchUserId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  })
}
