import type { Meta, StoryObj } from '@storybook/react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import type {
  ProblemSlot,
  SessionPart,
  SessionPlan,
  SessionSummary,
  SlotResult,
} from '@/db/schema/session-plans'
import { css } from '../../../styled-system/css'
import { type PauseInfo, SessionPausedModal } from './SessionPausedModal'

const meta: Meta<typeof SessionPausedModal> = {
  title: 'Practice/SessionPausedModal',
  component: SessionPausedModal,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof SessionPausedModal>

/**
 * Create mock slots for a session part
 */
function createMockSlots(count: number, purpose: ProblemSlot['purpose']): ProblemSlot[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    purpose,
    constraints: {},
  }))
}

/**
 * Create a mock session plan at various stages of progress
 */
function createMockSessionPlan(config: {
  currentPartIndex: number
  currentSlotIndex: number
  completedCount: number
}): SessionPlan {
  const { currentPartIndex, currentSlotIndex, completedCount } = config

  const parts: SessionPart[] = [
    {
      partNumber: 1,
      type: 'abacus',
      format: 'vertical',
      useAbacus: true,
      slots: createMockSlots(5, 'focus'),
      estimatedMinutes: 5,
    },
    {
      partNumber: 2,
      type: 'visualization',
      format: 'vertical',
      useAbacus: false,
      slots: createMockSlots(5, 'reinforce'),
      estimatedMinutes: 4,
    },
    {
      partNumber: 3,
      type: 'linear',
      format: 'linear',
      useAbacus: false,
      slots: createMockSlots(5, 'review'),
      estimatedMinutes: 3,
    },
  ]

  const summary: SessionSummary = {
    focusDescription: 'Basic Addition',
    totalProblemCount: 15,
    estimatedMinutes: 12,
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

  // Generate mock results for completed problems
  const results: SlotResult[] = Array.from({ length: completedCount }, (_, i) => ({
    partNumber: (i < 5 ? 1 : i < 10 ? 2 : 3) as 1 | 2 | 3,
    slotIndex: i % 5,
    problem: {
      terms: [3, 4, 2],
      answer: 9,
      skillsRequired: ['basic.directAddition'],
    },
    studentAnswer: 9,
    isCorrect: true,
    responseTimeMs: 3000 + Math.random() * 2000,
    skillsExercised: ['basic.directAddition'],
    usedOnScreenAbacus: i < 5,
    timestamp: new Date(Date.now() - (completedCount - i) * 30000),
    hadHelp: false,
    incorrectAttempts: 0,
  }))

  return {
    id: 'plan-123',
    playerId: 'player-1',
    targetDurationMinutes: 12,
    estimatedProblemCount: 15,
    avgTimePerProblemSeconds: 45,
    parts,
    summary,
    status: 'in_progress',
    currentPartIndex,
    currentSlotIndex,
    sessionHealth: {
      overall: 'good',
      accuracy: 0.85,
      pacePercent: 100,
      currentStreak: 3,
      avgResponseTimeMs: 3500,
    },
    adjustments: [],
    results,
    createdAt: new Date(Date.now() - 15 * 60 * 1000),
    approvedAt: new Date(Date.now() - 14 * 60 * 1000),
    startedAt: new Date(Date.now() - 10 * 60 * 1000),
    completedAt: null,
    masteredSkillIds: [],
    isPaused: false,
    pausedAt: null,
    pausedBy: null,
    pauseReason: null,
    retryState: null,
    gameBreakSettings: null,
  }
}

const mockStudent = {
  name: 'Sonia',
  emoji: '🦄',
  color: '#E879F9',
}

const handlers = {
  onResume: () => alert('Resume clicked!'),
  onEndSession: () => alert('End Session clicked!'),
}

/**
 * Wrapper for consistent styling
 */
function ModalWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <div
        className={css({
          minHeight: '100vh',
          backgroundColor: 'gray.100',
          padding: '2rem',
        })}
      >
        {children}
      </div>
    </ThemeProvider>
  )
}

// =============================================================================
// Manual Pause Stories
// =============================================================================

export const ManualPause: Story = {
  render: () => {
    const pauseInfo: PauseInfo = {
      pausedAt: new Date(Date.now() - 30 * 1000), // 30 seconds ago
      reason: 'manual',
    }
    return (
      <ModalWrapper>
        <SessionPausedModal
          isOpen={true}
          student={mockStudent}
          session={createMockSessionPlan({
            currentPartIndex: 0,
            currentSlotIndex: 3,
            completedCount: 3,
          })}
          pauseInfo={pauseInfo}
          {...handlers}
        />
      </ModalWrapper>
    )
  },
}

export const ManualPauseLong: Story = {
  render: () => {
    const pauseInfo: PauseInfo = {
      pausedAt: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
      reason: 'manual',
    }
    return (
      <ModalWrapper>
        <SessionPausedModal
          isOpen={true}
          student={mockStudent}
          session={createMockSessionPlan({
            currentPartIndex: 1,
            currentSlotIndex: 2,
            completedCount: 7,
          })}
          pauseInfo={pauseInfo}
          {...handlers}
        />
      </ModalWrapper>
    )
  },
}

// =============================================================================
// Auto-Pause with Statistics Stories
// =============================================================================

export const AutoPauseWithStatistics: Story = {
  render: () => {
    const pauseInfo: PauseInfo = {
      pausedAt: new Date(Date.now() - 15 * 1000), // 15 seconds ago
      reason: 'auto-timeout',
      autoPauseStats: {
        meanMs: 4200,
        stdDevMs: 1800,
        thresholdMs: 7800, // mean + 2*stdDev = 4200 + 3600 = 7800
        sampleCount: 8,
        usedStatistics: true,
      },
    }
    return (
      <ModalWrapper>
        <SessionPausedModal
          isOpen={true}
          student={mockStudent}
          session={createMockSessionPlan({
            currentPartIndex: 1,
            currentSlotIndex: 3,
            completedCount: 8,
          })}
          pauseInfo={pauseInfo}
          {...handlers}
        />
      </ModalWrapper>
    )
  },
}

export const AutoPauseHighVariance: Story = {
  render: () => {
    const pauseInfo: PauseInfo = {
      pausedAt: new Date(Date.now() - 45 * 1000), // 45 seconds ago
      reason: 'auto-timeout',
      autoPauseStats: {
        meanMs: 5500,
        stdDevMs: 4200, // High variance
        thresholdMs: 13900,
        sampleCount: 12,
        usedStatistics: true,
      },
    }
    return (
      <ModalWrapper>
        <SessionPausedModal
          isOpen={true}
          student={{ name: 'Marcus', emoji: '🚀', color: '#60A5FA' }}
          session={createMockSessionPlan({
            currentPartIndex: 2,
            currentSlotIndex: 2,
            completedCount: 12,
          })}
          pauseInfo={pauseInfo}
          {...handlers}
        />
      </ModalWrapper>
    )
  },
}

export const AutoPauseFastStudent: Story = {
  render: () => {
    const pauseInfo: PauseInfo = {
      pausedAt: new Date(Date.now() - 10 * 1000), // 10 seconds ago
      reason: 'auto-timeout',
      autoPauseStats: {
        meanMs: 2100, // Very fast student
        stdDevMs: 600, // Consistent
        thresholdMs: 30000, // Clamped to minimum 30s
        sampleCount: 15,
        usedStatistics: true,
      },
    }
    return (
      <ModalWrapper>
        <SessionPausedModal
          isOpen={true}
          student={{ name: 'Luna', emoji: '⚡', color: '#FBBF24' }}
          session={createMockSessionPlan({
            currentPartIndex: 2,
            currentSlotIndex: 4,
            completedCount: 14,
          })}
          pauseInfo={pauseInfo}
          {...handlers}
        />
      </ModalWrapper>
    )
  },
}

// =============================================================================
// Auto-Pause without Statistics (Default Timeout)
// =============================================================================

export const AutoPauseDefaultTimeout: Story = {
  render: () => {
    const pauseInfo: PauseInfo = {
      pausedAt: new Date(Date.now() - 20 * 1000), // 20 seconds ago
      reason: 'auto-timeout',
      autoPauseStats: {
        meanMs: 3500,
        stdDevMs: 1500,
        thresholdMs: 300000, // 5 minute default
        sampleCount: 3, // Not enough for statistics
        usedStatistics: false,
      },
    }
    return (
      <ModalWrapper>
        <SessionPausedModal
          isOpen={true}
          student={mockStudent}
          session={createMockSessionPlan({
            currentPartIndex: 0,
            currentSlotIndex: 3,
            completedCount: 3,
          })}
          pauseInfo={pauseInfo}
          {...handlers}
        />
      </ModalWrapper>
    )
  },
}

export const AutoPauseNeedsTwoMoreProblems: Story = {
  render: () => {
    const pauseInfo: PauseInfo = {
      pausedAt: new Date(Date.now() - 5 * 1000), // 5 seconds ago
      reason: 'auto-timeout',
      autoPauseStats: {
        meanMs: 4000,
        stdDevMs: 2000,
        thresholdMs: 300000, // 5 minute default
        sampleCount: 3, // Need 5-3=2 more
        usedStatistics: false,
      },
    }
    return (
      <ModalWrapper>
        <SessionPausedModal
          isOpen={true}
          student={{ name: 'Kai', emoji: '🌟', color: '#34D399' }}
          session={createMockSessionPlan({
            currentPartIndex: 0,
            currentSlotIndex: 3,
            completedCount: 3,
          })}
          pauseInfo={pauseInfo}
          {...handlers}
        />
      </ModalWrapper>
    )
  },
}

export const AutoPauseNeedsOneMoreProblem: Story = {
  render: () => {
    const pauseInfo: PauseInfo = {
      pausedAt: new Date(Date.now() - 8 * 1000), // 8 seconds ago
      reason: 'auto-timeout',
      autoPauseStats: {
        meanMs: 3200,
        stdDevMs: 1100,
        thresholdMs: 300000, // 5 minute default
        sampleCount: 4, // Need 5-4=1 more
        usedStatistics: false,
      },
    }
    return (
      <ModalWrapper>
        <SessionPausedModal
          isOpen={true}
          student={{ name: 'Nova', emoji: '✨', color: '#F472B6' }}
          session={createMockSessionPlan({
            currentPartIndex: 0,
            currentSlotIndex: 4,
            completedCount: 4,
          })}
          pauseInfo={pauseInfo}
          {...handlers}
        />
      </ModalWrapper>
    )
  },
}

// =============================================================================
// Progress State Stories
// =============================================================================

export const EarlyInSession: Story = {
  render: () => {
    const pauseInfo: PauseInfo = {
      pausedAt: new Date(Date.now() - 15 * 1000),
      reason: 'manual',
    }
    return (
      <ModalWrapper>
        <SessionPausedModal
          isOpen={true}
          student={mockStudent}
          session={createMockSessionPlan({
            currentPartIndex: 0,
            currentSlotIndex: 1,
            completedCount: 1,
          })}
          pauseInfo={pauseInfo}
          {...handlers}
        />
      </ModalWrapper>
    )
  },
}

export const MidSession: Story = {
  render: () => {
    const pauseInfo: PauseInfo = {
      pausedAt: new Date(Date.now() - 30 * 1000),
      reason: 'manual',
    }
    return (
      <ModalWrapper>
        <SessionPausedModal
          isOpen={true}
          student={mockStudent}
          session={createMockSessionPlan({
            currentPartIndex: 1,
            currentSlotIndex: 2,
            completedCount: 7,
          })}
          pauseInfo={pauseInfo}
          {...handlers}
        />
      </ModalWrapper>
    )
  },
}

export const NearEnd: Story = {
  render: () => {
    const pauseInfo: PauseInfo = {
      pausedAt: new Date(Date.now() - 20 * 1000),
      reason: 'manual',
    }
    return (
      <ModalWrapper>
        <SessionPausedModal
          isOpen={true}
          student={mockStudent}
          session={createMockSessionPlan({
            currentPartIndex: 2,
            currentSlotIndex: 4,
            completedCount: 14,
          })}
          pauseInfo={pauseInfo}
          {...handlers}
        />
      </ModalWrapper>
    )
  },
}

// =============================================================================
// Different Part Types
// =============================================================================

export const InAbacusPart: Story = {
  render: () => {
    const pauseInfo: PauseInfo = {
      pausedAt: new Date(Date.now() - 25 * 1000),
      reason: 'auto-timeout',
      autoPauseStats: {
        meanMs: 5000,
        stdDevMs: 2000,
        thresholdMs: 9000,
        sampleCount: 6,
        usedStatistics: true,
      },
    }
    return (
      <ModalWrapper>
        <SessionPausedModal
          isOpen={true}
          student={{ name: 'Alex', emoji: '🧮', color: '#818CF8' }}
          session={createMockSessionPlan({
            currentPartIndex: 0,
            currentSlotIndex: 2,
            completedCount: 2,
          })}
          pauseInfo={pauseInfo}
          {...handlers}
        />
      </ModalWrapper>
    )
  },
}

export const InVisualizationPart: Story = {
  render: () => {
    const pauseInfo: PauseInfo = {
      pausedAt: new Date(Date.now() - 40 * 1000),
      reason: 'auto-timeout',
      autoPauseStats: {
        meanMs: 4500,
        stdDevMs: 1500,
        thresholdMs: 7500,
        sampleCount: 8,
        usedStatistics: true,
      },
    }
    return (
      <ModalWrapper>
        <SessionPausedModal
          isOpen={true}
          student={{ name: 'Maya', emoji: '🧠', color: '#FB923C' }}
          session={createMockSessionPlan({
            currentPartIndex: 1,
            currentSlotIndex: 3,
            completedCount: 8,
          })}
          pauseInfo={pauseInfo}
          {...handlers}
        />
      </ModalWrapper>
    )
  },
}

export const InLinearPart: Story = {
  render: () => {
    const pauseInfo: PauseInfo = {
      pausedAt: new Date(Date.now() - 55 * 1000),
      reason: 'auto-timeout',
      autoPauseStats: {
        meanMs: 3200,
        stdDevMs: 900,
        thresholdMs: 5000,
        sampleCount: 11,
        usedStatistics: true,
      },
    }
    return (
      <ModalWrapper>
        <SessionPausedModal
          isOpen={true}
          student={{ name: 'River', emoji: '💭', color: '#2DD4BF' }}
          session={createMockSessionPlan({
            currentPartIndex: 2,
            currentSlotIndex: 1,
            completedCount: 11,
          })}
          pauseInfo={pauseInfo}
          {...handlers}
        />
      </ModalWrapper>
    )
  },
}

// =============================================================================
// Long Pause Durations
// =============================================================================

export const LongPause: Story = {
  render: () => {
    const pauseInfo: PauseInfo = {
      pausedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      reason: 'manual',
    }
    return (
      <ModalWrapper>
        <SessionPausedModal
          isOpen={true}
          student={mockStudent}
          session={createMockSessionPlan({
            currentPartIndex: 1,
            currentSlotIndex: 0,
            completedCount: 5,
          })}
          pauseInfo={pauseInfo}
          {...handlers}
        />
      </ModalWrapper>
    )
  },
}

export const VeryLongPause: Story = {
  render: () => {
    const pauseInfo: PauseInfo = {
      pausedAt: new Date(Date.now() - 25 * 60 * 1000), // 25 minutes ago
      reason: 'manual',
    }
    return (
      <ModalWrapper>
        <SessionPausedModal
          isOpen={true}
          student={mockStudent}
          session={createMockSessionPlan({
            currentPartIndex: 0,
            currentSlotIndex: 2,
            completedCount: 2,
          })}
          pauseInfo={pauseInfo}
          {...handlers}
        />
      </ModalWrapper>
    )
  },
}

export const HourLongPause: Story = {
  render: () => {
    const pauseInfo: PauseInfo = {
      pausedAt: new Date(Date.now() - 72 * 60 * 1000), // 1h 12m ago
      reason: 'manual',
    }
    return (
      <ModalWrapper>
        <SessionPausedModal
          isOpen={true}
          student={{ name: 'Sleepy', emoji: '😴', color: '#94A3B8' }}
          session={createMockSessionPlan({
            currentPartIndex: 1,
            currentSlotIndex: 1,
            completedCount: 6,
          })}
          pauseInfo={pauseInfo}
          {...handlers}
        />
      </ModalWrapper>
    )
  },
}

// =============================================================================
// Legacy (No Pause Info)
// =============================================================================

export const NoPauseInfo: Story = {
  render: () => {
    return (
      <ModalWrapper>
        <SessionPausedModal
          isOpen={true}
          student={mockStudent}
          session={createMockSessionPlan({
            currentPartIndex: 1,
            currentSlotIndex: 2,
            completedCount: 7,
          })}
          {...handlers}
        />
      </ModalWrapper>
    )
  },
}

// =============================================================================
// All Cases Comparison
// =============================================================================

export const AllPauseTypes: Story = {
  render: () => {
    const manualPause: PauseInfo = {
      pausedAt: new Date(Date.now() - 30 * 1000),
      reason: 'manual',
    }

    const autoWithStats: PauseInfo = {
      pausedAt: new Date(Date.now() - 15 * 1000),
      reason: 'auto-timeout',
      autoPauseStats: {
        meanMs: 4200,
        stdDevMs: 1800,
        thresholdMs: 7800,
        sampleCount: 8,
        usedStatistics: true,
      },
    }

    const autoWithoutStats: PauseInfo = {
      pausedAt: new Date(Date.now() - 20 * 1000),
      reason: 'auto-timeout',
      autoPauseStats: {
        meanMs: 3500,
        stdDevMs: 1500,
        thresholdMs: 300000,
        sampleCount: 3,
        usedStatistics: false,
      },
    }

    return (
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem',
        })}
      >
        <div>
          <h3
            className={css({
              fontSize: '1.25rem',
              fontWeight: 'bold',
              marginBottom: '1rem',
              padding: '0 2rem',
            })}
          >
            Manual Pause
          </h3>
          <ModalWrapper>
            <SessionPausedModal
              isOpen={true}
              student={{ name: 'Manual', emoji: '✋', color: '#60A5FA' }}
              session={createMockSessionPlan({
                currentPartIndex: 1,
                currentSlotIndex: 2,
                completedCount: 7,
              })}
              pauseInfo={manualPause}
              {...handlers}
            />
          </ModalWrapper>
        </div>

        <div>
          <h3
            className={css({
              fontSize: '1.25rem',
              fontWeight: 'bold',
              marginBottom: '1rem',
              padding: '0 2rem',
            })}
          >
            Auto-Pause with Statistics
          </h3>
          <ModalWrapper>
            <SessionPausedModal
              isOpen={true}
              student={{ name: 'Stats', emoji: '📊', color: '#34D399' }}
              session={createMockSessionPlan({
                currentPartIndex: 1,
                currentSlotIndex: 3,
                completedCount: 8,
              })}
              pauseInfo={autoWithStats}
              {...handlers}
            />
          </ModalWrapper>
        </div>

        <div>
          <h3
            className={css({
              fontSize: '1.25rem',
              fontWeight: 'bold',
              marginBottom: '1rem',
              padding: '0 2rem',
            })}
          >
            Auto-Pause (Default Timeout)
          </h3>
          <ModalWrapper>
            <SessionPausedModal
              isOpen={true}
              student={{ name: 'Default', emoji: '⏱️', color: '#FBBF24' }}
              session={createMockSessionPlan({
                currentPartIndex: 0,
                currentSlotIndex: 3,
                completedCount: 3,
              })}
              pauseInfo={autoWithoutStats}
              {...handlers}
            />
          </ModalWrapper>
        </div>
      </div>
    )
  },
}
