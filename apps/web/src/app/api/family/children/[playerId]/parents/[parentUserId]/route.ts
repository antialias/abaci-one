import { NextResponse } from 'next/server'
import { isParentOf } from '@/lib/classroom'
import { unlinkParentFromChild } from '@/lib/classroom/family-manager'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * DELETE /api/family/children/[playerId]/parents/[parentUserId]
 * Remove another parent's access to a child.
 *
 * Authorization: caller must be a parent of this child.
 * Safety: cannot remove the last parent (enforced by unlinkParentFromChild).
 */
export const DELETE = withAuth(async (_request, { userId, params }) => {
  try {
    const { playerId, parentUserId } = (await params) as {
      playerId: string
      parentUserId: string
    }

    // Caller must be a parent of this child
    const callerIsParent = await isParentOf(userId, playerId)
    if (!callerIsParent) {
      return NextResponse.json({ error: 'You must be a parent of this student' }, { status: 403 })
    }

    // Cannot remove yourself via this route (different concept)
    if (parentUserId === userId) {
      return NextResponse.json(
        { error: 'Cannot remove yourself. Use a different workflow to leave.' },
        { status: 400 }
      )
    }

    const result = await unlinkParentFromChild(parentUserId, playerId, userId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to unlink parent from child:', error)
    return NextResponse.json({ error: 'Failed to remove parent access' }, { status: 500 })
  }
})
