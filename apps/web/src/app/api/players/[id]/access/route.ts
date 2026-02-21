import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getPlayerAccess } from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'

/**
 * GET /api/players/[id]/access
 * Check access level for specific player
 *
 * Returns: { accessLevel, isParent, isTeacher, isPresent, classroomId? }
 */
export const GET = withAuth(async (_request, { params }) => {
  const routeStart = performance.now()

  try {
    const { id: playerId } = (await params) as { id: string }

    // Use getUserId() to get the database user.id, not the guestId
    // This is required because parent_child links to user.id
    let t = performance.now()
    const viewerId = await getUserId()
    const getUserIdTime = performance.now() - t

    t = performance.now()
    const access = await getPlayerAccess(viewerId, playerId)
    const getPlayerAccessTime = performance.now() - t

    const total = performance.now() - routeStart
    console.log(
      `[PERF] /api/players/[id]/access: ${total.toFixed(1)}ms | getUserId=${getUserIdTime.toFixed(1)}ms, getPlayerAccess=${getPlayerAccessTime.toFixed(1)}ms, playerId=${playerId}`
    )

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
})
