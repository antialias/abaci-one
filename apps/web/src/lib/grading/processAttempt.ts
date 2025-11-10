import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { join } from 'path'
import { db } from '@/db'
import { problemAttempts, worksheetAttempts } from '@/db/schema'
import { gradeWorksheetWithVision } from '@/lib/ai/gradeWorksheet'
import { updateMasteryFromGrading } from './updateMasteryProfile'

/**
 * Map AI error patterns to database error types
 */
function inferErrorType(
  errorPatterns: string[]
): 'computation' | 'carry' | 'borrow' | 'alignment' | 'ocr-uncertain' {
  // Check for carry/borrow errors first (most specific)
  if (errorPatterns.some((p) => p.toLowerCase().includes('carry'))) {
    return 'carry'
  }
  if (errorPatterns.some((p) => p.toLowerCase().includes('borrow'))) {
    return 'borrow'
  }
  if (errorPatterns.some((p) => p.toLowerCase().includes('align'))) {
    return 'alignment'
  }
  if (
    errorPatterns.some((p) => p.toLowerCase().includes('ocr') || p.toLowerCase().includes('read'))
  ) {
    return 'ocr-uncertain'
  }
  // Default to computation error
  return 'computation'
}

/**
 * Process a worksheet attempt through the full grading pipeline
 *
 * This is the main orchestration function that:
 * 1. Updates status to 'processing'
 * 2. Calls GPT-5 Vision for single-pass grading (OCR + analysis)
 * 3. Stores individual problem results
 * 4. Updates attempt with AI analysis
 * 5. TODO: Updates mastery profile
 *
 * This will be called by a background job queue in production.
 * For MVP, it's called fire-and-forget after upload.
 */
export async function processWorksheetAttempt(attemptId: string) {
  try {
    // Update status to processing
    await db
      .update(worksheetAttempts)
      .set({ gradingStatus: 'processing', updatedAt: new Date() })
      .where(eq(worksheetAttempts.id, attemptId))

    // Get attempt record
    const [attempt] = await db
      .select()
      .from(worksheetAttempts)
      .where(eq(worksheetAttempts.id, attemptId))

    if (!attempt) {
      throw new Error(`Attempt ${attemptId} not found`)
    }

    // 1. Build image path
    const imagePath = join(process.cwd(), 'data', attempt.uploadedImageUrl)

    // 2. Grade with GPT-5 Vision (single-pass: OCR + grading + analysis)
    const gradingResult = await gradeWorksheetWithVision(imagePath)

    // Extract data for database storage
    const gradedProblems = gradingResult.problems
    const aiAnalysis = {
      errorPatterns: gradingResult.errorPatterns,
      currentStepEstimate: gradingResult.currentStepEstimate,
      suggestedStepId: gradingResult.suggestedStepId,
      reasoning: gradingResult.reasoning,
      feedback: gradingResult.feedback,
    }

    // 3. Store individual problem results
    const now = new Date()
    for (const problem of gradedProblems) {
      // Determine regroup places
      const regroupPlaces: string[] = []
      if (problem.requiresRegrouping) {
        // Check each place value for regrouping
        const aStr = problem.operandA.toString().padStart(problem.digitCount, '0')
        const bStr = problem.operandB.toString().padStart(problem.digitCount, '0')
        const places = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands']

        for (let i = problem.digitCount - 1; i >= 0; i--) {
          const digitA = Number.parseInt(aStr[aStr.length - 1 - i], 10)
          const digitB = Number.parseInt(bStr[bStr.length - 1 - i], 10)
          if (digitA + digitB >= 10) {
            regroupPlaces.push(places[problem.digitCount - 1 - i])
          }
        }
      }

      await db.insert(problemAttempts).values({
        id: randomUUID(),
        attemptId,
        userId: attempt.userId,
        problemIndex: problem.index,
        operandA: problem.operandA,
        operandB: problem.operandB,
        operator: 'addition',
        correctAnswer: problem.correctAnswer,
        studentAnswer: problem.studentAnswer,
        isCorrect: problem.isCorrect,
        errorType: problem.isCorrect ? null : inferErrorType(aiAnalysis.errorPatterns),
        digitCount: problem.digitCount,
        requiresRegrouping: problem.requiresRegrouping,
        regroupsInPlaces: regroupPlaces.length > 0 ? JSON.stringify(regroupPlaces) : null,
        createdAt: now,
      })
    }

    // 4. Update attempt with results
    const correctCount = gradedProblems.filter((p) => p.isCorrect).length
    await db
      .update(worksheetAttempts)
      .set({
        gradingStatus: 'completed',
        gradedAt: now,
        totalProblems: gradedProblems.length,
        correctCount,
        accuracy: correctCount / gradedProblems.length,
        errorPatterns: JSON.stringify(aiAnalysis.errorPatterns),
        suggestedStepId: aiAnalysis.suggestedStepId,
        aiFeedback: aiAnalysis.feedback,
        aiResponseRaw: JSON.stringify(aiAnalysis),
        updatedAt: now,
      })
      .where(eq(worksheetAttempts.id, attemptId))

    // 5. Update mastery profile
    const masteryResult = await updateMasteryFromGrading(attempt.userId, gradingResult)
    console.log(
      `Mastery update for ${masteryResult.stepId}: ${masteryResult.mastered ? 'MASTERED' : 'in progress'}`
    )

    return { success: true, attemptId, mastered: masteryResult.mastered }
  } catch (error) {
    console.error('Grading failed:', error)

    // Mark as failed
    await db
      .update(worksheetAttempts)
      .set({ gradingStatus: 'failed', updatedAt: new Date() })
      .where(eq(worksheetAttempts.id, attemptId))

    throw error
  }
}
