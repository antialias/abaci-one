import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { appSettings, DEFAULT_APP_SETTINGS } from '@/db/schema'

type VoiceSource = { type: 'pregenerated'; name: string } | { type: 'browser-tts' }

async function ensureDefaultSettings() {
  const existing = await db.select().from(appSettings).where(eq(appSettings.id, 'default')).limit(1)
  if (existing.length === 0) {
    await db.insert(appSettings).values({
      id: 'default',
      bktConfidenceThreshold: DEFAULT_APP_SETTINGS.bktConfidenceThreshold,
      audioVoice: DEFAULT_APP_SETTINGS.audioVoice,
      voiceChain: DEFAULT_APP_SETTINGS.voiceChain,
    })
  }
}

function isValidVoiceChain(chain: unknown): chain is VoiceSource[] {
  if (!Array.isArray(chain)) return false
  return chain.every(
    (entry) =>
      (entry &&
        typeof entry === 'object' &&
        entry.type === 'pregenerated' &&
        typeof entry.name === 'string') ||
      (entry && typeof entry === 'object' && entry.type === 'browser-tts')
  )
}

/**
 * GET /api/settings/voice-chain
 *
 * Returns the voice chain configuration.
 */
export async function GET() {
  try {
    await ensureDefaultSettings()

    const [settings] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, 'default'))
      .limit(1)

    const raw = settings?.voiceChain ?? DEFAULT_APP_SETTINGS.voiceChain
    const voiceChain: VoiceSource[] = raw
      ? JSON.parse(raw)
      : [{ type: 'pregenerated', name: 'nova' }, { type: 'browser-tts' }]

    return NextResponse.json({ voiceChain })
  } catch (error) {
    console.error('Error fetching voice chain setting:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

/**
 * PATCH /api/settings/voice-chain
 *
 * Updates the voice chain configuration.
 *
 * Body: { voiceChain: VoiceSource[] }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { voiceChain } = body

    if (!isValidVoiceChain(voiceChain)) {
      return NextResponse.json(
        { error: 'voiceChain must be an array of valid voice sources' },
        { status: 400 }
      )
    }

    await ensureDefaultSettings()

    const serialized = JSON.stringify(voiceChain)

    // Also update audioVoice to match the first pregenerated voice for backward compat
    const firstPregenerated = voiceChain.find(
      (v): v is { type: 'pregenerated'; name: string } => v.type === 'pregenerated'
    )

    const updates: Record<string, string> = { voiceChain: serialized }
    if (firstPregenerated) {
      updates.audioVoice = firstPregenerated.name
    }

    await db.update(appSettings).set(updates).where(eq(appSettings.id, 'default'))

    return NextResponse.json({ voiceChain })
  } catch (error) {
    console.error('Error updating voice chain setting:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
