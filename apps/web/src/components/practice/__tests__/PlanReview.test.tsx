import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SessionPlan, SessionPart, SessionSummary, ProblemSlot } from '@/db/schema/session-plans'
import { PlanReview } from '../PlanReview'

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

// Mock AllProblemsSection (use React.createElement to avoid JSX in vi.mock factory)
vi.mock('../AllProblemsSection', () => ({
  AllProblemsSection: ({ isDark }: { plan: unknown; isDark: boolean }) =>
    React.createElement('div', { 'data-testid': 'all-problems-section', 'data-dark': isDark }, 'All Problems'),
}))

// Helper to create minimal test data
function createTestSlot(overrides: Partial<ProblemSlot> = {}): ProblemSlot {
  return {
    index: 0,
    purpose: 'focus',
    constraints: {},
    ...overrides,
  }
}

function createTestPart(overrides: Partial<SessionPart> = {}): SessionPart {
  return {
    partNumber: 1,
    type: 'abacus',
    format: 'vertical',
    useAbacus: true,
    slots: [createTestSlot({ purpose: 'focus' }), createTestSlot({ index: 1, purpose: 'reinforce' })],
    estimatedMinutes: 5,
    ...overrides,
  }
}

function createTestSummary(): SessionSummary {
  return {
    focusDescription: 'Direct +1',
    totalProblemCount: 6,
    estimatedMinutes: 10,
    parts: [
      {
        partNumber: 1,
        type: 'abacus',
        description: 'Use Abacus',
        problemCount: 2,
        estimatedMinutes: 3,
      },
      {
        partNumber: 2,
        type: 'visualization',
        description: 'Mental Math (Visualization)',
        problemCount: 2,
        estimatedMinutes: 3,
      },
      {
        partNumber: 3,
        type: 'linear',
        description: 'Mental Math (Linear)',
        problemCount: 2,
        estimatedMinutes: 4,
      },
    ],
  }
}

function createTestPlan(overrides: Partial<SessionPlan> = {}): SessionPlan {
  const parts: SessionPart[] = [
    createTestPart({
      partNumber: 1,
      type: 'abacus',
      slots: [
        createTestSlot({ purpose: 'focus' }),
        createTestSlot({ index: 1, purpose: 'reinforce' }),
      ],
    }),
    createTestPart({
      partNumber: 2,
      type: 'visualization',
      slots: [
        createTestSlot({ purpose: 'review' }),
        createTestSlot({ index: 1, purpose: 'challenge' }),
      ],
    }),
    createTestPart({
      partNumber: 3,
      type: 'linear',
      slots: [
        createTestSlot({ purpose: 'focus' }),
        createTestSlot({ index: 1, purpose: 'review' }),
      ],
    }),
  ]

  return {
    id: 'plan-123',
    playerId: 'player-1',
    targetDurationMinutes: 10,
    estimatedProblemCount: 6,
    avgTimePerProblemSeconds: 15,
    parts,
    summary: createTestSummary() as unknown as SessionPlan['summary'],
    status: 'approved',
    currentPartIndex: 0,
    currentSlotIndex: 0,
    adjustments: [],
    results: [],
    masteredSkillIds: [],
    isPaused: false,
    createdAt: new Date('2025-01-15T10:00:00Z'),
    gameBreakSettings: null,
    sessionHealth: null,
    retryState: null,
    remoteCameraSessionId: null,
    pausedAt: null,
    pausedBy: null,
    pauseReason: null,
    approvedAt: null,
    startedAt: null,
    completedAt: null,
    ...overrides,
  } as SessionPlan
}

describe('PlanReview', () => {
  let onApprove: ReturnType<typeof vi.fn>
  let onCancel: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    onApprove = vi.fn()
    onCancel = vi.fn()
  })

  it('renders student name in the header', () => {
    render(
      <PlanReview
        plan={createTestPlan()}
        studentName="Alice"
        onApprove={onApprove}
        onCancel={onCancel}
      />
    )

    expect(screen.getByText("Today's Practice for Alice")).toBeInTheDocument()
  })

  it('displays estimated minutes from summary', () => {
    render(
      <PlanReview
        plan={createTestPlan()}
        studentName="Bob"
        onApprove={onApprove}
        onCancel={onCancel}
      />
    )

    expect(screen.getByText('~10 min')).toBeInTheDocument()
  })

  it('displays focus description from summary', () => {
    render(
      <PlanReview
        plan={createTestPlan()}
        studentName="Bob"
        onApprove={onApprove}
        onCancel={onCancel}
      />
    )

    expect(screen.getByText('Direct +1')).toBeInTheDocument()
  })

  it('renders part summaries with descriptions', () => {
    render(
      <PlanReview
        plan={createTestPlan()}
        studentName="Test"
        onApprove={onApprove}
        onCancel={onCancel}
      />
    )

    // Each part summary should show part number and description
    expect(screen.getByText(/Part 1: Use Abacus/)).toBeInTheDocument()
    expect(screen.getByText(/Part 2: Mental Math \(Visualization\)/)).toBeInTheDocument()
    expect(screen.getByText(/Part 3: Mental Math \(Linear\)/)).toBeInTheDocument()
  })

  it('counts and displays slot purposes correctly', () => {
    render(
      <PlanReview
        plan={createTestPlan()}
        studentName="Test"
        onApprove={onApprove}
        onCancel={onCancel}
      />
    )

    // Our test plan has: 2 focus, 1 reinforce, 2 review, 1 challenge
    expect(screen.getByText('Focus')).toBeInTheDocument()
    expect(screen.getByText('Reinforce')).toBeInTheDocument()
    expect(screen.getByText('Review')).toBeInTheDocument()
    expect(screen.getByText('Challenge')).toBeInTheDocument()
  })

  it('calls onApprove when "Let\'s Go!" button is clicked', () => {
    render(
      <PlanReview
        plan={createTestPlan()}
        studentName="Test"
        onApprove={onApprove}
        onCancel={onCancel}
      />
    )

    fireEvent.click(screen.getByText("Let's Go!"))
    expect(onApprove).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Cancel button is clicked', () => {
    render(
      <PlanReview
        plan={createTestPlan()}
        studentName="Test"
        onApprove={onApprove}
        onCancel={onCancel}
      />
    )

    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('toggles config inspector panel when button is clicked', () => {
    render(
      <PlanReview
        plan={createTestPlan()}
        studentName="Test"
        onApprove={onApprove}
        onCancel={onCancel}
      />
    )

    // Config inspector should not be visible initially
    expect(screen.queryByText('Session Configuration')).not.toBeInTheDocument()

    // Click the toggle button
    fireEvent.click(screen.getByText('Configuration Details'))

    // Config inspector should now be visible
    expect(screen.getByText('Session Configuration')).toBeInTheDocument()
    expect(screen.getByText(/Plan ID:/)).toBeInTheDocument()

    // Click again to hide
    fireEvent.click(screen.getByText('Configuration Details'))
    expect(screen.queryByText('Session Configuration')).not.toBeInTheDocument()
  })

  it('toggles full problems panel when button is clicked', () => {
    render(
      <PlanReview
        plan={createTestPlan()}
        studentName="Test"
        onApprove={onApprove}
        onCancel={onCancel}
      />
    )

    // Full problems should not be visible initially
    expect(screen.queryByTestId('all-problems-section')).not.toBeInTheDocument()

    // Click the toggle button
    fireEvent.click(screen.getByText('Full Problem Details (Skills + Costs)'))

    // Full problems should now be visible
    expect(screen.getByTestId('all-problems-section')).toBeInTheDocument()

    // Click again to hide
    fireEvent.click(screen.getByText('Full Problem Details (Skills + Costs)'))
    expect(screen.queryByTestId('all-problems-section')).not.toBeInTheDocument()
  })

  it('shows plan configuration details in inspector', () => {
    const plan = createTestPlan({
      id: 'plan-abc',
      targetDurationMinutes: 15,
      estimatedProblemCount: 20,
      avgTimePerProblemSeconds: 12,
      status: 'approved',
    })

    render(
      <PlanReview
        plan={plan}
        studentName="Test"
        onApprove={onApprove}
        onCancel={onCancel}
      />
    )

    // Open config inspector
    fireEvent.click(screen.getByText('Configuration Details'))

    expect(screen.getByText(/plan-abc/)).toBeInTheDocument()
    expect(screen.getByText(/15 minutes/)).toBeInTheDocument()
    expect(screen.getByText(/12s/)).toBeInTheDocument()
    expect(screen.getByText(/approved/)).toBeInTheDocument()
    // Verify the config inspector section contains the estimated problems
    const configSection = document.querySelector('[data-section="config-inspector"]')!
    expect(configSection.textContent).toContain('20')
  })

  it('shows toggle arrow indicators for collapsible sections', () => {
    render(
      <PlanReview
        plan={createTestPlan()}
        studentName="Test"
        onApprove={onApprove}
        onCancel={onCancel}
      />
    )

    // Both toggles should show right arrow when collapsed
    const configButton = screen.getByRole('button', { name: /Configuration Details/ })
    expect(configButton).toHaveTextContent('▶')

    // Click to expand
    fireEvent.click(configButton)
    expect(configButton).toHaveTextContent('▼')
  })
})
