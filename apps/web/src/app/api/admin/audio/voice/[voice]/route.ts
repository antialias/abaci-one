import { existsSync, rmSync } from 'fs'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { appSettings, DEFAULT_APP_SETTINGS } from '@/db/schema'
import { withAuth } from '@/lib/auth/withAuth'

const AUDIO_DIR = join(process.cwd(), 'data', 'audio')

/**
 * DELETE /api/admin/audio/voice/[voice]
 *
 * Removes all clips for the given voice by deleting its directory.
 * Refuses to delete the currently active voice.
 */
export const DELETE = withAuth(async (_request, { params }) => {
  try {
    const { voice } = (await params) as { voice: string }

    if (!voice || voice.trim().length === 0) {
      return NextResponse.json({ error: 'voice parameter is required' }, { status: 400 })
    }

    // Check if this is the active voice
    const [settings] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, 'default'))
      .limit(1)

    const activeVoice = settings?.audioVoice ?? DEFAULT_APP_SETTINGS.audioVoice

    if (voice.trim() === activeVoice) {
      return NextResponse.json(
        { error: 'Cannot delete the active voice. Switch to a different voice first.' },
        { status: 400 }
      )
    }

    const voiceDir = join(AUDIO_DIR, voice.trim())

    if (!existsSync(voiceDir)) {
      return NextResponse.json({ error: 'Voice directory does not exist' }, { status: 404 })
    }

    rmSync(voiceDir, { recursive: true, force: true })

    return NextResponse.json({ removed: true })
  } catch (error) {
    console.error('Error removing voice:', error)
    return NextResponse.json({ error: 'Failed to remove voice' }, { status: 500 })
  }
}, { role: 'admin' })
