import { type NextRequest, NextResponse } from "next/server";
import { createRoom, listActiveRooms } from "@/lib/arcade/room-manager";
import {
  addRoomMember,
  getRoomMembers,
  isMember,
} from "@/lib/arcade/room-membership";
import { getRoomActivePlayers } from "@/lib/arcade/player-manager";
import { getSocketIO } from "@/lib/socket-io";
import { getViewerId } from "@/lib/viewer";
import { hasValidator, type GameName } from "@/lib/arcade/validators";

/**
 * GET /api/arcade/rooms
 * List all active public rooms (lobby view)
 * Query params:
 *   - gameName?: string - Filter by game
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const gameName = searchParams.get("gameName") as GameName | null;

    const viewerId = await getViewerId();
    const rooms = await listActiveRooms(gameName || undefined);

    // Enrich with member counts, player counts, and membership status
    const roomsWithCounts = await Promise.all(
      rooms.map(async (room) => {
        const members = await getRoomMembers(room.id);
        const playerMap = await getRoomActivePlayers(room.id);
        const userIsMember = await isMember(room.id, viewerId);

        let totalPlayers = 0;
        for (const players of playerMap.values()) {
          totalPlayers += players.length;
        }

        return {
          id: room.id,
          name: room.name,
          code: room.code,
          gameName: room.gameName,
          status: room.status,
          createdAt: room.createdAt,
          creatorName: room.creatorName,
          accessMode: room.accessMode,
          memberCount: members.length,
          playerCount: totalPlayers,
          isMember: userIsMember,
        };
      }),
    );

    return NextResponse.json({ rooms: roomsWithCounts });
  } catch (error) {
    console.error("Failed to fetch rooms:", error);
    return NextResponse.json(
      { error: "Failed to fetch rooms" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/arcade/rooms
 * Create a new room
 * Body:
 *   - name: string
 *   - gameName: string
 *   - gameConfig?: object
 *   - ttlMinutes?: number
 *   - accessMode?: 'open' | 'password' | 'approval-only' | 'restricted' | 'locked' | 'retired'
 *   - password?: string
 */
export async function POST(req: NextRequest) {
  try {
    const viewerId = await getViewerId();
    const body = await req.json();

    // Validate game name if provided (gameName is now optional)
    if (body.gameName) {
      if (!hasValidator(body.gameName)) {
        return NextResponse.json(
          { error: "Invalid game name" },
          { status: 400 },
        );
      }
    }

    // Validate name length (if provided)
    if (body.name && body.name.length > 50) {
      return NextResponse.json(
        { error: "Room name too long (max 50 characters)" },
        { status: 400 },
      );
    }

    // Normalize empty name to null
    const roomName = body.name?.trim() || null;

    // Validate access mode
    if (body.accessMode) {
      const validAccessModes = [
        "open",
        "password",
        "approval-only",
        "restricted",
        "locked",
        "retired",
      ];
      if (!validAccessModes.includes(body.accessMode)) {
        return NextResponse.json(
          { error: "Invalid access mode" },
          { status: 400 },
        );
      }
    }

    // Validate password if provided
    if (body.accessMode === "password" && !body.password) {
      return NextResponse.json(
        { error: "Password is required for password-protected rooms" },
        { status: 400 },
      );
    }

    // Get display name from body or generate from viewerId
    const displayName = body.creatorName || `Guest ${viewerId.slice(-4)}`;

    // Create room
    const room = await createRoom({
      name: roomName,
      createdBy: viewerId,
      creatorName: displayName,
      gameName: body.gameName || null,
      gameConfig: body.gameConfig || null,
      ttlMinutes: body.ttlMinutes,
      accessMode: body.accessMode,
      password: body.password,
    });

    // Add creator as first member (with auto-leave from other rooms)
    const { autoLeaveResult } = await addRoomMember({
      roomId: room.id,
      userId: viewerId,
      displayName,
      isCreator: true,
    });

    // Broadcast member-left events to any rooms the user was auto-left from
    if (autoLeaveResult && autoLeaveResult.leftRooms.length > 0) {
      const io = await getSocketIO();
      if (io) {
        for (const leftRoomId of autoLeaveResult.leftRooms) {
          try {
            // Get current members/players of the room the user left
            const leftRoomMembers = await getRoomMembers(leftRoomId);
            const leftRoomPlayers = await getRoomActivePlayers(leftRoomId);

            // Convert to object for JSON serialization
            const leftRoomPlayersObj: Record<string, any[]> = {};
            for (const [uid, players] of leftRoomPlayers.entries()) {
              leftRoomPlayersObj[uid] = players;
            }

            // Broadcast to all remaining users in the old room
            io.to(`room:${leftRoomId}`).emit("member-left", {
              roomId: leftRoomId,
              userId: viewerId,
              members: leftRoomMembers,
              memberPlayers: leftRoomPlayersObj,
              reason: "auto-left", // Indicate this was automatic, not voluntary
            });

            console.log(
              `[Room Create] Broadcasted member-left for user ${viewerId} in room ${leftRoomId} (auto-leave)`,
            );
          } catch (socketError) {
            console.error(
              `[Room Create] Failed to broadcast member-left for room ${leftRoomId}:`,
              socketError,
            );
          }
        }
      }
    }

    // Get members and active players for the response
    const members = await getRoomMembers(room.id);
    const memberPlayers = await getRoomActivePlayers(room.id);

    // Convert Map to object for JSON serialization
    const memberPlayersObj: Record<string, any[]> = {};
    for (const [uid, players] of memberPlayers.entries()) {
      memberPlayersObj[uid] = players;
    }

    // Generate join URL
    const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
    const joinUrl = `${baseUrl}/arcade/rooms/${room.id}`;

    return NextResponse.json(
      {
        room,
        members,
        memberPlayers: memberPlayersObj,
        joinUrl,
        autoLeave: autoLeaveResult
          ? {
              roomIds: autoLeaveResult.leftRooms,
              message: `You were automatically removed from ${autoLeaveResult.leftRooms.length} other room(s)`,
            }
          : undefined,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create room:", error);
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 },
    );
  }
}
