/**
 * Health check endpoint for deployment orchestration
 *
 * GET /api/health
 *
 * Returns 200 OK when the application is ready to serve traffic:
 * - Database connection is working
 * - All critical services are initialized
 *
 * Status levels:
 * - healthy (200): All services operational
 * - degraded (200): Core services work, but some features limited (e.g., Redis down)
 * - unhealthy (503): Cannot serve traffic (e.g., database down)
 *
 * Used by:
 * - Red-black deployment scripts to verify new containers are ready
 * - Docker healthcheck for container orchestration
 * - Load balancers to determine if traffic should be routed (Traefik)
 */

import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/db'
import { getRedisClient, isRedisAvailable } from '@/lib/redis'

export const dynamic = 'force-dynamic'

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  checks: {
    database: {
      status: 'ok' | 'error'
      latencyMs?: number
      error?: string
    }
    redis?: {
      status: 'ok' | 'error' | 'not_configured'
      latencyMs?: number
      error?: string
      /** Features affected when Redis is down */
      affectedFeatures?: string[]
    }
  }
  version?: string
  commit?: string
}

export async function GET(): Promise<NextResponse<HealthCheckResult>> {
  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'ok' },
    },
  }

  // Check database connectivity (critical - app cannot function without it)
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

  // Check Redis connectivity (non-critical - app works without it but with reduced functionality)
  const redisClient = getRedisClient()
  if (!redisClient) {
    // Redis not configured - this is fine in development
    result.checks.redis = {
      status: 'not_configured',
      affectedFeatures: ['cross-instance sessions', 'remote camera sync'],
    }
    // Only mark as degraded in production where Redis is expected
    if (process.env.REDIS_URL) {
      result.status = result.status === 'healthy' ? 'degraded' : result.status
    }
  } else if (!isRedisAvailable()) {
    // Redis configured but not connected
    result.checks.redis = {
      status: 'error',
      error: `Connection status: ${redisClient.status}`,
      affectedFeatures: ['cross-instance sessions', 'remote camera sync', 'Socket.IO scaling'],
    }
    // Degrade status (but don't mark unhealthy - app can still serve traffic)
    result.status = result.status === 'healthy' ? 'degraded' : result.status
  } else {
    // Redis connected - verify with a ping
    try {
      const redisStart = Date.now()
      await redisClient.ping()
      result.checks.redis = {
        status: 'ok',
        latencyMs: Date.now() - redisStart,
      }
    } catch (error) {
      result.checks.redis = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Redis ping failed',
        affectedFeatures: ['cross-instance sessions', 'remote camera sync', 'Socket.IO scaling'],
      }
      result.status = result.status === 'healthy' ? 'degraded' : result.status
    }
  }

  // Add version info from environment (set during Docker build)
  if (process.env.GIT_COMMIT) {
    result.commit = process.env.GIT_COMMIT
  }
  if (process.env.npm_package_version) {
    result.version = process.env.npm_package_version
  }

  // Return 200 for healthy/degraded (can still serve traffic), 503 for unhealthy
  const statusCode = result.status === 'unhealthy' ? 503 : 200
  return NextResponse.json(result, { status: statusCode })
}
