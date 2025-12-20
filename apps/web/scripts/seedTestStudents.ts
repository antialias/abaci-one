#!/usr/bin/env npx tsx
/**
 * Seed script to create multiple test students with different BKT scenarios.
 *
 * Creates students with realistic curriculum progressions:
 * - "🔴 Multi-Skill Deficient" - Early L1, struggling with basics
 * - "🟡 Single-Skill Blocker" - Mid L1, one five-complement blocking
 * - "🟢 Progressing Nicely" - Mid L1, healthy mix
 * - "⭐ Ready to Level Up" - End of L1 addition, all strong
 * - "🚀 Overdue for Promotion" - Has mastered L1, ready for L2
 *
 * Session Mode Test Profiles:
 * - "🎯 Remediation Test" - REMEDIATION mode (weak skills blocking promotion)
 * - "📚 Progression Tutorial Test" - PROGRESSION mode (tutorial required)
 * - "🚀 Progression Ready Test" - PROGRESSION mode (tutorial done)
 * - "🏆 Maintenance Test" - MAINTENANCE mode (all skills strong)
 *
 * Usage: npm run seed:test-students
 */

import { createId } from '@paralleldrive/cuid2'
import { desc, eq } from 'drizzle-orm'
import { db, schema } from '../src/db'
import { computeBktFromHistory } from '../src/lib/curriculum/bkt'
import { BKT_THRESHOLDS } from '../src/lib/curriculum/config/bkt-integration'
import { getRecentSessionResults } from '../src/lib/curriculum/session-planner'
import type {
  GeneratedProblem,
  SessionPart,
  SessionSummary,
  SlotResult,
} from '../src/db/schema/session-plans'

// =============================================================================
// Test Student Profiles
// =============================================================================

interface SkillConfig {
  skillId: string
  targetAccuracy: number
  problems: number
  /** Days ago this skill was practiced (default: 1 day) */
  ageDays?: number
}

interface TestStudentProfile {
  name: string
  emoji: string
  color: string
  description: string
  notes: string
  /** Skills that should have isPracticing = true (realistic curriculum progression) */
  practicingSkills: string[]
  /** Skills with problem history (can include non-practicing for testing edge cases) */
  skillHistory: SkillConfig[]
  /** Curriculum phase this student is nominally at */
  currentPhaseId: string
  /** Skills that should have their tutorial marked as completed */
  tutorialCompletedSkills?: string[]
  /** Expected session mode for this profile */
  expectedSessionMode?: 'remediation' | 'progression' | 'maintenance'
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
    description: 'Struggling with many skills - needs intervention',
    currentPhaseId: 'L1.add.+3.direct',
    practicingSkills: EARLY_L1_SKILLS,
    notes: `TEST STUDENT: Multi-Skill Deficient

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
      { skillId: 'basic.directAddition', targetAccuracy: 0.35, problems: 15 },
      { skillId: 'basic.heavenBead', targetAccuracy: 0.28, problems: 12 },
    ],
  },
  {
    name: '🟡 Single-Skill Blocker',
    emoji: '🤔',
    color: '#f59e0b', // amber
    description: 'One weak skill blocking progress, others are fine',
    currentPhaseId: 'L1.add.+2.five',
    practicingSkills: MID_L1_SKILLS,
    notes: `TEST STUDENT: Single-Skill Blocker

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
      { skillId: 'basic.directAddition', targetAccuracy: 0.92, problems: 20 },
      { skillId: 'basic.heavenBead', targetAccuracy: 0.88, problems: 18 },
      {
        skillId: 'basic.simpleCombinations',
        targetAccuracy: 0.85,
        problems: 15,
      },
      // Strong in first five complement
      { skillId: 'fiveComplements.4=5-1', targetAccuracy: 0.87, problems: 16 },
      // THE BLOCKER - weak despite practice
      { skillId: 'fiveComplements.3=5-2', targetAccuracy: 0.22, problems: 18 },
    ],
  },
  {
    name: '🟢 Progressing Nicely',
    emoji: '😊',
    color: '#22c55e', // green
    description: 'Healthy progression - mix of developing and strong skills',
    currentPhaseId: 'L1.add.+3.five',
    practicingSkills: MID_L1_SKILLS,
    notes: `TEST STUDENT: Progressing Nicely

This student shows a healthy learning trajectory - basics are solid, middle skills are developing, and newest skill is appropriately weak (just started).

Curriculum position: Mid L1 (L1.add.+3.five)
Practicing skills: basics + first two five complements

Skill status:
• Strong: basic.directAddition, basic.heavenBead (mastered)
• Developing: basic.simpleCombinations, fiveComplements.4=5-1
• Weak: fiveComplements.3=5-2 (just introduced, expected)

This is what a "healthy" student looks like - no intervention needed, just continue the curriculum.

Use this student to verify normal dashboard display without intervention flags.`,
    skillHistory: [
      // Strong basics (mastered)
      { skillId: 'basic.directAddition', targetAccuracy: 0.94, problems: 25 },
      { skillId: 'basic.heavenBead', targetAccuracy: 0.91, problems: 22 },
      // Developing
      {
        skillId: 'basic.simpleCombinations',
        targetAccuracy: 0.55,
        problems: 10,
      },
      { skillId: 'fiveComplements.4=5-1', targetAccuracy: 0.52, problems: 8 },
      // Just started (expected to be weak)
      { skillId: 'fiveComplements.3=5-2', targetAccuracy: 0.25, problems: 6 },
    ],
  },
  {
    name: '⭐ Ready to Level Up',
    emoji: '🌟',
    color: '#8b5cf6', // violet
    description: 'All skills strong - ready for next curriculum phase',
    currentPhaseId: 'L1.add.+1.five',
    practicingSkills: LATE_L1_ADD_SKILLS,
    notes: `TEST STUDENT: Ready to Level Up

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
      { skillId: 'basic.directAddition', targetAccuracy: 0.95, problems: 25 },
      { skillId: 'basic.heavenBead', targetAccuracy: 0.93, problems: 25 },
      {
        skillId: 'basic.simpleCombinations',
        targetAccuracy: 0.9,
        problems: 22,
      },
      { skillId: 'fiveComplements.4=5-1', targetAccuracy: 0.88, problems: 20 },
      { skillId: 'fiveComplements.3=5-2', targetAccuracy: 0.86, problems: 20 },
      { skillId: 'fiveComplements.2=5-3', targetAccuracy: 0.85, problems: 18 },
      { skillId: 'fiveComplements.1=5-4', targetAccuracy: 0.84, problems: 18 },
    ],
  },
  {
    name: '🚀 Overdue for Promotion',
    emoji: '🏆',
    color: '#06b6d4', // cyan
    description: 'All skills mastered long ago - should have leveled up already',
    currentPhaseId: 'L2.add.+9.ten',
    practicingSkills: [...COMPLETE_L1_SKILLS, ...L2_ADD_SKILLS],
    notes: `TEST STUDENT: Overdue for Promotion

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
      { skillId: 'basic.directAddition', targetAccuracy: 0.98, problems: 35 },
      { skillId: 'basic.heavenBead', targetAccuracy: 0.97, problems: 35 },
      {
        skillId: 'basic.simpleCombinations',
        targetAccuracy: 0.96,
        problems: 30,
      },
      {
        skillId: 'basic.directSubtraction',
        targetAccuracy: 0.95,
        problems: 30,
      },
      {
        skillId: 'basic.heavenBeadSubtraction',
        targetAccuracy: 0.94,
        problems: 28,
      },
      {
        skillId: 'basic.simpleCombinationsSub',
        targetAccuracy: 0.93,
        problems: 28,
      },
      // All five complements mastered
      { skillId: 'fiveComplements.4=5-1', targetAccuracy: 0.95, problems: 30 },
      { skillId: 'fiveComplements.3=5-2', targetAccuracy: 0.94, problems: 30 },
      { skillId: 'fiveComplements.2=5-3', targetAccuracy: 0.93, problems: 28 },
      { skillId: 'fiveComplements.1=5-4', targetAccuracy: 0.92, problems: 28 },
      // Subtraction five complements too
      {
        skillId: 'fiveComplementsSub.-4=-5+1',
        targetAccuracy: 0.91,
        problems: 25,
      },
      {
        skillId: 'fiveComplementsSub.-3=-5+2',
        targetAccuracy: 0.9,
        problems: 25,
      },
      {
        skillId: 'fiveComplementsSub.-2=-5+3',
        targetAccuracy: 0.89,
        problems: 22,
      },
      {
        skillId: 'fiveComplementsSub.-1=-5+4',
        targetAccuracy: 0.88,
        problems: 22,
      },
      // Even L2 ten complements
      { skillId: 'tenComplements.9=10-1', targetAccuracy: 0.9, problems: 20 },
      { skillId: 'tenComplements.8=10-2', targetAccuracy: 0.88, problems: 20 },
      { skillId: 'tenComplements.7=10-3', targetAccuracy: 0.87, problems: 18 },
      { skillId: 'tenComplements.6=10-4', targetAccuracy: 0.85, problems: 18 },
    ],
  },

  // =============================================================================
  // Session Mode Test Profiles
  // =============================================================================

  {
    name: '🎯 Remediation Test',
    emoji: '🎯',
    color: '#dc2626', // red-600
    description: 'REMEDIATION MODE - Weak skills blocking promotion',
    currentPhaseId: 'L1.add.+3.five',
    practicingSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
    ],
    expectedSessionMode: 'remediation',
    notes: `TEST STUDENT: Remediation Mode

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
      { skillId: 'basic.directAddition', targetAccuracy: 0.92, problems: 20 },
      { skillId: 'basic.heavenBead', targetAccuracy: 0.88, problems: 18 },
      // WEAK skills - will trigger remediation
      {
        skillId: 'basic.simpleCombinations',
        targetAccuracy: 0.35,
        problems: 15,
      },
      { skillId: 'fiveComplements.4=5-1', targetAccuracy: 0.28, problems: 18 },
    ],
  },
  {
    name: '📚 Progression Tutorial Test',
    emoji: '📚',
    color: '#7c3aed', // violet-600
    description: 'PROGRESSION MODE - Ready for new skill, tutorial required',
    currentPhaseId: 'L1.add.+3.five',
    practicingSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
    ],
    expectedSessionMode: 'progression',
    notes: `TEST STUDENT: Progression Mode (Tutorial Required)

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
      // All skills STRONG (>= 80% accuracy)
      { skillId: 'basic.directAddition', targetAccuracy: 0.95, problems: 25 },
      { skillId: 'basic.heavenBead', targetAccuracy: 0.92, problems: 22 },
      {
        skillId: 'basic.simpleCombinations',
        targetAccuracy: 0.88,
        problems: 20,
      },
      { skillId: 'fiveComplements.4=5-1', targetAccuracy: 0.85, problems: 20 },
    ],
  },
  {
    name: '🚀 Progression Ready Test',
    emoji: '🚀',
    color: '#059669', // emerald-600
    description: 'PROGRESSION MODE - Tutorial done, ready to practice',
    currentPhaseId: 'L1.add.+3.five',
    practicingSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
    ],
    expectedSessionMode: 'progression',
    notes: `TEST STUDENT: Progression Mode (Tutorial Already Done)

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
      // All skills STRONG (>= 80% accuracy)
      { skillId: 'basic.directAddition', targetAccuracy: 0.95, problems: 25 },
      { skillId: 'basic.heavenBead', targetAccuracy: 0.92, problems: 22 },
      {
        skillId: 'basic.simpleCombinations',
        targetAccuracy: 0.88,
        problems: 20,
      },
      { skillId: 'fiveComplements.4=5-1', targetAccuracy: 0.85, problems: 20 },
    ],
  },
  {
    name: '🏆 Maintenance Test',
    emoji: '🏆',
    color: '#0891b2', // cyan-600
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
    expectedSessionMode: 'maintenance',
    notes: `TEST STUDENT: Maintenance Mode

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
      // All skills STRONG (>= 80% accuracy) with high confidence
      { skillId: 'basic.directAddition', targetAccuracy: 0.95, problems: 30 },
      { skillId: 'basic.heavenBead', targetAccuracy: 0.93, problems: 28 },
      {
        skillId: 'basic.simpleCombinations',
        targetAccuracy: 0.9,
        problems: 25,
      },
      { skillId: 'fiveComplements.4=5-1', targetAccuracy: 0.88, problems: 25 },
      { skillId: 'fiveComplements.3=5-2', targetAccuracy: 0.87, problems: 22 },
      { skillId: 'fiveComplements.2=5-3', targetAccuracy: 0.86, problems: 22 },
      { skillId: 'fiveComplements.1=5-4', targetAccuracy: 0.85, problems: 20 },
    ],
  },

  // =============================================================================
  // Edge Case Test Profiles
  // =============================================================================

  {
    name: '🆕 Brand New Student',
    emoji: '🌱',
    color: '#84cc16', // lime-500
    description: 'EDGE CASE - Zero practicing skills, empty state',
    currentPhaseId: 'L1.add.+1.direct',
    practicingSkills: [], // No skills practicing yet!
    notes: `TEST STUDENT: Brand New Student (Edge Case)

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
    description: 'EDGE CASE - Only one skill practicing',
    currentPhaseId: 'L1.add.+1.direct',
    practicingSkills: ['basic.directAddition'],
    tutorialCompletedSkills: ['basic.directAddition'],
    notes: `TEST STUDENT: Single Skill Only (Edge Case)

This student is practicing exactly ONE skill. This is the minimum case.

What you should see:
• Dashboard shows counts with total: 1
• Skill badges show correctly with single count
• Progress calculations work with minimal data

Use this to verify the dashboard handles single-skill students correctly.`,
    skillHistory: [{ skillId: 'basic.directAddition', targetAccuracy: 0.65, problems: 12 }],
  },
  {
    name: '📊 All Developing',
    emoji: '📈',
    color: '#3b82f6', // blue-500
    description: 'EDGE CASE - All skills in developing range',
    currentPhaseId: 'L1.add.+3.five',
    practicingSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
    ],
    tutorialCompletedSkills: [
      'basic.directAddition',
      'basic.heavenBead',
      'basic.simpleCombinations',
      'fiveComplements.4=5-1',
    ],
    notes: `TEST STUDENT: All Developing (Edge Case)

This student has ALL skills in the "developing" range (50-80% pKnown).
None are strong, none are weak - all in the middle.

What you should see:
• Dashboard shows only 📚 Developing badges (no Strong or Weak)
• Session mode should be maintenance (no weak skills blocking)
• Progress bar reflects developing state

Use this to verify the dashboard handles the case where all skills are developing.`,
    skillHistory: [
      // All in developing range (50-80% accuracy)
      { skillId: 'basic.directAddition', targetAccuracy: 0.72, problems: 18 },
      { skillId: 'basic.heavenBead', targetAccuracy: 0.68, problems: 16 },
      {
        skillId: 'basic.simpleCombinations',
        targetAccuracy: 0.65,
        problems: 14,
      },
      { skillId: 'fiveComplements.4=5-1', targetAccuracy: 0.58, problems: 12 },
    ],
  },
  {
    name: '⚖️ Balanced Mix',
    emoji: '⚖️',
    color: '#f97316', // orange-500
    description: 'EDGE CASE - Equal strong, developing, weak counts',
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
    notes: `TEST STUDENT: Balanced Mix (Edge Case)

This student has an equal mix of strong, developing, and weak skills:
• 2 Strong (basic.directAddition, basic.heavenBead)
• 2 Developing (basic.simpleCombinations, fiveComplements.4=5-1)
• 2 Weak (fiveComplements.3=5-2, fiveComplements.2=5-3)

What you should see:
• Dashboard shows all three badge types
• Session mode should be REMEDIATION (weak skills present)
• Visual balance of all three categories

Use this to verify badge display when all categories are represented.`,
    skillHistory: [
      // 2 Strong
      { skillId: 'basic.directAddition', targetAccuracy: 0.92, problems: 25 },
      { skillId: 'basic.heavenBead', targetAccuracy: 0.88, problems: 22 },
      // 2 Developing
      {
        skillId: 'basic.simpleCombinations',
        targetAccuracy: 0.65,
        problems: 15,
      },
      { skillId: 'fiveComplements.4=5-1', targetAccuracy: 0.58, problems: 14 },
      // 2 Weak
      { skillId: 'fiveComplements.3=5-2', targetAccuracy: 0.32, problems: 18 },
      { skillId: 'fiveComplements.2=5-3', targetAccuracy: 0.28, problems: 16 },
    ],
  },
  {
    name: '🕰️ Stale Skills Test',
    emoji: '⏰',
    color: '#6b7280', // gray-500
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
    notes: `TEST STUDENT: Stale Skills Test

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
      { skillId: 'basic.directAddition', targetAccuracy: 0.92, problems: 20, ageDays: 1 },
      { skillId: 'basic.heavenBead', targetAccuracy: 0.88, problems: 18, ageDays: 1 },
      // "Not practiced recently" (7-14 days)
      { skillId: 'basic.simpleCombinations', targetAccuracy: 0.85, problems: 15, ageDays: 10 },
      { skillId: 'fiveComplements.4=5-1', targetAccuracy: 0.82, problems: 16, ageDays: 10 },
      // "Getting rusty" (14-30 days)
      { skillId: 'fiveComplements.3=5-2', targetAccuracy: 0.78, problems: 18, ageDays: 20 },
      // "Very stale" (30+ days)
      { skillId: 'fiveComplements.2=5-3', targetAccuracy: 0.75, problems: 16, ageDays: 45 },
    ],
  },
]

// =============================================================================
// Helpers
// =============================================================================

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function generateSlotResults(
  config: SkillConfig,
  startIndex: number,
  sessionStartTime: Date
): SlotResult[] {
  const correctCount = Math.round(config.problems * config.targetAccuracy)
  const results: boolean[] = []

  for (let i = 0; i < correctCount; i++) results.push(true)
  for (let i = correctCount; i < config.problems; i++) results.push(false)

  const shuffled = shuffleArray(results)

  return shuffled.map((isCorrect, i) => {
    const problem: GeneratedProblem = {
      terms: [5, 4],
      answer: 9,
      skillsRequired: [config.skillId],
    }

    return {
      partNumber: 1 as const,
      slotIndex: startIndex + i,
      problem,
      studentAnswer: isCorrect ? 9 : 8,
      isCorrect,
      responseTimeMs: 4000 + Math.random() * 2000,
      skillsExercised: [config.skillId],
      usedOnScreenAbacus: false,
      timestamp: new Date(sessionStartTime.getTime() + (startIndex + i) * 10000),
      helpLevelUsed: 0 as const,
      incorrectAttempts: isCorrect ? 0 : 1,
      helpTrigger: 'none' as const,
    }
  })
}

async function createTestStudent(
  profile: TestStudentProfile,
  userId: string
): Promise<{ playerId: string; classifications: Record<string, number> }> {
  // Delete existing player with this name
  const existing = await db.query.players.findFirst({
    where: eq(schema.players.name, profile.name),
  })
  if (existing) {
    await db.delete(schema.players).where(eq(schema.players.id, existing.id))
  }

  // Create player
  const playerId = createId()
  await db.insert(schema.players).values({
    id: playerId,
    userId,
    name: profile.name,
    emoji: profile.emoji,
    color: profile.color,
    isActive: true,
    notes: profile.notes,
  })

  // Build a map of skill -> age from skill history
  const skillAgeMap = new Map<string, number>()
  for (const config of profile.skillHistory) {
    skillAgeMap.set(config.skillId, config.ageDays ?? 1)
  }

  // Create skill mastery records for practicing skills
  for (const skillId of profile.practicingSkills) {
    const ageDays = skillAgeMap.get(skillId) ?? 1
    const lastPracticedAt = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000)

    await db.insert(schema.playerSkillMastery).values({
      id: createId(),
      playerId,
      skillId,
      isPracticing: true,
      attempts: 0,
      correct: 0,
      consecutiveCorrect: 0,
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
  for (const config of profile.skillHistory) {
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

    const shuffledResults = shuffleArray(allResults).map((r, i) => ({
      ...r,
      slotIndex: i,
      timestamp: new Date(sessionStartTime.getTime() + i * 10000),
    }))

    // Create session
    const sessionId = createId()
    const sessionEndTime = new Date(sessionStartTime.getTime() + shuffledResults.length * 10000)

    const slots = shuffledResults.map((r, i) => ({
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
      totalProblemCount: shuffledResults.length,
      estimatedMinutes: 30,
      parts: [
        {
          partNumber: 1,
          type: 'linear',
          description: 'Mental Math (Linear)',
          problemCount: shuffledResults.length,
          estimatedMinutes: 30,
        },
      ],
    }

    await db.insert(schema.sessionPlans).values({
      id: sessionId,
      playerId,
      targetDurationMinutes: 30,
      estimatedProblemCount: shuffledResults.length,
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
      results: shuffledResults,
      createdAt: sessionStartTime,
      approvedAt: sessionStartTime,
      startedAt: sessionStartTime,
      completedAt: sessionEndTime,
    })
  }

  // Get classifications
  const problemHistory = await getRecentSessionResults(playerId, 50)
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

  return { playerId, classifications }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('🧪 Seeding Test Students for BKT Testing...\n')

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

  // Create each test profile
  console.log('\n2. Creating test students...\n')

  for (const profile of TEST_PROFILES) {
    const { playerId, classifications } = await createTestStudent(profile, userId)
    const { weak, developing, strong } = classifications

    console.log(`   ${profile.emoji} ${profile.name}`)
    console.log(`      ${profile.description}`)
    console.log(`      Phase: ${profile.currentPhaseId}`)
    console.log(`      Practicing: ${profile.practicingSkills.length} skills`)
    console.log(
      `      Classifications: 🔴 ${weak} weak, 🟡 ${developing} developing, 🟢 ${strong} strong`
    )
    if (profile.expectedSessionMode) {
      console.log(`      Expected Mode: ${profile.expectedSessionMode.toUpperCase()}`)
    }
    if (profile.tutorialCompletedSkills) {
      console.log(`      Tutorials Completed: ${profile.tutorialCompletedSkills.length} skills`)
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
