/**
 * Arcade session manager
 * Handles database operations and validation for arcade sessions
 */

import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { buildPlayerOwnershipMap, type PlayerOwnershipMap } from './player-ownership'
import { type GameMove, type GameName, getValidator } from './validation'

export interface CreateSessionOptions {
  userId: string // User who owns/created the session (typically room creator)
  gameName: GameName
  gameUrl: string
  initialState: unknown
  activePlayers: string[] // Player IDs (UUIDs)
  roomId: string // Required - PRIMARY KEY, one session per room
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
 * Get arcade session by room ID (for room-based multiplayer games)
 * Returns the shared session for all room members
 * @param roomId - The room ID (primary key)
 */
export async function getArcadeSessionByRoom(
  roomId: string
): Promise<schema.ArcadeSession | undefined> {
  // roomId is now the PRIMARY KEY, so direct lookup
  const [session] = await db
    .select()
    .from(schema.arcadeSessions)
    .where(eq(schema.arcadeSessions.roomId, roomId))
    .limit(1)

  if (!session) return undefined

  // Check if session has expired
  if (session.expiresAt < new Date()) {
    // Clean up expired room session
    await db.delete(schema.arcadeSessions).where(eq(schema.arcadeSessions.roomId, roomId))
    return undefined
  }

  return session
}

/**
 * Create a new arcade session
 * For room-based games, roomId is the PRIMARY KEY ensuring one session per room
 */
export async function createArcadeSession(
  options: CreateSessionOptions
): Promise<schema.ArcadeSession> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + TTL_HOURS * 60 * 60 * 1000)

  // Check if session already exists for this room (roomId is PRIMARY KEY)
  const existingRoomSession = await getArcadeSessionByRoom(options.roomId)
  if (existingRoomSession) {
    console.log('[Session Manager] Room session already exists, returning existing:', {
      roomId: options.roomId,
      sessionUserId: existingRoomSession.userId,
      version: existingRoomSession.version,
    })
    return existingRoomSession
  }

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
    roomId: options.roomId, // PRIMARY KEY - one session per room
    userId: user.id, // Use the actual database ID, not the guestId
    currentGame: options.gameName,
    gameUrl: options.gameUrl,
    gameState: options.initialState as any,
    activePlayers: options.activePlayers as any,
    startedAt: now,
    lastActivityAt: now,
    expiresAt,
    isActive: true,
    version: 1,
  }

  console.log('[Session Manager] Creating new session:', {
    roomId: options.roomId,
    userId: user.id,
    gameName: options.gameName,
  })

  try {
    const [session] = await db.insert(schema.arcadeSessions).values(newSession).returning()
    return session
  } catch (error) {
    // Handle PRIMARY KEY constraint violation (UNIQUE constraint on roomId)
    // This can happen if two users try to create a session for the same room simultaneously
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      console.log(
        '[Session Manager] Session already exists (race condition), fetching existing session for room:',
        options.roomId
      )
      const existingSession = await getArcadeSessionByRoom(options.roomId)
      if (existingSession) {
        return existingSession
      }
    }
    // Re-throw other errors
    throw error
  }
}

/**
 * Get active arcade session for a user
 * NOTE: With the new schema, userId is not the PRIMARY KEY (roomId is)
 * This function finds sessions where the user is associated
 * @param guestId - The guest ID from the cookie (not the database user.id)
 */
export async function getArcadeSession(guestId: string): Promise<schema.ArcadeSession | undefined> {
  const userId = await getUserIdFromGuestId(guestId)
  if (!userId) return undefined

  // Query for sessions where this user is associated
  // Since roomId is PRIMARY KEY, there can be multiple rooms but only one session per room
  const [session] = await db
    .select()
    .from(schema.arcadeSessions)
    .where(eq(schema.arcadeSessions.userId, userId))
    .limit(1)

  if (!session) return undefined

  // Check if session has expired
  if (session.expiresAt < new Date()) {
    await deleteArcadeSessionByRoom(session.roomId)
    return undefined
  }

  // Verify the room still exists (roomId is now required/PRIMARY KEY)
  const room = await db.query.arcadeRooms.findFirst({
    where: eq(schema.arcadeRooms.id, session.roomId),
  })

  if (!room) {
    console.log('[Session Manager] Deleting session with non-existent room:', session.roomId)
    await deleteArcadeSessionByRoom(session.roomId)
    return undefined
  }

  return session
}

/**
 * Apply a game move to the session (with validation)
 * @param userId - The guest ID from the cookie
 * @param move - The game move to apply
 * @param roomId - Optional room ID for room-based games (enables shared session)
 */
export async function applyGameMove(
  userId: string,
  move: GameMove,
  roomId?: string
): Promise<SessionUpdateResult> {
  // For room-based games, look up the shared room session
  // For solo games, look up the user's personal session
  const session = roomId ? await getArcadeSessionByRoom(roomId) : await getArcadeSession(userId)

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
    gameName: session.currentGame,
    moveType: move.type,
    playerId: move.playerId,
    moveData: move.type === 'SET_CONFIG' ? (move as any).data : undefined,
    gameStateCurrentPlayer: (session.gameState as any)?.currentPlayer,
    gameStateActivePlayers: (session.gameState as any)?.activePlayers,
    gameStatePhase: (session.gameState as any)?.gamePhase,
  })

  // Fetch player ownership for authorization checks (room-based games)
  let playerOwnership: PlayerOwnershipMap | undefined
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

      // Use centralized ownership utility
      playerOwnership = await buildPlayerOwnershipMap(session.roomId)
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
        eq(schema.arcadeSessions.roomId, session.roomId) // Use roomId (PRIMARY KEY)
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
 * Delete an arcade session by room ID
 * @param roomId - The room ID (PRIMARY KEY)
 */
export async function deleteArcadeSessionByRoom(roomId: string): Promise<void> {
  await db.delete(schema.arcadeSessions).where(eq(schema.arcadeSessions.roomId, roomId))
}

/**
 * Delete an arcade session by user (finds the user's session first)
 * @param guestId - The guest ID from the cookie (not the database user.id)
 */
export async function deleteArcadeSession(guestId: string): Promise<void> {
  // First find the session to get its roomId
  const session = await getArcadeSession(guestId)
  if (!session) return

  // Delete by roomId (PRIMARY KEY)
  await deleteArcadeSessionByRoom(session.roomId)
}

/**
 * Update session activity timestamp (keep-alive)
 * @param guestId - The guest ID from the cookie (not the database user.id)
 */
export async function updateSessionActivity(guestId: string): Promise<void> {
  // First find the session to get its roomId
  const session = await getArcadeSession(guestId)
  if (!session) return

  const now = new Date()
  const expiresAt = new Date(now.getTime() + TTL_HOURS * 60 * 60 * 1000)

  // Update using roomId (PRIMARY KEY)
  await db
    .update(schema.arcadeSessions)
    .set({
      lastActivityAt: now,
      expiresAt,
    })
    .where(eq(schema.arcadeSessions.roomId, session.roomId))
}

/**
 * Update session's active players (only if game hasn't started)
 * Used when new members join a room
 * @param roomId - The room ID (PRIMARY KEY)
 * @param playerIds - Array of player IDs to set as active players
 * @returns true if updated, false if game already started or session not found
 */
export async function updateSessionActivePlayers(
  roomId: string,
  playerIds: string[]
): Promise<boolean> {
  const session = await getArcadeSessionByRoom(roomId)
  if (!session) return false

  // Only update if game is in setup phase (not started yet)
  const gameState = session.gameState as any
  if (gameState.gamePhase !== 'setup') {
    console.log('[Session Manager] Cannot update activePlayers - game already started:', {
      roomId,
      gamePhase: gameState.gamePhase,
    })
    return false
  }

  // Update both the session's activePlayers field AND the game state
  const updatedGameState = {
    ...gameState,
    activePlayers: playerIds,
  }

  const now = new Date()
  await db
    .update(schema.arcadeSessions)
    .set({
      activePlayers: playerIds as any,
      gameState: updatedGameState as any,
      lastActivityAt: now,
      version: session.version + 1,
    })
    .where(eq(schema.arcadeSessions.roomId, roomId))

  console.log('[Session Manager] Updated session activePlayers:', {
    roomId,
    playerIds,
    count: playerIds.length,
  })

  return true
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
