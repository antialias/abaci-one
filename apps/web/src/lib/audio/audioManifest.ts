import type { AudioTone } from './audioClipRegistry'
import { getAllRegisteredClips } from './audioClipRegistry'

// Side-effect import: triggers all audioClip() registrations
import './clips'

export const AUDIO_CATEGORIES = ['number', 'operator', 'feedback', 'tutorial'] as const
export type AudioCategory = (typeof AUDIO_CATEGORIES)[number]

export interface AudioClipEntry {
  id: string
  text: string
  tone: AudioTone
  category: AudioCategory
  filename: string
}

function categoryFromId(id: string): AudioCategory {
  const prefix = id.split('-')[0]
  if (AUDIO_CATEGORIES.includes(prefix as AudioCategory)) {
    return prefix as AudioCategory
  }
  throw new Error(`audioManifest: cannot derive category from clip ID "${id}"`)
}

export const AUDIO_MANIFEST: AudioClipEntry[] = getAllRegisteredClips().map((c) => ({
  id: c.id,
  text: c.text,
  tone: c.tone,
  category: categoryFromId(c.id),
  filename: `${c.id}.mp3`,
}))

export const AUDIO_MANIFEST_MAP: Record<string, AudioClipEntry> = Object.fromEntries(
  AUDIO_MANIFEST.map((entry) => [entry.id, entry])
)
