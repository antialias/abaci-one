import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { worksheetAttempts } from '@/db/schema'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * GET /api/worksheets/sessions/[sessionId]
 *
 * Returns all worksheet attempts for a given session ID
 * Used by desktop to poll for new uploads from smartphone QR scan workflow
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { sessionId } = (await params) as { sessionId: string }

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    // Get all attempts for this session
    const attempts = await db
      .select()
      .from(worksheetAttempts)
      .where(eq(worksheetAttempts.sessionId, sessionId))
      .orderBy(worksheetAttempts.createdAt)

    return NextResponse.json({
      sessionId,
      count: attempts.length,
      attempts: attempts.map((attempt) => ({
        id: attempt.id,
        status: attempt.gradingStatus,
        uploadedAt: attempt.createdAt,
        totalProblems: attempt.totalProblems,
        correctCount: attempt.correctCount,
        accuracy: attempt.accuracy,
        suggestedStepId: attempt.suggestedStepId,
      })),
    })
  } catch (error) {
    console.error('Session fetch error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch session uploads',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
