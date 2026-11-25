/**
 * MCP tools for a student's session songs: see which songs failed, and retry them.
 *
 * Retry is limited to failed songs. It reuses the admin retry path
 * (retrySessionSongGeneration): the failed row is the queue, a saved
 * composition plan resumes at the music step, and without one the lyrics are
 * written again from the session's data. Regenerating a song that worked stays
 * an admin action.
 */

import { and, desc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { retrySessionSongGeneration } from '@/lib/tasks/session-song'

type SessionSongRow = typeof schema.sessionSongs.$inferSelect

const IN_PROGRESS_STATUSES = ['pending', 'prompt_generating', 'generating']

export const SONG_STATUS_FILTERS = ['all', 'failed', 'completed', 'in_progress'] as const
export type SongStatusFilter = (typeof SONG_STATUS_FILTERS)[number]

export const SONG_TOOLS = [
  {
    name: 'list_session_songs',
    description:
      "List a student's session songs, newest first: status, why a song failed, its title once written, and the practice session it belongs to.",
    inputSchema: {
      type: 'object',
      properties: {
        player_id: {
          type: 'string',
          description: 'The student player ID',
        },
        status: {
          type: 'string',
          enum: [...SONG_STATUS_FILTERS],
          description:
            'Which songs to list (default all). in_progress = pending, writing lyrics, or making music.',
        },
        limit: {
          type: 'number',
          description: 'Maximum songs to return (default 20, max 100)',
        },
      },
      required: ['player_id'],
    },
  },
  {
    name: 'retry_session_song',
    description:
      'Retry a failed session song. Resumes at the music step when its lyrics were saved, otherwise writes them again from the session. Generation runs in the background (about 1-3 minutes); follow it with list_session_songs. Only failed songs can be retried.',
    inputSchema: {
      type: 'object',
      properties: {
        player_id: {
          type: 'string',
          description: 'The student player ID',
        },
        song_id: {
          type: 'string',
          description: 'The session song ID (from list_session_songs)',
        },
      },
      required: ['player_id', 'song_id'],
    },
  },
]

function songTitle(llmOutput: unknown): string | null {
  if (llmOutput && typeof llmOutput === 'object' && 'title' in llmOutput) {
    const title = (llmOutput as { title?: unknown }).title
    return typeof title === 'string' ? title : null
  }
  return null
}

/** What the MCP shows of one song. */
export function summarizeSong(song: SessionSongRow) {
  return {
    song_id: song.id,
    session_plan_id: song.sessionPlanId,
    status: song.status,
    title: songTitle(song.llmOutput),
    failure_kind: song.failureKind ?? null,
    error: song.errorMessage ? song.errorMessage.slice(0, 300) : null,
    created_at: song.createdAt?.toISOString() ?? null,
    completed_at: song.completedAt?.toISOString() ?? null,
    regeneration_count: song.regenerationCount,
  }
}

export async function listSessionSongs(
  playerId: string,
  status: SongStatusFilter = 'all',
  limit = 20
) {
  if (!SONG_STATUS_FILTERS.includes(status)) {
    throw new Error(`status must be one of ${SONG_STATUS_FILTERS.join(', ')}`)
  }
  const capped = Math.min(Math.max(Math.trunc(limit) || 20, 1), 100)
  const statusCondition =
    status === 'all'
      ? undefined
      : status === 'in_progress'
        ? inArray(schema.sessionSongs.status, IN_PROGRESS_STATUSES)
        : eq(schema.sessionSongs.status, status)

  const songs = await db
    .select()
    .from(schema.sessionSongs)
    .where(and(eq(schema.sessionSongs.playerId, playerId), statusCondition))
    .orderBy(desc(schema.sessionSongs.createdAt))
    .limit(capped)

  return { songs: songs.map(summarizeSong) }
}

/** Why this song can't be retried through the MCP, or null when it can. */
export function retryRefusal(
  song: Pick<SessionSongRow, 'playerId' | 'status'> | undefined,
  playerId: string
): string | null {
  if (!song || song.playerId !== playerId) return 'Song not found for this student'
  if (song.status !== 'failed') {
    return `Only failed songs can be retried (this one is ${song.status})`
  }
  return null
}

export async function retrySessionSong(playerId: string, songId: string, userId: string) {
  if (!songId) throw new Error('song_id is required')

  const [song] = await db
    .select({ playerId: schema.sessionSongs.playerId, status: schema.sessionSongs.status })
    .from(schema.sessionSongs)
    .where(eq(schema.sessionSongs.id, songId))
    .limit(1)

  const refusal = retryRefusal(song, playerId)
  if (refusal) throw new Error(refusal)

  const result = await retrySessionSongGeneration(songId, {
    userId,
    reason: 'Retried via MCP',
  })

  return {
    song_id: result.songId,
    task_id: result.taskId,
    mode: result.mode,
    message:
      result.mode === 'reuse_prompt'
        ? 'Making the music from the saved lyrics; follow it with list_session_songs'
        : 'Writing the lyrics again, then the music; follow it with list_session_songs',
  }
}
