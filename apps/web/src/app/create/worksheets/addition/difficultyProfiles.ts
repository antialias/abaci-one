// Pedagogically-grounded difficulty profiles
// Maps regrouping frequency + scaffolding to teaching progression
//
// **ARCHITECTURE NOTE: Discrete Ordered Progressions**
// This system uses explicit ordered arrays for both dimensions to eliminate
// quantization and cycling issues. Each dimension has a discrete progression
// from easiest to hardest, and make harder/easier simply navigate these arrays.

import type { DisplayRules } from './displayRules'

/**
 * SCAFFOLDING_PROGRESSION: Ordered array of scaffolding configurations
 * Index 0 = maximum scaffolding (easiest)
 * Index N = no scaffolding (hardest)
 *
 * Each step removes or makes conditional one type of scaffolding aid
 */
export const SCAFFOLDING_PROGRESSION: DisplayRules[] = [
  // Level 0: Maximum scaffolding - everything always visible
  {
    carryBoxes: 'always',
    answerBoxes: 'always',
    placeValueColors: 'always',
    tenFrames: 'always',
    problemNumbers: 'always',
    cellBorders: 'always',
  },

  // Level 1: Carry boxes become conditional
  {
    carryBoxes: 'whenRegrouping',
    answerBoxes: 'always',
    placeValueColors: 'always',
    tenFrames: 'always',
    problemNumbers: 'always',
    cellBorders: 'always',
  },

  // Level 2: Ten frames become conditional
  {
    carryBoxes: 'whenRegrouping',
    answerBoxes: 'always',
    placeValueColors: 'always',
    tenFrames: 'whenRegrouping',
    problemNumbers: 'always',
    cellBorders: 'always',
  },

  // Level 3: Place value colors become conditional
  {
    carryBoxes: 'whenRegrouping',
    answerBoxes: 'always',
    placeValueColors: 'whenRegrouping',
    tenFrames: 'whenRegrouping',
    problemNumbers: 'always',
    cellBorders: 'always',
  },

  // Level 4: Answer boxes become conditional
  {
    carryBoxes: 'whenRegrouping',
    answerBoxes: 'whenRegrouping',
    placeValueColors: 'whenRegrouping',
    tenFrames: 'whenRegrouping',
    problemNumbers: 'always',
    cellBorders: 'always',
  },

  // Level 5: Multiple helpers become more conditional
  {
    carryBoxes: 'whenRegrouping',
    answerBoxes: 'whenMultipleRegroups',
    placeValueColors: 'whenRegrouping',
    tenFrames: 'whenRegrouping',
    problemNumbers: 'always',
    cellBorders: 'always',
  },

  // Level 6: More helpers get more conditional
  {
    carryBoxes: 'whenMultipleRegroups',
    answerBoxes: 'whenMultipleRegroups',
    placeValueColors: 'whenMultipleRegroups',
    tenFrames: 'whenRegrouping',
    problemNumbers: 'always',
    cellBorders: 'always',
  },

  // Level 7: Ten frames become more conditional
  {
    carryBoxes: 'whenMultipleRegroups',
    answerBoxes: 'whenMultipleRegroups',
    placeValueColors: 'whenMultipleRegroups',
    tenFrames: 'whenMultipleRegroups',
    problemNumbers: 'always',
    cellBorders: 'always',
  },

  // Level 8: Carry boxes removed
  {
    carryBoxes: 'never',
    answerBoxes: 'whenMultipleRegroups',
    placeValueColors: 'whenMultipleRegroups',
    tenFrames: 'whenMultipleRegroups',
    problemNumbers: 'always',
    cellBorders: 'always',
  },

  // Level 9: Answer boxes removed
  {
    carryBoxes: 'never',
    answerBoxes: 'never',
    placeValueColors: 'whenMultipleRegroups',
    tenFrames: 'whenMultipleRegroups',
    problemNumbers: 'always',
    cellBorders: 'always',
  },

  // Level 10: Ten frames removed
  {
    carryBoxes: 'never',
    answerBoxes: 'never',
    placeValueColors: 'whenMultipleRegroups',
    tenFrames: 'never',
    problemNumbers: 'always',
    cellBorders: 'always',
  },

  // Level 11: Place value colors only for large numbers
  {
    carryBoxes: 'never',
    answerBoxes: 'never',
    placeValueColors: 'when3PlusDigits',
    tenFrames: 'never',
    problemNumbers: 'always',
    cellBorders: 'always',
  },

  // Level 12: Minimal scaffolding - place value colors removed
  {
    carryBoxes: 'never',
    answerBoxes: 'never',
    placeValueColors: 'never',
    tenFrames: 'never',
    problemNumbers: 'always',
    cellBorders: 'always',
  },
]

/**
 * REGROUPING_PROGRESSION: Ordered array of regrouping configurations
 * Index 0 = no regrouping (easiest)
 * Index N = maximum regrouping (hardest)
 */
export const REGROUPING_PROGRESSION: Array<{
  pAnyStart: number
  pAllStart: number
}> = [
  { pAnyStart: 0.0, pAllStart: 0.0 }, // 0: No regrouping
  { pAnyStart: 0.15, pAllStart: 0.0 }, // 1: Minimal
  { pAnyStart: 0.25, pAllStart: 0.0 }, // 2: Light (Beginner/Early Learner)
  { pAnyStart: 0.35, pAllStart: 0.0 }, // 3:
  { pAnyStart: 0.45, pAllStart: 0.0 }, // 4:
  { pAnyStart: 0.54, pAllStart: 0.0 }, // 5:
  { pAnyStart: 0.6, pAllStart: 0.1 }, // 6:
  { pAnyStart: 0.68, pAllStart: 0.15 }, // 7:
  { pAnyStart: 0.75, pAllStart: 0.2 }, // 8:
  { pAnyStart: 0.75, pAllStart: 0.25 }, // 9: Intermediate
  { pAnyStart: 0.8, pAllStart: 0.3 }, // 10:
  { pAnyStart: 0.85, pAllStart: 0.38 }, // 11:
  { pAnyStart: 0.9, pAllStart: 0.45 }, // 12:
  { pAnyStart: 0.9, pAllStart: 0.5 }, // 13: Advanced/Expert
  { pAnyStart: 0.93, pAllStart: 0.58 }, // 14:
  { pAnyStart: 0.96, pAllStart: 0.67 }, // 15:
  { pAnyStart: 0.98, pAllStart: 0.78 }, // 16:
  { pAnyStart: 1.0, pAllStart: 0.9 }, // 17:
  { pAnyStart: 1.0, pAllStart: 1.0 }, // 18: Maximum regrouping
]

/**
 * Find the closest scaffolding index for given display rules
 */
export function findScaffoldingIndex(rules: DisplayRules): number {
  // Try exact match first
  for (let i = 0; i < SCAFFOLDING_PROGRESSION.length; i++) {
    if (JSON.stringify(SCAFFOLDING_PROGRESSION[i]) === JSON.stringify(rules)) {
      return i
    }
  }

  // No exact match - find closest by counting matching rules
  let bestIndex = 0
  let bestMatchCount = 0

  for (let i = 0; i < SCAFFOLDING_PROGRESSION.length; i++) {
    const level = SCAFFOLDING_PROGRESSION[i]
    let matchCount = 0

    if (level.carryBoxes === rules.carryBoxes) matchCount++
    if (level.answerBoxes === rules.answerBoxes) matchCount++
    if (level.placeValueColors === rules.placeValueColors) matchCount++
    if (level.tenFrames === rules.tenFrames) matchCount++
    if (level.problemNumbers === rules.problemNumbers) matchCount++
    if (level.cellBorders === rules.cellBorders) matchCount++

    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount
      bestIndex = i
    }
  }

  return bestIndex
}

/**
 * Find the closest regrouping index for given probabilities
 */
export function findRegroupingIndex(pAnyStart: number, pAllStart: number): number {
  let bestIndex = 0
  let bestDistance = Infinity

  for (let i = 0; i < REGROUPING_PROGRESSION.length; i++) {
    const level = REGROUPING_PROGRESSION[i]
    const distance = Math.sqrt(
      (level.pAnyStart - pAnyStart) ** 2 + (level.pAllStart - pAllStart) ** 2
    )

    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = i
    }
  }

  return bestIndex
}

/**
 * Describe what changed between two scaffolding levels
 */
function describeScaffoldingChange(
  fromRules: DisplayRules,
  toRules: DisplayRules,
  direction: 'added' | 'reduced'
): string {
  const changes: string[] = []

  const ruleNames: Record<keyof DisplayRules, string> = {
    carryBoxes: 'carry boxes',
    answerBoxes: 'answer boxes',
    placeValueColors: 'place value colors',
    tenFrames: 'ten frames',
    problemNumbers: 'problem numbers',
    cellBorders: 'cell borders',
  }

  for (const key of Object.keys(ruleNames) as Array<keyof DisplayRules>) {
    if (fromRules[key] !== toRules[key]) {
      changes.push(ruleNames[key])
    }
  }

  if (changes.length === 0) return 'Adjusted difficulty'
  if (changes.length === 1) {
    return direction === 'added' ? `Added ${changes[0]}` : `Reduced ${changes[0]}`
  }
  return direction === 'added' ? `Added ${changes.join(', ')}` : `Reduced ${changes.join(', ')}`
}

// =============================================================================
// PEDAGOGICAL CONSTRAINTS: Valid 2D Difficulty Space
// =============================================================================

/**
 * Get valid scaffolding range for a given regrouping index
 *
 * Pedagogical principle: As regrouping increases (problems get harder),
 * scaffolding should decrease (student gains independence).
 *
 * This creates a diagonal band of valid states, preventing nonsensical
 * combinations like:
 * - High regrouping + High scaffolding (overscaffolding)
 * - Low regrouping + Low scaffolding (pointless - nothing to scaffold)
 */
function getValidScaffoldingRange(regroupingIdx: number): {
  min: number
  max: number
} {
  // No/minimal regrouping (0-2): Need scaffolding to learn structure
  if (regroupingIdx <= 2) {
    return { min: 0, max: 4 }
  }

  // Light regrouping (3-5): Still need significant scaffolding
  if (regroupingIdx <= 5) {
    return { min: 0, max: 6 }
  }

  // Light-medium regrouping (6-9): Transitional phase
  if (regroupingIdx <= 9) {
    return { min: 1, max: 8 }
  }

  // Medium-high regrouping (10-12): Reducing scaffolding, wider range
  if (regroupingIdx <= 12) {
    return { min: 3, max: 11 }
  }

  // High regrouping (13-15): Can work independently, allow full range
  if (regroupingIdx <= 15) {
    return { min: 4, max: 12 }
  }

  // Very high regrouping (16-18): Should prefer independence
  return { min: 6, max: 12 }
}

/**
 * Check if a regrouping/scaffolding combination is pedagogically valid
 */
function isValidCombination(regroupingIdx: number, scaffoldingIdx: number): boolean {
  const range = getValidScaffoldingRange(regroupingIdx)
  return scaffoldingIdx >= range.min && scaffoldingIdx <= range.max
}

/**
 * Clamp scaffolding index to valid range for given regrouping index
 */
function clampScaffoldingToValidRange(regroupingIdx: number, scaffoldingIdx: number): number {
  const range = getValidScaffoldingRange(regroupingIdx)
  return Math.max(range.min, Math.min(range.max, scaffoldingIdx))
}

/**
 * Find nearest valid state to a given regrouping/scaffolding combination
 * If the combination is invalid, adjusts scaffolding to fit the valid range
 */
export function findNearestValidState(
  regroupingIdx: number,
  scaffoldingIdx: number
): { regroupingIdx: number; scaffoldingIdx: number } {
  // Clamp indices to valid progression ranges
  const clampedRegrouping = Math.max(0, Math.min(REGROUPING_PROGRESSION.length - 1, regroupingIdx))
  const clampedScaffolding = clampScaffoldingToValidRange(clampedRegrouping, scaffoldingIdx)

  return {
    regroupingIdx: clampedRegrouping,
    scaffoldingIdx: clampedScaffolding,
  }
}

export interface DifficultyProfile {
  name: string
  label: string
  description: string
  regrouping: {
    pAllStart: number
    pAnyStart: number
  }
  displayRules: DisplayRules
}

/**
 * Pre-defined difficulty profiles that map to pedagogical progression
 * Each profile balances problem complexity (regrouping) with scaffolding support
 */
export const DIFFICULTY_PROFILES: Record<string, DifficultyProfile> = {
  beginner: {
    name: 'beginner',
    label: 'Beginner',
    description:
      'Full scaffolding with no regrouping. Focus on learning the structure of addition.',
    regrouping: { pAllStart: 0, pAnyStart: 0 },
    displayRules: {
      carryBoxes: 'always', // Show structure even when not needed
      answerBoxes: 'always', // Guide digit placement
      placeValueColors: 'always', // Reinforce place value concept
      tenFrames: 'never', // No regrouping = not needed
      problemNumbers: 'always', // Help track progress
      cellBorders: 'always', // Visual organization
    },
  },

  earlyLearner: {
    name: 'earlyLearner',
    label: 'Early Learner',
    description: 'Scaffolds appear when needed. Introduces occasional regrouping.',
    regrouping: { pAllStart: 0, pAnyStart: 0.25 },
    displayRules: {
      carryBoxes: 'whenRegrouping', // Show scaffold only when needed
      answerBoxes: 'always', // Still guide placement
      placeValueColors: 'always', // Reinforce concepts
      tenFrames: 'whenRegrouping', // Visual aid for new concept
      problemNumbers: 'always',
      cellBorders: 'always',
    },
  },

  intermediate: {
    name: 'intermediate',
    label: 'Intermediate',
    description: 'Reduced scaffolding with regular regrouping practice.',
    regrouping: { pAllStart: 0.25, pAnyStart: 0.75 },
    displayRules: {
      carryBoxes: 'whenRegrouping', // Still helpful for regrouping
      answerBoxes: 'whenMultipleRegroups', // Only for complex problems
      placeValueColors: 'whenRegrouping', // Only when it matters
      tenFrames: 'whenRegrouping', // Concrete aid when needed
      problemNumbers: 'always',
      cellBorders: 'always',
    },
  },

  advanced: {
    name: 'advanced',
    label: 'Advanced',
    description: 'Minimal scaffolding with frequent complex regrouping.',
    regrouping: { pAllStart: 0.5, pAnyStart: 0.9 },
    displayRules: {
      carryBoxes: 'never', // Should internalize concept
      answerBoxes: 'never', // Should know alignment
      placeValueColors: 'when3PlusDigits', // Only for larger numbers
      tenFrames: 'never', // Beyond concrete representations
      problemNumbers: 'always',
      cellBorders: 'always',
    },
  },

  expert: {
    name: 'expert',
    label: 'Expert',
    description: 'No scaffolding. Frequent complex regrouping for mastery.',
    regrouping: { pAllStart: 0.5, pAnyStart: 0.9 },
    displayRules: {
      carryBoxes: 'never',
      answerBoxes: 'never',
      placeValueColors: 'never',
      tenFrames: 'never',
      problemNumbers: 'always',
      cellBorders: 'always',
    },
  },
}

/**
 * Ordered progression of difficulty levels
 */
export const DIFFICULTY_PROGRESSION = [
  'beginner',
  'earlyLearner',
  'intermediate',
  'advanced',
  'expert',
] as const

export type DifficultyLevel = (typeof DIFFICULTY_PROGRESSION)[number]

// =============================================================================
// 2D DIFFICULTY SYSTEM: Regrouping Intensity × Scaffolding Level
// =============================================================================

/**
 * Calculate regrouping intensity on 0-10 scale
 * Maps probability settings to single dimension
 */
export function calculateRegroupingIntensity(pAnyStart: number, pAllStart: number): number {
  // pAnyStart (occasional regrouping) contributes 70% of score
  // pAllStart (compound regrouping) contributes 30% of score
  // This reflects pedagogical importance: frequency matters more than compound complexity
  return pAnyStart * 7 + pAllStart * 3
}

/**
 * Reverse mapping: Convert regrouping intensity back to probabilities
 * Uses pedagogical progression: introduce frequency first, then compound
 */
function intensityToRegrouping(intensity: number): {
  pAnyStart: number
  pAllStart: number
} {
  // Below 5: Focus on pAnyStart, keep pAllStart minimal
  if (intensity <= 5) {
    return {
      pAnyStart: Math.min(intensity / 7, 1),
      pAllStart: 0,
    }
  }

  // Above 5: pAnyStart near max, start increasing pAllStart
  const excessIntensity = intensity - 5
  return {
    pAnyStart: Math.min(5 / 7 + excessIntensity / 14, 1),
    pAllStart: Math.min(excessIntensity / 10, 1),
  }
}

/**
 * Calculate scaffolding level on 0-10 scale
 * Higher number = LESS scaffolding = HARDER
 *
 * Each rule contributes based on:
 * - 'always' = 0 pts (max scaffolding)
 * - 'whenRegrouping' = 2 pts (conditional)
 * - 'whenMultipleRegroups' = 5 pts (sparse)
 * - 'when3PlusDigits' = 7 pts (rare)
 * - 'never' = 10 pts (no scaffolding)
 *
 * Special handling for tenFrames:
 * - When regrouping intensity is very low (<4), tenFrames is not pedagogically
 *   relevant (you don't need ten-frames if there's no/minimal regrouping).
 *   In this case, tenFrames is excluded from the calculation to prevent
 *   oscillation between 'whenRegrouping' and 'never'.
 */
export function calculateScaffoldingLevel(
  rules: DisplayRules,
  regroupingIntensity?: number
): number {
  const ruleScores: Record<string, number> = {
    always: 10, // Maximum scaffolding (easiest)
    whenRegrouping: 8,
    whenMultipleRegroups: 5,
    when3PlusDigits: 3,
    never: 0, // No scaffolding (hardest)
  }

  const weights = {
    carryBoxes: 1.5, // Most pedagogically important
    answerBoxes: 1.5, // Very important for alignment
    placeValueColors: 1.0, // Helpful but less critical
    tenFrames: 1.0, // Concrete visual aid (contextual - see above)
    problemNumbers: 0.2, // Organizational, not scaffolding
    cellBorders: 0.2, // Visual structure, not scaffolding
  }

  // Determine if tenFrames should be included in calculation
  // When regrouping is minimal, tenFrames isn't pedagogically relevant
  const includeTenFrames = regroupingIntensity === undefined || regroupingIntensity >= 4

  const weightedScores = [
    ruleScores[rules.carryBoxes] * weights.carryBoxes,
    ruleScores[rules.answerBoxes] * weights.answerBoxes,
    ruleScores[rules.placeValueColors] * weights.placeValueColors,
    ...(includeTenFrames ? [ruleScores[rules.tenFrames] * weights.tenFrames] : []),
    ruleScores[rules.problemNumbers] * weights.problemNumbers,
    ruleScores[rules.cellBorders] * weights.cellBorders,
  ]

  // Recalculate total weight excluding tenFrames if not included
  const totalWeight = includeTenFrames
    ? Object.values(weights).reduce((a, b) => a + b, 0)
    : Object.values(weights).reduce((a, b) => a + b, 0) - weights.tenFrames

  const weightedAverage = weightedScores.reduce((a, b) => a + b, 0) / totalWeight

  return Math.min(10, Math.max(0, weightedAverage))
}

/**
 * Calculate overall difficulty on 0-10 scale for single-bar UI
 * Combines regrouping intensity and scaffolding level
 */
export function calculateOverallDifficulty(
  pAnyStart: number,
  pAllStart: number,
  displayRules: DisplayRules
): number {
  const regrouping = calculateRegroupingIntensity(pAnyStart, pAllStart)
  const scaffolding = calculateScaffoldingLevel(displayRules, regrouping)

  console.log('[calculateOverallDifficulty]', {
    pAnyStart,
    pAllStart,
    regrouping,
    scaffolding,
    displayRules,
  })

  // Pedagogical path: start at (0, 10) [no regrouping, all scaffolding]
  //                    end at (10, 0) [all regrouping, no scaffolding]
  // Use Euclidean distance to measure progress along this diagonal path

  const startPoint = { regrouping: 0, scaffolding: 10 }
  const endPoint = { regrouping: 10, scaffolding: 0 }

  // Distance from start to current position
  const distFromStart = Math.sqrt(
    (regrouping - startPoint.regrouping) ** 2 + (scaffolding - startPoint.scaffolding) ** 2
  )

  // Distance from end to current position
  const distFromEnd = Math.sqrt(
    (regrouping - endPoint.regrouping) ** 2 + (scaffolding - endPoint.scaffolding) ** 2
  )

  // Progress ratio: 0 at start, 1 at end
  const progress = distFromStart / (distFromStart + distFromEnd)

  console.log('[calculateOverallDifficulty] distances:', {
    distFromStart,
    distFromEnd,
    progress,
    result: progress * 10,
  })

  // Scale to 0-10 range
  return progress * 10
}

/**
 * Reverse mapping: Convert scaffolding level to display rules
 * Uses pedagogical progression: reduce critical scaffolds last
 */
function levelToScaffoldingRules(level: number): DisplayRules {
  // Level 0-2: Full scaffolding
  if (level <= 2) {
    return {
      carryBoxes: 'always',
      answerBoxes: 'always',
      placeValueColors: 'always',
      tenFrames: level < 1 ? 'never' : 'whenRegrouping', // Ten-frames only when regrouping introduced
      problemNumbers: 'always',
      cellBorders: 'always',
    }
  }

  // Level 2-4: Transition to conditional
  if (level <= 4) {
    return {
      carryBoxes: 'whenRegrouping',
      answerBoxes: 'always',
      placeValueColors: 'always',
      tenFrames: 'whenRegrouping',
      problemNumbers: 'always',
      cellBorders: 'always',
    }
  }

  // Level 4-6: Reduce non-critical scaffolds
  if (level <= 6) {
    return {
      carryBoxes: 'whenRegrouping',
      answerBoxes: level < 5.5 ? 'always' : 'whenMultipleRegroups',
      placeValueColors: 'whenRegrouping',
      tenFrames: 'whenRegrouping',
      problemNumbers: 'always',
      cellBorders: 'always',
    }
  }

  // Level 6-8: Remove critical scaffolds
  if (level <= 8) {
    return {
      carryBoxes: level < 7 ? 'whenRegrouping' : 'never',
      answerBoxes: 'never',
      placeValueColors: level < 7.5 ? 'whenRegrouping' : 'when3PlusDigits',
      tenFrames: 'never',
      problemNumbers: 'always',
      cellBorders: 'always',
    }
  }

  // Level 8-10: Minimal to no scaffolding
  return {
    carryBoxes: 'never',
    answerBoxes: 'never',
    placeValueColors: level < 9 ? 'when3PlusDigits' : 'never',
    tenFrames: 'never',
    problemNumbers: 'always',
    cellBorders: 'always',
  }
}

/**
 * Calculate Euclidean distance between two points in difficulty space
 */
function difficultyDistance(reg1: number, scaf1: number, reg2: number, scaf2: number): number {
  return Math.sqrt((reg1 - reg2) ** 2 + (scaf1 - scaf2) ** 2)
}

/**
 * Find nearest preset profile to current state
 * Returns profile and distance
 */
export function findNearestPreset(
  currentRegrouping: number,
  currentScaffolding: number,
  direction: 'harder' | 'easier' | 'any'
): { profile: DifficultyProfile; distance: number } | null {
  const candidates = DIFFICULTY_PROGRESSION.map((name) => {
    const profile = DIFFICULTY_PROFILES[name]
    const regrouping = calculateRegroupingIntensity(
      profile.regrouping.pAnyStart,
      profile.regrouping.pAllStart
    )
    const scaffolding = calculateScaffoldingLevel(profile.displayRules, regrouping)
    const distance = difficultyDistance(
      currentRegrouping,
      currentScaffolding,
      regrouping,
      scaffolding
    )

    // Calculate if this preset is harder or easier
    // Harder = not easier in ANY dimension AND harder in AT LEAST ONE dimension
    // This prevents selecting the current preset as "next" when already at a preset
    const isHarder =
      regrouping >= currentRegrouping &&
      scaffolding >= currentScaffolding &&
      (regrouping > currentRegrouping || scaffolding > currentScaffolding)

    // Easier = not harder in ANY dimension AND easier in AT LEAST ONE dimension
    const isEasier =
      regrouping <= currentRegrouping &&
      scaffolding <= currentScaffolding &&
      (regrouping < currentRegrouping || scaffolding < currentScaffolding)

    return { profile, distance, regrouping, scaffolding, isHarder, isEasier }
  })

  // Filter by direction
  const filtered = candidates.filter((c) => {
    if (direction === 'any') return true
    if (direction === 'harder') return c.isHarder
    if (direction === 'easier') return c.isEasier
    return false
  })

  if (filtered.length === 0) return null

  // Find closest
  const nearest = filtered.reduce((a, b) => (a.distance < b.distance ? a : b))
  return { profile: nearest.profile, distance: nearest.distance }
}

export type DifficultyMode = 'both' | 'challenge' | 'support'

/**
 * Make worksheet harder using discrete progression indices with pedagogical constraints
 *
 * Algorithm:
 * 1. Find current indices in discrete progressions
 * 2. Calculate position in 2D difficulty space
 * 3. Find nearest harder preset profile
 * 4. Try to increment dimension with larger gap toward preset (or specific dimension if mode specified)
 * 5. Ensure resulting state respects pedagogical constraints
 *
 * @param mode - 'both' (default smart diagonal), 'challenge' (regrouping only), 'support' (scaffolding only)
 */
export function makeHarder(
  currentState: {
    pAnyStart: number
    pAllStart: number
    displayRules: DisplayRules
  },
  mode: DifficultyMode = 'both'
): {
  pAnyStart: number
  pAllStart: number
  displayRules: DisplayRules
  difficultyProfile?: string
  changeDescription: string
} {
  // Find current indices in discrete progressions
  const currentRegroupingIdx = findRegroupingIndex(currentState.pAnyStart, currentState.pAllStart)
  const currentScaffoldingIdx = findScaffoldingIndex(currentState.displayRules)

  // Ensure current state is valid (adjust if needed)
  const validCurrent = findNearestValidState(currentRegroupingIdx, currentScaffoldingIdx)
  let newRegroupingIdx = validCurrent.regroupingIdx
  let newScaffoldingIdx = validCurrent.scaffoldingIdx

  // Check if at maximum
  if (
    newRegroupingIdx >= REGROUPING_PROGRESSION.length - 1 &&
    newScaffoldingIdx >= SCAFFOLDING_PROGRESSION.length - 1
  ) {
    return {
      ...currentState,
      changeDescription: 'Already at maximum difficulty',
    }
  }

  // Calculate current position in 2D difficulty space
  const currentRegrouping = calculateRegroupingIntensity(
    currentState.pAnyStart,
    currentState.pAllStart
  )
  const currentScaffolding = calculateScaffoldingLevel(currentState.displayRules, currentRegrouping)

  // Try to move based on mode
  let moved = false

  if (mode === 'challenge') {
    // Only increase regrouping (more complex problems)
    if (newRegroupingIdx < REGROUPING_PROGRESSION.length - 1) {
      const testRegroupingIdx = newRegroupingIdx + 1
      const adjustedScaffoldingIdx = clampScaffoldingToValidRange(
        testRegroupingIdx,
        newScaffoldingIdx
      )
      newRegroupingIdx = testRegroupingIdx
      newScaffoldingIdx = adjustedScaffoldingIdx
      moved = true
    }
  } else if (mode === 'support') {
    // Only reduce scaffolding (remove help)
    if (
      newScaffoldingIdx < SCAFFOLDING_PROGRESSION.length - 1 &&
      isValidCombination(newRegroupingIdx, newScaffoldingIdx + 1)
    ) {
      newScaffoldingIdx++
      moved = true
    }
  } else {
    // mode === 'both': Smart diagonal navigation toward preset
    // Find nearest harder preset to guide direction
    const nearestPreset = findNearestPreset(currentRegrouping, currentScaffolding, 'harder')

    if (nearestPreset) {
      // Calculate target position from preset
      const targetRegrouping = calculateRegroupingIntensity(
        nearestPreset.profile.regrouping.pAnyStart,
        nearestPreset.profile.regrouping.pAllStart
      )
      const targetScaffolding = calculateScaffoldingLevel(
        nearestPreset.profile.displayRules,
        targetRegrouping
      )

      // Calculate gaps in both dimensions
      const regroupingGap = targetRegrouping - currentRegrouping
      const scaffoldingGap = targetScaffolding - currentScaffolding

      // Try dimension with larger gap first
      if (
        Math.abs(regroupingGap) > Math.abs(scaffoldingGap) &&
        newRegroupingIdx < REGROUPING_PROGRESSION.length - 1
      ) {
        // Try increasing regrouping
        const testRegroupingIdx = newRegroupingIdx + 1
        const adjustedScaffoldingIdx = clampScaffoldingToValidRange(
          testRegroupingIdx,
          newScaffoldingIdx
        )
        newRegroupingIdx = testRegroupingIdx
        newScaffoldingIdx = adjustedScaffoldingIdx
        moved = true
      } else if (newScaffoldingIdx < SCAFFOLDING_PROGRESSION.length - 1) {
        // Try increasing scaffolding (reducing help)
        const testScaffoldingIdx = newScaffoldingIdx + 1
        if (isValidCombination(newRegroupingIdx, testScaffoldingIdx)) {
          newScaffoldingIdx = testScaffoldingIdx
          moved = true
        }
      }
    }

    // Fallback: If we couldn't move toward preset, try any valid harder move
    // Per spec: makeHarder should increase complexity (regrouping) first, then reduce support (scaffolding)
    if (!moved) {
      // Try increasing regrouping (complexity) first
      if (newRegroupingIdx < REGROUPING_PROGRESSION.length - 1) {
        newRegroupingIdx++
        newScaffoldingIdx = clampScaffoldingToValidRange(newRegroupingIdx, newScaffoldingIdx)
        moved = true
      }
      // Otherwise try increasing scaffolding (removing help)
      else if (
        newScaffoldingIdx < SCAFFOLDING_PROGRESSION.length - 1 &&
        isValidCombination(newRegroupingIdx, newScaffoldingIdx + 1)
      ) {
        newScaffoldingIdx++
        moved = true
      }
    }
  }

  if (!moved) {
    return {
      ...currentState,
      changeDescription: 'Already at maximum difficulty',
    }
  }

  // Get new values from progressions
  const newRegrouping = REGROUPING_PROGRESSION[newRegroupingIdx]
  const newRules = SCAFFOLDING_PROGRESSION[newScaffoldingIdx]

  // Generate description
  let description = ''
  if (
    newRegroupingIdx > validCurrent.regroupingIdx &&
    newScaffoldingIdx > validCurrent.scaffoldingIdx
  ) {
    const scaffoldingChange = describeScaffoldingChange(
      currentState.displayRules,
      newRules,
      'reduced'
    )
    description = `More regrouping (${Math.round(newRegrouping.pAnyStart * 100)}%) + ${scaffoldingChange.toLowerCase()}`
  } else if (newRegroupingIdx > validCurrent.regroupingIdx) {
    description = `Increased regrouping to ${Math.round(newRegrouping.pAnyStart * 100)}%`
    if (newScaffoldingIdx !== validCurrent.scaffoldingIdx) {
      const scaffoldingChange = describeScaffoldingChange(
        currentState.displayRules,
        newRules,
        newScaffoldingIdx < validCurrent.scaffoldingIdx ? 'added' : 'reduced'
      )
      description += ` (auto-adjusted: ${scaffoldingChange.toLowerCase()})`
    }
  } else if (newScaffoldingIdx > validCurrent.scaffoldingIdx) {
    description = describeScaffoldingChange(currentState.displayRules, newRules, 'reduced')
  }

  // Check if result matches a preset
  const matchedProfile = getProfileFromConfig(
    newRegrouping.pAllStart,
    newRegrouping.pAnyStart,
    newRules
  )

  return {
    pAnyStart: newRegrouping.pAnyStart,
    pAllStart: newRegrouping.pAllStart,
    displayRules: newRules,
    difficultyProfile: matchedProfile !== 'custom' ? matchedProfile : undefined,
    changeDescription: description,
  }
}

/**
 * Make worksheet easier using discrete progression indices with pedagogical constraints
 *
 * Algorithm (inverse of makeHarder):
 * 1. Find current indices in discrete progressions
 * 2. Calculate position in 2D difficulty space
 * 3. Find nearest easier preset profile
 * 4. Try to decrement dimension with larger gap toward preset (or specific dimension if mode specified)
 * 5. Ensure resulting state respects pedagogical constraints
 *
 * @param mode - 'both' (default smart diagonal), 'challenge' (regrouping only), 'support' (scaffolding only)
 */
export function makeEasier(
  currentState: {
    pAnyStart: number
    pAllStart: number
    displayRules: DisplayRules
  },
  mode: DifficultyMode = 'both'
): {
  pAnyStart: number
  pAllStart: number
  displayRules: DisplayRules
  difficultyProfile?: string
  changeDescription: string
} {
  // Find current indices in discrete progressions
  const currentRegroupingIdx = findRegroupingIndex(currentState.pAnyStart, currentState.pAllStart)
  const currentScaffoldingIdx = findScaffoldingIndex(currentState.displayRules)

  // Ensure current state is valid (adjust if needed)
  const validCurrent = findNearestValidState(currentRegroupingIdx, currentScaffoldingIdx)
  let newRegroupingIdx = validCurrent.regroupingIdx
  let newScaffoldingIdx = validCurrent.scaffoldingIdx

  // Check if at minimum
  if (newRegroupingIdx === 0 && newScaffoldingIdx === 0) {
    return {
      ...currentState,
      changeDescription: 'Already at minimum difficulty',
    }
  }

  // Calculate current position in 2D difficulty space
  const currentRegrouping = calculateRegroupingIntensity(
    currentState.pAnyStart,
    currentState.pAllStart
  )
  const currentScaffolding = calculateScaffoldingLevel(currentState.displayRules, currentRegrouping)

  // Try to move based on mode
  let moved = false

  if (mode === 'challenge') {
    // Only decrease regrouping (simpler problems)
    if (newRegroupingIdx > 0) {
      const testRegroupingIdx = newRegroupingIdx - 1
      const adjustedScaffoldingIdx = clampScaffoldingToValidRange(
        testRegroupingIdx,
        newScaffoldingIdx
      )
      newRegroupingIdx = testRegroupingIdx
      newScaffoldingIdx = adjustedScaffoldingIdx
      moved = true
    }
  } else if (mode === 'support') {
    // Only increase scaffolding (add help)
    if (newScaffoldingIdx > 0 && isValidCombination(newRegroupingIdx, newScaffoldingIdx - 1)) {
      newScaffoldingIdx--
      moved = true
    }
  } else {
    // mode === 'both': Smart diagonal navigation toward preset
    // Find nearest easier preset to guide direction
    const nearestPreset = findNearestPreset(currentRegrouping, currentScaffolding, 'easier')

    if (nearestPreset) {
      // Calculate target position from preset
      const targetRegrouping = calculateRegroupingIntensity(
        nearestPreset.profile.regrouping.pAnyStart,
        nearestPreset.profile.regrouping.pAllStart
      )
      const targetScaffolding = calculateScaffoldingLevel(
        nearestPreset.profile.displayRules,
        targetRegrouping
      )

      // Calculate gaps in both dimensions
      const regroupingGap = targetRegrouping - currentRegrouping
      const scaffoldingGap = targetScaffolding - currentScaffolding

      // Try dimension with larger gap first
      if (Math.abs(regroupingGap) > Math.abs(scaffoldingGap) && newRegroupingIdx > 0) {
        // Try decreasing regrouping
        const testRegroupingIdx = newRegroupingIdx - 1
        const adjustedScaffoldingIdx = clampScaffoldingToValidRange(
          testRegroupingIdx,
          newScaffoldingIdx
        )
        newRegroupingIdx = testRegroupingIdx
        newScaffoldingIdx = adjustedScaffoldingIdx
        moved = true
      } else if (newScaffoldingIdx > 0) {
        // Try decreasing scaffolding (adding help)
        const testScaffoldingIdx = newScaffoldingIdx - 1
        if (isValidCombination(newRegroupingIdx, testScaffoldingIdx)) {
          newScaffoldingIdx = testScaffoldingIdx
          moved = true
        }
      }
    }

    // Fallback: If we couldn't move toward preset, try any valid easier move
    // Per spec: makeEasier should add support (scaffolding) first, then reduce complexity (regrouping)
    if (!moved) {
      // Try decreasing scaffolding (adding help) first
      if (newScaffoldingIdx > 0 && isValidCombination(newRegroupingIdx, newScaffoldingIdx - 1)) {
        newScaffoldingIdx--
        moved = true
      }
      // Otherwise try decreasing regrouping (reducing complexity)
      else if (newRegroupingIdx > 0) {
        const testRegroupingIdx = newRegroupingIdx - 1
        newRegroupingIdx = testRegroupingIdx
        newScaffoldingIdx = clampScaffoldingToValidRange(testRegroupingIdx, newScaffoldingIdx)
        moved = true
      }
    }
  }

  if (!moved) {
    return {
      ...currentState,
      changeDescription: 'Already at minimum difficulty',
    }
  }

  // Get new values from progressions
  const newRegrouping = REGROUPING_PROGRESSION[newRegroupingIdx]
  const newRules = SCAFFOLDING_PROGRESSION[newScaffoldingIdx]

  // Generate description
  let description = ''
  if (
    newRegroupingIdx < validCurrent.regroupingIdx &&
    newScaffoldingIdx < validCurrent.scaffoldingIdx
  ) {
    const scaffoldingChange = describeScaffoldingChange(
      currentState.displayRules,
      newRules,
      'added'
    )
    description = `Less regrouping (${Math.round(newRegrouping.pAnyStart * 100)}%) + ${scaffoldingChange.toLowerCase()}`
  } else if (newRegroupingIdx < validCurrent.regroupingIdx) {
    description = `Reduced regrouping frequency to ${Math.round(newRegrouping.pAnyStart * 100)}%`
    if (newScaffoldingIdx !== validCurrent.scaffoldingIdx) {
      const scaffoldingChange = describeScaffoldingChange(
        currentState.displayRules,
        newRules,
        newScaffoldingIdx < validCurrent.scaffoldingIdx ? 'added' : 'reduced'
      )
      description += ` (auto-adjusted: ${scaffoldingChange.toLowerCase()})`
    }
  } else if (newScaffoldingIdx < validCurrent.scaffoldingIdx) {
    description = describeScaffoldingChange(currentState.displayRules, newRules, 'added')
  }

  // Check if result matches a preset
  const matchedProfile = getProfileFromConfig(
    newRegrouping.pAllStart,
    newRegrouping.pAnyStart,
    newRules
  )

  return {
    pAnyStart: newRegrouping.pAnyStart,
    pAllStart: newRegrouping.pAllStart,
    displayRules: newRules,
    difficultyProfile: matchedProfile !== 'custom' ? matchedProfile : undefined,
    changeDescription: description,
  }
}

/**
 * Match config to known profile or return 'custom'
 */
export function getProfileFromConfig(
  pAllStart: number,
  pAnyStart: number,
  displayRules?: DisplayRules
): string {
  if (!displayRules) return 'custom'

  for (const profile of Object.values(DIFFICULTY_PROFILES)) {
    const regroupMatch =
      Math.abs(profile.regrouping.pAllStart - pAllStart) < 0.05 &&
      Math.abs(profile.regrouping.pAnyStart - pAnyStart) < 0.05

    const rulesMatch = JSON.stringify(profile.displayRules) === JSON.stringify(displayRules)

    if (regroupMatch && rulesMatch) {
      return profile.name
    }
  }

  return 'custom'
}
