/**
 * Arcade session manager
 * Handles database operations and validation for arcade sessions
 */

import { eq, and } from 'drizzle-orm'
import { db, schema } from '@/db'
import { buildPlayerOwnershipMap, type PlayerOwnershipMap } from './player-ownership'
import { getValidator, type GameName } from './validators'
import type { GameMove } from './validation/types'

/**
 * Namespaced game state structure.
 * Each game's state is stored under its game name key.
 * This allows switching games without losing state.
 */
export type NamespacedGameState = {
  [gameName: string]: unknown
}

/**
 * Check if gameState is in the new namespaced format.
 * Old format: flat state object
 * New format: { [gameName]: state }
 */
function isNamespacedState(gameState: unknown): gameState is NamespacedGameState {
  if (!gameState || typeof gameState !== 'object') return false
  // Check if it looks like a namespaced state (has game name keys)
  // The old format would have keys like 'gamePhase', 'regionsFound', etc.
  // The new format has keys like 'know-your-world', 'matching', etc.
  const keys = Object.keys(gameState)
  // If it has typical game state keys, it's the old format
  const oldFormatKeys = ['gamePhase', 'currentPrompt', 'cards', 'board', 'score']
  return !keys.some((key) => oldFormatKeys.includes(key))
}

/**
 * Extract a game's state from the session, handling both old and new formats.
 * @param session - The arcade session
 * @param gameName - The game to extract state for
 * @returns The game-specific state, or undefined if not found
 */
export function getGameStateFromSession(
  session: schema.ArcadeSession,
  gameName: string
): unknown | undefined {
  const gameState = session.gameState as unknown

  const isNamespaced = isNamespacedState(gameState)
  console.log('[getGameStateFromSession]', {
    gameName,
    isNamespaced,
    topLevelKeys: gameState ? Object.keys(gameState as object).slice(0, 10) : [],
    sessionCurrentGame: session.currentGame,
    roomId: session.roomId,
  })

  if (isNamespaced) {
    // New format: extract from namespace
    const extracted = (gameState as NamespacedGameState)[gameName]
    console.log('[getGameStateFromSession] Extracted namespaced state:', {
      gameName,
      hasState: extracted !== undefined,
      extractedKeys: extracted ? Object.keys(extracted as object).slice(0, 10) : [],
    })
    return extracted
  }

  // Old format: if currentGame matches, return the flat state
  // This provides backward compatibility during migration
  if (session.currentGame === gameName) {
    console.log('[getGameStateFromSession] Using old format flat state')
    return gameState
  }

  // Game mismatch with old format - no state available
  console.log('[getGameStateFromSession] Old format but game mismatch, returning undefined')
  return undefined
}

/**
 * Create a namespaced game state object with the given game's state.
 * Preserves existing game states when updating.
 */
export function setGameStateInNamespace(
  existingState: unknown,
  gameName: string,
  newState: unknown
): NamespacedGameState {
  const namespaced: NamespacedGameState = isNamespacedState(existingState)
    ? { ...existingState }
    : {}

  namespaced[gameName] = newState
  return namespaced
}

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
    return existingRoomSession
  }

  // Find or create user by guest ID
  let user = await db.query.users.findFirst({
    where: eq(schema.users.guestId, options.userId),
  })

  if (!user) {
    const [newUser] = await db
      .insert(schema.users)
      .values({
        guestId: options.userId, // Let id auto-generate via $defaultFn
        createdAt: now,
      })
      .returning()
    user = newUser
  }

  // Delete any existing sessions for this user (to handle UNIQUE constraint on userId)
  // This ensures the user can start a new game session
  await db.delete(schema.arcadeSessions).where(eq(schema.arcadeSessions.userId, user.id))

  // Store game state in namespaced format: { [gameName]: state }
  // This allows switching games without losing state
  const namespacedState: NamespacedGameState = {
    [options.gameName]: options.initialState,
  }

  const newSession: schema.NewArcadeSession = {
    roomId: options.roomId, // PRIMARY KEY - one session per room
    userId: user.id, // Use the actual database ID, not the guestId
    currentGame: options.gameName,
    gameUrl: options.gameUrl,
    gameState: namespacedState as any,
    activePlayers: options.activePlayers as any,
    startedAt: now,
    lastActivityAt: now,
    expiresAt,
    isActive: true,
    version: 1,
  }

  try {
    const [session] = await db.insert(schema.arcadeSessions).values(newSession).returning()
    return session
  } catch (error) {
    // Handle PRIMARY KEY constraint violation (UNIQUE constraint on roomId)
    // This can happen if two users try to create a session for the same room simultaneously
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
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
  const gameName = session.currentGame as GameName
  const validator = await getValidator(gameName)

  // Extract the current game's state from the namespaced storage
  const currentGameState = getGameStateFromSession(session, gameName)
  if (currentGameState === undefined) {
    console.error(
      `[SessionManager] No state found for game ${gameName} in session ${session.roomId}`
    )
    return {
      success: false,
      error: `No state found for game ${gameName}`,
    }
  }

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
    } catch (error) {
      console.error('[SessionManager] Failed to fetch player ownership:', error)
    }
  }

  // Validate the move with authorization context (use internal userId, not guestId)
  // Pass the extracted game-specific state, not the full namespaced object
  const validationResult = await validator.validateMove(currentGameState, move, {
    userId: internalUserId || userId, // Use internal userId for room-based games
    playerOwnership,
  })

  if (!validationResult.valid) {
    return {
      success: false,
      error: validationResult.error || 'Invalid move',
    }
  }

  // Update the session with new state (using optimistic locking)
  // Store the new state in the namespaced format, preserving other games' states
  const updatedNamespacedState = setGameStateInNamespace(
    session.gameState,
    gameName,
    validationResult.newState
  )

  const now = new Date()
  const expiresAt = new Date(now.getTime() + TTL_HOURS * 60 * 60 * 1000)

  try {
    const [updatedSession] = await db
      .update(schema.arcadeSessions)
      .set({
        gameState: updatedNamespacedState as any,
        lastActivityAt: now,
        expiresAt,
        version: session.version + 1,
      })
      .where(
        and(
          eq(schema.arcadeSessions.roomId, session.roomId), // Use roomId (PRIMARY KEY)
          eq(schema.arcadeSessions.version, session.version) // Optimistic locking
        )
      )
      .returning()

    if (!updatedSession) {
      // Version conflict - another move was processed first
      // Query the current state to see what version we're at now
      const [currentSession] = await db
        .select()
        .from(schema.arcadeSessions)
        .where(eq(schema.arcadeSessions.roomId, session.roomId))
        .limit(1)

      const versionDiff = currentSession ? currentSession.version - session.version : 'unknown'
      console.warn(
        `[SessionManager] VERSION_CONFLICT room=${session.roomId} game=${session.currentGame} expected_v=${session.version} actual_v=${currentSession?.version} diff=${versionDiff} move=${move.type} user=${internalUserId || userId}`
      )
      return {
        success: false,
        error: 'Version conflict - please retry',
        versionConflict: true,
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

  // Extract the current game's state
  const gameName = session.currentGame as string
  const currentGameState = getGameStateFromSession(session, gameName) as Record<string, unknown>

  if (!currentGameState) {
    console.error(
      `[SessionManager] No state found for game ${gameName} when updating active players`
    )
    return false
  }

  // Only update if game is in setup phase (not started yet)
  if (currentGameState.gamePhase !== 'setup') {
    return false
  }

  // Update the game state with new player IDs
  const updatedGameState = {
    ...currentGameState,
    activePlayers: playerIds,
  }

  // Store back in namespaced format
  const updatedNamespacedState = setGameStateInNamespace(
    session.gameState,
    gameName,
    updatedGameState
  )

  const now = new Date()
  await db
    .update(schema.arcadeSessions)
    .set({
      activePlayers: playerIds as any,
      gameState: updatedNamespacedState as any,
      lastActivityAt: now,
      version: session.version + 1,
    })
    .where(eq(schema.arcadeSessions.roomId, roomId))

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
