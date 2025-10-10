"use strict";
/**
 * Arcade room manager
 * Handles database operations for arcade rooms
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoom = createRoom;
exports.getRoomById = getRoomById;
exports.getRoomByCode = getRoomByCode;
exports.updateRoom = updateRoom;
exports.touchRoom = touchRoom;
exports.deleteRoom = deleteRoom;
exports.listActiveRooms = listActiveRooms;
exports.cleanupExpiredRooms = cleanupExpiredRooms;
exports.isRoomCreator = isRoomCreator;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../../db");
const room_code_1 = require("./room-code");
/**
 * Create a new arcade room
 * Generates a unique room code and creates the room in the database
 */
async function createRoom(options) {
    const now = new Date();
    // Generate unique room code (retry up to 5 times if collision)
    let code = (0, room_code_1.generateRoomCode)();
    let attempts = 0;
    const MAX_ATTEMPTS = 5;
    while (attempts < MAX_ATTEMPTS) {
        const existing = await getRoomByCode(code);
        if (!existing)
            break;
        code = (0, room_code_1.generateRoomCode)();
        attempts++;
    }
    if (attempts === MAX_ATTEMPTS) {
        throw new Error('Failed to generate unique room code');
    }
    const newRoom = {
        code,
        name: options.name,
        createdBy: options.createdBy,
        creatorName: options.creatorName,
        createdAt: now,
        lastActivity: now,
        ttlMinutes: options.ttlMinutes || 60,
        isLocked: false,
        gameName: options.gameName,
        gameConfig: options.gameConfig,
        status: 'lobby',
        currentSessionId: null,
        totalGamesPlayed: 0,
    };
    const [room] = await db_1.db.insert(db_1.schema.arcadeRooms).values(newRoom).returning();
    console.log('[Room Manager] Created room:', room.id, 'code:', room.code);
    return room;
}
/**
 * Get a room by ID
 */
async function getRoomById(roomId) {
    return await db_1.db.query.arcadeRooms.findFirst({
        where: (0, drizzle_orm_1.eq)(db_1.schema.arcadeRooms.id, roomId),
    });
}
/**
 * Get a room by code
 */
async function getRoomByCode(code) {
    return await db_1.db.query.arcadeRooms.findFirst({
        where: (0, drizzle_orm_1.eq)(db_1.schema.arcadeRooms.code, code.toUpperCase()),
    });
}
/**
 * Update a room
 */
async function updateRoom(roomId, updates) {
    const now = new Date();
    // Always update lastActivity on any room update
    const updateData = {
        ...updates,
        lastActivity: now,
    };
    const [updated] = await db_1.db
        .update(db_1.schema.arcadeRooms)
        .set(updateData)
        .where((0, drizzle_orm_1.eq)(db_1.schema.arcadeRooms.id, roomId))
        .returning();
    return updated;
}
/**
 * Update room activity timestamp
 * Call this on any room activity to refresh TTL
 */
async function touchRoom(roomId) {
    await db_1.db
        .update(db_1.schema.arcadeRooms)
        .set({ lastActivity: new Date() })
        .where((0, drizzle_orm_1.eq)(db_1.schema.arcadeRooms.id, roomId));
}
/**
 * Delete a room
 * Cascade deletes all room members
 */
async function deleteRoom(roomId) {
    await db_1.db.delete(db_1.schema.arcadeRooms).where((0, drizzle_orm_1.eq)(db_1.schema.arcadeRooms.id, roomId));
    console.log('[Room Manager] Deleted room:', roomId);
}
/**
 * List active rooms
 * Returns rooms ordered by most recently active
 */
async function listActiveRooms(gameName) {
    const whereConditions = [];
    // Filter by game if specified
    if (gameName) {
        whereConditions.push((0, drizzle_orm_1.eq)(db_1.schema.arcadeRooms.gameName, gameName));
    }
    // Only return non-locked rooms in lobby or playing status
    whereConditions.push((0, drizzle_orm_1.eq)(db_1.schema.arcadeRooms.isLocked, false), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(db_1.schema.arcadeRooms.status, 'lobby'), (0, drizzle_orm_1.eq)(db_1.schema.arcadeRooms.status, 'playing')));
    return await db_1.db.query.arcadeRooms.findMany({
        where: whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined,
        orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.arcadeRooms.lastActivity)],
        limit: 50, // Limit to 50 most recent rooms
    });
}
/**
 * Clean up expired rooms
 * Delete rooms that have exceeded their TTL
 */
async function cleanupExpiredRooms() {
    const now = new Date();
    // Find rooms where lastActivity + ttlMinutes < now
    const expiredRooms = await db_1.db.query.arcadeRooms.findMany({
        columns: { id: true, ttlMinutes: true, lastActivity: true },
    });
    const toDelete = expiredRooms.filter((room) => {
        const expiresAt = new Date(room.lastActivity.getTime() + room.ttlMinutes * 60 * 1000);
        return expiresAt < now;
    });
    if (toDelete.length > 0) {
        const ids = toDelete.map((r) => r.id);
        await db_1.db.delete(db_1.schema.arcadeRooms).where((0, drizzle_orm_1.or)(...ids.map((id) => (0, drizzle_orm_1.eq)(db_1.schema.arcadeRooms.id, id))));
        console.log(`[Room Manager] Cleaned up ${toDelete.length} expired rooms`);
    }
    return toDelete.length;
}
/**
 * Check if a user is the creator of a room
 */
async function isRoomCreator(roomId, userId) {
    const room = await getRoomById(roomId);
    return room?.createdBy === userId;
}
