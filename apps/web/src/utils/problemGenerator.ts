import type {
  GenerationTrace,
  GenerationTraceStep,
  SkillMasteryDisplay,
} from '@/db/schema/session-plans'
import type { PracticeStep, SkillSet } from '../types/tutorial'
import { getBaseComplexity, type SkillCostCalculator } from './skillComplexity'
import {
  extractSkillsFromProblem,
  extractSkillsFromSequence,
  flattenProblemSkills,
} from './skillExtraction'
import { generateUnifiedInstructionSequence } from './unifiedStepGenerator'

// Re-export trace types for consumers that import from this file
export type { GenerationTrace, GenerationTraceStep }

// =============================================================================
// MEMOIZATION CACHE FOR SKILL ANALYSIS
// =============================================================================
//
// The analyzeStepSkills function is called hundreds of thousands of times during
// problem generation (e.g., 60 problems × 100 attempts × 4 terms × 18 candidates).
// Since the result depends only on (currentValue, term), we can memoize it.
//
// The cache key is `${currentValue}:${term}` because:
// - targetValue = currentValue + term (deterministic)
// - The third parameter (_newValue) is unused
// - Skill detection is pure functional (no side effects, no randomness)

const stepSkillsCache = new Map<string, string[]>()

/** Cache statistics for monitoring/testing */
interface CacheStats {
  size: number
  hits: number
  misses: number
}

let cacheHits = 0
let cacheMisses = 0

/**
 * Get the cache key for a given step.
 * Uses currentValue and term only (newValue is computed from these).
 */
function getStepSkillsCacheKey(currentValue: number, term: number): string {
  return `${currentValue}:${term}`
}

/**
 * Clear the step skills cache.
 * Useful for testing or when you want to force recomputation.
 */
export function clearStepSkillsCache(): void {
  stepSkillsCache.clear()
  cacheHits = 0
  cacheMisses = 0
}

/**
 * Get cache statistics for monitoring and testing.
 */
export function getStepSkillsCacheStats(): CacheStats {
  return {
    size: stepSkillsCache.size,
    hits: cacheHits,
    misses: cacheMisses,
  }
}

/**
 * Memoized version of analyzeStepSkills.
 *
 * This function returns cached results when available, avoiding expensive
 * abacus simulation for repeated (currentValue, term) pairs.
 *
 * @param currentValue - Current abacus value
 * @param term - Term to add (positive) or subtract (negative)
 * @param _newValue - Expected result (unused, kept for API compatibility)
 * @returns Array of unique skill identifiers required for this step
 */
export function analyzeStepSkillsMemoized(
  currentValue: number,
  term: number,
  _newValue: number
): string[] {
  const key = getStepSkillsCacheKey(currentValue, term)

  const cached = stepSkillsCache.get(key)
  if (cached !== undefined) {
    cacheHits++
    return cached
  }

  cacheMisses++
  const result = analyzeStepSkills(currentValue, term, _newValue)
  stepSkillsCache.set(key, result)
  return result
}

export interface GeneratedProblem {
  id: string
  terms: number[]
  answer: number
  /** Skills that this problem exercises (output, not input constraint) */
  skillsUsed: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  explanation?: string
  /** Step-by-step trace from the generator showing skills used at each step */
  generationTrace?: GenerationTrace
}

export interface ProblemConstraints {
  numberRange: { min: number; max: number }
  maxSum?: number
  minSum?: number
  minTerms?: number
  maxTerms: number
  problemCount: number
  /**
   * Maximum complexity budget per term.
   *
   * Each term's skills are costed using the SkillCostCalculator,
   * which factors in both base skill complexity and student mastery.
   *
   * If set, terms with total cost > budget are rejected during generation.
   */
  maxComplexityBudgetPerTerm?: number
  /**
   * Minimum complexity budget per term.
   *
   * If set, terms with total cost < budget are rejected during generation.
   * This ensures every term exercises real skills (no trivial direct additions).
   */
  minComplexityBudgetPerTerm?: number
}

/**
 * Analyzes which skills are required during sequential computation.
 * Uses the unified step generator's actual abacus simulation to determine skills,
 * ensuring consistency with the tutorial/help system.
 *
 * @param terms - Array of terms (positive for addition, negative for subtraction)
 * @param _finalSum - Final sum (unused, kept for API compatibility)
 * @returns Array of unique skill identifiers required for this problem
 */
export function analyzeRequiredSkills(terms: number[], _finalSum: number): string[] {
  // Use the unified step generator to extract skills via actual abacus simulation
  const skillsByTerm = extractSkillsFromProblem(terms, generateUnifiedInstructionSequence)
  const allSkills = flattenProblemSkills(skillsByTerm)
  return [...new Set(allSkills.map((s) => s.skillId))]
}

// GenerationTrace and GenerationTraceStep are imported from @/db/schema/session-plans
// and re-exported above for backward compatibility

/**
 * Generates a human-readable explanation for a single step
 */
function generateStepExplanation(
  before: number,
  term: number,
  after: number,
  skills: string[],
  isSubtraction: boolean = false
): string {
  if (skills.length === 0) {
    return isSubtraction
      ? `Subtract ${term} directly (no skill needed)`
      : `Add ${term} directly (no skill needed)`
  }

  const explanations: string[] = []

  for (const skill of skills) {
    // Addition skills
    if (skill === 'basic.directAddition') {
      explanations.push(`direct addition of ${term}`)
    } else if (skill === 'basic.heavenBead') {
      explanations.push('use heaven bead (5)')
    } else if (skill === 'basic.simpleCombinations') {
      explanations.push('simple combination (5+n)')
    } else if (skill.startsWith('fiveComplements.')) {
      // e.g., "fiveComplements.4=5-1" -> "+4 = +5-1"
      const match = skill.match(/fiveComplements\.(\d)=5-(\d)/)
      if (match) {
        explanations.push(`five complement: +${match[1]} = +5-${match[2]}`)
      }
    } else if (skill.startsWith('tenComplements.')) {
      // e.g., "tenComplements.9=10-1" -> "+9 = +10-1"
      const match = skill.match(/tenComplements\.(\d)=10-(\d)/)
      if (match) {
        explanations.push(`ten complement: +${match[1]} = +10-${match[2]} (carry)`)
      }
    }
    // Subtraction skills
    else if (skill === 'basic.directSubtraction') {
      explanations.push(`direct subtraction of ${term}`)
    } else if (skill === 'basic.heavenBeadSubtraction') {
      explanations.push('remove heaven bead (5)')
    } else if (skill === 'basic.simpleCombinationsSub') {
      explanations.push('simple subtraction combination')
    } else if (skill.startsWith('fiveComplementsSub.')) {
      // e.g., "fiveComplementsSub.-4=-5+1" -> "-4 = -5+1"
      const match = skill.match(/fiveComplementsSub\.-(\d)=-5\+(\d)/)
      if (match) {
        explanations.push(`five complement: -${match[1]} = -5+${match[2]}`)
      }
    } else if (skill.startsWith('tenComplementsSub.')) {
      // e.g., "tenComplementsSub.-9=+1-10" -> "-9 = +1-10"
      const match = skill.match(/tenComplementsSub\.-(\d)=\+(\d)-10/)
      if (match) {
        explanations.push(`ten complement: -${match[1]} = +${match[2]}-10 (borrow)`)
      }
    }
  }

  const beforeOnes = before % 10
  const termOnes = term % 10
  const op = isSubtraction ? '-' : '+'
  const resultOnes = isSubtraction ? (before - term) % 10 : (before + term) % 10
  const carryBorrow = isSubtraction
    ? beforeOnes < termOnes
      ? ' (borrow)'
      : ''
    : before + term >= 10
      ? ' (carry)'
      : ''

  return `${before} ${op} ${term}: ones column ${beforeOnes}${op}${termOnes}=${resultOnes}${carryBorrow} → ${explanations.join(', ')}`
}

/**
 * Analyzes skills needed for a single step: currentValue + term = newValue
 * Uses the unified step generator's actual abacus simulation to determine skills.
 *
 * @param currentValue - Current abacus value
 * @param term - Term to add (positive) or subtract (negative)
 * @param _newValue - Expected result (unused, kept for API compatibility)
 * @returns Array of unique skill identifiers required for this step
 */
export function analyzeStepSkills(currentValue: number, term: number, _newValue: number): string[] {
  const targetValue = currentValue + term

  try {
    const sequence = generateUnifiedInstructionSequence(currentValue, targetValue)
    const skills = extractSkillsFromSequence(sequence)
    return [...new Set(skills.map((s) => s.skillId))]
  } catch {
    // If sequence generation fails, return empty skills
    return []
  }
}

/**
 * Helper to check if a skill is enabled in a skill set category
 */
function isSkillEnabled(skillPath: string, skillSet: SkillSet | Partial<SkillSet>): boolean {
  const [category, skill] = skillPath.split('.')
  if (category === 'basic' && skillSet.basic) {
    return skillSet.basic[skill as keyof typeof skillSet.basic] || false
  } else if (category === 'fiveComplements' && skillSet.fiveComplements) {
    return skillSet.fiveComplements[skill as keyof typeof skillSet.fiveComplements] || false
  } else if (category === 'tenComplements' && skillSet.tenComplements) {
    return skillSet.tenComplements[skill as keyof typeof skillSet.tenComplements] || false
  } else if (category === 'fiveComplementsSub' && skillSet.fiveComplementsSub) {
    return skillSet.fiveComplementsSub[skill as keyof typeof skillSet.fiveComplementsSub] || false
  } else if (category === 'tenComplementsSub' && skillSet.tenComplementsSub) {
    return skillSet.tenComplementsSub[skill as keyof typeof skillSet.tenComplementsSub] || false
  } else if (category === 'advanced' && skillSet.advanced) {
    return skillSet.advanced[skill as keyof typeof skillSet.advanced] || false
  }
  return false
}

/**
 * Checks if a problem matches the skill constraints
 */
export function problemMatchesSkills(
  problem: GeneratedProblem,
  allowedSkills: SkillSet,
  targetSkills?: Partial<SkillSet>,
  forbiddenSkills?: Partial<SkillSet>
): boolean {
  // Check allowed skills - problem must use at least one enabled allowed skill
  const hasAllowedSkill = problem.skillsUsed.some((skillPath) =>
    isSkillEnabled(skillPath, allowedSkills)
  )

  if (!hasAllowedSkill) return false

  // Check forbidden skills - problem must not use any forbidden skills
  if (forbiddenSkills) {
    const usesForbiddenSkill = problem.skillsUsed.some((skillPath) =>
      isSkillEnabled(skillPath, forbiddenSkills)
    )

    if (usesForbiddenSkill) return false
  }

  // Check target skills - if specified, problem should use at least one target skill
  if (targetSkills) {
    const hasTargetSkill = problem.skillsUsed.some((skillPath) =>
      isSkillEnabled(skillPath, targetSkills)
    )

    // If target skills are specified but none match, reject
    const hasAnyTargetSkill =
      Object.values(targetSkills.basic || {}).some(Boolean) ||
      Object.values(targetSkills.fiveComplements || {}).some(Boolean) ||
      Object.values(targetSkills.tenComplements || {}).some(Boolean) ||
      Object.values(targetSkills.fiveComplementsSub || {}).some(Boolean) ||
      Object.values(targetSkills.tenComplementsSub || {}).some(Boolean) ||
      Object.values(targetSkills.advanced || {}).some(Boolean)

    if (hasAnyTargetSkill && !hasTargetSkill) return false
  }

  return true
}

/**
 * Options for generating a single problem
 */
export interface GenerateProblemOptions {
  constraints: ProblemConstraints
  allowedSkills: SkillSet
  targetSkills?: Partial<SkillSet>
  forbiddenSkills?: Partial<SkillSet>
  /** Student-aware cost calculator for budget enforcement */
  costCalculator?: SkillCostCalculator
  /** Number of attempts before giving up (default: 100) */
  attempts?: number
}

/**
 * Diagnostic info about why problem generation failed
 */
export interface GenerationDiagnostics {
  /** Total generation attempts made */
  totalAttempts: number
  /** How many attempts failed at sequence generation */
  sequenceFailures: number
  /** How many attempts failed sum constraints */
  sumConstraintFailures: number
  /** How many attempts failed skill matching */
  skillMatchFailures: number
  /** Skills the problem is allowed to use (whitelist) */
  enabledAllowedSkills: string[]
  /** Target skills the problem should preferentially use (if any) */
  enabledTargetSkills: string[]
  /** Last generated problem's skills (if any got that far) */
  lastGeneratedSkills?: string[]
  /** How many terms had to use lower complexity because minBudget was impossible */
  termsWithForcedLowerComplexity?: number
  /**
   * True if we fell back to a problem that didn't match target skills.
   * This happens when target skills are unreachable with the current allowed skills.
   * E.g., heavenBeadSubtraction can't be used if heavenBead isn't enabled to reach state 5+.
   */
  targetSkillsFallback?: boolean
}

/**
 * Helper to extract enabled skill paths from a SkillSet
 */
function getEnabledSkillPaths(skillSet: SkillSet | Partial<SkillSet>): string[] {
  const paths: string[] = []
  for (const [category, skills] of Object.entries(skillSet)) {
    if (skills && typeof skills === 'object') {
      for (const [skill, enabled] of Object.entries(skills)) {
        if (enabled) {
          paths.push(`${category}.${skill}`)
        }
      }
    }
  }
  return paths
}

/**
 * Result from generateSingleProblemWithDiagnostics
 */
export interface GenerationResult {
  problem: GeneratedProblem | null
  diagnostics: GenerationDiagnostics
}

/**
 * Check if a problem matches allowed and forbidden skills (ignoring target skills).
 * Used to find fallback candidates when target skills are unreachable.
 */
function problemMatchesAllowedSkillsOnly(
  problem: GeneratedProblem,
  allowedSkills: SkillSet,
  forbiddenSkills?: Partial<SkillSet>
): boolean {
  // Check allowed skills - problem must use at least one enabled allowed skill
  const hasAllowedSkill = problem.skillsUsed.some((skillPath) =>
    isSkillEnabled(skillPath, allowedSkills)
  )

  if (!hasAllowedSkill) return false

  // Check forbidden skills - problem must not use any forbidden skills
  if (forbiddenSkills) {
    const usesForbiddenSkill = problem.skillsUsed.some((skillPath) =>
      isSkillEnabled(skillPath, forbiddenSkills)
    )

    if (usesForbiddenSkill) return false
  }

  return true
}

/**
 * Generates a single problem with detailed diagnostics about what happened
 */
export function generateSingleProblemWithDiagnostics(
  options: GenerateProblemOptions
): GenerationResult {
  const { constraints, allowedSkills, targetSkills, forbiddenSkills, costCalculator } = options
  const maxAttempts = options.attempts ?? 100

  const diagnostics: GenerationDiagnostics = {
    totalAttempts: 0,
    sequenceFailures: 0,
    sumConstraintFailures: 0,
    skillMatchFailures: 0,
    enabledAllowedSkills: getEnabledSkillPaths(allowedSkills),
    enabledTargetSkills: targetSkills ? getEnabledSkillPaths(targetSkills) : [],
  }

  // Track the best "fallback" candidate - a problem that matches allowed/forbidden
  // but not target skills. Used when target skills are unreachable.
  let fallbackCandidate: GeneratedProblem | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    diagnostics.totalAttempts++

    // Generate random number of terms within the specified range
    const minTerms = constraints.minTerms ?? 3
    const maxTerms = constraints.maxTerms
    const termCount = Math.floor(Math.random() * (maxTerms - minTerms + 1)) + minTerms

    // Generate the sequence of numbers to add
    const sequenceResult = generateSequence(
      constraints,
      termCount,
      allowedSkills,
      targetSkills,
      forbiddenSkills,
      costCalculator
    )

    if (!sequenceResult) {
      diagnostics.sequenceFailures++
      continue
    }

    const { terms, trace } = sequenceResult
    const sum = trace.answer

    // Check sum constraints
    if (constraints.maxSum && sum > constraints.maxSum) {
      diagnostics.sumConstraintFailures++
      continue
    }
    if (constraints.minSum && sum < constraints.minSum) {
      diagnostics.sumConstraintFailures++
      continue
    }

    const problemSkills = trace.allSkills
    diagnostics.lastGeneratedSkills = problemSkills

    // Determine difficulty
    let difficulty: 'easy' | 'medium' | 'hard' = 'easy'
    if (problemSkills.some((skill) => skill.startsWith('tenComplements'))) {
      difficulty = 'hard'
    } else if (problemSkills.some((skill) => skill.startsWith('fiveComplements'))) {
      difficulty = 'medium'
    }

    const problem: GeneratedProblem = {
      id: `problem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      terms,
      answer: sum,
      skillsUsed: problemSkills,
      difficulty,
      explanation: generateSequentialExplanation(terms, sum, problemSkills),
      generationTrace: trace,
    }

    // Check full match (including target skills)
    if (problemMatchesSkills(problem, allowedSkills, targetSkills, forbiddenSkills)) {
      return { problem, diagnostics }
    }

    // If it matches allowed/forbidden but not target, save as fallback
    if (
      targetSkills &&
      !fallbackCandidate &&
      problemMatchesAllowedSkillsOnly(problem, allowedSkills, forbiddenSkills)
    ) {
      fallbackCandidate = problem
    }

    diagnostics.skillMatchFailures++
  }

  // If we have a fallback candidate (matched required/forbidden but not target),
  // return it with a warning. This handles cases where target skills are
  // unreachable with the current required skills (e.g., heavenBeadSubtraction
  // requires heavenBead to first reach state 5+).
  if (fallbackCandidate) {
    diagnostics.targetSkillsFallback = true
    return { problem: fallbackCandidate, diagnostics }
  }

  return { problem: null, diagnostics }
}

/**
 * Generates a single sequential addition problem that matches the given constraints and skills
 */
export function generateSingleProblem(
  constraintsOrOptions: ProblemConstraints | GenerateProblemOptions,
  allowedSkills?: SkillSet,
  targetSkills?: Partial<SkillSet>,
  forbiddenSkills?: Partial<SkillSet>,
  attempts: number = 100
): GeneratedProblem | null {
  // Support both old and new API
  let constraints: ProblemConstraints
  let _allowedSkills: SkillSet
  let _targetSkills: Partial<SkillSet> | undefined
  let _forbiddenSkills: Partial<SkillSet> | undefined
  let _attempts: number
  let costCalculator: SkillCostCalculator | undefined

  if ('constraints' in constraintsOrOptions) {
    // New options-based API
    constraints = constraintsOrOptions.constraints
    _allowedSkills = constraintsOrOptions.allowedSkills
    _targetSkills = constraintsOrOptions.targetSkills
    _forbiddenSkills = constraintsOrOptions.forbiddenSkills
    _attempts = constraintsOrOptions.attempts ?? 100
    costCalculator = constraintsOrOptions.costCalculator
  } else {
    // Old positional API (backward compatibility)
    constraints = constraintsOrOptions
    _allowedSkills = allowedSkills!
    _targetSkills = targetSkills
    _forbiddenSkills = forbiddenSkills
    _attempts = attempts
  }

  // Use the diagnostics version internally
  const result = generateSingleProblemWithDiagnostics({
    constraints,
    allowedSkills: _allowedSkills,
    targetSkills: _targetSkills,
    forbiddenSkills: _forbiddenSkills,
    costCalculator,
    attempts: _attempts,
  })

  return result.problem
}

/** Result from generating a sequence, includes provenance trace */
interface SequenceResult {
  terms: number[]
  trace: GenerationTrace
}

/**
 * Checks if any subtraction skills are enabled in a skill set
 */
function hasSubtractionSkills(skillSet: SkillSet): boolean {
  return (
    skillSet.basic.directSubtraction ||
    skillSet.basic.heavenBeadSubtraction ||
    skillSet.basic.simpleCombinationsSub ||
    Object.values(skillSet.fiveComplementsSub).some(Boolean) ||
    Object.values(skillSet.tenComplementsSub).some(Boolean)
  )
}

/**
 * Generates a sequence of numbers that can be computed using only the specified skills.
 * Supports both addition and subtraction operations.
 * Also builds a trace showing what skills were computed at each step.
 */
function generateSequence(
  constraints: ProblemConstraints,
  termCount: number,
  allowedSkills: SkillSet,
  targetSkills?: Partial<SkillSet>,
  forbiddenSkills?: Partial<SkillSet>,
  costCalculator?: SkillCostCalculator
): SequenceResult | null {
  const terms: number[] = []
  const steps: GenerationTraceStep[] = []
  let currentValue = 0

  // Check if we can use subtraction
  const canSubtract = hasSubtractionSkills(allowedSkills)

  // Track previous term for no-immediate-inverse rule
  let previousTerm: PreviousTerm | undefined

  for (let i = 0; i < termCount; i++) {
    // Try to find a valid next term (returns term + skills it computed)
    // For first term, always add (can't subtract from 0)
    const allowSubtraction = canSubtract && i > 0 && currentValue > 0
    const result = findValidNextTermWithTrace(
      currentValue,
      constraints,
      allowedSkills,
      targetSkills,
      forbiddenSkills,
      i === termCount - 1, // isLastTerm
      allowSubtraction,
      costCalculator,
      previousTerm // Pass previous term to avoid immediate inverses
    )

    if (result === null) return null // Couldn't find valid term

    const { term, skillsUsed, isSubtraction, complexityCost } = result

    // Update previous term for next iteration
    previousTerm = { term, isSubtraction }
    const newValue = isSubtraction ? currentValue - term : currentValue + term

    // Build trace step with the skills the generator computed
    const explanation = generateStepExplanation(
      currentValue,
      term,
      newValue,
      skillsUsed,
      isSubtraction
    )
    const operation = isSubtraction
      ? `${currentValue} - ${term} = ${newValue}`
      : `${currentValue} + ${term} = ${newValue}`

    steps.push({
      stepNumber: i + 1,
      operation,
      accumulatedBefore: currentValue,
      termAdded: isSubtraction ? -term : term,
      accumulatedAfter: newValue,
      skillsUsed,
      explanation,
      complexityCost,
    })

    // Store the signed term for the problem
    terms.push(isSubtraction ? -term : term)
    currentValue = newValue
  }

  // Calculate total complexity cost from all steps
  // Note: Use explicit NaN check since ?? only catches null/undefined, not NaN
  const totalComplexityCost = steps.reduce((sum, step) => {
    const cost = step.complexityCost
    if (cost === undefined || cost === null || Number.isNaN(cost)) return sum
    return sum + cost
  }, 0)

  // Build skill mastery context if cost calculator is available
  const allSkills = [...new Set(steps.flatMap((s) => s.skillsUsed))]
  let skillMasteryContext: Record<string, SkillMasteryDisplay> | undefined

  if (costCalculator) {
    skillMasteryContext = {}
    for (const skillId of allSkills) {
      skillMasteryContext[skillId] = {
        isPracticing: costCalculator.getIsPracticing(skillId),
        baseCost: getBaseComplexity(skillId),
        effectiveCost: costCalculator.calculateSkillCost(skillId),
      }
    }
  }

  return {
    terms,
    trace: {
      terms,
      answer: currentValue,
      steps,
      allSkills,
      budgetConstraint: constraints.maxComplexityBudgetPerTerm,
      minBudgetConstraint: constraints.minComplexityBudgetPerTerm,
      totalComplexityCost: totalComplexityCost > 0 ? totalComplexityCost : undefined,
      skillMasteryContext,
    },
  }
}

/** Info about the previous term for inverse checking */
interface PreviousTerm {
  term: number
  isSubtraction: boolean
}

/**
 * State-dependent skills and their setup requirements.
 *
 * Some skills can only be triggered when the abacus is in a specific state.
 * This map defines:
 * - skillId: the skill that needs setup
 * - canUse: function to check if current state enables the skill
 * - setupPredicate: function to check if a term would set up the state for this skill
 *
 * For example, heavenBeadSubtraction requires ones digit 5-9 (heaven bead active)
 * so we need to add terms that result in ones digit 5-9 before we can subtract 5.
 */
interface StateDependentSkill {
  skillId: string
  /** Check if the current value enables this skill */
  canUse: (currentValue: number) => boolean
  /** Check if applying this term would set up the state for this skill */
  wouldSetupState: (currentValue: number, term: number, isSubtraction: boolean) => boolean
}

const STATE_DEPENDENT_SKILLS: StateDependentSkill[] = [
  {
    // heavenBeadSubtraction: requires ones digit 5-9, then subtract 5
    skillId: 'basic.heavenBeadSubtraction',
    canUse: (currentValue: number) => {
      const onesDigit = currentValue % 10
      return onesDigit >= 5 // Heaven bead is active when ones digit is 5-9
    },
    wouldSetupState: (currentValue: number, term: number, isSubtraction: boolean) => {
      const newValue = isSubtraction ? currentValue - term : currentValue + term
      if (newValue < 0) return false
      const newOnesDigit = newValue % 10
      return newOnesDigit >= 5 // Result has heaven bead active
    },
  },
  {
    // heavenBead (addition): requires ones digit 0-4 to add 5 directly
    skillId: 'basic.heavenBead',
    canUse: (currentValue: number) => {
      const onesDigit = currentValue % 10
      return onesDigit <= 4 // Can add 5 directly when ones is 0-4
    },
    wouldSetupState: (currentValue: number, term: number, isSubtraction: boolean) => {
      const newValue = isSubtraction ? currentValue - term : currentValue + term
      if (newValue < 0) return false
      const newOnesDigit = newValue % 10
      return newOnesDigit <= 4 // Result allows adding 5 directly
    },
  },
]

/**
 * Check if a candidate term moves CLOSER to enabling a state-dependent skill.
 *
 * Unlike `wouldSetupState` which requires the state to be fully enabled,
 * this checks if we're making progress toward the target state.
 *
 * For heavenBeadSubtraction (needs ones >= 5):
 * - If current ones is 0 and new ones is 3, we're closer (progress)
 * - If current ones is 0 and new ones is 5, we're there (setup complete)
 */
function movesTowardSetup(
  depSkill: StateDependentSkill,
  currentValue: number,
  term: number,
  isSubtraction: boolean
): boolean {
  if (depSkill.skillId === 'basic.heavenBeadSubtraction') {
    const currentOnes = currentValue % 10
    const newValue = isSubtraction ? currentValue - term : currentValue + term
    if (newValue < 0) return false
    const newOnes = newValue % 10
    // Progress if we're moving toward 5+ without overshooting
    return newOnes > currentOnes && newOnes <= 9
  }
  if (depSkill.skillId === 'basic.heavenBead') {
    const currentOnes = currentValue % 10
    const newValue = isSubtraction ? currentValue - term : currentValue + term
    if (newValue < 0) return false
    const newOnes = newValue % 10
    // Progress if we're moving toward 0-4
    return newOnes < currentOnes && newOnes >= 0
  }
  return false
}

/**
 * Find state-dependent skills that are in the target skills set
 */
function findStateDependentTargetSkills(
  targetSkills: Partial<SkillSet> | undefined
): StateDependentSkill[] {
  if (!targetSkills) return []

  return STATE_DEPENDENT_SKILLS.filter((depSkill) => isSkillEnabled(depSkill.skillId, targetSkills))
}

/** Result from findValidNextTermWithTrace */
interface TermWithSkills {
  term: number
  skillsUsed: string[]
  isSubtraction: boolean
  /** Complexity cost (if calculator was provided) */
  complexityCost?: number
  /** Whether this term met the minBudget requirement (used for diagnostics) */
  metMinBudget?: boolean
}

/**
 * Collects all valid terms from a given state, categorized by complexity.
 *
 * This is the core of the state-aware generation algorithm. Instead of
 * filtering by minBudget during collection (which can result in empty candidates),
 * we collect ALL valid terms and categorize them for intelligent selection.
 */
function collectValidTerms(
  currentValue: number,
  constraints: ProblemConstraints,
  allowedSkills: SkillSet,
  forbiddenSkills: Partial<SkillSet> | undefined,
  allowSubtraction: boolean,
  costCalculator?: SkillCostCalculator
): { meetsMinBudget: TermWithSkills[]; belowMinBudget: TermWithSkills[] } {
  const { min, max } = constraints.numberRange
  const maxBudget = constraints.maxComplexityBudgetPerTerm
  const minBudget = constraints.minComplexityBudgetPerTerm

  const meetsMinBudget: TermWithSkills[] = []
  const belowMinBudget: TermWithSkills[] = []

  // Helper to check if a term is valid and categorize it
  const processTerm = (term: number, isSubtraction: boolean) => {
    const newValue = isSubtraction ? currentValue - term : currentValue + term

    // Skip if result would be negative (for subtraction)
    if (isSubtraction && newValue < 0) return

    // Get skills for this operation (memoized for performance)
    const signedTerm = isSubtraction ? -term : term
    const stepSkills = analyzeStepSkillsMemoized(currentValue, signedTerm, newValue)

    // Check if the step uses only allowed skills (and no forbidden skills)
    const usesValidSkills = stepSkills.every((skillPath) => {
      if (!isSkillEnabled(skillPath, allowedSkills)) return false
      if (forbiddenSkills && isSkillEnabled(skillPath, forbiddenSkills)) return false
      return true
    })

    if (!usesValidSkills) return

    // Calculate complexity cost
    const termCost = costCalculator ? costCalculator.calculateTermCost(stepSkills) : undefined

    // Check max budget - skip if too complex for this student
    if (termCost !== undefined && maxBudget !== undefined && termCost > maxBudget) return

    // Determine if this term meets the min budget requirement
    const meetsMin = minBudget === undefined || termCost === undefined || termCost >= minBudget

    const candidate: TermWithSkills = {
      term,
      skillsUsed: stepSkills,
      isSubtraction,
      complexityCost: termCost,
      metMinBudget: meetsMin,
    }

    if (meetsMin) {
      meetsMinBudget.push(candidate)
    } else {
      belowMinBudget.push(candidate)
    }
  }

  // Try each possible ADDITION term value
  for (let term = min; term <= max; term++) {
    processTerm(term, false)
  }

  // Try each possible SUBTRACTION term value (if allowed)
  if (allowSubtraction) {
    for (let term = min; term <= max; term++) {
      processTerm(term, true)
    }
  }

  return { meetsMinBudget, belowMinBudget }
}

/**
 * Finds a valid next term in the sequence and returns both the term and
 * the skills that were computed for it (provenance).
 * Supports both addition and subtraction operations.
 *
 * KEY ALGORITHM: State-aware complexity selection
 *
 * The complexity of a skill depends on the current abacus state:
 * - Adding +4 to currentValue=0 uses basic.directAddition (cost 0)
 * - Adding +4 to currentValue=7 uses fiveComplements.4=5-1 (cost 1)
 *
 * This function:
 * 1. Collects ALL valid terms (skills allowed, max budget OK)
 * 2. Categorizes them: meets minBudget vs. below minBudget
 * 3. Prefers terms that meet minBudget
 * 4. Falls back to lower-cost terms if no term can meet minBudget
 *
 * This ensures generation never fails due to impossible budget constraints
 * while still preferring appropriately challenging problems.
 */
function findValidNextTermWithTrace(
  currentValue: number,
  constraints: ProblemConstraints,
  allowedSkills: SkillSet,
  targetSkills?: Partial<SkillSet>,
  forbiddenSkills?: Partial<SkillSet>,
  isLastTerm: boolean = false,
  allowSubtraction: boolean = false,
  costCalculator?: SkillCostCalculator,
  previousTerm?: PreviousTerm
): TermWithSkills | null {
  // Step 1: Collect all valid terms, categorized by min budget
  const { meetsMinBudget, belowMinBudget } = collectValidTerms(
    currentValue,
    constraints,
    allowedSkills,
    forbiddenSkills,
    allowSubtraction,
    costCalculator
  )

  // Step 2: Choose the best candidate pool
  // Prefer terms that meet minBudget, fall back to lower-cost if needed
  let candidates: TermWithSkills[]
  if (meetsMinBudget.length > 0) {
    candidates = meetsMinBudget
  } else {
    // Graceful fallback: accept lower complexity when budget can't be met
    // This handles cases like first term from 0, or states where no term triggers high-cost skills
    candidates = belowMinBudget
  }

  if (candidates.length === 0) return null

  // Step 3: Filter out immediate inverses of the previous term
  // e.g., if previous was +5, don't allow -5; if previous was -3, don't allow +3
  if (previousTerm) {
    const nonInverseCandidates = candidates.filter((candidate) => {
      if (
        candidate.term === previousTerm.term &&
        candidate.isSubtraction !== previousTerm.isSubtraction
      ) {
        return false
      }
      return true
    })

    // Only use filtered list if it's not empty
    if (nonInverseCandidates.length > 0) {
      candidates = nonInverseCandidates
    }
  }

  if (candidates.length === 0) return null

  // Step 4: If we have target skills and this is not the last term,
  // prefer terms that use target skills
  if (targetSkills && !isLastTerm) {
    const targetCandidates = candidates.filter((candidate) =>
      candidate.skillsUsed.some((skillPath) => isSkillEnabled(skillPath, targetSkills))
    )

    if (targetCandidates.length > 0) {
      return targetCandidates[Math.floor(Math.random() * targetCandidates.length)]
    }

    // Step 4b: No candidates directly use target skills.
    // Check if any target skills are state-dependent (need setup).
    // If so, prefer terms that SET UP the state for those skills.
    const stateDependentTargets = findStateDependentTargetSkills(targetSkills)
    if (stateDependentTargets.length > 0) {
      // Find candidates that would FULLY set up the state for state-dependent target skills
      const setupCandidates = candidates.filter((candidate) =>
        stateDependentTargets.some(
          (depSkill) =>
            !depSkill.canUse(currentValue) && // Not currently usable
            depSkill.wouldSetupState(currentValue, candidate.term, candidate.isSubtraction)
        )
      )

      if (setupCandidates.length > 0) {
        return setupCandidates[Math.floor(Math.random() * setupCandidates.length)]
      }

      // Step 4c: No single term can complete the setup.
      // Find candidates that PROGRESS toward the setup state (multi-term setup).
      // E.g., for heavenBeadSubtraction, prefer terms that increase ones digit toward 5+
      const progressCandidates = candidates.filter((candidate) =>
        stateDependentTargets.some(
          (depSkill) =>
            !depSkill.canUse(currentValue) && // Not currently usable
            movesTowardSetup(depSkill, currentValue, candidate.term, candidate.isSubtraction)
        )
      )

      if (progressCandidates.length > 0) {
        return progressCandidates[Math.floor(Math.random() * progressCandidates.length)]
      }
    }
  }

  // Step 5: Return random valid candidate
  return candidates[Math.floor(Math.random() * candidates.length)]
}

/**
 * Generates an explanation for how to solve the sequential problem (addition and/or subtraction)
 */
function generateSequentialExplanation(terms: number[], sum: number, skills: string[]): string {
  const explanations: string[] = []

  // Check if problem has mixed operations
  const hasSubtraction = terms.some((t) => t < 0)

  // Create vertical display format for explanation
  const verticalDisplay = `${terms.map((term) => `  ${term >= 0 ? '+' : ''}${term}`).join('\n')}\n---\n  ${sum}`

  const actionWord = hasSubtraction ? 'computing' : 'adding'
  explanations.push(
    `Calculate this problem by ${actionWord} each number in sequence:\n${verticalDisplay}`
  )

  // Skill-specific explanations - Addition
  if (skills.includes('basic.directAddition')) {
    explanations.push('Use direct addition for numbers 1-4.')
  }

  if (skills.includes('basic.heavenBead')) {
    explanations.push('Use the heaven bead when working with 5 or making totals involving 5.')
  }

  if (skills.includes('basic.simpleCombinations')) {
    explanations.push('Use combinations of heaven and earth beads for 6-9.')
  }

  if (skills.some((skill) => skill.startsWith('fiveComplements.'))) {
    const complements = skills.filter((skill) => skill.startsWith('fiveComplements.'))
    explanations.push(
      `Apply five complements (addition): ${complements.map((s) => s.split('.')[1]).join(', ')}.`
    )
  }

  if (skills.some((skill) => skill.startsWith('tenComplements.'))) {
    const complements = skills.filter((skill) => skill.startsWith('tenComplements.'))
    explanations.push(
      `Apply ten complements (addition): ${complements.map((s) => s.split('.')[1]).join(', ')}.`
    )
  }

  // Skill-specific explanations - Subtraction
  if (skills.includes('basic.directSubtraction')) {
    explanations.push('Use direct subtraction for numbers 1-4.')
  }

  if (skills.includes('basic.heavenBeadSubtraction')) {
    explanations.push('Remove the heaven bead when subtracting 5.')
  }

  if (skills.includes('basic.simpleCombinationsSub')) {
    explanations.push('Use subtraction combinations for 6-9.')
  }

  if (skills.some((skill) => skill.startsWith('fiveComplementsSub.'))) {
    const complements = skills.filter((skill) => skill.startsWith('fiveComplementsSub.'))
    explanations.push(
      `Apply five complements (subtraction): ${complements.map((s) => s.split('.')[1]).join(', ')}.`
    )
  }

  if (skills.some((skill) => skill.startsWith('tenComplementsSub.'))) {
    const complements = skills.filter((skill) => skill.startsWith('tenComplementsSub.'))
    explanations.push(
      `Apply ten complements (subtraction/borrowing): ${complements.map((s) => s.split('.')[1]).join(', ')}.`
    )
  }

  // Advanced skill explanations
  if (skills.includes('advanced.cascadingCarry')) {
    explanations.push(
      'This problem involves cascading carry (carry propagates across 2+ place values).'
    )
  }

  if (skills.includes('advanced.cascadingBorrow')) {
    explanations.push(
      'This problem involves cascading borrow (borrow propagates across 2+ place values).'
    )
  }

  return explanations.join(' ')
}

/**
 * Creates a unique signature for a problem to detect duplicates
 */
function getProblemSignature(terms: number[]): string {
  return terms.join('-')
}

/**
 * Checks if a problem is a duplicate of any existing problems
 */
function isDuplicateProblem(
  problem: GeneratedProblem,
  existingProblems: GeneratedProblem[]
): boolean {
  const signature = getProblemSignature(problem.terms)
  return existingProblems.some((existing) => getProblemSignature(existing.terms) === signature)
}

/**
 * Generates multiple unique problems for a practice step
 */
export function generateProblems(practiceStep: PracticeStep): GeneratedProblem[] {
  const constraints: ProblemConstraints = {
    numberRange: practiceStep.numberRange || { min: 1, max: 9 },
    maxSum: practiceStep.sumConstraints?.maxSum,
    minSum: practiceStep.sumConstraints?.minSum,
    maxTerms: practiceStep.maxTerms,
    problemCount: practiceStep.problemCount,
  }

  const problems: GeneratedProblem[] = []
  const problemSignatures = new Set<string>()
  const maxAttempts = practiceStep.problemCount * 50 // Increased attempts for better uniqueness
  let attempts = 0
  let consecutiveFailures = 0

  while (problems.length < practiceStep.problemCount && attempts < maxAttempts) {
    attempts++

    const problem = generateSingleProblem(
      constraints,
      practiceStep.allowedSkills,
      practiceStep.targetSkills,
      practiceStep.forbiddenSkills,
      150 // More attempts per problem for uniqueness
    )

    if (problem) {
      const signature = getProblemSignature(problem.terms)

      // Check for duplicates using both the signature set and existing problems
      if (!problemSignatures.has(signature) && !isDuplicateProblem(problem, problems)) {
        problems.push(problem)
        problemSignatures.add(signature)
        consecutiveFailures = 0
      } else {
        consecutiveFailures++

        // If we're getting too many duplicates, the constraints might be too restrictive
        if (consecutiveFailures > practiceStep.problemCount * 5) {
          console.warn('Too many duplicate problems generated. Constraints may be too restrictive.')
          break
        }
      }
    } else {
      consecutiveFailures++
    }
  }

  // If we couldn't generate enough unique problems, fill with fallback problems
  // but ensure even fallbacks are unique
  let fallbackIndex = 0
  const maxFallbackIterations = practiceStep.problemCount * 10
  let fallbackIterations = 0
  while (
    problems.length < practiceStep.problemCount &&
    fallbackIterations < maxFallbackIterations
  ) {
    fallbackIterations++
    let fallbackProblem
    let fallbackAttempts = 0

    do {
      fallbackProblem = generateFallbackProblem(constraints, fallbackIndex++)
      fallbackAttempts++
    } while (fallbackAttempts < 20 && isDuplicateProblem(fallbackProblem, problems))

    // Only add if it's unique or we've exhausted attempts
    if (!isDuplicateProblem(fallbackProblem, problems)) {
      problems.push(fallbackProblem)
      problemSignatures.add(getProblemSignature(fallbackProblem.terms))
    } else {
      // Last resort: modify the last term slightly to create uniqueness
      const modifiedProblem = createModifiedUniqueProblem(fallbackProblem, problems, constraints)
      if (modifiedProblem) {
        problems.push(modifiedProblem)
        problemSignatures.add(getProblemSignature(modifiedProblem.terms))
      }
    }
  }

  return problems
}

/**
 * Generates a simple fallback problem when constraints are too restrictive
 */
function generateFallbackProblem(constraints: ProblemConstraints, index: number): GeneratedProblem {
  const { min, max } = constraints.numberRange
  const termCount = 3 // Generate 3-term problems as fallback

  // Use the seed index to create variation
  const seed = index * 7 + 3 // Prime numbers for better distribution

  const terms: number[] = []
  for (let i = 0; i < termCount; i++) {
    // Create pseudo-random but deterministic terms based on index
    const term = ((seed + i * 5) % (max - min + 1)) + min
    terms.push(Math.max(min, Math.min(max, term)))
  }

  const sum = terms.reduce((acc, term) => acc + term, 0)

  return {
    id: `fallback_${index}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    terms,
    answer: sum,
    skillsUsed: ['basic.directAddition'],
    difficulty: 'easy',
    explanation: generateSequentialExplanation(terms, sum, ['basic.directAddition']),
  }
}

/**
 * Creates a modified version of a problem to ensure uniqueness
 */
function createModifiedUniqueProblem(
  baseProblem: GeneratedProblem,
  existingProblems: GeneratedProblem[],
  constraints: ProblemConstraints
): GeneratedProblem | null {
  const { min, max } = constraints.numberRange

  // Try modifying the last term to create uniqueness
  for (let modifier = 1; modifier <= 3; modifier++) {
    for (const direction of [1, -1]) {
      const newTerms = [...baseProblem.terms]
      const lastIndex = newTerms.length - 1
      const newLastTerm = newTerms[lastIndex] + modifier * direction

      // Check if the new term is within constraints
      if (newLastTerm >= min && newLastTerm <= max) {
        newTerms[lastIndex] = newLastTerm
        const newSum = newTerms.reduce((acc, term) => acc + term, 0)

        // Check sum constraints
        if (
          (!constraints.maxSum || newSum <= constraints.maxSum) &&
          (!constraints.minSum || newSum >= constraints.minSum)
        ) {
          const modifiedProblem: GeneratedProblem = {
            id: `modified_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            terms: newTerms,
            answer: newSum,
            skillsUsed: baseProblem.skillsUsed,
            difficulty: baseProblem.difficulty,
            explanation: generateSequentialExplanation(newTerms, newSum, baseProblem.skillsUsed),
          }

          // Check if this modification creates a unique problem
          if (!isDuplicateProblem(modifiedProblem, existingProblems)) {
            return modifiedProblem
          }
        }
      }
    }
  }

  return null // Could not create a unique modification
}

/**
 * Validates that a practice step configuration can generate problems
 */
export function validatePracticeStepConfiguration(practiceStep: PracticeStep): {
  isValid: boolean
  warnings: string[]
  suggestions: string[]
} {
  const warnings: string[] = []
  const suggestions: string[] = []

  // Check if any allowed skills are enabled
  const hasAnyAllowedSkill =
    Object.values(practiceStep.allowedSkills.basic).some(Boolean) ||
    Object.values(practiceStep.allowedSkills.fiveComplements).some(Boolean) ||
    Object.values(practiceStep.allowedSkills.tenComplements).some(Boolean)

  if (!hasAnyAllowedSkill) {
    warnings.push('No skills are enabled. Problems may be very basic.')
    suggestions.push('Enable at least one skill in the "Allowed Skills" section.')
  }

  // Check number range vs sum constraints
  const maxPossibleSum = practiceStep.numberRange?.max
    ? practiceStep.numberRange.max * practiceStep.maxTerms
    : 9 * practiceStep.maxTerms

  if (practiceStep.sumConstraints?.maxSum && practiceStep.sumConstraints.maxSum > maxPossibleSum) {
    warnings.push('Maximum sum constraint is higher than what the number range allows.')
    suggestions.push('Either increase the number range maximum or decrease the sum constraint.')
  }

  // Check if constraints are too restrictive
  if (practiceStep.sumConstraints?.maxSum && practiceStep.sumConstraints.maxSum < 5) {
    warnings.push('Very low sum constraint may limit problem variety.')
    suggestions.push('Consider increasing the maximum sum to allow more diverse problems.')
  }

  // Check problem count
  if (practiceStep.problemCount > 20) {
    warnings.push('High problem count may take a long time to generate and complete.')
    suggestions.push('Consider reducing the problem count for better user experience.')
  }

  return {
    isValid: warnings.length === 0,
    warnings,
    suggestions,
  }
}
