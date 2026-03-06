'use client'

import { useQuery } from '@tanstack/react-query'
import { postcardKeys } from '@/lib/queryKeys'

interface PostcardListItem {
  id: string
  callerNumber: number
  status: string
  imageUrl: string | null
  thumbnailUrl: string | null
  isRead: boolean
  createdAt: string
  manifest: {
    callerNumber: number
    callerPersonality: string
    childName: string
    childEmoji: string
    sessionSummary: string
    moments: Array<{
      rank: number
      caption: string
      category: string
    }>
  }
}

export function usePostcards(playerId?: string) {
  return useQuery({
    queryKey: postcardKeys.list(playerId),
    queryFn: async (): Promise<PostcardListItem[]> => {
      const params = playerId ? `?playerId=${playerId}` : ''
      const res = await fetch(`/api/postcards${params}`)
      if (!res.ok) throw new Error('Failed to fetch postcards')
      const data = await res.json()
      return data.postcards
    },
  })
}

export function useUnreadPostcardCount(playerId?: string) {
  return useQuery({
    queryKey: postcardKeys.unreadCount(playerId),
    queryFn: async (): Promise<number> => {
      const params = playerId ? `?playerId=${playerId}` : ''
      const res = await fetch(`/api/postcards/unread-count${params}`)
      if (!res.ok) throw new Error('Failed to fetch unread count')
      const data = await res.json()
      return data.count
    },
    refetchInterval: 30_000, // Poll every 30s for new postcards
  })
}
