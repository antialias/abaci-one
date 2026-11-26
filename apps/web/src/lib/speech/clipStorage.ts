/**
 * Where a generated clip lives on disk. Server only.
 *
 * Text-keyed clips (lib/audio/textKeyedClips: ElevenLabs voice, not a
 * manifest clip) are stored as `t-{key}.mp3`, where the key is the first 32
 * hex digits of SHA-256 over exactly the text sent to ElevenLabs (the clip's
 * text with its tone's audio tag, brackets made parentheses). ElevenLabs is
 * sent no locale, so the audio is a function of voice, model and that text
 * alone; the key covers the text and the folder covers the voice.
 *
 * Everything else (manifest clips, retired and custom voices) keeps its file
 * by clip id.
 */
import { createHash, randomUUID } from 'crypto'
import { mkdirSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import { isTextKeyedClip } from '@/lib/audio/textKeyedClips'
import { speechRequestText } from './synthesize'

export const TEXT_KEY_PREFIX = 't-'

/** `t-` + 32 hex: the storage key for what ElevenLabs is sent. Throws SpeechError on empty/too-long text. */
export function speechStorageKey(text: string, tone: string | null | undefined): string {
  const sent = speechRequestText(text, tone)
  const digest = createHash('sha256').update(`v1\0${sent}`).digest('hex')
  return `${TEXT_KEY_PREFIX}${digest.slice(0, 32)}`
}

/** The file stem (name without `.mp3`) a clip is stored under in `voice`'s folder. */
export function clipFileStem(
  voice: string,
  clipId: string,
  text: string,
  tone: string | null | undefined
): string {
  return isTextKeyedClip(voice, clipId) ? speechStorageKey(text, tone) : clipId
}

/** Write a clip so readers never see a half-written file. */
export function writeClipFile(voiceDir: string, stem: string, audio: Buffer): void {
  mkdirSync(voiceDir, { recursive: true })
  const tmp = join(voiceDir, `.${stem}.${randomUUID()}.tmp`)
  writeFileSync(tmp, audio)
  renameSync(tmp, join(voiceDir, `${stem}.mp3`))
}
