/**
 * Validate that worksheet configuration has enough problem space to avoid excessive duplicates
 */

export interface ProblemSpaceValidation {
  isValid: boolean
  warnings: string[]
  estimatedUniqueProblems: number
  requestedProblems: number
  duplicateRisk: 'none' | 'low' | 'medium' | 'high' | 'extreme'
}

/**
 * Estimate the maximum unique problems possible given constraints
 */
function estimateUniqueProblemSpace(
  digitRange: { min: number; max: number },
  pAnyRegroup: number,
  operator: 'addition' | 'subtraction'
): number {
  const { min: minDigits, max: maxDigits } = digitRange

  // Calculate approximate number space for each digit count
  let totalSpace = 0
  for (let digits = minDigits; digits <= maxDigits; digits++) {
    // For N-digit numbers: 9 * 10^(N-1) possibilities (e.g., 2-digit = 90 numbers from 10-99)
    const numbersPerDigitCount = digits === 1 ? 9 : 9 * Math.pow(10, digits - 1)

    if (operator === 'addition') {
      // Addition: a + b where both are in the digit range
      // Rough estimate: numbersPerDigitCount^2 / 2 (since a+b = b+a, but we count both)
      // Then filter by regrouping probability
      const pairsForDigits = numbersPerDigitCount * numbersPerDigitCount

      // If pAnyRegroup is high, only a fraction of pairs will work
      // Regrouping is more common with larger digits, so this is approximate
      const regroupFactor = pAnyRegroup > 0.8 ? 0.3 : pAnyRegroup > 0.5 ? 0.5 : 0.7

      totalSpace += pairsForDigits * regroupFactor
    } else {
      // Subtraction: minuend - subtrahend where minuend > subtrahend
      // About half the pairs (where minuend > subtrahend)
      const pairsForDigits = (numbersPerDigitCount * numbersPerDigitCount) / 2

      // Borrowing constraints reduce space similarly
      const borrowFactor = pAnyRegroup > 0.8 ? 0.3 : pAnyRegroup > 0.5 ? 0.5 : 0.7

      totalSpace += pairsForDigits * borrowFactor
    }
  }

  return Math.floor(totalSpace)
}

/**
 * Validate worksheet configuration for duplicate risk
 * Returns warnings if configuration will likely produce many duplicates
 */
export function validateProblemSpace(
  problemsPerPage: number,
  pages: number,
  digitRange: { min: number; max: number },
  pAnyStart: number,
  operator: 'addition' | 'subtraction' | 'mixed'
): ProblemSpaceValidation {
  const requestedProblems = problemsPerPage * pages
  const warnings: string[] = []

  // For mixed mode, assume half of each
  let estimatedSpace: number
  if (operator === 'mixed') {
    const addSpace = estimateUniqueProblemSpace(digitRange, pAnyStart, 'addition')
    const subSpace = estimateUniqueProblemSpace(digitRange, pAnyStart, 'subtraction')
    estimatedSpace = addSpace + subSpace
  } else {
    estimatedSpace = estimateUniqueProblemSpace(digitRange, pAnyStart, operator)
  }

  // Calculate duplicate risk
  const ratio = requestedProblems / estimatedSpace
  let duplicateRisk: 'none' | 'low' | 'medium' | 'high' | 'extreme'

  if (ratio < 0.3) {
    duplicateRisk = 'none'
  } else if (ratio < 0.5) {
    duplicateRisk = 'low'
    warnings.push(
      `You're requesting ${requestedProblems} problems, but only ~${Math.floor(estimatedSpace)} unique problems are possible with these constraints. Some duplicates may occur.`
    )
  } else if (ratio < 0.8) {
    duplicateRisk = 'medium'
    warnings.push(
      `Warning: Only ~${Math.floor(estimatedSpace)} unique problems possible, but you're requesting ${requestedProblems}. Expect moderate duplicates.`
    )
    warnings.push(
      `Suggestion: Reduce pages to ${Math.floor(estimatedSpace * 0.5 / problemsPerPage)} or increase digit range to ${digitRange.max + 1}`
    )
  } else if (ratio < 1.5) {
    duplicateRisk = 'high'
    warnings.push(
      `High duplicate risk! Only ~${Math.floor(estimatedSpace)} unique problems possible for ${requestedProblems} requested.`
    )
    warnings.push(
      `Recommendations:\n` +
        `  • Reduce to ${Math.floor(estimatedSpace * 0.5 / problemsPerPage)} pages (50% of available space)\n` +
        `  • Increase digit range to ${digitRange.max + 1}-${digitRange.max + 1}\n` +
        `  • Lower regrouping probability from ${Math.round(pAnyStart * 100)}% to 50%`
    )
  } else {
    duplicateRisk = 'extreme'
    warnings.push(
      `Extreme duplicate risk! Requesting ${requestedProblems} problems but only ~${Math.floor(estimatedSpace)} unique problems exist.`
    )
    warnings.push(
      `This configuration will produce mostly duplicate problems.`
    )
    warnings.push(
      `Strong recommendations:\n` +
        `  • Reduce to ${Math.floor(estimatedSpace * 0.5 / problemsPerPage)} pages maximum\n` +
        `  • OR increase digit range from ${digitRange.min}-${digitRange.max} to ${digitRange.min}-${digitRange.max + 1}\n` +
        `  • OR reduce regrouping requirement from ${Math.round(pAnyStart * 100)}%`
    )
  }

  // Special case: single digit with high regrouping is extremely constrained
  if (digitRange.min === 1 && digitRange.max === 1 && pAnyStart > 0.8 && requestedProblems > 50) {
    warnings.unshift(
      `Single-digit problems (1-9) with ${Math.round(pAnyStart * 100)}% regrouping have very few unique combinations!`
    )
  }

  return {
    isValid: duplicateRisk !== 'extreme',
    warnings,
    estimatedUniqueProblems: Math.floor(estimatedSpace),
    requestedProblems,
    duplicateRisk,
  }
}

/**
 * Format validation result for display to user
 */
export function formatValidationWarnings(validation: ProblemSpaceValidation): string {
  if (validation.warnings.length === 0) {
    return ''
  }

  return validation.warnings.join('\n\n')
}
