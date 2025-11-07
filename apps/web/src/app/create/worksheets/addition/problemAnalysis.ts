// Problem analysis for conditional display rules
// Analyzes n-digit + p-digit addition problems to determine characteristics

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
  regroupPlaces: ('ones' | 'tens' | 'hundreds')[]
}

/**
 * Analyze an addition problem to determine its characteristics
 * Supports any positive integers a, b where a > 0 and b > 0
 */
export function analyzeProblem(a: number, b: number): ProblemMeta {
  // Basic properties
  const digitsA = a.toString().length
  const digitsB = b.toString().length
  const maxDigits = Math.max(digitsA, digitsB)
  const sum = a + b
  const digitsSum = sum.toString().length

  // Analyze regrouping place by place
  // Pad to 3 digits for consistent indexing (supports up to 999 + 999)
  const aDigits = String(a).padStart(3, '0').split('').map(Number).reverse()
  const bDigits = String(b).padStart(3, '0').split('').map(Number).reverse()

  const regroupPlaces: ('ones' | 'tens' | 'hundreds')[] = []
  const places = ['ones', 'tens', 'hundreds'] as const

  // Check each place value for carrying
  for (let i = 0; i < 3; i++) {
    if (aDigits[i] + bDigits[i] >= 10) {
      regroupPlaces.push(places[i])
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
