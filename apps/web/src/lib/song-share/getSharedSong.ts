/**
 * Server-side projection for a shared celebration song.
 *
 * Single source of truth for what a share code reveals — used by the public
 * API route (`/api/song-shares/[code]`), the public page (`/song/[code]`), and
 * its OG image. The raw `promptInput` never leaves this function; only the
 * fields the share's visibility toggles permit are returned, and the lyric
 * annotation engine runs *here*, after the gate, fed only permitted facts.
 * This is the privacy boundary for a child's data.
 */

import { eq, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import type {
  SongProblemMoment,
  SongSkillSpotlight,
} from '@/lib/session-song/extract-session-stats'
import {
  type AnnotateFacts,
  type AnnotatedSongSection,
  annotateSections,
} from '@/lib/song-share/annotate'
import { formatSkill } from '@/lib/song-share/sessionFacts'
import { parseSongPlan } from '@/lib/song-share/songPlan'
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
  practiceDrama?: {
    storyAngle?: string
    arcs?: string[]
    problemMoments?: SongProblemMoment[]
    skillSpotlights?: SongSkillSpotlight[]
  }
  gameBreak?: { gameName?: string; headline?: string }
}

export interface SharedSongStats {
  age?: number
  accuracyPct?: number
  problemsDone?: number
  problemsTotal?: number
  bestCorrectStreak?: number
  skills?: string[]
  storyAngle?: string
  /** A few human "what happened this session" lines (gated by problem detail). */
  highlights?: string[]
}

export interface SharedSongPayload {
  player: { name: string; emoji: string }
  song: {
    title: string | null
    audioPath: string
    /** Sidecar JSON path served by /api/audio/songs/{id}/alignment, or null if not present. */
    alignmentPath: string | null
    styles: string[]
    sections: AnnotatedSongSection[]
    createdAt: number
  }
  stats: SharedSongStats
  visibility: SongShareVisibility
}

/**
 * Resolve a share code to its projected payload, or `null` if the code is
 * missing/revoked or the song isn't a completed song (callers map null → 404).
 *
 * @param opts.bumpView increment the view counter (only the page render should;
 *   the OG image / API must not, or crawlers inflate the count)
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

  return projectSharedSong({
    visibility: share.visibility as SongShareVisibility,
    llmOutput: song.llmOutput,
    promptInput: song.promptInput,
    playerName: player?.name ?? 'A learner',
    playerEmoji: player?.emoji ?? '🧮',
    songId: song.id,
    createdAt: song.createdAt instanceof Date ? song.createdAt.getTime() : song.createdAt,
  })
}

/**
 * The privacy projection itself — pure, no I/O. Separated from the DB reads so
 * the toggle-gating contract can be unit-tested directly (and so the boundary
 * has exactly one implementation). `promptInput`/`llmOutput` come straight off
 * the row as `unknown`; nothing here returns them verbatim.
 */
export function projectSharedSong(input: {
  visibility: SongShareVisibility
  llmOutput: unknown
  promptInput: unknown
  playerName: string
  playerEmoji: string
  songId: string
  createdAt: number
}): SharedSongPayload {
  const { visibility, playerName, playerEmoji, songId, createdAt } = input
  const plan = parseSongPlan(input.llmOutput)
  const pi = (input.promptInput ?? {}) as PromptInputShape
  const firstName = playerName.trim().split(/\s+/)[0] || playerName

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
  const rawSkills = Array.isArray(pi.currentSession?.skillsPracticed)
    ? pi.currentSession!.skillsPracticed!
    : []
  if (visibility.showStreakSkills && pi.currentSession) {
    if (typeof pi.currentSession.bestCorrectStreak === 'number') {
      stats.bestCorrectStreak = pi.currentSession.bestCorrectStreak
    }
    if (rawSkills.length > 0) {
      stats.skills = rawSkills.map(formatSkill).slice(0, 8)
    }
  }
  if (visibility.showProblemDetail && typeof pi.practiceDrama?.storyAngle === 'string') {
    stats.storyAngle = pi.practiceDrama.storyAngle
  }
  if (visibility.showProblemDetail && Array.isArray(pi.practiceDrama?.arcs)) {
    const arcs = pi.practiceDrama.arcs.filter(
      (a): a is string => typeof a === 'string' && !!a.trim()
    )
    if (arcs.length > 0) stats.highlights = arcs.slice(0, 3)
  }

  // ---- Gated facts for the lyric annotation engine ----
  const facts: AnnotateFacts = { playerName: firstName }
  if (visibility.showProblemDetail) {
    if (Array.isArray(pi.practiceDrama?.problemMoments)) {
      facts.problemMoments = pi.practiceDrama.problemMoments
    }
    if (typeof pi.practiceDrama?.storyAngle === 'string') {
      facts.storyAngle = pi.practiceDrama.storyAngle
    }
    if (pi.gameBreak?.gameName) {
      facts.gameBreak = { gameName: pi.gameBreak.gameName, headline: pi.gameBreak.headline }
    }
  }
  if (visibility.showStreakSkills) {
    if (Array.isArray(pi.practiceDrama?.skillSpotlights)) {
      facts.skillSpotlights = pi.practiceDrama.skillSpotlights
    }
    if (rawSkills.length > 0) facts.skills = rawSkills
  }

  return {
    player: {
      name: playerName,
      emoji: playerEmoji,
    },
    song: {
      title: plan.title,
      audioPath: `/api/audio/songs/${songId}`,
      // Alignment sidecar — route 404s gracefully for legacy songs without timestamps,
      // and the player falls back to static lyrics in that case.
      alignmentPath: `/api/audio/songs/${songId}/alignment`,
      styles: plan.globalStyles,
      sections: annotateSections(plan.sections, facts),
      createdAt,
    },
    stats,
    visibility,
  }
}
