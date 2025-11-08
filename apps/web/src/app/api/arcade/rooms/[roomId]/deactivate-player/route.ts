import { type NextRequest, NextResponse } from "next/server";
import { getRoomMembers } from "@/lib/arcade/room-membership";
import {
  getPlayer,
  getRoomActivePlayers,
  setPlayerActiveStatus,
} from "@/lib/arcade/player-manager";
import { getViewerId } from "@/lib/viewer";
import { getSocketIO } from "@/lib/socket-io";

type RouteContext = {
  params: Promise<{ roomId: string }>;
};

/**
 * POST /api/arcade/rooms/:roomId/deactivate-player
 * Deactivate a specific player in the room (host only)
 * Body:
 *   - playerId: string - The player to deactivate
 */
export async function POST(req: NextRequest, context: RouteContext) {
  console.log("[Deactivate Player API] POST request received");

  try {
    const { roomId } = await context.params;
    console.log("[Deactivate Player API] roomId:", roomId);

    const viewerId = await getViewerId();
    console.log("[Deactivate Player API] viewerId:", viewerId);

    const body = await req.json();
    console.log("[Deactivate Player API] body:", body);

    // Validate required fields
    if (!body.playerId) {
      console.log("[Deactivate Player API] Missing playerId in body");
      return NextResponse.json(
        { error: "Missing required field: playerId" },
        { status: 400 },
      );
    }

    // Check if user is the host
    console.log(
      "[Deactivate Player API] Fetching room members for roomId:",
      roomId,
    );
    const members = await getRoomMembers(roomId);
    console.log("[Deactivate Player API] members count:", members.length);

    const currentMember = members.find((m) => m.userId === viewerId);
    console.log("[Deactivate Player API] currentMember:", currentMember);

    if (!currentMember) {
      return NextResponse.json(
        { error: "You are not in this room" },
        { status: 403 },
      );
    }

    if (!currentMember.isCreator) {
      return NextResponse.json(
        { error: "Only the host can deactivate players" },
        { status: 403 },
      );
    }

    // Get the player
    console.log(
      "[Deactivate Player API] Looking up player with ID:",
      body.playerId,
    );
    const player = await getPlayer(body.playerId);
    console.log("[Deactivate Player API] Player found:", player);

    if (!player) {
      console.log("[Deactivate Player API] Player not found in database");
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    console.log("[Deactivate Player API] Player userId:", player.userId);
    console.log(
      "[Deactivate Player API] Room member userIds:",
      members.map((m) => m.userId),
    );

    // Can't deactivate your own players (use the regular player controls for that)
    if (player.userId === viewerId) {
      console.log(
        "[Deactivate Player API] ERROR: Cannot deactivate your own players",
      );
      return NextResponse.json(
        {
          error:
            "Cannot deactivate your own players. Use the player controls in the nav.",
        },
        { status: 400 },
      );
    }

    // Note: We don't check if the player belongs to a current room member
    // because players from users who have left the room may still need to be cleaned up
    console.log(
      "[Deactivate Player API] Player validation passed, proceeding with deactivation",
    );

    // Deactivate the player
    await setPlayerActiveStatus(body.playerId, false);

    // Broadcast updates via socket
    const io = await getSocketIO();
    if (io) {
      try {
        // Get updated player list
        const memberPlayers = await getRoomActivePlayers(roomId);

        // Convert memberPlayers Map to object for JSON serialization
        const memberPlayersObj: Record<string, any[]> = {};
        for (const [uid, players] of memberPlayers.entries()) {
          memberPlayersObj[uid] = players;
        }

        // Notify everyone in the room about the player update
        io.to(`room:${roomId}`).emit("player-deactivated", {
          roomId,
          playerId: body.playerId,
          playerName: player.name,
          deactivatedBy: currentMember.displayName,
          memberPlayers: memberPlayersObj,
        });

        console.log(
          `[Deactivate Player API] Player ${body.playerId} (${player.name}) deactivated by host in room ${roomId}`,
        );
      } catch (socketError) {
        console.error(
          "[Deactivate Player API] Failed to broadcast deactivation:",
          socketError,
        );
      }
    }

    console.log("[Deactivate Player API] Success - returning 200");
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("[Deactivate Player API] ERROR:", error);
    console.error("[Deactivate Player API] Error stack:", error.stack);
    return NextResponse.json(
      { error: "Failed to deactivate player" },
      { status: 500 },
    );
  }
}
