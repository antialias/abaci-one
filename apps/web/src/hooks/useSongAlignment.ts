'use client'

/**
 * Fetches the per-song word-alignment JSON written by the ElevenLabs music
 * task and served at `/api/audio/songs/{songId}/alignment`.
 *
 * Disabled when no path is provided (legacy songs without alignment). The
 * route 404s for songs generated before the timestamps feature shipped —
 * we surface that as a null query result so the player degrades cleanly.
 */

import { useQuery } from '@tanstack/react-query'
import { sessionSongKeys } from '@/lib/queryKeys'
import type { MusicAlignmentJson } from '@/lib/elevenlabs/music-client'

export function useSongAlignment(alignmentPath: string | null | undefined) {
  return useQuery<MusicAlignmentJson | null>({
    queryKey: sessionSongKeys.alignment(alignmentPath ?? ''),
    queryFn: async () => {
      if (!alignmentPath) return null
      const res = await fetch(alignmentPath)
      if (!res.ok) return null
      return (await res.json()) as MusicAlignmentJson
    },
    enabled: !!alignmentPath,
    // Alignment is immutable per song — cache forever.
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  })
}
