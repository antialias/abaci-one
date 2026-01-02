import { type NextRequest, NextResponse } from 'next/server'
import { getPlayerAccess } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/players/[id]/access
 * Check access level for specific player
 *
 * Returns: { accessLevel, isParent, isTeacher, isPresent, classroomId? }
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: playerId } = await params
    // Use getDbUserId() to get the database user.id, not the guestId
    // This is required because parent_child links to user.id
    const viewerId = await getDbUserId()

    const access = await getPlayerAccess(viewerId, playerId)

    return NextResponse.json({
      accessLevel: access.accessLevel,
      isParent: access.isParent,
      isTeacher: access.isTeacher,
      isPresent: access.isPresent,
      classroomId: access.classroomId,
    })
  } catch (error) {
    console.error('Failed to check player access:', error)
    return NextResponse.json({ error: 'Failed to check player access' }, { status: 500 })
  }
}
