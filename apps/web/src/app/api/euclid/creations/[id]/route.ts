import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'

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

/** PATCH /api/euclid/creations/[id] — toggle isPublic */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { isPublic } = await request.json()

    await db
      .update(schema.euclidCreations)
      .set({ isPublic })
      .where(eq(schema.euclidCreations.id, id))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[euclid/creations/[id]] PATCH failed:', err)
    return NextResponse.json({ error: 'Failed to update creation' }, { status: 500 })
  }
}
