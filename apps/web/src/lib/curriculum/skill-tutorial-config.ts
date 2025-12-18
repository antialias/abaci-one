/**
 * Skill Tutorial Configurations (Client-Safe)
 *
 * This file contains ONLY the tutorial configurations and helper functions
 * that can be safely imported in client components.
 *
 * Server-side logic (database operations, BKT computation) lives in skill-unlock.ts
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for dynamically generating tutorials for each skill.
 * Each skill maps to example problems that demonstrate the technique.
 */
export interface SkillTutorialConfig {
  skillId: string
  title: string
  description: string
  /** Example problems that demonstrate this skill: { start, target } */
  exampleProblems: Array<{ start: number; target: number }>
  /** Number of practice problems before sign-off (default 3) */
  practiceCount?: number
}

// ============================================================================
// Skill Tutorial Configs
// ============================================================================

/**
 * Tutorial configurations for each skill type.
 * These are used to dynamically generate tutorials via generateUnifiedInstructionSequence().
 */
export const SKILL_TUTORIAL_CONFIGS: Record<string, SkillTutorialConfig> = {
  // ============================================================================
  // Basic Skills
  // ============================================================================
  'basic.directAddition': {
    skillId: 'basic.directAddition',
    title: 'Direct Addition (1-4)',
    description:
      'The simplest way to add: just push up the earth beads you need. Each earth bead is worth 1.',
    exampleProblems: [
      { start: 0, target: 1 },
      { start: 0, target: 3 },
      { start: 1, target: 4 },
    ],
  },
  'basic.heavenBead': {
    skillId: 'basic.heavenBead',
    title: 'Heaven Bead (5)',
    description:
      'The heaven bead is worth 5. Push it down to add 5 in one move instead of pushing 5 earth beads.',
    exampleProblems: [
      { start: 0, target: 5 },
      { start: 1, target: 6 },
      { start: 3, target: 8 },
    ],
  },
  'basic.simpleCombinations': {
    skillId: 'basic.simpleCombinations',
    title: 'Simple Combinations (6-9)',
    description:
      'For numbers 6-9, combine the heaven bead (5) with earth beads. 6 = heaven + 1 earth.',
    exampleProblems: [
      { start: 0, target: 6 },
      { start: 0, target: 7 },
      { start: 0, target: 9 },
    ],
  },
  'basic.directSubtraction': {
    skillId: 'basic.directSubtraction',
    title: 'Direct Subtraction (1-4)',
    description: 'The simplest way to subtract: just pull down the earth beads you need to remove.',
    exampleProblems: [
      { start: 3, target: 2 },
      { start: 4, target: 1 },
      { start: 4, target: 0 },
    ],
  },
  'basic.heavenBeadSubtraction': {
    skillId: 'basic.heavenBeadSubtraction',
    title: 'Heaven Bead Subtraction (5)',
    description: 'Push the heaven bead up to subtract 5 in one move.',
    exampleProblems: [
      { start: 5, target: 0 },
      { start: 6, target: 1 },
      { start: 8, target: 3 },
    ],
  },
  'basic.simpleCombinationsSub': {
    skillId: 'basic.simpleCombinationsSub',
    title: 'Simple Combinations Subtraction (6-9)',
    description: 'When subtracting from 6-9, you may need to move both heaven and earth beads.',
    exampleProblems: [
      { start: 6, target: 0 },
      { start: 7, target: 1 },
      { start: 9, target: 3 },
    ],
  },

  // ============================================================================
  // Five-Complement Addition (+4, +3, +2, +1 using 5's friend)
  // ============================================================================
  'fiveComplements.4=5-1': {
    skillId: 'fiveComplements.4=5-1',
    title: '+4 = +5 - 1',
    description:
      "When you can't fit 4 earth beads, use 5's friend: add 5 (push down heaven), then take away 1 (pull down 1 earth).",
    exampleProblems: [
      { start: 1, target: 5 },
      { start: 2, target: 6 },
      { start: 3, target: 7 },
    ],
  },
  'fiveComplements.3=5-2': {
    skillId: 'fiveComplements.3=5-2',
    title: '+3 = +5 - 2',
    description:
      "When you can't fit 3 earth beads, use 5's friend: add 5 (push down heaven), then take away 2.",
    exampleProblems: [
      { start: 2, target: 5 },
      { start: 3, target: 6 },
      { start: 4, target: 7 },
    ],
  },
  'fiveComplements.2=5-3': {
    skillId: 'fiveComplements.2=5-3',
    title: '+2 = +5 - 3',
    description:
      "When you can't fit 2 earth beads, use 5's friend: add 5 (push down heaven), then take away 3.",
    exampleProblems: [
      { start: 3, target: 5 },
      { start: 4, target: 6 },
    ],
  },
  'fiveComplements.1=5-4': {
    skillId: 'fiveComplements.1=5-4',
    title: '+1 = +5 - 4',
    description:
      "When you can't fit 1 more earth bead (column is full at 4), use 5's friend: add 5, take away 4.",
    exampleProblems: [{ start: 4, target: 5 }],
  },

  // ============================================================================
  // Five-Complement Subtraction (-4, -3, -2, -1 using 5's friend)
  // ============================================================================
  'fiveComplementsSub.-4=-5+1': {
    skillId: 'fiveComplementsSub.-4=-5+1',
    title: '-4 = -5 + 1',
    description:
      "When you don't have 4 earth beads to remove, use 5's friend: subtract 5 (push up heaven), then add 1 back.",
    exampleProblems: [
      { start: 5, target: 1 },
      { start: 6, target: 2 },
      { start: 7, target: 3 },
    ],
  },
  'fiveComplementsSub.-3=-5+2': {
    skillId: 'fiveComplementsSub.-3=-5+2',
    title: '-3 = -5 + 2',
    description:
      "When you don't have 3 earth beads to remove, use 5's friend: subtract 5, then add 2 back.",
    exampleProblems: [
      { start: 5, target: 2 },
      { start: 6, target: 3 },
      { start: 7, target: 4 },
    ],
  },
  'fiveComplementsSub.-2=-5+3': {
    skillId: 'fiveComplementsSub.-2=-5+3',
    title: '-2 = -5 + 3',
    description:
      "When you don't have 2 earth beads to remove, use 5's friend: subtract 5, then add 3 back.",
    exampleProblems: [
      { start: 5, target: 3 },
      { start: 6, target: 4 },
    ],
  },
  'fiveComplementsSub.-1=-5+4': {
    skillId: 'fiveComplementsSub.-1=-5+4',
    title: '-1 = -5 + 4',
    description:
      "When you don't have 1 earth bead to remove (column is at 5), use 5's friend: subtract 5, then add 4 back.",
    exampleProblems: [{ start: 5, target: 4 }],
  },

  // ============================================================================
  // Ten-Complement Addition (carrying to next column)
  // ============================================================================
  'tenComplements.9=10-1': {
    skillId: 'tenComplements.9=10-1',
    title: '+9 = +10 - 1',
    description:
      "When adding 9 would overflow the column, use 10's friend: carry 10 to the tens column, then take away 1 from the ones.",
    exampleProblems: [
      { start: 1, target: 10 },
      { start: 2, target: 11 },
      { start: 5, target: 14 },
    ],
  },
  'tenComplements.8=10-2': {
    skillId: 'tenComplements.8=10-2',
    title: '+8 = +10 - 2',
    description:
      "When adding 8 would overflow, use 10's friend: carry 10 to the tens, take away 2 from the ones.",
    exampleProblems: [
      { start: 2, target: 10 },
      { start: 3, target: 11 },
      { start: 5, target: 13 },
    ],
  },
  'tenComplements.7=10-3': {
    skillId: 'tenComplements.7=10-3',
    title: '+7 = +10 - 3',
    description:
      "When adding 7 would overflow, use 10's friend: carry 10 to the tens, take away 3 from the ones.",
    exampleProblems: [
      { start: 3, target: 10 },
      { start: 4, target: 11 },
      { start: 6, target: 13 },
    ],
  },
  'tenComplements.6=10-4': {
    skillId: 'tenComplements.6=10-4',
    title: '+6 = +10 - 4',
    description:
      "When adding 6 would overflow, use 10's friend: carry 10 to the tens, take away 4 from the ones.",
    exampleProblems: [
      { start: 4, target: 10 },
      { start: 5, target: 11 },
      { start: 7, target: 13 },
    ],
  },
  'tenComplements.5=10-5': {
    skillId: 'tenComplements.5=10-5',
    title: '+5 = +10 - 5',
    description:
      "When adding 5 would overflow, use 10's friend: carry 10 to the tens, take away 5 from the ones.",
    exampleProblems: [
      { start: 5, target: 10 },
      { start: 6, target: 11 },
      { start: 8, target: 13 },
    ],
  },
  'tenComplements.4=10-6': {
    skillId: 'tenComplements.4=10-6',
    title: '+4 = +10 - 6',
    description:
      "When adding 4 would overflow, use 10's friend: carry 10 to the tens, take away 6 from the ones.",
    exampleProblems: [
      { start: 6, target: 10 },
      { start: 7, target: 11 },
      { start: 9, target: 13 },
    ],
  },
  'tenComplements.3=10-7': {
    skillId: 'tenComplements.3=10-7',
    title: '+3 = +10 - 7',
    description:
      "When adding 3 would overflow, use 10's friend: carry 10 to the tens, take away 7 from the ones.",
    exampleProblems: [
      { start: 7, target: 10 },
      { start: 8, target: 11 },
      { start: 9, target: 12 },
    ],
  },
  'tenComplements.2=10-8': {
    skillId: 'tenComplements.2=10-8',
    title: '+2 = +10 - 8',
    description:
      "When adding 2 would overflow, use 10's friend: carry 10 to the tens, take away 8 from the ones.",
    exampleProblems: [
      { start: 8, target: 10 },
      { start: 9, target: 11 },
    ],
  },
  'tenComplements.1=10-9': {
    skillId: 'tenComplements.1=10-9',
    title: '+1 = +10 - 9',
    description:
      "When adding 1 would overflow (column is at 9), use 10's friend: carry 10 to the tens, take away 9 from the ones.",
    exampleProblems: [{ start: 9, target: 10 }],
  },

  // ============================================================================
  // Ten-Complement Subtraction (borrowing from next column)
  // ============================================================================
  'tenComplementsSub.-9=+1-10': {
    skillId: 'tenComplementsSub.-9=+1-10',
    title: '-9 = +1 - 10',
    description:
      "When you can't subtract 9 directly, use 10's friend: borrow 10 from the tens column, then add 1 back to the ones.",
    exampleProblems: [
      { start: 10, target: 1 },
      { start: 11, target: 2 },
      { start: 15, target: 6 },
    ],
  },
  'tenComplementsSub.-8=+2-10': {
    skillId: 'tenComplementsSub.-8=+2-10',
    title: '-8 = +2 - 10',
    description: "When you can't subtract 8 directly, use 10's friend: borrow 10, then add 2 back.",
    exampleProblems: [
      { start: 10, target: 2 },
      { start: 11, target: 3 },
      { start: 15, target: 7 },
    ],
  },
  'tenComplementsSub.-7=+3-10': {
    skillId: 'tenComplementsSub.-7=+3-10',
    title: '-7 = +3 - 10',
    description: "When you can't subtract 7 directly, use 10's friend: borrow 10, then add 3 back.",
    exampleProblems: [
      { start: 10, target: 3 },
      { start: 11, target: 4 },
      { start: 15, target: 8 },
    ],
  },
  'tenComplementsSub.-6=+4-10': {
    skillId: 'tenComplementsSub.-6=+4-10',
    title: '-6 = +4 - 10',
    description: "When you can't subtract 6 directly, use 10's friend: borrow 10, then add 4 back.",
    exampleProblems: [
      { start: 10, target: 4 },
      { start: 11, target: 5 },
      { start: 15, target: 9 },
    ],
  },
  'tenComplementsSub.-5=+5-10': {
    skillId: 'tenComplementsSub.-5=+5-10',
    title: '-5 = +5 - 10',
    description: "When you can't subtract 5 directly, use 10's friend: borrow 10, then add 5 back.",
    exampleProblems: [
      { start: 10, target: 5 },
      { start: 11, target: 6 },
      { start: 14, target: 9 },
    ],
  },
  'tenComplementsSub.-4=+6-10': {
    skillId: 'tenComplementsSub.-4=+6-10',
    title: '-4 = +6 - 10',
    description: "When you can't subtract 4 directly, use 10's friend: borrow 10, then add 6 back.",
    exampleProblems: [
      { start: 10, target: 6 },
      { start: 11, target: 7 },
      { start: 13, target: 9 },
    ],
  },
  'tenComplementsSub.-3=+7-10': {
    skillId: 'tenComplementsSub.-3=+7-10',
    title: '-3 = +7 - 10',
    description: "When you can't subtract 3 directly, use 10's friend: borrow 10, then add 7 back.",
    exampleProblems: [
      { start: 10, target: 7 },
      { start: 11, target: 8 },
      { start: 12, target: 9 },
    ],
  },
  'tenComplementsSub.-2=+8-10': {
    skillId: 'tenComplementsSub.-2=+8-10',
    title: '-2 = +8 - 10',
    description: "When you can't subtract 2 directly, use 10's friend: borrow 10, then add 8 back.",
    exampleProblems: [
      { start: 10, target: 8 },
      { start: 11, target: 9 },
    ],
  },
  'tenComplementsSub.-1=+9-10': {
    skillId: 'tenComplementsSub.-1=+9-10',
    title: '-1 = +9 - 10',
    description:
      "When you can't subtract 1 directly (column is at 0), use 10's friend: borrow 10, then add 9 back.",
    exampleProblems: [{ start: 10, target: 9 }],
  },
}

// ============================================================================
// Helper Functions (Client-Safe)
// ============================================================================

/**
 * Get the tutorial config for a skill.
 * Returns null if no tutorial is configured (skill doesn't require a tutorial).
 */
export function getSkillTutorialConfig(skillId: string): SkillTutorialConfig | null {
  return SKILL_TUTORIAL_CONFIGS[skillId] ?? null
}

/**
 * Get a human-readable display name for a skill.
 */
export function getSkillDisplayName(skillId: string): string {
  const config = SKILL_TUTORIAL_CONFIGS[skillId]
  if (config) {
    return config.title
  }

  // Fallback: parse skill ID
  // e.g., "fiveComplements.4=5-1" → "+4 Five-Complement"
  const parts = skillId.split('.')
  if (parts.length >= 2) {
    return parts[1]
  }

  return skillId
}
