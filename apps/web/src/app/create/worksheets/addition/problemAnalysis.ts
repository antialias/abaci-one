// Problem analysis for conditional display rules
// Analyzes n-digit + p-digit addition problems to determine characteristics
// Supports 1-5 digit problems (max sum: 99999 + 99999 = 199998)

export type PlaceValue =
  | 'ones'
  | 'tens'
  | 'hundreds'
  | 'thousands'
  | 'tenThousands'
  | 'hundredThousands'

export interface ProblemMeta {
  a: number
  b: number
  digitsA: number
  digitsB: number
  maxDigits: number
  sum: number
  digitsSum: number
  requiresRegrouping: boolean
  regroupCount: number
  regroupPlaces: PlaceValue[]
}

/**
 * Analyze an addition problem to determine its characteristics
 * Supports 1-5 digit problems (a and b can each be 1-99999)
 * Maximum sum: 99999 + 99999 = 199998 (6 digits)
 */
export function analyzeProblem(a: number, b: number): ProblemMeta {
  // Basic properties
  const digitsA = a.toString().length
  const digitsB = b.toString().length
  const maxDigits = Math.max(digitsA, digitsB)
  const sum = a + b
  const digitsSum = sum.toString().length

  // Analyze regrouping place by place
  // Pad to 6 digits for consistent indexing (supports up to 99999 + 99999 = 199998)
  const aDigits = String(a).padStart(6, '0').split('').map(Number).reverse()
  const bDigits = String(b).padStart(6, '0').split('').map(Number).reverse()

  const regroupPlaces: PlaceValue[] = []
  const places: PlaceValue[] = [
    'ones',
    'tens',
    'hundreds',
    'thousands',
    'tenThousands',
    'hundredThousands',
  ]

  // Check each place value for carrying
  // We need to track carries propagating through place values
  let carry = 0
  for (let i = 0; i < 6; i++) {
    const digitSum = aDigits[i] + bDigits[i] + carry
    if (digitSum >= 10) {
      regroupPlaces.push(places[i])
      carry = 1
    } else {
      carry = 0
    }
  }

  return {
    a,
    b,
    digitsA,
    digitsB,
    maxDigits,
    sum,
    digitsSum,
    requiresRegrouping: regroupPlaces.length > 0,
    regroupCount: regroupPlaces.length,
    regroupPlaces,
  }
}

/**
 * Metadata for a subtraction problem
 */
export interface SubtractionProblemMeta {
  minuend: number
  subtrahend: number
  digitsMinuend: number
  digitsSubtrahend: number
  maxDigits: number
  difference: number
  digitsDifference: number
  requiresBorrowing: boolean
  borrowCount: number
  borrowPlaces: PlaceValue[]
}

/**
 * Analyze a subtraction problem to determine its characteristics
 * Supports 1-5 digit problems (minuend and subtrahend can each be 1-99999)
 * Assumes minuend >= subtrahend (no negative results)
 */
export function analyzeSubtractionProblem(
  minuend: number,
  subtrahend: number
): SubtractionProblemMeta {
  // Basic properties
  const digitsMinuend = minuend.toString().length
  const digitsSubtrahend = subtrahend.toString().length
  const maxDigits = Math.max(digitsMinuend, digitsSubtrahend)
  const difference = minuend - subtrahend
  const digitsDifference = difference === 0 ? 1 : difference.toString().length

  // Analyze borrowing place by place
  // Pad to 6 digits for consistent indexing
  const mDigits = String(minuend).padStart(6, '0').split('').map(Number).reverse()
  const sDigits = String(subtrahend).padStart(6, '0').split('').map(Number).reverse()

  const borrowPlaces: PlaceValue[] = []
  const places: PlaceValue[] = [
    'ones',
    'tens',
    'hundreds',
    'thousands',
    'tenThousands',
    'hundredThousands',
  ]

  // Check each place value for borrowing
  // We need to track borrows propagating through place values
  let borrow = 0
  for (let i = 0; i < 6; i++) {
    const mDigit = mDigits[i] - borrow
    const sDigit = sDigits[i]

    if (mDigit < sDigit) {
      borrowPlaces.push(places[i])
      borrow = 1 // Need to borrow from next higher place
    } else {
      borrow = 0
    }
  }

  return {
    minuend,
    subtrahend,
    digitsMinuend,
    digitsSubtrahend,
    maxDigits,
    difference,
    digitsDifference,
    requiresBorrowing: borrowPlaces.length > 0,
    borrowCount: borrowPlaces.length,
    borrowPlaces,
  }
}
