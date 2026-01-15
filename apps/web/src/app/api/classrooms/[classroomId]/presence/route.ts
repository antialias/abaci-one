import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import {
  enterClassroom,
  getClassroomPresence,
  getTeacherClassroom,
  isParent,
} from "@/lib/classroom";
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
 * GET /api/classrooms/[classroomId]/presence
 * Get all students currently present in classroom (teacher only)
 *
 * Returns: { students: Player[] }
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

    const presences = await getClassroomPresence(classroomId);

    // Return players with presence info
    return NextResponse.json({
      students: presences.map((p) => ({
        ...p.player,
        enteredAt: p.enteredAt,
        enteredBy: p.enteredBy,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch classroom presence:", error);
    return NextResponse.json(
      { error: "Failed to fetch classroom presence" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/classrooms/[classroomId]/presence
 * Enter student into classroom (teacher or parent)
 *
 * Body: { playerId: string }
 * Returns: { success: true, presence } or { success: false, error }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { classroomId } = await params;
    const viewerId = await getViewerId();
    const user = await getOrCreateUser(viewerId);
    const body = await req.json();

    if (!body.playerId) {
      return NextResponse.json(
        { success: false, error: "Missing playerId" },
        { status: 400 },
      );
    }

    // Check authorization: must be teacher of classroom OR parent of student
    const classroom = await getTeacherClassroom(user.id);
    const isTeacher = classroom?.id === classroomId;
    const parentCheck = await isParent(user.id, body.playerId);

    if (!isTeacher && !parentCheck) {
      return NextResponse.json(
        {
          success: false,
          error: "Must be the classroom teacher or a parent of the student",
        },
        { status: 403 },
      );
    }

    const result = await enterClassroom({
      playerId: body.playerId,
      classroomId,
      enteredBy: user.id,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, presence: result.presence });
  } catch (error) {
    console.error("Failed to enter classroom:", error);
    return NextResponse.json(
      { success: false, error: "Failed to enter classroom" },
      { status: 500 },
    );
  }
}
