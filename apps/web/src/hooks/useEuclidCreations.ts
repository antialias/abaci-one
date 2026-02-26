'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'
import { euclidKeys } from '@/lib/queryKeys'

export type CreationsTab = 'mine' | 'published' | 'seen'

export interface CreationMeta {
  id: string
  thumbnail: string | null
  isPublic: boolean
  createdAt: Date
}

async function fetchCreations(
  tab: CreationsTab,
  playerId?: string | null
): Promise<CreationMeta[]> {
  if (tab === 'seen') {
    try {
      const stored = localStorage.getItem('euclid_seen_ids')
      const ids: string[] = stored ? JSON.parse(stored) : []
      if (ids.length === 0) return []
      const res = await api(`euclid/creations?ids=${ids.join(',')}`)
      if (!res.ok) return []
      const json = await res.json()
      return json.creations ?? []
    } catch {
      return []
    }
  }

  const params = new URLSearchParams({ limit: '60', mine: 'true' })
  if (tab === 'published') params.set('isPublic', 'true')
  if (playerId) params.set('playerId', playerId)

  const res = await api(`euclid/creations?${params}`)
  if (!res.ok) return []
  const json = await res.json()
  return json.creations ?? []
}

export function useEuclidCreations(tab: CreationsTab, playerId?: string | null) {
  return useQuery({
    queryKey: euclidKeys.creations(tab, playerId),
    queryFn: () => fetchCreations(tab, playerId),
  })
}
