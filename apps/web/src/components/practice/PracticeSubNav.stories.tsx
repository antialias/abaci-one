import type { Meta, StoryObj } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import type { ProblemSlot, SessionPart, SlotResult } from '@/db/schema/session-plans'
import { css } from '../../../styled-system/css'
import {
  PracticeSubNav,
  type GameBreakHudData,
  type SessionHudData,
  type TimingData,
} from './PracticeSubNav'

const meta: Meta<typeof PracticeSubNav> = {
  title: 'Practice/PracticeSubNav',
  component: PracticeSubNav,
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/practice/student-1',
      },
    },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof PracticeSubNav>

// =============================================================================
// Mock Data Helpers
// =============================================================================

const mockStudent = {
  id: 'student-1',
  name: 'Sonia',
  emoji: '🦄',
  color: '#E879F9',
}

const mockStudentLongName = {
  id: 'student-2',
  name: 'Alexander the Great',
  emoji: '👑',
  color: '#60A5FA',
}

function createMockSlots(count: number, purpose: ProblemSlot['purpose']): ProblemSlot[] {
  return Array.from({ length: count }, (_, i) => ({
    slotId: crypto.randomUUID(),
    index: i,
    purpose,
    constraints: {},
  }))
}

function createMockParts(): SessionPart[] {
  return [
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
}

function createMockResults(
  count: number,
  partType: 'abacus' | 'visualization' | 'linear'
): SlotResult[] {
  const partNumber = partType === 'abacus' ? 1 : partType === 'visualization' ? 2 : 3
  return Array.from({ length: count }, (_, i) => ({
    partNumber: partNumber as 1 | 2 | 3,
    slotIndex: i % 5,
    problem: {
      terms: [3, 4, 2],
      answer: 9,
      skillsRequired: ['basic.directAddition'],
    },
    studentAnswer: 9,
    isCorrect: Math.random() > 0.15,
    responseTimeMs: 2500 + Math.random() * 3000,
    skillsExercised: ['basic.directAddition'],
    usedOnScreenAbacus: partType === 'abacus',
    timestamp: new Date(Date.now() - (count - i) * 30000),
    hadHelp: false,
    incorrectAttempts: 0,
  }))
}

function createTimingData(
  resultCount: number,
  partType: 'abacus' | 'visualization' | 'linear'
): TimingData {
  return {
    startTime: Date.now() - 5000, // Started 5 seconds ago
    accumulatedPauseMs: 0,
    results: createMockResults(resultCount, partType),
    parts: createMockParts(),
  }
}

function createSessionHud(config: {
  isPaused?: boolean
  partType: 'abacus' | 'visualization' | 'linear'
  completedProblems: number
  totalProblems: number
  timing?: TimingData
  health?: { overall: 'good' | 'warning' | 'struggling'; accuracy: number }
  isBrowseMode?: boolean
  /** Include a mock plan with game break settings */
  gameBreakEnabled?: boolean
}): SessionHudData {
  const partNumber = config.partType === 'abacus' ? 1 : config.partType === 'visualization' ? 2 : 3
  const parts = createMockParts()
  const currentPartIndex = partNumber - 1

  // Create mock results based on completedProblems
  const results: SlotResult[] = []
  let remaining = config.completedProblems
  for (let pIdx = 0; pIdx < parts.length && remaining > 0; pIdx++) {
    const part = parts[pIdx]
    const slotsToFill = Math.min(remaining, part.slots.length)
    for (let sIdx = 0; sIdx < slotsToFill; sIdx++) {
      results.push({
        partNumber: (pIdx + 1) as 1 | 2 | 3,
        slotIndex: sIdx,
        problem: {
          terms: [3, 4],
          answer: 7,
          skillsRequired: ['basic.directAddition'],
        },
        studentAnswer: 7,
        isCorrect: Math.random() > 0.15,
        responseTimeMs: 2500 + Math.random() * 3000,
        skillsExercised: ['basic.directAddition'],
        usedOnScreenAbacus: pIdx === 0,
        timestamp: new Date(),
        hadHelp: false,
        incorrectAttempts: 0,
      })
    }
    remaining -= slotsToFill
  }

  // Create a mock plan with game break settings if enabled
  const mockPlan = config.gameBreakEnabled
    ? {
        id: 'mock-plan-1',
        playerId: 'student-1',
        targetDurationMinutes: 10,
        estimatedProblemCount: 15,
        avgTimePerProblemSeconds: 40,
        parts,
        summary: {
          focusDescription: 'Basic Addition',
          totalProblemCount: 15,
          estimatedMinutes: 10,
          parts: parts.map((p) => ({
            partNumber: p.partNumber,
            type: p.type,
            description: p.type,
            problemCount: p.slots.length,
            estimatedMinutes: p.estimatedMinutes,
          })),
        },
        masteredSkillIds: [],
        status: 'in_progress' as const,
        flowState: 'practicing' as const,
        flowUpdatedAt: new Date(),
        flowVersion: 0,
        currentPartIndex,
        currentSlotIndex: config.completedProblems % 5,
        breakStartedAt: null,
        breakReason: null,
        breakSelectedGame: null,
        breakResults: null,
        sessionHealth: null,
        adjustments: [],
        results,
        createdAt: new Date(),
        approvedAt: new Date(),
        startedAt: new Date(),
        completedAt: null,
        isPaused: false,
        pausedAt: null,
        pausedBy: null,
        pauseReason: null,
        retryState: null,
        remoteCameraSessionId: null,
        gameBreakSettings: {
          enabled: true,
          maxDurationMinutes: 5,
          selectionMode: 'kid-chooses' as const,
          selectedGame: null,
        },
      }
    : undefined

  return {
    isPaused: config.isPaused ?? false,
    parts,
    currentPartIndex,
    currentPart: {
      type: config.partType,
      partNumber,
      totalSlots: 5,
    },
    currentSlotIndex: config.completedProblems % 5,
    results,
    completedProblems: config.completedProblems,
    totalProblems: config.totalProblems,
    sessionHealth: config.health,
    timing: config.timing,
    isBrowseMode: config.isBrowseMode ?? false,
    onPause: () => console.log('Pause clicked'),
    onResume: () => console.log('Resume clicked'),
    onEndEarly: () => console.log('End early clicked'),
    onToggleBrowse: () => console.log('Toggle browse clicked'),
    onBrowseNavigate: (index) => console.log(`Navigate to problem ${index}`),
    plan: mockPlan,
  }
}

// =============================================================================
// Wrapper Component
// =============================================================================

// Create a stable QueryClient for stories
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: Infinity,
    },
  },
})

function NavWrapper({
  children,
  darkMode = false,
}: {
  children: React.ReactNode
  darkMode?: boolean
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <div
          className={css({
            minHeight: '300px',
            backgroundColor: darkMode ? '#1a1a2e' : 'gray.50',
            paddingTop: '80px', // Space for fake main nav
          })}
        >
          {/* Fake main nav placeholder */}
          <div
            className={css({
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              height: '80px',
              backgroundColor: darkMode ? 'gray.900' : 'white',
              borderBottom: '1px solid',
              borderColor: darkMode ? 'gray.700' : 'gray.200',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
            })}
          >
            <span
              className={css({
                color: darkMode ? 'gray.400' : 'gray.500',
                fontSize: '0.875rem',
              })}
            >
              Main Navigation Bar
            </span>
          </div>
          {children}
          {/* Content placeholder */}
          <div className={css({ padding: '2rem' })}>
            <div
              className={css({
                padding: '2rem',
                backgroundColor: darkMode ? 'gray.800' : 'white',
                borderRadius: '8px',
                color: darkMode ? 'gray.300' : 'gray.600',
              })}
            >
              Page content goes here...
            </div>
          </div>
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

// =============================================================================
// Dashboard States (No Active Session)
// =============================================================================

export const DashboardDefault: Story = {
  render: () => (
    <NavWrapper>
      <PracticeSubNav student={mockStudent} pageContext="dashboard" />
    </NavWrapper>
  ),
}

export const DashboardWithBannerSlot: Story = {
  render: () => (
    <NavWrapper>
      <PracticeSubNav student={mockStudent} pageContext="dashboard" />
    </NavWrapper>
  ),
}

export const DashboardLongName: Story = {
  render: () => (
    <NavWrapper>
      <PracticeSubNav student={mockStudentLongName} pageContext="dashboard" />
    </NavWrapper>
  ),
}

export const ConfigurePage: Story = {
  render: () => (
    <NavWrapper>
      <PracticeSubNav student={mockStudent} pageContext="configure" />
    </NavWrapper>
  ),
}

export const SummaryPage: Story = {
  render: () => (
    <NavWrapper>
      <PracticeSubNav student={mockStudent} pageContext="summary" />
    </NavWrapper>
  ),
}

// =============================================================================
// Active Session - Part Types
// =============================================================================

export const SessionAbacusPart: Story = {
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'abacus',
          completedProblems: 2,
          totalProblems: 15,
          timing: createTimingData(2, 'abacus'),
        })}
      />
    </NavWrapper>
  ),
}

export const SessionVisualizationPart: Story = {
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'visualization',
          completedProblems: 7,
          totalProblems: 15,
          timing: createTimingData(7, 'visualization'),
        })}
      />
    </NavWrapper>
  ),
}

export const SessionLinearPart: Story = {
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'linear',
          completedProblems: 12,
          totalProblems: 15,
          timing: createTimingData(12, 'linear'),
        })}
      />
    </NavWrapper>
  ),
}

// =============================================================================
// Active Session - Progress States
// =============================================================================

export const SessionJustStarted: Story = {
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'abacus',
          completedProblems: 0,
          totalProblems: 15,
          timing: createTimingData(0, 'abacus'),
        })}
      />
    </NavWrapper>
  ),
}

export const SessionMidway: Story = {
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'visualization',
          completedProblems: 8,
          totalProblems: 15,
          timing: createTimingData(8, 'visualization'),
          health: { overall: 'good', accuracy: 0.88 },
        })}
      />
    </NavWrapper>
  ),
}

export const SessionNearEnd: Story = {
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'linear',
          completedProblems: 14,
          totalProblems: 15,
          timing: createTimingData(14, 'linear'),
          health: { overall: 'good', accuracy: 0.93 },
        })}
      />
    </NavWrapper>
  ),
}

// =============================================================================
// Active Session - Timing Display States
// =============================================================================

export const TimingNoData: Story = {
  name: 'Timing: No Prior Data (First Problem)',
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'abacus',
          completedProblems: 0,
          totalProblems: 15,
          timing: createTimingData(0, 'abacus'),
        })}
      />
    </NavWrapper>
  ),
}

export const TimingFewSamples: Story = {
  name: 'Timing: Few Samples (No SpeedMeter)',
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'abacus',
          completedProblems: 2,
          totalProblems: 15,
          timing: createTimingData(2, 'abacus'),
        })}
      />
    </NavWrapper>
  ),
}

export const TimingWithSpeedMeter: Story = {
  name: 'Timing: With SpeedMeter (3+ Samples)',
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'abacus',
          completedProblems: 5,
          totalProblems: 15,
          timing: createTimingData(5, 'abacus'),
        })}
      />
    </NavWrapper>
  ),
}

export const TimingManyDataPoints: Story = {
  name: 'Timing: Many Data Points',
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'visualization',
          completedProblems: 10,
          totalProblems: 15,
          timing: createTimingData(10, 'visualization'),
          health: { overall: 'good', accuracy: 0.9 },
        })}
      />
    </NavWrapper>
  ),
}

// =============================================================================
// Active Session - Health States
// =============================================================================

export const HealthGood: Story = {
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'abacus',
          completedProblems: 6,
          totalProblems: 15,
          timing: createTimingData(6, 'abacus'),
          health: { overall: 'good', accuracy: 0.92 },
        })}
      />
    </NavWrapper>
  ),
}

export const HealthWarning: Story = {
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={{ ...mockStudent, emoji: '🤔', color: '#FBBF24' }}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'visualization',
          completedProblems: 8,
          totalProblems: 15,
          timing: createTimingData(8, 'visualization'),
          health: { overall: 'warning', accuracy: 0.75 },
        })}
      />
    </NavWrapper>
  ),
}

export const HealthStruggling: Story = {
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={{ ...mockStudent, emoji: '😅', color: '#F87171' }}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'linear',
          completedProblems: 5,
          totalProblems: 15,
          timing: createTimingData(5, 'linear'),
          health: { overall: 'struggling', accuracy: 0.55 },
        })}
      />
    </NavWrapper>
  ),
}

// =============================================================================
// Paused State
// =============================================================================

export const SessionPaused: Story = {
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          isPaused: true,
          partType: 'abacus',
          completedProblems: 4,
          totalProblems: 15,
          timing: createTimingData(4, 'abacus'),
          health: { overall: 'good', accuracy: 0.85 },
        })}
      />
    </NavWrapper>
  ),
}

// =============================================================================
// Dark Mode Variants
// =============================================================================

export const DarkModeDashboard: Story = {
  render: () => (
    <NavWrapper darkMode>
      <PracticeSubNav student={mockStudent} pageContext="dashboard" />
    </NavWrapper>
  ),
}

export const DarkModeSession: Story = {
  render: () => (
    <NavWrapper darkMode>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'visualization',
          completedProblems: 7,
          totalProblems: 15,
          timing: createTimingData(7, 'visualization'),
          health: { overall: 'good', accuracy: 0.88 },
        })}
      />
    </NavWrapper>
  ),
}

export const DarkModeWithWarning: Story = {
  render: () => (
    <NavWrapper darkMode>
      <PracticeSubNav
        student={{ ...mockStudent, emoji: '🌙', color: '#818CF8' }}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'linear',
          completedProblems: 10,
          totalProblems: 15,
          timing: createTimingData(10, 'linear'),
          health: { overall: 'warning', accuracy: 0.72 },
        })}
      />
    </NavWrapper>
  ),
}

// =============================================================================
// Mobile Viewport Stories
// =============================================================================

export const MobileSession: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'abacus',
          completedProblems: 5,
          totalProblems: 15,
          timing: createTimingData(5, 'abacus'),
          health: { overall: 'good', accuracy: 0.9 },
        })}
      />
    </NavWrapper>
  ),
}

export const MobileSessionLongName: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudentLongName}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'visualization',
          completedProblems: 8,
          totalProblems: 15,
          timing: createTimingData(8, 'visualization'),
          health: { overall: 'warning', accuracy: 0.78 },
        })}
      />
    </NavWrapper>
  ),
}

export const MobileDashboard: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  render: () => (
    <NavWrapper>
      <PracticeSubNav student={mockStudent} pageContext="dashboard" />
    </NavWrapper>
  ),
}

export const MobileDarkMode: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  render: () => (
    <NavWrapper darkMode>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'linear',
          completedProblems: 12,
          totalProblems: 15,
          timing: createTimingData(12, 'linear'),
          health: { overall: 'good', accuracy: 0.92 },
        })}
      />
    </NavWrapper>
  ),
}

// =============================================================================
// Tablet Viewport Stories
// =============================================================================

export const TabletSession: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'abacus',
          completedProblems: 6,
          totalProblems: 15,
          timing: createTimingData(6, 'abacus'),
          health: { overall: 'good', accuracy: 0.88 },
        })}
      />
    </NavWrapper>
  ),
}

// =============================================================================
// Different Students
// =============================================================================

export const DifferentStudents: Story = {
  render: () => {
    const students = [
      { id: '1', name: 'Luna', emoji: '🌙', color: '#818CF8' },
      { id: '2', name: 'Max', emoji: '🚀', color: '#60A5FA' },
      { id: '3', name: 'Kai', emoji: '🌊', color: '#2DD4BF' },
      { id: '4', name: 'Nova', emoji: '✨', color: '#FBBF24' },
    ]

    return (
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '0' })}>
        {students.map((student, i) => (
          <NavWrapper key={student.id}>
            <PracticeSubNav
              student={student}
              pageContext="session"
              sessionHud={createSessionHud({
                partType: i === 0 ? 'abacus' : i === 1 ? 'visualization' : 'linear',
                completedProblems: 3 + i * 3,
                totalProblems: 15,
                timing: createTimingData(
                  3 + i * 3,
                  i === 0 ? 'abacus' : i === 1 ? 'visualization' : 'linear'
                ),
                health: {
                  overall: i < 2 ? 'good' : i === 2 ? 'warning' : 'good',
                  accuracy: 0.85 - i * 0.05,
                },
              })}
            />
          </NavWrapper>
        ))}
      </div>
    )
  },
}

// =============================================================================
// Edge Cases
// =============================================================================

export const NoTimingData: Story = {
  name: 'Edge: No Timing Data',
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'abacus',
          completedProblems: 5,
          totalProblems: 15,
          // No timing data
        })}
      />
    </NavWrapper>
  ),
}

export const NoHealthData: Story = {
  name: 'Edge: No Health Data',
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'abacus',
          completedProblems: 5,
          totalProblems: 15,
          timing: createTimingData(5, 'abacus'),
          // No health data
        })}
      />
    </NavWrapper>
  ),
}

export const LargeSessionCount: Story = {
  name: 'Edge: Large Problem Count',
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'visualization',
          completedProblems: 47,
          totalProblems: 100,
          timing: createTimingData(20, 'visualization'),
          health: { overall: 'good', accuracy: 0.94 },
        })}
      />
    </NavWrapper>
  ),
}

// =============================================================================
// Game Break HUD Stories
// =============================================================================

const MAX_DURATION_MS = 5 * 60 * 1000 // 5 minutes

function createGameBreakHud(remainingMs: number): GameBreakHudData {
  return {
    startTime: Date.now() - (MAX_DURATION_MS - remainingMs),
    maxDurationMs: MAX_DURATION_MS,
    onSkip: () => console.log('Skip game break clicked'),
  }
}

/**
 * Animated game break countdown demo
 */
function AnimatedGameBreakNav({
  startPercent = 100,
  speedMultiplier = 10,
  darkMode = false,
}: {
  startPercent?: number
  speedMultiplier?: number
  darkMode?: boolean
}) {
  const [startTime] = useState(() => Date.now() - ((100 - startPercent) / 100) * MAX_DURATION_MS)
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate((n) => n + 1)
    }, 100)
    return () => clearInterval(interval)
  }, [])

  // Simulate time passing faster
  const elapsed = (Date.now() - startTime) * speedMultiplier
  const adjustedStartTime = Date.now() - elapsed

  return (
    <NavWrapper darkMode={darkMode}>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        gameBreakHud={{
          startTime: adjustedStartTime,
          maxDurationMs: MAX_DURATION_MS,
          onSkip: () => alert('Back to Practice clicked!'),
        }}
      />
      {/* Mock game content area */}
      <div
        className={css({
          padding: '2rem',
          textAlign: 'center',
        })}
      >
        <div className={css({ fontSize: '4rem', marginBottom: '1rem' })}>🎮</div>
        <div
          className={css({
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: darkMode ? 'gray.200' : 'gray.700',
            marginBottom: '0.5rem',
          })}
        >
          Game Content Area
        </div>
        <div
          className={css({
            fontSize: '0.875rem',
            color: darkMode ? 'gray.400' : 'gray.500',
          })}
        >
          The game break timer is in the sub-nav above
        </div>
      </div>
    </NavWrapper>
  )
}

export const GameBreakFullTime: Story = {
  name: 'Game Break: 100% Time (5:00)',
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        gameBreakHud={createGameBreakHud(MAX_DURATION_MS)}
      />
    </NavWrapper>
  ),
}

export const GameBreakSeventyFive: Story = {
  name: 'Game Break: 75% Time (3:45)',
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        gameBreakHud={createGameBreakHud(MAX_DURATION_MS * 0.75)}
      />
    </NavWrapper>
  ),
}

export const GameBreakFifty: Story = {
  name: 'Game Break: 50% Time (2:30) - Yellow',
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        gameBreakHud={createGameBreakHud(MAX_DURATION_MS * 0.5)}
      />
    </NavWrapper>
  ),
}

export const GameBreakThirty: Story = {
  name: 'Game Break: 30% Time (1:30) - Yellow',
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        gameBreakHud={createGameBreakHud(MAX_DURATION_MS * 0.3)}
      />
    </NavWrapper>
  ),
}

export const GameBreakTwenty: Story = {
  name: 'Game Break: 20% Time (1:00) - Red',
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        gameBreakHud={createGameBreakHud(MAX_DURATION_MS * 0.2)}
      />
    </NavWrapper>
  ),
}

export const GameBreakTen: Story = {
  name: 'Game Break: 10% Time (0:30) - Critical Red',
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        gameBreakHud={createGameBreakHud(MAX_DURATION_MS * 0.1)}
      />
    </NavWrapper>
  ),
}

export const GameBreakAnimated: Story = {
  name: 'Game Break: Animated Countdown (10x speed)',
  render: () => <AnimatedGameBreakNav speedMultiplier={10} />,
}

export const GameBreakAnimatedRealtime: Story = {
  name: 'Game Break: Animated Countdown (Real-time)',
  render: () => <AnimatedGameBreakNav speedMultiplier={1} />,
}

export const GameBreakAnimatedFromHalf: Story = {
  name: 'Game Break: Animated from 50% (10x speed)',
  render: () => <AnimatedGameBreakNav startPercent={50} speedMultiplier={10} />,
}

export const GameBreakAnimatedFinalMinute: Story = {
  name: 'Game Break: Animated Final Minute (10x speed)',
  render: () => <AnimatedGameBreakNav startPercent={20} speedMultiplier={10} />,
}

export const GameBreakDarkMode: Story = {
  name: 'Game Break: Dark Mode - Full Time',
  render: () => (
    <NavWrapper darkMode>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        gameBreakHud={createGameBreakHud(MAX_DURATION_MS)}
      />
    </NavWrapper>
  ),
}

export const GameBreakDarkModeFifty: Story = {
  name: 'Game Break: Dark Mode - 50% Time',
  render: () => (
    <NavWrapper darkMode>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        gameBreakHud={createGameBreakHud(MAX_DURATION_MS * 0.5)}
      />
    </NavWrapper>
  ),
}

export const GameBreakDarkModeCritical: Story = {
  name: 'Game Break: Dark Mode - Critical (10%)',
  render: () => (
    <NavWrapper darkMode>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        gameBreakHud={createGameBreakHud(MAX_DURATION_MS * 0.1)}
      />
    </NavWrapper>
  ),
}

export const GameBreakDarkModeAnimated: Story = {
  name: 'Game Break: Dark Mode - Animated',
  render: () => <AnimatedGameBreakNav speedMultiplier={10} darkMode />,
}

export const GameBreakMobile: Story = {
  name: 'Game Break: Mobile Viewport',
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        gameBreakHud={createGameBreakHud(MAX_DURATION_MS * 0.65)}
      />
    </NavWrapper>
  ),
}

export const GameBreakDifferentStudent: Story = {
  name: 'Game Break: Different Student (Marcus)',
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={{
          id: 'student-marcus',
          name: 'Marcus',
          emoji: '🚀',
          color: '#3b82f6',
        }}
        pageContext="session"
        gameBreakHud={createGameBreakHud(MAX_DURATION_MS * 0.7)}
      />
    </NavWrapper>
  ),
}

export const GameBreakLongName: Story = {
  name: 'Game Break: Long Student Name',
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudentLongName}
        pageContext="session"
        gameBreakHud={createGameBreakHud(MAX_DURATION_MS * 0.8)}
      />
    </NavWrapper>
  ),
}

// =============================================================================
// Game Break Indicator Stories (shown DURING practice, not during actual break)
// =============================================================================

export const GameBreakIndicatorStart: Story = {
  name: 'Game Break Indicator: Part 1 Start (5 until break)',
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'abacus',
          completedProblems: 0,
          totalProblems: 15,
          gameBreakEnabled: true,
          timing: createTimingData(0, 'abacus'),
        })}
      />
    </NavWrapper>
  ),
}

export const GameBreakIndicatorMidway: Story = {
  name: 'Game Break Indicator: Part 1 Progress (3 until break)',
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'abacus',
          completedProblems: 2,
          totalProblems: 15,
          gameBreakEnabled: true,
          timing: createTimingData(2, 'abacus'),
        })}
      />
    </NavWrapper>
  ),
}

export const GameBreakIndicatorAlmostThere: Story = {
  name: 'Game Break Indicator: Almost Done (1 until break) - Green Pulse',
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'abacus',
          completedProblems: 4,
          totalProblems: 15,
          gameBreakEnabled: true,
          timing: createTimingData(4, 'abacus'),
        })}
      />
    </NavWrapper>
  ),
}

export const GameBreakIndicatorPart2: Story = {
  name: 'Game Break Indicator: Part 2 (Shows passed break from Part 1)',
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'visualization',
          completedProblems: 6,
          totalProblems: 15,
          gameBreakEnabled: true,
          timing: createTimingData(6, 'visualization'),
        })}
      />
    </NavWrapper>
  ),
}

export const GameBreakIndicatorLastPart: Story = {
  name: 'Game Break Indicator: Part 3/Last (No countdown - no break after)',
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'linear',
          completedProblems: 11,
          totalProblems: 15,
          gameBreakEnabled: true,
          timing: createTimingData(11, 'linear'),
        })}
      />
    </NavWrapper>
  ),
}

export const GameBreakIndicatorDisabled: Story = {
  name: 'Game Break Indicator: Game Breaks Disabled (No icons or badge)',
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'abacus',
          completedProblems: 2,
          totalProblems: 15,
          gameBreakEnabled: false,
          timing: createTimingData(2, 'abacus'),
        })}
      />
    </NavWrapper>
  ),
}

export const GameBreakIndicatorDarkMode: Story = {
  name: 'Game Break Indicator: Dark Mode (3 until break)',
  render: () => (
    <NavWrapper darkMode>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'abacus',
          completedProblems: 2,
          totalProblems: 15,
          gameBreakEnabled: true,
          timing: createTimingData(2, 'abacus'),
        })}
      />
    </NavWrapper>
  ),
}

export const GameBreakIndicatorDarkAlmostThere: Story = {
  name: 'Game Break Indicator: Dark Mode Almost There (1 until break)',
  render: () => (
    <NavWrapper darkMode>
      <PracticeSubNav
        student={mockStudent}
        pageContext="session"
        sessionHud={createSessionHud({
          partType: 'abacus',
          completedProblems: 4,
          totalProblems: 15,
          gameBreakEnabled: true,
          timing: createTimingData(4, 'abacus'),
        })}
      />
    </NavWrapper>
  ),
}
