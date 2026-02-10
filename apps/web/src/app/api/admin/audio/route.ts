import { readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'
import { eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { appSettings, DEFAULT_APP_SETTINGS, ttsCollectedClips } from '@/db/schema'
import { AUDIO_MANIFEST } from '@/lib/audio/audioManifest'
import { ALL_VOICES } from '@/lib/audio/voices'

const AUDIO_DIR = join(process.cwd(), 'data', 'audio')

/**
 * GET /api/admin/audio
 *
 * Returns the audio manifest, active voice, and per-voice clip counts.
 */
export async function GET() {
  try {
    // Fetch active voice from DB
    const [settings] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, 'default'))
      .limit(1)

    const activeVoice = settings?.audioVoice ?? DEFAULT_APP_SETTINGS.audioVoice

    // Scan data/audio/ for voice directories
    const voices: Record<string, { total: number; existing: number }> = {}
    const manifestFilenames = new Set(AUDIO_MANIFEST.map((e) => e.filename))

    if (existsSync(AUDIO_DIR)) {
      const entries = readdirSync(AUDIO_DIR)
      for (const entry of entries) {
        const entryPath = join(AUDIO_DIR, entry)
        if (statSync(entryPath).isDirectory()) {
          const files = readdirSync(entryPath)
          const existingCount = files.filter((f) => manifestFilenames.has(f)).length
          voices[entry] = {
            total: AUDIO_MANIFEST.length,
            existing: existingCount,
          }
        }
      }
    }

    // Count total collected clips (denominator for health metric)
    const [{ count: totalCollectedClips }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(ttsCollectedClips)

    // Count .mp3 files per voice directory for all known voices
    const voiceClipCounts: Record<string, number> = {}
    for (const voice of ALL_VOICES) {
      const voiceDir = join(AUDIO_DIR, voice)
      if (existsSync(voiceDir)) {
        const files = readdirSync(voiceDir)
        voiceClipCounts[voice] = files.filter((f) => f.endsWith('.mp3')).length
      } else {
        voiceClipCounts[voice] = 0
      }
    }

    return NextResponse.json({
      activeVoice,
      manifest: AUDIO_MANIFEST,
      voices,
      totalCollectedClips,
      voiceClipCounts,
    })
  } catch (error) {
    console.error('Error fetching audio status:', error)
    return NextResponse.json({ error: 'Failed to fetch audio status' }, { status: 500 })
  }
}
