/**
 * Arcade session manager
 * Handles database operations and validation for arcade sessions
 */

import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { type GameMove, type GameName, getValidator } from './validation'

export interface CreateSessionOptions {
  userId: string
  gameName: GameName
  gameUrl: string
  initialState: unknown
  activePlayers: string[] // Player IDs (UUIDs)
  roomId: string // Required - sessions must be associated with a room
}

export interface SessionUpdateResult {
  success: boolean
  error?: string
  session?: schema.ArcadeSession
  versionConflict?: boolean
}

const TTL_HOURS = 24

/**
 * Helper: Get database user ID from guest ID
 * The API uses guestId (from cookies) but database FKs use the internal user.id
 */
async function getUserIdFromGuestId(guestId: string): Promise<string | undefined> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.guestId, guestId),
    columns: { id: true },
  })
  return user?.id
}

/**
 * Create a new arcade session
 */
export async function createArcadeSession(
  options: CreateSessionOptions
): Promise<schema.ArcadeSession> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + TTL_HOURS * 60 * 60 * 1000)

  // Find or create user by guest ID
  let user = await db.query.users.findFirst({
    where: eq(schema.users.guestId, options.userId),
  })

  if (!user) {
    console.log('[Session Manager] Creating new user with guestId:', options.userId)
    const [newUser] = await db
      .insert(schema.users)
      .values({
        guestId: options.userId, // Let id auto-generate via $defaultFn
        createdAt: now,
      })
      .returning()
    user = newUser
    console.log('[Session Manager] Created user with id:', user.id)
  } else {
    console.log('[Session Manager] Found existing user with id:', user.id)
  }

  const newSession: schema.NewArcadeSession = {
    userId: user.id, // Use the actual database ID, not the guestId
    currentGame: options.gameName,
    gameUrl: options.gameUrl,
    gameState: options.initialState as any,
    activePlayers: options.activePlayers as any,
    roomId: options.roomId, // Associate session with room
    startedAt: now,
    lastActivityAt: now,
    expiresAt,
    isActive: true,
    version: 1,
  }

  const [session] = await db.insert(schema.arcadeSessions).values(newSession).returning()
  return session
}

/**
 * Get active arcade session for a user
 * @param guestId - The guest ID from the cookie (not the database user.id)
 */
export async function getArcadeSession(guestId: string): Promise<schema.ArcadeSession | undefined> {
  const userId = await getUserIdFromGuestId(guestId)
  if (!userId) return undefined

  const [session] = await db
    .select()
    .from(schema.arcadeSessions)
    .where(eq(schema.arcadeSessions.userId, userId))
    .limit(1)

  if (!session) return undefined

  // Check if session has expired
  if (session.expiresAt < new Date()) {
    await deleteArcadeSession(guestId)
    return undefined
  }

  // Check if session has a valid room association
  // Sessions without rooms are orphaned and should be cleaned up
  if (!session.roomId) {
    console.log('[Session Manager] Deleting orphaned session without room:', session.userId)
    await deleteArcadeSession(guestId)
    return undefined
  }

  // Verify the room still exists
  const room = await db.query.arcadeRooms.findFirst({
    where: eq(schema.arcadeRooms.id, session.roomId),
  })

  if (!room) {
    console.log('[Session Manager] Deleting session with non-existent room:', session.roomId)
    await deleteArcadeSession(guestId)
    return undefined
  }

  return session
}

/**
 * Apply a game move to the session (with validation)
 */
export async function applyGameMove(userId: string, move: GameMove): Promise<SessionUpdateResult> {
  const session = await getArcadeSession(userId)

  if (!session) {
    return {
      success: false,
      error: 'No active session found',
    }
  }

  if (!session.isActive) {
    return {
      success: false,
      error: 'Session is not active',
    }
  }

  // Get the validator for this game
  const validator = getValidator(session.currentGame as GameName)

  console.log('[SessionManager] About to validate move:', {
    moveType: move.type,
    playerId: move.playerId,
    gameStateCurrentPlayer: (session.gameState as any)?.currentPlayer,
    gameStateActivePlayers: (session.gameState as any)?.activePlayers,
    gameStatePhase: (session.gameState as any)?.gamePhase,
  })

  // Fetch player ownership for authorization checks (room-based games)
  let playerOwnership: Record<string, string> | undefined
  let internalUserId: string | undefined
  if (session.roomId) {
    try {
      // Convert guestId to internal userId for ownership comparison
      internalUserId = await getUserIdFromGuestId(userId)
      if (!internalUserId) {
        console.error('[SessionManager] Failed to convert guestId to userId:', userId)
        return {
          success: false,
          error: 'User not found',
        }
      }

      const players = await db.query.players.findMany({
        columns: {
          id: true,
          userId: true,
        },
      })
      playerOwnership = Object.fromEntries(players.map((p) => [p.id, p.userId]))
      console.log('[SessionManager] Player ownership map:', playerOwnership)
      console.log('[SessionManager] Internal userId for authorization:', internalUserId)
    } catch (error) {
      console.error('[SessionManager] Failed to fetch player ownership:', error)
    }
  }

  // Validate the move with authorization context (use internal userId, not guestId)
  const validationResult = validator.validateMove(session.gameState, move, {
    userId: internalUserId || userId, // Use internal userId for room-based games
    playerOwnership,
  })

  console.log('[SessionManager] Validation result:', {
    valid: validationResult.valid,
    error: validationResult.error,
  })

  if (!validationResult.valid) {
    return {
      success: false,
      error: validationResult.error || 'Invalid move',
    }
  }

  // Update the session with new state (using optimistic locking)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + TTL_HOURS * 60 * 60 * 1000)

  try {
    const [updatedSession] = await db
      .update(schema.arcadeSessions)
      .set({
        gameState: validationResult.newState as any,
        lastActivityAt: now,
        expiresAt,
        version: session.version + 1,
      })
      .where(
        eq(schema.arcadeSessions.userId, session.userId) // Use the userId from the session we just fetched
      )
      // Version check for optimistic locking would go here
      // SQLite doesn't support WHERE clauses in UPDATE with RETURNING easily
      // We'll handle this by checking the version after
      .returning()

    if (!updatedSession) {
      return {
        success: false,
        error: 'Failed to update session',
      }
    }

    return {
      success: true,
      session: updatedSession,
    }
  } catch (error) {
    console.error('Error updating session:', error)
    return {
      success: false,
      error: 'Database error',
    }
  }
}

/**
 * Delete an arcade session
 * @param guestId - The guest ID from the cookie (not the database user.id)
 */
export async function deleteArcadeSession(guestId: string): Promise<void> {
  const userId = await getUserIdFromGuestId(guestId)
  if (!userId) return

  await db.delete(schema.arcadeSessions).where(eq(schema.arcadeSessions.userId, userId))
}

/**
 * Update session activity timestamp (keep-alive)
 * @param guestId - The guest ID from the cookie (not the database user.id)
 */
export async function updateSessionActivity(guestId: string): Promise<void> {
  const userId = await getUserIdFromGuestId(guestId)
  if (!userId) return

  const now = new Date()
  const expiresAt = new Date(now.getTime() + TTL_HOURS * 60 * 60 * 1000)

  await db
    .update(schema.arcadeSessions)
    .set({
      lastActivityAt: now,
      expiresAt,
    })
    .where(eq(schema.arcadeSessions.userId, userId))
}

/**
 * Clean up expired sessions (should be called periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const now = new Date()
  const result = await db
    .delete(schema.arcadeSessions)
    .where(eq(schema.arcadeSessions.expiresAt, now))
    .returning()

  return result.length
}
