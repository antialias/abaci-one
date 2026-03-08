/**
 * Admin Songs API
 *
 * GET  /api/admin/songs — List all session songs with player/plan context
 * POST /api/admin/songs — Retry a failed song generation
 */

import { NextResponse } from 'next/server'
import { desc, eq, inArray } from 'drizzle-orm'
import { stat } from 'fs/promises'
import { db, schema } from '@/db'
import { withAuth } from '@/lib/auth/withAuth'
import { startSessionSongGeneration } from '@/lib/tasks/session-song'

export const GET = withAuth(
  async (request) => {
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
        backgroundTaskId: schema.sessionSongs.backgroundTaskId,
        triggerSource: schema.sessionSongs.triggerSource,
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

        const player = playerMap.get(song.playerId)

        // Extract title from llmOutput
        const llmOutput = song.llmOutput as Record<string, unknown> | null
        const title = (llmOutput?.title as string) ?? null

        // Extract composition plan summary
        const plan = llmOutput?.plan as Record<string, unknown> | null
        const sections = (plan?.sections as Array<Record<string, unknown>>) ?? []
        const sectionSummary = sections.map((s) => ({
          name: s.section_name as string,
          durationMs: s.duration_ms as number,
          lineCount: (s.lines as string[])?.length ?? 0,
        }))

        const positiveStyles = (plan?.positive_global_styles as string[]) ?? []
        const totalDurationMs = sections.reduce(
          (sum, s) => sum + ((s.duration_ms as number) ?? 0),
          0
        )

        return {
          id: song.id,
          sessionPlanId: song.sessionPlanId,
          playerId: song.playerId,
          playerName: player?.name ?? 'Unknown',
          playerEmoji: player?.emoji ?? '',
          status: song.status,
          title,
          triggerSource: song.triggerSource,
          errorMessage: song.errorMessage,
          backgroundTaskId: song.backgroundTaskId,
          fileExists,
          fileSizeBytes,
          durationSeconds: song.durationSeconds,
          createdAt: song.createdAt,
          completedAt: song.completedAt,
          // Composition plan observability
          styles: positiveStyles,
          totalDurationMs,
          sectionSummary,
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
      generating: allSongs.filter(
        (s) =>
          s.status === 'pending' || s.status === 'prompt_generating' || s.status === 'generating'
      ).length,
    }

    return NextResponse.json({ songs, stats })
  },
  { role: 'admin' }
)

export const POST = withAuth(
  async (request) => {
    const body = await request.json()
    const { songId, action } = body as { songId: string; action: string }

    if (action !== 'retry') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    // Look up the failed song
    const [song] = await db
      .select()
      .from(schema.sessionSongs)
      .where(eq(schema.sessionSongs.id, songId))
      .limit(1)

    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 })
    }

    if (song.status !== 'failed') {
      return NextResponse.json({ error: 'Can only retry failed songs' }, { status: 400 })
    }

    // Delete the failed record so startSessionSongGeneration creates a fresh one
    await db.delete(schema.sessionSongs).where(eq(schema.sessionSongs.id, songId))

    // Re-trigger generation
    const result = await startSessionSongGeneration({
      sessionPlanId: song.sessionPlanId,
      playerId: song.playerId,
      triggerSource:
        (song.triggerSource as 'smart_trigger' | 'completion_fallback') ?? 'completion_fallback',
    })

    return NextResponse.json({
      ok: true,
      newSongId: result.songId,
      taskId: result.taskId,
    })
  },
  { role: 'admin' }
)
