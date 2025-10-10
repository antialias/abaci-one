"use strict";
/**
 * Player manager for arcade rooms
 * Handles fetching and validating player participation in rooms
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllPlayers = getAllPlayers;
exports.getActivePlayers = getActivePlayers;
exports.getRoomActivePlayers = getRoomActivePlayers;
exports.getRoomPlayerIds = getRoomPlayerIds;
exports.validatePlayerInRoom = validatePlayerInRoom;
exports.getPlayer = getPlayer;
exports.getPlayers = getPlayers;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../../db");
/**
 * Get all players for a user (regardless of isActive status)
 * @param viewerId - The guestId from the cookie (same as what getViewerId() returns)
 */
async function getAllPlayers(viewerId) {
    // First get the user record by guestId
    const user = await db_1.db.query.users.findFirst({
        where: (0, drizzle_orm_1.eq)(db_1.schema.users.guestId, viewerId),
    });
    if (!user) {
        return [];
    }
    // Now query all players by the actual user.id (no isActive filter)
    return await db_1.db.query.players.findMany({
        where: (0, drizzle_orm_1.eq)(db_1.schema.players.userId, user.id),
        orderBy: db_1.schema.players.createdAt,
    });
}
/**
 * Get a user's active players (solo mode)
 * These are the players that will participate when the user joins a solo game
 * @param viewerId - The guestId from the cookie (same as what getViewerId() returns)
 */
async function getActivePlayers(viewerId) {
    // First get the user record by guestId
    const user = await db_1.db.query.users.findFirst({
        where: (0, drizzle_orm_1.eq)(db_1.schema.users.guestId, viewerId),
    });
    if (!user) {
        return [];
    }
    // Now query players by the actual user.id
    return await db_1.db.query.players.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.players.userId, user.id), (0, drizzle_orm_1.eq)(db_1.schema.players.isActive, true)),
        orderBy: db_1.schema.players.createdAt,
    });
}
/**
 * Get active players for all members in a room
 * Returns only players marked isActive=true from each room member
 * Returns a map of userId -> Player[]
 */
async function getRoomActivePlayers(roomId) {
    // Get all room members
    const members = await db_1.db.query.roomMembers.findMany({
        where: (0, drizzle_orm_1.eq)(db_1.schema.roomMembers.roomId, roomId),
    });
    // Fetch active players for each member (respects isActive flag)
    const playerMap = new Map();
    for (const member of members) {
        const players = await getActivePlayers(member.userId);
        playerMap.set(member.userId, players);
    }
    return playerMap;
}
/**
 * Get all player IDs that should participate in a room game
 * Flattens the player lists from all room members
 */
async function getRoomPlayerIds(roomId) {
    const playerMap = await getRoomActivePlayers(roomId);
    const allPlayers = [];
    for (const players of playerMap.values()) {
        allPlayers.push(...players.map((p) => p.id));
    }
    return allPlayers;
}
/**
 * Validate that a player ID belongs to a user who is a member of a room
 */
async function validatePlayerInRoom(playerId, roomId) {
    // Get the player
    const player = await db_1.db.query.players.findFirst({
        where: (0, drizzle_orm_1.eq)(db_1.schema.players.id, playerId),
    });
    if (!player)
        return false;
    // Check if the player's user is a member of the room
    const member = await db_1.db.query.roomMembers.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.roomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.schema.roomMembers.userId, player.userId)),
    });
    return !!member;
}
/**
 * Get player details by ID
 */
async function getPlayer(playerId) {
    return await db_1.db.query.players.findFirst({
        where: (0, drizzle_orm_1.eq)(db_1.schema.players.id, playerId),
    });
}
/**
 * Get multiple players by IDs
 */
async function getPlayers(playerIds) {
    if (playerIds.length === 0)
        return [];
    const players = [];
    for (const id of playerIds) {
        const player = await getPlayer(id);
        if (player)
            players.push(player);
    }
    return players;
}
