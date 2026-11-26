import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  sessionObservationShares,
  type NewSessionObservationShare,
  type SessionObservationShare,
} from '@/db/schema'

// ============================================================================
// Token Generation
// ============================================================================

const BASE62_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const TOKEN_LENGTH = 10 // ~59 bits of entropy

/**
 * Generate a cryptographically random 10-char base62 token
 */
export function generateShareToken(): string {
  let result = ''
  const randomBytes = new Uint8Array(TOKEN_LENGTH)
  crypto.getRandomValues(randomBytes)

  for (let i = 0; i < TOKEN_LENGTH; i++) {
    result += BASE62_CHARS[randomBytes[i] % BASE62_CHARS.length]
  }

  return result
}

/**
 * Check if a token has valid format
 */
export function isValidShareToken(token: string): boolean {
  if (token.length !== TOKEN_LENGTH) return false

  for (let i = 0; i < token.length; i++) {
    if (!BASE62_CHARS.includes(token[i])) {
      return false
    }
  }

  return true
}

// ============================================================================
// Expiration Helpers
// ============================================================================

export type ShareDuration = '1h' | '24h'

/**
 * Calculate expiration timestamp from duration
 */
export function getExpirationTime(duration: ShareDuration): Date {
  const now = new Date()
  switch (duration) {
    case '1h':
      return new Date(now.getTime() + 60 * 60 * 1000)
    case '24h':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000)
  }
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new session share link
 */
export async function createSessionShare(
  sessionId: string,
  playerId: string,
  createdBy: string,
  duration: ShareDuration
): Promise<SessionObservationShare> {
  const token = generateShareToken()
  const expiresAt = getExpirationTime(duration)

  const newShare: NewSessionObservationShare = {
    id: token,
    sessionId,
    playerId,
    createdBy,
    expiresAt,
    status: 'active',
    viewCount: 0,
  }

  await db.insert(sessionObservationShares).values(newShare)

  return {
    ...newShare,
    createdAt: new Date(),
    lastViewedAt: null,
  } as SessionObservationShare
}

/**
 * Get a session share by token
 */
export async function getSessionShare(token: string): Promise<SessionObservationShare | null> {
  if (!isValidShareToken(token)) {
    return null
  }

  const shares = await db
    .select()
    .from(sessionObservationShares)
    .where(eq(sessionObservationShares.id, token))
    .limit(1)

  return shares[0] || null
}

/**
 * Validation result for a share token
 */
export interface ShareValidation {
  valid: boolean
  error?: string
  share?: SessionObservationShare
  /**
   * Only with `allowEnded`: the share was expired by its session ending
   * (`revokeSharesForSession`), so it may serve that session's report only
   * once the session has ended. The caller checks the session and refuses a
   * live one.
   */
  requiresEndedSession?: boolean
}

export interface ValidateShareOptions {
  /**
   * Accept a share expired by its session ending, for reading that ended
   * session's report (session architecture §4, Phase 4a): completion expires
   * shares, which would otherwise blank the ended view. A share an adult
   * revoked (`revoked`) is refused always, and so is one past its own
   * `expiresAt`.
   */
  allowEnded?: boolean
}

/**
 * Validate a session share token
 * Checks: exists, not expired, not revoked, session still active
 */
export async function validateSessionShare(
  token: string,
  options: ValidateShareOptions = {}
): Promise<ShareValidation> {
  const share = await getSessionShare(token)

  if (!share) {
    return { valid: false, error: 'Share link not found' }
  }

  const pastExpiry = new Date() > share.expiresAt

  if (options.allowEnded && !pastExpiry && share.status === 'expired') {
    return { valid: true, share, requiresEndedSession: true }
  }

  if (share.status === 'revoked') {
    return { valid: false, error: 'Share link has been revoked' }
  }

  if (share.status === 'expired') {
    return { valid: false, error: 'Share link has expired' }
  }

  // Check time-based expiration
  if (pastExpiry) {
    // Mark as expired in database
    await db
      .update(sessionObservationShares)
      .set({ status: 'expired' })
      .where(eq(sessionObservationShares.id, token))

    return { valid: false, error: 'Share link has expired' }
  }

  return { valid: true, share }
}

/**
 * Increment the view count for a share
 */
export async function incrementShareViewCount(token: string): Promise<void> {
  const share = await getSessionShare(token)
  if (!share) return

  await db
    .update(sessionObservationShares)
    .set({
      viewCount: share.viewCount + 1,
      lastViewedAt: new Date(),
    })
    .where(eq(sessionObservationShares.id, token))
}

/**
 * Revoke a specific share link
 */
export async function revokeSessionShare(token: string): Promise<void> {
  await db
    .update(sessionObservationShares)
    .set({ status: 'revoked' })
    .where(eq(sessionObservationShares.id, token))
}

/**
 * Revoke all active shares for a session (called when session ends)
 */
export async function revokeSharesForSession(sessionId: string): Promise<void> {
  await db
    .update(sessionObservationShares)
    .set({ status: 'expired' })
    .where(
      and(
        eq(sessionObservationShares.sessionId, sessionId),
        eq(sessionObservationShares.status, 'active')
      )
    )
}

/**
 * Get all active shares for a session
 */
export async function getActiveSharesForSession(
  sessionId: string
): Promise<SessionObservationShare[]> {
  return db
    .select()
    .from(sessionObservationShares)
    .where(
      and(
        eq(sessionObservationShares.sessionId, sessionId),
        eq(sessionObservationShares.status, 'active')
      )
    )
}
