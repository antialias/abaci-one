/**
 * API route for on-demand TTS clip generation.
 *
 * POST /api/audio/generate-clip
 * Body: { voice: string, clipId: string, text: string, tone: string }
 * Returns: audio/mpeg bytes (or JSON error)
 *
 * Generates a clip via OpenAI TTS, caches it to disk, and returns the audio.
 * If the clip already exists on disk, returns the cached version.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { NextResponse } from 'next/server'
import { join } from 'path'
import { withAuth } from '@/lib/auth/withAuth'

const AUDIO_DIR = join(process.cwd(), 'data', 'audio')

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json()
    const { voice, clipId, text, tone } = body

    // Validate required fields
    if (!voice || !clipId || !text) {
      return NextResponse.json({ error: 'voice, clipId, and text are required' }, { status: 400 })
    }

    // Prevent directory traversal
    if (
      voice.includes('/') ||
      voice.includes('..') ||
      clipId.includes('/') ||
      clipId.includes('..')
    ) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    // Check API key
    const apiKey = process.env.LLM_OPENAI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 503 })
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

    // Call OpenAI TTS
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice,
        input: text,
        instructions: tone || undefined,
        response_format: 'mp3',
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[generate-clip] OpenAI error:', response.status, errText)
      return NextResponse.json({ error: `OpenAI error: ${response.status}` }, { status: 502 })
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

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
    console.error('[generate-clip] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
