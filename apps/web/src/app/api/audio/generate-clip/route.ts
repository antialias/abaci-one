/**
 * API route for on-demand TTS clip generation.
 *
 * POST /api/audio/generate-clip
 * Body: { voice: string, clipId: string, text: string, tone: string }
 * Returns: audio/mpeg bytes (or JSON error)
 *
 * Generates a clip via ElevenLabs (lib/speech), caches it to disk, and returns
 * the audio. If the clip already exists on disk, returns the cached version,
 * for any voice; only ElevenLabs voices generate (retired OpenAI voices are
 * refused with 400).
 */

import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { NextResponse } from 'next/server'
import { join } from 'path'
import { AiFeature } from '@/lib/ai-usage/features'
import { isSafeVoiceFolder } from '@/lib/audio/voices'
import { withAuth } from '@/lib/auth/withAuth'
import { SpeechError, synthesizeSpeech } from '@/lib/speech/synthesize'

const AUDIO_DIR = join(process.cwd(), 'data', 'audio')

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
    const clipId = safeClipId(body.clipId ?? '')

    // Validate required fields
    if (!voice || !clipId || !text) {
      return NextResponse.json({ error: 'voice, clipId, and text are required' }, { status: 400 })
    }

    // Prevent directory traversal
    if (!isSafeVoiceFolder(voice) || clipId.includes('/') || clipId.includes('..')) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    // Disk cache check — return existing file if present
    const voiceDir = join(AUDIO_DIR, voice)
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

    // Only ElevenLabs voices generate; synthesizeSpeech refuses retired
    // OpenAI folders (play-only) with a 400 and a message saying why.
    const { audio: buffer } = await synthesizeSpeech({
      voice,
      text,
      tone,
      usage: { userId, feature: AiFeature.TTS_CLIP },
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
