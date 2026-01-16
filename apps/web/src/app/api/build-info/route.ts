import { NextResponse } from 'next/server'
import { hostname } from 'os'
import buildInfo from '@/generated/build-info.json'
import { getRedisClient, isRedisAvailable } from '@/lib/redis'

// Force dynamic evaluation - this route must not be statically cached
// because it reads runtime environment variables and system state
export const dynamic = 'force-dynamic'

export async function GET() {
  const redis = getRedisClient()

  return NextResponse.json({
    ...buildInfo,
    instance: {
      hostname: hostname(),
      containerId: process.env.HOSTNAME || 'unknown',
      nodeEnv: process.env.NODE_ENV,
    },
    redis: {
      configured: !!process.env.REDIS_URL,
      connected: isRedisAvailable(),
      status: redis?.status || 'not configured',
    },
    socketio: {
      adapter: redis ? 'redis' : 'memory',
    },
  })
}
