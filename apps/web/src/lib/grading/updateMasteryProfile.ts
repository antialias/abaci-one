import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { worksheetMastery } from '@/db/schema'
import { SINGLE_CARRY_PATH } from '@/app/create/worksheets/progressionPath'
import type { GradingResult } from '@/lib/ai/gradeWorksheet'

/**
 * Update user's mastery profile based on worksheet grading results
 *
 * This function:
 * 1. Finds or creates a mastery record for the suggested step
 * 2. Updates statistics (attempts, accuracy)
 * 3. Marks as mastered if threshold is met
 * 4. Returns whether mastery was achieved
 */
export async function updateMasteryFromGrading(
  userId: string,
  gradingResult: GradingResult
): Promise<{ mastered: boolean; stepId: string }> {
  const { suggestedStepId, accuracy, totalProblems, correctCount } = gradingResult

  // Find the step configuration
  const step = SINGLE_CARRY_PATH.find((s) => s.id === suggestedStepId)
  if (!step) {
    console.warn(`Step ${suggestedStepId} not found in progression path`)
    return { mastered: false, stepId: suggestedStepId }
  }

  const now = new Date()

  // Look up existing mastery record
  const [existing] = await db
    .select()
    .from(worksheetMastery)
    .where(and(eq(worksheetMastery.userId, userId), eq(worksheetMastery.skillId, suggestedStepId)))
    .limit(1)

  if (existing) {
    // Update existing record
    const newTotalAttempts = existing.totalAttempts + totalProblems
    const newCorrectAttempts = existing.correctAttempts + correctCount
    const overallAccuracy = newCorrectAttempts / newTotalAttempts

    // Check if mastery threshold is met
    const meetsThreshold = overallAccuracy >= step.masteryThreshold
    const meetsMinimum = newTotalAttempts >= step.minimumAttempts
    const isMastered = meetsThreshold && meetsMinimum

    await db
      .update(worksheetMastery)
      .set({
        totalAttempts: newTotalAttempts,
        correctAttempts: newCorrectAttempts,
        lastAccuracy: accuracy,
        lastPracticedAt: now,
        isMastered: isMastered ? 1 : 0,
        masteredAt: isMastered && !existing.isMastered ? now : existing.masteredAt,
        updatedAt: now,
      })
      .where(eq(worksheetMastery.id, existing.id))

    return { mastered: isMastered, stepId: suggestedStepId }
  } else {
    // Create new record
    const overallAccuracy = correctCount / totalProblems
    const meetsThreshold = overallAccuracy >= step.masteryThreshold
    const meetsMinimum = totalProblems >= step.minimumAttempts
    const isMastered = meetsThreshold && meetsMinimum

    await db.insert(worksheetMastery).values({
      id: randomUUID(),
      userId,
      skillId: suggestedStepId,
      totalAttempts: totalProblems,
      correctAttempts: correctCount,
      lastAccuracy: accuracy,
      firstAttemptAt: now,
      lastPracticedAt: now,
      isMastered: isMastered ? 1 : 0,
      masteredAt: isMastered ? now : null,
      createdAt: now,
      updatedAt: now,
    })

    return { mastered: isMastered, stepId: suggestedStepId }
  }
}

/**
 * Get user's mastery progress for all steps in the progression path
 *
 * Returns an array of step mastery status, useful for showing progression UI
 */
export async function getMasteryProgress(userId: string) {
  const masteryRecords = await db
    .select()
    .from(worksheetMastery)
    .where(eq(worksheetMastery.userId, userId))

  return SINGLE_CARRY_PATH.map((step) => {
    const record = masteryRecords.find((r) => r.skillId === step.id)

    return {
      stepId: step.id,
      stepNumber: step.stepNumber,
      name: step.name,
      isMastered: record?.isMastered || false,
      totalAttempts: record?.totalAttempts || 0,
      correctAttempts: record?.correctAttempts || 0,
      lastAccuracy: record?.lastAccuracy || null,
      masteredAt: record?.masteredAt || null,
      lastPracticedAt: record?.lastPracticedAt || null,
    }
  })
}
