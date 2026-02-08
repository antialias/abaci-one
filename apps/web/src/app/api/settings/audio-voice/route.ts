import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { appSettings, DEFAULT_APP_SETTINGS } from '@/db/schema'

async function ensureDefaultSettings() {
  const existing = await db.select().from(appSettings).where(eq(appSettings.id, 'default')).limit(1)

  if (existing.length === 0) {
    await db.insert(appSettings).values({
      id: 'default',
      bktConfidenceThreshold: DEFAULT_APP_SETTINGS.bktConfidenceThreshold,
      audioVoice: DEFAULT_APP_SETTINGS.audioVoice,
    })
  }
}

/**
 * GET /api/settings/audio-voice
 *
 * Returns the active TTS voice name.
 */
export async function GET() {
  try {
    await ensureDefaultSettings()

    const [settings] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, 'default'))
      .limit(1)

    return NextResponse.json({
      audioVoice: settings?.audioVoice ?? DEFAULT_APP_SETTINGS.audioVoice,
    })
  } catch (error) {
    console.error('Error fetching audio voice setting:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

/**
 * PATCH /api/settings/audio-voice
 *
 * Updates the active TTS voice.
 *
 * Body: { audioVoice: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { audioVoice } = body

    if (typeof audioVoice !== 'string' || audioVoice.trim().length === 0) {
      return NextResponse.json({ error: 'audioVoice must be a non-empty string' }, { status: 400 })
    }

    await ensureDefaultSettings()

    await db
      .update(appSettings)
      .set({ audioVoice: audioVoice.trim() })
      .where(eq(appSettings.id, 'default'))

    return NextResponse.json({ audioVoice: audioVoice.trim() })
  } catch (error) {
    console.error('Error updating audio voice setting:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
