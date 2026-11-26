/**
 * Server-side projection for a shared celebration song.
 *
 * Single source of truth for what a share code reveals — used by the public
 * API route (`/api/song-shares/[code]`), the public page (`/song/[code]`), and
 * its OG image. The raw `promptInput` never leaves this function; only the
 * fields the share's visibility toggles permit are returned, and the lyric
 * annotation engine runs *here*, after the gate, fed only permitted facts.
 * This is the privacy boundary for a child's data.
 *
 * The session's numbers (first-try accuracy, problems attempted of planned)
 * come from the session's report as it is now, not from the song's stored
 * input (Phase 4e, §10 P4e-3): a song is a snapshot taken during the last
 * part, and an adult's review may change the numbers after it. The stored
 * input answers only when the report cannot be built (the session is gone);
 * the story (streak, skills, arcs, moments) is the song's own and stays stored.
 */

import { eq, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { SessionReport } from '@/lib/curriculum/session-report'
import { getSessionReport } from '@/lib/curriculum/session-report-server'
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
import { DEFAULT_SONG_SHARE_VISIBILITY, type SongShareVisibility } from '@/db/schema/song-shares'

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
  gameBreaks?: Array<{ gameName?: string; headline?: string }>
  /** Inputs stored before Phase 3b carry one break here. */
  gameBreak?: { gameName?: string; headline?: string }
}

export interface SharedSongStats {
  age?: number
  /** First-try accuracy, as a whole percent (the report's; stored input on fallback) */
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
    /** The underlying session_songs row id — used by derived-asset routes
     *  (audio, alignment, preview MP4) that key on the file path
     *  data/audio/songs/{songId}.{ext}. Already exposed via audioPath; this
     *  field just saves callers from string-parsing the URL. */
    id: string
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
      sessionPlanId: schema.sessionSongs.sessionPlanId,
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

  // Legacy rows (written before a key was added to SongShareVisibility) lack
  // newer fields in the JSON column — spread the default first so every key
  // has a value before the page reads them.
  const visibility: SongShareVisibility = {
    ...DEFAULT_SONG_SHARE_VISIBILITY,
    ...(share.visibility as Partial<SongShareVisibility>),
  }

  // Only `showAccuracy` shows the report's numbers; with it off, skip the reads
  let report: SessionReport | null = null
  if (visibility.showAccuracy) {
    try {
      report = await getSessionReport(song.sessionPlanId)
    } catch (e) {
      console.error('song-share: session report not built; stored facts used', e)
    }
  }

  return projectSharedSong({
    visibility,
    llmOutput: song.llmOutput,
    promptInput: song.promptInput,
    report,
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
  /** The session's report; null or absent → the stored input's numbers */
  report?: Pick<SessionReport, 'totals'> | null
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
  if (visibility.showAccuracy && input.report) {
    const { totals } = input.report
    if (totals.firstTryAccuracy != null) {
      stats.accuracyPct = Math.round(totals.firstTryAccuracy * 100)
    }
    stats.problemsDone = totals.problems
    stats.problemsTotal = totals.plannedProblems
  } else if (visibility.showAccuracy && pi.currentSession) {
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
    const storedBreaks = Array.isArray(pi.gameBreaks)
      ? pi.gameBreaks
      : pi.gameBreak
        ? [pi.gameBreak]
        : []
    const gameBreaks = storedBreaks
      .filter((gb) => gb?.gameName)
      .map((gb) => ({ gameName: gb.gameName, headline: gb.headline }))
    if (gameBreaks.length > 0) facts.gameBreaks = gameBreaks
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
      id: songId,
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
