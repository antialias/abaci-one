'use client'

import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { elevenLabsVoiceIdOf, isRetiredVoice } from '@/lib/audio/voices'
import { api } from '@/lib/queryClient'
import { elevenLabsVoiceKeys } from '@/lib/queryKeys'

export interface ElevenLabsVoiceOption {
  /** Voice folder, `el-{voiceId}`: what the voice chain and generation use. */
  folder: string
  voiceId: string
  name: string
  category: string | null
}

async function fetchElevenLabsVoices(): Promise<ElevenLabsVoiceOption[]> {
  const res = await api('admin/audio/elevenlabs-voices')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  const data = (await res.json()) as { voices: ElevenLabsVoiceOption[] }
  return data.voices
}

/**
 * ElevenLabs voices from the switch proxy's door, plus `voiceLabel(folder)`:
 * an ElevenLabs folder shows as its voice's name, a retired OpenAI folder as
 * "nova (retired)", anything else (custom voices) as itself.
 */
export function useElevenLabsVoices(options?: { enabled?: boolean }) {
  const query = useQuery({
    queryKey: elevenLabsVoiceKeys.all,
    queryFn: fetchElevenLabsVoices,
    enabled: options?.enabled ?? true,
    staleTime: 10 * 60 * 1000,
  })

  const namesByFolder = useMemo(
    () => new Map((query.data ?? []).map((v) => [v.folder, v.name])),
    [query.data]
  )

  const voiceLabel = useCallback(
    (folder: string): string => {
      const name = namesByFolder.get(folder)
      if (name) return name
      const id = elevenLabsVoiceIdOf(folder)
      if (id) return `ElevenLabs voice ${id.slice(0, 6)}…`
      if (isRetiredVoice(folder)) return `${folder} (retired)`
      return folder
    },
    [namesByFolder]
  )

  return {
    voices: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    voiceLabel,
  }
}
