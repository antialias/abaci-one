import type { RelationKind } from '../types'

/**
 * Relation checking engine for Rithmomachia captures.
 * All arithmetic uses BigInt for precision with large values.
 */

export interface RelationCheckResult {
  valid: boolean
  relation?: RelationKind
  explanation?: string
}

/**
 * Check if two values satisfy the EQUAL relation.
 * a == b
 */
export function checkEqual(a: number, b: number): RelationCheckResult {
  if (a === b) {
    return {
      valid: true,
      relation: 'EQUAL',
      explanation: `${a} == ${b}`,
    }
  }
  return { valid: false }
}

/**
 * Check if two values satisfy the MULTIPLE relation.
 * a % b == 0 (a is a multiple of b)
 */
export function checkMultiple(a: number, b: number): RelationCheckResult {
  if (b === 0) return { valid: false }
  if (a % b === 0) {
    return {
      valid: true,
      relation: 'MULTIPLE',
      explanation: `${a} is a multiple of ${b} (${a}÷${b}=${a / b})`,
    }
  }
  return { valid: false }
}

/**
 * Check if two values satisfy the DIVISOR relation.
 * b % a == 0 (a is a divisor of b)
 */
export function checkDivisor(a: number, b: number): RelationCheckResult {
  if (a === 0) return { valid: false }
  if (b % a === 0) {
    return {
      valid: true,
      relation: 'DIVISOR',
      explanation: `${a} divides ${b} (${b}÷${a}=${b / a})`,
    }
  }
  return { valid: false }
}

/**
 * Check if three values satisfy the SUM relation.
 * a + h == b OR b + h == a
 */
export function checkSum(a: number, b: number, h: number): RelationCheckResult {
  if (a + h === b) {
    return {
      valid: true,
      relation: 'SUM',
      explanation: `${a} + ${h} = ${b}`,
    }
  }
  if (b + h === a) {
    return {
      valid: true,
      relation: 'SUM',
      explanation: `${b} + ${h} = ${a}`,
    }
  }
  return { valid: false }
}

/**
 * Check if three values satisfy the DIFF relation.
 * |a - h| == b OR |b - h| == a
 */
export function checkDiff(a: number, b: number, h: number): RelationCheckResult {
  const abs = (x: number) => (x < 0 ? -x : x)

  const diff1 = abs(a - h)
  if (diff1 === b) {
    return {
      valid: true,
      relation: 'DIFF',
      explanation: `|${a} - ${h}| = ${b}`,
    }
  }

  const diff2 = abs(b - h)
  if (diff2 === a) {
    return {
      valid: true,
      relation: 'DIFF',
      explanation: `|${b} - ${h}| = ${a}`,
    }
  }

  return { valid: false }
}

/**
 * Check if three values satisfy the PRODUCT relation.
 * a * h == b OR b * h == a
 */
export function checkProduct(a: number, b: number, h: number): RelationCheckResult {
  if (a * h === b) {
    return {
      valid: true,
      relation: 'PRODUCT',
      explanation: `${a} × ${h} = ${b}`,
    }
  }
  if (b * h === a) {
    return {
      valid: true,
      relation: 'PRODUCT',
      explanation: `${b} × ${h} = ${a}`,
    }
  }
  return { valid: false }
}

/**
 * Check if three values satisfy the RATIO relation.
 * a * r == b OR b * r == a (where r is the helper value)
 * This is similar to PRODUCT but with explicit ratio semantics.
 */
export function checkRatio(a: number, b: number, r: number): RelationCheckResult {
  if (r === 0) return { valid: false }

  if (a * r === b) {
    return {
      valid: true,
      relation: 'RATIO',
      explanation: `${a} × ${r} = ${b}`,
    }
  }
  if (b * r === a) {
    return {
      valid: true,
      relation: 'RATIO',
      explanation: `${b} × ${r} = ${a}`,
    }
  }
  return { valid: false }
}

/**
 * Check if a relation holds between mover and target values.
 * Returns the first valid relation found, or null if none.
 */
export function checkRelation(
  relation: RelationKind,
  moverValue: number,
  targetValue: number,
  helperValue?: number
): RelationCheckResult {
  switch (relation) {
    case 'EQUAL':
      return checkEqual(moverValue, targetValue)

    case 'MULTIPLE':
      return checkMultiple(moverValue, targetValue)

    case 'DIVISOR':
      return checkDivisor(moverValue, targetValue)

    case 'SUM':
      if (helperValue === undefined) {
        return { valid: false, explanation: 'SUM requires a helper' }
      }
      return checkSum(moverValue, targetValue, helperValue)

    case 'DIFF':
      if (helperValue === undefined) {
        return { valid: false, explanation: 'DIFF requires a helper' }
      }
      return checkDiff(moverValue, targetValue, helperValue)

    case 'PRODUCT':
      if (helperValue === undefined) {
        return { valid: false, explanation: 'PRODUCT requires a helper' }
      }
      return checkProduct(moverValue, targetValue, helperValue)

    case 'RATIO':
      if (helperValue === undefined) {
        return { valid: false, explanation: 'RATIO requires a helper' }
      }
      return checkRatio(moverValue, targetValue, helperValue)

    default:
      return { valid: false, explanation: 'Unknown relation type' }
  }
}

/**
 * Find all valid relations between two values (without helper).
 * Returns an array of valid relations.
 */
export function findValidRelationsNoHelper(a: number, b: number): RelationKind[] {
  const valid: RelationKind[] = []

  if (checkEqual(a, b).valid) valid.push('EQUAL')
  if (checkMultiple(a, b).valid) valid.push('MULTIPLE')
  if (checkDivisor(a, b).valid) valid.push('DIVISOR')

  return valid
}

/**
 * Find all valid relations between two values WITH a helper.
 * Returns an array of valid relations.
 */
export function findValidRelationsWithHelper(a: number, b: number, h: number): RelationKind[] {
  const valid: RelationKind[] = []

  // First check no-helper relations
  valid.push(...findValidRelationsNoHelper(a, b))

  // Then check helper-based relations
  if (checkSum(a, b, h).valid) valid.push('SUM')
  if (checkDiff(a, b, h).valid) valid.push('DIFF')
  if (checkProduct(a, b, h).valid) valid.push('PRODUCT')
  if (checkRatio(a, b, h).valid) valid.push('RATIO')

  return valid
}

/**
 * Check if ANY relation holds between mover and target (no helper).
 * Returns the first valid relation or null.
 */
export function findAnyValidRelation(a: number, b: number): RelationCheckResult | null {
  const relations = findValidRelationsNoHelper(a, b)
  if (relations.length > 0) {
    return checkRelation(relations[0], a, b)
  }
  return null
}

/**
 * Check if ANY relation holds between mover and target WITH a helper.
 * Returns the first valid relation or null.
 */
export function findAnyValidRelationWithHelper(
  a: number,
  b: number,
  h: number
): RelationCheckResult | null {
  const relations = findValidRelationsWithHelper(a, b, h)
  if (relations.length > 0) {
    return checkRelation(relations[0], a, b, h)
  }
  return null
}

/**
 * Format a BigInt value for display (commas for readability).
 */
export function formatValue(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
