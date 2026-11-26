/**
 * Voice folders: what each `data/audio/{folder}/` holds and whether new clips
 * may be generated into it. Safe to import on the client.
 *
 * - ElevenLabs voices live in `el-{voice_id}` (e.g. `el-21m00Tcm4TlvDq8ikWAM`).
 *   The id is ElevenLabs' own, so one folder is always exactly one voice; the
 *   admin page shows the voice's name, never the folder.
 * - The OpenAI voices (onyx, nova, ...) are retired: their clips keep playing
 *   exactly as before, but nothing is ever generated into them again, so no
 *   folder mixes two providers' voices.
 * - Anything else is a custom (recorded) voice or a folder we don't know; it
 *   plays but never generates either.
 */
import { SPEECH_MODEL } from '@/lib/speech/model'

export const ELEVENLABS_VOICE_PREFIX = 'el-'

/** ElevenLabs voice ids are short alphanumeric strings; anything else is refused. */
const ELEVENLABS_VOICE_ID_RE = /^[A-Za-z0-9]{1,64}$/

/** OpenAI gpt-4o-mini-tts voices whose folders are now play-only. */
export const RETIRED_OPENAI_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
] as const

const RETIRED_SET: ReadonlySet<string> = new Set(RETIRED_OPENAI_VOICES)

export function isElevenLabsVoiceId(voiceId: string): boolean {
  return ELEVENLABS_VOICE_ID_RE.test(voiceId)
}

/** Folder for an ElevenLabs voice id. Throws on an id that isn't path-safe. */
export function elevenLabsVoiceFolder(voiceId: string): string {
  if (!isElevenLabsVoiceId(voiceId)) {
    throw new Error(`Not an ElevenLabs voice id: ${JSON.stringify(voiceId)}`)
  }
  return `${ELEVENLABS_VOICE_PREFIX}${voiceId}`
}

/** The ElevenLabs voice id behind a folder, or null if it isn't an ElevenLabs folder. */
export function elevenLabsVoiceIdOf(folder: string): string | null {
  if (!folder.startsWith(ELEVENLABS_VOICE_PREFIX)) return null
  const id = folder.slice(ELEVENLABS_VOICE_PREFIX.length)
  return isElevenLabsVoiceId(id) ? id : null
}

/** True for folders new clips may be generated into. */
export function isElevenLabsVoice(folder: string): boolean {
  return elevenLabsVoiceIdOf(folder) !== null
}

export function isRetiredVoice(folder: string): boolean {
  return RETIRED_SET.has(folder)
}

/** A single path segment (folder or file stem) that can't escape its parent. */
export function isSafePathSegment(name: string): boolean {
  return (
    name.length > 0 &&
    name !== '.' &&
    !name.includes('/') &&
    !name.includes('\\') &&
    !name.includes('..') &&
    !name.includes('\0')
  )
}

/** A folder name that can't escape data/audio/. */
export const isSafeVoiceFolder = isSafePathSegment

/** Names a custom (recorded) voice may not take: they'd collide with a generated folder. */
export function isReservedVoiceName(name: string): boolean {
  // Case-insensitive: on a case-insensitive filesystem "ONYX" is onyx's folder.
  const lower = name.trim().toLowerCase()
  return isRetiredVoice(lower) || lower.startsWith(ELEVENLABS_VOICE_PREFIX)
}

/** Why generation into this folder is refused, or null if it's allowed. */
export function generationRefusal(folder: string): string | null {
  if (isElevenLabsVoice(folder)) return null
  if (isRetiredVoice(folder)) {
    return `"${folder}" is a retired OpenAI voice: its clips still play, but no new clips can be generated for it. Add an ElevenLabs voice to the chain to generate missing clips.`
  }
  return `"${folder}" is not an ElevenLabs voice, so clips can't be generated for it.`
}

export interface VoiceMeta {
  provider: string
  model: string
  format: string
  retired: boolean
}

/** Provider/model labels for a folder, or null for custom/unknown folders. */
export function getVoiceMeta(folder: string): VoiceMeta | null {
  if (isElevenLabsVoice(folder)) {
    return { provider: 'ElevenLabs', model: SPEECH_MODEL, format: 'mp3', retired: false }
  }
  if (isRetiredVoice(folder)) {
    return { provider: 'OpenAI', model: 'retired', format: 'mp3', retired: true }
  }
  return null
}
