/**
 * Admin System Health API
 *
 * GET /api/admin/system-health
 *
 * Surfaces aggregated signals about server-level config issues that affect
 * background generation pipelines (currently: session-song failures from
 * shared OpenAI / ElevenLabs credentials).
 */

import { NextResponse } from 'next/server'
import { sql, and, eq, gte } from 'drizzle-orm'
import { db, schema } from '@/db'
import { withAuth } from '@/lib/auth/withAuth'
import type { SessionSongFailureKind } from '@/db/schema/session-songs'
import { classifySongFailure } from '@/lib/session-song/classify-failure'

interface SongFailureGroup {
  failureKind: SessionSongFailureKind | 'unknown'
  count: number
  latestErrorMessage: string | null
  latestAt: number
}

export const GET = withAuth(
  async () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Group recent (last 24h) failed songs by failure_kind. Pull the latest
    // error message per group for inline detail in the banner.
    const rows = await db
      .select({
        failureKind: schema.sessionSongs.failureKind,
        count: sql<number>`COUNT(*)`,
        latestAt: sql<number>`MAX(${schema.sessionSongs.createdAt})`,
      })
      .from(schema.sessionSongs)
      .where(
        and(eq(schema.sessionSongs.status, 'failed'), gte(schema.sessionSongs.createdAt, oneDayAgo))
      )
      .groupBy(schema.sessionSongs.failureKind)

    // For each group, fetch the latest error message (capped, owner-only-ish:
    // the route is admin-gated so leaking the raw message is acceptable).
    const groups: SongFailureGroup[] = []
    for (const row of rows) {
      const [latest] = await db
        .select({
          errorMessage: schema.sessionSongs.errorMessage,
        })
        .from(schema.sessionSongs)
        .where(
          and(
            eq(schema.sessionSongs.status, 'failed'),
            row.failureKind === null
              ? sql`${schema.sessionSongs.failureKind} IS NULL`
              : eq(schema.sessionSongs.failureKind, row.failureKind),
            gte(schema.sessionSongs.createdAt, oneDayAgo)
          )
        )
        .orderBy(sql`${schema.sessionSongs.createdAt} DESC`)
        .limit(1)

      const classified = classifySongFailure(
        latest?.errorMessage ?? row.failureKind ?? 'unknown'
      ).kind

      // `MAX(created_at)` comes back as raw INTEGER seconds (drizzle's
      // timestamp mode stores epoch seconds). Convert to ms for the client.
      groups.push({
        failureKind: classified,
        count: Number(row.count),
        latestErrorMessage: latest?.errorMessage ?? null,
        latestAt: Number(row.latestAt) * 1000,
      })
    }

    return NextResponse.json({
      songFailures: groups,
      windowHours: 24,
      generatedAt: Date.now(),
    })
  },
  { role: 'admin' }
)
