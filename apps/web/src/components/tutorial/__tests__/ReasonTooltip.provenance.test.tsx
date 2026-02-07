import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PedagogicalSegment, TermProvenance } from '../../../utils/unifiedStepGenerator'
import { ReasonTooltip } from '../ReasonTooltip'

// Mock Radix HoverCard (component uses @radix-ui/react-hover-card, not tooltip)
// All mock components must be defined inside the factory to avoid hoisting issues
vi.mock('@radix-ui/react-hover-card', () => ({
  Root: ({ children }: any) => <div data-testid="hovercard-root">{children}</div>,
  Trigger: ({ children }: any) => <div data-testid="hovercard-trigger">{children}</div>,
  Portal: ({ children }: any) => <div data-testid="hovercard-portal">{children}</div>,
  Content: ({ children, ...props }: any) => (
    <div data-testid="hovercard-content" {...props}>
      {children}
    </div>
  ),
  Arrow: (props: any) => <div data-testid="hovercard-arrow" {...props} />,
}))

describe('ReasonTooltip with Provenance', () => {
  const mockProvenance: TermProvenance = {
    rhs: 25,
    rhsDigit: 2,
    rhsPlace: 1,
    rhsPlaceName: 'tens',
    rhsDigitIndex: 0,
    rhsValue: 20,
  }

  const mockSegment: PedagogicalSegment = {
    id: 'place-1-digit-2',
    place: 1,
    digit: 2,
    a: 7,
    L: 2,
    U: 0,
    goal: 'Increase tens by 2 without carry',
    plan: [
      {
        rule: 'Direct',
        conditions: ['a+d=7+2=9 ≤ 9'],
        explanation: ['Fits inside this place; add earth beads directly.'],
      },
    ],
    expression: '20',
    stepIndices: [0],
    termIndices: [0],
    termRange: { startIndex: 10, endIndex: 12 },
    startValue: 3475,
    endValue: 3495,
    startState: {},
    endState: {},
    readable: {
      title: 'Direct Add — tens',
      subtitle: 'Simple bead movement',
      chips: [
        { label: 'This rod shows', value: '7' },
        { label: "We're adding", value: '2' },
      ],
      why: ['We can add beads directly to this rod.'],
      stepsFriendly: ['Add 2 earth beads in tens column'],
      summary: 'Add 2 earth beads directly in the tens column.',
    },
  }

  const defaultProps = {
    termIndex: 0,
    segment: mockSegment,
    provenance: mockProvenance,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display enhanced title with provenance (via i18n key)', () => {
    render(
      <ReasonTooltip {...defaultProps}>
        <span>20</span>
      </ReasonTooltip>
    )

    // i18n mock returns the key name. The component calls t('directTitle', {...})
    // which returns 'directTitle' in test environment
    expect(screen.getByText('directTitle')).toBeInTheDocument()
  })

  it('should display enhanced subtitle with provenance (via i18n key)', () => {
    render(
      <ReasonTooltip {...defaultProps}>
        <span>20</span>
      </ReasonTooltip>
    )

    // t('directSubtitle', { addend: 25 }) returns 'directSubtitle'
    expect(screen.getByText('directSubtitle')).toBeInTheDocument()
  })

  it('should show details toggle button for chips', () => {
    render(
      <ReasonTooltip {...defaultProps}>
        <span>20</span>
      </ReasonTooltip>
    )

    // Chips are behind a "More details" disclosure toggle (i18n key: details.toggle)
    expect(screen.getByText('details.toggle')).toBeInTheDocument()
  })

  it('should display rule info emoji for Direct rule', () => {
    render(
      <ReasonTooltip {...defaultProps}>
        <span>20</span>
      </ReasonTooltip>
    )

    // Direct rule shows sparkle emoji
    expect(screen.getByText('✨')).toBeInTheDocument()
  })

  it('should handle complement operations with different rule', () => {
    const complementProvenance: TermProvenance = {
      rhs: 25,
      rhsDigit: 5,
      rhsPlace: 0,
      rhsPlaceName: 'ones',
      rhsDigitIndex: 1,
      rhsValue: 5,
      groupId: '10comp-0-5',
    }

    const complementSegment: PedagogicalSegment = {
      ...mockSegment,
      id: 'place-0-digit-5',
      place: 0,
      digit: 5,
      plan: [
        {
          rule: 'TenComplement',
          conditions: ['a+d=5+5=10 ≥ 10'],
          explanation: ['Need a carry to the next higher place.'],
        },
      ],
      readable: {
        ...mockSegment.readable,
        title: 'Make 10 — ones',
        subtitle: 'Using pairs that make 10',
        summary: 'Use pairs that make 10 to add 5 in the ones column.',
      },
    }

    render(
      <ReasonTooltip
        {...defaultProps}
        segment={complementSegment}
        provenance={complementProvenance}
      >
        <span>100</span>
      </ReasonTooltip>
    )

    // TenComplement rule shows the 10 emoji
    expect(screen.getByText('🔟')).toBeInTheDocument()
    // Title falls back to readable.title for non-Direct rules
    expect(screen.getByText('Make 10 — ones')).toBeInTheDocument()
  })

  it('should fallback to readable content when provenance is not available', () => {
    render(
      <ReasonTooltip {...defaultProps} provenance={undefined}>
        <span>20</span>
      </ReasonTooltip>
    )

    // Without provenance, falls back to readable.title and readable.subtitle
    expect(screen.getByText('Direct Add — tens')).toBeInTheDocument()
    expect(screen.getByText('Simple bead movement')).toBeInTheDocument()
  })

  it('should not render tooltip content when no rule is provided', () => {
    const segmentWithoutRule = {
      ...mockSegment,
      plan: [],
    }

    render(
      <ReasonTooltip {...defaultProps} segment={segmentWithoutRule}>
        <span>20</span>
      </ReasonTooltip>
    )

    // Should just render the children without any tooltip
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.queryByTestId('hovercard-content')).not.toBeInTheDocument()
  })

  it('should render summary text from segment', () => {
    render(
      <ReasonTooltip {...defaultProps}>
        <span>20</span>
      </ReasonTooltip>
    )

    // Summary text is displayed from segment.readable.summary
    expect(screen.getByText('Add 2 earth beads directly in the tens column.')).toBeInTheDocument()
  })
})
