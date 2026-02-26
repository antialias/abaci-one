import { NextResponse, type NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq, desc, and, inArray } from 'drizzle-orm'
import type { CreationData } from '@/db/schema/euclid-creations'

/** POST /api/euclid/creations — save a new playground creation */
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const userId = await getUserId()
    const body = await request.json()

    const { data, thumbnail, isPublic } = body as {
      data: CreationData
      thumbnail?: string
      isPublic?: boolean
    }

    if (!data || !data.actions) {
      return NextResponse.json({ error: 'Missing creation data' }, { status: 400 })
    }

    const [creation] = await db
      .insert(schema.euclidCreations)
      .values({ userId, data, thumbnail: thumbnail ?? null, isPublic: isPublic ?? false })
      .returning()

    return NextResponse.json({ id: creation.id }, { status: 201 })
  } catch (err) {
    console.error('[euclid/creations] POST failed:', err)
    return NextResponse.json({ error: 'Failed to save creation' }, { status: 500 })
  }
})

/**
 * GET /api/euclid/creations
 *
 * Query params:
 *   ?mine=true          — only this user's creations (requires auth)
 *   ?isPublic=true      — filter to public only (combine with mine=true for "my published")
 *   ?ids=id1,id2,...    — fetch specific IDs (for "seen" tab)
 *   ?limit=N            — max results (default 50, max 100)
 */
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const url = new URL(request.url)
    const mine = url.searchParams.get('mine') === 'true'
    const isPublicFilter = url.searchParams.get('isPublic')
    const idsParam = url.searchParams.get('ids')
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 100)

    const cols = {
      id: schema.euclidCreations.id,
      thumbnail: schema.euclidCreations.thumbnail,
      isPublic: schema.euclidCreations.isPublic,
      createdAt: schema.euclidCreations.createdAt,
    }

    // Fetch specific IDs (for "seen" tab)
    if (idsParam) {
      const ids = idsParam.split(',').filter(Boolean).slice(0, 100)
      if (ids.length === 0) return NextResponse.json({ creations: [] })
      const creations = await db
        .select(cols)
        .from(schema.euclidCreations)
        .where(inArray(schema.euclidCreations.id, ids))
        .all()
      return NextResponse.json({ creations })
    }

    // Fetch by user (mine) or public gallery
    const userId = mine ? await getUserId() : null

    const conditions = []
    if (userId) conditions.push(eq(schema.euclidCreations.userId, userId))
    if (isPublicFilter !== null) {
      conditions.push(eq(schema.euclidCreations.isPublic, isPublicFilter === 'true'))
    } else if (!mine) {
      // Default public gallery: only public
      conditions.push(eq(schema.euclidCreations.isPublic, true))
    }

    const creations = await db
      .select(cols)
      .from(schema.euclidCreations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.euclidCreations.createdAt))
      .limit(limit)
      .all()

    return NextResponse.json({ creations })
  } catch (err) {
    console.error('[euclid/creations] GET failed:', err)
    return NextResponse.json({ error: 'Failed to fetch creations' }, { status: 500 })
  }
})
