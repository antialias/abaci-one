/**
 * Health check endpoint for deployment orchestration
 *
 * GET /api/health
 *
 * Returns 200 OK when the application is ready to serve traffic:
 * - Database connection is working
 * - All critical services are initialized
 *
 * Used by:
 * - Red-black deployment scripts to verify new containers are ready
 * - Docker healthcheck for container orchestration
 * - Load balancers to determine if traffic should be routed
 */

import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/db'

export const dynamic = 'force-dynamic'

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  checks: {
    database: {
      status: 'ok' | 'error'
      latencyMs?: number
      error?: string
    }
  }
  version?: string
  commit?: string
}

export async function GET(): Promise<NextResponse<HealthCheckResult>> {
  const startTime = Date.now()
  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'ok' },
    },
  }

  // Check database connectivity
  try {
    const dbStart = Date.now()
    await db.run(sql`SELECT 1`)
    result.checks.database.latencyMs = Date.now() - dbStart
  } catch (error) {
    result.status = 'unhealthy'
    result.checks.database = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown database error',
    }
  }

  // Add version info from environment (set during Docker build)
  if (process.env.GIT_COMMIT) {
    result.commit = process.env.GIT_COMMIT
  }
  if (process.env.npm_package_version) {
    result.version = process.env.npm_package_version
  }

  const statusCode = result.status === 'healthy' ? 200 : 503
  return NextResponse.json(result, { status: statusCode })
}
