import { type NextRequest, NextResponse } from 'next/server'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'

const AUDIO_DIR = join(process.cwd(), 'data', 'audio')

/**
 * GET /api/audio/collected-clips/manifest?voices=onyx,nova
 *
 * Lightweight endpoint returning which collected clip IDs have pre-generated
 * mp3 files for each requested voice. Used by TtsAudioManager at boot to
 * know which clips can play pre-generated audio.
 *
 * Response: { clipIdsByVoice: { onyx: ["abc123", ...], nova: [...] } }
 */
export async function GET(request: NextRequest) {
  try {
    const voicesParam = request.nextUrl.searchParams.get('voices')
    if (!voicesParam) {
      return NextResponse.json({ clipIdsByVoice: {} })
    }

    const voices = voicesParam.split(',').map((v) => v.trim()).filter(Boolean)
    const clipIdsByVoice: Record<string, string[]> = {}

    for (const voice of voices) {
      const voiceDir = join(AUDIO_DIR, voice)
      if (!existsSync(voiceDir)) {
        clipIdsByVoice[voice] = []
        continue
      }

      const files = readdirSync(voiceDir)
      const ccClipIds = files
        .filter((f) => f.startsWith('cc-') && f.endsWith('.mp3'))
        .map((f) => f.slice(3, -4)) // strip "cc-" prefix and ".mp3" suffix

      clipIdsByVoice[voice] = ccClipIds
    }

    return NextResponse.json({ clipIdsByVoice })
  } catch (error) {
    console.error('Error fetching collected clips manifest:', error)
    return NextResponse.json(
      { error: 'Failed to fetch manifest' },
      { status: 500 },
    )
  }
}
