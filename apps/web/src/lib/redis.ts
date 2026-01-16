/**
 * Redis client utility
 *
 * Provides optional Redis connectivity - uses Redis when REDIS_URL is set,
 * otherwise returns null so callers can fall back to in-memory storage.
 *
 * This allows the app to work without Redis in development while using
 * Redis in production for cross-instance state sharing.
 */

import Redis from 'ioredis'

// Singleton Redis client
let redisClient: Redis | null = null
let redisInitialized = false

/**
 * Get the Redis client, or null if Redis is not configured
 *
 * Returns the same instance on subsequent calls (singleton pattern).
 * Returns null if REDIS_URL is not set in environment.
 */
export function getRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL

  // If we've already initialized with a client, return it
  if (redisInitialized && redisClient) {
    return redisClient
  }

  // If we initialized but got null AND REDIS_URL is still not set, return null
  // But if REDIS_URL is NOW set (e.g., build-time vs runtime), try again
  if (redisInitialized && !redisUrl) {
    return null
  }

  redisInitialized = true

  if (!redisUrl) {
    console.log('[Redis] REDIS_URL not set, using in-memory storage')
    return null
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          console.error('[Redis] Max retries reached, giving up')
          return null
        }
        const delay = Math.min(times * 200, 2000)
        console.log(`[Redis] Retrying connection in ${delay}ms (attempt ${times})`)
        return delay
      },
      lazyConnect: false,
    })

    redisClient.on('connect', () => {
      console.log('[Redis] Connected successfully')
    })

    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message)
    })

    redisClient.on('close', () => {
      console.log('[Redis] Connection closed')
    })

    return redisClient
  } catch (err) {
    console.error('[Redis] Failed to create client:', err)
    return null
  }
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  const client = getRedisClient()
  return client !== null && client.status === 'ready'
}

/**
 * Create a new Redis client for pub/sub (Socket.IO adapter needs separate clients)
 *
 * Returns null if REDIS_URL is not set.
 */
export function createRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    return null
  }

  try {
    return new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          return null
        }
        return Math.min(times * 200, 2000)
      },
    })
  } catch (err) {
    console.error('[Redis] Failed to create pub/sub client:', err)
    return null
  }
}
