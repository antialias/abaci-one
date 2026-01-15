import { type NextRequest, NextResponse } from "next/server";
import { getRoomById } from "@/lib/arcade/room-manager";
import {
  getRoomMembers,
  isMember,
  removeMember,
} from "@/lib/arcade/room-membership";
import { getRoomActivePlayers } from "@/lib/arcade/player-manager";
import { getViewerId } from "@/lib/viewer";
import { getSocketIO } from "@/lib/socket-io";

type RouteContext = {
  params: Promise<{ roomId: string }>;
};

/**
 * POST /api/arcade/rooms/:roomId/leave
 * Leave a room
 */
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params;
    const viewerId = await getViewerId();

    // Get room
    const room = await getRoomById(roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Check if member - if not, return success (idempotent: already left)
    const isMemberOfRoom = await isMember(roomId, viewerId);
    if (!isMemberOfRoom) {
      // Already not a member - return success since desired state is achieved
      // This handles the case where user was auto-left from creating/joining another room
      return NextResponse.json({ success: true, alreadyLeft: true });
    }

    // Remove member
    await removeMember(roomId, viewerId);

    // Broadcast to all remaining users in the room via socket
    const io = await getSocketIO();
    if (io) {
      try {
        const members = await getRoomMembers(roomId);
        const memberPlayers = await getRoomActivePlayers(roomId);

        // Convert memberPlayers Map to object for JSON serialization
        const memberPlayersObj: Record<string, any[]> = {};
        for (const [uid, players] of memberPlayers.entries()) {
          memberPlayersObj[uid] = players;
        }

        // Broadcast to all users in this room
        io.to(`room:${roomId}`).emit("member-left", {
          roomId,
          userId: viewerId,
          members,
          memberPlayers: memberPlayersObj,
        });

        console.log(
          `[Leave API] Broadcasted member-left for user ${viewerId} in room ${roomId}`,
        );
      } catch (socketError) {
        // Log but don't fail the request if socket broadcast fails
        console.error(
          "[Leave API] Failed to broadcast member-left:",
          socketError,
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to leave room:", error);
    return NextResponse.json(
      { error: "Failed to leave room" },
      { status: 500 },
    );
  }
}
