/**
 * Admin Songs API
 *
 * GET  /api/admin/songs — List all session songs with player/plan context
 * POST /api/admin/songs — Retry/regenerate songs or flag content issues
 */

import { desc, eq, inArray } from 'drizzle-orm'
import { stat } from 'fs/promises'
import { NextResponse } from 'next/server'
import path from 'path'
import { db, schema } from '@/db'
import { withAuth } from '@/lib/auth/withAuth'
import {
  getAdminSongPlanSummary,
  getSongPlanValidationSummary,
} from '@/lib/session-song/admin-validation-summary'
import { parseSongPlan } from '@/lib/song-share/songPlan'
import {
  publishSuppressAlive,
  retrySessionSongGeneration,
  startSessionSongGeneration,
  startSuppressAliveLocal,
  type SessionSongRegenerationMode,
} from '@/lib/tasks/session-song'
import type { SessionSongTriggerSource } from '@/db/schema/session-songs'

export const GET = withAuth(
  async (request) => {
    try {
      const url = new URL(request.url)
      const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200)
      const statusFilter = url.searchParams.get('status')

      const allSongs = await db
        .select({
          id: schema.sessionSongs.id,
          sessionPlanId: schema.sessionSongs.sessionPlanId,
          playerId: schema.sessionSongs.playerId,
          status: schema.sessionSongs.status,
          promptInput: schema.sessionSongs.promptInput,
          llmOutput: schema.sessionSongs.llmOutput,
          localFilePath: schema.sessionSongs.localFilePath,
          durationSeconds: schema.sessionSongs.durationSeconds,
          errorMessage: schema.sessionSongs.errorMessage,
          failureKind: schema.sessionSongs.failureKind,
          backgroundTaskId: schema.sessionSongs.backgroundTaskId,
          triggerSource: schema.sessionSongs.triggerSource,
          contentReviewStatus: schema.sessionSongs.contentReviewStatus,
          contentReviewNote: schema.sessionSongs.contentReviewNote,
          contentReviewedAt: schema.sessionSongs.contentReviewedAt,
          contentReviewedBy: schema.sessionSongs.contentReviewedBy,
          regenerationCount: schema.sessionSongs.regenerationCount,
          lastRegenerationReason: schema.sessionSongs.lastRegenerationReason,
          lastRegenerationAt: schema.sessionSongs.lastRegenerationAt,
          createdAt: schema.sessionSongs.createdAt,
          completedAt: schema.sessionSongs.completedAt,
        })
        .from(schema.sessionSongs)
        .orderBy(desc(schema.sessionSongs.createdAt))
        .limit(limit)

      // Filter in JS (simpler than building dynamic SQL for optional filter)
      const filtered = statusFilter ? allSongs.filter((s) => s.status === statusFilter) : allSongs

      // Fetch player names for all songs
      const playerIds = [...new Set(filtered.map((s) => s.playerId))]
      const allPlayers =
        playerIds.length > 0
          ? await db
              .select({
                id: schema.players.id,
                name: schema.players.name,
                emoji: schema.players.emoji,
              })
              .from(schema.players)
              .where(
                playerIds.length === 1
                  ? eq(schema.players.id, playerIds[0])
                  : inArray(schema.players.id, playerIds)
              )
          : []

      const playerMap = new Map(allPlayers.map((p) => [p.id, p]))

      // Alignment sidecar lives next to the MP3 as `<songId>.json` — same dir
      // the public alignment route reads from.
      const songsDir = path.join(process.cwd(), 'data', 'audio', 'songs')

      // Check file existence for completed songs
      const songs = await Promise.all(
        filtered.map(async (song) => {
          let fileExists = false
          let fileSizeBytes: number | null = null

          if (song.localFilePath) {
            try {
              const stats = await stat(song.localFilePath)
              fileExists = true
              fileSizeBytes = stats.size
            } catch {
              fileExists = false
            }
          }

          let alignmentExists = false
          if (song.status === 'completed') {
            try {
              await stat(path.join(songsDir, `${song.id}.json`))
              alignmentExists = true
            } catch {
              alignmentExists = false
            }
          }

          const player = playerMap.get(song.playerId)
          const planSummary = getAdminSongPlanSummary(song.llmOutput)
          const validationSummary = getSongPlanValidationSummary(song.llmOutput)
          const parsedPlan = parseSongPlan(song.llmOutput)
          // Shape down to what SyncedLyricsPlayer accepts.
          const lyrics =
            song.status === 'completed'
              ? parsedPlan.sections.map((s) => ({
                  name: s.name,
                  lines: s.lines,
                  durationMs: s.durationMs,
                }))
              : []

          return {
            id: song.id,
            sessionPlanId: song.sessionPlanId,
            playerId: song.playerId,
            playerName: player?.name ?? 'Unknown',
            playerEmoji: player?.emoji ?? '',
            status: song.status,
            title: planSummary.title,
            triggerSource: song.triggerSource,
            errorMessage: song.errorMessage,
            failureKind: song.failureKind,
            backgroundTaskId: song.backgroundTaskId,
            contentReviewStatus: song.contentReviewStatus,
            contentReviewNote: song.contentReviewNote,
            contentReviewedAt: song.contentReviewedAt,
            contentReviewedBy: song.contentReviewedBy,
            regenerationCount: song.regenerationCount,
            lastRegenerationReason: song.lastRegenerationReason,
            lastRegenerationAt: song.lastRegenerationAt,
            fileExists,
            fileSizeBytes,
            alignmentExists,
            lyrics,
            durationSeconds: song.durationSeconds,
            createdAt: song.createdAt,
            completedAt: song.completedAt,
            // Composition plan observability
            styles: planSummary.styles,
            totalDurationMs: planSummary.totalDurationMs,
            sectionSummary: planSummary.sectionSummary,
            ...validationSummary,
            // Full data for detail view
            promptInput: song.promptInput,
            llmOutput: song.llmOutput,
          }
        })
      )

      // Aggregate stats
      const stats = {
        total: allSongs.length,
        completed: allSongs.filter((s) => s.status === 'completed').length,
        failed: allSongs.filter((s) => s.status === 'failed').length,
        flagged: allSongs.filter((s) => s.contentReviewStatus === 'flagged').length,
        generating: allSongs.filter(
          (s) =>
            s.status === 'pending' || s.status === 'prompt_generating' || s.status === 'generating'
        ).length,
        validationFlagged: songs.filter((s) => s.validationIssueCount > 0).length,
        validationRepaired: songs.filter((s) => s.validationOutcome === 'repaired').length,
        validationFallback: songs.filter((s) => s.validationOutcome === 'fallback').length,
        validationBlocked: songs.filter((s) => s.validationOutcome === 'blocked').length,
      }

      return NextResponse.json({ songs, stats })
    } catch (error) {
      console.error('[admin/songs] Failed to fetch songs:', error)
      return NextResponse.json({ error: 'Failed to fetch songs' }, { status: 500 })
    }
  },
  { role: 'admin' }
)

export const POST = withAuth(
  async (request, { userId }) => {
    const body = await request.json()
    const { songId, action } = body as {
      songId: string
      action: string
      mode?: SessionSongRegenerationMode
      reason?: string
    }

    if (!songId) {
      return NextResponse.json({ error: 'Song ID is required' }, { status: 400 })
    }

    if (
      ![
        'retry',
        'regenerate',
        'spawn',
        'flag_content',
        'clear_content_flag',
        'suppress_alive',
      ].includes(action)
    ) {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    // Look up the song
    const [song] = await db
      .select()
      .from(schema.sessionSongs)
      .where(eq(schema.sessionSongs.id, songId))
      .limit(1)

    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    }

    if (action === 'spawn') {
      const result = await startSessionSongGeneration(
        {
          sessionPlanId: song.sessionPlanId,
          playerId: song.playerId,
          triggerSource:
            (song.triggerSource as SessionSongTriggerSource | null) ?? 'completion_fallback',
        },
        userId,
        { force: true }
      )

      return NextResponse.json({
        ok: true,
        songId: result.songId,
        taskId: result.taskId,
      })
    }

    if (action === 'flag_content') {
      const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
      if (!reason) {
        return NextResponse.json({ error: 'Flag reason is required' }, { status: 400 })
      }

      await db
        .update(schema.sessionSongs)
        .set({
          contentReviewStatus: 'flagged',
          contentReviewNote: reason,
          contentReviewedAt: new Date(),
          contentReviewedBy: userId,
        })
        .where(eq(schema.sessionSongs.id, songId))

      return NextResponse.json({ ok: true })
    }

    if (action === 'suppress_alive') {
      if (!song.backgroundTaskId) {
        return NextResponse.json(
          { error: 'Song has no active background task to suppress' },
          { status: 400 }
        )
      }
      if (
        song.status !== 'pending' &&
        song.status !== 'prompt_generating' &&
        song.status !== 'generating'
      ) {
        return NextResponse.json(
          { error: 'Song is not currently generating — suppress-alive is a no-op' },
          { status: 400 }
        )
      }
      // Always apply locally so single-pod / no-Redis dev environments work;
      // also publish for cross-pod fan-out when Redis is available.
      startSuppressAliveLocal(song.backgroundTaskId)
      const fannedOut = await publishSuppressAlive(song.backgroundTaskId)
      return NextResponse.json({
        ok: true,
        taskId: song.backgroundTaskId,
        durationMs: 60_000,
        fannedOut,
      })
    }

    if (action === 'clear_content_flag') {
      await db
        .update(schema.sessionSongs)
        .set({
          contentReviewStatus: 'none',
          contentReviewNote: null,
          contentReviewedAt: new Date(),
          contentReviewedBy: userId,
        })
        .where(eq(schema.sessionSongs.id, songId))

      return NextResponse.json({ ok: true })
    }

    const requestedMode = body.mode ?? (action === 'regenerate' ? 'regenerate_prompt' : 'auto')
    if (!['auto', 'reuse_prompt', 'regenerate_prompt'].includes(requestedMode)) {
      return NextResponse.json({ error: 'Invalid regeneration mode' }, { status: 400 })
    }

    const result = await retrySessionSongGeneration(songId, {
      mode: requestedMode,
      reason: typeof body.reason === 'string' ? body.reason : undefined,
      userId,
    })

    return NextResponse.json({
      ok: true,
      songId: result.songId,
      taskId: result.taskId,
      mode: result.mode,
    })
  },
  { role: 'admin' }
)
