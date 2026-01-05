/**
 * Session Converter
 *
 * Converts parsed worksheet data into SlotResults that can be
 * used to create an offline practice session.
 */
import type { SlotResult, GeneratedProblem } from '@/db/schema/session-plans'
import type { WorksheetParsingResult, ParsedProblem } from './schemas'
import { analyzeRequiredSkills } from '@/utils/problemGenerator'

/**
 * Options for session conversion
 */
export interface ConversionOptions {
  /** Part number to assign to all problems (default: 1) */
  partNumber?: 1 | 2 | 3
  /** Source identifier for the session results */
  source?: 'practice' | 'recency-refresh'
}

/**
 * Result of session conversion
 */
export interface ConversionResult {
  /** Converted slot results ready for session creation */
  slotResults: Omit<SlotResult, 'timestamp'>[]
  /** Summary statistics */
  summary: {
    totalProblems: number
    answeredProblems: number
    correctAnswers: number
    incorrectAnswers: number
    skippedProblems: number
    accuracy: number | null
  }
  /** Skills that were exercised across all problems */
  skillsExercised: string[]
}

/**
 * Convert a single parsed problem to a GeneratedProblem
 */
function toGeneratedProblem(parsed: ParsedProblem): GeneratedProblem {
  // Calculate correct answer from terms
  const correctAnswer = parsed.terms.reduce((sum, term) => sum + term, 0)

  // Infer skills from terms
  const skillsRequired = analyzeRequiredSkills(parsed.terms, correctAnswer)

  return {
    terms: parsed.terms,
    answer: correctAnswer,
    skillsRequired,
  }
}

/**
 * Convert a parsed problem to a SlotResult
 */
function toSlotResult(
  parsed: ParsedProblem,
  slotIndex: number,
  options: ConversionOptions
): Omit<SlotResult, 'timestamp'> {
  const problem = toGeneratedProblem(parsed)
  const studentAnswer = parsed.studentAnswer ?? 0
  const isCorrect = parsed.studentAnswer !== null && parsed.studentAnswer === problem.answer

  return {
    partNumber: options.partNumber ?? 1,
    slotIndex,
    problem,
    studentAnswer,
    isCorrect,
    responseTimeMs: 0, // Unknown for offline work
    skillsExercised: problem.skillsRequired,
    usedOnScreenAbacus: false,
    hadHelp: false,
    incorrectAttempts: isCorrect ? 0 : parsed.studentAnswer !== null ? 1 : 0,
    source: options.source,
  }
}

/**
 * Convert parsed worksheet results to SlotResults
 *
 * Filters out problems that were marked for exclusion and converts
 * the remaining problems into the format needed for session creation.
 *
 * @param parsingResult - The parsed worksheet data
 * @param options - Conversion options
 * @returns Conversion result with slot results and summary
 *
 * @example
 * ```typescript
 * import { convertToSlotResults } from '@/lib/worksheet-parsing'
 *
 * const result = convertToSlotResults(parsingResult, { partNumber: 1 })
 *
 * // Create session with results
 * await createSession({
 *   playerId,
 *   status: 'completed',
 *   slotResults: result.slotResults,
 * })
 * ```
 */
export function convertToSlotResults(
  parsingResult: WorksheetParsingResult,
  options: ConversionOptions = {}
): ConversionResult {
  const problems = parsingResult.problems
  const slotResults: Omit<SlotResult, 'timestamp'>[] = []
  const allSkills = new Set<string>()

  let answeredCount = 0
  let correctCount = 0

  for (let i = 0; i < problems.length; i++) {
    const parsed = problems[i]
    const slotResult = toSlotResult(parsed, i, options)
    slotResults.push(slotResult)

    // Track skills
    for (const skill of slotResult.skillsExercised) {
      allSkills.add(skill)
    }

    // Track statistics
    if (parsed.studentAnswer !== null) {
      answeredCount++
      if (slotResult.isCorrect) {
        correctCount++
      }
    }
  }

  const skippedCount = problems.length - answeredCount

  return {
    slotResults,
    summary: {
      totalProblems: problems.length,
      answeredProblems: answeredCount,
      correctAnswers: correctCount,
      incorrectAnswers: answeredCount - correctCount,
      skippedProblems: skippedCount,
      accuracy: answeredCount > 0 ? correctCount / answeredCount : null,
    },
    skillsExercised: Array.from(allSkills),
  }
}

/**
 * Validate that parsed problems have reasonable values
 *
 * Returns warnings for any issues found.
 */
export function validateParsedProblems(problems: ParsedProblem[]): {
  valid: boolean
  warnings: string[]
} {
  const warnings: string[] = []

  for (const problem of problems) {
    // Check that correct answer matches term sum
    const expectedAnswer = problem.terms.reduce((sum, t) => sum + t, 0)
    if (problem.correctAnswer !== expectedAnswer) {
      warnings.push(
        `Problem ${problem.problemNumber}: correctAnswer (${problem.correctAnswer}) ` +
          `doesn't match sum of terms (${expectedAnswer})`
      )
    }

    // Check for negative answers (valid but unusual)
    if (expectedAnswer < 0) {
      warnings.push(
        `Problem ${problem.problemNumber}: negative answer (${expectedAnswer}) - verify this is correct`
      )
    }

    // Check for very large numbers (may indicate misread)
    if (Math.abs(expectedAnswer) > 9999) {
      warnings.push(
        `Problem ${problem.problemNumber}: very large answer (${expectedAnswer}) - verify reading`
      )
    }

    // Check for low confidence
    if (problem.termsConfidence < 0.5) {
      warnings.push(
        `Problem ${problem.problemNumber}: very low term confidence (${problem.termsConfidence.toFixed(2)})`
      )
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  }
}

/**
 * Compute aggregate skill statistics from slot results
 */
export function computeSkillStats(
  slotResults: Omit<SlotResult, 'timestamp'>[]
): Map<string, { correct: number; incorrect: number; total: number }> {
  const skillStats = new Map<string, { correct: number; incorrect: number; total: number }>()

  for (const result of slotResults) {
    for (const skill of result.skillsExercised) {
      const stats = skillStats.get(skill) ?? {
        correct: 0,
        incorrect: 0,
        total: 0,
      }
      stats.total++
      if (result.isCorrect) {
        stats.correct++
      } else if (result.studentAnswer !== 0) {
        // Only count as incorrect if student answered
        stats.incorrect++
      }
      skillStats.set(skill, stats)
    }
  }

  return skillStats
}
