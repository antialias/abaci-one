import { existsSync, readdirSync, rmSync, statSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { ttsCollectedClips, ttsCollectedClipSay } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/requireRole'

const AUDIO_DIR = join(process.cwd(), 'data', 'audio')

/**
 * DELETE /api/admin/audio/voices
 *
 * Nuclear reset: removes all generated audio clips from disk AND all
 * collected clip records from the database.
 *
 * - Deletes every voice directory under data/audio/ (preserves the parent)
 * - Deletes all rows from tts_collected_clip_say then tts_collected_clips
 */
export async function DELETE() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    // 1. Remove voice directories from disk
    let removedDirs = 0
    if (existsSync(AUDIO_DIR)) {
      const entries = readdirSync(AUDIO_DIR)
      for (const entry of entries) {
        const entryPath = join(AUDIO_DIR, entry)
        if (statSync(entryPath).isDirectory()) {
          rmSync(entryPath, { recursive: true, force: true })
          removedDirs++
        }
      }
    }

    // 2. Clear collected clips from the database (child table first)
    await db.delete(ttsCollectedClipSay)
    await db.delete(ttsCollectedClips)

    return NextResponse.json({ removedDirs, clearedDb: true })
  } catch (error) {
    console.error('Error nuking all clips:', error)
    return NextResponse.json({ error: 'Failed to remove clips' }, { status: 500 })
  }
}
