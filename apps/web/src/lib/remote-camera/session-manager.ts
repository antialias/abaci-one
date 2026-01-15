/**
 * Remote Camera Session Manager
 *
 * Manages sessions for phone-to-desktop camera streaming.
 * Uses Redis when REDIS_URL is set (production), falls back to in-memory (dev).
 * Sessions have a 60-minute TTL but are renewed on activity.
 */

import { createId } from '@paralleldrive/cuid2'
import { getRedisClient } from '../redis'

export interface RemoteCameraSession {
  id: string
  createdAt: string // ISO string for JSON serialization
  expiresAt: string
  lastActivityAt: string
  phoneConnected: boolean
  /** Calibration data sent from desktop (persists for reconnects) */
  calibration?: {
    corners: {
      topLeft: { x: number; y: number }
      topRight: { x: number; y: number }
      bottomLeft: { x: number; y: number }
      bottomRight: { x: number; y: number }
    }
    columnCount?: number
  }
}

// In-memory session storage (fallback when Redis not available)
// Using globalThis to persist across hot reloads in development
declare global {
  // eslint-disable-next-line no-var
  var __remoteCameraSessions: Map<string, RemoteCameraSession> | undefined
  // eslint-disable-next-line no-var
  var __remoteCameraCleanupStarted: boolean | undefined
}

const SESSION_TTL_MS = 60 * 60 * 1000 // 60 minutes
const SESSION_TTL_SECONDS = 60 * 60 // 60 minutes (for Redis)
const CLEANUP_INTERVAL_MS = 60 * 1000 // 1 minute
const REDIS_KEY_PREFIX = 'remote-camera:session:'

function getMemorySessions(): Map<string, RemoteCameraSession> {
  if (!globalThis.__remoteCameraSessions) {
    globalThis.__remoteCameraSessions = new Map()
    // Start cleanup interval only once
    if (!globalThis.__remoteCameraCleanupStarted) {
      globalThis.__remoteCameraCleanupStarted = true
      setInterval(cleanupExpiredMemorySessions, CLEANUP_INTERVAL_MS)
    }
  }
  return globalThis.__remoteCameraSessions
}

function cleanupExpiredMemorySessions(): void {
  const sessions = getMemorySessions()
  const now = new Date().toISOString()

  for (const [id, session] of sessions) {
    if (now > session.expiresAt) {
      sessions.delete(id)
    }
  }
}

/**
 * Create a new remote camera session
 */
export async function createRemoteCameraSession(): Promise<RemoteCameraSession> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)

  const session: RemoteCameraSession = {
    id: createId(),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastActivityAt: now.toISOString(),
    phoneConnected: false,
  }

  const redis = getRedisClient()
  if (redis) {
    await redis.setex(REDIS_KEY_PREFIX + session.id, SESSION_TTL_SECONDS, JSON.stringify(session))
    console.log(`[SessionManager] Created session ${session.id} in Redis`)
  } else {
    getMemorySessions().set(session.id, session)
    console.log(`[SessionManager] Created session ${session.id} in memory`)
  }

  return session
}

/**
 * Get or create a session by ID
 * If the session exists and isn't expired, returns it (renewed)
 * If the session doesn't exist, creates a new one with the given ID
 */
export async function getOrCreateSession(sessionId: string): Promise<RemoteCameraSession> {
  const existing = await getRemoteCameraSession(sessionId)

  if (existing) {
    // Renew TTL on access
    await renewSessionTTL(sessionId)
    return existing
  }

  // Create new session with provided ID
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)

  const session: RemoteCameraSession = {
    id: sessionId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastActivityAt: now.toISOString(),
    phoneConnected: false,
  }

  const redis = getRedisClient()
  if (redis) {
    await redis.setex(REDIS_KEY_PREFIX + session.id, SESSION_TTL_SECONDS, JSON.stringify(session))
  } else {
    getMemorySessions().set(session.id, session)
  }

  return session
}

/**
 * Renew session TTL (call on activity to keep session alive)
 */
export async function renewSessionTTL(sessionId: string): Promise<boolean> {
  const redis = getRedisClient()

  if (redis) {
    const data = await redis.get(REDIS_KEY_PREFIX + sessionId)
    if (!data) return false

    const session: RemoteCameraSession = JSON.parse(data)
    const now = new Date()
    session.expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString()
    session.lastActivityAt = now.toISOString()

    await redis.setex(REDIS_KEY_PREFIX + sessionId, SESSION_TTL_SECONDS, JSON.stringify(session))
    return true
  }

  const sessions = getMemorySessions()
  const session = sessions.get(sessionId)
  if (!session) return false

  const now = new Date()
  session.expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString()
  session.lastActivityAt = now.toISOString()
  return true
}

/**
 * Store calibration data in session (persists for reconnects)
 */
export async function setSessionCalibration(
  sessionId: string,
  calibration: RemoteCameraSession['calibration']
): Promise<boolean> {
  const redis = getRedisClient()

  if (redis) {
    const data = await redis.get(REDIS_KEY_PREFIX + sessionId)
    if (!data) return false

    const session: RemoteCameraSession = JSON.parse(data)
    session.calibration = calibration
    const now = new Date()
    session.expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString()
    session.lastActivityAt = now.toISOString()

    await redis.setex(REDIS_KEY_PREFIX + sessionId, SESSION_TTL_SECONDS, JSON.stringify(session))
    return true
  }

  const sessions = getMemorySessions()
  const session = sessions.get(sessionId)
  if (!session) return false

  session.calibration = calibration
  const now = new Date()
  session.expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString()
  session.lastActivityAt = now.toISOString()
  return true
}

/**
 * Get calibration data from session
 */
export async function getSessionCalibration(
  sessionId: string
): Promise<RemoteCameraSession['calibration'] | null> {
  const session = await getRemoteCameraSession(sessionId)
  if (!session) return null
  return session.calibration || null
}

/**
 * Get a session by ID
 */
export async function getRemoteCameraSession(
  sessionId: string
): Promise<RemoteCameraSession | null> {
  const redis = getRedisClient()

  if (redis) {
    const data = await redis.get(REDIS_KEY_PREFIX + sessionId)
    if (!data) return null

    const session: RemoteCameraSession = JSON.parse(data)

    // Check if expired (Redis TTL should handle this, but double-check)
    if (new Date().toISOString() > session.expiresAt) {
      await redis.del(REDIS_KEY_PREFIX + sessionId)
      return null
    }

    return session
  }

  const sessions = getMemorySessions()
  const session = sessions.get(sessionId)
  if (!session) return null

  // Check if expired
  if (new Date().toISOString() > session.expiresAt) {
    sessions.delete(sessionId)
    return null
  }

  return session
}

/**
 * Mark a session as having a connected phone
 */
export async function markPhoneConnected(sessionId: string): Promise<boolean> {
  const redis = getRedisClient()

  if (redis) {
    const data = await redis.get(REDIS_KEY_PREFIX + sessionId)
    if (!data) return false

    const session: RemoteCameraSession = JSON.parse(data)
    session.phoneConnected = true
    session.expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()

    await redis.setex(REDIS_KEY_PREFIX + sessionId, SESSION_TTL_SECONDS, JSON.stringify(session))
    return true
  }

  const sessions = getMemorySessions()
  const session = sessions.get(sessionId)
  if (!session) return false

  session.phoneConnected = true
  session.expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
  return true
}

/**
 * Mark a session as having the phone disconnected
 */
export async function markPhoneDisconnected(sessionId: string): Promise<boolean> {
  const redis = getRedisClient()

  if (redis) {
    const data = await redis.get(REDIS_KEY_PREFIX + sessionId)
    if (!data) return false

    const session: RemoteCameraSession = JSON.parse(data)
    session.phoneConnected = false

    await redis.setex(REDIS_KEY_PREFIX + sessionId, SESSION_TTL_SECONDS, JSON.stringify(session))
    return true
  }

  const sessions = getMemorySessions()
  const session = sessions.get(sessionId)
  if (!session) return false

  session.phoneConnected = false
  return true
}

/**
 * Delete a session
 */
export async function deleteRemoteCameraSession(sessionId: string): Promise<boolean> {
  const redis = getRedisClient()

  if (redis) {
    const result = await redis.del(REDIS_KEY_PREFIX + sessionId)
    return result > 0
  }

  return getMemorySessions().delete(sessionId)
}

/**
 * Get session count (for debugging)
 */
export async function getSessionCount(): Promise<number> {
  const redis = getRedisClient()

  if (redis) {
    const keys = await redis.keys(REDIS_KEY_PREFIX + '*')
    return keys.length
  }

  return getMemorySessions().size
}
