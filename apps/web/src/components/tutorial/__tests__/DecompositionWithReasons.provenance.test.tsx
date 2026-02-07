import { render, screen } from '@testing-library/react'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Tutorial } from '../../../types/tutorial'
import { generateUnifiedInstructionSequence } from '../../../utils/unifiedStepGenerator'
import { DecompositionWithReasons } from '../DecompositionWithReasons'
import { TutorialProvider } from '../TutorialContext'
import { TutorialUIProvider } from '../TutorialUIContext'

// Mock Radix HoverCard (component uses @radix-ui/react-hover-card, not tooltip)
vi.mock('@radix-ui/react-hover-card', () => ({
  Root: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="hovercard-root">{children}</div>
  ),
  Trigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="hovercard-trigger">{children}</div>
  ),
  Portal: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="hovercard-portal">{children}</div>
  ),
  Content: ({ children, ...props }: { children: React.ReactNode; [key: string]: any }) => (
    <div data-testid="tooltip-content" {...props}>
      {children}
    </div>
  ),
  Arrow: (props: any) => <div data-testid="hovercard-arrow" {...props} />,
}))

const provenanceTutorial: Tutorial = {
  id: 'provenance-test',
  title: 'Provenance Test',
  description: 'Testing provenance system',
  category: 'test',
  difficulty: 'beginner',
  estimatedDuration: 5,
  tags: ['test'],
  author: 'test',
  version: '1.0.0',
  isPublished: false,
  steps: [
    {
      id: 'test-step',
      title: '3475 + 25 = 3500',
      problem: '3475 + 25',
      description: 'Add 25 to get 3500',
      startValue: 3475,
      targetValue: 3500,
      expectedAction: 'multi-step' as const,
      actionDescription: 'Follow the steps',
      tooltip: { content: 'Test', explanation: 'Test explanation' },
    },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
}

function renderWithTutorialContext(component: React.ReactElement) {
  return render(
    <TutorialUIProvider>
      <TutorialProvider
        tutorial={provenanceTutorial}
        onStepComplete={() => {}}
        onTutorialComplete={() => {}}
        onEvent={() => {}}
      >
        {component}
      </TutorialProvider>
    </TutorialUIProvider>
  )
}

describe('DecompositionWithReasons Provenance Test', () => {
  it('should render provenance information in tooltip for 3475 + 25 = 3500 example', () => {
    // Generate the actual data for 3475 + 25 = 3500
    const result = generateUnifiedInstructionSequence(3475, 3500)

    // Render the DecompositionWithReasons component
    renderWithTutorialContext(
      <DecompositionWithReasons
        fullDecomposition={result.fullDecomposition}
        termPositions={result.steps.map((step) => step.termPosition)}
        segments={result.segments}
      />
    )

    // The decomposition should be rendered (text is split across spans)
    // Multiple "20" text nodes may exist (in term and in equation), so use getAllByText
    expect(screen.getAllByText('20').length).toBeGreaterThan(0)

    // Find the tooltip content elements (rendered by mocked HoverCard)
    const tooltipContent = screen.getAllByTestId('tooltip-content')
    expect(tooltipContent.length).toBeGreaterThan(0)

    // Check that the Direct segment tooltip has the i18n key for enhanced title
    // (t('directTitle', {...}) returns 'directTitle' in the test mock)
    let foundDirectTooltip = false
    tooltipContent.forEach((tooltip) => {
      const text = tooltip.textContent || ''
      if (text.includes('directTitle')) {
        foundDirectTooltip = true
        // Should also contain the readable summary
        expect(text).toContain('Add 2 to the tens')
      }
    })

    expect(foundDirectTooltip).toBe(true)
  })

  it('should pass provenance data from steps to ReasonTooltip', () => {
    // Generate test data
    const result = generateUnifiedInstructionSequence(3475, 3500)
    const twentyStep = result.steps.find((step) => step.mathematicalTerm === '20')

    // Verify the step has provenance
    expect(twentyStep).toBeDefined()
    expect(twentyStep?.provenance).toBeDefined()

    if (twentyStep?.provenance) {
      // Verify the provenance data is correct
      expect(twentyStep.provenance.rhs).toBe(25)
      expect(twentyStep.provenance.rhsDigit).toBe(2)
      expect(twentyStep.provenance.rhsPlaceName).toBe('tens')
      expect(twentyStep.provenance.rhsValue).toBe(20)
    }

    // Find the corresponding segment
    const tensSegment = result.segments.find((seg) =>
      seg.stepIndices.includes(twentyStep!.stepIndex)
    )
    expect(tensSegment).toBeDefined()
  })

  it('should debug the actual data flow', () => {
    const result = generateUnifiedInstructionSequence(3475, 3500)

    // The key insight: when DecompositionWithReasons renders a SegmentGroup,
    // it should pass the provenance from the first step in that segment to ReasonTooltip
    const twentyStep = result.steps.find((step) => step.mathematicalTerm === '20')
    const tensSegment = result.segments.find((seg) =>
      seg.stepIndices.includes(twentyStep!.stepIndex)
    )

    expect(twentyStep).toBeDefined()
    expect(tensSegment).toBeDefined()
    expect(twentyStep?.provenance).toBeDefined()
    expect(tensSegment?.readable).toBeDefined()
  })
})
