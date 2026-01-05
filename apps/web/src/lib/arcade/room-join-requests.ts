/**
 * Room Join Requests Manager
 * Handles join request logic for approval-only rooms
 */

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";

export interface CreateJoinRequestParams {
  roomId: string;
  userId: string;
  userName: string;
}

/**
 * Create a join request
 */
export async function createJoinRequest(
  params: CreateJoinRequestParams,
): Promise<schema.RoomJoinRequest> {
  const now = new Date();

  // Check if there's an existing request
  const existing = await db
    .select()
    .from(schema.roomJoinRequests)
    .where(
      and(
        eq(schema.roomJoinRequests.roomId, params.roomId),
        eq(schema.roomJoinRequests.userId, params.userId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing request (reset to pending)
    const [updated] = await db
      .update(schema.roomJoinRequests)
      .set({
        userName: params.userName,
        status: "pending",
        requestedAt: now,
        reviewedAt: null,
        reviewedBy: null,
        reviewedByName: null,
      })
      .where(eq(schema.roomJoinRequests.id, existing[0].id))
      .returning();

    return updated;
  }

  // Create new request
  const [request] = await db
    .insert(schema.roomJoinRequests)
    .values({
      roomId: params.roomId,
      userId: params.userId,
      userName: params.userName,
      status: "pending",
      requestedAt: now,
    })
    .returning();

  return request;
}

/**
 * Get all pending join requests for a room
 */
export async function getPendingJoinRequests(
  roomId: string,
): Promise<schema.RoomJoinRequest[]> {
  return await db
    .select()
    .from(schema.roomJoinRequests)
    .where(
      and(
        eq(schema.roomJoinRequests.roomId, roomId),
        eq(schema.roomJoinRequests.status, "pending"),
      ),
    )
    .orderBy(schema.roomJoinRequests.requestedAt);
}

/**
 * Get all join requests for a room (any status)
 */
export async function getAllJoinRequests(
  roomId: string,
): Promise<schema.RoomJoinRequest[]> {
  return await db
    .select()
    .from(schema.roomJoinRequests)
    .where(eq(schema.roomJoinRequests.roomId, roomId))
    .orderBy(schema.roomJoinRequests.requestedAt);
}

/**
 * Approve a join request
 */
export async function approveJoinRequest(
  requestId: string,
  reviewedBy: string,
  reviewedByName: string,
): Promise<schema.RoomJoinRequest> {
  const [request] = await db
    .update(schema.roomJoinRequests)
    .set({
      status: "approved",
      reviewedAt: new Date(),
      reviewedBy,
      reviewedByName,
    })
    .where(eq(schema.roomJoinRequests.id, requestId))
    .returning();

  return request;
}

/**
 * Deny a join request
 */
export async function denyJoinRequest(
  requestId: string,
  reviewedBy: string,
  reviewedByName: string,
): Promise<schema.RoomJoinRequest> {
  const [request] = await db
    .update(schema.roomJoinRequests)
    .set({
      status: "denied",
      reviewedAt: new Date(),
      reviewedBy,
      reviewedByName,
    })
    .where(eq(schema.roomJoinRequests.id, requestId))
    .returning();

  return request;
}

/**
 * Get a specific join request
 */
export async function getJoinRequest(
  roomId: string,
  userId: string,
): Promise<schema.RoomJoinRequest | undefined> {
  const results = await db
    .select()
    .from(schema.roomJoinRequests)
    .where(
      and(
        eq(schema.roomJoinRequests.roomId, roomId),
        eq(schema.roomJoinRequests.userId, userId),
      ),
    )
    .limit(1);

  return results[0];
}
