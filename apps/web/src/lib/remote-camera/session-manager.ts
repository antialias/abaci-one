/**
 * Remote Camera Session Manager
 *
 * Manages in-memory sessions for phone-to-desktop camera streaming.
 * Sessions are short-lived (10 minute TTL) and stored in memory.
 */

import { createId } from '@paralleldrive/cuid2'

export interface RemoteCameraSession {
  id: string
  createdAt: Date
  expiresAt: Date
  phoneConnected: boolean
}

// In-memory session storage
// Using globalThis to persist across hot reloads in development
declare global {
  // eslint-disable-next-line no-var
  var __remoteCameraSessions: Map<string, RemoteCameraSession> | undefined
}

const SESSION_TTL_MS = 10 * 60 * 1000 // 10 minutes
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
    phoneConnected: false,
  }

  sessions.set(session.id, session)
  return session
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
