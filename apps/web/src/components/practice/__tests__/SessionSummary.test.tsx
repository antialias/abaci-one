import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { SessionPlan, SessionPart, SlotResult } from '@/db/schema/session-plans'
import { SessionSummary } from '../SessionSummary'

// Mock ThemeContext
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    resolvedTheme: 'light',
    setTheme: vi.fn(),
  }),
}))

// Mock Panda CSS
vi.mock('../../../../styled-system/css', () => ({
  css: vi.fn(() => 'mocked-css-class'),
}))

// Mock sub-components to keep tests focused on SessionSummary logic
vi.mock('../PerfectSessionCelebration', () => ({
  PerfectSessionCelebration: ({ studentName }: { studentName: string }) =>
    React.createElement('div', { 'data-testid': 'perfect-celebration' }, `Perfect! ${studentName}`),
}))

vi.mock('../SkillsPanel', () => ({
  SkillsPanel: () => React.createElement('div', { 'data-testid': 'skills-panel' }, 'Skills'),
}))

vi.mock('../ProblemsToReviewPanel', () => ({
  ProblemsToReviewPanel: () =>
    React.createElement('div', { 'data-testid': 'problems-to-review' }, 'Problems to Review'),
}))

vi.mock('../TrendIndicator', () => ({
  TrendIndicator: ({ current, previous }: { current: number; previous: number }) =>
    React.createElement(
      'div',
      { 'data-testid': 'trend-indicator' },
      `Trend: ${Math.round((current - previous) * 100)}%`
    ),
}))

vi.mock('../autoPauseCalculator', () => ({
  calculateAutoPauseInfo: () => ({
    threshold: 30000,
    mean: 5000,
    stdDev: 2000,
  }),
}))

vi.mock('../sessionSummaryUtils', () => ({
  getProblemsWithContext: () => [],
  filterProblemsNeedingAttention: () => [],
  getPartTypeLabel: (type: string) => type,
  isVerticalPart: (type: string) => type !== 'linear',
}))

vi.mock('@/lib/curriculum/bkt', () => ({
  computeBktFromHistory: () => ({ skills: [] }),
}))

// Helper factories

function createResult(overrides: Partial<SlotResult> = {}): SlotResult {
  return {
    partNumber: 1,
    slotIndex: 0,
    problem: { terms: [3, 4], answer: 7, skillsRequired: ['basic.directAddition'] },
    studentAnswer: 7,
    isCorrect: true,
    responseTimeMs: 3000,
    skillsExercised: ['basic.directAddition'],
    usedOnScreenAbacus: false,
    timestamp: new Date(),
    hadHelp: false,
    incorrectAttempts: 0,
    ...overrides,
  }
}

function createPart(overrides: Partial<SessionPart> = {}): SessionPart {
  return {
    partNumber: 1,
    type: 'abacus',
    format: 'vertical',
    useAbacus: true,
    slots: [{ slotId: 'test', index: 0, purpose: 'focus', constraints: {} }],
    estimatedMinutes: 5,
    ...overrides,
  }
}

function createPlan(overrides: Record<string, unknown> = {}): SessionPlan {
  const base: Record<string, unknown> = {
    id: 'plan-123',
    playerId: 'player-1',
    targetDurationMinutes: 10,
    estimatedProblemCount: 4,
    avgTimePerProblemSeconds: 15,
    parts: [createPart({ partNumber: 1, type: 'abacus' })],
    summary: {
      focusDescription: 'Direct +1',
      totalProblemCount: 4,
      estimatedMinutes: 10,
      parts: [],
    },
    status: 'completed',
    currentPartIndex: 0,
    currentSlotIndex: 0,
    adjustments: [],
    results: [
      createResult({ isCorrect: true, responseTimeMs: 2000 }),
      createResult({ slotIndex: 1, isCorrect: true, responseTimeMs: 3000 }),
      createResult({ slotIndex: 2, isCorrect: false, studentAnswer: 9, responseTimeMs: 4000 }),
      createResult({ slotIndex: 3, isCorrect: true, responseTimeMs: 5000 }),
    ],
    masteredSkillIds: [],
    isPaused: false,
    createdAt: new Date('2025-01-15T10:00:00Z'),
    startedAt: 1705312860000, // ms to match component's as-unknown-as-number pattern
    completedAt: 1705313100000, // 4 minutes later
    gameBreakSettings: null,
    sessionHealth: null,
    retryState: null,
    remoteCameraSessionId: null,
    pausedAt: null,
    pausedBy: null,
    pauseReason: null,
    approvedAt: null,
  }
  return { ...base, ...overrides } as unknown as SessionPlan
}

describe('SessionSummary', () => {
  it('displays accuracy percentage', () => {
    const { container } = render(
      <SessionSummary
        plan={createPlan()}
        studentId="student-1"
        studentName="Alice"
        justCompleted={true}
      />
    )

    // 3 out of 4 correct = 75%
    const accuracyStat = container.querySelector('[data-element="stat-accuracy"]')!
    expect(accuracyStat.textContent).toContain('75')
    expect(accuracyStat.textContent).toContain('%')
    expect(accuracyStat.textContent).toContain('Accuracy')
  })

  it('displays correct/total problems count', () => {
    const { container } = render(
      <SessionSummary plan={createPlan()} studentId="student-1" studentName="Alice" />
    )

    const problemsStat = container.querySelector('[data-element="stat-problems"]')!
    expect(problemsStat.textContent).toContain('3')
    expect(problemsStat.textContent).toContain('4')
    expect(problemsStat.textContent).toContain('Correct')
  })

  it('displays session duration in minutes', () => {
    const { container } = render(
      <SessionSummary plan={createPlan()} studentId="student-1" studentName="Alice" />
    )

    const timeStat = container.querySelector('[data-element="stat-time"]')!
    expect(timeStat.textContent).toContain('4')
    expect(timeStat.textContent).toContain('Minutes')
  })

  it('displays "< 1" for sessions under 1 minute', () => {
    const plan = createPlan({
      // 30 seconds duration
      startedAt: 1705312860000 as unknown as Date,
      completedAt: 1705312890000 as unknown as Date,
    })

    const { container } = render(
      <SessionSummary plan={plan} studentId="student-1" studentName="Alice" />
    )

    const timeStat = container.querySelector('[data-element="stat-time"]')!
    expect(timeStat.textContent).toContain('< 1')
    expect(timeStat.textContent).toContain('Minute')
  })

  it('shows celebration header with student name when justCompleted', () => {
    render(
      <SessionSummary
        plan={createPlan()}
        studentId="student-1"
        studentName="Alice"
        justCompleted={true}
      />
    )

    expect(screen.getByText('Great Work, Alice!')).toBeInTheDocument()
  })

  it('shows performance message based on accuracy', () => {
    // 75% accuracy -> "Good effort! You're getting stronger!"
    render(
      <SessionSummary
        plan={createPlan()}
        studentId="student-1"
        studentName="Alice"
        justCompleted={true}
      />
    )

    expect(screen.getByText("Good effort! You're getting stronger!")).toBeInTheDocument()
  })

  it('shows PerfectSessionCelebration when all problems eventually correct', () => {
    const plan = createPlan({
      results: [
        createResult({ slotIndex: 0, isCorrect: true }),
        createResult({ slotIndex: 1, isCorrect: true }),
        createResult({ slotIndex: 2, isCorrect: true }),
        createResult({ slotIndex: 3, isCorrect: true }),
      ],
    })

    render(
      <SessionSummary plan={plan} studentId="student-1" studentName="Alice" justCompleted={true} />
    )

    expect(screen.getByTestId('perfect-celebration')).toBeInTheDocument()
  })

  it('shows session date when not justCompleted', () => {
    const { container } = render(
      <SessionSummary
        plan={createPlan()}
        studentId="student-1"
        studentName="Alice"
        justCompleted={false}
      />
    )

    // Should not show celebration header
    expect(screen.queryByText('Great Work, Alice!')).not.toBeInTheDocument()
    // Should show the date header instead
    const dateHeader = container.querySelector('[data-section="session-date-header"]')
    expect(dateHeader).toBeInTheDocument()
  })

  it('shows average time per problem in detailed stats', () => {
    const { container } = render(
      <SessionSummary plan={createPlan()} studentId="student-1" studentName="Alice" />
    )

    expect(screen.getByText('Average time per problem')).toBeInTheDocument()
    // Total response time: 2000 + 3000 + 4000 + 5000 = 14000ms
    // Average: 14000 / 4 = 3500ms, Math.round(3500/1000) = 4
    const detailedStats = container.querySelector('[data-section="detailed-stats"]')!
    expect(detailedStats.textContent).toContain('4s')
  })

  it('shows on-screen abacus usage stats', () => {
    const plan = createPlan({
      results: [
        createResult({ usedOnScreenAbacus: true }),
        createResult({ slotIndex: 1, usedOnScreenAbacus: true }),
        createResult({ slotIndex: 2, usedOnScreenAbacus: false }),
        createResult({ slotIndex: 3, usedOnScreenAbacus: false }),
      ],
    })

    const { container } = render(
      <SessionSummary plan={plan} studentId="student-1" studentName="Alice" />
    )

    expect(screen.getByText('On-screen abacus used')).toBeInTheDocument()
    const detailedStats = container.querySelector('[data-section="detailed-stats"]')!
    expect(detailedStats.textContent).toContain('2 times (50%)')
  })

  it('renders TrendIndicator when previousAccuracy is provided', () => {
    render(
      <SessionSummary
        plan={createPlan()}
        studentId="student-1"
        studentName="Alice"
        previousAccuracy={0.6}
      />
    )

    expect(screen.getByTestId('trend-indicator')).toBeInTheDocument()
  })

  it('does not render TrendIndicator when previousAccuracy is null', () => {
    render(
      <SessionSummary
        plan={createPlan()}
        studentId="student-1"
        studentName="Alice"
        previousAccuracy={null}
      />
    )

    expect(screen.queryByTestId('trend-indicator')).not.toBeInTheDocument()
  })

  it('renders SkillsPanel', () => {
    render(<SessionSummary plan={createPlan()} studentId="student-1" studentName="Alice" />)

    expect(screen.getByTestId('skills-panel')).toBeInTheDocument()
  })

  it('renders ProblemsToReviewPanel', () => {
    render(<SessionSummary plan={createPlan()} studentId="student-1" studentName="Alice" />)

    expect(screen.getByTestId('problems-to-review')).toBeInTheDocument()
  })

  it('shows practice type badges for session parts', () => {
    const plan = createPlan({
      parts: [
        createPart({ partNumber: 1, type: 'abacus' }),
        createPart({ partNumber: 2, type: 'visualization' }),
      ],
    })

    render(<SessionSummary plan={plan} studentId="student-1" studentName="Alice" />)

    // PRACTICE_TYPES labels
    expect(screen.getByText('Use Abacus')).toBeInTheDocument()
    expect(screen.getByText('Visualize')).toBeInTheDocument()
  })

  it('handles 100% accuracy with PerfectSessionCelebration', () => {
    const plan = createPlan({
      results: [createResult({ isCorrect: true }), createResult({ slotIndex: 1, isCorrect: true })],
    })

    render(
      <SessionSummary plan={plan} studentId="student-1" studentName="Alice" justCompleted={true} />
    )

    // 100% accuracy - should show PerfectSessionCelebration
    expect(screen.getByTestId('perfect-celebration')).toBeInTheDocument()
  })

  it('handles 0% accuracy', () => {
    const plan = createPlan({
      results: [
        createResult({ isCorrect: false, studentAnswer: 9 }),
        createResult({ slotIndex: 1, isCorrect: false, studentAnswer: 8 }),
      ],
    })

    const { container } = render(
      <SessionSummary plan={plan} studentId="student-1" studentName="Alice" justCompleted={true} />
    )

    const accuracyStat = container.querySelector('[data-element="stat-accuracy"]')!
    expect(accuracyStat.textContent).toContain('0')
    expect(accuracyStat.textContent).toContain('%')
    expect(
      screen.getByText("Keep practicing! You'll get better with each session!")
    ).toBeInTheDocument()
  })

  it('handles empty results gracefully', () => {
    const plan = createPlan({ results: [] })

    const { container } = render(
      <SessionSummary plan={plan} studentId="student-1" studentName="Alice" />
    )

    const accuracyStat = container.querySelector('[data-element="stat-accuracy"]')!
    expect(accuracyStat.textContent).toContain('0')
    const problemsStat = container.querySelector('[data-element="stat-problems"]')!
    expect(problemsStat.textContent).toContain('0/0')
  })
})
