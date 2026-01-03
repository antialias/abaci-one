import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import {
  deleteClassroom,
  getClassroom,
  updateClassroom,
  regenerateClassroomCode,
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
 * GET /api/classrooms/[classroomId]
 * Get classroom by ID
 *
 * Returns: { classroom } or 404
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { classroomId } = await params;

    const classroom = await getClassroom(classroomId);

    if (!classroom) {
      return NextResponse.json(
        { error: "Classroom not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ classroom });
  } catch (error) {
    console.error("Failed to fetch classroom:", error);
    return NextResponse.json(
      { error: "Failed to fetch classroom" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/classrooms/[classroomId]
 * Update classroom settings (teacher only)
 *
 * Body: { name?: string, regenerateCode?: boolean, entryPromptExpiryMinutes?: number | null }
 * Returns: { classroom }
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { classroomId } = await params;
    const viewerId = await getViewerId();
    const user = await getOrCreateUser(viewerId);
    const body = await req.json();

    // Handle code regeneration separately
    if (body.regenerateCode) {
      const newCode = await regenerateClassroomCode(classroomId, user.id);
      if (!newCode) {
        return NextResponse.json(
          { error: "Not authorized or classroom not found" },
          { status: 403 },
        );
      }
      // Fetch updated classroom
      const classroom = await getClassroom(classroomId);
      return NextResponse.json({ classroom });
    }

    // Update other fields
    const updates: { name?: string; entryPromptExpiryMinutes?: number | null } =
      {};
    if (body.name) updates.name = body.name;
    // Allow setting to null (use system default) or a positive number
    if ("entryPromptExpiryMinutes" in body) {
      const value = body.entryPromptExpiryMinutes;
      if (value === null || (typeof value === "number" && value > 0)) {
        updates.entryPromptExpiryMinutes = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid updates provided" },
        { status: 400 },
      );
    }

    const classroom = await updateClassroom(classroomId, user.id, updates);

    if (!classroom) {
      return NextResponse.json(
        { error: "Not authorized or classroom not found" },
        { status: 403 },
      );
    }

    return NextResponse.json({ classroom });
  } catch (error) {
    console.error("Failed to update classroom:", error);
    return NextResponse.json(
      { error: "Failed to update classroom" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/classrooms/[classroomId]
 * Delete classroom (teacher only, cascades enrollments)
 *
 * Returns: { success: true }
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { classroomId } = await params;
    const viewerId = await getViewerId();
    const user = await getOrCreateUser(viewerId);

    const success = await deleteClassroom(classroomId, user.id);

    if (!success) {
      return NextResponse.json(
        { error: "Not authorized or classroom not found" },
        { status: 403 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete classroom:", error);
    return NextResponse.json(
      { error: "Failed to delete classroom" },
      { status: 500 },
    );
  }
}
