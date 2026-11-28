/**
 * Mock plans and students for the session stories (the shell's and each
 * kind's item view): a three-part session with generated problems.
 * Not a stories file; only stories import it (a fixture, so the session
 * folder's kind-blind gate does not read its mock slots).
 */

import type { StudentInfo } from '@/components/practice/session/types'
import type {
  GeneratedProblem,
  ProblemSlot,
  SessionHealth,
  SessionPart,
  SessionPlan,
  SessionSummary,
  SlotResult,
} from '@/db/schema/session-plans'
import { createBasicSkillSet } from '@/types/tutorial'
import {
  analyzeRequiredSkills,
  type ProblemConstraints as GeneratorConstraints,
  generateSingleProblem,
} from '@/utils/problemGenerator'

/**
 * Create a mock student for stories
 */
export function createMockStudent(name: string): StudentInfo {
  const students: Record<string, StudentInfo> = {
    Sonia: { id: 'student-sonia', name: 'Sonia', emoji: '🌟', color: 'purple' },
    Marcus: {
      id: 'student-marcus',
      name: 'Marcus',
      emoji: '🚀',
      color: 'blue',
    },
    Luna: { id: 'student-luna', name: 'Luna', emoji: '🌙', color: 'indigo' },
    Kai: { id: 'student-kai', name: 'Kai', emoji: '🌊', color: 'cyan' },
  }
  return (
    students[name] ?? {
      id: `student-${name.toLowerCase()}`,
      name,
      emoji: '🎓',
      color: 'gray',
    }
  )
}

/**
 * Generate a skill-appropriate problem
 */
function generateProblemWithSkills(
  skillLevel: 'basic' | 'fiveComplements' | 'tenComplements'
): GeneratedProblem {
  const baseSkills = createBasicSkillSet()

  baseSkills.basic.directAddition = true
  baseSkills.basic.heavenBead = true
  baseSkills.basic.simpleCombinations = true

  if (skillLevel === 'fiveComplements' || skillLevel === 'tenComplements') {
    baseSkills.fiveComplements['4=5-1'] = true
    baseSkills.fiveComplements['3=5-2'] = true
    baseSkills.fiveComplements['2=5-3'] = true
    baseSkills.fiveComplements['1=5-4'] = true
  }

  if (skillLevel === 'tenComplements') {
    baseSkills.tenComplements['9=10-1'] = true
    baseSkills.tenComplements['8=10-2'] = true
    baseSkills.tenComplements['7=10-3'] = true
  }

  const constraints: GeneratorConstraints = {
    numberRange: { min: 1, max: skillLevel === 'tenComplements' ? 99 : 9 },
    maxTerms: 4,
    problemCount: 1,
  }

  const problem = generateSingleProblem(constraints, baseSkills)

  if (problem) {
    return {
      terms: problem.terms,
      answer: problem.answer,
      skillsRequired: problem.skillsUsed,
    }
  }

  // Fallback
  const terms = [3, 4, 2]
  return {
    terms,
    answer: terms.reduce((a, b) => a + b, 0),
    skillsRequired: analyzeRequiredSkills(terms, 9),
  }
}

/**
 * Create mock slots with generated problems
 */
export function createMockSlotsWithProblems(
  count: number,
  skillLevel: 'basic' | 'fiveComplements' | 'tenComplements',
  purposes: Array<'focus' | 'reinforce' | 'review' | 'challenge'> = ['focus', 'reinforce', 'review']
): ProblemSlot[] {
  return Array.from({ length: count }, (_, i) => {
    // Build required skills based on skill level
    // Using type assertion since we're building mock data with partial values
    const allowedSkills: ProblemSlot['constraints']['allowedSkills'] = {
      basic: { directAddition: true, heavenBead: true },
      ...(skillLevel !== 'basic' && {
        fiveComplements: { '4=5-1': true, '3=5-2': true },
      }),
      ...(skillLevel === 'tenComplements' && {
        tenComplements: { '9=10-1': true, '8=10-2': true },
      }),
    } as ProblemSlot['constraints']['allowedSkills']

    return {
      slotId: crypto.randomUUID(),
      index: i,
      purpose: purposes[i % purposes.length],
      constraints: {
        allowedSkills,
        digitRange: { min: 1, max: skillLevel === 'tenComplements' ? 2 : 1 },
        termCount: { min: 3, max: 4 },
      },
      problem: generateProblemWithSkills(skillLevel),
    }
  })
}

/**
 * Create a complete mock session plan with generated problems
 */
export function createMockSessionPlanWithProblems(config: {
  totalProblems?: number
  skillLevel?: 'basic' | 'fiveComplements' | 'tenComplements'
  currentPartIndex?: number
  currentSlotIndex?: number
  sessionHealth?: SessionHealth | null
}): SessionPlan {
  const totalProblems = config.totalProblems || 15
  const skillLevel = config.skillLevel || 'basic'

  const part1Count = Math.round(totalProblems * 0.5)
  const part2Count = Math.round(totalProblems * 0.3)
  const part3Count = totalProblems - part1Count - part2Count

  const parts: SessionPart[] = [
    {
      partNumber: 1,
      type: 'abacus',
      format: 'vertical',
      useAbacus: true,
      slots: createMockSlotsWithProblems(part1Count, skillLevel, ['focus', 'focus', 'reinforce']),
      estimatedMinutes: 5,
    },
    {
      partNumber: 2,
      type: 'visualization',
      format: 'vertical',
      useAbacus: false,
      slots: createMockSlotsWithProblems(part2Count, skillLevel, ['focus', 'reinforce', 'review']),
      estimatedMinutes: 3,
    },
    {
      partNumber: 3,
      type: 'linear',
      format: 'linear',
      useAbacus: false,
      slots: createMockSlotsWithProblems(part3Count, skillLevel, ['review', 'challenge']),
      estimatedMinutes: 2,
    },
  ]

  const summary: SessionSummary = {
    focusDescription:
      skillLevel === 'tenComplements'
        ? 'Ten Complements'
        : skillLevel === 'fiveComplements'
          ? 'Five Complements'
          : 'Basic Addition',
    totalProblemCount: totalProblems,
    estimatedMinutes: 10,
    parts: parts.map((p) => ({
      partNumber: p.partNumber,
      type: p.type,
      description:
        p.type === 'abacus'
          ? 'Use Abacus'
          : p.type === 'visualization'
            ? 'Mental Math (Visualization)'
            : 'Mental Math (Linear)',
      problemCount: p.slots.length,
      estimatedMinutes: p.estimatedMinutes,
    })),
  }

  return {
    id: 'plan-active-123',
    playerId: 'player-1',
    targetDurationMinutes: 10,
    estimatedProblemCount: totalProblems,
    avgTimePerProblemSeconds: 40,
    gameBreakSettings: {
      enabled: false,
      maxDurationMinutes: 5,
      selectionMode: 'kid-chooses',
      selectedGame: null,
    },
    parts,
    summary,
    masteredSkillIds: ['basic.+1', 'basic.+2', 'basic.+3', 'fiveComplements.4=5-1'],
    status: 'in_progress',
    flowState: 'practicing',
    flowUpdatedAt: new Date(),
    flowVersion: 0,
    currentPartIndex: config.currentPartIndex ?? 0,
    sessionHealth: config.sessionHealth ?? null,
    adjustments: [],
    results: [],
    createdAt: new Date(),
    approvedAt: new Date(Date.now() - 60000),
    startedAt: new Date(Date.now() - 30000),
    completedAt: null,
    statusBeforeDeletion: null,
    deletedAt: null,
    deletedBy: null,
    isPaused: false,
    pausedAt: null,
    pausedBy: null,
    pauseReason: null,
    rowVersion: 0,
    breaks: [],
    partStates: {
      [config.currentPartIndex ?? 0]: { slotIndex: config.currentSlotIndex ?? 0 },
    },
    pauses: [],
    remoteCameraSessionId: null,
  }
}

export const defaultHandlers = {
  onAnswer: async (
    result: Omit<SlotResult, 'timestamp' | 'partNumber'>
  ): Promise<SessionPlan | null> => {
    console.log('Answer recorded:', result)
    // No server here: the screen hands off to the plan it has
    return null
  },
  onEndEarly: (reason?: string) => {
    alert(`Session ended early: ${reason || 'No reason given'}`)
  },
  onPause: () => console.log('Session paused'),
  onResume: () => console.log('Session resumed'),
}
