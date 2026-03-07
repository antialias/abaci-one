import { NextResponse, type NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'
import { getSharedHistory } from '@/lib/number-line/shared-history'

/** GET /api/number-line/shared-history?playerId=X&callerNumber=Y */
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const userId = await getUserId()
    const url = new URL(request.url)
    const playerId = url.searchParams.get('playerId')
    const callerNumberStr = url.searchParams.get('callerNumber')

    if (!playerId || !callerNumberStr) {
      return NextResponse.json({ error: 'Missing playerId or callerNumber' }, { status: 400 })
    }

    const callerNumber = Number(callerNumberStr)
    if (!Number.isFinite(callerNumber)) {
      return NextResponse.json({ error: 'Invalid callerNumber' }, { status: 400 })
    }

    const history = await getSharedHistory(playerId, callerNumber, userId)
    return NextResponse.json({ history })
  } catch (err) {
    console.error('[number-line/shared-history] GET failed:', err)
    return NextResponse.json({ error: 'Failed to load shared history' }, { status: 500 })
  }
})
