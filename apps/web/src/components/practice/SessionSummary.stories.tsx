import type { Meta, StoryObj } from '@storybook/react'
import type React from 'react'
import { useEffect } from 'react'
import type {
  GeneratedProblem,
  ProblemSlot,
  SessionPart,
  SessionPlan,
  SessionSummary as SessionSummaryType,
  SlotResult,
} from '@/db/schema/session-plans'
import { createBasicSkillSet, type SkillSet } from '@/types/tutorial'
import {
  analyzeRequiredSkills,
  type ProblemConstraints as GeneratorConstraints,
  generateSingleProblem,
} from '@/utils/problemGenerator'
import { ThemeProvider } from '@/contexts/ThemeContext'
import {
  SessionModeBannerProvider,
  useSessionModeBanner,
} from '@/contexts/SessionModeBannerContext'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import type { SkillReadinessResult } from '@/lib/curriculum/skill-readiness'
import { css } from '../../../styled-system/css'
import { ContentBannerSlot } from './BannerSlots'
import { SessionSummary } from './SessionSummary'

const meta: Meta<typeof SessionSummary> = {
  title: 'Practice/SessionSummary',
  component: SessionSummary,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof SessionSummary>

/**
 * Generate a skill-appropriate problem for results
 */
function generateProblemForResult(
  skillLevel: 'basic' | 'fiveComplements' | 'tenComplements'
): GeneratedProblem {
  const baseSkills = createBasicSkillSet()

  baseSkills.basic.directAddition = true
  baseSkills.basic.heavenBead = true
  baseSkills.basic.simpleCombinations = true

  if (skillLevel === 'fiveComplements' || skillLevel === 'tenComplements') {
    baseSkills.fiveComplements['4=5-1'] = true
    baseSkills.fiveComplements['3=5-2'] = true
  }

  if (skillLevel === 'tenComplements') {
    baseSkills.tenComplements['9=10-1'] = true
    baseSkills.tenComplements['8=10-2'] = true
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

  const terms = [3, 4, 2]
  return {
    terms,
    answer: terms.reduce((a, b) => a + b, 0),
    skillsRequired: analyzeRequiredSkills(terms, 9),
  }
}

/**
 * Generate mock results with real problem data
 */
function generateMockResults(config: {
  count: number
  correctRate: number
  skillLevel?: 'basic' | 'fiveComplements' | 'tenComplements'
  abacusUsageRate?: number
}): SlotResult[] {
  const { count, correctRate, skillLevel = 'basic', abacusUsageRate = 0.3 } = config

  return Array.from({ length: count }, (_, i) => {
    const problem = generateProblemForResult(skillLevel)
    const isCorrect = Math.random() < correctRate
    const usedAbacus = i < Math.floor(count * 0.5) && Math.random() < abacusUsageRate

    return {
      partNumber: (i < Math.floor(count * 0.5) ? 1 : i < Math.floor(count * 0.8) ? 2 : 3) as
        | 1
        | 2
        | 3,
      slotIndex: i,
      problem,
      studentAnswer: isCorrect ? problem.answer : problem.answer + (Math.random() > 0.5 ? 1 : -1),
      isCorrect,
      responseTimeMs: 2000 + Math.random() * 6000,
      skillsExercised: problem.skillsRequired,
      usedOnScreenAbacus: usedAbacus,
      timestamp: new Date(Date.now() - (count - i) * 30000),
      hadHelp: false,
      incorrectAttempts: 0,
    }
  })
}

/**
 * Create a completed session plan
 */
function createCompletedSessionPlan(config: {
  results: SlotResult[]
  skillLevel?: 'basic' | 'fiveComplements' | 'tenComplements'
}): SessionPlan {
  const { results, skillLevel = 'basic' } = config
  const totalProblems = results.length

  const part1Count = Math.round(totalProblems * 0.5)
  const part2Count = Math.round(totalProblems * 0.3)
  const part3Count = totalProblems - part1Count - part2Count

  const createSlots = (count: number): ProblemSlot[] =>
    Array.from({ length: count }, (_, i) => ({
      index: i,
      purpose: 'focus' as const,
      constraints: {
        allowedSkills: { basic: { directAddition: true } } as Partial<SkillSet>,
        digitRange: { min: 1, max: 1 },
        termCount: { min: 3, max: 4 },
      },
    }))

  const parts: SessionPart[] = [
    {
      partNumber: 1,
      type: 'abacus',
      format: 'vertical',
      useAbacus: true,
      slots: createSlots(part1Count),
      estimatedMinutes: 5,
    },
    {
      partNumber: 2,
      type: 'visualization',
      format: 'vertical',
      useAbacus: false,
      slots: createSlots(part2Count),
      estimatedMinutes: 3,
    },
    {
      partNumber: 3,
      type: 'linear',
      format: 'linear',
      useAbacus: false,
      slots: createSlots(part3Count),
      estimatedMinutes: 2,
    },
  ]

  const summary: SessionSummaryType = {
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

  const sessionDurationMs = 8 * 60 * 1000 // 8 minutes

  return {
    id: 'plan-completed-123',
    playerId: 'player-1',
    targetDurationMinutes: 10,
    estimatedProblemCount: totalProblems,
    avgTimePerProblemSeconds: 40,
    gameBreakSettings: null,
    masteredSkillIds: [],
    parts,
    summary,
    status: 'completed',
    flowState: 'completed',
    flowUpdatedAt: new Date(),
    flowVersion: 0,
    currentPartIndex: parts.length,
    currentSlotIndex: 0,
    breakStartedAt: null,
    breakReason: null,
    breakSelectedGame: null,
    breakResults: null,
    sessionHealth: {
      overall: 'good',
      accuracy: results.filter((r) => r.isCorrect).length / results.length,
      pacePercent: 100,
      currentStreak: 0,
      avgResponseTimeMs: results.reduce((sum, r) => sum + r.responseTimeMs, 0) / results.length,
    },
    adjustments: [],
    results,
    retryState: null,
    remoteCameraSessionId: null,
    isPaused: false,
    pausedAt: null,
    pausedBy: null,
    pauseReason: null,
    createdAt: new Date(Date.now() - sessionDurationMs - 120000),
    approvedAt: new Date(Date.now() - sessionDurationMs - 60000),
    startedAt: new Date(Date.now() - sessionDurationMs),
    completedAt: new Date(),
  }
}

const handlers = {
  studentId: 'storybook-test-student',
  onPracticeAgain: () => alert('Practice Again clicked!'),
}

/**
 * Wrapper for consistent styling
 */
function SummaryWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={css({
        backgroundColor: 'gray.100',
        padding: '2rem',
        borderRadius: '12px',
        minWidth: '600px',
      })}
    >
      {children}
    </div>
  )
}

export const Excellent: Story = {
  render: () => {
    const results = generateMockResults({
      count: 15,
      correctRate: 0.95,
      skillLevel: 'basic',
    })
    return (
      <SummaryWrapper>
        <SessionSummary
          plan={createCompletedSessionPlan({ results, skillLevel: 'basic' })}
          studentName="Sonia"
          {...handlers}
        />
      </SummaryWrapper>
    )
  },
}

export const Good: Story = {
  render: () => {
    const results = generateMockResults({
      count: 15,
      correctRate: 0.8,
      skillLevel: 'fiveComplements',
    })
    return (
      <SummaryWrapper>
        <SessionSummary
          plan={createCompletedSessionPlan({
            results,
            skillLevel: 'fiveComplements',
          })}
          studentName="Marcus"
          {...handlers}
        />
      </SummaryWrapper>
    )
  },
}

export const Average: Story = {
  render: () => {
    const results = generateMockResults({
      count: 15,
      correctRate: 0.65,
      skillLevel: 'tenComplements',
    })
    return (
      <SummaryWrapper>
        <SessionSummary
          plan={createCompletedSessionPlan({
            results,
            skillLevel: 'tenComplements',
          })}
          studentName="Luna"
          {...handlers}
        />
      </SummaryWrapper>
    )
  },
}

export const NeedsWork: Story = {
  render: () => {
    const results = generateMockResults({
      count: 12,
      correctRate: 0.5,
      skillLevel: 'tenComplements',
    })
    return (
      <SummaryWrapper>
        <SessionSummary
          plan={createCompletedSessionPlan({
            results,
            skillLevel: 'tenComplements',
          })}
          studentName="Kai"
          {...handlers}
        />
      </SummaryWrapper>
    )
  },
}

export const PerfectScore: Story = {
  render: () => {
    const results = generateMockResults({
      count: 15,
      correctRate: 1.0,
      skillLevel: 'basic',
    })
    return (
      <SummaryWrapper>
        <SessionSummary
          plan={createCompletedSessionPlan({ results, skillLevel: 'basic' })}
          studentName="Star Student"
          {...handlers}
        />
      </SummaryWrapper>
    )
  },
}

export const ShortSession: Story = {
  render: () => {
    const results = generateMockResults({
      count: 6,
      correctRate: 0.83,
      skillLevel: 'basic',
    })
    return (
      <SummaryWrapper>
        <SessionSummary
          plan={createCompletedSessionPlan({ results, skillLevel: 'basic' })}
          studentName="Quick Learner"
          {...handlers}
        />
      </SummaryWrapper>
    )
  },
}

export const LongSession: Story = {
  render: () => {
    const results = generateMockResults({
      count: 30,
      correctRate: 0.77,
      skillLevel: 'fiveComplements',
    })
    return (
      <SummaryWrapper>
        <SessionSummary
          plan={createCompletedSessionPlan({
            results,
            skillLevel: 'fiveComplements',
          })}
          studentName="Dedicated Learner"
          {...handlers}
        />
      </SummaryWrapper>
    )
  },
}

export const HighAbacusUsage: Story = {
  render: () => {
    const results = generateMockResults({
      count: 15,
      correctRate: 0.87,
      skillLevel: 'basic',
      abacusUsageRate: 0.8,
    })
    return (
      <SummaryWrapper>
        <SessionSummary
          plan={createCompletedSessionPlan({ results, skillLevel: 'basic' })}
          studentName="Abacus User"
          {...handlers}
        />
      </SummaryWrapper>
    )
  },
}

export const NoAbacusUsage: Story = {
  render: () => {
    const results = generateMockResults({
      count: 15,
      correctRate: 0.9,
      skillLevel: 'fiveComplements',
      abacusUsageRate: 0,
    })
    return (
      <SummaryWrapper>
        <SessionSummary
          plan={createCompletedSessionPlan({
            results,
            skillLevel: 'fiveComplements',
          })}
          studentName="Mental Math Pro"
          {...handlers}
        />
      </SummaryWrapper>
    )
  },
}

/**
 * Comparison of different performance levels
 */
export const PerformanceComparison: Story = {
  render: () => (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '2rem' })}>
      {[
        { name: 'Excellent (95%)', rate: 0.95 },
        { name: 'Good (80%)', rate: 0.8 },
        { name: 'Needs Work (55%)', rate: 0.55 },
      ].map(({ name, rate }) => {
        const results = generateMockResults({
          count: 10,
          correctRate: rate,
          skillLevel: 'basic',
        })
        return (
          <SummaryWrapper key={name}>
            <SessionSummary
              plan={createCompletedSessionPlan({
                results,
                skillLevel: 'basic',
              })}
              studentName={name}
              {...handlers}
            />
          </SummaryWrapper>
        )
      })}
    </div>
  ),
}

// =============================================================================
// Just-Completed + Banner Composite Stories
// =============================================================================

/**
 * Helper that registers action/defer callbacks with the banner provider.
 */
function ActionRegistrar() {
  const { setOnAction, setOnDefer } = useSessionModeBanner()
  useEffect(() => {
    setOnAction(() => alert('Practice action triggered!'))
    setOnDefer(() => alert('Deferred!'))
  }, [setOnAction, setOnDefer])
  return null
}

/**
 * Perfect session with justCompleted=true — triggers PerfectSessionCelebration
 * (confetti + celebration card). All results are correct.
 */
export const PerfectSessionJustCompleted: Story = {
  render: () => {
    const results = generateMockResults({
      count: 15,
      correctRate: 1.0,
      skillLevel: 'basic',
    })
    return (
      <SummaryWrapper>
        <SessionSummary
          plan={createCompletedSessionPlan({ results, skillLevel: 'basic' })}
          studentName="Sonia"
          justCompleted
          {...handlers}
        />
      </SummaryWrapper>
    )
  },
}

/**
 * Just completed with good (but not perfect) score — shows the
 * non-celebration "Great Work" header for contrast.
 */
export const JustCompletedGoodScore: Story = {
  render: () => {
    const results = generateMockResults({
      count: 15,
      correctRate: 0.8,
      skillLevel: 'basic',
    })
    return (
      <SummaryWrapper>
        <SessionSummary
          plan={createCompletedSessionPlan({ results, skillLevel: 'basic' })}
          studentName="Marcus"
          justCompleted
          {...handlers}
        />
      </SummaryWrapper>
    )
  },
}

// Mock session modes for composite stories

const mockProgressionMode: SessionMode = {
  type: 'progression',
  nextSkill: {
    skillId: 'heaven.5',
    displayName: '+5 (Heaven Bead)',
    pKnown: 0,
  },
  phase: {
    id: 'level1-phase2',
    name: 'Heaven Bead',
    primarySkillId: 'heaven.5',
  } as any,
  tutorialRequired: true,
  skipCount: 0,
  focusDescription: 'Ready to learn +5 (Heaven Bead)',
  canSkipTutorial: true,
}

const mockMaintenanceDeferredMode: SessionMode = {
  type: 'maintenance',
  skillCount: 5,
  focusDescription: 'Mixed practice',
  deferredProgression: {
    nextSkill: {
      skillId: 'heaven.5',
      displayName: '+5 (Heaven Bead)',
      pKnown: 0,
    },
    readiness: {
      'add.3': {
        skillId: 'add.3',
        isSolid: false,
        dimensions: {
          mastery: { met: true, pKnown: 0.88, confidence: 0.65 },
          volume: { met: true, opportunities: 28, sessionCount: 4 },
          speed: { met: false, medianSecondsPerTerm: 5.3 },
          consistency: {
            met: false,
            recentAccuracy: 0.73,
            lastFiveAllCorrect: false,
            recentHelpCount: 2,
          },
        },
      } satisfies SkillReadinessResult,
    },
    phase: {
      id: 'level1-phase2',
      name: 'Heaven Bead',
      primarySkillId: 'heaven.5',
    } as any,
  },
}

/**
 * Composite: Perfect session celebration with a progression-mode banner above.
 * Shows the banner + celebration card together as on the real summary page.
 */
export const PerfectSessionWithBanner: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => {
    const results = generateMockResults({
      count: 15,
      correctRate: 1.0,
      skillLevel: 'basic',
    })
    return (
      <ThemeProvider>
        <SessionModeBannerProvider sessionMode={mockProgressionMode} isLoading={false}>
          <ActionRegistrar />
          <div
            className={css({
              backgroundColor: 'gray.100',
              padding: '2rem',
              minHeight: '100vh',
            })}
          >
            <div className={css({ maxWidth: '700px', margin: '0 auto' })}>
              <ContentBannerSlot className={css({ marginBottom: '1.5rem' })} />
              <SessionSummary
                plan={createCompletedSessionPlan({ results, skillLevel: 'basic' })}
                studentName="Sonia"
                justCompleted
                {...handlers}
              />
            </div>
          </div>
        </SessionModeBannerProvider>
      </ThemeProvider>
    )
  },
}

/**
 * Composite: Maintenance mode with deferred progression (inline ReadinessReport)
 * above the session summary.
 */
export const SummaryWithMaintenanceDeferredBanner: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => {
    const results = generateMockResults({
      count: 15,
      correctRate: 0.87,
      skillLevel: 'basic',
    })
    return (
      <ThemeProvider>
        <SessionModeBannerProvider sessionMode={mockMaintenanceDeferredMode} isLoading={false}>
          <ActionRegistrar />
          <div
            className={css({
              backgroundColor: 'gray.100',
              padding: '2rem',
              minHeight: '100vh',
            })}
          >
            <div className={css({ maxWidth: '700px', margin: '0 auto' })}>
              <ContentBannerSlot className={css({ marginBottom: '1.5rem' })} />
              <SessionSummary
                plan={createCompletedSessionPlan({ results, skillLevel: 'basic' })}
                studentName="Sonia"
                justCompleted
                {...handlers}
              />
            </div>
          </div>
        </SessionModeBannerProvider>
      </ThemeProvider>
    )
  },
}
