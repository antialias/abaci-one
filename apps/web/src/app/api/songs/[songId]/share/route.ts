/**
 * Owner-only share management for a celebration song.
 *
 * POST   /api/songs/[songId]/share          create a permanent share link
 * GET    /api/songs/[songId]/share          list active shares for the song
 * PATCH  /api/songs/[songId]/share?token=   update a share's visibility toggles
 * DELETE /api/songs/[songId]/share?token=   revoke a share link
 *
 * Authorization: only a parent of the song's player (isParentOf). Songs must be
 * `completed` and not content-flagged before they can be shared publicly.
 */

import { and, desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { withAuth } from '@/lib/auth/withAuth'
import { isParentOf } from '@/lib/classroom'
import { generateShareId } from '@/lib/generateShareId'
import { getShareUrl } from '@/lib/share/urls'
import { DEFAULT_SONG_SHARE_VISIBILITY, type SongShareVisibility } from '@/db/schema/song-shares'

const VISIBILITY_KEYS: (keyof SongShareVisibility)[] = [
  'showAge',
  'showAccuracy',
  'showProblemDetail',
  'showStreakSkills',
  'autoPlay',
]

/**
 * Coerce arbitrary input into a fully-populated visibility object. Keys default
 * to DEFAULT_SONG_SHARE_VISIBILITY (which differs per key — privacy toggles
 * default false, autoPlay defaults true); only an explicit boolean overrides.
 */
function sanitizeVisibility(input: unknown): SongShareVisibility {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const result = { ...DEFAULT_SONG_SHARE_VISIBILITY }
  for (const key of VISIBILITY_KEYS) {
    if (typeof source[key] === 'boolean') result[key] = source[key] as boolean
  }
  return result
}

/** Load the song and assert the viewer is a parent of its player. */
async function loadOwnedSong(songId: string, userId: string) {
  const [song] = await db
    .select({
      id: schema.sessionSongs.id,
      playerId: schema.sessionSongs.playerId,
      status: schema.sessionSongs.status,
      contentReviewStatus: schema.sessionSongs.contentReviewStatus,
    })
    .from(schema.sessionSongs)
    .where(eq(schema.sessionSongs.id, songId))
    .limit(1)

  if (!song) return { error: NextResponse.json({ error: 'Song not found' }, { status: 404 }) }

  const isParent = await isParentOf(userId, song.playerId)
  if (!isParent) {
    return { error: NextResponse.json({ error: 'Not authorized' }, { status: 403 }) }
  }

  return { song }
}

export const POST = withAuth(async (request, { userId, params }) => {
  try {
    const { songId } = (await params) as { songId: string }
    const { song, error } = await loadOwnedSong(songId, userId)
    if (error) return error

    if (song.status !== 'completed') {
      return NextResponse.json({ error: 'Only completed songs can be shared' }, { status: 409 })
    }
    if (song.contentReviewStatus === 'flagged') {
      return NextResponse.json(
        { error: 'This song is under content review and cannot be shared' },
        { status: 409 }
      )
    }

    let body: unknown = {}
    try {
      body = await request.json()
    } catch {
      // empty body is fine — defaults to all-off visibility
    }
    const visibility = sanitizeVisibility((body as { visibility?: unknown })?.visibility)

    // Generate a unique short code (retry on collision — 62^7 keyspace)
    let shareId = generateShareId()
    let isUnique = false
    for (let attempts = 0; attempts < 5 && !isUnique; attempts++) {
      shareId = generateShareId()
      const existing = await db.query.songShares.findFirst({
        where: eq(schema.songShares.id, shareId),
      })
      if (!existing) isUnique = true
    }
    if (!isUnique) {
      return NextResponse.json({ error: 'Failed to generate unique share ID' }, { status: 500 })
    }

    await db.insert(schema.songShares).values({
      id: shareId,
      songId: song.id,
      playerId: song.playerId,
      createdBy: userId,
      visibility,
      status: 'active',
      views: 0,
      createdAt: new Date(),
    })

    // Fire-and-forget pre-generation of the iMessage preview MP4. Apple's
    // LinkPresentation crawler hits the link within seconds of paste, and
    // ffmpeg-wrapping the audio takes 1–3s — warming the cache now means
    // the crawler usually finds a static file. If this HEAD fails, the
    // route's lazy path still generates on first real hit.
    const previewOrigin = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
    void fetch(`${previewOrigin}/api/song-share/${shareId}/preview.mp4`, { method: 'HEAD' }).catch(
      () => {}
    )

    return NextResponse.json({
      id: shareId,
      url: getShareUrl('song', shareId),
      visibility,
    })
  } catch (err) {
    console.error('Error creating song share:', err)
    return NextResponse.json({ error: 'Failed to create share' }, { status: 500 })
  }
})

export const GET = withAuth(async (_request, { userId, params }) => {
  try {
    const { songId } = (await params) as { songId: string }
    const { song, error } = await loadOwnedSong(songId, userId)
    if (error) return error

    const shares = await db
      .select({
        id: schema.songShares.id,
        visibility: schema.songShares.visibility,
        views: schema.songShares.views,
        createdAt: schema.songShares.createdAt,
        lastViewedAt: schema.songShares.lastViewedAt,
      })
      .from(schema.songShares)
      .where(and(eq(schema.songShares.songId, song.id), eq(schema.songShares.status, 'active')))
      .orderBy(desc(schema.songShares.createdAt))

    return NextResponse.json({
      shares: shares.map((s) => ({
        id: s.id,
        url: getShareUrl('song', s.id),
        visibility: s.visibility,
        views: s.views,
        createdAt: s.createdAt instanceof Date ? s.createdAt.getTime() : s.createdAt,
        lastViewedAt:
          s.lastViewedAt instanceof Date ? s.lastViewedAt.getTime() : (s.lastViewedAt ?? null),
      })),
    })
  } catch (err) {
    console.error('Error listing song shares:', err)
    return NextResponse.json({ error: 'Failed to list shares' }, { status: 500 })
  }
})

export const PATCH = withAuth(async (request, { userId, params }) => {
  try {
    const { songId } = (await params) as { songId: string }
    const token = request.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 })
    }

    const { song, error } = await loadOwnedSong(songId, userId)
    if (error) return error

    const [share] = await db
      .select({ id: schema.songShares.id, songId: schema.songShares.songId })
      .from(schema.songShares)
      .where(eq(schema.songShares.id, token))
      .limit(1)
    if (!share || share.songId !== song.id) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as { visibility?: unknown }
    const visibility = sanitizeVisibility(body?.visibility)

    await db.update(schema.songShares).set({ visibility }).where(eq(schema.songShares.id, token))

    return NextResponse.json({ id: token, visibility })
  } catch (err) {
    console.error('Error updating song share:', err)
    return NextResponse.json({ error: 'Failed to update share' }, { status: 500 })
  }
})

export const DELETE = withAuth(async (request, { userId, params }) => {
  try {
    const { songId } = (await params) as { songId: string }
    const token = request.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'token required' }, { status: 400 })
    }

    const { song, error } = await loadOwnedSong(songId, userId)
    if (error) return error

    const [share] = await db
      .select({ id: schema.songShares.id, songId: schema.songShares.songId })
      .from(schema.songShares)
      .where(eq(schema.songShares.id, token))
      .limit(1)
    if (!share || share.songId !== song.id) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 })
    }

    await db
      .update(schema.songShares)
      .set({ status: 'revoked' })
      .where(eq(schema.songShares.id, token))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error revoking song share:', err)
    return NextResponse.json({ error: 'Failed to revoke share' }, { status: 500 })
  }
})
