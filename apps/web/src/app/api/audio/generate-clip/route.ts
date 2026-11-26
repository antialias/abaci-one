/**
 * API route for on-demand TTS clip generation.
 *
 * POST /api/audio/generate-clip
 * Body: { voice: string, clipId: string, text: string, tone: string }
 * Returns: audio/mpeg bytes (or JSON error)
 *
 * Generates a clip via ElevenLabs (lib/speech), caches it to disk, and returns
 * the audio. If the clip already exists on disk, returns the cached version,
 * for any voice. Otherwise, before anything is spent:
 * - only ElevenLabs voices generate (retired OpenAI voices: 400);
 * - the text must be what the clip id stands for (lib/speech/clipAuthority),
 *   since guests can call this route;
 * - the per-identity and pod-wide hourly caps must allow it
 *   (lib/speech/generationBudget; 429 otherwise).
 * The door gets SPEECH_TIMEOUT_MS.onDemand; a stuck door answers 504 and the
 * client's voice chain falls through to subtitles.
 */

import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { NextResponse } from 'next/server'
import { join } from 'path'
import { AiFeature } from '@/lib/ai-usage/features'
import { generationRefusal, isSafePathSegment, isSafeVoiceFolder } from '@/lib/audio/voices'
import { withAuth } from '@/lib/auth/withAuth'
import { authorizeClipText } from '@/lib/speech/clipAuthority'
import { onDemandSpeechBudget } from '@/lib/speech/generationBudget'
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

export const POST = withAuth(async (request, { userId }) => {
  try {
    const body = await request.json()
    const { voice, text, tone } = body
    const requestedClipId: string = typeof body.clipId === 'string' ? body.clipId : ''
    const clipId = safeClipId(requestedClipId)

    // Validate required fields
    if (
      typeof voice !== 'string' ||
      !voice ||
      !requestedClipId ||
      typeof text !== 'string' ||
      !text
    ) {
      return NextResponse.json({ error: 'voice, clipId, and text are required' }, { status: 400 })
    }

    // Prevent directory traversal
    if (!isSafeVoiceFolder(voice) || !isSafePathSegment(clipId)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    // Disk cache check — return existing file if present
    const voiceDir = join(audioDir(), voice)
    const candidates = [join(voiceDir, `${clipId}.mp3`), join(voiceDir, `cc-${clipId}.mp3`)]
    for (const path of candidates) {
      if (existsSync(path)) {
        const fileBuffer = readFileSync(path)
        return new NextResponse(new Uint8Array(fileBuffer), {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': fileBuffer.byteLength.toString(),
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        })
      }
    }

    // Only ElevenLabs voices generate; retired OpenAI folders are play-only.
    const refusal = generationRefusal(voice)
    if (refusal) {
      return NextResponse.json({ error: refusal }, { status: 400 })
    }

    // Speak only what the clip id stands for.
    const authority = await authorizeClipText(requestedClipId, text, tone)
    if (!authority.ok) {
      return NextResponse.json({ error: authority.error }, { status: authority.status })
    }

    const identity = userId || request.headers.get('x-guest-id') || 'anonymous'
    const budget = onDemandSpeechBudget.tryConsume(identity, authority.text.length)
    if (!budget.ok) {
      console.warn('[generate-clip] hourly cap reached:', budget.scope)
      return NextResponse.json(
        { error: 'Too many new clips this hour; try again later.' },
        { status: 429 }
      )
    }

    const { audio: buffer } = await synthesizeSpeech({
      voice,
      text: authority.text,
      tone: authority.tone,
      usage: { userId, feature: AiFeature.TTS_CLIP },
      timeoutMs: SPEECH_TIMEOUT_MS.onDemand,
    })

    // Save to disk cache
    mkdirSync(voiceDir, { recursive: true })
    writeFileSync(join(voiceDir, `${clipId}.mp3`), buffer)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    if (error instanceof SpeechError) {
      console.error('[generate-clip] speech error:', error.kind, error.message)
      return NextResponse.json({ error: error.message }, { status: error.httpStatus })
    }
    console.error('[generate-clip] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
