import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PurposeBadge, extractTargetSkillName, formatSkillName } from '../PurposeBadge'
import type { ProblemSlot } from '@/db/schema/session-plans'
import type { ComplexityData } from '../PurposeBadge'

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

// Mock Tooltip (render children and content directly for testability)
vi.mock('../../ui/Tooltip', () => ({
  Tooltip: ({ children, content }: { children: React.ReactNode; content: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'tooltip' }, [
      React.createElement('div', { key: 'trigger', 'data-testid': 'tooltip-trigger' }, children),
      React.createElement('div', { key: 'content', 'data-testid': 'tooltip-content' }, content),
    ]),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// ============================================================================
// Unit tests for formatSkillName
// ============================================================================

describe('formatSkillName', () => {
  it('formats basic addition skill', () => {
    expect(formatSkillName('basic', '+3')).toBe('add 3')
  })

  it('formats basic subtraction skill', () => {
    expect(formatSkillName('basic', '-5')).toBe('subtract 5')
  })

  it('returns raw key for unrecognized basic skill', () => {
    expect(formatSkillName('basic', 'foo')).toBe('foo')
  })

  it('formats fiveComplements skill', () => {
    expect(formatSkillName('fiveComplements', '4=5-1')).toBe('5-complement for 4')
  })

  it('returns raw key for unrecognized fiveComplements skill', () => {
    expect(formatSkillName('fiveComplements', 'abc')).toBe('abc')
  })

  it('formats tenComplements skill', () => {
    expect(formatSkillName('tenComplements', '9=10-1')).toBe('10-complement for 9')
  })

  it('returns raw key for unrecognized tenComplements skill', () => {
    expect(formatSkillName('tenComplements', 'xyz')).toBe('xyz')
  })

  it('returns category:key for unknown category', () => {
    expect(formatSkillName('unknown', 'foo')).toBe('unknown: foo')
  })
})

// ============================================================================
// Unit tests for extractTargetSkillName
// ============================================================================

describe('extractTargetSkillName', () => {
  it('returns null when no targetSkills', () => {
    const slot: ProblemSlot = {
      index: 0,
      purpose: 'focus',
      constraints: {},
    }
    expect(extractTargetSkillName(slot)).toBeNull()
  })

  it('returns null when targetSkills is empty', () => {
    const slot: ProblemSlot = {
      index: 0,
      purpose: 'focus',
      constraints: { targetSkills: {} },
    }
    expect(extractTargetSkillName(slot)).toBeNull()
  })

  it('extracts single basic skill name', () => {
    const slot: ProblemSlot = {
      index: 0,
      purpose: 'reinforce',
      constraints: {
        targetSkills: {
          basic: { '+3': true },
        },
      },
    }
    expect(extractTargetSkillName(slot)).toBe('add 3')
  })

  it('returns null when multiple skills in a category', () => {
    const slot: ProblemSlot = {
      index: 0,
      purpose: 'reinforce',
      constraints: {
        targetSkills: {
          basic: { '+3': true, '+4': true },
        },
      },
    }
    expect(extractTargetSkillName(slot)).toBeNull()
  })
})

// ============================================================================
// Component tests for PurposeBadge
// ============================================================================

describe('PurposeBadge', () => {
  it('renders badge with purpose text', () => {
    render(<PurposeBadge purpose="focus" />)
    expect(screen.getByText('focus')).toBeInTheDocument()
  })

  it('renders data-purpose attribute', () => {
    render(<PurposeBadge purpose="reinforce" />)
    const badge = screen.getByText('reinforce')
    expect(badge).toHaveAttribute('data-purpose', 'reinforce')
    expect(badge).toHaveAttribute('data-element', 'problem-purpose')
  })

  it('renders tooltip with correct title for focus', () => {
    render(<PurposeBadge purpose="focus" />)
    expect(screen.getByText('Focus Practice')).toBeInTheDocument()
  })

  it('renders tooltip with correct title for reinforce', () => {
    render(<PurposeBadge purpose="reinforce" />)
    expect(screen.getByText('Reinforcement')).toBeInTheDocument()
  })

  it('renders tooltip with correct title for review', () => {
    render(<PurposeBadge purpose="review" />)
    expect(screen.getByText('Spaced Review')).toBeInTheDocument()
  })

  it('renders tooltip with correct title for challenge', () => {
    render(<PurposeBadge purpose="challenge" />)
    expect(screen.getByText('Challenge')).toBeInTheDocument()
  })

  it('shows focus-specific distribution detail', () => {
    render(<PurposeBadge purpose="focus" />)
    expect(screen.getByText('60% of session')).toBeInTheDocument()
  })

  it('shows challenge-specific requirement detail', () => {
    render(<PurposeBadge purpose="challenge" />)
    expect(screen.getByText('Every term uses complements')).toBeInTheDocument()
  })

  it('shows review schedule detail', () => {
    render(<PurposeBadge purpose="review" />)
    expect(screen.getByText('Mastered: 14 days \u2022 Practicing: 7 days')).toBeInTheDocument()
  })

  it('shows targeting skill name for reinforce when slot has targetSkills', () => {
    const slot: ProblemSlot = {
      index: 0,
      purpose: 'reinforce',
      constraints: {
        targetSkills: {
          basic: { '+3': true },
        },
      },
    }
    render(<PurposeBadge purpose="reinforce" slot={slot} />)
    expect(screen.getByText('add 3')).toBeInTheDocument()
  })

  it('shows skill name from complexity data for reinforce', () => {
    const complexity: ComplexityData = {
      targetSkillName: 'add 7',
    }
    render(<PurposeBadge purpose="reinforce" complexity={complexity} />)
    expect(screen.getByText('add 7')).toBeInTheDocument()
  })

  it('shows complexity section when complexity data is provided', () => {
    const complexity: ComplexityData = {
      bounds: { min: 2, max: 5 },
      totalCost: 8,
      stepCount: 4,
    }
    render(<PurposeBadge purpose="focus" complexity={complexity} />)
    expect(screen.getByText('Complexity')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('2.0')).toBeInTheDocument() // 8 / 4 = 2.0
  })

  it('shows complexity section when slot has generation trace', () => {
    const slot: ProblemSlot = {
      index: 0,
      purpose: 'focus',
      constraints: {},
      complexityBounds: { min: 1, max: 3 },
      problem: {
        terms: [3, 4],
        answer: 7,
        skillsRequired: ['basic.+3'],
        generationTrace: {
          terms: [3, 4],
          answer: 7,
          steps: [
            {
              stepNumber: 1,
              operation: '0 + 3 = 3',
              accumulatedBefore: 0,
              termAdded: 3,
              accumulatedAfter: 3,
              skillsUsed: ['basic.+3'],
              explanation: 'Direct add',
            },
            {
              stepNumber: 2,
              operation: '3 + 4 = 7',
              accumulatedBefore: 3,
              termAdded: 4,
              accumulatedAfter: 7,
              skillsUsed: ['basic.+4'],
              explanation: 'Direct add',
            },
          ],
          allSkills: ['basic.+3', 'basic.+4'],
          totalComplexityCost: 6,
        },
      },
    }
    render(<PurposeBadge purpose="focus" slot={slot} />)
    expect(screen.getByText('Complexity')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('3.0')).toBeInTheDocument() // 6 / 2 = 3.0
  })

  it('shows bounds only text with min and max', () => {
    const complexity: ComplexityData = {
      bounds: { min: 2, max: 5 },
    }
    render(<PurposeBadge purpose="focus" complexity={complexity} />)
    // The bounds text is "2 – 5"
    expect(screen.getByText(/2\s*–\s*5/)).toBeInTheDocument()
  })

  it('shows bounds with only min', () => {
    const complexity: ComplexityData = {
      bounds: { min: 2 },
    }
    render(<PurposeBadge purpose="focus" complexity={complexity} />)
    expect(screen.getByText('≥2')).toBeInTheDocument()
  })

  it('shows bounds with only max', () => {
    const complexity: ComplexityData = {
      bounds: { max: 5 },
    }
    render(<PurposeBadge purpose="focus" complexity={complexity} />)
    expect(screen.getByText('≤5')).toBeInTheDocument()
  })

  it('does not show complexity section when no data', () => {
    render(<PurposeBadge purpose="focus" />)
    expect(screen.queryByText('Complexity')).not.toBeInTheDocument()
  })

  it('renders all four purpose types without errors', () => {
    const purposes = ['focus', 'reinforce', 'review', 'challenge'] as const
    for (const purpose of purposes) {
      const { unmount } = render(<PurposeBadge purpose={purpose} />)
      expect(screen.getByText(purpose)).toBeInTheDocument()
      unmount()
    }
  })
})
