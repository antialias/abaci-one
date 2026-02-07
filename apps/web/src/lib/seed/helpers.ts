import type { GeneratedProblem, SlotResult } from '../../db/schema/session-plans'
import type { SkillConfig, SuccessCriteria, TuningAdjustment } from './types'
import { generateRealisticProblems } from './problem-generation'
import { designSequenceForClassification } from './bkt-simulation'

/**
 * Generate slot results for a skill config (problem history with correct/incorrect sequences)
 */
export function generateSlotResults(
  config: SkillConfig,
  startIndex: number,
  sessionStartTime: Date
): SlotResult[] {
  // Generate realistic problems targeting the skill
  const realisticProblems = generateRealisticProblems(config.skillId, config.problems)

  // Design a sequence that will reliably produce the target BKT classification
  const correctnessSequence = designSequenceForClassification(
    config.skillId,
    config.problems,
    config.targetClassification
  )

  return realisticProblems.map((realistic, i) => {
    const isCorrect = correctnessSequence[i]

    // Convert to the schema's GeneratedProblem format
    const problem: GeneratedProblem = {
      terms: realistic.terms,
      answer: realistic.answer,
      skillsRequired: realistic.skillsUsed,
      generationTrace: realistic.generationTrace,
    }

    // Generate a plausible wrong answer if incorrect
    const wrongAnswer =
      realistic.answer + (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 3) + 1)

    const baseResult = {
      partNumber: 1 as const,
      slotIndex: startIndex + i,
      problem,
      studentAnswer: isCorrect ? realistic.answer : wrongAnswer,
      isCorrect,
      responseTimeMs: 4000 + Math.random() * 2000,
      skillsExercised: realistic.skillsUsed, // ALL skills used, not just target
      usedOnScreenAbacus: false,
      timestamp: new Date(sessionStartTime.getTime() + (startIndex + i) * 10000),
      incorrectAttempts: isCorrect ? 0 : 1,
    }

    // If simulating legacy data, omit hadHelp and helpTrigger
    // This tests the NaN handling code path for old data missing these fields
    if (config.simulateLegacyData) {
      return baseResult as SlotResult
    }

    return {
      ...baseResult,
      hadHelp: false,
      helpTrigger: 'none' as const,
    }
  })
}

/**
 * Check if a profile's outcomes meet its success criteria
 */
export function checkSuccessCriteria(
  classifications: Record<string, number>,
  criteria?: SuccessCriteria
): { success: boolean; reasons: string[] } {
  if (!criteria) {
    return { success: true, reasons: [] }
  }

  const reasons: string[] = []
  const { weak, developing, strong } = classifications

  if (criteria.minWeak !== undefined && weak < criteria.minWeak) {
    reasons.push(`Need at least ${criteria.minWeak} weak skills, got ${weak}`)
  }
  if (criteria.maxWeak !== undefined && weak > criteria.maxWeak) {
    reasons.push(`Need at most ${criteria.maxWeak} weak skills, got ${weak}`)
  }
  if (criteria.minDeveloping !== undefined && developing < criteria.minDeveloping) {
    reasons.push(`Need at least ${criteria.minDeveloping} developing skills, got ${developing}`)
  }
  if (criteria.maxDeveloping !== undefined && developing > criteria.maxDeveloping) {
    reasons.push(`Need at most ${criteria.maxDeveloping} developing skills, got ${developing}`)
  }
  if (criteria.minStrong !== undefined && strong < criteria.minStrong) {
    reasons.push(`Need at least ${criteria.minStrong} strong skills, got ${strong}`)
  }
  if (criteria.maxStrong !== undefined && strong > criteria.maxStrong) {
    reasons.push(`Need at most ${criteria.maxStrong} strong skills, got ${strong}`)
  }

  return { success: reasons.length === 0, reasons }
}

/**
 * Apply tuning adjustments to skill history
 */
export function applyTuningAdjustments(
  skillHistory: SkillConfig[],
  adjustments?: TuningAdjustment[]
): SkillConfig[] {
  if (!adjustments || adjustments.length === 0) {
    return skillHistory
  }

  return skillHistory.map((config) => {
    const newConfig = { ...config }

    for (const adj of adjustments) {
      if (adj.skillId === 'all' || adj.skillId === config.skillId) {
        if (adj.problemsAdd !== undefined) {
          newConfig.problems = newConfig.problems + adj.problemsAdd
        }
        if (adj.problemsMultiplier !== undefined) {
          newConfig.problems = Math.round(newConfig.problems * adj.problemsMultiplier)
        }
      }
    }

    return newConfig
  })
}
