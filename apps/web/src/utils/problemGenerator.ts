import type { GenerationTrace, GenerationTraceStep } from '@/db/schema/session-plans'
import type { PracticeStep, SkillSet } from '../types/tutorial'
import type { SkillCostCalculator } from './skillComplexity'
import {
  extractSkillsFromProblem,
  extractSkillsFromSequence,
  flattenProblemSkills,
} from './skillExtraction'
import { generateUnifiedInstructionSequence } from './unifiedStepGenerator'

// Re-export trace types for consumers that import from this file
export type { GenerationTrace, GenerationTraceStep }

export interface GeneratedProblem {
  id: string
  terms: number[]
  answer: number
  requiredSkills: string[]
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
 * Checks if a problem matches the required skills
 */
export function problemMatchesSkills(
  problem: GeneratedProblem,
  requiredSkills: SkillSet,
  targetSkills?: Partial<SkillSet>,
  forbiddenSkills?: Partial<SkillSet>
): boolean {
  // Check required skills - problem must use at least one enabled required skill
  const hasRequiredSkill = problem.requiredSkills.some((skillPath) =>
    isSkillEnabled(skillPath, requiredSkills)
  )

  if (!hasRequiredSkill) return false

  // Check forbidden skills - problem must not use any forbidden skills
  if (forbiddenSkills) {
    const usesForbiddenSkill = problem.requiredSkills.some((skillPath) =>
      isSkillEnabled(skillPath, forbiddenSkills)
    )

    if (usesForbiddenSkill) return false
  }

  // Check target skills - if specified, problem should use at least one target skill
  if (targetSkills) {
    const hasTargetSkill = problem.requiredSkills.some((skillPath) =>
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
  requiredSkills: SkillSet
  targetSkills?: Partial<SkillSet>
  forbiddenSkills?: Partial<SkillSet>
  /** Student-aware cost calculator for budget enforcement */
  costCalculator?: SkillCostCalculator
  /** Number of attempts before giving up (default: 100) */
  attempts?: number
}

/**
 * Generates a single sequential addition problem that matches the given constraints and skills
 */
export function generateSingleProblem(
  constraintsOrOptions: ProblemConstraints | GenerateProblemOptions,
  requiredSkills?: SkillSet,
  targetSkills?: Partial<SkillSet>,
  forbiddenSkills?: Partial<SkillSet>,
  attempts: number = 100
): GeneratedProblem | null {
  // Support both old and new API
  let constraints: ProblemConstraints
  let _requiredSkills: SkillSet
  let _targetSkills: Partial<SkillSet> | undefined
  let _forbiddenSkills: Partial<SkillSet> | undefined
  let _attempts: number
  let costCalculator: SkillCostCalculator | undefined

  if ('constraints' in constraintsOrOptions) {
    // New options-based API
    constraints = constraintsOrOptions.constraints
    _requiredSkills = constraintsOrOptions.requiredSkills
    _targetSkills = constraintsOrOptions.targetSkills
    _forbiddenSkills = constraintsOrOptions.forbiddenSkills
    _attempts = constraintsOrOptions.attempts ?? 100
    costCalculator = constraintsOrOptions.costCalculator
  } else {
    // Old positional API (backward compatibility)
    constraints = constraintsOrOptions
    _requiredSkills = requiredSkills!
    _targetSkills = targetSkills
    _forbiddenSkills = forbiddenSkills
    _attempts = attempts
  }

  for (let attempt = 0; attempt < _attempts; attempt++) {
    // Generate random number of terms within the specified range
    const minTerms = constraints.minTerms ?? 3
    const maxTerms = constraints.maxTerms
    const termCount = Math.floor(Math.random() * (maxTerms - minTerms + 1)) + minTerms

    // Generate the sequence of numbers to add (now returns trace with provenance)
    const sequenceResult = generateSequence(
      constraints,
      termCount,
      _requiredSkills,
      _targetSkills,
      _forbiddenSkills,
      costCalculator
    )

    if (!sequenceResult) continue // Failed to generate valid sequence

    const { terms, trace } = sequenceResult
    const sum = trace.answer

    // Check sum constraints
    if (constraints.maxSum && sum > constraints.maxSum) continue
    if (constraints.minSum && sum < constraints.minSum) continue

    // Use skills from the trace (provenance from the generator itself)
    const problemSkills = trace.allSkills

    // Determine difficulty based on skills required
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
      requiredSkills: problemSkills,
      difficulty,
      explanation: generateSequentialExplanation(terms, sum, problemSkills),
      generationTrace: trace, // Include provenance trace
    }

    // Check if problem matches skill requirements
    if (problemMatchesSkills(problem, _requiredSkills, _targetSkills, _forbiddenSkills)) {
      return problem
    }
  }

  return null // Failed to generate a suitable problem
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
  requiredSkills: SkillSet,
  targetSkills?: Partial<SkillSet>,
  forbiddenSkills?: Partial<SkillSet>,
  costCalculator?: SkillCostCalculator
): SequenceResult | null {
  const terms: number[] = []
  const steps: GenerationTraceStep[] = []
  let currentValue = 0

  // Check if we can use subtraction
  const canSubtract = hasSubtractionSkills(requiredSkills)

  // Track previous term for no-immediate-inverse rule
  let previousTerm: PreviousTerm | undefined

  for (let i = 0; i < termCount; i++) {
    // Try to find a valid next term (returns term + skills it computed)
    // For first term, always add (can't subtract from 0)
    const allowSubtraction = canSubtract && i > 0 && currentValue > 0
    const result = findValidNextTermWithTrace(
      currentValue,
      constraints,
      requiredSkills,
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
  const totalComplexityCost = steps.reduce((sum, step) => sum + (step.complexityCost ?? 0), 0)

  return {
    terms,
    trace: {
      terms,
      answer: currentValue,
      steps,
      allSkills: [...new Set(steps.flatMap((s) => s.skillsUsed))],
      budgetConstraint: constraints.maxComplexityBudgetPerTerm,
      minBudgetConstraint: constraints.minComplexityBudgetPerTerm,
      totalComplexityCost: totalComplexityCost > 0 ? totalComplexityCost : undefined,
    },
  }
}

/** Info about the previous term for inverse checking */
interface PreviousTerm {
  term: number
  isSubtraction: boolean
}

/** Result from findValidNextTermWithTrace */
interface TermWithSkills {
  term: number
  skillsUsed: string[]
  isSubtraction: boolean
  /** Complexity cost (if calculator was provided) */
  complexityCost?: number
}

/**
 * Finds a valid next term in the sequence and returns both the term and
 * the skills that were computed for it (provenance).
 * Supports both addition and subtraction operations.
 */
function findValidNextTermWithTrace(
  currentValue: number,
  constraints: ProblemConstraints,
  requiredSkills: SkillSet,
  targetSkills?: Partial<SkillSet>,
  forbiddenSkills?: Partial<SkillSet>,
  isLastTerm: boolean = false,
  allowSubtraction: boolean = false,
  costCalculator?: SkillCostCalculator,
  previousTerm?: PreviousTerm
): TermWithSkills | null {
  const { min, max } = constraints.numberRange
  const candidates: TermWithSkills[] = []
  const maxBudget = constraints.maxComplexityBudgetPerTerm
  const minBudget = constraints.minComplexityBudgetPerTerm

  // Try each possible ADDITION term value
  for (let term = min; term <= max; term++) {
    const newValue = currentValue + term

    // Check if this addition step is valid - THIS is the provenance computation
    const stepSkills = analyzeStepSkills(currentValue, term, newValue)

    // Check if the step uses only allowed skills (and no forbidden skills)
    const usesValidSkills = stepSkills.every((skillPath) => {
      // Must use only required skills
      if (!isSkillEnabled(skillPath, requiredSkills)) return false

      // Must not use forbidden skills
      if (forbiddenSkills && isSkillEnabled(skillPath, forbiddenSkills)) return false

      return true
    })

    if (!usesValidSkills) continue

    // Calculate complexity cost (if calculator provided)
    const termCost = costCalculator ? costCalculator.calculateTermCost(stepSkills) : undefined

    // Check complexity budget (if calculator and budget are provided)
    if (termCost !== undefined) {
      if (maxBudget !== undefined && termCost > maxBudget) continue // Skip - too complex for this student
      // Skip min budget check for first term (starting from 0) - basic skills always have cost 0
      // and we can't avoid using basic skills when adding to 0
      if (minBudget !== undefined && currentValue > 0 && termCost < minBudget) continue // Skip - too easy for this purpose
    }

    candidates.push({
      term,
      skillsUsed: stepSkills,
      isSubtraction: false,
      complexityCost: termCost,
    })
  }

  // Try each possible SUBTRACTION term value (if allowed)
  if (allowSubtraction) {
    for (let term = min; term <= max; term++) {
      const newValue = currentValue - term

      // Skip if result would be negative
      if (newValue < 0) continue

      // Check if this subtraction step is valid - use negative term for subtraction
      const stepSkills = analyzeStepSkills(currentValue, -term, newValue)

      // Check if the step uses only allowed skills (and no forbidden skills)
      const usesValidSkills = stepSkills.every((skillPath) => {
        // Must use only required skills
        if (!isSkillEnabled(skillPath, requiredSkills)) return false

        // Must not use forbidden skills
        if (forbiddenSkills && isSkillEnabled(skillPath, forbiddenSkills)) return false

        return true
      })

      if (!usesValidSkills) continue

      // Calculate complexity cost (if calculator provided)
      const termCost = costCalculator ? costCalculator.calculateTermCost(stepSkills) : undefined

      // Check complexity budget (if calculator and budget are provided)
      if (termCost !== undefined) {
        if (maxBudget !== undefined && termCost > maxBudget) continue // Skip - too complex for this student
        // Note: subtraction is only allowed when currentValue > 0, but apply same pattern for consistency
        if (minBudget !== undefined && currentValue > 0 && termCost < minBudget) continue // Skip - too easy for this purpose
      }

      candidates.push({
        term,
        skillsUsed: stepSkills,
        isSubtraction: true,
        complexityCost: termCost,
      })
    }
  }

  // Filter out immediate inverses of the previous term
  // e.g., if previous was +5, don't allow -5; if previous was -3, don't allow +3
  if (previousTerm) {
    const filteredCandidates = candidates.filter((candidate) => {
      // Check if this candidate is the exact inverse of the previous term
      if (
        candidate.term === previousTerm.term &&
        candidate.isSubtraction !== previousTerm.isSubtraction
      ) {
        return false // Skip: this would undo what we just did
      }
      return true
    })

    // Only use filtered list if it's not empty (fallback to original if all were filtered)
    if (filteredCandidates.length > 0) {
      candidates.length = 0
      candidates.push(...filteredCandidates)
    }
  }

  if (candidates.length === 0) return null

  // If we have target skills and this is not the last term, try to pick a term that uses target skills
  if (targetSkills && !isLastTerm) {
    const targetCandidates = candidates.filter((candidate) =>
      candidate.skillsUsed.some((skillPath) => isSkillEnabled(skillPath, targetSkills))
    )

    if (targetCandidates.length > 0) {
      return targetCandidates[Math.floor(Math.random() * targetCandidates.length)]
    }
  }

  // Return random valid candidate
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
      practiceStep.requiredSkills,
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
  while (problems.length < practiceStep.problemCount) {
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
    requiredSkills: ['basic.directAddition'],
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
            requiredSkills: baseProblem.requiredSkills,
            difficulty: baseProblem.difficulty,
            explanation: generateSequentialExplanation(
              newTerms,
              newSum,
              baseProblem.requiredSkills
            ),
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

  // Check if any required skills are enabled
  const hasAnyRequiredSkill =
    Object.values(practiceStep.requiredSkills.basic).some(Boolean) ||
    Object.values(practiceStep.requiredSkills.fiveComplements).some(Boolean) ||
    Object.values(practiceStep.requiredSkills.tenComplements).some(Boolean)

  if (!hasAnyRequiredSkill) {
    warnings.push('No required skills are enabled. Problems may be very basic.')
    suggestions.push('Enable at least one skill in the "Required Skills" section.')
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
