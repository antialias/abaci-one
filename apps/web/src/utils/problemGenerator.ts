import type { PracticeStep, SkillSet } from '../types/tutorial'

export interface GeneratedProblem {
  id: string
  terms: number[]
  answer: number
  requiredSkills: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  explanation?: string
}

export interface ProblemConstraints {
  numberRange: { min: number; max: number }
  maxSum?: number
  minSum?: number
  maxTerms: number
  problemCount: number
}

/**
 * Analyzes which skills are required during the sequential addition process
 * This simulates adding each term one by one to the abacus
 */
export function analyzeRequiredSkills(terms: number[], _finalSum: number): string[] {
  const skills: string[] = []
  let currentValue = 0

  // Simulate adding each term sequentially
  for (const term of terms) {
    const newValue = currentValue + term
    const requiredSkillsForStep = analyzeStepSkills(currentValue, term, newValue)
    skills.push(...requiredSkillsForStep)
    currentValue = newValue
  }

  return [...new Set(skills)] // Remove duplicates
}

/**
 * Analyzes skills needed for a single addition step: currentValue + term = newValue
 */
function analyzeStepSkills(currentValue: number, term: number, newValue: number): string[] {
  const skills: string[] = []

  // Work column by column from right to left
  const currentDigits = getDigits(currentValue)
  const termDigits = getDigits(term)
  const newDigits = getDigits(newValue)

  const maxColumns = Math.max(currentDigits.length, termDigits.length, newDigits.length)

  for (let column = 0; column < maxColumns; column++) {
    const currentDigit = currentDigits[column] || 0
    const termDigit = termDigits[column] || 0
    const newDigit = newDigits[column] || 0

    if (termDigit === 0) continue // No addition in this column

    // Analyze what happens in this column
    const columnSkills = analyzeColumnAddition(currentDigit, termDigit, newDigit, column)
    skills.push(...columnSkills)
  }

  return skills
}

/**
 * Analyzes skills needed for addition in a single column
 */
function analyzeColumnAddition(
  currentDigit: number,
  termDigit: number,
  _resultDigit: number,
  _column: number
): string[] {
  const skills: string[] = []

  // Direct addition (1-4)
  if (termDigit >= 1 && termDigit <= 4) {
    if (currentDigit + termDigit <= 4) {
      skills.push('basic.directAddition')
    } else if (currentDigit + termDigit === 5) {
      // Adding to make exactly 5 - could be direct or complement
      if (currentDigit === 0) {
        skills.push('basic.heavenBead') // Direct 5
      } else {
        // Five complement: need to use 5 - complement
        skills.push(`fiveComplements.${termDigit}=5-${5 - termDigit}`)
        skills.push('basic.heavenBead')
      }
    } else if (currentDigit + termDigit > 5 && currentDigit + termDigit <= 9) {
      // Results in 6-9: use five complement + simple combination
      skills.push(`fiveComplements.${termDigit}=5-${5 - termDigit}`)
      skills.push('basic.heavenBead')
      skills.push('basic.simpleCombinations')
    } else if (currentDigit + termDigit >= 10) {
      // Ten complement needed
      const complement = 10 - termDigit
      skills.push(`tenComplements.${termDigit}=10-${complement}`)
    }
  }

  // Direct heaven bead (5)
  else if (termDigit === 5) {
    if (currentDigit === 0) {
      skills.push('basic.heavenBead')
    } else if (currentDigit + 5 <= 9) {
      skills.push('basic.heavenBead')
      skills.push('basic.simpleCombinations')
    } else {
      // Ten complement
      skills.push(`tenComplements.5=10-5`)
    }
  }

  // Simple combinations (6-9)
  else if (termDigit >= 6 && termDigit <= 9) {
    if (currentDigit === 0) {
      skills.push('basic.heavenBead')
      skills.push('basic.simpleCombinations')
    } else if (currentDigit + termDigit <= 9) {
      skills.push('basic.heavenBead')
      skills.push('basic.simpleCombinations')
    } else {
      // Ten complement
      const complement = 10 - termDigit
      skills.push(`tenComplements.${termDigit}=10-${complement}`)
    }
  }

  return skills
}

/**
 * Analyzes skills needed for subtraction in a single column
 *
 * Subtraction techniques on soroban:
 * 1. Direct subtraction: Remove earth beads directly (when currentDigit >= termDigit)
 * 2. Five complement: -n = -5+(5-n), e.g., -4 = -5+1 (when need to use heaven bead)
 * 3. Ten complement: -n = +(10-n)-10, e.g., -9 = +1-10 (when need to borrow from next column)
 * 4. Combined: Need both five and ten complements for some cases
 *
 * @param currentDigit - Current value in this column (0-9)
 * @param termDigit - Amount to subtract (1-9)
 * @param needsBorrow - Whether this subtraction requires borrowing from the next column
 * @returns Array of skill strings required for this operation
 */
export function analyzeColumnSubtraction(
  currentDigit: number,
  termDigit: number,
  needsBorrow: boolean
): string[] {
  const skills: string[] = []

  // Case 1: Direct subtraction possible (no borrow needed)
  if (!needsBorrow && currentDigit >= termDigit) {
    if (termDigit >= 1 && termDigit <= 4) {
      // Check if we can subtract directly from earth beads
      const earthBeads = currentDigit % 5 // 0-4
      if (earthBeads >= termDigit) {
        skills.push('basic.directSubtraction')
      } else {
        // Need to use five complement: -n = -5+(5-n)
        // Example: 7-4=3 → have 5+2, subtract 5 add 1 → 3
        const fiveComplement = 5 - termDigit
        skills.push(`fiveComplementsSub.-${termDigit}=-5+${fiveComplement}`)
        skills.push('basic.heavenBeadSubtraction')
      }
    } else if (termDigit === 5) {
      // Direct heaven bead removal
      if (currentDigit >= 5) {
        skills.push('basic.heavenBeadSubtraction')
      }
      // If currentDigit < 5, this shouldn't happen without borrowing
    } else if (termDigit >= 6 && termDigit <= 9) {
      // Subtracting 6-9 directly (when currentDigit >= termDigit)
      // Need to remove heaven bead and some earth beads
      skills.push('basic.heavenBeadSubtraction')
      skills.push('basic.simpleCombinationsSub')
    }
  }

  // Case 2: Borrowing required (currentDigit < termDigit)
  else if (needsBorrow) {
    // Ten complement for subtraction: -n = +(10-n)-10
    const tenComplement = 10 - termDigit

    // Check if adding the ten complement requires a five complement
    // We're adding (10-termDigit) to currentDigit
    const afterAddition = currentDigit + tenComplement

    if (tenComplement >= 1 && tenComplement <= 4) {
      // Adding 1-4 to currentDigit
      if (currentDigit + tenComplement <= 4) {
        // Direct addition of complement
        skills.push(`tenComplementsSub.-${termDigit}=+${tenComplement}-10`)
      } else if (currentDigit + tenComplement >= 5 && afterAddition <= 9) {
        // Adding complement crosses 5 boundary - need five complement for the addition part
        // Combined technique: use five complement to add the ten complement
        skills.push(`tenComplementsSub.-${termDigit}=+${tenComplement}-10`)
        skills.push(`fiveComplements.${tenComplement}=5-${5 - tenComplement}`)
      } else {
        // Simple ten complement
        skills.push(`tenComplementsSub.-${termDigit}=+${tenComplement}-10`)
      }
    } else if (tenComplement === 5) {
      // -5 = +5-10
      skills.push(`tenComplementsSub.-5=+5-10`)
      skills.push('basic.heavenBead')
    } else if (tenComplement >= 6 && tenComplement <= 9) {
      // Adding 6-9 as the complement
      skills.push(`tenComplementsSub.-${termDigit}=+${tenComplement}-10`)
      skills.push('basic.heavenBead')
      skills.push('basic.simpleCombinations')
    }
  }

  return skills
}

/**
 * Analyzes skills needed for a single subtraction step: currentValue - term = newValue
 * Works column by column from right to left, tracking borrows
 */
export function analyzeSubtractionStepSkills(
  currentValue: number,
  term: number,
  newValue: number
): string[] {
  const skills: string[] = []

  const currentDigits = getDigits(currentValue)
  const termDigits = getDigits(term)
  const newDigits = getDigits(newValue)

  const maxColumns = Math.max(currentDigits.length, termDigits.length, newDigits.length)

  // Track borrows as we work from right to left
  let pendingBorrow = false

  for (let column = 0; column < maxColumns; column++) {
    let currentDigit = currentDigits[column] || 0
    const termDigit = termDigits[column] || 0

    // Apply pending borrow from previous column
    if (pendingBorrow) {
      currentDigit -= 1
      pendingBorrow = false
    }

    if (termDigit === 0 && currentDigit >= 0) continue // No subtraction needed

    // Check if we need to borrow for this column
    const needsBorrow = currentDigit < termDigit

    if (needsBorrow) {
      pendingBorrow = true
      // After borrowing, we effectively have currentDigit + 10
    }

    // Analyze skills needed for this column
    const columnSkills = analyzeColumnSubtraction(
      needsBorrow ? currentDigit + 10 : currentDigit,
      termDigit,
      needsBorrow
    )
    skills.push(...columnSkills)
  }

  return [...new Set(skills)] // Remove duplicates
}

/**
 * Converts a number to array of digits (ones, tens, hundreds, etc.)
 */
function getDigits(num: number): number[] {
  if (num === 0) return [0]

  const digits: number[] = []
  while (num > 0) {
    digits.push(num % 10)
    num = Math.floor(num / 10)
  }
  return digits
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
      Object.values(targetSkills.tenComplementsSub || {}).some(Boolean)

    if (hasAnyTargetSkill && !hasTargetSkill) return false
  }

  return true
}

/**
 * Generates a single sequential addition problem that matches the given constraints and skills
 */
export function generateSingleProblem(
  constraints: ProblemConstraints,
  requiredSkills: SkillSet,
  targetSkills?: Partial<SkillSet>,
  forbiddenSkills?: Partial<SkillSet>,
  attempts: number = 100
): GeneratedProblem | null {
  for (let attempt = 0; attempt < attempts; attempt++) {
    // Generate random number of terms (3 to 5 as specified)
    const termCount = Math.floor(Math.random() * 3) + 3 // 3-5 terms

    // Generate the sequence of numbers to add
    const terms = generateSequence(
      constraints,
      termCount,
      requiredSkills,
      targetSkills,
      forbiddenSkills
    )

    if (!terms) continue // Failed to generate valid sequence

    const sum = terms.reduce((acc, term) => acc + term, 0)

    // Check sum constraints
    if (constraints.maxSum && sum > constraints.maxSum) continue
    if (constraints.minSum && sum < constraints.minSum) continue

    // Analyze what skills this sequential addition requires
    const problemSkills = analyzeRequiredSkills(terms, sum)

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
    }

    // Check if problem matches skill requirements
    if (problemMatchesSkills(problem, requiredSkills, targetSkills, forbiddenSkills)) {
      return problem
    }
  }

  return null // Failed to generate a suitable problem
}

/**
 * Generates a sequence of numbers that can be added using only the specified skills
 */
function generateSequence(
  constraints: ProblemConstraints,
  termCount: number,
  requiredSkills: SkillSet,
  targetSkills?: Partial<SkillSet>,
  forbiddenSkills?: Partial<SkillSet>
): number[] | null {
  const terms: number[] = []
  let currentValue = 0

  for (let i = 0; i < termCount; i++) {
    // Try to find a valid next term
    const validTerm = findValidNextTerm(
      currentValue,
      constraints,
      requiredSkills,
      targetSkills,
      forbiddenSkills,
      i === termCount - 1 // isLastTerm
    )

    if (validTerm === null) return null // Couldn't find valid term

    terms.push(validTerm)
    currentValue += validTerm
  }

  return terms
}

/**
 * Finds a valid next term in the sequence
 */
function findValidNextTerm(
  currentValue: number,
  constraints: ProblemConstraints,
  requiredSkills: SkillSet,
  targetSkills?: Partial<SkillSet>,
  forbiddenSkills?: Partial<SkillSet>,
  isLastTerm: boolean = false
): number | null {
  const { min, max } = constraints.numberRange
  const candidates: number[] = []

  // Try each possible term value
  for (let term = min; term <= max; term++) {
    const newValue = currentValue + term

    // Check if this addition step is valid
    const stepSkills = analyzeStepSkills(currentValue, term, newValue)

    // Check if the step uses only allowed skills (and no forbidden skills)
    const usesValidSkills = stepSkills.every((skillPath) => {
      // Must use only required skills
      if (!isSkillEnabled(skillPath, requiredSkills)) return false

      // Must not use forbidden skills
      if (forbiddenSkills && isSkillEnabled(skillPath, forbiddenSkills)) return false

      return true
    })

    if (usesValidSkills) {
      candidates.push(term)
    }
  }

  if (candidates.length === 0) return null

  // If we have target skills and this is not the last term, try to pick a term that uses target skills
  if (targetSkills && !isLastTerm) {
    const targetCandidates = candidates.filter((term) => {
      const newValue = currentValue + term
      const stepSkills = analyzeStepSkills(currentValue, term, newValue)

      return stepSkills.some((skillPath) => isSkillEnabled(skillPath, targetSkills))
    })

    if (targetCandidates.length > 0) {
      return targetCandidates[Math.floor(Math.random() * targetCandidates.length)]
    }
  }

  // Return random valid candidate
  return candidates[Math.floor(Math.random() * candidates.length)]
}

/**
 * Generates an explanation for how to solve the sequential addition problem
 */
function generateSequentialExplanation(terms: number[], sum: number, skills: string[]): string {
  const explanations: string[] = []

  // Create vertical display format for explanation
  const verticalDisplay = `${terms.map((term) => `  ${term}`).join('\n')}\n---\n  ${sum}`

  explanations.push(`Calculate this problem by adding each number in sequence:\n${verticalDisplay}`)

  // Skill-specific explanations
  if (skills.includes('basic.directAddition')) {
    explanations.push('Use direct addition for numbers 1-4.')
  }

  if (skills.includes('basic.heavenBead')) {
    explanations.push('Use the heaven bead when working with 5 or making totals involving 5.')
  }

  if (skills.includes('basic.simpleCombinations')) {
    explanations.push('Use combinations of heaven and earth beads for 6-9.')
  }

  if (skills.some((skill) => skill.startsWith('fiveComplements'))) {
    const complements = skills.filter((skill) => skill.startsWith('fiveComplements'))
    explanations.push(
      `Apply five complements: ${complements.map((s) => s.split('.')[1]).join(', ')}.`
    )
  }

  if (skills.some((skill) => skill.startsWith('tenComplements'))) {
    const complements = skills.filter((skill) => skill.startsWith('tenComplements'))
    explanations.push(
      `Apply ten complements: ${complements.map((s) => s.split('.')[1]).join(', ')}.`
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
