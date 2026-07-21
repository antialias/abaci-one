/**
 * Connection reachability probe (Abacus Studio Phase 2a, #8.2)
 *
 * GET /api/abacus/print/connections/[id]/probe
 *
 * Checks the connection by reading the service's /printers. Always returns
 * 200 with a degraded-or-ok result body — a broken connection is a state to
 * display, not an error that throws the roster.
 */
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'
import { getOwnedConnection, probeConnection } from '@/lib/abacus/print/connections'

export const GET = withAuth(async (_request, { params }) => {
  try {
    const { id } = (await params) as { id: string }
    const userId = await getUserId()

    const connection = await getOwnedConnection(userId, id)
    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }
    return NextResponse.json(await probeConnection(connection))
  } catch (error) {
    console.error('[print-connections] probe failed:', error)
    return NextResponse.json({ error: 'Failed to probe connection' }, { status: 500 })
  }
})
