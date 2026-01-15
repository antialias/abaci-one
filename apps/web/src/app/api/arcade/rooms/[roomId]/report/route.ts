import { type NextRequest, NextResponse } from "next/server";
import { createReport } from "@/lib/arcade/room-moderation";
import { getRoomMembers } from "@/lib/arcade/room-membership";
import { getViewerId } from "@/lib/viewer";
import { getSocketIO } from "@/lib/socket-io";

type RouteContext = {
  params: Promise<{ roomId: string }>;
};

/**
 * POST /api/arcade/rooms/:roomId/report
 * Submit a report about another player
 * Body:
 *   - reportedUserId: string
 *   - reason: string (enum)
 *   - details?: string (optional)
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { roomId } = await context.params;
    const viewerId = await getViewerId();
    const body = await req.json();

    // Validate required fields
    if (!body.reportedUserId || !body.reason) {
      return NextResponse.json(
        { error: "Missing required fields: reportedUserId, reason" },
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

    // Can't report yourself
    if (body.reportedUserId === viewerId) {
      return NextResponse.json(
        { error: "Cannot report yourself" },
        { status: 400 },
      );
    }

    // Get room members to verify both users are in the room and get names
    const members = await getRoomMembers(roomId);
    const reporter = members.find((m) => m.userId === viewerId);
    const reported = members.find((m) => m.userId === body.reportedUserId);

    if (!reporter) {
      return NextResponse.json(
        { error: "You are not in this room" },
        { status: 403 },
      );
    }

    if (!reported) {
      return NextResponse.json(
        { error: "Reported user is not in this room" },
        { status: 404 },
      );
    }

    // Create report
    const report = await createReport({
      roomId,
      reporterId: viewerId,
      reporterName: reporter.displayName,
      reportedUserId: body.reportedUserId,
      reportedUserName: reported.displayName,
      reason: body.reason,
      details: body.details,
    });

    // Notify host via socket (find the host)
    const host = members.find((m) => m.isCreator);
    if (host) {
      const io = await getSocketIO();
      if (io) {
        try {
          // Send notification only to the host
          io.to(`user:${host.userId}`).emit("report-submitted", {
            roomId,
            report: {
              id: report.id,
              reporterName: report.reporterName,
              reportedUserName: report.reportedUserName,
              reportedUserId: report.reportedUserId,
              reason: report.reason,
              createdAt: report.createdAt,
            },
          });
        } catch (socketError) {
          console.error("[Report API] Failed to notify host:", socketError);
        }
      }
    }

    return NextResponse.json({ success: true, report }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to submit report:", error);
    return NextResponse.json(
      { error: "Failed to submit report" },
      { status: 500 },
    );
  }
}
