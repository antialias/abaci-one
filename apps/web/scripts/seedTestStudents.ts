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
 * Usage: npm run seed:test-students
 */

import { createId } from '@paralleldrive/cuid2'
import { and, desc, eq, isNotNull } from 'drizzle-orm'
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
      { skillId: 'basic.simpleCombinations', targetAccuracy: 0.85, problems: 15 },
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
      { skillId: 'basic.simpleCombinations', targetAccuracy: 0.55, problems: 10 },
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
      { skillId: 'basic.simpleCombinations', targetAccuracy: 0.9, problems: 22 },
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
      { skillId: 'basic.simpleCombinations', targetAccuracy: 0.96, problems: 30 },
      { skillId: 'basic.directSubtraction', targetAccuracy: 0.95, problems: 30 },
      { skillId: 'basic.heavenBeadSubtraction', targetAccuracy: 0.94, problems: 28 },
      { skillId: 'basic.simpleCombinationsSub', targetAccuracy: 0.93, problems: 28 },
      // All five complements mastered
      { skillId: 'fiveComplements.4=5-1', targetAccuracy: 0.95, problems: 30 },
      { skillId: 'fiveComplements.3=5-2', targetAccuracy: 0.94, problems: 30 },
      { skillId: 'fiveComplements.2=5-3', targetAccuracy: 0.93, problems: 28 },
      { skillId: 'fiveComplements.1=5-4', targetAccuracy: 0.92, problems: 28 },
      // Subtraction five complements too
      { skillId: 'fiveComplementsSub.-4=-5+1', targetAccuracy: 0.91, problems: 25 },
      { skillId: 'fiveComplementsSub.-3=-5+2', targetAccuracy: 0.9, problems: 25 },
      { skillId: 'fiveComplementsSub.-2=-5+3', targetAccuracy: 0.89, problems: 22 },
      { skillId: 'fiveComplementsSub.-1=-5+4', targetAccuracy: 0.88, problems: 22 },
      // Even L2 ten complements
      { skillId: 'tenComplements.9=10-1', targetAccuracy: 0.9, problems: 20 },
      { skillId: 'tenComplements.8=10-2', targetAccuracy: 0.88, problems: 20 },
      { skillId: 'tenComplements.7=10-3', targetAccuracy: 0.87, problems: 18 },
      { skillId: 'tenComplements.6=10-4', targetAccuracy: 0.85, problems: 18 },
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

  // Create skill mastery records for practicing skills
  for (const skillId of profile.practicingSkills) {
    await db.insert(schema.playerSkillMastery).values({
      id: createId(),
      playerId,
      skillId,
      isPracticing: true,
      attempts: 0,
      correct: 0,
      consecutiveCorrect: 0,
    })
  }

  // Generate results from skill history
  const sessionStartTime = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const allResults: SlotResult[] = []
  let currentIndex = 0

  for (const config of profile.skillHistory) {
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
    focusDescription: `Test session for ${profile.name}`,
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

  // Get classifications
  const problemHistory = await getRecentSessionResults(playerId, 50)
  const bktResult = computeBktFromHistory(problemHistory, {
    confidenceThreshold: BKT_THRESHOLDS.confidence,
  })

  const classifications: Record<string, number> = { weak: 0, developing: 0, strong: 0 }
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

  // Find user with most recent activity (most recent completed session)
  console.log('1. Finding user with most recent activity...')

  const recentSession = await db.query.sessionPlans.findFirst({
    where: and(
      eq(schema.sessionPlans.status, 'completed'),
      isNotNull(schema.sessionPlans.completedAt)
    ),
    orderBy: [desc(schema.sessionPlans.completedAt)],
  })

  let userId: string

  if (recentSession) {
    // Get the user who owns the player from that session
    const player = await db.query.players.findFirst({
      where: eq(schema.players.id, recentSession.playerId),
    })
    if (player) {
      userId = player.userId
      console.log(`   Found user via recent session (player: ${player.name})`)
    } else {
      // Fallback to finding any player
      const anyPlayer = await db.query.players.findFirst({
        where: (players, { not, like }) => not(like(players.name, '%Test%')),
      })
      if (!anyPlayer) {
        console.error('❌ No players found! Create a student at /practice first.')
        process.exit(1)
      }
      userId = anyPlayer.userId
      console.log(`   Found user via player: ${anyPlayer.name}`)
    }
  } else {
    // No sessions, find any real player
    const anyPlayer = await db.query.players.findFirst({
      where: (players, { not, like }) => not(like(players.name, '%Test%')),
    })
    if (!anyPlayer) {
      console.error('❌ No players found! Create a student at /practice first.')
      process.exit(1)
    }
    userId = anyPlayer.userId
    console.log(`   Found user via player: ${anyPlayer.name}`)
  }

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
