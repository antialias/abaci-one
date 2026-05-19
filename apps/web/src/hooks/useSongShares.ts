'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'
import { songShareKeys } from '@/lib/queryKeys'
import type { SongShareVisibility } from '@/db/schema/song-shares'

export interface SongShareInfo {
  id: string
  url: string
  visibility: SongShareVisibility
  views: number
  createdAt: number
  lastViewedAt: number | null
}

interface ListResponse {
  shares: SongShareInfo[]
}

/**
 * Owner-side management of permanent, revocable public links to a song.
 *
 * Lists active shares and exposes create / update-visibility / revoke
 * mutations, each invalidating the per-song share list.
 */
export function useSongShares(songId: string | null, enabled = true) {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: songShareKeys.forSong(songId ?? '') })

  const sharesQuery = useQuery({
    queryKey: songShareKeys.forSong(songId ?? ''),
    queryFn: async (): Promise<SongShareInfo[]> => {
      const res = await api(`songs/${songId}/share`)
      if (!res.ok) throw new Error('Failed to load shares')
      const data = (await res.json()) as ListResponse
      return data.shares
    },
    enabled: enabled && !!songId,
  })

  const createShare = useMutation({
    mutationFn: async (visibility: SongShareVisibility): Promise<SongShareInfo> => {
      const res = await api(`songs/${songId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create share')
      }
      return res.json()
    },
    onSuccess: invalidate,
  })

  const updateVisibility = useMutation({
    mutationFn: async ({
      token,
      visibility,
    }: {
      token: string
      visibility: SongShareVisibility
    }) => {
      const res = await api(`songs/${songId}/share?token=${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility }),
      })
      if (!res.ok) throw new Error('Failed to update share')
      return res.json()
    },
    onSuccess: invalidate,
  })

  const revokeShare = useMutation({
    mutationFn: async (token: string) => {
      const res = await api(`songs/${songId}/share?token=${encodeURIComponent(token)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to revoke share')
      return res.json()
    },
    onSuccess: invalidate,
  })

  return {
    shares: sharesQuery.data ?? [],
    isLoading: sharesQuery.isLoading,
    createShare,
    updateVisibility,
    revokeShare,
  }
}
