/**
 * Curriculum Definitions for Daily Practice System
 *
 * Follows the traditional Japanese soroban teaching methodology:
 * - Level 1: No Regrouping (single column operations)
 * - Level 2: Addition with Regrouping (friends of 10)
 * - Level 3: Subtraction with Regrouping (friends of 10)
 *
 * Each number (+1 to +9, -1 to -9) is taught in two stages:
 * - Without friends of 5 (direct movements only)
 * - With friends of 5 (five-complement technique)
 */

import type { SkillSet } from '@/types/tutorial'
import { createEmptySkillSet } from '@/types/tutorial'

// ============================================================================
// Types
// ============================================================================

export type CurriculumLevelId = 1 | 2 | 3

export interface CurriculumLevel {
  id: CurriculumLevelId
  name: string
  description: string
  phases: CurriculumPhase[]
}

export interface CurriculumPhase {
  /** Unique phase ID, e.g., "L1.add.+3.direct" */
  id: string
  /** Parent level */
  levelId: CurriculumLevelId
  /** Operation type */
  operation: 'addition' | 'subtraction'
  /** Target number (+1 to +9 for addition, -1 to -9 for subtraction) */
  targetNumber: number
  /** Whether this phase uses five-complement technique */
  usesFiveComplement: boolean
  /** Whether this phase uses ten-complement technique (carrying/borrowing) */
  usesTenComplement: boolean
  /** Human-readable name */
  name: string
  /** Description of what this phase teaches */
  description: string
  /** The primary skill being practiced in this phase */
  primarySkillId: string
  /** Position within the curriculum (for ordering) */
  order: number
}

export interface PhaseSkillConstraints {
  /** Skills the student is allowed to use (whitelist - problems may ONLY use these) */
  allowedSkills: Partial<SkillSet>
  /** Skills we want to practice (weighted higher in problem generation) */
  targetSkills: Partial<SkillSet>
  /** Skills the student hasn't learned yet (problems must NOT require these) */
  forbiddenSkills: Partial<SkillSet>
}

// ============================================================================
// Five-Complement Mappings
// ============================================================================

/**
 * Maps target number to the five-complement skill needed for addition.
 * +4 requires 4=5-1 (add 5, subtract 1)
 * +3 requires 3=5-2 (add 5, subtract 2)
 * +2 requires 2=5-3 (add 5, subtract 3)
 * +1 requires 1=5-4 (add 5, subtract 4)
 */
const FIVE_COMPLEMENT_ADD: Record<number, keyof SkillSet['fiveComplements']> = {
  4: '4=5-1',
  3: '3=5-2',
  2: '2=5-3',
  1: '1=5-4',
}

/**
 * Maps target number to the five-complement skill needed for subtraction.
 * -4 requires -4=-5+1 (subtract 5, add 1)
 * -3 requires -3=-5+2 (subtract 5, add 2)
 * -2 requires -2=-5+3 (subtract 5, add 3)
 * -1 requires -1=-5+4 (subtract 5, add 4)
 */
const FIVE_COMPLEMENT_SUB: Record<number, keyof SkillSet['fiveComplementsSub']> = {
  4: '-4=-5+1',
  3: '-3=-5+2',
  2: '-2=-5+3',
  1: '-1=-5+4',
}

/**
 * Maps target number to the ten-complement skill needed for addition.
 */
const TEN_COMPLEMENT_ADD: Record<number, keyof SkillSet['tenComplements']> = {
  9: '9=10-1',
  8: '8=10-2',
  7: '7=10-3',
  6: '6=10-4',
  5: '5=10-5',
  4: '4=10-6',
  3: '3=10-7',
  2: '2=10-8',
  1: '1=10-9',
}

/**
 * Maps target number to the ten-complement skill needed for subtraction.
 */
const TEN_COMPLEMENT_SUB: Record<number, keyof SkillSet['tenComplementsSub']> = {
  9: '-9=+1-10',
  8: '-8=+2-10',
  7: '-7=+3-10',
  6: '-6=+4-10',
  5: '-5=+5-10',
  4: '-4=+6-10',
  3: '-3=+7-10',
  2: '-2=+8-10',
  1: '-1=+9-10',
}

// ============================================================================
// Phase Generators
// ============================================================================

function createLevel1AdditionPhases(): CurriculumPhase[] {
  const phases: CurriculumPhase[] = []
  let order = 0

  // +1 through +9, each with direct and five-complement variants
  for (let num = 1; num <= 9; num++) {
    // Direct (without friends of 5)
    phases.push({
      id: `L1.add.+${num}.direct`,
      levelId: 1,
      operation: 'addition',
      targetNumber: num,
      usesFiveComplement: false,
      usesTenComplement: false,
      name: `+${num} Direct`,
      description: `Add ${num} using direct bead movements only`,
      primarySkillId: num <= 4 ? 'basic.directAddition' : 'basic.simpleCombinations',
      order: order++,
    })

    // With friends of 5 (only for 1-4, since 5-9 don't use five-complement for single column)
    if (num <= 4) {
      phases.push({
        id: `L1.add.+${num}.five`,
        levelId: 1,
        operation: 'addition',
        targetNumber: num,
        usesFiveComplement: true,
        usesTenComplement: false,
        name: `+${num} Five-Complement`,
        description: `Add ${num} using the five-complement technique (+5-${5 - num})`,
        primarySkillId: `fiveComplements.${FIVE_COMPLEMENT_ADD[num]}`,
        order: order++,
      })
    }
  }

  return phases
}

function createLevel1SubtractionPhases(): CurriculumPhase[] {
  const phases: CurriculumPhase[] = []
  let order = 100 // Start after addition phases

  // -9 through -1 (in decreasing order, as typical in workbooks)
  for (let num = 9; num >= 1; num--) {
    // Direct (without friends of 5)
    phases.push({
      id: `L1.sub.-${num}.direct`,
      levelId: 1,
      operation: 'subtraction',
      targetNumber: -num,
      usesFiveComplement: false,
      usesTenComplement: false,
      name: `-${num} Direct`,
      description: `Subtract ${num} using direct bead movements only`,
      primarySkillId: num <= 4 ? 'basic.directSubtraction' : 'basic.simpleCombinationsSub',
      order: order++,
    })

    // With friends of 5 (only for 1-4)
    if (num <= 4) {
      phases.push({
        id: `L1.sub.-${num}.five`,
        levelId: 1,
        operation: 'subtraction',
        targetNumber: -num,
        usesFiveComplement: true,
        usesTenComplement: false,
        name: `-${num} Five-Complement`,
        description: `Subtract ${num} using the five-complement technique (-5+${5 - num})`,
        primarySkillId: `fiveComplementsSub.${FIVE_COMPLEMENT_SUB[num]}`,
        order: order++,
      })
    }
  }

  return phases
}

function createLevel2Phases(): CurriculumPhase[] {
  const phases: CurriculumPhase[] = []
  let order = 200

  // Addition with carrying (+1 through +9)
  for (let num = 1; num <= 9; num++) {
    // Without friends of 5 (pure ten-complement)
    phases.push({
      id: `L2.add.+${num}.ten`,
      levelId: 2,
      operation: 'addition',
      targetNumber: num,
      usesFiveComplement: false,
      usesTenComplement: true,
      name: `+${num} Ten-Complement`,
      description: `Add ${num} with carrying using ten-complement (+10-${10 - num})`,
      primarySkillId: `tenComplements.${TEN_COMPLEMENT_ADD[num]}`,
      order: order++,
    })

    // With friends of 5 (combined ten and five complement)
    // This is for cases like 9+6=15 where you need +10, -5, +1
    phases.push({
      id: `L2.add.+${num}.tenFive`,
      levelId: 2,
      operation: 'addition',
      targetNumber: num,
      usesFiveComplement: true,
      usesTenComplement: true,
      name: `+${num} Combined`,
      description: `Add ${num} with carrying using combined ten and five complements`,
      primarySkillId: `tenComplements.${TEN_COMPLEMENT_ADD[num]}`,
      order: order++,
    })
  }

  return phases
}

function createLevel3Phases(): CurriculumPhase[] {
  const phases: CurriculumPhase[] = []
  let order = 300

  // Subtraction with borrowing (-9 through -1)
  for (let num = 9; num >= 1; num--) {
    // Without friends of 5 (pure ten-complement)
    phases.push({
      id: `L3.sub.-${num}.ten`,
      levelId: 3,
      operation: 'subtraction',
      targetNumber: -num,
      usesFiveComplement: false,
      usesTenComplement: true,
      name: `-${num} Ten-Complement`,
      description: `Subtract ${num} with borrowing using ten-complement (+${10 - num}-10)`,
      primarySkillId: `tenComplementsSub.${TEN_COMPLEMENT_SUB[num]}`,
      order: order++,
    })

    // With friends of 5 (combined)
    phases.push({
      id: `L3.sub.-${num}.tenFive`,
      levelId: 3,
      operation: 'subtraction',
      targetNumber: -num,
      usesFiveComplement: true,
      usesTenComplement: true,
      name: `-${num} Combined`,
      description: `Subtract ${num} with borrowing using combined ten and five complements`,
      primarySkillId: `tenComplementsSub.${TEN_COMPLEMENT_SUB[num]}`,
      order: order++,
    })
  }

  return phases
}

// ============================================================================
// Curriculum Definition
// ============================================================================

export const CURRICULUM_LEVELS: CurriculumLevel[] = [
  {
    id: 1,
    name: 'Level 1: No Regrouping',
    description:
      'Single column operations without carrying or borrowing. Master direct bead movements and five-complement techniques.',
    phases: [...createLevel1AdditionPhases(), ...createLevel1SubtractionPhases()],
  },
  {
    id: 2,
    name: 'Level 2: Addition with Regrouping',
    description:
      'Addition that requires carrying to the next column using ten-complement techniques.',
    phases: createLevel2Phases(),
  },
  {
    id: 3,
    name: 'Level 3: Subtraction with Regrouping',
    description:
      'Subtraction that requires borrowing from the next column using ten-complement techniques.',
    phases: createLevel3Phases(),
  },
]

// Flat list of all phases for easy lookup
export const ALL_PHASES: CurriculumPhase[] = CURRICULUM_LEVELS.flatMap((level) => level.phases)

// ============================================================================
// Skill Constraint Helpers
// ============================================================================

/**
 * Get the skill constraints for a curriculum phase.
 * This determines what skills the student must have, what we're targeting,
 * and what skills should be forbidden (not yet learned).
 */
export function getPhaseSkillConstraints(phaseId: string): PhaseSkillConstraints {
  const phase = ALL_PHASES.find((p) => p.id === phaseId)
  if (!phase) {
    throw new Error(`Unknown phase: ${phaseId}`)
  }

  const required = createEmptySkillSet()
  const target: Partial<SkillSet> = {}
  const forbidden = createEmptySkillSet()

  // Build constraints based on phase properties
  if (phase.levelId === 1) {
    // Level 1: No carrying/borrowing
    // Forbid all ten-complement skills
    forbidden.tenComplements = {
      '9=10-1': true,
      '8=10-2': true,
      '7=10-3': true,
      '6=10-4': true,
      '5=10-5': true,
      '4=10-6': true,
      '3=10-7': true,
      '2=10-8': true,
      '1=10-9': true,
    }
    forbidden.tenComplementsSub = {
      '-9=+1-10': true,
      '-8=+2-10': true,
      '-7=+3-10': true,
      '-6=+4-10': true,
      '-5=+5-10': true,
      '-4=+6-10': true,
      '-3=+7-10': true,
      '-2=+8-10': true,
      '-1=+9-10': true,
    }

    if (phase.operation === 'addition') {
      required.basic.directAddition = true
      required.basic.heavenBead = true

      if (phase.usesFiveComplement && phase.targetNumber <= 4) {
        // Target the specific five-complement skill
        const skill = FIVE_COMPLEMENT_ADD[phase.targetNumber]
        target.fiveComplements = { [skill]: true } as Partial<SkillSet['fiveComplements']>
        required.fiveComplements = {
          [skill]: true,
        } as SkillSet['fiveComplements']
      } else if (!phase.usesFiveComplement) {
        // Forbid five-complements for direct-only practice
        forbidden.fiveComplements = {
          '4=5-1': true,
          '3=5-2': true,
          '2=5-3': true,
          '1=5-4': true,
        }
      }
    } else {
      // Subtraction
      required.basic.directSubtraction = true
      required.basic.heavenBeadSubtraction = true

      if (phase.usesFiveComplement && Math.abs(phase.targetNumber) <= 4) {
        const skill = FIVE_COMPLEMENT_SUB[Math.abs(phase.targetNumber)]
        target.fiveComplementsSub = { [skill]: true } as Partial<SkillSet['fiveComplementsSub']>
        required.fiveComplementsSub = {
          [skill]: true,
        } as SkillSet['fiveComplementsSub']
      } else if (!phase.usesFiveComplement) {
        forbidden.fiveComplementsSub = {
          '-4=-5+1': true,
          '-3=-5+2': true,
          '-2=-5+3': true,
          '-1=-5+4': true,
        }
      }
    }
  } else if (phase.levelId === 2) {
    // Level 2: Addition with carrying
    required.basic.directAddition = true
    required.basic.heavenBead = true

    const skill = TEN_COMPLEMENT_ADD[phase.targetNumber]
    target.tenComplements = { [skill]: true } as Partial<SkillSet['tenComplements']>
    required.tenComplements = { [skill]: true } as SkillSet['tenComplements']

    if (!phase.usesFiveComplement) {
      // Pure ten-complement, forbid five-complement combinations
      forbidden.fiveComplements = {
        '4=5-1': true,
        '3=5-2': true,
        '2=5-3': true,
        '1=5-4': true,
      }
    }
  } else if (phase.levelId === 3) {
    // Level 3: Subtraction with borrowing
    required.basic.directSubtraction = true
    required.basic.heavenBeadSubtraction = true

    const skill = TEN_COMPLEMENT_SUB[Math.abs(phase.targetNumber)]
    target.tenComplementsSub = { [skill]: true } as Partial<SkillSet['tenComplementsSub']>
    required.tenComplementsSub = {
      [skill]: true,
    } as SkillSet['tenComplementsSub']

    if (!phase.usesFiveComplement) {
      forbidden.fiveComplementsSub = {
        '-4=-5+1': true,
        '-3=-5+2': true,
        '-2=-5+3': true,
        '-1=-5+4': true,
      }
    }
  }

  return {
    allowedSkills: required,
    targetSkills: target,
    forbiddenSkills: forbidden,
  }
}

/**
 * Get all skills that should be unlocked by the time a student reaches a phase.
 * This is cumulative - includes all skills from previous phases.
 */
export function getUnlockedSkillsAtPhase(phaseId: string): Partial<SkillSet> {
  const phaseIndex = ALL_PHASES.findIndex((p) => p.id === phaseId)
  if (phaseIndex === -1) {
    return createEmptySkillSet()
  }

  const unlocked = createEmptySkillSet()

  // Accumulate skills from all phases up to and including this one
  for (let i = 0; i <= phaseIndex; i++) {
    const phase = ALL_PHASES[i]
    const constraints = getPhaseSkillConstraints(phase.id)

    // Merge allowed skills into unlocked
    mergeSkillSets(unlocked, constraints.allowedSkills)
  }

  return unlocked
}

/**
 * Get all skills that should be forbidden at a given phase.
 * This is everything NOT yet unlocked.
 */
export function getForbiddenSkillsAtPhase(phaseId: string): Partial<SkillSet> {
  const unlocked = getUnlockedSkillsAtPhase(phaseId)
  const all = createFullSkillSet()

  // Everything not unlocked is forbidden
  return subtractSkillSets(all, unlocked)
}

// ============================================================================
// Utility Functions
// ============================================================================

function createFullSkillSet(): SkillSet {
  return {
    basic: {
      directAddition: true,
      heavenBead: true,
      simpleCombinations: true,
      directSubtraction: true,
      heavenBeadSubtraction: true,
      simpleCombinationsSub: true,
    },
    fiveComplements: {
      '4=5-1': true,
      '3=5-2': true,
      '2=5-3': true,
      '1=5-4': true,
    },
    tenComplements: {
      '9=10-1': true,
      '8=10-2': true,
      '7=10-3': true,
      '6=10-4': true,
      '5=10-5': true,
      '4=10-6': true,
      '3=10-7': true,
      '2=10-8': true,
      '1=10-9': true,
    },
    fiveComplementsSub: {
      '-4=-5+1': true,
      '-3=-5+2': true,
      '-2=-5+3': true,
      '-1=-5+4': true,
    },
    tenComplementsSub: {
      '-9=+1-10': true,
      '-8=+2-10': true,
      '-7=+3-10': true,
      '-6=+4-10': true,
      '-5=+5-10': true,
      '-4=+6-10': true,
      '-3=+7-10': true,
      '-2=+8-10': true,
      '-1=+9-10': true,
    },
  }
}

function mergeSkillSets(target: SkillSet, source: Partial<SkillSet>): void {
  for (const category of Object.keys(source) as (keyof SkillSet)[]) {
    const sourceCategory = source[category]
    if (sourceCategory) {
      for (const skill of Object.keys(sourceCategory)) {
        if ((sourceCategory as Record<string, boolean>)[skill]) {
          ;(target[category] as Record<string, boolean>)[skill] = true
        }
      }
    }
  }
}

function subtractSkillSets(all: SkillSet, unlocked: Partial<SkillSet>): Partial<SkillSet> {
  const result = createEmptySkillSet()

  for (const category of Object.keys(all) as (keyof SkillSet)[]) {
    const allCategory = all[category]
    const unlockedCategory = unlocked[category] || {}

    for (const skill of Object.keys(allCategory)) {
      const isUnlocked = (unlockedCategory as Record<string, boolean>)[skill]
      if (!isUnlocked) {
        ;(result[category] as Record<string, boolean>)[skill] = true
      }
    }
  }

  return result
}

// ============================================================================
// Lookup Functions
// ============================================================================

/**
 * Get a phase by its ID
 */
export function getPhase(phaseId: string): CurriculumPhase | undefined {
  return ALL_PHASES.find((p) => p.id === phaseId)
}

/**
 * Get the next phase after the given phase ID
 */
export function getNextPhase(phaseId: string): CurriculumPhase | undefined {
  const currentIndex = ALL_PHASES.findIndex((p) => p.id === phaseId)
  if (currentIndex === -1 || currentIndex === ALL_PHASES.length - 1) {
    return undefined
  }
  return ALL_PHASES[currentIndex + 1]
}

/**
 * Get the first phase (starting point for new students)
 */
export function getFirstPhase(): CurriculumPhase {
  return ALL_PHASES[0]
}

/**
 * Get all phases for a given level
 */
export function getPhasesForLevel(levelId: CurriculumLevelId): CurriculumPhase[] {
  return ALL_PHASES.filter((p) => p.levelId === levelId)
}

/**
 * Parse a phase ID into its components
 */
export function parsePhaseId(phaseId: string): {
  level: CurriculumLevelId
  operation: 'add' | 'sub'
  number: number
  technique: 'direct' | 'five' | 'ten' | 'tenFive'
} | null {
  const match = phaseId.match(/^L(\d)\.(add|sub)\.([-+]?\d+)\.(direct|five|ten|tenFive)$/)
  if (!match) return null

  return {
    level: parseInt(match[1], 10) as CurriculumLevelId,
    operation: match[2] as 'add' | 'sub',
    number: parseInt(match[3], 10),
    technique: match[4] as 'direct' | 'five' | 'ten' | 'tenFive',
  }
}

/**
 * Get human-readable description for a phase
 */
export function getPhaseDisplayInfo(phaseId: string): {
  levelName: string
  phaseName: string
  description: string
} {
  const phase = getPhase(phaseId)
  if (!phase) {
    return {
      levelName: 'Unknown Level',
      phaseName: 'Unknown Phase',
      description: 'Phase not found',
    }
  }

  const level = CURRICULUM_LEVELS.find((l) => l.id === phase.levelId)
  return {
    levelName: level?.name || `Level ${phase.levelId}`,
    phaseName: phase.name,
    description: phase.description,
  }
}
