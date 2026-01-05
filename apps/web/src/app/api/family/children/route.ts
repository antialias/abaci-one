import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getLinkedChildren } from '@/lib/classroom'
import { getViewerId } from '@/lib/viewer'

/**
 * GET /api/family/children
 * Get all children linked to current user
 *
 * Returns: { children: Player[] }
 */
export async function GET() {
  try {
    const viewerId = await getViewerId()

    // Resolve viewerId to actual user.id
    const user = await db.query.users.findFirst({
      where: eq(schema.users.guestId, viewerId),
    })

    if (!user) {
      return NextResponse.json({ children: [] })
    }

    const children = await getLinkedChildren(user.id)

    return NextResponse.json({ children })
  } catch (error) {
    console.error('Failed to fetch children:', error)
    return NextResponse.json({ error: 'Failed to fetch children' }, { status: 500 })
  }
}
