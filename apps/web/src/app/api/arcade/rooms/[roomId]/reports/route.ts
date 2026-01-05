import { type NextRequest, NextResponse } from "next/server";
import { getAllReports } from "@/lib/arcade/room-moderation";
import { getRoomMembers } from "@/lib/arcade/room-membership";
import { getViewerId } from "@/lib/viewer";

type RouteContext = {
  params: Promise<{ roomId: string }>;
};

/**
 * GET /api/arcade/rooms/:roomId/reports
 * Get all reports for a room (host only)
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
        { error: "Only the host can view reports" },
        { status: 403 },
      );
    }

    // Get all reports
    const reports = await getAllReports(roomId);

    return NextResponse.json({ reports }, { status: 200 });
  } catch (error: any) {
    console.error("Failed to get reports:", error);
    return NextResponse.json(
      { error: "Failed to get reports" },
      { status: 500 },
    );
  }
}
