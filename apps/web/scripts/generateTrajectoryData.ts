#!/usr/bin/env npx tsx
/**
 * Generate A/B mastery trajectory data for all skills.
 * Runs simulations directly without vitest overhead.
 *
 * Usage: npx tsx scripts/generateTrajectoryData.ts
 * Output: public/data/ab-mastery-trajectories.json
 */

import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../src/db/schema'
import { SeededRandom } from '../src/test/journey-simulator/SeededRandom'
import { SimulatedStudent } from '../src/test/journey-simulator/SimulatedStudent'
import type { StudentProfile, JourneyConfig } from '../src/test/journey-simulator/types'

// All skills in the curriculum
const ALL_SKILLS = [
  // Basic skills (6)
  'basic.directAddition',
  'basic.directSubtraction',
  'basic.heavenBead',
  'basic.heavenBeadSubtraction',
  'basic.simpleCombinations',
  'basic.simpleCombinationsSub',
  // Five complements addition (4)
  'fiveComplements.4=5-1',
  'fiveComplements.3=5-2',
  'fiveComplements.2=5-3',
  'fiveComplements.1=5-4',
  // Five complements subtraction (4)
  'fiveComplementsSub.-4=-5+1',
  'fiveComplementsSub.-3=-5+2',
  'fiveComplementsSub.-2=-5+3',
  'fiveComplementsSub.-1=-5+4',
  // Ten complements addition (9)
  'tenComplements.9=10-1',
  'tenComplements.8=10-2',
  'tenComplements.7=10-3',
  'tenComplements.6=10-4',
  'tenComplements.5=10-5',
  'tenComplements.4=10-6',
  'tenComplements.3=10-7',
  'tenComplements.2=10-8',
  'tenComplements.1=10-9',
  // Ten complements subtraction (9)
  'tenComplementsSub.-9=+1-10',
  'tenComplementsSub.-8=+2-10',
  'tenComplementsSub.-7=+3-10',
  'tenComplementsSub.-6=+4-10',
  'tenComplementsSub.-5=+5-10',
  'tenComplementsSub.-4=+6-10',
  'tenComplementsSub.-3=+7-10',
  'tenComplementsSub.-2=+8-10',
  'tenComplementsSub.-1=+9-10',
  // Advanced (2)
  'advanced.cascadingCarry',
  'advanced.cascadingBorrow',
]

const OUTPUT_PATH = path.join(process.cwd(), 'public/data/ab-mastery-trajectories.json')

interface TrajectoryPoint {
  session: number
  mastery: number
}

interface SkillTrajectory {
  adaptive: TrajectoryPoint[]
  classic: TrajectoryPoint[]
  sessionsTo50Adaptive: number | null
  sessionsTo50Classic: number | null
  sessionsTo80Adaptive: number | null
  sessionsTo80Classic: number | null
}

// Simplified journey runner that just tracks mastery over sessions
function runSimplifiedJourney(
  skillId: string,
  profile: StudentProfile,
  sessionCount: number,
  seed: number
): TrajectoryPoint[] {
  const rng = new SeededRandom(seed)
  const student = new SimulatedStudent(profile, rng)

  const trajectory: TrajectoryPoint[] = []

  for (let session = 1; session <= sessionCount; session++) {
    // Simulate ~20 problems per session that exercise this skill
    for (let problem = 0; problem < 20; problem++) {
      // Simulate answering a problem with this skill
      const probability = student.getTrueProbability(skillId)
      const isCorrect = rng.chance(probability)

      // Increment exposure by simulating answering a problem with this skill
      student.answerProblem({
        terms: [1, 1],
        answer: 2,
        skillsRequired: [skillId],
      })
    }

    // Record mastery at end of session
    const mastery = student.getTrueProbability(skillId)
    trajectory.push({ session, mastery })
  }

  return trajectory
}

function findSessionForMastery(trajectory: TrajectoryPoint[], threshold: number): number | null {
  for (const point of trajectory) {
    if (point.mastery >= threshold) {
      return point.session
    }
  }
  return null
}

function getSkillCategory(
  skillId: string
): 'basic' | 'fiveComplement' | 'tenComplement' | 'advanced' {
  if (skillId.startsWith('basic.')) return 'basic'
  if (skillId.startsWith('fiveComplement')) return 'fiveComplement'
  if (skillId.startsWith('tenComplement')) return 'tenComplement'
  return 'advanced'
}

function getSkillLabel(skillId: string): string {
  const parts = skillId.split('.')
  if (parts.length < 2) return skillId
  const formula = parts[1]

  if (skillId.startsWith('basic.')) return `basic: ${formula}`
  if (skillId.startsWith('fiveComplements.')) return `5-comp: ${formula}`
  if (skillId.startsWith('fiveComplementsSub.')) return `5-comp sub: ${formula}`
  if (skillId.startsWith('tenComplements.')) return `10-comp: ${formula}`
  if (skillId.startsWith('tenComplementsSub.')) return `10-comp sub: ${formula}`
  if (skillId.startsWith('advanced.')) return `advanced: ${formula}`
  return skillId
}

function getSkillColor(category: string, index: number): string {
  const palettes: Record<string, string[]> = {
    basic: ['#22c55e', '#16a34a', '#15803d', '#166534', '#14532d', '#052e16'],
    fiveComplement: ['#eab308', '#facc15', '#fde047', '#fef08a'],
    tenComplement: [
      '#ef4444',
      '#f97316',
      '#dc2626',
      '#ea580c',
      '#b91c1c',
      '#c2410c',
      '#991b1b',
      '#9a3412',
      '#7f1d1d',
    ],
    advanced: ['#8b5cf6', '#a78bfa'],
  }
  const palette = palettes[category] || palettes.basic
  return palette[index % palette.length]
}

async function main() {
  console.log('Generating A/B mastery trajectory data for full curriculum...')
  console.log(`Skills to process: ${ALL_SKILLS.length}`)
  console.log('')

  const sessionCount = 12
  const seed = 98765

  // Profile for adaptive mode (BKT targeting)
  const adaptiveProfile: StudentProfile = {
    name: 'Adaptive Learner',
    description: 'Student using adaptive mode',
    halfMaxExposure: 10,
    hillCoefficient: 2.0,
    initialExposures: {}, // Start from zero
    helpUsageProbabilities: [0.7, 0.3],
    helpBonuses: [0, 0.15],
    baseResponseTimeMs: 5000,
    responseTimeVariance: 0.3,
  }

  // Profile for classic mode (no BKT targeting, same learning rate)
  const classicProfile: StudentProfile = {
    ...adaptiveProfile,
    name: 'Classic Learner',
    description: 'Student using classic mode',
  }

  const trajectories: Record<string, SkillTrajectory> = {}
  const startTime = Date.now()

  for (let i = 0; i < ALL_SKILLS.length; i++) {
    const skillId = ALL_SKILLS[i]
    const skillStart = Date.now()

    process.stdout.write(`[${i + 1}/${ALL_SKILLS.length}] ${skillId}... `)

    // Run adaptive simulation
    const adaptiveTrajectory = runSimplifiedJourney(skillId, adaptiveProfile, sessionCount, seed)

    // Run classic simulation (different seed for variety)
    const classicTrajectory = runSimplifiedJourney(
      skillId,
      classicProfile,
      sessionCount,
      seed + 1000
    )

    trajectories[skillId] = {
      adaptive: adaptiveTrajectory,
      classic: classicTrajectory,
      sessionsTo50Adaptive: findSessionForMastery(adaptiveTrajectory, 0.5),
      sessionsTo50Classic: findSessionForMastery(classicTrajectory, 0.5),
      sessionsTo80Adaptive: findSessionForMastery(adaptiveTrajectory, 0.8),
      sessionsTo80Classic: findSessionForMastery(classicTrajectory, 0.8),
    }

    const elapsed = Date.now() - skillStart
    console.log(`done (${elapsed}ms)`)
  }

  // Compute summary
  let adaptiveWins50 = 0,
    classicWins50 = 0,
    ties50 = 0
  let adaptiveWins80 = 0,
    classicWins80 = 0,
    ties80 = 0

  for (const skillId of ALL_SKILLS) {
    const t = trajectories[skillId]

    // 50% comparison
    if (t.sessionsTo50Adaptive !== null && t.sessionsTo50Classic !== null) {
      if (t.sessionsTo50Adaptive < t.sessionsTo50Classic) adaptiveWins50++
      else if (t.sessionsTo50Adaptive > t.sessionsTo50Classic) classicWins50++
      else ties50++
    } else if (t.sessionsTo50Adaptive !== null) {
      adaptiveWins50++
    } else if (t.sessionsTo50Classic !== null) {
      classicWins50++
    } else {
      ties50++
    }

    // 80% comparison
    if (t.sessionsTo80Adaptive !== null && t.sessionsTo80Classic !== null) {
      if (t.sessionsTo80Adaptive < t.sessionsTo80Classic) adaptiveWins80++
      else if (t.sessionsTo80Adaptive > t.sessionsTo80Classic) classicWins80++
      else ties80++
    } else if (t.sessionsTo80Adaptive !== null) {
      adaptiveWins80++
    } else if (t.sessionsTo80Classic !== null) {
      classicWins80++
    } else {
      ties80++
    }
  }

  // Build output
  const categoryIndices: Record<string, number> = {}

  const output = {
    generatedAt: new Date().toISOString(),
    version: '2.0',
    config: { seed, sessionCount, sessionDurationMinutes: 15 },
    summary: {
      totalSkills: ALL_SKILLS.length,
      adaptiveWins50,
      classicWins50,
      ties50,
      adaptiveWins80,
      classicWins80,
      ties80,
    },
    sessions: Array.from({ length: sessionCount }, (_, i) => i + 1),
    skills: ALL_SKILLS.map((skillId) => {
      const category = getSkillCategory(skillId)
      categoryIndices[category] = categoryIndices[category] || 0
      const colorIndex = categoryIndices[category]++

      const t = trajectories[skillId]
      return {
        id: skillId,
        label: getSkillLabel(skillId),
        category,
        color: getSkillColor(category, colorIndex),
        adaptive: {
          data: t.adaptive.map((p) => Math.round(p.mastery * 100)),
          sessionsTo50: t.sessionsTo50Adaptive,
          sessionsTo80: t.sessionsTo80Adaptive,
        },
        classic: {
          data: t.classic.map((p) => Math.round(p.mastery * 100)),
          sessionsTo50: t.sessionsTo50Classic,
          sessionsTo80: t.sessionsTo80Classic,
        },
      }
    }),
    comparisonTable: ALL_SKILLS.map((skillId) => {
      const t = trajectories[skillId]
      let advantage: string | null = null

      if (t.sessionsTo80Adaptive !== null && t.sessionsTo80Classic !== null) {
        const diff = t.sessionsTo80Classic - t.sessionsTo80Adaptive
        if (diff > 0) advantage = `Adaptive +${diff} sessions`
        else if (diff < 0) advantage = `Classic +${Math.abs(diff)} sessions`
        else advantage = 'Tie'
      } else if (t.sessionsTo80Adaptive !== null) {
        advantage = 'Adaptive (Classic never reached 80%)'
      } else if (t.sessionsTo80Classic !== null) {
        advantage = 'Classic (Adaptive never reached 80%)'
      }

      return {
        skill: getSkillLabel(skillId),
        category: getSkillCategory(skillId),
        adaptiveTo80: t.sessionsTo80Adaptive,
        classicTo80: t.sessionsTo80Classic,
        advantage,
      }
    }),
  }

  // Write output
  const outputDir = path.dirname(OUTPUT_PATH)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('')
  console.log(`=== Complete in ${totalTime}s ===`)
  console.log(`Output: ${OUTPUT_PATH}`)
  console.log('')
  console.log('Summary:')
  console.log(`  50% mastery: Adaptive ${adaptiveWins50}, Classic ${classicWins50}, Ties ${ties50}`)
  console.log(`  80% mastery: Adaptive ${adaptiveWins80}, Classic ${classicWins80}, Ties ${ties80}`)
}

main().catch(console.error)
