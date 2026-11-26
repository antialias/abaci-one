import { and, eq, inArray, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getClassroomPresence, getEnrolledStudents, getTeacherClassroom } from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'
import { buildSessionReports } from '@/lib/curriculum/session-report-batch'
import type { Counts, SessionReport } from '@/lib/curriculum/session-report'

/**
 * Active session information returned by this endpoint
 */
interface ActiveSessionInfo {
  /** Session plan ID (for observation) */
  sessionId: string
  /** Player ID */
  playerId: string
  /** When the session started (the report's `startedAt`) */
  startedAt: Date
  /** Current part index */
  currentPartIndex: number
  /** Current slot index within the part */
  currentSlotIndex: number
  /** Total parts in session */
  totalParts: number
  /** Items planned (the report's `position.progress.total`) */
  totalProblems: number
  /** Items done (the report's `position.progress.done`) */
  completedProblems: number
  /** Whether the student is currently present in the classroom */
  isPresent: boolean
  /** The report's outcome (always `in_progress` here) */
  outcome: SessionReport['outcome']
  /** The report's totals: problems, first try, final */
  totals: Counts
  /** The report's row version (orders this answer against pushes) */
  rowVersion: number
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
    const userId = await getUserId()

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

    // Every number from the session report (Phase 4d); one batched load
    const started = activeSessions.filter((session) => session.startedAt)
    const reports = await buildSessionReports(started)
    const sessions: ActiveSessionInfo[] = started.flatMap((session, i) => {
      const report = reports[i]
      if (!report?.position || report.startedAt == null) return []
      return [
        {
          sessionId: session.id,
          playerId: session.playerId,
          startedAt: new Date(report.startedAt),
          // Structural cursor, for the observer (Phase 5 removes it)
          currentPartIndex: session.currentPartIndex,
          currentSlotIndex: session.currentSlotIndex,
          totalParts: session.parts.length,
          totalProblems: report.position.progress.total,
          completedProblems: report.position.progress.done,
          isPresent: presentPlayerIds.has(session.playerId),
          outcome: report.outcome,
          totals: report.totals,
          rowVersion: report.rowVersion,
        },
      ]
    })

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Failed to fetch active sessions:', error)
    return NextResponse.json({ error: 'Failed to fetch active sessions' }, { status: 500 })
  }
})
