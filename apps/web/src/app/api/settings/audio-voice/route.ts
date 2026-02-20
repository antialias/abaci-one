import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { appSettings, DEFAULT_APP_SETTINGS } from '@/db/schema'
import { withAuth } from '@/lib/auth/withAuth'

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
export const GET = withAuth(async () => {
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
})

/**
 * PATCH /api/settings/audio-voice
 *
 * Updates the active TTS voice.
 *
 * Body: { audioVoice: string }
 */
export const PATCH = withAuth(async (request) => {
  try {
    const body = await request.json()
    const { audioVoice } = body

    if (typeof audioVoice !== 'string' || audioVoice.trim().length === 0) {
      return NextResponse.json({ error: 'audioVoice must be a non-empty string' }, { status: 400 })
    }

    await ensureDefaultSettings()

    const trimmed = audioVoice.trim()

    // Also update the voice chain: replace the first pregenerated entry's name
    const [current] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, 'default'))
      .limit(1)

    type VoiceSource = { type: 'pregenerated'; name: string } | { type: 'browser-tts' }
    let chain: VoiceSource[] = [{ type: 'pregenerated', name: trimmed }, { type: 'browser-tts' }]
    if (current?.voiceChain) {
      try {
        const parsed = JSON.parse(current.voiceChain) as VoiceSource[]
        let replaced = false
        chain = parsed.map((s) => {
          if (s.type === 'pregenerated' && !replaced) {
            replaced = true
            return { type: 'pregenerated' as const, name: trimmed }
          }
          return s
        })
        if (!replaced) {
          chain.unshift({ type: 'pregenerated', name: trimmed })
        }
      } catch {
        // Keep the default chain
      }
    }

    await db
      .update(appSettings)
      .set({ audioVoice: trimmed, voiceChain: JSON.stringify(chain) })
      .where(eq(appSettings.id, 'default'))

    return NextResponse.json({ audioVoice: trimmed })
  } catch (error) {
    console.error('Error updating audio voice setting:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
})
