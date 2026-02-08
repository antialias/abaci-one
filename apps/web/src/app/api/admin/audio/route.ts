import { readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { appSettings, DEFAULT_APP_SETTINGS } from '@/db/schema'
import { AUDIO_MANIFEST } from '@/lib/audio/audioManifest'

const AUDIO_DIR = join(process.cwd(), 'public', 'audio')

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

    // Scan public/audio/ for voice directories
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

    return NextResponse.json({
      activeVoice,
      manifest: AUDIO_MANIFEST,
      voices,
    })
  } catch (error) {
    console.error('Error fetching audio status:', error)
    return NextResponse.json({ error: 'Failed to fetch audio status' }, { status: 500 })
  }
}
