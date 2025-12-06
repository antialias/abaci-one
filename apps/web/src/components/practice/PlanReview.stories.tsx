import type { Meta, StoryObj } from '@storybook/react'
import type {
  ProblemSlot,
  SessionPart,
  SessionPlan,
  SessionSummary,
} from '@/db/schema/session-plans'
import { createBasicSkillSet } from '@/types/tutorial'
import { css } from '../../../styled-system/css'
import { PlanReview } from './PlanReview'

const meta: Meta<typeof PlanReview> = {
  title: 'Practice/PlanReview',
  component: PlanReview,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof PlanReview>

/**
 * Helper to create mock problem slots
 */
function createMockSlots(
  count: number,
  purposes: Array<'focus' | 'reinforce' | 'review' | 'challenge'> = ['focus', 'reinforce', 'review']
): ProblemSlot[] {
  const baseSkills = createBasicSkillSet()
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    purpose: purposes[i % purposes.length],
    constraints: {
      requiredSkills: {
        basic: {
          directAddition: true,
          heavenBead: true,
        },
      },
      digitRange: { min: 1, max: 1 },
      termCount: { min: 3, max: 4 },
    },
  }))
}

/**
 * Create a complete mock session plan
 */
function createMockSessionPlan(config: {
  totalProblems?: number
  durationMinutes?: number
  focusDescription?: string
}): SessionPlan {
  const totalProblems = config.totalProblems || 15
  const durationMinutes = config.durationMinutes || 10
  const focusDescription = config.focusDescription || 'Five Complements: 4 = 5 - 1'

  // Distribute problems across parts (50%, 30%, 20%)
  const part1Count = Math.round(totalProblems * 0.5)
  const part2Count = Math.round(totalProblems * 0.3)
  const part3Count = totalProblems - part1Count - part2Count

  const parts: SessionPart[] = [
    {
      partNumber: 1,
      type: 'abacus',
      format: 'vertical',
      useAbacus: true,
      slots: createMockSlots(part1Count, ['focus', 'focus', 'reinforce']),
      estimatedMinutes: Math.round(durationMinutes * 0.5),
    },
    {
      partNumber: 2,
      type: 'visualization',
      format: 'vertical',
      useAbacus: false,
      slots: createMockSlots(part2Count, ['focus', 'reinforce', 'review']),
      estimatedMinutes: Math.round(durationMinutes * 0.3),
    },
    {
      partNumber: 3,
      type: 'linear',
      format: 'linear',
      useAbacus: false,
      slots: createMockSlots(part3Count, ['review', 'challenge']),
      estimatedMinutes: Math.round(durationMinutes * 0.2),
    },
  ]

  const summary: SessionSummary = {
    focusDescription,
    totalProblemCount: totalProblems,
    estimatedMinutes: durationMinutes,
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
    id: 'plan-mock-123',
    playerId: 'player-1',
    targetDurationMinutes: durationMinutes,
    estimatedProblemCount: totalProblems,
    avgTimePerProblemSeconds: 40,
    parts,
    summary,
    status: 'draft',
    currentPartIndex: 0,
    currentSlotIndex: 0,
    sessionHealth: null,
    adjustments: [],
    results: [],
    createdAt: Date.now(),
    approvedAt: null,
    startedAt: null,
    completedAt: null,
  }
}

/**
 * Wrapper for consistent styling
 */
function PlanWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={css({
        backgroundColor: 'gray.50',
        padding: '2rem',
        borderRadius: '12px',
        minWidth: '600px',
      })}
    >
      {children}
    </div>
  )
}

const handlers = {
  onApprove: () => alert("Let's Go! clicked - Session would start"),
  onCancel: () => alert('Cancel clicked - Would return to dashboard'),
}

export const Default: Story = {
  render: () => (
    <PlanWrapper>
      <PlanReview plan={createMockSessionPlan({})} studentName="Sonia" {...handlers} />
    </PlanWrapper>
  ),
}

export const ShortSession: Story = {
  render: () => (
    <PlanWrapper>
      <PlanReview
        plan={createMockSessionPlan({
          totalProblems: 9,
          durationMinutes: 5,
          focusDescription: 'Basic Addition Review',
        })}
        studentName="Marcus"
        {...handlers}
      />
    </PlanWrapper>
  ),
}

export const LongSession: Story = {
  render: () => (
    <PlanWrapper>
      <PlanReview
        plan={createMockSessionPlan({
          totalProblems: 30,
          durationMinutes: 20,
          focusDescription: 'Ten Complements: 9 = 10 - 1, 8 = 10 - 2',
        })}
        studentName="Luna"
        {...handlers}
      />
    </PlanWrapper>
  ),
}

export const FiveComplementsFocus: Story = {
  render: () => (
    <PlanWrapper>
      <PlanReview
        plan={createMockSessionPlan({
          totalProblems: 18,
          durationMinutes: 12,
          focusDescription: 'Five Complements: 3 = 5 - 2',
        })}
        studentName="Kai"
        {...handlers}
      />
    </PlanWrapper>
  ),
}

export const TenComplementsFocus: Story = {
  render: () => (
    <PlanWrapper>
      <PlanReview
        plan={createMockSessionPlan({
          totalProblems: 21,
          durationMinutes: 15,
          focusDescription: 'Ten Complements Practice',
        })}
        studentName="Sonia"
        {...handlers}
      />
    </PlanWrapper>
  ),
}

export const ReviewSession: Story = {
  render: () => {
    const plan = createMockSessionPlan({
      totalProblems: 12,
      durationMinutes: 8,
      focusDescription: 'Mixed Review: All Skills',
    })
    // Modify slots to have more review problems
    plan.parts.forEach((part) => {
      part.slots = part.slots.map((slot, i) => ({
        ...slot,
        purpose: i % 2 === 0 ? 'review' : 'reinforce',
      }))
    })
    return (
      <PlanWrapper>
        <PlanReview plan={plan} studentName="Sonia" {...handlers} />
      </PlanWrapper>
    )
  },
}

/**
 * Shows multiple session plans side by side for comparison
 */
export const PlanComparison: Story = {
  render: () => (
    <div className={css({ display: 'flex', gap: '2rem', flexWrap: 'wrap' })}>
      <PlanWrapper>
        <PlanReview
          plan={createMockSessionPlan({
            totalProblems: 9,
            durationMinutes: 5,
            focusDescription: 'Quick Practice',
          })}
          studentName="Student"
          {...handlers}
        />
      </PlanWrapper>
      <PlanWrapper>
        <PlanReview
          plan={createMockSessionPlan({
            totalProblems: 21,
            durationMinutes: 15,
            focusDescription: 'Standard Session',
          })}
          studentName="Student"
          {...handlers}
        />
      </PlanWrapper>
    </div>
  ),
}
