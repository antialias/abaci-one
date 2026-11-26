/**
 * API route for on-demand TTS clip generation.
 *
 * POST /api/audio/generate-clip
 * Body: { voice, clipId, text, tone?, cacheOnly? }
 * Returns: audio/mpeg bytes (or JSON error)
 *
 * Serves the clip from disk if it's there; with `cacheOnly`, answers 404
 * instead of generating. Otherwise generates it via ElevenLabs
 * (lib/speech), caches it and returns it.
 *
 * Where a clip lives: for ElevenLabs voices, every clip that isn't a
 * manifest clip is stored under a key the server computes from the text it
 * speaks (lib/speech/clipStorage), never under the client's clip id. Guests
 * can call this route, so that is what keeps one request's words out of
 * another request's clip. Manifest clips (constant text, checked) and
 * retired/custom voices keep their files by clip id.
 *
 * Before anything is spent: only ElevenLabs voices generate (400), the text
 * must fit the clip id (lib/speech/clipAuthority, 400), and the per-identity
 * and pod-wide hourly caps must allow it (429). Plays of a clip already
 * being generated join that generation and spend nothing.
 *
 * Timing: the caller gets 504 after SPEECH_TIMEOUT_MS.onDemandWait so the
 * child's voice chain falls to subtitles, but the upstream request keeps
 * running (the door bills aborted requests in full) and caches the clip
 * when it lands (lib/speech/onDemandGeneration).
 */

import { createHash } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { type NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { AiFeature } from '@/lib/ai-usage/features'
import {
  generationRefusal,
  isNonVoiceFolder,
  isSafePathSegment,
  isSafeVoiceFolder,
} from '@/lib/audio/voices'
import { withAuth } from '@/lib/auth/withAuth'
import { authorizeClipText } from '@/lib/speech/clipAuthority'
import { clipFileStem, writeClipFile } from '@/lib/speech/clipStorage'
import { onDemandGenerations, waitAtMost } from '@/lib/speech/onDemandGeneration'
import { requestIdentity } from '@/lib/speech/requestIdentity'
import { SPEECH_TIMEOUT_MS, SpeechError, synthesizeSpeech } from '@/lib/speech/synthesize'

/** Read per request so tests (and any cwd change) see the right place. */
function audioDir(): string {
  return join(process.cwd(), 'data', 'audio')
}

/** Max filename length (bytes) — conservative limit for all filesystems */
const MAX_FILENAME_LEN = 200

/** If a clipId is too long for a filename, hash it to a safe short form. */
function safeClipId(clipId: string): string {
  // +4 for ".mp3" extension
  if (Buffer.byteLength(clipId, 'utf8') + 4 <= MAX_FILENAME_LEN) return clipId
  const hash = createHash('sha256').update(clipId).digest('hex').slice(0, 16)
  return `hc-${hash}`
}

function audioResponse(buffer: Buffer): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.byteLength.toString(),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  try {
    const body = await request.json()
    const { voice, clipId, text, tone } = body ?? {}
    const cacheOnly = body?.cacheOnly === true

    if (
      typeof voice !== 'string' ||
      !voice ||
      typeof clipId !== 'string' ||
      !clipId ||
      typeof text !== 'string' ||
      !text ||
      (tone != null && typeof tone !== 'string')
    ) {
      return NextResponse.json({ error: 'voice, clipId, and text are required' }, { status: 400 })
    }
    if (!isSafeVoiceFolder(voice) || isNonVoiceFolder(voice)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    // Speak only what fits the clip id (manifest text; FNV sanity for hash ids).
    const authority = authorizeClipText(clipId, text, tone)
    if (!authority.ok) {
      return NextResponse.json({ error: authority.error }, { status: authority.status })
    }

    // Where this clip lives: a server-computed text key, or the clip id.
    const stem = clipFileStem(voice, safeClipId(clipId), authority.text, authority.tone)
    if (!isSafePathSegment(stem)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const identity = await requestIdentity(request, userId)

    // From here to admit() there is no await: a generation that finishes
    // meanwhile can't slip between the disk check and the in-flight check.
    const voiceDir = join(audioDir(), voice)
    for (const name of [`${stem}.mp3`, `cc-${stem}.mp3`]) {
      const path = join(voiceDir, name)
      if (existsSync(path)) return audioResponse(readFileSync(path))
    }
    if (cacheOnly) {
      return NextResponse.json({ error: 'Not cached' }, { status: 404 })
    }

    // Only ElevenLabs voices generate; retired OpenAI folders are play-only.
    const refusal = generationRefusal(voice)
    if (refusal) {
      return NextResponse.json({ error: refusal }, { status: 400 })
    }

    const admission = onDemandGenerations.admit(
      join(voiceDir, stem),
      identity,
      authority.text.length,
      async () => {
        const { audio } = await synthesizeSpeech({
          voice,
          text: authority.text,
          tone: authority.tone,
          usage: { userId, feature: AiFeature.TTS_CLIP },
          timeoutMs: SPEECH_TIMEOUT_MS.onDemandUpstream,
        })
        writeClipFile(voiceDir, stem, audio)
        return audio
      }
    )
    if (admission.kind === 'refused') {
      console.warn('[generate-clip] hourly cap reached:', admission.scope)
      return NextResponse.json(
        { error: 'Too many new clips this hour; try again later.' },
        { status: 429 }
      )
    }

    const result = await waitAtMost(admission.done, SPEECH_TIMEOUT_MS.onDemandWait)
    if (!result.done) {
      return NextResponse.json(
        { error: 'Still generating; it will be ready shortly.' },
        { status: 504 }
      )
    }
    return audioResponse(result.value)
  } catch (error) {
    if (error instanceof SpeechError) {
      console.error('[generate-clip] speech error:', error.kind, error.message)
      return NextResponse.json({ error: error.message }, { status: error.httpStatus })
    }
    console.error('[generate-clip] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
