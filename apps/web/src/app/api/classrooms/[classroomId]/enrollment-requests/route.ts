import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import {
  createEnrollmentRequest,
  getLinkedParentIds,
  getPendingRequestsForClassroom,
  getRequestsAwaitingParentApproval,
  getTeacherClassroom,
  isParent,
} from "@/lib/classroom";
import { getSocketIO } from "@/lib/socket-io";
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
  params: Promise<{ classroomId: string }>;
}

/**
 * GET /api/classrooms/[classroomId]/enrollment-requests
 * Get pending enrollment requests (teacher only)
 *
 * Returns:
 * - requests: Requests needing teacher approval (parent-initiated)
 * - awaitingParentApproval: Requests needing parent approval (teacher-initiated)
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { classroomId } = await params;
    const viewerId = await getViewerId();
    const user = await getOrCreateUser(viewerId);

    // Verify user is the teacher of this classroom
    const classroom = await getTeacherClassroom(user.id);
    if (!classroom || classroom.id !== classroomId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Fetch both types of pending requests in parallel
    const [requests, awaitingParentApproval] = await Promise.all([
      getPendingRequestsForClassroom(classroomId),
      getRequestsAwaitingParentApproval(classroomId),
    ]);

    return NextResponse.json({ requests, awaitingParentApproval });
  } catch (error) {
    console.error("Failed to fetch enrollment requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch enrollment requests" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/classrooms/[classroomId]/enrollment-requests
 * Create enrollment request (parent or teacher)
 *
 * Body: { playerId: string }
 * Returns: { request }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { classroomId } = await params;
    const viewerId = await getViewerId();
    const user = await getOrCreateUser(viewerId);
    const body = await req.json();

    if (!body.playerId) {
      return NextResponse.json({ error: "Missing playerId" }, { status: 400 });
    }

    // Determine role: is user the teacher or a parent?
    const classroom = await getTeacherClassroom(user.id);
    const isTeacher = classroom?.id === classroomId;
    const parentCheck = await isParent(user.id, body.playerId);

    if (!isTeacher && !parentCheck) {
      return NextResponse.json(
        { error: "Must be the classroom teacher or a parent of the student" },
        { status: 403 },
      );
    }

    const requestedByRole = isTeacher ? "teacher" : "parent";

    const request = await createEnrollmentRequest({
      classroomId,
      playerId: body.playerId,
      requestedBy: user.id,
      requestedByRole,
    });

    // Get classroom and player info for the socket event
    const [classroomInfo] = await db
      .select({ name: schema.classrooms.name })
      .from(schema.classrooms)
      .where(eq(schema.classrooms.id, classroomId))
      .limit(1);

    const [playerInfo] = await db
      .select({ name: schema.players.name })
      .from(schema.players)
      .where(eq(schema.players.id, body.playerId))
      .limit(1);

    // Emit socket event to the classroom channel for real-time updates
    const io = await getSocketIO();
    if (io && classroomInfo && playerInfo) {
      try {
        const eventData = {
          request: {
            id: request.id,
            classroomId,
            classroomName: classroomInfo.name,
            playerId: body.playerId,
            playerName: playerInfo.name,
            requestedByRole,
          },
        };

        // Emit to classroom channel (for teacher's view)
        io.to(`classroom:${classroomId}`).emit(
          "enrollment-request-created",
          eventData,
        );
        console.log(
          `[Enrollment Request API] Emitted enrollment-request-created for classroom ${classroomId}`,
        );

        // If teacher-initiated, also emit to parent's user channel
        // so they see the new pending approval in real-time
        if (requestedByRole === "teacher") {
          const parentIds = await getLinkedParentIds(body.playerId);
          for (const parentId of parentIds) {
            io.to(`user:${parentId}`).emit(
              "enrollment-request-created",
              eventData,
            );
            console.log(
              `[Enrollment Request API] Notified parent ${parentId} of new request`,
            );
          }
        }
      } catch (socketError) {
        console.error(
          "[Enrollment Request API] Failed to broadcast request:",
          socketError,
        );
      }
    }

    return NextResponse.json({ request }, { status: 201 });
  } catch (error) {
    console.error("Failed to create enrollment request:", error);
    return NextResponse.json(
      { error: "Failed to create enrollment request" },
      { status: 500 },
    );
  }
}
