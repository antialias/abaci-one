import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { enrollmentRequests } from "@/db/schema";
import { denyEnrollmentRequest, isParent } from "@/lib/classroom";
import { emitEnrollmentRequestDenied } from "@/lib/classroom/socket-emitter";
import { getViewerId } from "@/lib/viewer";

/**
 * Get or create user record for a viewerId (guestId)
 */
async function getOrCreateUser(viewerId: string) {
  let user = await db.query.users.findFirst({
    where: eq(schema.users.guestId, viewerId),
  });

  if (!user) {
    const [newUser] = await db
      .insert(schema.users)
      .values({ guestId: viewerId })
      .returning();
    user = newUser;
  }

  return user;
}

interface RouteParams {
  params: Promise<{ requestId: string }>;
}

/**
 * POST /api/enrollment-requests/[requestId]/deny
 * Parent denies enrollment request
 *
 * Returns: { request }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { requestId } = await params;
    const viewerId = await getViewerId();
    const user = await getOrCreateUser(viewerId);

    // Get the request to verify parent owns the child
    const request = await db.query.enrollmentRequests.findFirst({
      where: eq(enrollmentRequests.id, requestId),
    });

    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Verify user is a parent of the child in the request
    const parentCheck = await isParent(user.id, request.playerId);
    if (!parentCheck) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const updatedRequest = await denyEnrollmentRequest(
      requestId,
      user.id,
      "parent",
    );

    // Emit socket event for real-time updates (notify teacher via classroom channel)
    try {
      // Get classroom and player info for socket event
      const [classroomInfo] = await db
        .select({ name: schema.classrooms.name })
        .from(schema.classrooms)
        .where(eq(schema.classrooms.id, request.classroomId))
        .limit(1);

      const [playerInfo] = await db
        .select({ name: schema.players.name })
        .from(schema.players)
        .where(eq(schema.players.id, request.playerId))
        .limit(1);

      if (classroomInfo && playerInfo) {
        await emitEnrollmentRequestDenied(
          {
            requestId,
            classroomId: request.classroomId,
            classroomName: classroomInfo.name,
            playerId: request.playerId,
            playerName: playerInfo.name,
            deniedBy: "parent",
          },
          { classroomId: request.classroomId }, // Teacher sees the update via classroom channel
        );
      }
    } catch (socketError) {
      console.error("[Parent Deny] Failed to emit socket event:", socketError);
    }

    return NextResponse.json({ request: updatedRequest });
  } catch (error) {
    console.error("Failed to deny enrollment request:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to deny enrollment request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
