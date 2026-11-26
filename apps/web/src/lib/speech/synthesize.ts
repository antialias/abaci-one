/**
 * Speech: the one server path from (voice, text, tone) to mp3 bytes.
 *
 * Every spoken clip abaci makes goes through here, to ElevenLabs via the
 * switch proxy's ElevenLabs door (see lib/elevenlabs/config). The model is
 * chosen in ./model; tone becomes an audio tag in lib/audio/toneDirections.
 * Usage is recorded per clip as provider `elevenlabs`.
 */
import { recordTtsUsage, type UsageContext } from '@/lib/ai-usage/helpers'
import { speechTextFor } from '@/lib/audio/toneDirections'
import { elevenLabsVoiceIdOf, generationRefusal, isElevenLabsVoiceId } from '@/lib/audio/voices'
import { elevenLabsApiKey, elevenLabsBaseUrl } from '@/lib/elevenlabs/config'
import { MAX_SPEECH_CHARS, SPEECH_MODEL, SPEECH_OUTPUT_FORMAT } from './model'

export type SpeechErrorKind =
  /** The voice folder is retired or not an ElevenLabs voice. */
  | 'not-generatable'
  /** Nothing to say. */
  | 'empty'
  /** Over MAX_SPEECH_CHARS; refused rather than split. */
  | 'too-long'
  /** ELEVENLABS_MUSIC_API_KEY is missing. */
  | 'config'
  /** The door or ElevenLabs answered with an error, or couldn't be reached. */
  | 'upstream'

export class SpeechError extends Error {
  constructor(
    readonly kind: SpeechErrorKind,
    message: string,
    /** The HTTP status a route should answer with. */
    readonly httpStatus: number,
    /** The door's own status, for upstream errors. */
    readonly upstreamStatus?: number
  ) {
    super(message)
    this.name = 'SpeechError'
  }
}

/**
 * How long each kind of caller waits for the door before giving up. Real
 * clips take about 1 s; the on-demand path (a child waiting to hear a line)
 * gives up after a few seconds so the voice chain falls through to subtitles
 * quickly. Admin preview and bulk generation can afford to wait longer.
 */
export const SPEECH_TIMEOUT_MS = {
  onDemand: 5_000,
  preview: 15_000,
  bulk: 30_000,
  voiceList: 10_000,
} as const

export interface SynthesizeSpeechInput {
  /** Voice folder, e.g. `el-21m00Tcm4TlvDq8ikWAM`. */
  voice: string
  text: string
  /** A registered tone name or a free-text direction. */
  tone?: string | null
  /** When given, the clip is recorded in ai_usage under this context. */
  usage?: UsageContext
  /** Give up on the door after this long (504). See SPEECH_TIMEOUT_MS. */
  timeoutMs: number
}

export interface SynthesizedSpeech {
  audio: Buffer
  model: string
  /** Characters sent (and billed), including any audio tag. */
  characters: number
}

/**
 * The exact text a clip will be sent as. Refuses rather than splits anything
 * over the door's 1000-character limit; if only the tone tag tips a clip over,
 * the tag is dropped instead.
 */
export function speechRequestText(text: string, tone?: string | null): string {
  if (text.trim().length === 0) {
    throw new SpeechError('empty', 'Clip text is empty.', 400)
  }
  const plain = speechTextFor(text, null, SPEECH_MODEL).text
  if (plain.length > MAX_SPEECH_CHARS) {
    throw new SpeechError(
      'too-long',
      `Clip text is ${plain.length} characters; a clip may be at most ${MAX_SPEECH_CHARS}. Shorten it or split it into separate clips.`,
      400
    )
  }
  const tagged = speechTextFor(text, tone, SPEECH_MODEL).text
  return tagged.length <= MAX_SPEECH_CHARS ? tagged : plain
}

/** Map a fetch that threw (timeout, refused connection) to a SpeechError. */
function unreachable(err: unknown, timeoutMs: number): SpeechError {
  if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    return new SpeechError('upstream', `ElevenLabs timed out after ${timeoutMs} ms`, 504)
  }
  return new SpeechError(
    'upstream',
    `Could not reach ElevenLabs: ${err instanceof Error ? err.message : String(err)}`,
    502
  )
}

/** Pull a readable message out of an ElevenLabs-shaped error body. */
export function elevenLabsErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as { detail?: unknown }
    const detail = parsed?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      const msgs = detail
        .map((d) => (d && typeof d === 'object' && 'msg' in d ? String(d.msg) : null))
        .filter(Boolean)
      if (msgs.length > 0) return msgs.join('; ')
    }
    if (detail && typeof detail === 'object' && 'message' in detail) {
      return String((detail as { message: unknown }).message)
    }
  } catch {
    // not JSON: fall through to the raw text
  }
  const trimmed = body.trim()
  return trimmed.length > 300 ? `${trimmed.slice(0, 300)}…` : trimmed || 'no details'
}

export async function synthesizeSpeech(input: SynthesizeSpeechInput): Promise<SynthesizedSpeech> {
  const refusal = generationRefusal(input.voice)
  const voiceId = elevenLabsVoiceIdOf(input.voice)
  if (refusal || !voiceId) {
    throw new SpeechError('not-generatable', refusal ?? 'Not an ElevenLabs voice.', 400)
  }

  const text = speechRequestText(input.text, input.tone)

  let apiKey: string
  try {
    apiKey = elevenLabsApiKey()
  } catch (err) {
    throw new SpeechError('config', err instanceof Error ? err.message : String(err), 503)
  }

  const url = `${elevenLabsBaseUrl()}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${SPEECH_OUTPUT_FORMAT}`
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({ text, model_id: SPEECH_MODEL }),
      signal: AbortSignal.timeout(input.timeoutMs),
    })
  } catch (err) {
    throw unreachable(err, input.timeoutMs)
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new SpeechError(
      'upstream',
      `ElevenLabs HTTP ${response.status}: ${elevenLabsErrorMessage(body)}`,
      502,
      response.status
    )
  }

  let audio: Buffer
  try {
    audio = Buffer.from(await response.arrayBuffer())
  } catch (err) {
    throw unreachable(err, input.timeoutMs)
  }
  if (audio.byteLength === 0) {
    throw new SpeechError('upstream', 'ElevenLabs returned no audio.', 502, response.status)
  }

  if (input.usage) recordTtsUsage(text, SPEECH_MODEL, input.usage)

  return { audio, model: SPEECH_MODEL, characters: text.length }
}

/** Map a failure that repeats clip after clip to something an admin can act on. */
export function describeSpeechFailure(rawError: string, voice: string): string {
  if (rawError.includes('EACCES') || rawError.includes('permission denied')) {
    return `Permission denied writing audio files for voice "${voice}". The server cannot write to the audio storage directory. An admin needs to fix the directory permissions.`
  }
  if (rawError.includes('ENOSPC') || rawError.includes('no space')) {
    return `Disk full — not enough space to write audio files for voice "${voice}".`
  }
  if (rawError.includes('ENOENT')) {
    return `Audio storage directory not found for voice "${voice}". The volume may not be mounted.`
  }
  if (rawError.includes('HTTP 401') || rawError.includes('HTTP 403')) {
    return `The ElevenLabs door refused abaci's login. Check ELEVENLABS_MUSIC_API_KEY in the app-env secret.`
  }
  if (rawError.includes('HTTP 429')) {
    return `ElevenLabs is rate limiting or out of credits. Try again later.`
  }
  return `Generation failed after repeated errors: ${rawError}`
}

export interface ElevenLabsVoice {
  voiceId: string
  name: string
  category: string | null
}

/** The voices the door's ElevenLabs account offers (GET /v1/voices), sorted by name. */
export async function listElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  let apiKey: string
  try {
    apiKey = elevenLabsApiKey()
  } catch (err) {
    throw new SpeechError('config', err instanceof Error ? err.message : String(err), 503)
  }

  let response: Response
  try {
    response = await fetch(`${elevenLabsBaseUrl()}/v1/voices`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(SPEECH_TIMEOUT_MS.voiceList),
    })
  } catch (err) {
    throw unreachable(err, SPEECH_TIMEOUT_MS.voiceList)
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new SpeechError(
      'upstream',
      `ElevenLabs HTTP ${response.status}: ${elevenLabsErrorMessage(body)}`,
      502,
      response.status
    )
  }

  const data = (await response.json()) as {
    voices?: Array<{ voice_id?: unknown; name?: unknown; category?: unknown }>
  }
  return (data.voices ?? [])
    .filter(
      (v): v is { voice_id: string; name: string; category?: unknown } =>
        typeof v.voice_id === 'string' &&
        typeof v.name === 'string' &&
        isElevenLabsVoiceId(v.voice_id)
    )
    .map((v) => ({
      voiceId: v.voice_id,
      name: v.name,
      category: typeof v.category === 'string' ? v.category : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
