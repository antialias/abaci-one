/**
 * Skill Extraction Utility
 *
 * Extracts skill identifiers from the tutorial system's UnifiedInstructionSequence.
 * Maps pedagogical decomposition rules to the SkillSet schema used in mastery tracking.
 */

import type { PedagogicalSegment, UnifiedInstructionSequence } from './unifiedStepGenerator'

/**
 * Skill identifier format matches the player_skill_mastery.skill_id column
 * Examples:
 * - "basic.directAddition"
 * - "fiveComplements.4=5-1"
 * - "tenComplements.9=10-1"
 */
export type SkillId = string

/**
 * Detailed skill usage information extracted from a segment
 */
export interface ExtractedSkill {
  /** The skill identifier (e.g., "fiveComplements.4=5-1") */
  skillId: SkillId
  /** The pedagogical rule that triggered this skill */
  rule: 'Direct' | 'FiveComplement' | 'TenComplement' | 'Cascade'
  /** The place value where this skill was applied (0=ones, 1=tens, etc.) */
  place: number
  /** The digit being added/subtracted */
  digit: number
  /** The segment ID this skill was extracted from */
  segmentId: string
}

/**
 * Extract skills from a unified instruction sequence
 *
 * @param sequence - The instruction sequence from generateUnifiedInstructionSequence
 * @returns Array of extracted skill information
 */
export function extractSkillsFromSequence(sequence: UnifiedInstructionSequence): ExtractedSkill[] {
  const skills: ExtractedSkill[] = []

  for (const segment of sequence.segments) {
    const extractedSkills = extractSkillsFromSegment(segment)
    skills.push(...extractedSkills)
  }

  return skills
}

/**
 * Extract skills from a single pedagogical segment
 */
function extractSkillsFromSegment(segment: PedagogicalSegment): ExtractedSkill[] {
  const skills: ExtractedSkill[] = []
  const { digit, place, plan } = segment

  // Get the primary rule from the segment's plan
  const primaryRule = plan[0]?.rule
  if (!primaryRule) return skills

  // Detect subtraction by checking segment ID suffix or step operations
  // Subtraction segments have IDs ending in '-sub'
  const isSubtraction = segment.id.endsWith('-sub')

  switch (primaryRule) {
    case 'Direct':
      // Direct addition/subtraction - check what type
      if (isSubtraction) {
        if (digit <= 4) {
          skills.push({
            skillId: 'basic.directSubtraction',
            rule: 'Direct',
            place,
            digit,
            segmentId: segment.id,
          })
        } else if (digit === 5) {
          skills.push({
            skillId: 'basic.heavenBeadSubtraction',
            rule: 'Direct',
            place,
            digit,
            segmentId: segment.id,
          })
        } else {
          // 6-9 without complements means simple combinations
          skills.push({
            skillId: 'basic.simpleCombinationsSub',
            rule: 'Direct',
            place,
            digit,
            segmentId: segment.id,
          })
        }
      } else {
        if (digit <= 4) {
          skills.push({
            skillId: 'basic.directAddition',
            rule: 'Direct',
            place,
            digit,
            segmentId: segment.id,
          })
        } else if (digit === 5) {
          skills.push({
            skillId: 'basic.heavenBead',
            rule: 'Direct',
            place,
            digit,
            segmentId: segment.id,
          })
        } else {
          // 6-9 without complements means simple combinations
          skills.push({
            skillId: 'basic.simpleCombinations',
            rule: 'Direct',
            place,
            digit,
            segmentId: segment.id,
          })
        }
      }
      break

    case 'FiveComplement': {
      if (isSubtraction) {
        // Five's complement subtraction: -d = -5 + (5-d)
        const fiveComplementSubKey = getFiveComplementSubKey(digit)
        if (fiveComplementSubKey) {
          skills.push({
            skillId: `fiveComplementsSub.${fiveComplementSubKey}`,
            rule: 'FiveComplement',
            place,
            digit,
            segmentId: segment.id,
          })
        }
      } else {
        // Five's complement addition: +d = +5 - (5-d)
        const fiveComplementKey = getFiveComplementKey(digit)
        if (fiveComplementKey) {
          skills.push({
            skillId: `fiveComplements.${fiveComplementKey}`,
            rule: 'FiveComplement',
            place,
            digit,
            segmentId: segment.id,
          })
        }
      }
      break
    }

    case 'TenComplement': {
      if (isSubtraction) {
        // Ten's complement subtraction (borrow): -d = +(10-d) - 10
        const tenComplementSubKey = getTenComplementSubKey(digit)
        if (tenComplementSubKey) {
          skills.push({
            skillId: `tenComplementsSub.${tenComplementSubKey}`,
            rule: 'TenComplement',
            place,
            digit,
            segmentId: segment.id,
          })
        }
      } else {
        // Ten's complement addition: +d = +10 - (10-d)
        const tenComplementKey = getTenComplementKey(digit)
        if (tenComplementKey) {
          skills.push({
            skillId: `tenComplements.${tenComplementKey}`,
            rule: 'TenComplement',
            place,
            digit,
            segmentId: segment.id,
          })
        }
      }
      break
    }

    case 'Cascade': {
      // Cascade is triggered by TenComplement with consecutive 9s/0s
      // The underlying skill is still TenComplement (addition) or TenComplementSub (subtraction)
      if (isSubtraction) {
        const cascadeSubKey = getTenComplementSubKey(digit)
        if (cascadeSubKey) {
          skills.push({
            skillId: `tenComplementsSub.${cascadeSubKey}`,
            rule: 'Cascade',
            place,
            digit,
            segmentId: segment.id,
          })
        }
      } else {
        const cascadeKey = getTenComplementKey(digit)
        if (cascadeKey) {
          skills.push({
            skillId: `tenComplements.${cascadeKey}`,
            rule: 'Cascade',
            place,
            digit,
            segmentId: segment.id,
          })
        }
      }
      break
    }
  }

  return skills
}

/**
 * Map a digit to its five's complement skill key
 * Five's complements are used when adding 1-4 and there's not enough earth beads
 * +4 = +5 - 1, +3 = +5 - 2, +2 = +5 - 3, +1 = +5 - 4
 */
function getFiveComplementKey(digit: number): string | null {
  const mapping: Record<number, string> = {
    4: '4=5-1',
    3: '3=5-2',
    2: '2=5-3',
    1: '1=5-4',
  }
  return mapping[digit] ?? null
}

/**
 * Map a digit to its ten's complement skill key
 * Ten's complements are used when adding causes a carry
 * +9 = +10 - 1, +8 = +10 - 2, etc.
 */
function getTenComplementKey(digit: number): string | null {
  const mapping: Record<number, string> = {
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
  return mapping[digit] ?? null
}

/**
 * Map a digit to its five's complement subtraction skill key
 * Five's complement subtraction: -d = -5 + (5-d)
 * -4 = -5 + 1, -3 = -5 + 2, -2 = -5 + 3, -1 = -5 + 4
 */
function getFiveComplementSubKey(digit: number): string | null {
  const mapping: Record<number, string> = {
    4: '-4=-5+1',
    3: '-3=-5+2',
    2: '-2=-5+3',
    1: '-1=-5+4',
  }
  return mapping[digit] ?? null
}

/**
 * Map a digit to its ten's complement subtraction skill key
 * Ten's complement subtraction (borrow): -d = +(10-d) - 10
 * -9 = +1 - 10, -8 = +2 - 10, etc.
 */
function getTenComplementSubKey(digit: number): string | null {
  const mapping: Record<number, string> = {
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
  return mapping[digit] ?? null
}

/**
 * Get unique skill IDs from an instruction sequence
 * Useful for tracking which skills were exercised in a problem
 */
export function getUniqueSkillIds(sequence: UnifiedInstructionSequence): SkillId[] {
  const skills = extractSkillsFromSequence(sequence)
  return [...new Set(skills.map((s) => s.skillId))]
}

/**
 * Extract skills from a problem's term transitions
 *
 * For practice problems with multiple terms, this extracts skills
 * for each term transition (currentValue -> currentValue + term)
 *
 * @param terms - Array of terms in the problem
 * @param generateSequence - Function to generate instruction sequence
 * @returns Map of term index to extracted skills
 */
export function extractSkillsFromProblem(
  terms: number[],
  generateSequence: (start: number, target: number) => UnifiedInstructionSequence
): Map<number, ExtractedSkill[]> {
  const skillsByTerm = new Map<number, ExtractedSkill[]>()

  let currentValue = 0
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i]
    const targetValue = currentValue + term

    try {
      const sequence = generateSequence(currentValue, targetValue)
      const skills = extractSkillsFromSequence(sequence)
      skillsByTerm.set(i, skills)
    } catch {
      // If sequence generation fails (e.g., subtraction not implemented),
      // store empty skills for this term
      skillsByTerm.set(i, [])
    }

    currentValue = targetValue
  }

  return skillsByTerm
}

/**
 * Flatten skills from all terms into a single array
 */
export function flattenProblemSkills(
  skillsByTerm: Map<number, ExtractedSkill[]>
): ExtractedSkill[] {
  const allSkills: ExtractedSkill[] = []
  for (const skills of skillsByTerm.values()) {
    allSkills.push(...skills)
  }
  return allSkills
}

/**
 * Get the category of a skill ID (e.g., "fiveComplements" from "fiveComplements.4=5-1")
 */
export function getSkillCategory(skillId: SkillId): string {
  const dotIndex = skillId.indexOf('.')
  return dotIndex >= 0 ? skillId.substring(0, dotIndex) : skillId
}

/**
 * Get the specific skill key (e.g., "4=5-1" from "fiveComplements.4=5-1")
 */
export function getSkillKey(skillId: SkillId): string {
  const dotIndex = skillId.indexOf('.')
  return dotIndex >= 0 ? skillId.substring(dotIndex + 1) : skillId
}
