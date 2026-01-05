/**
 * Classroom Manager Module
 *
 * CRUD operations for classrooms:
 * - Create classroom (one per teacher)
 * - Get classroom by teacher
 * - Get classroom by code
 * - Update classroom settings
 * - Delete classroom
 */

import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  classrooms,
  generateClassroomCode,
  type Classroom,
  type NewClassroom,
  type User,
  users,
} from "@/db/schema";

// ============================================================================
// Create Classroom
// ============================================================================

export interface CreateClassroomParams {
  teacherId: string;
  name: string;
}

export interface CreateClassroomResult {
  success: boolean;
  classroom?: Classroom;
  error?: string;
}

/**
 * Create a classroom for a teacher
 *
 * Each teacher can have exactly one classroom (enforced by unique constraint).
 * Returns error if teacher already has a classroom.
 */
export async function createClassroom(
  params: CreateClassroomParams,
): Promise<CreateClassroomResult> {
  const { teacherId, name } = params;

  // Check if teacher already has a classroom
  const existing = await db.query.classrooms.findFirst({
    where: eq(classrooms.teacherId, teacherId),
  });

  if (existing) {
    return { success: false, error: "Teacher already has a classroom" };
  }

  // Generate unique code with collision handling
  let code = generateClassroomCode();
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const codeExists = await db.query.classrooms.findFirst({
      where: eq(classrooms.code, code),
    });

    if (!codeExists) break;

    code = generateClassroomCode();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    return {
      success: false,
      error: "Failed to generate unique classroom code",
    };
  }

  // Create classroom
  const [classroom] = await db
    .insert(classrooms)
    .values({
      id: createId(),
      teacherId,
      name,
      code,
    })
    .returning();

  return { success: true, classroom };
}

// ============================================================================
// Read Classroom
// ============================================================================

/**
 * Get a classroom by ID
 */
export async function getClassroom(
  classroomId: string,
): Promise<Classroom | null> {
  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.id, classroomId),
  });
  return classroom ?? null;
}

/**
 * Get a teacher's classroom
 *
 * Returns null if the user doesn't have a classroom (not a teacher).
 */
export async function getTeacherClassroom(
  teacherId: string,
): Promise<Classroom | null> {
  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.teacherId, teacherId),
  });
  return classroom ?? null;
}

/**
 * Check if a user is a teacher (has a classroom)
 */
export async function isTeacher(userId: string): Promise<boolean> {
  const classroom = await getTeacherClassroom(userId);
  return classroom !== null;
}

export interface ClassroomWithTeacher extends Classroom {
  teacher?: User;
}

/**
 * Get a classroom by join code
 *
 * Used when a parent wants to enroll their child using the code.
 */
export async function getClassroomByCode(
  code: string,
): Promise<ClassroomWithTeacher | null> {
  const normalizedCode = code.toUpperCase().trim();

  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.code, normalizedCode),
  });

  if (!classroom) return null;

  const teacher = await db.query.users.findFirst({
    where: eq(users.id, classroom.teacherId),
  });

  return { ...classroom, teacher };
}

// ============================================================================
// Update Classroom
// ============================================================================

export interface UpdateClassroomParams {
  name?: string;
  /** Entry prompt expiry time in minutes. Null = use system default (30 min) */
  entryPromptExpiryMinutes?: number | null;
}

/**
 * Update classroom settings
 *
 * Only the teacher can update their classroom.
 */
export async function updateClassroom(
  classroomId: string,
  teacherId: string,
  updates: UpdateClassroomParams,
): Promise<Classroom | null> {
  // Verify ownership
  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.id, classroomId),
  });

  if (!classroom || classroom.teacherId !== teacherId) {
    return null;
  }

  const [updated] = await db
    .update(classrooms)
    .set(updates)
    .where(eq(classrooms.id, classroomId))
    .returning();

  return updated;
}

/**
 * Regenerate classroom join code
 *
 * Use this if a teacher wants to invalidate the old code.
 */
export async function regenerateClassroomCode(
  classroomId: string,
  teacherId: string,
): Promise<string | null> {
  // Verify ownership
  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.id, classroomId),
  });

  if (!classroom || classroom.teacherId !== teacherId) {
    return null;
  }

  // Generate unique code
  let code = generateClassroomCode();
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const codeExists = await db.query.classrooms.findFirst({
      where: eq(classrooms.code, code),
    });

    if (!codeExists) break;

    code = generateClassroomCode();
    attempts++;
  }

  if (attempts >= maxAttempts) {
    return null;
  }

  await db
    .update(classrooms)
    .set({ code })
    .where(eq(classrooms.id, classroomId));

  return code;
}

// ============================================================================
// Delete Classroom
// ============================================================================

/**
 * Delete a classroom
 *
 * Only the teacher can delete their classroom.
 * All enrollments, requests, and presence records will be cascade deleted.
 */
export async function deleteClassroom(
  classroomId: string,
  teacherId: string,
): Promise<boolean> {
  // Verify ownership
  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.id, classroomId),
  });

  if (!classroom || classroom.teacherId !== teacherId) {
    return false;
  }

  await db.delete(classrooms).where(eq(classrooms.id, classroomId));

  return true;
}

// Re-export code generation function
export { generateClassroomCode } from "@/db/schema";
