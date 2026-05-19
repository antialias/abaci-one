/**
 * Server-side projection for a shared celebration song.
 *
 * Single source of truth for what a share code reveals — used by both the
 * public API route (`/api/song-shares/[code]`) and the public page
 * (`/song/[code]`). The raw `promptInput` never leaves this function; only the
 * fields the share's visibility toggles permit are returned. This is the
 * privacy boundary for a child's data.
 */

import { eq, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { parseSongPlan, type ParsedSongSection } from '@/lib/song-share/songPlan'
import { formatSkill } from '@/lib/song-share/sessionFacts'
import type { SongShareVisibility } from '@/db/schema/song-shares'

interface PromptInputShape {
  player?: { name?: string; emoji?: string; age?: number }
  currentSession?: {
    accuracy?: number
    problemsDone?: number
    problemsTotal?: number
    bestCorrectStreak?: number
    skillsPracticed?: string[]
  }
  practiceDrama?: { storyAngle?: string }
}

export interface SharedSongStats {
  age?: number
  accuracyPct?: number
  problemsDone?: number
  problemsTotal?: number
  bestCorrectStreak?: number
  skills?: string[]
  storyAngle?: string
}

export interface SharedSongPayload {
  player: { name: string; emoji: string }
  song: {
    title: string | null
    audioPath: string
    styles: string[]
    sections: ParsedSongSection[]
    createdAt: number
  }
  stats: SharedSongStats
  visibility: SongShareVisibility
}

/**
 * Resolve a share code to its projected payload, or `null` if the code is
 * missing/revoked or the song isn't a completed song (callers map null → 404).
 *
 * @param opts.bumpView increment the view counter (only the page render should)
 */
export async function getSharedSong(
  code: string,
  opts: { bumpView?: boolean } = {}
): Promise<SharedSongPayload | null> {
  const [share] = await db
    .select({
      id: schema.songShares.id,
      songId: schema.songShares.songId,
      visibility: schema.songShares.visibility,
      status: schema.songShares.status,
    })
    .from(schema.songShares)
    .where(eq(schema.songShares.id, code))
    .limit(1)

  if (!share || share.status !== 'active') return null

  const [song] = await db
    .select({
      id: schema.sessionSongs.id,
      status: schema.sessionSongs.status,
      playerId: schema.sessionSongs.playerId,
      llmOutput: schema.sessionSongs.llmOutput,
      promptInput: schema.sessionSongs.promptInput,
      createdAt: schema.sessionSongs.createdAt,
    })
    .from(schema.sessionSongs)
    .where(eq(schema.sessionSongs.id, share.songId))
    .limit(1)

  if (!song || song.status !== 'completed') return null

  const [player] = await db
    .select({ name: schema.players.name, emoji: schema.players.emoji })
    .from(schema.players)
    .where(eq(schema.players.id, song.playerId))
    .limit(1)

  if (opts.bumpView) {
    try {
      await db
        .update(schema.songShares)
        .set({ views: sql`${schema.songShares.views} + 1`, lastViewedAt: new Date() })
        .where(eq(schema.songShares.id, code))
    } catch (e) {
      console.error('song-share view bump failed:', e)
    }
  }

  const visibility = share.visibility as SongShareVisibility
  const plan = parseSongPlan(song.llmOutput)
  const pi = (song.promptInput ?? {}) as PromptInputShape

  // ---- Projection (privacy boundary) ----
  const stats: SharedSongStats = {}
  if (visibility.showAge && typeof pi.player?.age === 'number') {
    stats.age = pi.player.age
  }
  if (visibility.showAccuracy && pi.currentSession) {
    if (typeof pi.currentSession.accuracy === 'number') {
      stats.accuracyPct = Math.round(pi.currentSession.accuracy * 100)
    }
    if (typeof pi.currentSession.problemsDone === 'number') {
      stats.problemsDone = pi.currentSession.problemsDone
    }
    if (typeof pi.currentSession.problemsTotal === 'number') {
      stats.problemsTotal = pi.currentSession.problemsTotal
    }
  }
  if (visibility.showStreakSkills && pi.currentSession) {
    if (typeof pi.currentSession.bestCorrectStreak === 'number') {
      stats.bestCorrectStreak = pi.currentSession.bestCorrectStreak
    }
    if (Array.isArray(pi.currentSession.skillsPracticed)) {
      stats.skills = pi.currentSession.skillsPracticed.map(formatSkill).slice(0, 8)
    }
  }
  if (visibility.showProblemDetail && typeof pi.practiceDrama?.storyAngle === 'string') {
    stats.storyAngle = pi.practiceDrama.storyAngle
  }

  return {
    player: {
      name: player?.name ?? 'A learner',
      emoji: player?.emoji ?? '🧮',
    },
    song: {
      title: plan.title,
      audioPath: `/api/audio/songs/${song.id}`,
      styles: plan.globalStyles,
      sections: plan.sections,
      createdAt: song.createdAt instanceof Date ? song.createdAt.getTime() : song.createdAt,
    },
    stats,
    visibility,
  }
}
