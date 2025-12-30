import { and, eq, inArray, lt } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import {
  getEnrolledStudents,
  getLinkedParentIds,
  getPresentPlayerIds,
  getTeacherClassroom,
} from '@/lib/classroom'
import { emitEntryPromptCreated } from '@/lib/classroom/socket-emitter'
import { getDbUserId } from '@/lib/viewer'

interface RouteParams {
  params: Promise<{ classroomId: string }>
}

/**
 * Default expiry time for entry prompts (30 minutes)
 */
const DEFAULT_EXPIRY_MINUTES = 30

/**
 * GET /api/classrooms/[classroomId]/entry-prompts
 * Get pending entry prompts for the classroom (teacher only)
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { classroomId } = await params
    const userId = await getDbUserId()

    // Verify user is the teacher of this classroom
    const classroom = await getTeacherClassroom(userId)
    if (!classroom || classroom.id !== classroomId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Get pending prompts for this classroom
    const prompts = await db.query.entryPrompts.findMany({
      where: and(
        eq(schema.entryPrompts.classroomId, classroomId),
        eq(schema.entryPrompts.status, 'pending')
      ),
    })

    // Filter out expired prompts (client-side check)
    const now = new Date()
    const activePrompts = prompts.filter((p) => p.expiresAt > now)

    return NextResponse.json({ prompts: activePrompts })
  } catch (error) {
    console.error('Failed to fetch entry prompts:', error)
    return NextResponse.json({ error: 'Failed to fetch entry prompts' }, { status: 500 })
  }
}

/**
 * POST /api/classrooms/[classroomId]/entry-prompts
 * Create entry prompts for students (teacher only)
 *
 * Body: { playerIds: string[], expiresInMinutes?: number }
 * Returns: { prompts: EntryPrompt[], skipped: { playerId: string, reason: string }[] }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { classroomId } = await params
    const userId = await getDbUserId()
    const body = await req.json()

    // Validate request body
    if (!body.playerIds || !Array.isArray(body.playerIds) || body.playerIds.length === 0) {
      return NextResponse.json({ error: 'Missing or invalid playerIds' }, { status: 400 })
    }

    // Verify user is the teacher of this classroom
    const classroom = await getTeacherClassroom(userId)
    if (!classroom || classroom.id !== classroomId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Get teacher's name for the notification
    const teacher = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    })
    const teacherName = teacher?.name || 'Your teacher'

    // Get enrolled students for this classroom
    const enrolledStudents = await getEnrolledStudents(classroomId)
    const enrolledPlayerIds = new Set(enrolledStudents.map((s) => s.id))

    // Get currently present students
    const presentPlayerIds = new Set(await getPresentPlayerIds(classroomId))

    // Mark any expired pending prompts as 'expired' so unique constraint allows new ones
    const now = new Date()
    await db
      .update(schema.entryPrompts)
      .set({ status: 'expired' })
      .where(
        and(
          eq(schema.entryPrompts.classroomId, classroomId),
          eq(schema.entryPrompts.status, 'pending'),
          inArray(schema.entryPrompts.playerId, body.playerIds),
          lt(schema.entryPrompts.expiresAt, now) // Only mark actually expired prompts
        )
      )

    // Now query for any truly active (non-expired) pending prompts
    const existingPrompts = await db.query.entryPrompts.findMany({
      where: and(
        eq(schema.entryPrompts.classroomId, classroomId),
        eq(schema.entryPrompts.status, 'pending'),
        inArray(schema.entryPrompts.playerId, body.playerIds)
      ),
    })
    // Filter to only active prompts (not expired)
    const activeExistingPrompts = existingPrompts.filter((p) => p.expiresAt > now)
    const existingPromptPlayerIds = new Set(activeExistingPrompts.map((p) => p.playerId))

    // Calculate expiry time (request override > classroom setting > system default)
    const expiresInMinutes =
      body.expiresInMinutes || classroom.entryPromptExpiryMinutes || DEFAULT_EXPIRY_MINUTES
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000)

    // Process each player
    const createdPrompts: (typeof schema.entryPrompts.$inferSelect)[] = []
    const skipped: { playerId: string; reason: string }[] = []

    for (const playerId of body.playerIds) {
      // Check if enrolled
      if (!enrolledPlayerIds.has(playerId)) {
        skipped.push({ playerId, reason: 'not_enrolled' })
        continue
      }

      // Check if already present
      if (presentPlayerIds.has(playerId)) {
        skipped.push({ playerId, reason: 'already_present' })
        continue
      }

      // Check if already has pending prompt
      if (existingPromptPlayerIds.has(playerId)) {
        skipped.push({ playerId, reason: 'pending_prompt_exists' })
        continue
      }

      // Create the entry prompt
      const [prompt] = await db
        .insert(schema.entryPrompts)
        .values({
          teacherId: userId,
          playerId,
          classroomId,
          expiresAt,
        })
        .returning()

      createdPrompts.push(prompt)

      // Get player info for the notification
      const player = await db.query.players.findFirst({
        where: eq(schema.players.id, playerId),
      })

      if (player) {
        // Get parent IDs to notify
        const parentIds = await getLinkedParentIds(playerId)

        // Emit socket event to parents
        await emitEntryPromptCreated(
          {
            promptId: prompt.id,
            classroomId,
            classroomName: classroom.name,
            playerId,
            playerName: player.name,
            playerEmoji: player.emoji,
            teacherName,
            expiresAt,
          },
          parentIds
        )
      }
    }

    return NextResponse.json(
      {
        prompts: createdPrompts,
        skipped,
        created: createdPrompts.length,
        skippedCount: skipped.length,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Failed to create entry prompts:', error)
    return NextResponse.json({ error: 'Failed to create entry prompts' }, { status: 500 })
  }
}
