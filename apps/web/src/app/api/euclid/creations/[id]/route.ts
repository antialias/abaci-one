import { NextResponse, type NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { CreationData } from '@/db/schema/euclid-creations'

/** GET /api/euclid/creations/[id] — load a creation by ID (public, no auth required) */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const creation = await db
      .select()
      .from(schema.euclidCreations)
      .where(eq(schema.euclidCreations.id, id))
      .get()

    if (!creation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ creation })
  } catch (err) {
    console.error('[euclid/creations/[id]] GET failed:', err)
    return NextResponse.json({ error: 'Failed to load creation' }, { status: 500 })
  }
}

/** PATCH /api/euclid/creations/[id] — partial update (auth required, owner-only) */
export const PATCH = withAuth(async (request: NextRequest, { params: paramsPromise }) => {
  try {
    const { id } = (await paramsPromise) as { id: string }
    const userId = await getUserId()

    // Verify ownership
    const existing = await db
      .select({ userId: schema.euclidCreations.userId })
      .from(schema.euclidCreations)
      .where(eq(schema.euclidCreations.id, id))
      .get()

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { data, thumbnail, title, isPublic } = body as {
      data?: CreationData
      thumbnail?: string
      title?: string | null
      isPublic?: boolean
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    }
    if (data !== undefined) updates.data = data
    if (thumbnail !== undefined) updates.thumbnail = thumbnail
    if (title !== undefined) updates.title = title
    if (isPublic !== undefined) updates.isPublic = isPublic

    await db.update(schema.euclidCreations).set(updates).where(eq(schema.euclidCreations.id, id))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[euclid/creations/[id]] PATCH failed:', err)
    return NextResponse.json({ error: 'Failed to update creation' }, { status: 500 })
  }
})
