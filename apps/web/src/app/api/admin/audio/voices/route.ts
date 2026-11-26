import { existsSync, readdirSync, rmSync, statSync } from 'fs'
import { NextResponse } from 'next/server'
import { join } from 'path'
import { db } from '@/db'
import { ttsCollectedClipSay, ttsCollectedClips } from '@/db/schema'
import { isNonVoiceFolder } from '@/lib/audio/voices'
import { withAuth } from '@/lib/auth/withAuth'

function audioDir(): string {
  return join(process.cwd(), 'data', 'audio')
}

/**
 * DELETE /api/admin/audio/voices
 *
 * Nuclear reset: removes all generated audio clips from disk AND all
 * collected clip records from the database.
 *
 * - Deletes every voice directory under data/audio/ (preserves the parent,
 *   and non-voice folders: `songs` holds children's session songs)
 * - Deletes all rows from tts_collected_clip_say then tts_collected_clips
 */
export const DELETE = withAuth(
  async () => {
    try {
      // 1. Remove voice directories from disk
      let removedDirs = 0
      const dir = audioDir()
      if (existsSync(dir)) {
        const entries = readdirSync(dir)
        for (const entry of entries) {
          const entryPath = join(dir, entry)
          if (!isNonVoiceFolder(entry) && statSync(entryPath).isDirectory()) {
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
  },
  { role: 'admin' }
)
