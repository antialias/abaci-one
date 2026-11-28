import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useState } from 'react'
import type { SessionPlan, SlotResult } from '@/db/schema/session-plans'
import {
  createMockSessionPlanWithProblems,
  createMockStudent,
  defaultHandlers,
} from '@/test/fixtures/story-session-plans'
import { css } from '../../../../styled-system/css'
import { SessionShell } from './SessionShell'

const meta: Meta<typeof SessionShell> = {
  title: 'Practice/SessionShell',
  component: SessionShell,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof SessionShell>

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
      <SessionShell
        plan={createMockSessionPlanWithProblems({
          skillLevel: 'basic',
          currentPartIndex: 0,
          currentSlotIndex: 0,
        })}
        student={createMockStudent('Sonia')}
        {...defaultHandlers}
      />
    </SessionWrapper>
  ),
}

export const Part2Visualization: Story = {
  render: () => (
    <SessionWrapper>
      <SessionShell
        plan={createMockSessionPlanWithProblems({
          skillLevel: 'fiveComplements',
          currentPartIndex: 1,
          currentSlotIndex: 0,
        })}
        student={createMockStudent('Marcus')}
        {...defaultHandlers}
      />
    </SessionWrapper>
  ),
}

export const Part3Linear: Story = {
  render: () => (
    <SessionWrapper>
      <SessionShell
        plan={createMockSessionPlanWithProblems({
          skillLevel: 'tenComplements',
          currentPartIndex: 2,
          currentSlotIndex: 0,
        })}
        student={createMockStudent('Luna')}
        {...defaultHandlers}
      />
    </SessionWrapper>
  ),
}

export const WithHealthIndicator: Story = {
  render: () => (
    <SessionWrapper>
      <SessionShell
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
        student={createMockStudent('Sonia')}
        {...defaultHandlers}
      />
    </SessionWrapper>
  ),
}

export const Struggling: Story = {
  render: () => (
    <SessionWrapper>
      <SessionShell
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
        student={createMockStudent('Kai')}
        {...defaultHandlers}
      />
    </SessionWrapper>
  ),
}

export const Warning: Story = {
  render: () => (
    <SessionWrapper>
      <SessionShell
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
        student={createMockStudent('Luna')}
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
  const [, setResults] = useState<SlotResult[]>([])

  const handleAnswer = useCallback(
    async (result: Omit<SlotResult, 'timestamp' | 'partNumber'>): Promise<SessionPlan | null> => {
      const fullResult: SlotResult = {
        ...result,
        partNumber: (plan.currentPartIndex + 1) as 1 | 2 | 3,
        timestamp: new Date(),
        // Default help tracking fields if not provided
        hadHelp: result.hadHelp ?? false,
        incorrectAttempts: result.incorrectAttempts ?? 0,
        helpTrigger: result.helpTrigger ?? 'none',
      }
      setResults((prev) => [...prev, fullResult])

      // Advance to next problem
      setPlan((prev) => {
        const currentPart = prev.parts[prev.currentPartIndex]
        const cursor = prev.partStates[prev.currentPartIndex] as { slotIndex?: number } | undefined
        const nextSlotIndex = (cursor?.slotIndex ?? 0) + 1

        if (nextSlotIndex >= currentPart.slots.length) {
          // Move to next part
          return {
            ...prev,
            currentPartIndex: prev.currentPartIndex + 1,
            partStates: { ...prev.partStates, [prev.currentPartIndex + 1]: { slotIndex: 0 } },
          }
        }

        return {
          ...prev,
          partStates: { ...prev.partStates, [prev.currentPartIndex]: { slotIndex: nextSlotIndex } },
        }
      })
      // No server here: the screen hands off to the plan just set
      return null
    },
    [plan.currentPartIndex]
  )

  return (
    <SessionWrapper>
      <SessionShell
        plan={plan}
        student={createMockStudent('Interactive Demo')}
        onAnswer={handleAnswer}
        onEndEarly={(reason) => alert(`Ended: ${reason}`)}
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
      <SessionShell
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
        student={createMockStudent('Sonia')}
        {...defaultHandlers}
      />
    </SessionWrapper>
  ),
}
