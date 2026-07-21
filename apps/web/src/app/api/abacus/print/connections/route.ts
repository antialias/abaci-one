/**
 * Print-service connections (Abacus Studio Phase 2a, #8.2)
 *
 * GET  /api/abacus/print/connections - list the caller's connections (browser-safe views)
 * POST /api/abacus/print/connections - pair with a service via a CODE@host artifact
 */
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'
import { createConnectionFromPairing, listConnections } from '@/lib/abacus/print/connections'
import { PairingArtifactError } from '@/lib/abacus/print/pairing'
import { PrintServiceError } from '@/lib/abacus/print/print-service-fetch'

export const GET = withAuth(async () => {
  try {
    const userId = await getUserId()
    return NextResponse.json({ connections: await listConnections(userId) })
  } catch (error) {
    console.error('[print-connections] list failed:', error)
    return NextResponse.json({ error: 'Failed to list connections' }, { status: 500 })
  }
})

export const POST = withAuth(async (request, { userEmail }) => {
  try {
    const userId = await getUserId()
    const body = await request.json().catch(() => ({}))
    const artifact = typeof body.artifact === 'string' ? body.artifact : ''
    const name = typeof body.name === 'string' ? body.name : undefined
    if (!artifact.trim()) {
      return NextResponse.json({ error: 'Pairing code is required' }, { status: 400 })
    }

    const result = await createConnectionFromPairing({
      userId,
      artifact,
      name,
      userLabel: userEmail,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof PrintServiceError) {
      // Codes are single-use with a short TTL — the actionable fix is always a fresh code.
      if (error.code === 'unreachable') {
        return NextResponse.json(
          { error: 'Could not reach the print service. Check the host and try again.' },
          { status: 502 }
        )
      }
      return NextResponse.json(
        {
          error:
            'Pairing failed — the code may be expired or already used. Get a fresh code from the print service and try again.',
        },
        { status: 400 }
      )
    }
    if (error instanceof PairingArtifactError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('[print-connections] pairing failed:', error)
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
  }
})
