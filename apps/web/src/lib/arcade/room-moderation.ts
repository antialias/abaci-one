/**
 * Room Moderation Library
 * Handles reports, bans, and kicks for arcade rooms
 */

import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  roomBans,
  roomMembers,
  roomReports,
  type NewRoomBan,
  type NewRoomReport,
} from '@/db/schema'
import { recordRoomMemberHistory } from './room-member-history'

/**
 * Check if a user is banned from a room
 */
export async function isUserBanned(roomId: string, userId: string): Promise<boolean> {
  const ban = await db
    .select()
    .from(roomBans)
    .where(and(eq(roomBans.roomId, roomId), eq(roomBans.userId, userId)))
    .limit(1)

  return ban.length > 0
}

/**
 * Get all bans for a room
 */
export async function getRoomBans(roomId: string) {
  return db
    .select()
    .from(roomBans)
    .where(eq(roomBans.roomId, roomId))
    .orderBy(desc(roomBans.createdAt))
}

/**
 * Ban a user from a room
 */
export async function banUserFromRoom(params: {
  roomId: string
  userId: string
  userName: string
  bannedBy: string
  bannedByName: string
  reason: 'harassment' | 'cheating' | 'inappropriate-name' | 'spam' | 'afk' | 'other'
  notes?: string
}) {
  // Insert ban record (upsert in case they were already banned)
  const [ban] = await db
    .insert(roomBans)
    .values({
      roomId: params.roomId,
      userId: params.userId,
      userName: params.userName,
      bannedBy: params.bannedBy,
      bannedByName: params.bannedByName,
      reason: params.reason,
      notes: params.notes,
    })
    .onConflictDoUpdate({
      target: [roomBans.userId, roomBans.roomId],
      set: {
        bannedBy: params.bannedBy,
        bannedByName: params.bannedByName,
        reason: params.reason,
        notes: params.notes,
        createdAt: new Date(),
      },
    })
    .returning()

  // Remove user from room members
  await db
    .delete(roomMembers)
    .where(and(eq(roomMembers.roomId, params.roomId), eq(roomMembers.userId, params.userId)))

  // Record in history
  await recordRoomMemberHistory({
    roomId: params.roomId,
    userId: params.userId,
    displayName: params.userName,
    action: 'banned',
  })

  return ban
}

/**
 * Unban a user from a room
 */
export async function unbanUserFromRoom(roomId: string, userId: string) {
  await db.delete(roomBans).where(and(eq(roomBans.roomId, roomId), eq(roomBans.userId, userId)))
}

/**
 * Kick a user from a room (remove without banning)
 */
export async function kickUserFromRoom(roomId: string, userId: string) {
  // Get member info before deleting
  const member = await db
    .select()
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
    .limit(1)

  await db
    .delete(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))

  // Record in history
  if (member.length > 0) {
    await recordRoomMemberHistory({
      roomId,
      userId,
      displayName: member[0].displayName,
      action: 'kicked',
    })
  }
}

/**
 * Submit a report
 */
export async function createReport(params: {
  roomId: string
  reporterId: string
  reporterName: string
  reportedUserId: string
  reportedUserName: string
  reason: 'harassment' | 'cheating' | 'inappropriate-name' | 'spam' | 'afk' | 'other'
  details?: string
}) {
  const [report] = await db
    .insert(roomReports)
    .values({
      roomId: params.roomId,
      reporterId: params.reporterId,
      reporterName: params.reporterName,
      reportedUserId: params.reportedUserId,
      reportedUserName: params.reportedUserName,
      reason: params.reason,
      details: params.details,
      status: 'pending',
    })
    .returning()

  return report
}

/**
 * Get pending reports for a room
 */
export async function getPendingReports(roomId: string) {
  return db
    .select()
    .from(roomReports)
    .where(and(eq(roomReports.roomId, roomId), eq(roomReports.status, 'pending')))
    .orderBy(desc(roomReports.createdAt))
}

/**
 * Get all reports for a room
 */
export async function getAllReports(roomId: string) {
  return db
    .select()
    .from(roomReports)
    .where(eq(roomReports.roomId, roomId))
    .orderBy(desc(roomReports.createdAt))
}

/**
 * Mark report as reviewed
 */
export async function markReportReviewed(reportId: string, reviewedBy: string) {
  await db
    .update(roomReports)
    .set({
      status: 'reviewed',
      reviewedAt: new Date(),
      reviewedBy,
    })
    .where(eq(roomReports.id, reportId))
}

/**
 * Dismiss a report
 */
export async function dismissReport(reportId: string, reviewedBy: string) {
  await db
    .update(roomReports)
    .set({
      status: 'dismissed',
      reviewedAt: new Date(),
      reviewedBy,
    })
    .where(eq(roomReports.id, reportId))
}
