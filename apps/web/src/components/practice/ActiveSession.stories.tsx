import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useState } from 'react'
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
import { css } from '../../../styled-system/css'
import { ActiveSession } from './ActiveSession'

const meta: Meta<typeof ActiveSession> = {
  title: 'Practice/ActiveSession',
  component: ActiveSession,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof ActiveSession>

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
      skillsRequired: problem.requiredSkills,
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
function createMockSlotsWithProblems(
  count: number,
  skillLevel: 'basic' | 'fiveComplements' | 'tenComplements',
  purposes: Array<'focus' | 'reinforce' | 'review' | 'challenge'> = ['focus', 'reinforce', 'review']
): ProblemSlot[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    purpose: purposes[i % purposes.length],
    constraints: {
      requiredSkills: {
        basic: { directAddition: true, heavenBead: true },
        ...(skillLevel !== 'basic' && {
          fiveComplements: { '4=5-1': true, '3=5-2': true },
        }),
        ...(skillLevel === 'tenComplements' && {
          tenComplements: { '9=10-1': true, '8=10-2': true },
        }),
      },
      digitRange: { min: 1, max: skillLevel === 'tenComplements' ? 2 : 1 },
      termCount: { min: 3, max: 4 },
    },
    problem: generateProblemWithSkills(skillLevel),
  }))
}

/**
 * Create a complete mock session plan with generated problems
 */
function createMockSessionPlanWithProblems(config: {
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
    parts,
    summary,
    status: 'in_progress',
    currentPartIndex: config.currentPartIndex ?? 0,
    currentSlotIndex: config.currentSlotIndex ?? 0,
    sessionHealth: config.sessionHealth ?? null,
    adjustments: [],
    results: [],
    createdAt: Date.now(),
    approvedAt: Date.now() - 60000,
    startedAt: Date.now() - 30000,
    completedAt: null,
  }
}

const defaultHandlers = {
  onAnswer: async (result: Omit<SlotResult, 'timestamp' | 'partNumber'>) => {
    console.log('Answer recorded:', result)
  },
  onEndEarly: (reason?: string) => {
    alert(`Session ended early: ${reason || 'No reason given'}`)
  },
  onPause: () => console.log('Session paused'),
  onResume: () => console.log('Session resumed'),
  onComplete: () => alert('Session completed!'),
}

/**
 * Wrapper for consistent styling
 */
function SessionWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={css({
        backgroundColor: 'gray.100',
        minHeight: '100vh',
        padding: '1rem',
      })}
    >
      {children}
    </div>
  )
}

export const Part1Abacus: Story = {
  render: () => (
    <SessionWrapper>
      <ActiveSession
        plan={createMockSessionPlanWithProblems({
          skillLevel: 'basic',
          currentPartIndex: 0,
          currentSlotIndex: 0,
        })}
        studentName="Sonia"
        {...defaultHandlers}
      />
    </SessionWrapper>
  ),
}

export const Part2Visualization: Story = {
  render: () => (
    <SessionWrapper>
      <ActiveSession
        plan={createMockSessionPlanWithProblems({
          skillLevel: 'fiveComplements',
          currentPartIndex: 1,
          currentSlotIndex: 0,
        })}
        studentName="Marcus"
        {...defaultHandlers}
      />
    </SessionWrapper>
  ),
}

export const Part3Linear: Story = {
  render: () => (
    <SessionWrapper>
      <ActiveSession
        plan={createMockSessionPlanWithProblems({
          skillLevel: 'tenComplements',
          currentPartIndex: 2,
          currentSlotIndex: 0,
        })}
        studentName="Luna"
        {...defaultHandlers}
      />
    </SessionWrapper>
  ),
}

export const WithHealthIndicator: Story = {
  render: () => (
    <SessionWrapper>
      <ActiveSession
        plan={createMockSessionPlanWithProblems({
          skillLevel: 'basic',
          currentPartIndex: 0,
          currentSlotIndex: 3,
          sessionHealth: {
            overall: 'good',
            accuracy: 0.85,
            pacePercent: 110,
            currentStreak: 4,
            avgResponseTimeMs: 3500,
          },
        })}
        studentName="Sonia"
        {...defaultHandlers}
      />
    </SessionWrapper>
  ),
}

export const Struggling: Story = {
  render: () => (
    <SessionWrapper>
      <ActiveSession
        plan={createMockSessionPlanWithProblems({
          skillLevel: 'tenComplements',
          currentPartIndex: 0,
          currentSlotIndex: 5,
          sessionHealth: {
            overall: 'struggling',
            accuracy: 0.45,
            pacePercent: 65,
            currentStreak: -3,
            avgResponseTimeMs: 8500,
          },
        })}
        studentName="Kai"
        {...defaultHandlers}
      />
    </SessionWrapper>
  ),
}

export const Warning: Story = {
  render: () => (
    <SessionWrapper>
      <ActiveSession
        plan={createMockSessionPlanWithProblems({
          skillLevel: 'fiveComplements',
          currentPartIndex: 1,
          currentSlotIndex: 2,
          sessionHealth: {
            overall: 'warning',
            accuracy: 0.72,
            pacePercent: 85,
            currentStreak: -1,
            avgResponseTimeMs: 5000,
          },
        })}
        studentName="Luna"
        {...defaultHandlers}
      />
    </SessionWrapper>
  ),
}

/**
 * Interactive demo with simulated answering
 */
function InteractiveSessionDemo() {
  const [plan, setPlan] = useState(() =>
    createMockSessionPlanWithProblems({
      totalProblems: 6,
      skillLevel: 'basic',
      sessionHealth: {
        overall: 'good',
        accuracy: 1,
        pacePercent: 100,
        currentStreak: 0,
        avgResponseTimeMs: 0,
      },
    })
  )
  const [results, setResults] = useState<SlotResult[]>([])

  const handleAnswer = useCallback(
    async (result: Omit<SlotResult, 'timestamp' | 'partNumber'>) => {
      const fullResult: SlotResult = {
        ...result,
        partNumber: (plan.currentPartIndex + 1) as 1 | 2 | 3,
        timestamp: new Date(),
      }
      setResults((prev) => [...prev, fullResult])

      // Advance to next problem
      setPlan((prev) => {
        const currentPart = prev.parts[prev.currentPartIndex]
        const nextSlotIndex = prev.currentSlotIndex + 1

        if (nextSlotIndex >= currentPart.slots.length) {
          // Move to next part
          return {
            ...prev,
            currentPartIndex: prev.currentPartIndex + 1,
            currentSlotIndex: 0,
          }
        }

        return {
          ...prev,
          currentSlotIndex: nextSlotIndex,
        }
      })
    },
    [plan.currentPartIndex]
  )

  const handleComplete = useCallback(() => {
    alert(
      `Session complete! Results: ${results.filter((r) => r.isCorrect).length}/${results.length} correct`
    )
  }, [results])

  return (
    <SessionWrapper>
      <ActiveSession
        plan={plan}
        studentName="Interactive Demo"
        onAnswer={handleAnswer}
        onEndEarly={(reason) => alert(`Ended: ${reason}`)}
        onComplete={handleComplete}
      />
    </SessionWrapper>
  )
}

export const Interactive: Story = {
  render: () => <InteractiveSessionDemo />,
}

export const MidSession: Story = {
  render: () => (
    <SessionWrapper>
      <ActiveSession
        plan={createMockSessionPlanWithProblems({
          totalProblems: 15,
          skillLevel: 'fiveComplements',
          currentPartIndex: 0,
          currentSlotIndex: 4,
          sessionHealth: {
            overall: 'good',
            accuracy: 0.8,
            pacePercent: 95,
            currentStreak: 2,
            avgResponseTimeMs: 4200,
          },
        })}
        studentName="Sonia"
        {...defaultHandlers}
      />
    </SessionWrapper>
  ),
}
