#!/usr/bin/env npx tsx
/**
 * Seed script to create multiple test students with different BKT scenarios.
 *
 * Uses the REAL problem generator to create realistic problems with proper
 * skill tagging. Each profile declares its INTENTION, and after generation
 * the ACTUAL outcomes are appended to the student notes.
 *
 * =============================================================================
 * CLI OPTIONS
 * =============================================================================
 *
 * Usage:
 *   npm run seed:test-students [options]
 *
 * Options:
 *   --help, -h              Show this help message
 *   --list, -l              List all available students and categories
 *   --name, -n <name>       Seed specific student(s) by name (can use multiple times)
 *   --category, -c <cat>    Seed all students in a category (can use multiple times)
 *   --dry-run               Show what would be seeded without creating students
 *
 * Categories:
 *   bkt          Core BKT scenarios (deficient, blocker, progressing, etc.)
 *   session      Session mode tests (remediation, progression, maintenance)
 *   edge         Edge cases (empty, single skill, high volume, NaN stress test)
 *
 * Examples:
 *   npm run seed:test-students                     # Seed all students
 *   npm run seed:test-students -- --list           # List available options
 *   npm run seed:test-students -- -n "💥 NaN Stress Test"
 *   npm run seed:test-students -- -c edge          # Seed all edge case students
 *   npm run seed:test-students -- -c bkt -c session
 *   npm run seed:test-students -- -n "🔴 Multi-Skill Deficient" -n "🟢 Progressing Nicely"
 *
 * =============================================================================
 * STUDENT PROFILES
 * =============================================================================
 *
 * BKT Scenarios (--category bkt):
 *   🔴 Multi-Skill Deficient  - Early L1, struggling with basics
 *   🟡 Single-Skill Blocker   - Mid L1, one five-complement blocking
 *   🟢 Progressing Nicely     - Mid L1, healthy mix
 *   ⭐ Ready to Level Up      - End of L1 addition, all strong
 *   🚀 Overdue for Promotion  - Has mastered L1, ready for L2
 *
 * Session Mode Tests (--category session):
 *   🎯 Remediation Test           - REMEDIATION mode (weak skills blocking)
 *   📚 Progression Tutorial Test  - PROGRESSION mode (tutorial required)
 *   🚀 Progression Ready Test     - PROGRESSION mode (tutorial done)
 *   🏆 Maintenance Test           - MAINTENANCE mode (all skills strong)
 *
 * Edge Cases (--category edge):
 *   🆕 Brand New Student      - Zero practicing skills, empty state
 *   🔢 Single Skill Only      - Only one skill practicing
 *   📊 High Volume Learner    - Many skills with lots of practice history
 *   ⚖️ Multi-Weak Remediation - Many weak skills needing remediation
 *   🕰️ Stale Skills Test      - Skills at various staleness levels
 *   💥 NaN Stress Test        - Stress tests BKT NaN handling
 *   🧊 Forgotten Weaknesses   - Weak skills that are also stale
 */

import { parseArgs } from 'node:util'

// =============================================================================
// CLI Argument Parsing
// =============================================================================

const { values: cliArgs } = parseArgs({
  options: {
    help: { type: 'boolean', short: 'h', default: false },
    list: { type: 'boolean', short: 'l', default: false },
    name: { type: 'string', short: 'n', multiple: true, default: [] },
    category: { type: 'string', short: 'c', multiple: true, default: [] },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
  allowPositionals: false,
})

function showHelp(): void {
  console.log(`
Usage:
  npm run seed:test-students [options]

Options:
  --help, -h              Show this help message
  --list, -l              List all available students and categories
  --name, -n <name>       Seed specific student(s) by name (can use multiple times)
  --category, -c <cat>    Seed all students in a category (can use multiple times)
  --dry-run               Show what would be seeded without creating students

Categories:
  bkt          Core BKT scenarios (deficient, blocker, progressing, etc.)
  session      Session mode tests (remediation, progression, maintenance)
  edge         Edge cases (empty, single skill, high volume, NaN stress test)

Examples:
  npm run seed:test-students                     # Seed all students
  npm run seed:test-students -- --list           # List available options
  npm run seed:test-students -- -n "💥 NaN Stress Test"
  npm run seed:test-students -- -c edge          # Seed all edge case students
  npm run seed:test-students -- -c bkt -c session
  npm run seed:test-students -- -n "🔴 Multi-Skill Deficient" -n "🟢 Progressing Nicely"
`)
}

// Note: listProfiles is defined after TEST_PROFILES (below)

import { createId } from '@paralleldrive/cuid2'
import { desc, eq } from 'drizzle-orm'
import { db, schema } from '../src/db'
import { computeBktFromHistory, type SkillBktResult } from '../src/lib/curriculum/bkt'
import { applyLearning, bktUpdate } from '../src/lib/curriculum/bkt/bkt-core'
import { getDefaultParams } from '../src/lib/curriculum/bkt/skill-priors'
import { BKT_THRESHOLDS } from '../src/lib/curriculum/config/bkt-integration'
import { getRecentSessionResults } from '../src/lib/curriculum/session-planner'
import type {
  GeneratedProblem,
  SessionPart,
  SessionSummary,
  SlotResult,
} from '../src/db/schema/session-plans'
import {
  generateSingleProblem,
  type GeneratedProblem as GenProblem,
} from '../src/utils/problemGenerator'
import { createEmptySkillSet, type SkillSet } from '../src/types/tutorial'

// =============================================================================
// BKT Simulation Utilities
// =============================================================================

/**
 * Simulate BKT computation for a sequence of correct/incorrect answers.
 * Used to predict what pKnown will result from a given sequence.
 *
 * IMPORTANT: This matches the actual BKT computation behavior:
 * - CORRECT: bktUpdate + applyLearning (student may have learned from this)
 * - INCORRECT: bktUpdate only (no learning transition on failure)
 */
function simulateBktSequence(skillId: string, sequence: boolean[]): number {
  const params = getDefaultParams(skillId)
  let pKnown = params.pInit

  for (const isCorrect of sequence) {
    const updated = bktUpdate(pKnown, isCorrect, params)
    // Only apply learning transition on CORRECT answers
    // (matches updateOnCorrect vs updateOnIncorrect behavior)
    pKnown = isCorrect ? applyLearning(updated, params.pLearn) : updated
  }

  return pKnown
}

/**
 * Target classification for a skill
 */
type TargetClassification = 'weak' | 'developing' | 'strong'

/**
 * Design a sequence of correct/incorrect answers that will reliably produce
 * the target BKT classification.
 *
 * Key insight: The ORDER of correct/incorrect matters more than the ratio.
 * - Ending with correct answers → higher pKnown
 * - Ending with incorrect answers → lower pKnown
 *
 * IMPORTANT: BKT dynamics are "swingy" - a single correct can push pKnown
 * from 0.3 to ~0.7, and a single incorrect can drop from 0.7 to ~0.3.
 * The "developing" range (0.5-0.8) is narrow and requires careful calibration.
 */
function designSequenceForClassification(
  skillId: string,
  problemCount: number,
  target: TargetClassification
): boolean[] {
  // For very few problems, use simple patterns
  if (problemCount <= 3) {
    switch (target) {
      case 'strong':
        return Array(problemCount).fill(true)
      case 'weak':
        return Array(problemCount).fill(false)
      case 'developing':
        // All correct for tiny counts since multi-skill coupling pulls down
        return Array(problemCount).fill(true)
    }
  }

  // For longer sequences, use empirically-tuned patterns
  switch (target) {
    case 'strong': {
      // 85% correct, ending with streak of correct
      const incorrectCount = Math.max(1, Math.floor(problemCount * 0.15))
      return [
        ...Array(incorrectCount).fill(false),
        ...Array(problemCount - incorrectCount).fill(true),
      ]
    }

    case 'weak': {
      // 90% incorrect, ending with long streak of incorrect
      const correctCount = Math.max(1, Math.floor(problemCount * 0.1))
      return [...Array(correctCount).fill(true), ...Array(problemCount - correctCount).fill(false)]
    }

    case 'developing': {
      // The developing range (0.5-0.8) is narrow and BKT is swingy.
      // Try multiple pattern types to find one that lands in range.

      // Pattern generators to try (in order of preference)
      const patternGenerators = [
        // Pattern 1: End with exactly 1 correct after many incorrect
        // This leverages BKT's swingy nature - one correct from low pKnown lands ~0.65-0.75
        (n: number, correct: number) => {
          const endCorrect = 1
          const startCorrect = correct - endCorrect
          return [
            ...Array(startCorrect).fill(true),
            ...Array(n - correct).fill(false),
            ...Array(endCorrect).fill(true),
          ]
        },

        // Pattern 2: Alternating ending with correct
        // Creates "oscillating" pKnown that can land in middle
        (n: number, correct: number) => {
          const seq: boolean[] = []
          let remainingCorrect = correct
          let remainingIncorrect = n - correct
          // Interleave with bias toward incorrect first
          while (remainingCorrect > 0 || remainingIncorrect > 0) {
            if (
              remainingIncorrect > 0 &&
              (remainingIncorrect > remainingCorrect || remainingCorrect === 0)
            ) {
              seq.push(false)
              remainingIncorrect--
            } else if (remainingCorrect > 0) {
              seq.push(true)
              remainingCorrect--
            }
          }
          return seq
        },

        // Pattern 3: Front-loaded correct, then incorrect, ending with 1 correct
        (n: number, correct: number) => {
          const endCorrect = 1
          const frontCorrect = correct - endCorrect
          return [
            ...Array(frontCorrect).fill(true),
            ...Array(n - correct).fill(false),
            ...Array(endCorrect).fill(true),
          ]
        },

        // Pattern 4: Sandwich - incorrect, correct, incorrect
        (n: number, correct: number) => {
          const thirdIncorrect = Math.floor((n - correct) / 2)
          return [
            ...Array(thirdIncorrect).fill(false),
            ...Array(correct).fill(true),
            ...Array(n - correct - thirdIncorrect).fill(false),
          ]
        },
      ]

      // Try different correct counts with each pattern
      // For developing, we want something between strong (>80%) and weak (<50%)
      // Try 40-70% correct with various patterns
      for (const correctRatio of [0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7]) {
        const correctCount = Math.max(1, Math.round(problemCount * correctRatio))

        for (const generatePattern of patternGenerators) {
          const sequence = generatePattern(problemCount, correctCount)

          // Verify sequence length is correct
          if (sequence.length !== problemCount) continue

          const pKnown = simulateBktSequence(skillId, sequence)

          // Check if it lands in developing range
          if (pKnown >= BKT_THRESHOLDS.weak && pKnown < BKT_THRESHOLDS.strong) {
            return sequence
          }
        }
      }

      // If we still can't find a pattern, try edge cases
      // Sometimes a specific count lands in range
      for (let correct = 1; correct < problemCount; correct++) {
        // Try ending with 1 correct after all incorrect
        const sequence = [
          ...Array(correct - 1).fill(true),
          ...Array(problemCount - correct).fill(false),
          true, // End with one correct
        ]
        const pKnown = simulateBktSequence(skillId, sequence)
        if (pKnown >= BKT_THRESHOLDS.weak && pKnown < BKT_THRESHOLDS.strong) {
          return sequence
        }
      }

      // Ultimate fallback: Just end with 1 correct after all incorrect
      // This typically lands around 0.65-0.70 from pInit
      return [
        ...Array(problemCount - 1).fill(false),
        true, // Single correct at end
      ]
    }
  }
}

// =============================================================================
// Realistic Problem Generation Utilities
// =============================================================================

/**
 * Maps a skill ID to the category and key for SkillSet modification
 */
function parseSkillId(skillId: string): { category: string; key: string } | null {
  const parts = skillId.split('.')
  if (parts.length !== 2) return null
  return { category: parts[0], key: parts[1] }
}

/**
 * Enables a specific skill in a SkillSet (mutates the set)
 */
function enableSkill(skillSet: SkillSet, skillId: string): void {
  const parsed = parseSkillId(skillId)
  if (!parsed) return

  const { category, key } = parsed
  if (category === 'basic' && key in skillSet.basic) {
    ;(skillSet.basic as Record<string, boolean>)[key] = true
  } else if (category === 'fiveComplements' && key in skillSet.fiveComplements) {
    ;(skillSet.fiveComplements as Record<string, boolean>)[key] = true
  } else if (category === 'tenComplements' && key in skillSet.tenComplements) {
    ;(skillSet.tenComplements as Record<string, boolean>)[key] = true
  } else if (category === 'fiveComplementsSub' && key in skillSet.fiveComplementsSub) {
    ;(skillSet.fiveComplementsSub as Record<string, boolean>)[key] = true
  } else if (category === 'tenComplementsSub' && key in skillSet.tenComplementsSub) {
    ;(skillSet.tenComplementsSub as Record<string, boolean>)[key] = true
  } else if (category === 'advanced' && key in skillSet.advanced) {
    ;(skillSet.advanced as Record<string, boolean>)[key] = true
  }
}

/**
 * Get prerequisite skills that must be enabled for a target skill to be reachable.
 * For example, to use fiveComplements.3=5-2, we need basic.directAddition to reach
 * states where adding 3 triggers +5-2.
 */
function getPrerequisiteSkills(skillId: string): string[] {
  const category = skillId.split('.')[0]

  switch (category) {
    case 'basic':
      // Basic skills need directAddition enabled (except directAddition itself)
      if (skillId === 'basic.directAddition') {
        return []
      }
      return ['basic.directAddition']
    case 'fiveComplements':
      // Five complements need directAddition and heavenBead to reach necessary states
      return ['basic.directAddition', 'basic.heavenBead']
    case 'tenComplements':
      // Ten complements need basics plus five complements to reach carry states
      return [
        'basic.directAddition',
        'basic.heavenBead',
        'basic.simpleCombinations',
        'fiveComplements.4=5-1',
        'fiveComplements.3=5-2',
        'fiveComplements.2=5-3',
        'fiveComplements.1=5-4',
      ]
    case 'fiveComplementsSub':
      // Subtraction five complements need subtraction basics
      return ['basic.directSubtraction', 'basic.heavenBeadSubtraction']
    case 'tenComplementsSub':
      // Subtraction ten complements need all subtraction skills
      return [
        'basic.directSubtraction',
        'basic.heavenBeadSubtraction',
        'basic.simpleCombinationsSub',
        'fiveComplementsSub.-4=-5+1',
        'fiveComplementsSub.-3=-5+2',
        'fiveComplementsSub.-2=-5+3',
        'fiveComplementsSub.-1=-5+4',
      ]
    default:
      return []
  }
}

/**
 * Creates a SkillSet that enables the target skill plus prerequisites
 */
function createSkillSetForTarget(targetSkill: string): SkillSet {
  const skillSet = createEmptySkillSet()

  // Enable prerequisites first
  const prereqs = getPrerequisiteSkills(targetSkill)
  for (const prereq of prereqs) {
    enableSkill(skillSet, prereq)
  }

  // Enable the target skill
  enableSkill(skillSet, targetSkill)

  return skillSet
}

/**
 * Creates a target SkillSet with only the target skill enabled (for problem matching)
 */
function createTargetSkillSet(targetSkill: string): Partial<SkillSet> {
  const skillSet = createEmptySkillSet()
  enableSkill(skillSet, targetSkill)
  return skillSet
}

/**
 * Generated problem with metadata for seeding
 */
interface RealisticProblem {
  terms: number[]
  answer: number
  skillsUsed: string[]
  generationTrace?: GenProblem['generationTrace']
}

/**
 * Generates a batch of realistic problems targeting a specific skill.
 * IMPORTANT: Only returns problems that actually exercise the target skill.
 * This ensures BKT sees the correct skill in skillsExercised.
 */
function generateRealisticProblems(
  targetSkill: string,
  count: number,
  maxAttempts: number = 100
): RealisticProblem[] {
  const problems: RealisticProblem[] = []
  const allowedSkills = createSkillSetForTarget(targetSkill)
  const targetSkillSet = createTargetSkillSet(targetSkill)

  // Determine number range based on skill category
  const category = targetSkill.split('.')[0]
  let numberRange = { min: 1, max: 9 }
  let maxSum = 20

  if (category === 'tenComplements' || category === 'tenComplementsSub') {
    numberRange = { min: 1, max: 99 }
    maxSum = 200
  } else if (category === 'fiveComplements' || category === 'fiveComplementsSub') {
    numberRange = { min: 1, max: 9 }
    maxSum = 20
  }

  let attempts = 0
  while (problems.length < count && attempts < count * maxAttempts) {
    attempts++

    const problem = generateSingleProblem({
      constraints: {
        numberRange,
        maxSum,
        maxTerms: 3,
        minTerms: 2,
        problemCount: 1,
      },
      allowedSkills,
      targetSkills: targetSkillSet,
      attempts: 20,
    })

    // STRICT: Only accept problems that actually use the target skill
    if (problem && problem.skillsUsed.includes(targetSkill)) {
      problems.push({
        terms: problem.terms,
        answer: problem.answer,
        // IMPORTANT: Force single-skill annotation for predictable BKT outcomes.
        // Multi-skill problems cause blame distribution which our simulation doesn't model.
        // This ensures the generated patterns reliably produce target classifications.
        skillsUsed: [targetSkill],
        generationTrace: problem.generationTrace,
      })
    }
  }

  // If we couldn't generate enough problems, log a warning and synthesize
  // problems that claim to use the target skill (for testing purposes)
  if (problems.length < count) {
    console.warn(
      `[Seed] Could only generate ${problems.length}/${count} problems for ${targetSkill}. ` +
        `Synthesizing ${count - problems.length} more.`
    )

    while (problems.length < count) {
      // Synthesize a problem that uses the target skill
      // The actual math doesn't matter for BKT - only skillsUsed matters
      const a = Math.floor(Math.random() * 8) + 1
      const b = Math.floor(Math.random() * 8) + 1
      problems.push({
        terms: [a, b],
        answer: a + b,
        // IMPORTANT: Include the target skill so BKT processes it
        skillsUsed: [targetSkill],
      })
    }
  }

  return problems
}

// =============================================================================
// Test Student Profiles
// =============================================================================

interface SkillConfig {
  skillId: string
  /** Target BKT classification - sequences will be designed to achieve this */
  targetClassification: TargetClassification
  /** Number of problems to generate */
  problems: number
  /** Days ago this skill was practiced (default: 1 day) */
  ageDays?: number
  /** Simulate legacy data by omitting hadHelp field (tests NaN handling) */
  simulateLegacyData?: boolean
}

/**
 * Success criteria for a profile - defines what "success" means
 */
interface SuccessCriteria {
  /** Minimum number of weak skills required */
  minWeak?: number
  /** Maximum number of weak skills allowed */
  maxWeak?: number
  /** Minimum number of developing skills required */
  minDeveloping?: number
  /** Maximum number of developing skills allowed */
  maxDeveloping?: number
  /** Minimum number of strong skills required */
  minStrong?: number
  /** Maximum number of strong skills allowed */
  maxStrong?: number
}

/**
 * Tuning adjustment to apply when criteria aren't met
 */
interface TuningAdjustment {
  /** Skill ID to adjust (or 'all' for all skills) */
  skillId: string | 'all'
  /** Add this many problems */
  problemsAdd?: number
  /** Multiply problems by this factor */
  problemsMultiplier?: number
}

/** Profile category for CLI filtering */
type ProfileCategory = 'bkt' | 'session' | 'edge'

interface TestStudentProfile {
  name: string
  emoji: string
  color: string
  /** Category for CLI filtering: 'bkt', 'session', or 'edge' */
  category: ProfileCategory
  description: string
  /** Intention notes - what this profile is TRYING to achieve */
  intentionNotes: string
  /** Skills that should have isPracticing = true (realistic curriculum progression) */
  practicingSkills: string[]
  /** Skills with problem history (can include non-practicing for testing edge cases) */
  skillHistory: SkillConfig[]
  /**
   * If true, auto-generate problems for all practicing skills that don't have explicit history.
   * This ensures all practicing skills have BKT data for proper session mode detection.
   */
  ensureAllPracticingHaveHistory?: boolean
  /** Curriculum phase this student is nominally at */
  currentPhaseId: string
  /** Skills that should have their tutorial marked as completed */
  tutorialCompletedSkills?: string[]
  /** Expected session mode for this profile */
  expectedSessionMode?: 'remediation' | 'progression' | 'maintenance'
  /** Success criteria for this profile */
  successCriteria?: SuccessCriteria
  /** Tuning adjustments to apply if criteria aren't met */
  tuningAdjustments?: TuningAdjustment[]
}

// =============================================================================
// Realistic Curriculum Skill Progressions
// =============================================================================

/** Early Level 1 - just learning basics */
const EARLY_L1_SKILLS = ['basic.directAddition', 'basic.heavenBead']

/** Mid Level 1 - basics strong, learning five complements */
const MID_L1_SKILLS = [
  'basic.directAddition',
  'basic.heavenBead',
  'basic.simpleCombinations',
  'fiveComplements.4=5-1',
  'fiveComplements.3=5-2',
]

/** Late Level 1 Addition - all addition skills */
const LATE_L1_ADD_SKILLS = [
  'basic.directAddition',
  'basic.heavenBead',
  'basic.simpleCombinations',
  'fiveComplements.4=5-1',
  'fiveComplements.3=5-2',
  'fiveComplements.2=5-3',
  'fiveComplements.1=5-4',
]

/** Complete Level 1 - includes subtraction basics */
const COMPLETE_L1_SKILLS = [
  ...LATE_L1_ADD_SKILLS,
  'basic.directSubtraction',
  'basic.heavenBeadSubtraction',
  'basic.simpleCombinationsSub',
  'fiveComplementsSub.-4=-5+1',
  'fiveComplementsSub.-3=-5+2',
  'fiveComplementsSub.-2=-5+3',
  'fiveComplementsSub.-1=-5+4',
]

/** Level 2 skills (ten complements for addition) */
const L2_ADD_SKILLS = [
  'tenComplements.9=10-1',
  'tenComplements.8=10-2',
  'tenComplements.7=10-3',
  'tenComplements.6=10-4',
]

// All test student profiles
const TEST_PROFILES: TestStudentProfile[] = [
  {
    name: '🔴 Multi-Skill Deficient',
    emoji: '😰',
    color: '#ef4444', // red
    category: 'bkt',
    description: 'Struggling with many skills - needs intervention',
    currentPhaseId: 'L1.add.+3.direct',
    practicingSkills: EARLY_L1_SKILLS,
    intentionNotes: `INTENTION: Multi-Skill Deficient

This student is in early Level 1 and struggling with basic bead movements. Their BKT estimates show multiple weak skills in the foundational "basic" category.

Curriculum position: Early L1 (L1.add.+3.direct)
Practicing skills: basic.directAddition, basic.heavenBead

This profile represents a student who:
- Is struggling with the very basics of abacus operation
- May need hands-on teacher guidance
- Could benefit from slower progression and more scaffolding
- Might have difficulty with fine motor skills or conceptual understanding

Use this student to test how the UI handles intervention alerts for foundational skill deficits.`,
    skillHistory: [
      // Weak in basics - this is concerning at this stage
      { skillId: 'basic.directAddition', targetClassification: 'weak', problems: 15 },
      { skillId: 'basic.heavenBead', targetClassification: 'weak', problems: 12 },
    ],
    // Tuning: Need at least 2 weak skills
    successCriteria: { minWeak: 2 },
    tuningAdjustments: [{ skillId: 'all', problemsAdd: 10 }],
  },
  {
    name: '🟡 Single-Skill Blocker',
    emoji: '🤔',
    color: '#f59e0b', // amber
    category: 'bkt',
    description: 'One weak skill blocking progress, others are fine',
    currentPhaseId: 'L1.add.+2.five',
    practicingSkills: MID_L1_SKILLS,
    intentionNotes: `INTENTION: Single-Skill Blocker

This student is progressing well through Level 1 but has ONE specific five-complement skill that's blocking advancement. Most skills are strong, but fiveComplements.3=5-2 is weak.

Curriculum position: Mid L1 (L1.add.+2.five)
Practicing skills: basics + first two five complements

The blocking skill is: fiveComplements.3=5-2 (adding 3 via +5-2)

This profile represents a student who:
- Understands the general concepts well
- Has a specific gap that needs targeted practice
- Should NOT be held back on other skills
- May benefit from focused tutoring on the specific technique

Use this student to test targeted intervention recommendations.`,
    skillHistory: [
      // Strong basics
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 20 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 18 },
      {
        skillId: 'basic.simpleCombinations',
        targetClassification: 'strong',
        problems: 15,
      },
      // Strong in first five complement
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'strong', problems: 16 },
      // THE BLOCKER - weak despite practice
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'weak', problems: 18 },
    ],
  },
  {
    name: '🟢 Progressing Nicely',
    emoji: '😊',
    color: '#22c55e', // green
    category: 'bkt',
    description: 'Healthy progression - mostly strong with one skill in progress',
    currentPhaseId: 'L1.add.+3.five',
    practicingSkills: MID_L1_SKILLS,
    intentionNotes: `INTENTION: Progressing Nicely

This student shows a healthy learning trajectory - most skills are mastered, with one newer skill still being learned (weak).

Curriculum position: Mid L1 (L1.add.+3.five)
Practicing skills: basics + first two five complements

Expected outcome:
• Most skills strong (mastered basics and early five-complements)
• One weak skill (newest in curriculum, still learning)

This is what a "healthy" student looks like - no intervention flags, steady progress.

Use this student to verify:
• Normal dashboard display without intervention alerts
• Mixed skill states that don't trigger remediation
• Typical student who is making good progress`,
    skillHistory: [
      // Strong basics (mastered)
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 25 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 22 },
      // Developing - in the middle zone
      {
        skillId: 'basic.simpleCombinations',
        targetClassification: 'developing',
        problems: 12,
      },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'developing', problems: 10 },
      // Just started (expected to be weak)
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'weak', problems: 8 },
    ],
    // Success criteria: Need at least 1 developing to prove the system works
    successCriteria: { minDeveloping: 1 },
  },
  {
    name: '⭐ Ready to Level Up',
    emoji: '🌟',
    color: '#8b5cf6', // violet
    category: 'bkt',
    description: 'All skills strong - ready for next curriculum phase',
    currentPhaseId: 'L1.add.+1.five',
    practicingSkills: LATE_L1_ADD_SKILLS,
    intentionNotes: `INTENTION: Ready to Level Up

This student has mastered ALL Level 1 addition skills and is ready to move to subtraction or Level 2.

Curriculum position: End of L1 Addition (L1.add.+1.five - last addition phase)
Practicing skills: All Level 1 addition skills

All skills at strong mastery (85%+):
• basic.directAddition, heavenBead, simpleCombinations
• All four fiveComplements

This student should be promoted to L1 subtraction or could start L2 addition with carrying.

Use this student to test:
- "Ready to advance" indicators
- Promotion recommendations
- Session planning when all skills are strong`,
    skillHistory: [
      // All strong
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 25 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 25 },
      {
        skillId: 'basic.simpleCombinations',
        targetClassification: 'strong',
        problems: 22,
      },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'strong', problems: 20 },
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'strong', problems: 20 },
      { skillId: 'fiveComplements.2=5-3', targetClassification: 'strong', problems: 18 },
      { skillId: 'fiveComplements.1=5-4', targetClassification: 'strong', problems: 18 },
    ],
  },
  {
    name: '🚀 Overdue for Promotion',
    emoji: '🏆',
    color: '#06b6d4', // cyan
    category: 'bkt',
    description: 'All skills mastered long ago - should have leveled up already',
    currentPhaseId: 'L2.add.+9.ten',
    practicingSkills: [...COMPLETE_L1_SKILLS, ...L2_ADD_SKILLS],
    intentionNotes: `INTENTION: Overdue for Promotion

This student has MASSIVELY exceeded mastery requirements. They've mastered ALL of Level 1 (addition AND subtraction) plus several Level 2 skills!

Curriculum position: Should be deep in L2 (L2.add.+9.ten)
Practicing skills: Complete L1 + early L2

All skills at very high mastery (88-98%):
• ALL basic skills (addition and subtraction)
• ALL four fiveComplements (addition)
• ALL four fiveComplementsSub (subtraction)
• Four tenComplements (L2 addition with carrying)

This is a "red flag" scenario - the system should have advanced this student long ago.

Use this student to test:
- Urgent promotion alerts
- Detection of stale curriculum placement
- Over-mastery warnings`,
    skillHistory: [
      // Extremely strong basics
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 35 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 35 },
      {
        skillId: 'basic.simpleCombinations',
        targetClassification: 'strong',
        problems: 30,
      },
      {
        skillId: 'basic.directSubtraction',
        targetClassification: 'strong',
        problems: 30,
      },
      {
        skillId: 'basic.heavenBeadSubtraction',
        targetClassification: 'strong',
        problems: 28,
      },
      {
        skillId: 'basic.simpleCombinationsSub',
        targetClassification: 'strong',
        problems: 28,
      },
      // All five complements mastered
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'strong', problems: 30 },
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'strong', problems: 30 },
      { skillId: 'fiveComplements.2=5-3', targetClassification: 'strong', problems: 28 },
      { skillId: 'fiveComplements.1=5-4', targetClassification: 'strong', problems: 28 },
      // Subtraction five complements too
      {
        skillId: 'fiveComplementsSub.-4=-5+1',
        targetClassification: 'strong',
        problems: 25,
      },
      {
        skillId: 'fiveComplementsSub.-3=-5+2',
        targetClassification: 'strong',
        problems: 25,
      },
      {
        skillId: 'fiveComplementsSub.-2=-5+3',
        targetClassification: 'strong',
        problems: 22,
      },
      {
        skillId: 'fiveComplementsSub.-1=-5+4',
        targetClassification: 'strong',
        problems: 22,
      },
      // Even L2 ten complements
      { skillId: 'tenComplements.9=10-1', targetClassification: 'strong', problems: 20 },
      { skillId: 'tenComplements.8=10-2', targetClassification: 'strong', problems: 20 },
      { skillId: 'tenComplements.7=10-3', targetClassification: 'strong', problems: 18 },
      { skillId: 'tenComplements.6=10-4', targetClassification: 'strong', problems: 18 },
    ],
  },

  // =============================================================================
  // Session Mode Test Profiles
  // =============================================================================

  {
    name: '🎯 Remediation Test',
    emoji: '🎯',
    color: '#dc2626', // red-600
    category: 'session',
    description: 'REMEDIATION MODE - Weak skills blocking promotion',
    currentPhaseId: 'L1.add.+3.five',
    practicingSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
    ],
    expectedSessionMode: 'remediation',
    intentionNotes: `INTENTION: Remediation Mode

This student is specifically configured to trigger REMEDIATION mode.

Session Mode: REMEDIATION (with blocked promotion)

What you should see:
• SessionModeBanner shows "Skills need practice" with weak skills listed
• Banner shows blocked promotion: "Ready for +3 (five-complement) once skills are strong"
• StartPracticeModal shows remediation-focused CTA

How it works:
• Has 4 skills practicing: basic.directAddition, heavenBead, simpleCombinations, fiveComplements.4=5-1
• Two skills have low accuracy (< 50%) with enough problems to be confident
• The next skill (fiveComplements.3=5-2) is available but blocked by weak skills

Use this to test the remediation UI in dashboard and modal.`,
    tutorialCompletedSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
    ],
    skillHistory: [
      // Strong skills
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 20 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 18 },
      // WEAK skills - will trigger remediation
      {
        skillId: 'basic.simpleCombinations',
        targetClassification: 'weak',
        problems: 15,
      },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'weak', problems: 18 },
    ],
  },
  {
    name: '📚 Progression Tutorial Test',
    emoji: '📚',
    color: '#7c3aed', // violet-600
    category: 'session',
    description: 'PROGRESSION MODE - Ready for new skill, tutorial required',
    currentPhaseId: 'L1.add.+3.five',
    practicingSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
    ],
    ensureAllPracticingHaveHistory: true, // All practicing skills must be strong for progression
    expectedSessionMode: 'progression',
    intentionNotes: `INTENTION: Progression Mode (Tutorial Required)

This student is specifically configured to trigger PROGRESSION mode with tutorial gate.

Session Mode: PROGRESSION (tutorialRequired: true)

What you should see:
• SessionModeBanner shows "New Skill Available" with next skill name
• Banner has "Start Tutorial" button (not "Start Practice")
• StartPracticeModal shows tutorial CTA with skill description

How it works:
• Has 4 skills practicing, ALL are strong (>= 80% accuracy)
• The next skill in curriculum (fiveComplements.3=5-2) is available
• Tutorial for that skill has NOT been completed

Use this to test the progression UI and tutorial gate flow.`,
    tutorialCompletedSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      // NOTE: fiveComplements.3=5-2 tutorial NOT completed - triggers tutorial gate
    ],
    skillHistory: [
      // All skills STRONG
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 25 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 22 },
      {
        skillId: 'basic.simpleCombinations',
        targetClassification: 'strong',
        problems: 20,
      },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'strong', problems: 20 },
    ],
  },
  {
    name: '🚀 Progression Ready Test',
    emoji: '🚀',
    color: '#059669', // emerald-600
    category: 'session',
    description: 'PROGRESSION MODE - Tutorial done, ready to practice',
    currentPhaseId: 'L1.add.+3.five',
    practicingSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
    ],
    ensureAllPracticingHaveHistory: true, // All practicing skills must be strong for progression
    expectedSessionMode: 'progression',
    intentionNotes: `INTENTION: Progression Mode (Tutorial Already Done)

This student is specifically configured to trigger PROGRESSION mode with tutorial satisfied.

Session Mode: PROGRESSION (tutorialRequired: false)

What you should see:
• SessionModeBanner shows "New Skill Available" with next skill name
• Banner has "Start Practice" button (tutorial already done)
• StartPracticeModal shows practice CTA (may show skip count if any)

How it works:
• Has 4 skills practicing, ALL are strong (>= 80% accuracy)
• The next skill in curriculum (fiveComplements.3=5-2) is available
• Tutorial for that skill HAS been completed (tutorialCompleted: true)

Use this to test the progression UI when tutorial is already satisfied.`,
    tutorialCompletedSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2', // Tutorial already completed!
    ],
    skillHistory: [
      // All skills STRONG
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 25 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 22 },
      {
        skillId: 'basic.simpleCombinations',
        targetClassification: 'strong',
        problems: 20,
      },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'strong', problems: 20 },
    ],
  },
  {
    name: '🏆 Maintenance Test',
    emoji: '🏆',
    color: '#0891b2', // cyan-600
    category: 'session',
    description: 'MAINTENANCE MODE - All skills strong, mixed practice',
    currentPhaseId: 'L1.add.+4.five',
    practicingSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
      'fiveComplements.1=5-4',
    ],
    ensureAllPracticingHaveHistory: true, // All practicing skills must be strong for maintenance
    expectedSessionMode: 'maintenance',
    intentionNotes: `INTENTION: Maintenance Mode

This student is specifically configured to trigger MAINTENANCE mode.

Session Mode: MAINTENANCE

What you should see:
• SessionModeBanner shows "Mixed Practice" or similar
• Banner indicates all skills are strong
• StartPracticeModal shows general practice CTA

How it works:
• Has 7 skills practicing (all L1 addition), ALL are strong (>= 80%)
• All practicing skills have enough history to be confident
• There IS a next skill available but this student is at a natural "pause" point
  (actually to force maintenance, we make the next skill's tutorial NOT exist)

NOTE: True maintenance mode is rare in practice - usually there's always a next skill.
This profile demonstrates the maintenance case.

Use this to test the maintenance mode UI in dashboard and modal.`,
    tutorialCompletedSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
      'fiveComplements.1=5-4',
    ],
    skillHistory: [
      // All L1 addition skills STRONG with high confidence
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 30 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 28 },
      {
        skillId: 'basic.simpleCombinations',
        targetClassification: 'strong',
        problems: 25,
      },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'strong', problems: 25 },
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'strong', problems: 22 },
      { skillId: 'fiveComplements.2=5-3', targetClassification: 'strong', problems: 22 },
      { skillId: 'fiveComplements.1=5-4', targetClassification: 'strong', problems: 20 },
    ],
  },

  // =============================================================================
  // Edge Case Test Profiles
  // =============================================================================

  {
    name: '🆕 Brand New Student',
    emoji: '🌱',
    color: '#84cc16', // lime-500
    category: 'edge',
    description: 'EDGE CASE - Zero practicing skills, empty state',
    currentPhaseId: 'L1.add.+1.direct',
    practicingSkills: [], // No skills practicing yet!
    intentionNotes: `INTENTION: Brand New Student (Edge Case)

This student has NO skills practicing yet - they just created their account.

What you should see:
• Dashboard shows empty state or prompts to start placement test
• SkillHealth may be undefined or have zero counts
• Session mode determination may fall back to progression

This tests the empty state handling in the dashboard.

Use this to verify the dashboard handles zero practicing skills gracefully.`,
    skillHistory: [], // No history at all
  },
  {
    name: '🔢 Single Skill Only',
    emoji: '1️⃣',
    color: '#a855f7', // purple-500
    category: 'edge',
    description: 'EDGE CASE - Only one skill practicing',
    currentPhaseId: 'L1.add.+1.direct',
    practicingSkills: ['basic.directAddition'],
    tutorialCompletedSkills: ['basic.directAddition'],
    intentionNotes: `INTENTION: Single Skill Only (Edge Case)

This student is practicing exactly ONE skill. This is the minimum case.

What you should see:
• Dashboard shows counts with total: 1
• Skill badges show correctly with single count
• Progress calculations work with minimal data

Use this to verify the dashboard handles single-skill students correctly.`,
    skillHistory: [
      { skillId: 'basic.directAddition', targetClassification: 'developing', problems: 12 },
    ],
  },
  {
    name: '📊 High Volume Learner',
    emoji: '📈',
    color: '#3b82f6', // blue-500
    category: 'edge',
    description: 'EDGE CASE - Many skills with lots of practice history',
    currentPhaseId: 'L1.sub.-3.five',
    practicingSkills: [
      // All L1 addition
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
      'fiveComplements.1=5-4',
      // L1 subtraction basics
      'basic.directSubtraction',
      'basic.heavenBeadSubtraction',
    ],
    ensureAllPracticingHaveHistory: true,
    tutorialCompletedSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
      'fiveComplements.1=5-4',
      'basic.directSubtraction',
      'basic.heavenBeadSubtraction',
    ],
    intentionNotes: `INTENTION: High Volume Learner

This student has practiced MANY skills with extensive history - tests dashboard with lots of data.

Curriculum position: Mid L1 Subtraction (L1.sub.-3.five)
Practicing skills: All L1 addition + early subtraction (9 skills total)

Use this to verify:
• Dashboard handles many skills gracefully
• Skill list scrolling/pagination works
• Performance with larger skill counts
• Progress calculations with extensive history`,
    skillHistory: [
      // All L1 addition - strong
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 40 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 35 },
      { skillId: 'basic.simpleCombinations', targetClassification: 'strong', problems: 30 },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'strong', problems: 28 },
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'strong', problems: 25 },
      { skillId: 'fiveComplements.2=5-3', targetClassification: 'strong', problems: 25 },
      { skillId: 'fiveComplements.1=5-4', targetClassification: 'strong', problems: 22 },
      // Subtraction - developing
      { skillId: 'basic.directSubtraction', targetClassification: 'developing', problems: 15 },
      { skillId: 'basic.heavenBeadSubtraction', targetClassification: 'developing', problems: 12 },
    ],
  },
  {
    name: '⚖️ Multi-Weak Remediation',
    emoji: '⚖️',
    color: '#f97316', // orange-500
    category: 'edge',
    description: 'EDGE CASE - Many weak skills needing remediation',
    currentPhaseId: 'L1.add.+2.five',
    practicingSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
    ],
    tutorialCompletedSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
    ],
    intentionNotes: `INTENTION: Multi-Weak Remediation (Edge Case)

Originally intended as "balanced mix" with 2 strong + 2 developing + 2 weak,
but BKT's binary nature pushes skills to extremes. Actual output:
• 2 Strong (basic.directAddition, basic.heavenBead)
• 4 Weak (simpleCombinations, fiveComplements.4/3/2=5-...)

REFRAMED PURPOSE - Tests important app features:
• Remediation mode with MANY weak skills (4+)
• Dashboard weak skills display with overflow
• Session mode banner showing multiple skills to strengthen
• Skill list with many red/weak indicators

Use this to verify UI handles many weak skills gracefully.
Complements 🔴 Multi-Skill Deficient (which has only 2 weak).`,
    skillHistory: [
      // 2 Strong
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 25 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 22 },
      // 2 Developing
      {
        skillId: 'basic.simpleCombinations',
        targetClassification: 'developing',
        problems: 15,
      },
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'developing', problems: 14 },
      // 2 Weak
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'weak', problems: 18 },
      { skillId: 'fiveComplements.2=5-3', targetClassification: 'weak', problems: 16 },
    ],
    // Need at least 2 weak for remediation testing
    successCriteria: { minWeak: 2 },
  },
  {
    name: '🕰️ Stale Skills Test',
    emoji: '⏰',
    color: '#6b7280', // gray-500
    category: 'edge',
    description: 'EDGE CASE - Skills at various staleness levels',
    currentPhaseId: 'L1.add.+2.five',
    practicingSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
    ],
    tutorialCompletedSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
    ],
    intentionNotes: `INTENTION: Stale Skills Test

This student has skills at various staleness levels to test the Stale Skills Section in the Skills tab.

Session Mode: Will depend on BKT state after decay is applied.

Staleness levels:
• 2 skills practiced recently (1 day ago) - should NOT appear in stale section
• 2 skills practiced 10 days ago - "Not practiced recently"
• 1 skill practiced 20 days ago - "Getting rusty"
• 1 skill practiced 45 days ago - "Very stale"

Use this to test:
• StaleSkillsSection component rendering
• "Mark Current" refresh functionality
• Different staleness warning messages
• BKT decay effects on old skills`,
    skillHistory: [
      // Recent skills (1 day ago) - NOT stale
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 20, ageDays: 1 },
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 18, ageDays: 1 },
      // "Not practiced recently" (7-14 days)
      {
        skillId: 'basic.simpleCombinations',
        targetClassification: 'strong',
        problems: 15,
        ageDays: 10,
      },
      {
        skillId: 'fiveComplements.4=5-1',
        targetClassification: 'strong',
        problems: 16,
        ageDays: 10,
      },
      // "Getting rusty" (14-30 days)
      {
        skillId: 'fiveComplements.3=5-2',
        targetClassification: 'strong',
        problems: 18,
        ageDays: 20,
      },
      // "Very stale" (30+ days)
      {
        skillId: 'fiveComplements.2=5-3',
        targetClassification: 'strong',
        problems: 16,
        ageDays: 45,
      },
    ],
  },
  {
    name: '💥 NaN Stress Test',
    emoji: '💥',
    color: '#dc2626', // red-600
    category: 'edge',
    description: 'EDGE CASE - Stress tests BKT NaN handling with extreme data',
    currentPhaseId: 'L1.add.+3.five',
    practicingSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
    ],
    tutorialCompletedSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
    ],
    intentionNotes: `INTENTION: NaN Stress Test

This student is specifically designed to stress test the BKT NaN handling code.

ROOT CAUSE TESTED: The production NaN bug was caused by legacy data missing
the 'hadHelp' field. The helpWeight() function had no default case,
returning undefined, which caused 'undefined * rtWeight = NaN' to propagate.

The profile includes:
• LEGACY DATA: Skills missing 'hadHelp' (tests the actual root cause)
• Skills with EXTREME accuracy values (0.01 and 0.99)
• Very high problem counts (100+ per skill)
• Mixed recent and very old practice dates
• Boundary conditions that could trigger floating point edge cases

The BKT calculation should handle all of these gracefully:
• No NaN values in the output
• Legacy data should be processed with weight 1.0 (neutral)
• UI should display valid percentages for all skills

If you see "⚠️ Data Error" or NaN values in the dashboard:
1. Check browser console for [BKT] warnings
2. Investigate the specific skill that failed
3. Check the problem history for that skill

Use this profile to verify:
• Legacy data without hadHelp is handled (weight defaults to 1.0)
• BKT core calculations handle extreme pKnown values
• Conjunctive BKT blame attribution works with edge cases
• Evidence quality weights don't produce NaN
• UI gracefully shows errors for any corrupted data`,
    skillHistory: [
      // LEGACY DATA TEST - missing hadHelp (the actual root cause)
      {
        skillId: 'basic.directAddition',
        targetClassification: 'strong',
        problems: 30,
        simulateLegacyData: true,
      },
      {
        skillId: 'basic.heavenBead',
        targetClassification: 'developing',
        problems: 25,
        simulateLegacyData: true,
      },
      // STRONG with many problems
      { skillId: 'basic.simpleCombinations', targetClassification: 'strong', problems: 100 },
      // WEAK with many problems
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'weak', problems: 100 },
      // DEVELOPING
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'developing', problems: 50 },
      // Very old skill with legacy data (tests decay + legacy handling)
      {
        skillId: 'fiveComplements.2=5-3',
        targetClassification: 'strong',
        problems: 40,
        ageDays: 90,
        simulateLegacyData: true,
      },
    ],
  },
  {
    name: '🧊 Forgotten Weaknesses',
    emoji: '🧊',
    color: '#3b82f6', // blue-500
    category: 'edge',
    description: 'EDGE CASE - Weak skills that are also stale (urgent remediation needed)',
    currentPhaseId: 'L1.add.+2.five',
    practicingSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
    ],
    tutorialCompletedSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
      'fiveComplements.3=5-2',
      'fiveComplements.2=5-3',
    ],
    intentionNotes: `INTENTION: Forgotten Weaknesses

This student has a realistic mix of weak and stale skills - NOT the same set.

Session Mode: Should trigger REMEDIATION.

Skill breakdown:
• 1 skill STRONG + recent (healthy baseline)
• 1 skill STRONG + stale 20 days (stale-only, should refresh easily)
• 1 skill WEAK + recent (weak-only, actively struggling)
• 1 skill WEAK + stale 14 days (overlap: weak AND stale)
• 1 skill WEAK + stale 35 days (overlap: urgent forgotten weakness)
• 1 skill DEVELOPING + stale 25 days (borderline, needs attention)

This tests:
• Different combinations of weak/stale indicators
• UI distinguishing "stale but strong" from "stale AND weak"
• Session planning prioritizing weak+stale over strong+stale
• BKT decay effects on skills at different mastery levels

Real-world scenario: Student has been practicing inconsistently. Some skills
are rusty from neglect (stale), others they just can't get (weak), and some
are both - the forgotten weaknesses that need urgent attention.`,
    skillHistory: [
      // STRONG + recent (healthy baseline)
      { skillId: 'basic.directAddition', targetClassification: 'strong', problems: 20, ageDays: 1 },
      // STRONG + stale 20 days (stale-only - "Getting rusty" but should be fine)
      { skillId: 'basic.heavenBead', targetClassification: 'strong', problems: 18, ageDays: 20 },
      // WEAK + recent (weak-only - actively struggling with this)
      {
        skillId: 'basic.simpleCombinations',
        targetClassification: 'weak',
        problems: 15,
        ageDays: 2,
      },
      // WEAK + stale 14 days (overlap: weak AND "Not practiced recently")
      { skillId: 'fiveComplements.4=5-1', targetClassification: 'weak', problems: 14, ageDays: 14 },
      // WEAK + stale 35 days (overlap: urgent - weak AND "Very stale")
      { skillId: 'fiveComplements.3=5-2', targetClassification: 'weak', problems: 18, ageDays: 35 },
      // DEVELOPING + stale 25 days (borderline - needs practice)
      {
        skillId: 'fiveComplements.2=5-3',
        targetClassification: 'developing',
        problems: 16,
        ageDays: 25,
      },
    ],
    // Need at least 3 weak for this profile
    successCriteria: { minWeak: 3 },
  },
]

// =============================================================================
// CLI Helper Functions
// =============================================================================

function listProfiles(): void {
  console.log('\n📋 Available Test Students:\n')

  const categories: Record<ProfileCategory, TestStudentProfile[]> = {
    bkt: [],
    session: [],
    edge: [],
  }

  for (const profile of TEST_PROFILES) {
    categories[profile.category].push(profile)
  }

  console.log('BKT Scenarios (--category bkt):')
  for (const p of categories.bkt) {
    console.log(`  ${p.name}`)
    console.log(`    ${p.description}`)
  }

  console.log('\nSession Mode Tests (--category session):')
  for (const p of categories.session) {
    console.log(`  ${p.name}`)
    console.log(`    ${p.description}`)
  }

  console.log('\nEdge Cases (--category edge):')
  for (const p of categories.edge) {
    console.log(`  ${p.name}`)
    console.log(`    ${p.description}`)
  }

  console.log(`\nTotal: ${TEST_PROFILES.length} students\n`)
}

/**
 * Filter profiles based on CLI args (name and category filters)
 */
function filterProfiles(profiles: TestStudentProfile[]): TestStudentProfile[] {
  const names = cliArgs.name as string[]
  const categories = cliArgs.category as string[]

  // If no filters, return all
  if (names.length === 0 && categories.length === 0) {
    return profiles
  }

  return profiles.filter((profile) => {
    // Check name filter (partial match, case-insensitive)
    const matchesName =
      names.length === 0 ||
      names.some(
        (n) =>
          profile.name.toLowerCase().includes(n.toLowerCase()) ||
          n.toLowerCase().includes(profile.name.toLowerCase())
      )

    // Check category filter
    const matchesCategory = categories.length === 0 || categories.includes(profile.category)

    // If both filters specified, must match at least one
    if (names.length > 0 && categories.length > 0) {
      return matchesName || matchesCategory
    }

    // If only one filter type, must match that one
    return matchesName && matchesCategory
  })
}

// =============================================================================
// Helpers
// =============================================================================

function generateSlotResults(
  config: SkillConfig,
  startIndex: number,
  sessionStartTime: Date
): SlotResult[] {
  // Generate realistic problems targeting the skill
  const realisticProblems = generateRealisticProblems(config.skillId, config.problems)

  // Design a sequence that will reliably produce the target BKT classification
  // This replaces random shuffling with deterministic patterns
  const correctnessSequence = designSequenceForClassification(
    config.skillId,
    config.problems,
    config.targetClassification
  )

  return realisticProblems.map((realistic, i) => {
    const isCorrect = correctnessSequence[i]

    // Convert to the schema's GeneratedProblem format
    const problem: GeneratedProblem = {
      terms: realistic.terms,
      answer: realistic.answer,
      skillsRequired: realistic.skillsUsed,
      generationTrace: realistic.generationTrace,
    }

    // Generate a plausible wrong answer if incorrect
    const wrongAnswer =
      realistic.answer + (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 3) + 1)

    const baseResult = {
      partNumber: 1 as const,
      slotIndex: startIndex + i,
      problem,
      studentAnswer: isCorrect ? realistic.answer : wrongAnswer,
      isCorrect,
      responseTimeMs: 4000 + Math.random() * 2000,
      skillsExercised: realistic.skillsUsed, // ALL skills used, not just target
      usedOnScreenAbacus: false,
      timestamp: new Date(sessionStartTime.getTime() + (startIndex + i) * 10000),
      incorrectAttempts: isCorrect ? 0 : 1,
    }

    // If simulating legacy data, omit hadHelp and helpTrigger
    // This tests the NaN handling code path for old data missing these fields
    if (config.simulateLegacyData) {
      return baseResult as SlotResult
    }

    return {
      ...baseResult,
      hadHelp: false,
      helpTrigger: 'none' as const,
    }
  })
}

/**
 * Check if a profile's outcomes meet its success criteria
 */
function checkSuccessCriteria(
  classifications: Record<string, number>,
  criteria?: SuccessCriteria
): { success: boolean; reasons: string[] } {
  if (!criteria) {
    return { success: true, reasons: [] }
  }

  const reasons: string[] = []
  const { weak, developing, strong } = classifications

  if (criteria.minWeak !== undefined && weak < criteria.minWeak) {
    reasons.push(`Need at least ${criteria.minWeak} weak skills, got ${weak}`)
  }
  if (criteria.maxWeak !== undefined && weak > criteria.maxWeak) {
    reasons.push(`Need at most ${criteria.maxWeak} weak skills, got ${weak}`)
  }
  if (criteria.minDeveloping !== undefined && developing < criteria.minDeveloping) {
    reasons.push(`Need at least ${criteria.minDeveloping} developing skills, got ${developing}`)
  }
  if (criteria.maxDeveloping !== undefined && developing > criteria.maxDeveloping) {
    reasons.push(`Need at most ${criteria.maxDeveloping} developing skills, got ${developing}`)
  }
  if (criteria.minStrong !== undefined && strong < criteria.minStrong) {
    reasons.push(`Need at least ${criteria.minStrong} strong skills, got ${strong}`)
  }
  if (criteria.maxStrong !== undefined && strong > criteria.maxStrong) {
    reasons.push(`Need at most ${criteria.maxStrong} strong skills, got ${strong}`)
  }

  return { success: reasons.length === 0, reasons }
}

/**
 * Apply tuning adjustments to skill history
 */
function applyTuningAdjustments(
  skillHistory: SkillConfig[],
  adjustments?: TuningAdjustment[]
): SkillConfig[] {
  if (!adjustments || adjustments.length === 0) {
    return skillHistory
  }

  return skillHistory.map((config) => {
    const newConfig = { ...config }

    for (const adj of adjustments) {
      if (adj.skillId === 'all' || adj.skillId === config.skillId) {
        if (adj.problemsAdd !== undefined) {
          newConfig.problems = newConfig.problems + adj.problemsAdd
        }
        if (adj.problemsMultiplier !== undefined) {
          newConfig.problems = Math.round(newConfig.problems * adj.problemsMultiplier)
        }
      }
    }

    return newConfig
  })
}

/**
 * Tuning history entry
 */
interface TuningRound {
  round: number
  classifications: Record<string, number>
  success: boolean
  failureReasons: string[]
  adjustmentsApplied: string[]
}

/**
 * Format tuning history for notes
 */
function formatTuningHistory(history: TuningRound[]): string {
  if (history.length <= 1) {
    return '' // No tuning needed
  }

  const lines: string[] = []
  lines.push('')
  lines.push('───────────────────────────────────────────────────────────')
  lines.push('TUNING HISTORY')
  lines.push('───────────────────────────────────────────────────────────')

  for (const round of history) {
    lines.push('')
    lines.push(`Round ${round.round}:`)
    lines.push(
      `  Classifications: 🔴 ${round.classifications.weak} weak, 📚 ${round.classifications.developing} developing, ✅ ${round.classifications.strong} strong`
    )

    if (round.success) {
      lines.push(`  Result: ✅ Success`)
    } else {
      lines.push(`  Result: ❌ Failed`)
      for (const reason of round.failureReasons) {
        lines.push(`    - ${reason}`)
      }
      if (round.adjustmentsApplied.length > 0) {
        lines.push(`  Adjustments applied for next round:`)
        for (const adj of round.adjustmentsApplied) {
          lines.push(`    - ${adj}`)
        }
      }
    }
  }

  return lines.join('\n')
}

/**
 * Format BKT results into a human-readable summary for notes
 */
function formatActualOutcomes(
  bktResult: { skills: SkillBktResult[] },
  profile: TestStudentProfile,
  tuningHistory?: TuningRound[]
): string {
  const skillsByClassification: Record<string, SkillBktResult[]> = {
    weak: [],
    developing: [],
    strong: [],
  }

  for (const skill of bktResult.skills) {
    if (skill.masteryClassification) {
      skillsByClassification[skill.masteryClassification].push(skill)
    }
  }

  const lines: string[] = []
  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════')
  lines.push('ACTUAL OUTCOMES (generated by seeder)')
  lines.push('═══════════════════════════════════════════════════════════')
  lines.push('')
  lines.push(`BKT Classification Counts:`)
  lines.push(`  🔴 Weak: ${skillsByClassification.weak.length}`)
  lines.push(`  📚 Developing: ${skillsByClassification.developing.length}`)
  lines.push(`  ✅ Strong: ${skillsByClassification.strong.length}`)
  lines.push('')

  if (profile.expectedSessionMode) {
    lines.push(`Expected Session Mode: ${profile.expectedSessionMode.toUpperCase()}`)
    // Determine actual mode based on BKT
    let actualMode = 'maintenance'
    if (skillsByClassification.weak.length > 0) {
      actualMode = 'remediation'
    } else if (skillsByClassification.strong.length === profile.practicingSkills.length) {
      actualMode = 'progression'
    }
    const matches = actualMode === profile.expectedSessionMode ? '✅' : '⚠️'
    lines.push(`Actual Session Mode: ${actualMode.toUpperCase()} ${matches}`)
    lines.push('')
  }

  // List skills by classification with pKnown values
  if (skillsByClassification.weak.length > 0) {
    lines.push('Weak Skills (pKnown < 0.5):')
    for (const skill of skillsByClassification.weak) {
      lines.push(`  - ${skill.skillId}: ${(skill.pKnown * 100).toFixed(0)}%`)
    }
    lines.push('')
  }

  if (skillsByClassification.developing.length > 0) {
    lines.push('Developing Skills (0.5 ≤ pKnown < 0.8):')
    for (const skill of skillsByClassification.developing) {
      lines.push(`  - ${skill.skillId}: ${(skill.pKnown * 100).toFixed(0)}%`)
    }
    lines.push('')
  }

  if (skillsByClassification.strong.length > 0) {
    lines.push('Strong Skills (pKnown ≥ 0.8):')
    for (const skill of skillsByClassification.strong) {
      lines.push(`  - ${skill.skillId}: ${(skill.pKnown * 100).toFixed(0)}%`)
    }
    lines.push('')
  }

  lines.push(`Generated: ${new Date().toISOString()}`)

  // Add tuning history if present
  if (tuningHistory && tuningHistory.length > 0) {
    lines.push(formatTuningHistory(tuningHistory))
  }

  return lines.join('\n')
}

async function createTestStudent(
  profile: TestStudentProfile,
  userId: string,
  skillHistoryOverride?: SkillConfig[]
): Promise<{
  playerId: string
  classifications: Record<string, number>
  bktResult: { skills: SkillBktResult[] }
}> {
  let effectiveSkillHistory = skillHistoryOverride ?? profile.skillHistory

  // If ensureAllPracticingHaveHistory is set, add missing practicing skills with default strong history
  if (profile.ensureAllPracticingHaveHistory) {
    const historySkillIds = new Set(effectiveSkillHistory.map((c) => c.skillId))
    const missingSkills: SkillConfig[] = []

    for (const skillId of profile.practicingSkills) {
      if (!historySkillIds.has(skillId)) {
        // Add a default "strong" config for missing skills
        missingSkills.push({
          skillId,
          targetClassification: 'strong',
          problems: 15,
        })
      }
    }

    if (missingSkills.length > 0) {
      effectiveSkillHistory = [...effectiveSkillHistory, ...missingSkills]
    }
  }
  // Delete existing player with this name
  const existing = await db.query.players.findFirst({
    where: eq(schema.players.name, profile.name),
  })
  if (existing) {
    await db.delete(schema.players).where(eq(schema.players.id, existing.id))
  }

  // Create player with intention notes only (will update with actual outcomes later)
  const playerId = createId()
  await db.insert(schema.players).values({
    id: playerId,
    userId,
    name: profile.name,
    emoji: profile.emoji,
    color: profile.color,
    isActive: true,
    notes: profile.intentionNotes,
  })

  // Build a map of skill -> age from skill history
  const skillAgeMap = new Map<string, number>()
  for (const config of effectiveSkillHistory) {
    skillAgeMap.set(config.skillId, config.ageDays ?? 1)
  }

  // Create skill mastery records for practicing skills
  // Note: attempts/correct are computed on-the-fly from session results
  for (const skillId of profile.practicingSkills) {
    const ageDays = skillAgeMap.get(skillId) ?? 1
    const lastPracticedAt = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000)

    await db.insert(schema.playerSkillMastery).values({
      id: createId(),
      playerId,
      skillId,
      isPracticing: true,
      lastPracticedAt,
    })
  }

  // Create tutorial progress records for completed tutorials
  if (profile.tutorialCompletedSkills) {
    for (const skillId of profile.tutorialCompletedSkills) {
      await db.insert(schema.skillTutorialProgress).values({
        id: createId(),
        playerId,
        skillId,
        tutorialCompleted: true,
        completedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
        teacherOverride: false,
        skipCount: 0,
      })
    }
  }

  // Group skills by age (days ago) to create separate sessions
  const skillsByAge = new Map<number, SkillConfig[]>()
  for (const config of effectiveSkillHistory) {
    const age = config.ageDays ?? 1 // Default to 1 day ago
    const existing = skillsByAge.get(age) ?? []
    existing.push(config)
    skillsByAge.set(age, existing)
  }

  // Create a session for each age group
  for (const [ageDays, skills] of skillsByAge) {
    const sessionStartTime = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000)
    const allResults: SlotResult[] = []
    let currentIndex = 0

    for (const config of skills) {
      const results = generateSlotResults(config, currentIndex, sessionStartTime)
      allResults.push(...results)
      currentIndex += config.problems
    }

    // IMPORTANT: Do NOT shuffle results - we need to preserve the designed sequence order
    // for predictable BKT outcomes. The order of correct/incorrect matters significantly
    // because BKT applies learning transitions only after correct answers.
    const orderedResults = allResults.map((r, i) => ({
      ...r,
      slotIndex: i,
      timestamp: new Date(sessionStartTime.getTime() + i * 10000),
    }))

    // Create session
    const sessionId = createId()
    const sessionEndTime = new Date(sessionStartTime.getTime() + orderedResults.length * 10000)

    const slots = orderedResults.map((r, i) => ({
      index: i,
      purpose: 'focus' as const,
      constraints: {},
      problem: r.problem,
    }))

    const parts: SessionPart[] = [
      {
        partNumber: 1,
        type: 'linear',
        format: 'linear',
        useAbacus: false,
        slots,
        estimatedMinutes: 30,
      },
    ]

    const summary: SessionSummary = {
      focusDescription: `Test session for ${profile.name} (${ageDays} days ago)`,
      totalProblemCount: orderedResults.length,
      estimatedMinutes: 30,
      parts: [
        {
          partNumber: 1,
          type: 'linear',
          description: 'Mental Math (Linear)',
          problemCount: orderedResults.length,
          estimatedMinutes: 30,
        },
      ],
    }

    await db.insert(schema.sessionPlans).values({
      id: sessionId,
      playerId,
      targetDurationMinutes: 30,
      estimatedProblemCount: orderedResults.length,
      avgTimePerProblemSeconds: 5,
      parts,
      summary,
      masteredSkillIds: profile.practicingSkills,
      status: 'completed',
      currentPartIndex: 1,
      currentSlotIndex: 0,
      sessionHealth: {
        overall: 'good',
        accuracy: 0.6,
        pacePercent: 100,
        currentStreak: 0,
        avgResponseTimeMs: 5000,
      },
      adjustments: [],
      results: orderedResults,
      createdAt: sessionStartTime,
      approvedAt: sessionStartTime,
      startedAt: sessionStartTime,
      completedAt: sessionEndTime,
    })
  }

  // Compute BKT classifications from the generated data
  // Note: Skill stats (attempts/correct) are computed on-the-fly from session results
  // so we don't need to update playerSkillMastery aggregate columns
  const problemHistory = await getRecentSessionResults(playerId, 200)
  const bktResult = computeBktFromHistory(problemHistory, {
    confidenceThreshold: BKT_THRESHOLDS.confidence,
  })

  const classifications: Record<string, number> = {
    weak: 0,
    developing: 0,
    strong: 0,
  }
  for (const skill of bktResult.skills) {
    if (skill.masteryClassification) {
      classifications[skill.masteryClassification]++
    }
  }

  return { playerId, classifications, bktResult }
}

/**
 * Create a test student with iterative tuning (up to maxRounds)
 */
async function createTestStudentWithTuning(
  profile: TestStudentProfile,
  userId: string,
  maxRounds: number = 3
): Promise<{
  playerId: string
  classifications: Record<string, number>
  tuningHistory: TuningRound[]
}> {
  const tuningHistory: TuningRound[] = []
  let currentSkillHistory = profile.skillHistory
  let result: {
    playerId: string
    classifications: Record<string, number>
    bktResult: { skills: SkillBktResult[] }
  }

  for (let round = 1; round <= maxRounds; round++) {
    // Generate the student
    result = await createTestStudent(profile, userId, currentSkillHistory)

    // Check success criteria
    const { success, reasons } = checkSuccessCriteria(
      result.classifications,
      profile.successCriteria
    )

    // Record this round
    const roundEntry: TuningRound = {
      round,
      classifications: { ...result.classifications },
      success,
      failureReasons: reasons,
      adjustmentsApplied: [],
    }

    if (success || round === maxRounds) {
      // Success or final round - we're done
      tuningHistory.push(roundEntry)
      break
    }

    // Need to tune - apply adjustments
    if (profile.tuningAdjustments) {
      currentSkillHistory = applyTuningAdjustments(currentSkillHistory, profile.tuningAdjustments)
      roundEntry.adjustmentsApplied = profile.tuningAdjustments.map((adj) => {
        const parts: string[] = []
        if (adj.accuracyMultiplier) parts.push(`accuracy × ${adj.accuracyMultiplier}`)
        if (adj.problemsAdd) parts.push(`problems + ${adj.problemsAdd}`)
        if (adj.problemsMultiplier) parts.push(`problems × ${adj.problemsMultiplier}`)
        return `${adj.skillId}: ${parts.join(', ')}`
      })
    }

    tuningHistory.push(roundEntry)

    // Delete the student so we can recreate with adjusted params
    await db.delete(schema.players).where(eq(schema.players.id, result.playerId))
  }

  // Update the final student's notes with tuning history
  const actualOutcomes = formatActualOutcomes(result!.bktResult, profile, tuningHistory)
  const fullNotes = profile.intentionNotes + actualOutcomes

  await db
    .update(schema.players)
    .set({ notes: fullNotes })
    .where(eq(schema.players.id, result!.playerId))

  return {
    playerId: result!.playerId,
    classifications: result!.classifications,
    tuningHistory,
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  // Handle --help
  if (cliArgs.help) {
    showHelp()
    process.exit(0)
  }

  // Handle --list
  if (cliArgs.list) {
    listProfiles()
    process.exit(0)
  }

  // Filter profiles based on CLI args
  const profilesToSeed = filterProfiles(TEST_PROFILES)

  if (profilesToSeed.length === 0) {
    console.log('❌ No students match the specified filters.')
    console.log('   Use --list to see available students.')
    process.exit(1)
  }

  // Handle --dry-run
  if (cliArgs['dry-run']) {
    console.log('🧪 DRY RUN - Would seed the following students:\n')
    for (const profile of profilesToSeed) {
      console.log(`   ${profile.name} [${profile.category}]`)
      console.log(`      ${profile.description}`)
    }
    console.log(`\nTotal: ${profilesToSeed.length} students`)
    process.exit(0)
  }

  console.log('🧪 Seeding Test Students for BKT Testing...\n')

  // Show filter info if applicable
  const names = cliArgs.name as string[]
  const categories = cliArgs.category as string[]
  if (names.length > 0 || categories.length > 0) {
    console.log(`   Filtering: ${profilesToSeed.length} of ${TEST_PROFILES.length} students`)
    if (names.length > 0) console.log(`   Names: ${names.join(', ')}`)
    if (categories.length > 0) console.log(`   Categories: ${categories.join(', ')}`)
    console.log('')
  }

  // Find the most recent browser session by looking at recent session activity
  // This is more reliable than player creation time
  console.log('1. Finding most recent browser session...')

  // First, try to find the most recent session from a real (non-test) player
  const recentSession = await db.query.sessionPlans.findFirst({
    orderBy: [desc(schema.sessionPlans.createdAt)],
  })

  let userId: string | null = null
  let foundVia = ''

  if (recentSession) {
    // Look up the player for this session
    const sessionPlayer = await db.query.players.findFirst({
      where: eq(schema.players.id, recentSession.playerId),
    })

    // Check if this is a test user (exclude test-user-* pattern)
    if (sessionPlayer && !sessionPlayer.userId.startsWith('test-user')) {
      userId = sessionPlayer.userId
      foundVia = `session activity from player: ${sessionPlayer.name}`
    }
  }

  // Fallback: find a real player (exclude test users and test emoji names)
  if (!userId) {
    const testEmojiPatterns = [
      '🔴',
      '🟡',
      '🟢',
      '⭐',
      '🚀',
      '🎯',
      '📚',
      '🏆',
      '🆕',
      '🔢',
      '📊',
      '⚖️',
      '🕰️',
    ]

    const realPlayer = await db.query.players.findFirst({
      where: (players, { not, like, and, notLike }) =>
        and(
          not(like(players.name, '%Test%')),
          notLike(players.userId, 'test-user%'),
          // Exclude common test emoji prefixes
          ...testEmojiPatterns.map((emoji) => notLike(players.name, `${emoji}%`))
        ),
      orderBy: [desc(schema.players.createdAt)],
    })

    if (realPlayer) {
      userId = realPlayer.userId
      foundVia = `player: ${realPlayer.name}`
    }
  }

  if (!userId) {
    console.error('❌ No real users found! Create a student at /practice first.')
    console.error('   (Make sure you have a non-test player in your browser session)')
    process.exit(1)
  }

  console.log(`   Found user via ${foundVia}`)

  // Create each test profile with iterative tuning (up to 3 rounds)
  console.log('\n2. Creating test students (with up to 2 tuning rounds if needed)...\n')

  for (const profile of profilesToSeed) {
    const { playerId, classifications, tuningHistory } = await createTestStudentWithTuning(
      profile,
      userId,
      3 // maxRounds: initial + 2 tuning rounds
    )
    const { weak, developing, strong } = classifications

    console.log(`   ${profile.name}`)
    console.log(`      ${profile.description}`)
    console.log(`      Phase: ${profile.currentPhaseId}`)
    console.log(`      Practicing: ${profile.practicingSkills.length} skills`)
    console.log(
      `      Classifications: 🔴 ${weak} weak, 📚 ${developing} developing, ✅ ${strong} strong`
    )
    if (profile.expectedSessionMode) {
      console.log(`      Expected Mode: ${profile.expectedSessionMode.toUpperCase()}`)
    }
    if (profile.tutorialCompletedSkills) {
      console.log(`      Tutorials Completed: ${profile.tutorialCompletedSkills.length} skills`)
    }
    if (tuningHistory.length > 1) {
      const finalRound = tuningHistory[tuningHistory.length - 1]
      console.log(
        `      Tuning: ${tuningHistory.length} rounds, final: ${finalRound.success ? '✅ success' : '⚠️ best effort'}`
      )
    }
    console.log(`      Player ID: ${playerId}`)
    console.log('')
  }

  console.log('✅ All test students created!')
  console.log('\n   Visit http://localhost:3000/practice to see them.')
}

main().catch((err) => {
  console.error('Error seeding test students:', err)
  process.exit(1)
})
