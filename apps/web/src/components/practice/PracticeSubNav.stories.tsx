import type { Meta, StoryObj } from '@storybook/react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import type { ProblemSlot, SessionPart, SlotResult } from '@/db/schema/session-plans'
import { css } from '../../../styled-system/css'
import { PracticeSubNav, type SessionHudData, type TimingData } from './PracticeSubNav'

const meta: Meta<typeof PracticeSubNav> = {
  title: 'Practice/PracticeSubNav',
  component: PracticeSubNav,
  parameters: {
    layout: 'fullscreen',
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
    helpLevelUsed: 0,
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
}): SessionHudData {
  const partNumber = config.partType === 'abacus' ? 1 : config.partType === 'visualization' ? 2 : 3
  return {
    isPaused: config.isPaused ?? false,
    currentPart: {
      type: config.partType,
      partNumber,
      totalSlots: 5,
    },
    currentSlotIndex: config.completedProblems % 5,
    completedProblems: config.completedProblems,
    totalProblems: config.totalProblems,
    sessionHealth: config.health,
    timing: config.timing,
    onPause: () => console.log('Pause clicked'),
    onResume: () => console.log('Resume clicked'),
    onEndEarly: () => console.log('End early clicked'),
  }
}

// =============================================================================
// Wrapper Component
// =============================================================================

function NavWrapper({
  children,
  darkMode = false,
}: {
  children: React.ReactNode
  darkMode?: boolean
}) {
  return (
    <ThemeProvider forcedTheme={darkMode ? 'dark' : 'light'}>
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
            className={css({ color: darkMode ? 'gray.400' : 'gray.500', fontSize: '0.875rem' })}
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

export const DashboardWithStartButton: Story = {
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudent}
        pageContext="dashboard"
        onStartPractice={() => alert('Start Practice clicked!')}
      />
    </NavWrapper>
  ),
}

export const DashboardLongName: Story = {
  render: () => (
    <NavWrapper>
      <PracticeSubNav
        student={mockStudentLongName}
        pageContext="dashboard"
        onStartPractice={() => alert('Start Practice clicked!')}
      />
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
      <PracticeSubNav
        student={mockStudent}
        pageContext="dashboard"
        onStartPractice={() => alert('Start Practice clicked!')}
      />
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
      <PracticeSubNav
        student={mockStudent}
        pageContext="dashboard"
        onStartPractice={() => alert('Start Practice clicked!')}
      />
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
