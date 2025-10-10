import { type NextRequest, NextResponse } from "next/server";
import {
  deleteRoom,
  getRoomById,
  isRoomCreator,
  touchRoom,
  updateRoom,
} from "@/lib/arcade/room-manager";
import { getRoomMembers } from "@/lib/arcade/room-membership";
import { getActivePlayers } from "@/lib/arcade/player-manager";
import { getViewerId } from "@/lib/viewer";

type RouteContext = {
  params: Promise<{ roomId: string }>;
};

/**
 * GET /api/arcade/rooms/:roomId
 * Get room details including members
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params;
    const viewerId = await getViewerId();

    const room = await getRoomById(roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const members = await getRoomMembers(roomId);
    const canModerate = await isRoomCreator(roomId, viewerId);

    // Fetch active players for each member
    // This creates a map of userId -> Player[]
    const memberPlayers: Record<string, any[]> = {};
    for (const member of members) {
      const activePlayers = await getActivePlayers(member.userId);
      memberPlayers[member.userId] = activePlayers;
    }

    // Update room activity when viewing (keeps active rooms fresh)
    await touchRoom(roomId);

    return NextResponse.json({
      room,
      members,
      memberPlayers, // Map of userId -> active Player[] for each member
      canModerate,
    });
  } catch (error) {
    console.error("Failed to fetch room:", error);
    return NextResponse.json(
      { error: "Failed to fetch room" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/arcade/rooms/:roomId
 * Update room (creator only)
 * Body:
 *   - name?: string
 *   - isLocked?: boolean
 *   - status?: 'lobby' | 'playing' | 'finished'
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params;
    const viewerId = await getViewerId();
    const body = await req.json();

    // Check if user is room creator
    const isCreator = await isRoomCreator(roomId, viewerId);
    if (!isCreator) {
      return NextResponse.json(
        { error: "Only room creator can update room" },
        { status: 403 },
      );
    }

    // Validate name length if provided
    if (body.name && body.name.length > 50) {
      return NextResponse.json(
        { error: "Room name too long (max 50 characters)" },
        { status: 400 },
      );
    }

    // Validate status if provided
    if (
      body.status &&
      !["lobby", "playing", "finished"].includes(body.status)
    ) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updates: {
      name?: string;
      isLocked?: boolean;
      status?: "lobby" | "playing" | "finished";
    } = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.isLocked !== undefined) updates.isLocked = body.isLocked;
    if (body.status !== undefined) updates.status = body.status;

    const room = await updateRoom(roomId, updates);

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    console.error("Failed to update room:", error);
    return NextResponse.json(
      { error: "Failed to update room" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/arcade/rooms/:roomId
 * Delete room (creator only)
 */
export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params;
    const viewerId = await getViewerId();

    // Check if user is room creator
    const isCreator = await isRoomCreator(roomId, viewerId);
    if (!isCreator) {
      return NextResponse.json(
        { error: "Only room creator can delete room" },
        { status: 403 },
      );
    }

    await deleteRoom(roomId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete room:", error);
    return NextResponse.json(
      { error: "Failed to delete room" },
      { status: 500 },
    );
  }
}
