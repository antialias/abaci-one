import { NextResponse, type NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import type { PostcardManifest } from '@/db/schema/number-line-postcards'
import { startPostcardGenerate } from '@/lib/tasks/postcard-generate'

/** POST /api/postcards — create a new postcard from a voice call */
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const userId = await getUserId()
    const body = await request.json()
    const { playerId, manifest } = body as {
      playerId?: string
      manifest: PostcardManifest
    }

    if (!manifest || !manifest.moments || manifest.moments.length === 0) {
      return NextResponse.json({ error: 'Invalid manifest' }, { status: 400 })
    }

    const [postcard] = await db
      .insert(schema.numberLinePostcards)
      .values({
        userId,
        playerId: playerId ?? null,
        callerNumber: manifest.callerNumber,
        manifest,
        status: 'pending',
      })
      .returning()

    // Start background generation task
    const taskId = await startPostcardGenerate({
      postcardId: postcard.id,
      userId,
    })

    // Store taskId on the postcard record
    await db
      .update(schema.numberLinePostcards)
      .set({ taskId })
      .where(eq(schema.numberLinePostcards.id, postcard.id))

    return NextResponse.json({ postcardId: postcard.id, taskId }, { status: 201 })
  } catch (err) {
    console.error('[postcards] POST failed:', err)
    return NextResponse.json({ error: 'Failed to create postcard' }, { status: 500 })
  }
})

/** GET /api/postcards — list postcards for the current user */
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const userId = await getUserId()
    const url = new URL(request.url)
    const playerId = url.searchParams.get('playerId')

    const ids = url.searchParams.get('ids')
    const conditions = [eq(schema.numberLinePostcards.userId, userId)]
    if (ids) {
      // Filter to specific postcards by ID (comma-separated)
      const idList = ids.split(',').filter(Boolean)
      if (idList.length === 1) {
        conditions.push(eq(schema.numberLinePostcards.id, idList[0]))
      } else if (idList.length > 1) {
        const { inArray } = await import('drizzle-orm')
        conditions.push(inArray(schema.numberLinePostcards.id, idList))
      }
    } else if (playerId) {
      conditions.push(eq(schema.numberLinePostcards.playerId, playerId))
    }

    const postcards = await db
      .select({
        id: schema.numberLinePostcards.id,
        callerNumber: schema.numberLinePostcards.callerNumber,
        status: schema.numberLinePostcards.status,
        imageUrl: schema.numberLinePostcards.imageUrl,
        thumbnailUrl: schema.numberLinePostcards.thumbnailUrl,
        isRead: schema.numberLinePostcards.isRead,
        createdAt: schema.numberLinePostcards.createdAt,
        manifest: schema.numberLinePostcards.manifest,
      })
      .from(schema.numberLinePostcards)
      .where(and(...conditions))
      .orderBy(desc(schema.numberLinePostcards.createdAt))
      .limit(50)

    return NextResponse.json({ postcards })
  } catch (err) {
    console.error('[postcards] GET failed:', err)
    return NextResponse.json({ error: 'Failed to fetch postcards' }, { status: 500 })
  }
})
