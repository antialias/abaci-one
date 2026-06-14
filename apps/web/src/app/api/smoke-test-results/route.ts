/**
 * Smoke test results endpoint
 *
 * POST /api/smoke-test-results
 *
 * Receives test results from the smoke test CronJob and stores them in the database.
 * Protected by internal cluster networking (no auth required - only accessible from within the cluster).
 *
 * Request body:
 * {
 *   id: string,          // Unique run ID
 *   startedAt: string,   // ISO timestamp
 *   completedAt?: string,// ISO timestamp (optional if still running)
 *   status: 'running' | 'passed' | 'failed' | 'error',
 *   totalTests?: number,
 *   passedTests?: number,
 *   failedTests?: number,
 *   durationMs?: number,
 *   resultsJson?: string, // JSON-stringified detailed results
 *   errorMessage?: string,
 * }
 */

import { type NextRequest, NextResponse } from 'next/server'
import { desc, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { smokeTestRuns } from '@/db/schema'
import { metrics, updateSmokeTestMetrics } from '@/lib/metrics'
import { withAuth } from '@/lib/auth/withAuth'

export const dynamic = 'force-dynamic'

interface SmokeTestResultsRequest {
  id: string
  startedAt: string
  completedAt?: string
  status: 'running' | 'passed' | 'failed' | 'error'
  totalTests?: number
  passedTests?: number
  failedTests?: number
  durationMs?: number
  resultsJson?: string
  errorMessage?: string
}

interface SmokeTestResultsResponse {
  success: boolean
  id: string
  message?: string
}

export const POST = withAuth(async (request): Promise<NextResponse<SmokeTestResultsResponse>> => {
  try {
    // Internal-only: this endpoint is reported to by the in-cluster smoke
    // CronJob over the service network (no auth), but it is ALSO reachable via
    // the public ingress. We can't key on header *presence* — Next.js always
    // populates x-forwarded-host/-for (from the upstream proxy when present,
    // else from the request's own Host/socket), so those headers exist even on
    // a direct pod->service call. Discriminate by VALUE instead: the smoke
    // CronJob hits abaci-app.abaci.svc.cluster.local, so a legitimate internal
    // request's host is the cluster service FQDN; anything that arrived via the
    // public ingress carries the public host (abaci.one). Default-deny: allow
    // only the in-cluster host so the guest-POST policy can't be used to inject
    // fake results from the internet.
    const requestHost = (
      request.headers.get('x-forwarded-host') ??
      request.headers.get('host') ??
      ''
    ).toLowerCase()
    const isInternal =
      requestHost.endsWith('.svc.cluster.local') ||
      requestHost === 'localhost' ||
      requestHost.startsWith('localhost:') ||
      requestHost.startsWith('127.0.0.1')
    if (!isInternal) {
      console.warn(
        `[smoke-test-results] rejecting non-internal POST (host=${requestHost || 'none'})`
      )
      return NextResponse.json(
        { success: false, id: '', message: 'Not found' },
        { status: 404 }
      )
    }

    const body = (await request.json()) as SmokeTestResultsRequest

    // Validate required fields
    if (!body.id || !body.startedAt || !body.status) {
      return NextResponse.json(
        {
          success: false,
          id: '',
          message: 'Missing required fields: id, startedAt, status',
        },
        { status: 400 }
      )
    }

    // Validate status
    if (!['running', 'passed', 'failed', 'error'].includes(body.status)) {
      return NextResponse.json(
        { success: false, id: '', message: 'Invalid status value' },
        { status: 400 }
      )
    }

    // Insert or update the test run
    await db
      .insert(smokeTestRuns)
      .values({
        id: body.id,
        startedAt: new Date(body.startedAt),
        completedAt: body.completedAt ? new Date(body.completedAt) : null,
        status: body.status,
        totalTests: body.totalTests ?? null,
        passedTests: body.passedTests ?? null,
        failedTests: body.failedTests ?? null,
        durationMs: body.durationMs ?? null,
        resultsJson: body.resultsJson ?? null,
        errorMessage: body.errorMessage ?? null,
      })
      .onConflictDoUpdate({
        target: smokeTestRuns.id,
        set: {
          completedAt: body.completedAt ? new Date(body.completedAt) : null,
          status: body.status,
          totalTests: body.totalTests ?? null,
          passedTests: body.passedTests ?? null,
          failedTests: body.failedTests ?? null,
          durationMs: body.durationMs ?? null,
          resultsJson: body.resultsJson ?? null,
          errorMessage: body.errorMessage ?? null,
        },
      })

    // Update Prometheus metrics for completed runs
    if (body.status !== 'running') {
      // The smokeTestLast* gauges set here are the OLD per-pod source, now
      // superseded by the Pushgateway series the runner pushes (see metrics.ts
      // migration note). The runsTotal.inc() below is NOT migrated — keep it
      // when the gauges are eventually removed (panels 106/301 depend on it).
      updateSmokeTestMetrics({
        status: body.status,
        startedAt: new Date(body.startedAt),
        completedAt: body.completedAt ? new Date(body.completedAt) : null,
        totalTests: body.totalTests ?? null,
        passedTests: body.passedTests ?? null,
        failedTests: body.failedTests ?? null,
        durationMs: body.durationMs ?? null,
      })
      metrics.smokeTest.runsTotal.inc({ status: body.status })
    }

    // Clean up old test runs (keep last 100)
    // Get IDs to keep (newest 100)
    const runsToKeep = await db
      .select({ id: smokeTestRuns.id })
      .from(smokeTestRuns)
      .orderBy(desc(smokeTestRuns.startedAt))
      .limit(100)

    if (runsToKeep.length >= 100) {
      // Get all run IDs
      const allRuns = await db.select({ id: smokeTestRuns.id }).from(smokeTestRuns)

      const keepIds = new Set(runsToKeep.map((r) => r.id))
      const idsToDelete = allRuns.filter((r) => !keepIds.has(r.id)).map((r) => r.id)

      if (idsToDelete.length > 0) {
        await db.delete(smokeTestRuns).where(inArray(smokeTestRuns.id, idsToDelete))
      }
    }

    return NextResponse.json({
      success: true,
      id: body.id,
      message: 'Test results recorded',
    })
  } catch (error) {
    console.error('Error storing smoke test results:', error)
    return NextResponse.json(
      {
        success: false,
        id: '',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
