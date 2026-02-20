import { and, eq, inArray, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getClassroomPresence, getEnrolledStudents, getTeacherClassroom } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * Active session information returned by this endpoint
 */
interface ActiveSessionInfo {
  /** Session plan ID (for observation) */
  sessionId: string
  /** Player ID */
  playerId: string
  /** When the session started */
  startedAt: Date
  /** Current part index */
  currentPartIndex: number
  /** Current slot index within the part */
  currentSlotIndex: number
  /** Total parts in session */
  totalParts: number
  /** Total problems in session (sum of all slots) */
  totalProblems: number
  /** Number of completed problems */
  completedProblems: number
  /** Whether the student is currently present in the classroom */
  isPresent: boolean
}

/**
 * GET /api/classrooms/[classroomId]/presence/active-sessions
 * Get active practice sessions for enrolled students in the classroom
 *
 * Returns: { sessions: ActiveSessionInfo[] }
 *
 * This endpoint allows teachers to see which students are actively practicing.
 * It returns sessions for ALL enrolled students, not just present ones.
 * The `isPresent` field indicates whether the teacher can observe the session.
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { classroomId } = (await params) as { classroomId: string }
    const userId = await getDbUserId()

    // Verify user is the teacher of this classroom
    const classroom = await getTeacherClassroom(userId)
    if (!classroom || classroom.id !== classroomId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Get all enrolled students in the classroom
    const enrolledStudents = await getEnrolledStudents(classroomId)
    const enrolledPlayerIds = enrolledStudents.map((s) => s.id)

    if (enrolledPlayerIds.length === 0) {
      return NextResponse.json({ sessions: [] })
    }

    // Get presence info to know which students are present
    const presences = await getClassroomPresence(classroomId)
    const presentPlayerIds = new Set(
      presences.filter((p) => p.player !== undefined).map((p) => p.player!.id)
    )

    // Find active sessions for enrolled students
    // Active = status is 'in_progress', startedAt is set, completedAt is null
    const activeSessions = await db.query.sessionPlans.findMany({
      where: and(
        inArray(schema.sessionPlans.playerId, enrolledPlayerIds),
        eq(schema.sessionPlans.status, 'in_progress'),
        isNull(schema.sessionPlans.completedAt)
      ),
    })

    // Map to ActiveSessionInfo
    const sessions: ActiveSessionInfo[] = activeSessions
      .filter((session) => session.startedAt)
      .map((session) => {
        // Calculate total and completed problems
        const parts = session.parts
        const totalProblems = parts.reduce((sum, part) => sum + part.slots.length, 0)
        let completedProblems = 0
        for (let i = 0; i < session.currentPartIndex; i++) {
          completedProblems += parts[i].slots.length
        }
        completedProblems += session.currentSlotIndex

        return {
          sessionId: session.id,
          playerId: session.playerId,
          startedAt: session.startedAt as Date,
          currentPartIndex: session.currentPartIndex,
          currentSlotIndex: session.currentSlotIndex,
          totalParts: parts.length,
          totalProblems,
          completedProblems,
          isPresent: presentPlayerIds.has(session.playerId),
        }
      })

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Failed to fetch active sessions:', error)
    return NextResponse.json({ error: 'Failed to fetch active sessions' }, { status: 500 })
  }
})
