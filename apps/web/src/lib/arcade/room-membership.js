"use strict";
/**
 * Room membership manager
 * Handles database operations for room members
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addRoomMember = addRoomMember;
exports.getRoomMember = getRoomMember;
exports.getRoomMembers = getRoomMembers;
exports.getOnlineRoomMembers = getOnlineRoomMembers;
exports.setMemberOnline = setMemberOnline;
exports.touchMember = touchMember;
exports.removeMember = removeMember;
exports.removeAllMembers = removeAllMembers;
exports.getOnlineMemberCount = getOnlineMemberCount;
exports.isMember = isMember;
exports.getUserRooms = getUserRooms;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("../../db");
/**
 * Add a member to a room
 * Automatically removes user from any other rooms they're in (modal room enforcement)
 * Returns the new membership and info about rooms that were auto-left
 */
async function addRoomMember(options) {
    const now = new Date();
    // Check if member already exists in THIS room
    const existing = await getRoomMember(options.roomId, options.userId);
    if (existing) {
        // Already in this room - just update status (no auto-leave needed)
        const [updated] = await db_1.db
            .update(db_1.schema.roomMembers)
            .set({
            isOnline: true,
            lastSeen: now,
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.roomMembers.id, existing.id))
            .returning();
        return { member: updated };
    }
    // AUTO-LEAVE LOGIC: Remove from all other rooms before joining this one
    const currentRooms = await getUserRooms(options.userId);
    const autoLeaveResult = {
        leftRooms: [],
        previousRoomMembers: [],
    };
    for (const roomId of currentRooms) {
        if (roomId !== options.roomId) {
            // Get member info before removing (for socket events)
            const memberToRemove = await getRoomMember(roomId, options.userId);
            if (memberToRemove) {
                autoLeaveResult.previousRoomMembers.push({
                    roomId,
                    member: memberToRemove,
                });
            }
            // Remove from room
            await removeMember(roomId, options.userId);
            autoLeaveResult.leftRooms.push(roomId);
            console.log(`[Room Membership] Auto-left room ${roomId} for user ${options.userId}`);
        }
    }
    // Now add to new room
    const newMember = {
        roomId: options.roomId,
        userId: options.userId,
        displayName: options.displayName,
        isCreator: options.isCreator || false,
        joinedAt: now,
        lastSeen: now,
        isOnline: true,
    };
    try {
        const [member] = await db_1.db.insert(db_1.schema.roomMembers).values(newMember).returning();
        console.log('[Room Membership] Added member:', member.userId, 'to room:', member.roomId);
        return {
            member,
            autoLeaveResult: autoLeaveResult.leftRooms.length > 0 ? autoLeaveResult : undefined,
        };
    }
    catch (error) {
        // Handle unique constraint violation
        // This should rarely happen due to auto-leave logic above, but catch it for safety
        if (error.code === 'SQLITE_CONSTRAINT' ||
            error.message?.includes('UNIQUE') ||
            error.message?.includes('unique')) {
            console.error('[Room Membership] Unique constraint violation:', error.message);
            throw new Error('ROOM_MEMBERSHIP_CONFLICT: User is already in another room. This should have been handled by auto-leave logic.');
        }
        throw error;
    }
}
/**
 * Get a specific room member
 */
async function getRoomMember(roomId, userId) {
    return await db_1.db.query.roomMembers.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.roomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.schema.roomMembers.userId, userId)),
    });
}
/**
 * Get all members in a room
 */
async function getRoomMembers(roomId) {
    return await db_1.db.query.roomMembers.findMany({
        where: (0, drizzle_orm_1.eq)(db_1.schema.roomMembers.roomId, roomId),
        orderBy: db_1.schema.roomMembers.joinedAt,
    });
}
/**
 * Get online members in a room
 */
async function getOnlineRoomMembers(roomId) {
    return await db_1.db.query.roomMembers.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.roomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.schema.roomMembers.isOnline, true)),
        orderBy: db_1.schema.roomMembers.joinedAt,
    });
}
/**
 * Update member's online status
 */
async function setMemberOnline(roomId, userId, isOnline) {
    await db_1.db
        .update(db_1.schema.roomMembers)
        .set({
        isOnline,
        lastSeen: new Date(),
    })
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.roomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.schema.roomMembers.userId, userId)));
}
/**
 * Update member's last seen timestamp
 */
async function touchMember(roomId, userId) {
    await db_1.db
        .update(db_1.schema.roomMembers)
        .set({ lastSeen: new Date() })
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.roomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.schema.roomMembers.userId, userId)));
}
/**
 * Remove a member from a room
 */
async function removeMember(roomId, userId) {
    await db_1.db
        .delete(db_1.schema.roomMembers)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.roomMembers.roomId, roomId), (0, drizzle_orm_1.eq)(db_1.schema.roomMembers.userId, userId)));
    console.log('[Room Membership] Removed member:', userId, 'from room:', roomId);
}
/**
 * Remove all members from a room
 */
async function removeAllMembers(roomId) {
    await db_1.db.delete(db_1.schema.roomMembers).where((0, drizzle_orm_1.eq)(db_1.schema.roomMembers.roomId, roomId));
    console.log('[Room Membership] Removed all members from room:', roomId);
}
/**
 * Get count of online members in a room
 */
async function getOnlineMemberCount(roomId) {
    const members = await getOnlineRoomMembers(roomId);
    return members.length;
}
/**
 * Check if a user is a member of a room
 */
async function isMember(roomId, userId) {
    const member = await getRoomMember(roomId, userId);
    return !!member;
}
/**
 * Get all rooms a user is a member of
 */
async function getUserRooms(userId) {
    const memberships = await db_1.db.query.roomMembers.findMany({
        where: (0, drizzle_orm_1.eq)(db_1.schema.roomMembers.userId, userId),
        columns: { roomId: true },
    });
    return memberships.map((m) => m.roomId);
}
