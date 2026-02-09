import { type NextRequest, NextResponse } from 'next/server'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'

const AUDIO_DIR = join(process.cwd(), 'data', 'audio')

/**
 * GET /api/audio/collected-clips/manifest?voices=onyx,nova
 *
 * Lightweight endpoint returning which clip IDs have pre-generated mp3 files
 * for each requested voice. Includes both static manifest clips ({clipId}.mp3)
 * and collected clips (cc-{clipId}.mp3). Used by TtsAudioManager at boot to
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
      const clipIds: string[] = []
      for (const f of files) {
        if (!f.endsWith('.mp3')) continue
        if (f.startsWith('cc-')) {
          // Collected clip: cc-{clipId}.mp3 → clipId
          clipIds.push(f.slice(3, -4))
        } else {
          // Static manifest clip: {clipId}.mp3 → clipId
          clipIds.push(f.slice(0, -4))
        }
      }

      clipIdsByVoice[voice] = clipIds
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
