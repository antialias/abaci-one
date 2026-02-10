import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionProgressIndicator } from '../SessionProgressIndicator'
import type {
  ProblemSlot,
  SessionPart,
  SlotResult,
  GeneratedProblem,
} from '@/db/schema/session-plans'

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

// Mock Tooltip - render trigger and content
vi.mock('../../ui/Tooltip', () => ({
  Tooltip: ({ children, content }: { children: React.ReactNode; content: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'tooltip-wrapper' }, [
      React.createElement('div', { key: 'c' }, children),
      React.createElement('div', { key: 'tip', 'data-testid': 'tooltip-content' }, content),
    ]),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock autoPauseCalculator
vi.mock('../autoPauseCalculator', () => ({
  formatMs: (ms: number) => `${(ms / 1000).toFixed(1)}s`,
}))

// Mock purposeExplanations
vi.mock('../purposeExplanations', () => ({
  getPurposeConfig: (purpose: string) => ({
    label: `${purpose} label`,
    shortLabel: purpose,
    emoji: purpose === 'focus' ? '\uD83C\uDFAF' : '\uD83D\uDCAA',
    color: 'blue',
    explanation: `${purpose} explanation`,
    shortExplanation: `${purpose} short`,
  }),
  getPurposeColors: () => ({
    background: 'blue.100',
    text: 'blue.700',
    border: 'blue.300',
  }),
}))

// Mock PurposeBadge extractTargetSkillName
vi.mock('../PurposeBadge', () => ({
  extractTargetSkillName: () => null,
}))

// ============================================================================
// Test data factories
// ============================================================================

function createProblem(terms: number[] = [3, 4]): GeneratedProblem {
  return {
    terms,
    answer: terms.reduce((a, b) => a + b, 0),
    skillsRequired: ['basic.+3'],
  }
}

function createSlot(overrides: Partial<ProblemSlot> = {}): ProblemSlot {
  return {
    index: 0,
    purpose: 'focus',
    constraints: {},
    ...overrides,
  }
}

function createPart(overrides: Partial<SessionPart> = {}): SessionPart {
  return {
    partNumber: 1,
    type: 'abacus',
    format: 'vertical',
    useAbacus: true,
    slots: [createSlot({ index: 0 }), createSlot({ index: 1 }), createSlot({ index: 2 })],
    estimatedMinutes: 5,
    ...overrides,
  }
}

function createResult(overrides: Partial<SlotResult> = {}): SlotResult {
  return {
    partNumber: 1,
    slotIndex: 0,
    problem: createProblem(),
    studentAnswer: 7,
    isCorrect: true,
    responseTimeMs: 3000,
    skillsExercised: ['basic.+3'],
    usedOnScreenAbacus: false,
    timestamp: new Date(),
    hadHelp: false,
    incorrectAttempts: 0,
    ...overrides,
  }
}

// ============================================================================
// Rendering
// ============================================================================

describe('SessionProgressIndicator', () => {
  const defaultProps = {
    parts: [createPart()],
    results: [] as SlotResult[],
    currentPartIndex: 0,
    currentSlotIndex: 0,
    isBrowseMode: false,
    isDark: false,
  }

  it('renders the component with data-component attribute', () => {
    render(<SessionProgressIndicator {...defaultProps} />)
    const indicator = document.querySelector('[data-component="session-progress-indicator"]')
    expect(indicator).toBeInTheDocument()
  })

  it('sets data-browse-mode attribute', () => {
    render(<SessionProgressIndicator {...defaultProps} isBrowseMode={true} />)
    const indicator = document.querySelector('[data-component="session-progress-indicator"]')
    expect(indicator).toHaveAttribute('data-browse-mode', 'true')
  })

  it('renders current slot as pending with circle marker', () => {
    render(<SessionProgressIndicator {...defaultProps} />)
    // Current slot should show '○' when not completed
    // But current slot gets status 'current'
    const currentButton = document.querySelector('[data-status="current"]')
    expect(currentButton).toBeInTheDocument()
  })

  it('renders pending slots', () => {
    render(<SessionProgressIndicator {...defaultProps} />)
    const pendingSlots = document.querySelectorAll('[data-status="pending"]')
    // 3 slots total: 1 current + 2 pending
    expect(pendingSlots).toHaveLength(2)
  })

  it('renders correct results with check mark', () => {
    const results = [createResult({ partNumber: 1, slotIndex: 0, isCorrect: true })]
    render(<SessionProgressIndicator {...defaultProps} results={results} currentSlotIndex={1} />)
    const correctSlots = document.querySelectorAll('[data-status="correct"]')
    expect(correctSlots).toHaveLength(1)
  })

  it('renders incorrect results with X mark', () => {
    const results = [createResult({ partNumber: 1, slotIndex: 0, isCorrect: false })]
    render(<SessionProgressIndicator {...defaultProps} results={results} currentSlotIndex={1} />)
    const incorrectSlots = document.querySelectorAll('[data-status="incorrect"]')
    expect(incorrectSlots).toHaveLength(1)
  })
})

// ============================================================================
// Multiple parts
// ============================================================================

describe('SessionProgressIndicator - multiple parts', () => {
  const threeParts = [
    createPart({
      partNumber: 1,
      type: 'abacus',
      slots: [createSlot({ index: 0 }), createSlot({ index: 1 })],
    }),
    createPart({
      partNumber: 2,
      type: 'visualization',
      slots: [createSlot({ index: 0 }), createSlot({ index: 1 })],
    }),
    createPart({
      partNumber: 3,
      type: 'linear',
      slots: [createSlot({ index: 0 }), createSlot({ index: 1 })],
    }),
  ]

  it('renders sections element', () => {
    render(
      <SessionProgressIndicator
        parts={threeParts}
        results={[]}
        currentPartIndex={1}
        currentSlotIndex={0}
        isBrowseMode={false}
        isDark={false}
      />
    )
    const sections = document.querySelector('[data-element="sections"]')
    expect(sections).toBeInTheDocument()
  })

  it('collapses completed parts in practice mode', () => {
    render(
      <SessionProgressIndicator
        parts={threeParts}
        results={[]}
        currentPartIndex={1}
        currentSlotIndex={0}
        isBrowseMode={false}
        isDark={false}
      />
    )
    // Part 0 is completed (before current), should be collapsed
    const collapsed = document.querySelectorAll('[data-element="collapsed-section"]')
    expect(collapsed.length).toBeGreaterThanOrEqual(1)
  })

  it('collapses future parts in practice mode', () => {
    render(
      <SessionProgressIndicator
        parts={threeParts}
        results={[]}
        currentPartIndex={0}
        currentSlotIndex={0}
        isBrowseMode={false}
        isDark={false}
      />
    )
    // Parts 1,2 are future (after current), should be collapsed
    const collapsed = document.querySelectorAll('[data-element="collapsed-section"]')
    expect(collapsed.length).toBe(2)
  })

  it('expands current part in practice mode', () => {
    render(
      <SessionProgressIndicator
        parts={threeParts}
        results={[]}
        currentPartIndex={1}
        currentSlotIndex={0}
        isBrowseMode={false}
        isDark={false}
      />
    )
    // Current part should be expanded
    const expanded = document.querySelectorAll('[data-element="expanded-section"]')
    expect(expanded.length).toBeGreaterThanOrEqual(1)
  })

  it('expands all parts in browse mode', () => {
    render(
      <SessionProgressIndicator
        parts={threeParts}
        results={[]}
        currentPartIndex={1}
        currentSlotIndex={0}
        isBrowseMode={true}
        isDark={false}
      />
    )
    // All parts should be expanded (collapsed sections become expanded in browse mode)
    const expanded = document.querySelectorAll('[data-element="expanded-section"]')
    expect(expanded).toHaveLength(3)
  })
})

// ============================================================================
// Browse mode
// ============================================================================

describe('SessionProgressIndicator - browse mode', () => {
  const parts = [
    createPart({
      partNumber: 1,
      slots: [createSlot({ index: 0 }), createSlot({ index: 1 }), createSlot({ index: 2 })],
    }),
  ]

  it('shows linear index numbers in browse mode', () => {
    render(
      <SessionProgressIndicator
        parts={parts}
        results={[]}
        currentPartIndex={0}
        currentSlotIndex={0}
        isBrowseMode={true}
        isDark={false}
      />
    )
    // Browse mode shows numbers: 1, 2, 3
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('calls onNavigate when clicking slot in browse mode', () => {
    const onNavigate = vi.fn()
    render(
      <SessionProgressIndicator
        parts={parts}
        results={[]}
        currentPartIndex={0}
        currentSlotIndex={0}
        isBrowseMode={true}
        isDark={false}
        onNavigate={onNavigate}
      />
    )
    // Click the second slot (linear index 1)
    const slot = document.querySelector('[data-linear-index="1"]') as HTMLElement
    fireEvent.click(slot)
    expect(onNavigate).toHaveBeenCalledWith(1)
  })

  it('makes slots clickable in browse mode', () => {
    const onNavigate = vi.fn()
    render(
      <SessionProgressIndicator
        parts={parts}
        results={[]}
        currentPartIndex={0}
        currentSlotIndex={0}
        isBrowseMode={true}
        isDark={false}
        onNavigate={onNavigate}
      />
    )
    const slot = document.querySelector('[data-linear-index="0"]') as HTMLButtonElement
    expect(slot).not.toBeDisabled()
  })
})

// ============================================================================
// Redo mode
// ============================================================================

describe('SessionProgressIndicator - redo mode', () => {
  const parts = [
    createPart({
      partNumber: 1,
      slots: [createSlot({ index: 0 }), createSlot({ index: 1 })],
    }),
  ]

  it('marks redo slot with data-redo and status redo', () => {
    const results = [createResult({ partNumber: 1, slotIndex: 0, isCorrect: false })]
    render(
      <SessionProgressIndicator
        parts={parts}
        results={results}
        currentPartIndex={0}
        currentSlotIndex={1}
        isBrowseMode={false}
        isDark={false}
        redoLinearIndex={0}
      />
    )
    const redoSlot = document.querySelector('[data-redo="true"]')
    expect(redoSlot).toBeInTheDocument()
    expect(redoSlot).toHaveAttribute('data-status', 'redo')
  })

  it('calls onRedoProblem when clicking a completed problem', () => {
    const onRedoProblem = vi.fn()
    const results = [createResult({ partNumber: 1, slotIndex: 0, isCorrect: false })]
    render(
      <SessionProgressIndicator
        parts={parts}
        results={results}
        currentPartIndex={0}
        currentSlotIndex={1}
        isBrowseMode={false}
        isDark={false}
        onRedoProblem={onRedoProblem}
      />
    )
    // Completed slot at index 0 should be clickable for redo
    const completedSlot = document.querySelector('[data-status="incorrect"]') as HTMLElement
    expect(completedSlot).toBeInTheDocument()
    fireEvent.click(completedSlot)
    expect(onRedoProblem).toHaveBeenCalledWith(0, results[0])
  })

  it('calls onCancelRedo when clicking current slot during redo', () => {
    const onCancelRedo = vi.fn()
    const results = [createResult({ partNumber: 1, slotIndex: 0, isCorrect: false })]
    render(
      <SessionProgressIndicator
        parts={parts}
        results={results}
        currentPartIndex={0}
        currentSlotIndex={1}
        isBrowseMode={false}
        isDark={false}
        redoLinearIndex={0}
        onCancelRedo={onCancelRedo}
      />
    )
    // Current slot is index 1
    const currentSlot = document.querySelector('[data-status="current"]') as HTMLElement
    expect(currentSlot).toBeInTheDocument()
    fireEvent.click(currentSlot)
    expect(onCancelRedo).toHaveBeenCalledTimes(1)
  })
})

// ============================================================================
// Retry badge
// ============================================================================

describe('SessionProgressIndicator - retry badge', () => {
  const parts = [
    createPart({
      partNumber: 1,
      slots: [createSlot({ index: 0 }), createSlot({ index: 1 })],
    }),
  ]

  it('shows retry badge when multiple attempts exist', () => {
    const results = [
      createResult({ partNumber: 1, slotIndex: 0, isCorrect: false }),
      createResult({ partNumber: 1, slotIndex: 0, isCorrect: true }),
    ]
    render(
      <SessionProgressIndicator
        parts={parts}
        results={results}
        currentPartIndex={0}
        currentSlotIndex={1}
        isBrowseMode={false}
        isDark={false}
      />
    )
    const retryBadge = document.querySelector('[data-element="retry-badge"]')
    expect(retryBadge).toBeInTheDocument()
  })

  it('shows correct attempt count', () => {
    const results = [
      createResult({ partNumber: 1, slotIndex: 0, isCorrect: false }),
      createResult({ partNumber: 1, slotIndex: 0, isCorrect: true }),
    ]
    render(
      <SessionProgressIndicator
        parts={parts}
        results={results}
        currentPartIndex={0}
        currentSlotIndex={1}
        isBrowseMode={false}
        isDark={false}
      />
    )
    const slot = document.querySelector('[data-linear-index="0"]') as HTMLElement
    expect(slot).toHaveAttribute('data-attempt-count', '2')
  })

  it('does not show retry badge for single attempt', () => {
    const results = [createResult({ partNumber: 1, slotIndex: 0, isCorrect: true })]
    render(
      <SessionProgressIndicator
        parts={parts}
        results={results}
        currentPartIndex={0}
        currentSlotIndex={1}
        isBrowseMode={false}
        isDark={false}
      />
    )
    const retryBadge = document.querySelector('[data-element="retry-badge"]')
    expect(retryBadge).not.toBeInTheDocument()
  })
})

// ============================================================================
// Observer viewing
// ============================================================================

describe('SessionProgressIndicator - observer viewing', () => {
  const parts = [
    createPart({
      partNumber: 1,
      slots: [createSlot({ index: 0 }), createSlot({ index: 1 })],
    }),
  ]

  it('marks observer viewing slot', () => {
    render(
      <SessionProgressIndicator
        parts={parts}
        results={[]}
        currentPartIndex={0}
        currentSlotIndex={0}
        isBrowseMode={false}
        isDark={false}
        observerViewingIndex={1}
      />
    )
    const observerSlot = document.querySelector('[data-observer-viewing="true"]')
    expect(observerSlot).toBeInTheDocument()
  })
})

// ============================================================================
// Game break icons
// ============================================================================

describe('SessionProgressIndicator - game breaks', () => {
  const twoParts = [
    createPart({
      partNumber: 1,
      type: 'abacus',
      slots: [createSlot({ index: 0 }), createSlot({ index: 1 })],
    }),
    createPart({
      partNumber: 2,
      type: 'visualization',
      slots: [createSlot({ index: 0 }), createSlot({ index: 1 })],
    }),
  ]

  it('does not show game break icons when disabled', () => {
    render(
      <SessionProgressIndicator
        parts={twoParts}
        results={[]}
        currentPartIndex={0}
        currentSlotIndex={0}
        isBrowseMode={false}
        isDark={false}
        gameBreakEnabled={false}
      />
    )
    const gameBreak = document.querySelector('[data-element="game-break-icon"]')
    expect(gameBreak).not.toBeInTheDocument()
  })

  it('shows game break icon between parts when enabled', () => {
    render(
      <SessionProgressIndicator
        parts={twoParts}
        results={[]}
        currentPartIndex={0}
        currentSlotIndex={0}
        isBrowseMode={false}
        isDark={false}
        gameBreakEnabled={true}
      />
    )
    const gameBreak = document.querySelector('[data-element="game-break-icon"]')
    expect(gameBreak).toBeInTheDocument()
  })

  it('marks game break as current when in current part', () => {
    render(
      <SessionProgressIndicator
        parts={twoParts}
        results={[]}
        currentPartIndex={0}
        currentSlotIndex={1}
        isBrowseMode={false}
        isDark={false}
        gameBreakEnabled={true}
      />
    )
    const gameBreak = document.querySelector(
      '[data-element="game-break-icon"][data-state="current"]'
    )
    expect(gameBreak).toBeInTheDocument()
  })

  it('marks game break as passed when part is completed', () => {
    render(
      <SessionProgressIndicator
        parts={twoParts}
        results={[]}
        currentPartIndex={1}
        currentSlotIndex={0}
        isBrowseMode={false}
        isDark={false}
        gameBreakEnabled={true}
      />
    )
    const gameBreak = document.querySelector(
      '[data-element="game-break-icon"][data-state="passed"]'
    )
    expect(gameBreak).toBeInTheDocument()
  })
})

// ============================================================================
// Compact mode
// ============================================================================

describe('SessionProgressIndicator - compact', () => {
  it('renders with compact prop', () => {
    render(
      <SessionProgressIndicator
        parts={[createPart()]}
        results={[]}
        currentPartIndex={0}
        currentSlotIndex={0}
        isBrowseMode={false}
        isDark={false}
        compact={true}
      />
    )
    const indicator = document.querySelector('[data-component="session-progress-indicator"]')
    expect(indicator).toBeInTheDocument()
  })
})

// ============================================================================
// Collapsed section
// ============================================================================

describe('SessionProgressIndicator - collapsed section', () => {
  const twoParts = [
    createPart({
      partNumber: 1,
      type: 'abacus',
      slots: [createSlot({ index: 0 }), createSlot({ index: 1 })],
    }),
    createPart({
      partNumber: 2,
      type: 'visualization',
      slots: [createSlot({ index: 0 }), createSlot({ index: 1 })],
    }),
  ]

  it('shows collapsed section for completed part with status=completed', () => {
    const results = [
      createResult({ partNumber: 1, slotIndex: 0, isCorrect: true }),
      createResult({ partNumber: 1, slotIndex: 1, isCorrect: true }),
    ]
    render(
      <SessionProgressIndicator
        parts={twoParts}
        results={results}
        currentPartIndex={1}
        currentSlotIndex={0}
        isBrowseMode={false}
        isDark={false}
      />
    )
    const collapsed = document.querySelector(
      '[data-element="collapsed-section"][data-status="completed"]'
    )
    expect(collapsed).toBeInTheDocument()
  })

  it('shows collapsed section for future part with status=future', () => {
    render(
      <SessionProgressIndicator
        parts={twoParts}
        results={[]}
        currentPartIndex={0}
        currentSlotIndex={0}
        isBrowseMode={false}
        isDark={false}
      />
    )
    const collapsed = document.querySelector(
      '[data-element="collapsed-section"][data-status="future"]'
    )
    expect(collapsed).toBeInTheDocument()
  })
})

// ============================================================================
// Linear index calculation
// ============================================================================

describe('SessionProgressIndicator - linear index', () => {
  it('calculates correct linear indices across parts', () => {
    const parts = [
      createPart({
        partNumber: 1,
        slots: [createSlot({ index: 0 }), createSlot({ index: 1 })],
      }),
      createPart({
        partNumber: 2,
        slots: [createSlot({ index: 0 }), createSlot({ index: 1 })],
      }),
    ]
    render(
      <SessionProgressIndicator
        parts={parts}
        results={[]}
        currentPartIndex={1}
        currentSlotIndex={0}
        isBrowseMode={true}
        isDark={false}
      />
    )
    // Part 1 slots: linear 0, 1; Part 2 slots: linear 2, 3
    const slot2 = document.querySelector('[data-linear-index="2"]')
    const slot3 = document.querySelector('[data-linear-index="3"]')
    expect(slot2).toBeInTheDocument()
    expect(slot3).toBeInTheDocument()
  })
})
