import { type NextRequest, NextResponse } from "next/server";
import {
  banUserFromRoom,
  getRoomBans,
  unbanUserFromRoom,
} from "@/lib/arcade/room-moderation";
import { getRoomMembers } from "@/lib/arcade/room-membership";
import { getRoomActivePlayers } from "@/lib/arcade/player-manager";
import { getUserRoomHistory } from "@/lib/arcade/room-member-history";
import { createInvitation } from "@/lib/arcade/room-invitations";
import { getViewerId } from "@/lib/viewer";
import { getSocketIO } from "@/lib/socket-io";

type RouteContext = {
  params: Promise<{ roomId: string }>;
};

/**
 * POST /api/arcade/rooms/:roomId/ban
 * Ban a user from the room (host only)
 * Body:
 *   - userId: string
 *   - reason: string (enum)
 *   - notes?: string (optional)
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params;
    const viewerId = await getViewerId();
    const body = await req.json();

    // Validate required fields
    if (!body.userId || !body.reason) {
      return NextResponse.json(
        { error: "Missing required fields: userId, reason" },
        { status: 400 },
      );
    }

    // Validate reason
    const validReasons = [
      "harassment",
      "cheating",
      "inappropriate-name",
      "spam",
      "afk",
      "other",
    ];
    if (!validReasons.includes(body.reason)) {
      return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
    }

    // Check if user is the host
    const members = await getRoomMembers(roomId);
    const currentMember = members.find((m) => m.userId === viewerId);

    if (!currentMember) {
      return NextResponse.json(
        { error: "You are not in this room" },
        { status: 403 },
      );
    }

    if (!currentMember.isCreator) {
      return NextResponse.json(
        { error: "Only the host can ban users" },
        { status: 403 },
      );
    }

    // Can't ban yourself
    if (body.userId === viewerId) {
      return NextResponse.json(
        { error: "Cannot ban yourself" },
        { status: 400 },
      );
    }

    // Get the user to ban (they might not be in the room anymore)
    const targetUser = members.find((m) => m.userId === body.userId);
    const userName = targetUser?.displayName || body.userId.slice(-4);

    // Ban the user
    await banUserFromRoom({
      roomId,
      userId: body.userId,
      userName,
      bannedBy: viewerId,
      bannedByName: currentMember.displayName,
      reason: body.reason,
      notes: body.notes,
    });

    // Broadcast updates via socket
    const io = await getSocketIO();
    if (io) {
      try {
        // Get updated member list
        const updatedMembers = await getRoomMembers(roomId);
        const memberPlayers = await getRoomActivePlayers(roomId);

        // Convert memberPlayers Map to object for JSON serialization
        const memberPlayersObj: Record<string, any[]> = {};
        for (const [uid, players] of memberPlayers.entries()) {
          memberPlayersObj[uid] = players;
        }

        // Tell the banned user they've been removed
        io.to(`user:${body.userId}`).emit("banned-from-room", {
          roomId,
          bannedBy: currentMember.displayName,
          reason: body.reason,
        });

        // Notify everyone else in the room
        io.to(`room:${roomId}`).emit("member-left", {
          roomId,
          userId: body.userId,
          members: updatedMembers,
          memberPlayers: memberPlayersObj,
          reason: "banned",
        });

        console.log(`[Ban API] User ${body.userId} banned from room ${roomId}`);
      } catch (socketError) {
        console.error("[Ban API] Failed to broadcast ban:", socketError);
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Failed to ban user:", error);
    return NextResponse.json({ error: "Failed to ban user" }, { status: 500 });
  }
}

/**
 * DELETE /api/arcade/rooms/:roomId/ban
 * Unban a user from the room (host only)
 * Body:
 *   - userId: string
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params;
    const viewerId = await getViewerId();
    const body = await req.json();

    // Validate required fields
    if (!body.userId) {
      return NextResponse.json(
        { error: "Missing required field: userId" },
        { status: 400 },
      );
    }

    // Check if user is the host
    const members = await getRoomMembers(roomId);
    const currentMember = members.find((m) => m.userId === viewerId);

    if (!currentMember) {
      return NextResponse.json(
        { error: "You are not in this room" },
        { status: 403 },
      );
    }

    if (!currentMember.isCreator) {
      return NextResponse.json(
        { error: "Only the host can unban users" },
        { status: 403 },
      );
    }

    // Unban the user
    await unbanUserFromRoom(roomId, body.userId);

    // Auto-invite the unbanned user back to the room
    const history = await getUserRoomHistory(roomId, body.userId);
    if (history) {
      const invitation = await createInvitation({
        roomId,
        userId: body.userId,
        userName: history.displayName,
        invitedBy: viewerId,
        invitedByName: currentMember.displayName,
        invitationType: "auto-unban",
        message: "You have been unbanned and are welcome to rejoin.",
      });

      // Broadcast invitation via socket
      const io = await getSocketIO();
      if (io) {
        try {
          io.to(`user:${body.userId}`).emit("room-invitation-received", {
            invitation: {
              id: invitation.id,
              roomId: invitation.roomId,
              invitedBy: invitation.invitedBy,
              invitedByName: invitation.invitedByName,
              message: invitation.message,
              createdAt: invitation.createdAt,
              invitationType: "auto-unban",
            },
          });

          console.log(
            `[Unban API] Auto-invited user ${body.userId} after unban from room ${roomId}`,
          );
        } catch (socketError) {
          console.error(
            "[Unban API] Failed to broadcast invitation:",
            socketError,
          );
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Failed to unban user:", error);
    return NextResponse.json(
      { error: "Failed to unban user" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/arcade/rooms/:roomId/ban
 * Get all bans for a room (host only)
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params;
    const viewerId = await getViewerId();

    // Check if user is the host
    const members = await getRoomMembers(roomId);
    const currentMember = members.find((m) => m.userId === viewerId);

    if (!currentMember) {
      return NextResponse.json(
        { error: "You are not in this room" },
        { status: 403 },
      );
    }

    if (!currentMember.isCreator) {
      return NextResponse.json(
        { error: "Only the host can view bans" },
        { status: 403 },
      );
    }

    // Get all bans
    const bans = await getRoomBans(roomId);

    return NextResponse.json({ bans }, { status: 200 });
  } catch (error: any) {
    console.error("Failed to get bans:", error);
    return NextResponse.json({ error: "Failed to get bans" }, { status: 500 });
  }
}
