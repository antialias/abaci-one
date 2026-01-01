/**
 * Remote Camera Session Manager
 *
 * Manages in-memory sessions for phone-to-desktop camera streaming.
 * Sessions have a 60-minute TTL but are renewed on activity.
 * Sessions persist across page reloads via session ID stored client-side.
 */

import { createId } from '@paralleldrive/cuid2'

export interface RemoteCameraSession {
  id: string
  createdAt: Date
  expiresAt: Date
  lastActivityAt: Date
  phoneConnected: boolean
  /** Calibration data sent from desktop (persists for reconnects) */
  calibration?: {
    corners: { topLeft: { x: number; y: number }; topRight: { x: number; y: number }; bottomLeft: { x: number; y: number }; bottomRight: { x: number; y: number } }
  }
}

// In-memory session storage
// Using globalThis to persist across hot reloads in development
declare global {
  // eslint-disable-next-line no-var
  var __remoteCameraSessions: Map<string, RemoteCameraSession> | undefined
}

const SESSION_TTL_MS = 60 * 60 * 1000 // 60 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000 // 1 minute

function getSessions(): Map<string, RemoteCameraSession> {
  if (!globalThis.__remoteCameraSessions) {
    globalThis.__remoteCameraSessions = new Map()
    // Start cleanup interval
    setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL_MS)
  }
  return globalThis.__remoteCameraSessions
}

/**
 * Create a new remote camera session
 */
export function createRemoteCameraSession(): RemoteCameraSession {
  const sessions = getSessions()
  const now = new Date()

  const session: RemoteCameraSession = {
    id: createId(),
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    lastActivityAt: now,
    phoneConnected: false,
  }

  sessions.set(session.id, session)
  return session
}

/**
 * Get or create a session by ID
 * If the session exists and isn't expired, returns it (renewed)
 * If the session doesn't exist, creates a new one with the given ID
 */
export function getOrCreateSession(sessionId: string): RemoteCameraSession {
  const sessions = getSessions()
  const existing = sessions.get(sessionId)
  const now = new Date()

  if (existing && now <= existing.expiresAt) {
    // Renew TTL on access
    existing.expiresAt = new Date(now.getTime() + SESSION_TTL_MS)
    existing.lastActivityAt = now
    return existing
  }

  // Create new session with provided ID
  const session: RemoteCameraSession = {
    id: sessionId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    lastActivityAt: now,
    phoneConnected: false,
  }

  sessions.set(session.id, session)
  return session
}

/**
 * Renew session TTL (call on activity to keep session alive)
 */
export function renewSessionTTL(sessionId: string): boolean {
  const sessions = getSessions()
  const session = sessions.get(sessionId)

  if (!session) return false

  const now = new Date()
  session.expiresAt = new Date(now.getTime() + SESSION_TTL_MS)
  session.lastActivityAt = now
  return true
}

/**
 * Store calibration data in session (persists for reconnects)
 */
export function setSessionCalibration(
  sessionId: string,
  calibration: RemoteCameraSession['calibration']
): boolean {
  const sessions = getSessions()
  const session = sessions.get(sessionId)

  if (!session) return false

  session.calibration = calibration
  // Also renew TTL
  const now = new Date()
  session.expiresAt = new Date(now.getTime() + SESSION_TTL_MS)
  session.lastActivityAt = now
  return true
}

/**
 * Get calibration data from session
 */
export function getSessionCalibration(sessionId: string): RemoteCameraSession['calibration'] | null {
  const sessions = getSessions()
  const session = sessions.get(sessionId)

  if (!session) return null
  return session.calibration || null
}

/**
 * Get a session by ID
 */
export function getRemoteCameraSession(sessionId: string): RemoteCameraSession | null {
  const sessions = getSessions()
  const session = sessions.get(sessionId)

  if (!session) return null

  // Check if expired
  if (new Date() > session.expiresAt) {
    sessions.delete(sessionId)
    return null
  }

  return session
}

/**
 * Mark a session as having a connected phone
 */
export function markPhoneConnected(sessionId: string): boolean {
  const sessions = getSessions()
  const session = sessions.get(sessionId)

  if (!session) return false

  session.phoneConnected = true
  // Extend TTL when phone connects
  session.expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  return true
}

/**
 * Mark a session as having the phone disconnected
 */
export function markPhoneDisconnected(sessionId: string): boolean {
  const sessions = getSessions()
  const session = sessions.get(sessionId)

  if (!session) return false

  session.phoneConnected = false
  return true
}

/**
 * Delete a session
 */
export function deleteRemoteCameraSession(sessionId: string): boolean {
  const sessions = getSessions()
  return sessions.delete(sessionId)
}

/**
 * Clean up expired sessions
 */
function cleanupExpiredSessions(): void {
  const sessions = getSessions()
  const now = new Date()

  for (const [id, session] of sessions) {
    if (now > session.expiresAt) {
      sessions.delete(id)
    }
  }
}

/**
 * Get session count (for debugging)
 */
export function getSessionCount(): number {
  return getSessions().size
}
