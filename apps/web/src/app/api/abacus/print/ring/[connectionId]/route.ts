/**
 * Doorbell webhook receiver (Phase 2a, #8.4).
 *
 * POST /api/abacus/print/ring/[connectionId] — called by the THH print
 * service, NOT by a browser, so there is no session: the credential is the
 * per-connection ring secret we registered via PUT /webhook, presented as a
 * bearer token.
 *
 * Security posture — constant-time, fail-closed:
 *   • The secret comparison hashes both sides (sha256) then `timingSafeEqual`s
 *     the digests, so neither content nor length leaks through timing.
 *   • When the row or its secret is missing, we still burn a comparison
 *     against a process-local dummy and return the same bare 401. No branch
 *     of failure explains itself.
 *   • The 401 body carries no detail — a prober learns nothing about which
 *     connection ids exist.
 *
 * A valid ring is acked 204 and (throttled ~250ms per connection) fanned out
 * to the owning user's socket room. The body is parsed tolerantly — a ring
 * with no/garbage body is still a valid "something changed" hint.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { emitPrintJobUpdated } from '@/lib/abacus/print/ring-emitter'
import type { PrintJobUpdatedEvent } from '@/lib/abacus/print/ring-events'
import { claimRingSlot } from '@/lib/abacus/print/ring-throttle'
import { open } from '@/lib/secret-box'

/** Burned when there's no real secret to compare — equalizes the failure paths. */
const DUMMY_SECRET = randomBytes(32).toString('base64url')

function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}

/** Constant-time equality via digest comparison (length-safe for timingSafeEqual). */
function secretsMatch(presented: string, expected: string): boolean {
  const a = createHash('sha256').update(presented).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  const { connectionId } = await params

  const authHeader = request.headers.get('authorization') ?? ''
  const presented = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''

  const row = await db.query.printServiceConnections.findFirst({
    where: eq(schema.printServiceConnections.id, connectionId),
  })

  // Unseal defensively: a corrupt sealed value degrades to "no secret", not a 500.
  let expected: string | null = null
  if (row?.ringSecretSealed) {
    try {
      expected = open(row.ringSecretSealed)
    } catch {
      expected = null
    }
  }

  // Always run the comparison, even when it can't succeed.
  const matched = secretsMatch(presented, expected ?? DUMMY_SECRET)
  if (!row || expected === null || presented === '' || !matched) {
    return unauthorized()
  }

  // Tolerant body parse: identifiers only, best-effort. Anything malformed
  // degrades to a bare "connection changed" hint.
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const payload: PrintJobUpdatedEvent = {
    connectionId,
    ...(typeof body?.jobId === 'string' ? { jobId: body.jobId } : {}),
    ...(typeof body?.printerId === 'string' ? { printerId: body.printerId } : {}),
    ...(typeof body?.phase === 'string' ? { phase: body.phase } : {}),
  }

  // Bursts collapse to one emit per interval; dropped rings are still acked —
  // the re-read on the surviving emit (and the safety-net poll) covers them.
  if (claimRingSlot(connectionId)) {
    await emitPrintJobUpdated(row.userId, payload)
  }

  return new NextResponse(null, { status: 204 })
}
