import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { linkParentToChild } from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'

/**
 * POST /api/family/link
 * Link current user as parent to a child via family code
 *
 * Body: { familyCode: string }
 * Returns: { success: true, player } or { success: false, error }
 */
export const POST = withAuth(async (request) => {
  try {
    const userId = await getUserId()
    const body = await request.json()

    if (!body.familyCode) {
      return NextResponse.json({ success: false, error: 'Missing familyCode' }, { status: 400 })
    }

    const result = await linkParentToChild(userId, body.familyCode)

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
})
