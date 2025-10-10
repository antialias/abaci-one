"use strict";
/**
 * Arcade session manager
 * Handles database operations and validation for arcade sessions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getArcadeSessionByRoom = getArcadeSessionByRoom;
exports.createArcadeSession = createArcadeSession;
exports.getArcadeSession = getArcadeSession;
exports.applyGameMove = applyGameMove;
exports.deleteArcadeSession = deleteArcadeSession;
exports.updateSessionActivity = updateSessionActivity;
exports.cleanupExpiredSessions = cleanupExpiredSessions;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../../db");
const validation_1 = require("./validation");
const TTL_HOURS = 24;
/**
 * Helper: Get database user ID from guest ID
 * The API uses guestId (from cookies) but database FKs use the internal user.id
 */
async function getUserIdFromGuestId(guestId) {
    const user = await db_1.db.query.users.findFirst({
        where: (0, drizzle_orm_1.eq)(db_1.schema.users.guestId, guestId),
        columns: { id: true },
    });
    return user?.id;
}
/**
 * Get arcade session by room ID (for room-based multiplayer games)
 * Returns the shared session for all room members
 * @param roomId - The room ID
 */
async function getArcadeSessionByRoom(roomId) {
    const [session] = await db_1.db
        .select()
        .from(db_1.schema.arcadeSessions)
        .where((0, drizzle_orm_1.eq)(db_1.schema.arcadeSessions.roomId, roomId))
        .limit(1);
    if (!session)
        return undefined;
    // Check if session has expired
    if (session.expiresAt < new Date()) {
        // Clean up expired room session
        await db_1.db.delete(db_1.schema.arcadeSessions).where((0, drizzle_orm_1.eq)(db_1.schema.arcadeSessions.roomId, roomId));
        return undefined;
    }
    return session;
}
/**
 * Create a new arcade session
 * For room-based games, checks if a session already exists for the room
 */
async function createArcadeSession(options) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TTL_HOURS * 60 * 60 * 1000);
    // For room-based games, check if session already exists for this room
    if (options.roomId) {
        const existingRoomSession = await getArcadeSessionByRoom(options.roomId);
        if (existingRoomSession) {
            console.log('[Session Manager] Room session already exists, returning existing:', {
                roomId: options.roomId,
                sessionUserId: existingRoomSession.userId,
                version: existingRoomSession.version,
            });
            return existingRoomSession;
        }
    }
    // Find or create user by guest ID
    let user = await db_1.db.query.users.findFirst({
        where: (0, drizzle_orm_1.eq)(db_1.schema.users.guestId, options.userId),
    });
    if (!user) {
        console.log('[Session Manager] Creating new user with guestId:', options.userId);
        const [newUser] = await db_1.db
            .insert(db_1.schema.users)
            .values({
            guestId: options.userId, // Let id auto-generate via $defaultFn
            createdAt: now,
        })
            .returning();
        user = newUser;
        console.log('[Session Manager] Created user with id:', user.id);
    }
    else {
        console.log('[Session Manager] Found existing user with id:', user.id);
    }
    const newSession = {
        userId: user.id, // Use the actual database ID, not the guestId
        currentGame: options.gameName,
        gameUrl: options.gameUrl,
        gameState: options.initialState,
        activePlayers: options.activePlayers,
        roomId: options.roomId, // Associate session with room
        startedAt: now,
        lastActivityAt: now,
        expiresAt,
        isActive: true,
        version: 1,
    };
    console.log('[Session Manager] Creating new session:', {
        userId: user.id,
        roomId: options.roomId,
        gameName: options.gameName,
    });
    const [session] = await db_1.db.insert(db_1.schema.arcadeSessions).values(newSession).returning();
    return session;
}
/**
 * Get active arcade session for a user
 * @param guestId - The guest ID from the cookie (not the database user.id)
 */
async function getArcadeSession(guestId) {
    const userId = await getUserIdFromGuestId(guestId);
    if (!userId)
        return undefined;
    const [session] = await db_1.db
        .select()
        .from(db_1.schema.arcadeSessions)
        .where((0, drizzle_orm_1.eq)(db_1.schema.arcadeSessions.userId, userId))
        .limit(1);
    if (!session)
        return undefined;
    // Check if session has expired
    if (session.expiresAt < new Date()) {
        await deleteArcadeSession(guestId);
        return undefined;
    }
    // Check if session has a valid room association
    // Sessions without rooms are orphaned and should be cleaned up
    if (!session.roomId) {
        console.log('[Session Manager] Deleting orphaned session without room:', session.userId);
        await deleteArcadeSession(guestId);
        return undefined;
    }
    // Verify the room still exists
    const room = await db_1.db.query.arcadeRooms.findFirst({
        where: (0, drizzle_orm_1.eq)(db_1.schema.arcadeRooms.id, session.roomId),
    });
    if (!room) {
        console.log('[Session Manager] Deleting session with non-existent room:', session.roomId);
        await deleteArcadeSession(guestId);
        return undefined;
    }
    return session;
}
/**
 * Apply a game move to the session (with validation)
 * @param userId - The guest ID from the cookie
 * @param move - The game move to apply
 * @param roomId - Optional room ID for room-based games (enables shared session)
 */
async function applyGameMove(userId, move, roomId) {
    // For room-based games, look up the shared room session
    // For solo games, look up the user's personal session
    const session = roomId ? await getArcadeSessionByRoom(roomId) : await getArcadeSession(userId);
    if (!session) {
        return {
            success: false,
            error: 'No active session found',
        };
    }
    if (!session.isActive) {
        return {
            success: false,
            error: 'Session is not active',
        };
    }
    // Get the validator for this game
    const validator = (0, validation_1.getValidator)(session.currentGame);
    console.log('[SessionManager] About to validate move:', {
        moveType: move.type,
        playerId: move.playerId,
        gameStateCurrentPlayer: session.gameState?.currentPlayer,
        gameStateActivePlayers: session.gameState?.activePlayers,
        gameStatePhase: session.gameState?.gamePhase,
    });
    // Fetch player ownership for authorization checks (room-based games)
    let playerOwnership;
    let internalUserId;
    if (session.roomId) {
        try {
            // Convert guestId to internal userId for ownership comparison
            internalUserId = await getUserIdFromGuestId(userId);
            if (!internalUserId) {
                console.error('[SessionManager] Failed to convert guestId to userId:', userId);
                return {
                    success: false,
                    error: 'User not found',
                };
            }
            const players = await db_1.db.query.players.findMany({
                columns: {
                    id: true,
                    userId: true,
                },
            });
            playerOwnership = Object.fromEntries(players.map((p) => [p.id, p.userId]));
            console.log('[SessionManager] Player ownership map:', playerOwnership);
            console.log('[SessionManager] Internal userId for authorization:', internalUserId);
        }
        catch (error) {
            console.error('[SessionManager] Failed to fetch player ownership:', error);
        }
    }
    // Validate the move with authorization context (use internal userId, not guestId)
    const validationResult = validator.validateMove(session.gameState, move, {
        userId: internalUserId || userId, // Use internal userId for room-based games
        playerOwnership,
    });
    console.log('[SessionManager] Validation result:', {
        valid: validationResult.valid,
        error: validationResult.error,
    });
    if (!validationResult.valid) {
        return {
            success: false,
            error: validationResult.error || 'Invalid move',
        };
    }
    // Update the session with new state (using optimistic locking)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TTL_HOURS * 60 * 60 * 1000);
    try {
        const [updatedSession] = await db_1.db
            .update(db_1.schema.arcadeSessions)
            .set({
            gameState: validationResult.newState,
            lastActivityAt: now,
            expiresAt,
            version: session.version + 1,
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.arcadeSessions.userId, session.userId) // Use the userId from the session we just fetched
        )
            // Version check for optimistic locking would go here
            // SQLite doesn't support WHERE clauses in UPDATE with RETURNING easily
            // We'll handle this by checking the version after
            .returning();
        if (!updatedSession) {
            return {
                success: false,
                error: 'Failed to update session',
            };
        }
        return {
            success: true,
            session: updatedSession,
        };
    }
    catch (error) {
        console.error('Error updating session:', error);
        return {
            success: false,
            error: 'Database error',
        };
    }
}
/**
 * Delete an arcade session
 * @param guestId - The guest ID from the cookie (not the database user.id)
 */
async function deleteArcadeSession(guestId) {
    const userId = await getUserIdFromGuestId(guestId);
    if (!userId)
        return;
    await db_1.db.delete(db_1.schema.arcadeSessions).where((0, drizzle_orm_1.eq)(db_1.schema.arcadeSessions.userId, userId));
}
/**
 * Update session activity timestamp (keep-alive)
 * @param guestId - The guest ID from the cookie (not the database user.id)
 */
async function updateSessionActivity(guestId) {
    const userId = await getUserIdFromGuestId(guestId);
    if (!userId)
        return;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TTL_HOURS * 60 * 60 * 1000);
    await db_1.db
        .update(db_1.schema.arcadeSessions)
        .set({
        lastActivityAt: now,
        expiresAt,
    })
        .where((0, drizzle_orm_1.eq)(db_1.schema.arcadeSessions.userId, userId));
}
/**
 * Clean up expired sessions (should be called periodically)
 */
async function cleanupExpiredSessions() {
    const now = new Date();
    const result = await db_1.db
        .delete(db_1.schema.arcadeSessions)
        .where((0, drizzle_orm_1.eq)(db_1.schema.arcadeSessions.expiresAt, now))
        .returning();
    return result.length;
}
