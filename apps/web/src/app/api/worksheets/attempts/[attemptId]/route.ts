import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { problemAttempts, worksheetAttempts } from '@/db/schema'

/**
 * Get grading results for a worksheet attempt
 *
 * Returns the grading status and full results once AI grading is complete.
 */
export async function GET(request: NextRequest, { params }: { params: { attemptId: string } }) {
  try {
    const { attemptId } = params

    // Get attempt record
    const [attempt] = await db
      .select()
      .from(worksheetAttempts)
      .where(eq(worksheetAttempts.id, attemptId))

    if (!attempt) {
      return NextResponse.json({ error: 'Worksheet attempt not found' }, { status: 404 })
    }

    // Get individual problem results
    const problems = await db
      .select()
      .from(problemAttempts)
      .where(eq(problemAttempts.attemptId, attemptId))
      .orderBy(problemAttempts.problemIndex)

    // Parse JSON fields
    const errorPatterns = attempt.errorPatterns ? JSON.parse(attempt.errorPatterns) : []

    // Build response
    return NextResponse.json({
      attemptId: attempt.id,
      status: attempt.gradingStatus,
      uploadedAt: attempt.createdAt,
      gradedAt: attempt.gradedAt,

      // Results summary
      totalProblems: attempt.totalProblems,
      correctCount: attempt.correctCount,
      accuracy: attempt.accuracy,

      // Per-problem breakdown
      problems: problems.map((p) => ({
        index: p.problemIndex,
        problem: `${p.operandA} ${p.operator === 'addition' ? '+' : '-'} ${p.operandB}`,
        correctAnswer: p.correctAnswer,
        studentAnswer: p.studentAnswer,
        isCorrect: p.isCorrect,
        errorType: p.errorType,
        digitCount: p.digitCount,
        requiresRegrouping: p.requiresRegrouping,
      })),

      // AI analysis
      errorPatterns,
      aiSummary: attempt.aiFeedback,
      suggestedStepId: attempt.suggestedStepId,

      // Raw AI response for debugging
      aiResponseRaw: attempt.aiResponseRaw ? JSON.parse(attempt.aiResponseRaw) : null,
    })
  } catch (error) {
    console.error('Get attempt error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch attempt',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
