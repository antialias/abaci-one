import { useQuery } from '@tanstack/react-query'
import { songKeys } from '@/lib/queryKeys'
import { api } from '@/lib/queryClient'

export interface PlayerSong {
  id: string
  title: string | null
  createdAt: string
  audioPath: string
}

export function usePlayerSongs(playerId: string | null) {
  return useQuery({
    queryKey: songKeys.player(playerId!),
    queryFn: async (): Promise<PlayerSong[]> => {
      const res = await api(`curriculum/${playerId}/songs`)
      if (!res.ok) throw new Error('Failed to fetch songs')
      const data = await res.json()
      return data.songs
    },
    enabled: !!playerId,
  })
}
