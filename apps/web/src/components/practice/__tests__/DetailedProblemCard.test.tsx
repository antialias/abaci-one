import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type {
  GenerationTrace,
  ProblemSlot,
  SessionPart,
  SlotResult,
} from '@/db/schema/session-plans'
import type { AutoPauseStats } from '../autoPauseCalculator'
import { DetailedProblemCard } from '../DetailedProblemCard'

// Mock Panda CSS
vi.mock('../../../../styled-system/css', () => ({
  css: vi.fn(() => 'mocked-css-class'),
}))

// Mock autoPauseCalculator
vi.mock('../autoPauseCalculator', () => ({
  formatMs: (ms: number) => `${(ms / 1000).toFixed(1)}s`,
  getAutoPauseExplanation: (stats: AutoPauseStats) =>
    stats.usedStatistics ? 'Statistical threshold' : 'Default threshold',
}))

// Helper factories

function createSlot(overrides: Partial<ProblemSlot> = {}): ProblemSlot {
  return {
    index: 0,
    purpose: 'focus',
    constraints: {
      termCount: { min: 2, max: 4 },
      digitRange: { min: 1, max: 2 },
    },
    problem: {
      terms: [3, 4],
      answer: 7,
      skillsRequired: ['basic.directAddition'],
    },
    ...overrides,
  }
}

function createPart(overrides: Partial<SessionPart> = {}): SessionPart {
  return {
    partNumber: 1,
    type: 'abacus',
    format: 'vertical',
    useAbacus: true,
    slots: [],
    estimatedMinutes: 5,
    ...overrides,
  }
}

function createResult(overrides: Partial<SlotResult> = {}): SlotResult {
  return {
    partNumber: 1,
    slotIndex: 0,
    problem: { terms: [3, 4], answer: 7, skillsRequired: ['basic.directAddition'] },
    studentAnswer: 7,
    isCorrect: true,
    responseTimeMs: 3500,
    skillsExercised: ['basic.directAddition'],
    usedOnScreenAbacus: false,
    timestamp: new Date(),
    hadHelp: false,
    incorrectAttempts: 0,
    ...overrides,
  }
}

function createTrace(overrides: Partial<GenerationTrace> = {}): GenerationTrace {
  return {
    terms: [3, 4],
    answer: 7,
    steps: [
      {
        stepNumber: 0,
        operation: '0 + 3 = 3',
        accumulatedBefore: 0,
        termAdded: 3,
        accumulatedAfter: 3,
        skillsUsed: [],
        explanation: 'Start with 3',
        complexityCost: 0,
      },
      {
        stepNumber: 1,
        operation: '3 + 4 = 7',
        accumulatedBefore: 3,
        termAdded: 4,
        accumulatedAfter: 7,
        skillsUsed: ['basic.directAddition'],
        explanation: 'Add 4',
        complexityCost: 1,
      },
    ],
    allSkills: ['basic.directAddition'],
    totalComplexityCost: 1,
    ...overrides,
  }
}

describe('DetailedProblemCard', () => {
  it('renders the problem number and purpose badge', () => {
    render(
      <DetailedProblemCard
        slot={createSlot({ purpose: 'focus' })}
        part={createPart({ type: 'abacus' })}
        isDark={false}
        problemNumber={3}
      />
    )

    expect(screen.getByText('#3')).toBeInTheDocument()
    // Purpose badge includes emoji and label
    expect(screen.getByText(/Focus/)).toBeInTheDocument()
  })

  it('renders purpose labels for each purpose type', () => {
    const purposes = [
      { purpose: 'focus' as const, label: 'Focus' },
      { purpose: 'reinforce' as const, label: 'Reinforce' },
      { purpose: 'review' as const, label: 'Review' },
      { purpose: 'challenge' as const, label: 'Challenge' },
    ]

    for (const { purpose, label } of purposes) {
      const { unmount } = render(
        <DetailedProblemCard
          slot={createSlot({ purpose })}
          part={createPart()}
          isDark={false}
          problemNumber={1}
        />
      )
      expect(screen.getByText(new RegExp(label))).toBeInTheDocument()
      unmount()
    }
  })

  it('renders vertical problem display for abacus part type', () => {
    render(
      <DetailedProblemCard
        slot={createSlot({
          problem: { terms: [5, 3], answer: 8, skillsRequired: [] },
        })}
        part={createPart({ type: 'abacus' })}
        isDark={false}
        problemNumber={1}
      />
    )

    const verticalProblem = document.querySelector('[data-element="detailed-vertical-problem"]')
    expect(verticalProblem).toBeInTheDocument()
  })

  it('renders vertical problem display for visualization part type', () => {
    render(
      <DetailedProblemCard
        slot={createSlot({
          problem: { terms: [5, 3], answer: 8, skillsRequired: [] },
        })}
        part={createPart({ type: 'visualization' })}
        isDark={false}
        problemNumber={1}
      />
    )

    const verticalProblem = document.querySelector('[data-element="detailed-vertical-problem"]')
    expect(verticalProblem).toBeInTheDocument()
  })

  it('renders linear problem display for linear part type', () => {
    render(
      <DetailedProblemCard
        slot={createSlot({
          problem: { terms: [5, 3], answer: 8, skillsRequired: [] },
        })}
        part={createPart({ type: 'linear' })}
        isDark={false}
        problemNumber={1}
      />
    )

    const linearProblem = document.querySelector('[data-element="detailed-linear-problem"]')
    expect(linearProblem).toBeInTheDocument()
  })

  it('displays constraints information', () => {
    render(
      <DetailedProblemCard
        slot={createSlot({
          constraints: {
            termCount: { min: 3, max: 5 },
            digitRange: { min: 1, max: 3 },
          },
        })}
        part={createPart()}
        isDark={false}
        problemNumber={1}
      />
    )

    expect(screen.getByText('Constraints:')).toBeInTheDocument()
    expect(screen.getByText('Terms: 3-5')).toBeInTheDocument()
    expect(screen.getByText('Digits: 1-3')).toBeInTheDocument()
  })

  it('shows "(none)" when no constraints are set', () => {
    render(
      <DetailedProblemCard
        slot={createSlot({ constraints: {} })}
        part={createPart()}
        isDark={false}
        problemNumber={1}
      />
    )

    expect(screen.getByText('(none)')).toBeInTheDocument()
  })

  it('shows complexity budget constraints', () => {
    render(
      <DetailedProblemCard
        slot={createSlot({
          constraints: {},
          complexityBounds: { min: 1, max: 5 },
        })}
        part={createPart()}
        isDark={false}
        problemNumber={1}
      />
    )

    expect(screen.getByText('Budget: 1-5/term')).toBeInTheDocument()
  })

  it('displays auto-pause threshold when stats are provided', () => {
    const autoPauseStats: AutoPauseStats = {
      meanMs: 5000,
      stdDevMs: 2000,
      thresholdMs: 9000,
      sampleCount: 10,
      usedStatistics: true,
    }

    render(
      <DetailedProblemCard
        slot={createSlot()}
        part={createPart()}
        isDark={false}
        problemNumber={1}
        autoPauseStats={autoPauseStats}
      />
    )

    expect(screen.getByText('Auto-pause threshold:')).toBeInTheDocument()
    expect(screen.getByText('9.0s')).toBeInTheDocument()
    expect(screen.getByText('Statistical threshold')).toBeInTheDocument()
  })

  it('displays response timing for answered problems', () => {
    const result = createResult({ responseTimeMs: 4500, isCorrect: true })

    render(
      <DetailedProblemCard
        slot={createSlot()}
        part={createPart()}
        isDark={false}
        problemNumber={1}
        result={result}
      />
    )

    expect(screen.getByText('Response:')).toBeInTheDocument()
    expect(screen.getByText('4.5s')).toBeInTheDocument()
  })

  it('shows "over threshold" when response time exceeds auto-pause', () => {
    const result = createResult({ responseTimeMs: 12000 })
    const autoPauseStats: AutoPauseStats = {
      meanMs: 5000,
      stdDevMs: 2000,
      thresholdMs: 9000,
      sampleCount: 10,
      usedStatistics: true,
    }

    render(
      <DetailedProblemCard
        slot={createSlot()}
        part={createPart()}
        isDark={false}
        problemNumber={1}
        result={result}
        autoPauseStats={autoPauseStats}
      />
    )

    expect(screen.getByText('12.0s (over threshold)')).toBeInTheDocument()
  })

  it('shows "Used help" when student had help', () => {
    const result = createResult({ hadHelp: true })

    render(
      <DetailedProblemCard
        slot={createSlot()}
        part={createPart()}
        isDark={false}
        problemNumber={1}
        result={result}
      />
    )

    expect(screen.getByText('Used help')).toBeInTheDocument()
  })

  it('shows incorrect answer in the result display', () => {
    const result = createResult({
      isCorrect: false,
      studentAnswer: 9,
    })

    render(
      <DetailedProblemCard
        slot={createSlot({
          problem: { terms: [3, 4], answer: 7, skillsRequired: [] },
        })}
        part={createPart({ type: 'abacus' })}
        isDark={false}
        problemNumber={1}
        result={result}
      />
    )

    expect(screen.getByText('You said 9')).toBeInTheDocument()
  })

  it('shows skill pills with generation trace', () => {
    const trace = createTrace({
      skillMasteryContext: {
        'basic.directAddition': {
          isPracticing: true,
          baseCost: 1,
          effectiveCost: 1,
        },
      },
    })

    render(
      <DetailedProblemCard
        slot={createSlot({
          problem: {
            terms: [3, 4],
            answer: 7,
            skillsRequired: ['basic.directAddition'],
            generationTrace: trace,
          },
        })}
        part={createPart({ type: 'abacus' })}
        isDark={false}
        problemNumber={1}
      />
    )

    // Skill name should be formatted
    expect(screen.getByText('Direct addition')).toBeInTheDocument()
    // Should show "(start)" for first term with no skills
    expect(screen.getByText('(start)')).toBeInTheDocument()
  })

  it('shows grand total when trace has totalComplexityCost', () => {
    const trace = createTrace({ totalComplexityCost: 5 })

    render(
      <DetailedProblemCard
        slot={createSlot({
          problem: {
            terms: [3, 4],
            answer: 7,
            skillsRequired: ['basic.directAddition'],
            generationTrace: trace,
          },
        })}
        part={createPart({ type: 'abacus' })}
        isDark={false}
        problemNumber={1}
      />
    )

    const grandTotal = document.querySelector('[data-element="grand-total"]')
    expect(grandTotal).toBeInTheDocument()
    expect(grandTotal!.textContent).toContain('5')
  })

  it('does not render problem section when slot has no problem', () => {
    render(
      <DetailedProblemCard
        slot={createSlot({ problem: undefined })}
        part={createPart()}
        isDark={false}
        problemNumber={1}
      />
    )

    expect(
      document.querySelector('[data-element="detailed-vertical-problem"]')
    ).not.toBeInTheDocument()
    expect(
      document.querySelector('[data-element="detailed-linear-problem"]')
    ).not.toBeInTheDocument()
  })

  it('renders linear equation format for linear part', () => {
    const trace = createTrace({
      terms: [5, -3],
      answer: 2,
      steps: [
        {
          stepNumber: 0,
          operation: '0 + 5 = 5',
          accumulatedBefore: 0,
          termAdded: 5,
          accumulatedAfter: 5,
          skillsUsed: [],
          explanation: 'Start with 5',
          complexityCost: 0,
        },
        {
          stepNumber: 1,
          operation: '5 - 3 = 2',
          accumulatedBefore: 5,
          termAdded: -3,
          accumulatedAfter: 2,
          skillsUsed: ['basic.directSubtraction'],
          explanation: 'Subtract 3',
          complexityCost: 1,
        },
      ],
    })

    render(
      <DetailedProblemCard
        slot={createSlot({
          problem: {
            terms: [5, -3],
            answer: 2,
            skillsRequired: ['basic.directSubtraction'],
            generationTrace: trace,
          },
        })}
        part={createPart({ type: 'linear' })}
        isDark={false}
        problemNumber={1}
      />
    )

    // Linear format shows equation inline
    const equationSection = document.querySelector('[data-element="equation-section"]')
    expect(equationSection).toBeInTheDocument()
  })

  it('shows rotation label "Practicing" for active skills', () => {
    const trace = createTrace({
      skillMasteryContext: {
        'basic.directAddition': {
          isPracticing: true,
          baseCost: 1,
          effectiveCost: 1,
        },
      },
    })

    render(
      <DetailedProblemCard
        slot={createSlot({
          problem: {
            terms: [3, 4],
            answer: 7,
            skillsRequired: ['basic.directAddition'],
            generationTrace: trace,
          },
        })}
        part={createPart({ type: 'abacus' })}
        isDark={false}
        problemNumber={1}
      />
    )

    expect(screen.getByText('Practicing')).toBeInTheDocument()
  })

  it('shows TermTotalBadge with "!" for over-budget costs', () => {
    const trace = createTrace({
      steps: [
        {
          stepNumber: 0,
          operation: '0 + 3 = 3',
          accumulatedBefore: 0,
          termAdded: 3,
          accumulatedAfter: 3,
          skillsUsed: [],
          explanation: 'Start with 3',
          complexityCost: 0,
        },
        {
          stepNumber: 1,
          operation: '3 + 4 = 7',
          accumulatedBefore: 3,
          termAdded: 4,
          accumulatedAfter: 7,
          skillsUsed: ['basic.directAddition'],
          explanation: 'Add 4',
          complexityCost: 10,
        },
      ],
    })

    render(
      <DetailedProblemCard
        slot={createSlot({
          problem: {
            terms: [3, 4],
            answer: 7,
            skillsRequired: ['basic.directAddition'],
            generationTrace: trace,
          },
          complexityBounds: { max: 5 },
        })}
        part={createPart({ type: 'abacus' })}
        isDark={false}
        problemNumber={1}
      />
    )

    // Over-budget term total should show "!" indicator
    const termTotals = document.querySelectorAll('[data-element="term-total"]')
    const overBudgetTotal = Array.from(termTotals).find((el) => el.textContent?.includes('!'))
    expect(overBudgetTotal).toBeTruthy()
    expect(overBudgetTotal!.textContent).toContain('10!')
  })
})
