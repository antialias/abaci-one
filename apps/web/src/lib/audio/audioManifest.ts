import type { AudioTone } from './audioClipRegistry'
import { getAllRegisteredClips } from './audioClipRegistry'

// Side-effect import: triggers all audioClip() registrations
import './clips'

export interface AudioClipEntry {
  id: string
  text: string
  tone: AudioTone
  category: string
  filename: string
}

function categoryFromId(id: string): string {
  return id.split('-')[0]
}

export const AUDIO_MANIFEST: AudioClipEntry[] = getAllRegisteredClips().map((c) => ({
  id: c.id,
  text: c.text,
  tone: c.tone,
  category: categoryFromId(c.id),
  filename: `${c.id}.mp3`,
}))

/** All unique categories derived from registered clip IDs. */
export const AUDIO_CATEGORIES = [...new Set(AUDIO_MANIFEST.map((e) => e.category))] as const
export type AudioCategory = string

export const AUDIO_MANIFEST_MAP: Record<string, AudioClipEntry> = Object.fromEntries(
  AUDIO_MANIFEST.map((entry) => [entry.id, entry])
)
