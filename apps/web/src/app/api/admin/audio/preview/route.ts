import { type NextRequest, NextResponse } from 'next/server'
import { AiFeature } from '@/lib/ai-usage/features'
import { withAuth } from '@/lib/auth/withAuth'
import { SpeechError, synthesizeSpeech } from '@/lib/speech/synthesize'

/**
 * POST /api/admin/audio/preview
 *
 * Ephemeral preview — speaks the text in an ElevenLabs voice and returns the
 * mp3. Nothing is saved to disk. Retired OpenAI voices are refused (400).
 */
export const POST = withAuth(
  async (request: NextRequest, { userId }) => {
    let body: { voice?: string; text?: string; tone?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { voice, text, tone } = body
    if (!voice || !text) {
      return NextResponse.json({ error: 'voice and text are required' }, { status: 400 })
    }

    try {
      const { audio } = await synthesizeSpeech({
        voice,
        text,
        tone,
        usage: { userId, feature: AiFeature.TTS_PREVIEW },
      })
      return new NextResponse(new Uint8Array(audio), {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audio.byteLength.toString(),
          'Cache-Control': 'no-store',
        },
      })
    } catch (err) {
      if (err instanceof SpeechError) {
        return NextResponse.json({ error: err.message }, { status: err.httpStatus })
      }
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Unknown error' },
        { status: 500 }
      )
    }
  },
  { role: 'admin' }
)
