import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getTeacherClassroom } from '@/lib/classroom'
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
 * GET /api/classrooms/mine
 * Get current user's classroom (if teacher)
 *
 * Returns: { classroom } or 404
 */
export async function GET() {
  try {
    const viewerId = await getViewerId()
    const user = await getOrCreateUser(viewerId)

    const classroom = await getTeacherClassroom(user.id)

    if (!classroom) {
      return NextResponse.json({ error: 'No classroom found' }, { status: 404 })
    }

    return NextResponse.json({ classroom })
  } catch (error) {
    console.error('Failed to fetch classroom:', error)
    return NextResponse.json({ error: 'Failed to fetch classroom' }, { status: 500 })
  }
}
