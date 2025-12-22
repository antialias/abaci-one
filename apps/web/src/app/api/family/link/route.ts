import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { linkParentToChild } from '@/lib/classroom'
import { getViewerId } from '@/lib/viewer'

/**
 * Get or create user record for a viewerId (guestId)
 */
async function getOrCreateUser(viewerId: string) {
  let user = await db.query.users.findFirst({
    where: eq(schema.users.guestId, viewerId),
  })

  if (!user) {
    const [newUser] = await db.insert(schema.users).values({ guestId: viewerId }).returning()
    user = newUser
  }

  return user
}

/**
 * POST /api/family/link
 * Link current user as parent to a child via family code
 *
 * Body: { familyCode: string }
 * Returns: { success: true, player } or { success: false, error }
 */
export async function POST(req: NextRequest) {
  try {
    const viewerId = await getViewerId()
    const body = await req.json()

    if (!body.familyCode) {
      return NextResponse.json({ success: false, error: 'Missing familyCode' }, { status: 400 })
    }

    // Resolve viewerId to actual user.id (create user if needed)
    const user = await getOrCreateUser(viewerId)

    const result = await linkParentToChild(user.id, body.familyCode)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, player: result.player })
  } catch (error) {
    console.error('Failed to link parent to child:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to link parent to child' },
      { status: 500 }
    )
  }
}
