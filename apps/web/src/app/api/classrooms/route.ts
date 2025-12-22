import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { createClassroom, getTeacherClassroom } from '@/lib/classroom'
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
 * GET /api/classrooms
 * Get current user's classroom (alias for /api/classrooms/mine)
 *
 * Returns: { classroom } or { classroom: null }
 */
export async function GET() {
  try {
    const viewerId = await getViewerId()
    const user = await getOrCreateUser(viewerId)

    const classroom = await getTeacherClassroom(user.id)

    return NextResponse.json({ classroom })
  } catch (error) {
    console.error('Failed to fetch classroom:', error)
    return NextResponse.json({ error: 'Failed to fetch classroom' }, { status: 500 })
  }
}

/**
 * POST /api/classrooms
 * Create a classroom for current user (becomes teacher)
 *
 * Body: { name: string }
 * Returns: { success: true, classroom } or { success: false, error }
 */
export async function POST(req: NextRequest) {
  try {
    const viewerId = await getViewerId()
    const user = await getOrCreateUser(viewerId)
    const body = await req.json()

    if (!body.name) {
      return NextResponse.json({ success: false, error: 'Missing name' }, { status: 400 })
    }

    const result = await createClassroom({
      teacherId: user.id,
      name: body.name,
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, classroom: result.classroom }, { status: 201 })
  } catch (error) {
    console.error('Failed to create classroom:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create classroom' },
      { status: 500 }
    )
  }
}
