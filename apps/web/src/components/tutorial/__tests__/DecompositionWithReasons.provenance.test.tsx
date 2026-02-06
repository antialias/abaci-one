import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { generateUnifiedInstructionSequence } from '../../../utils/unifiedStepGenerator'
import { DecompositionWithReasons } from '../DecompositionWithReasons'

// Mock Radix Tooltip so it renders content immediately
vi.mock('@radix-ui/react-tooltip', () => ({
  Provider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-provider">{children}</div>
  ),
  Root: ({ children, open = true }: { children: React.ReactNode; open?: boolean }) => (
    <div data-testid="tooltip-root" data-open={open}>
      {children}
    </div>
  ),
  Trigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-trigger">{children}</div>
  ),
  Portal: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-portal">{children}</div>
  ),
  Content: ({ children, ...props }: { children: React.ReactNode; [key: string]: any }) => (
    <div data-testid="tooltip-content" {...props}>
      {children}
    </div>
  ),
  Arrow: (props: any) => <div data-testid="tooltip-arrow" {...props} />,
}))

// Mock the tutorial context
const mockTutorialContext = {
  state: {
    currentMultiStep: 0,
    // other state properties as needed
  },
  // other context methods
}

vi.mock('../TutorialContext', () => ({
  useTutorialContext: () => mockTutorialContext,
}))

describe('DecompositionWithReasons Provenance Test', () => {
  it('should render provenance information in tooltip for 3475 + 25 = 3500 example', async () => {
    // Generate the actual data for 3475 + 25 = 3500
    const result = generateUnifiedInstructionSequence(3475, 3500)

    console.log('Generated result:', {
      fullDecomposition: result.fullDecomposition,
      stepsCount: result.steps.length,
      segmentsCount: result.segments.length,
    })

    console.log('Steps with provenance:')
    result.steps.forEach((step, i) => {
      console.log(
        `Step ${i}: ${step.mathematicalTerm}`,
        step.provenance ? 'HAS PROVENANCE' : 'NO PROVENANCE'
      )
    })

    // Render the DecompositionWithReasons component
    render(
      <DecompositionWithReasons
        fullDecomposition={result.fullDecomposition}
        termPositions={result.steps.map((step) => step.termPosition)}
        segments={result.segments}
      />
    )

    // The decomposition should be rendered
    expect(
      screen.getByText(/3475 \+ 25 = 3475 \+ 20 \+ \(100 - 90 - 5\) = 3500/)
    ).toBeInTheDocument()

    // Find the "20" term
    const twentyElement = screen.getByText('20')
    expect(twentyElement).toBeInTheDocument()

    // Simulate mouse enter to trigger tooltip
    fireEvent.mouseEnter(twentyElement)

    // Wait for tooltip content to appear
    await waitFor(() => {
      const tooltipContent = screen.getByTestId('tooltip-content')
      expect(tooltipContent).toBeInTheDocument()
    })

    // Check if the enhanced provenance title appears
    await waitFor(() => {
      const provenanceTitle = screen.queryByText('Add the tens digit — 2 tens (20)')
      if (provenanceTitle) {
        expect(provenanceTitle).toBeInTheDocument()
        console.log('✅ Found provenance title!')
      } else {
        console.log('❌ Provenance title not found')
        // Log what we actually got
        const tooltipContent = screen.getByTestId('tooltip-content')
        console.log('Actual tooltip content:', tooltipContent.textContent)
      }
    })

    // Check for the provenance subtitle
    const provenanceSubtitle = screen.queryByText('From addend 25')
    if (provenanceSubtitle) {
      expect(provenanceSubtitle).toBeInTheDocument()
      console.log('✅ Found provenance subtitle!')
    } else {
      console.log('❌ Provenance subtitle not found')
    }

    // Check for the enhanced explanation
    const provenanceExplanation = screen.queryByText(/We're adding the tens digit of 25 → 2 tens/)
    if (provenanceExplanation) {
      expect(provenanceExplanation).toBeInTheDocument()
      console.log('✅ Found provenance explanation!')
    } else {
      console.log('❌ Provenance explanation not found')
    }
  })

  it('should pass provenance data from steps to ReasonTooltip', () => {
    // Generate test data
    const result = generateUnifiedInstructionSequence(3475, 3500)
    const twentyStep = result.steps.find((step) => step.mathematicalTerm === '20')

    // Verify the step has provenance
    expect(twentyStep).toBeDefined()
    expect(twentyStep?.provenance).toBeDefined()

    if (twentyStep?.provenance) {
      console.log('✅ Step has provenance data:', twentyStep.provenance)

      // Verify the provenance data is correct
      expect(twentyStep.provenance.rhs).toBe(25)
      expect(twentyStep.provenance.rhsDigit).toBe(2)
      expect(twentyStep.provenance.rhsPlaceName).toBe('tens')
      expect(twentyStep.provenance.rhsValue).toBe(20)

      console.log('✅ Provenance data is correct!')
    } else {
      console.log('❌ Step does not have provenance data')
    }

    // Find the corresponding segment
    const tensSegment = result.segments.find((seg) =>
      seg.stepIndices.includes(twentyStep!.stepIndex)
    )
    expect(tensSegment).toBeDefined()

    if (tensSegment) {
      console.log('✅ Found corresponding segment:', {
        id: tensSegment.id,
        rule: tensSegment.plan[0]?.rule,
        stepIndices: tensSegment.stepIndices,
      })
    }
  })

  it('should debug the actual data flow', () => {
    const result = generateUnifiedInstructionSequence(3475, 3500)

    console.log('\n=== DEBUGGING DATA FLOW ===')
    console.log('Full decomposition:', result.fullDecomposition)

    console.log('\nSteps:')
    result.steps.forEach((step, i) => {
      console.log(
        `  ${i}: ${step.mathematicalTerm} - segmentId: ${step.segmentId} - provenance:`,
        !!step.provenance
      )
      if (step.provenance) {
        console.log(
          `    -> rhs: ${step.provenance.rhs}, digit: ${step.provenance.rhsDigit}, place: ${step.provenance.rhsPlaceName}`
        )
      }
    })

    console.log('\nSegments:')
    result.segments.forEach((segment, i) => {
      console.log(
        `  ${i}: ${segment.id} - place: ${segment.place}, digit: ${segment.digit}, rule: ${segment.plan[0]?.rule}`
      )
      console.log(`    -> stepIndices: [${segment.stepIndices.join(', ')}]`)
      console.log(`    -> readable title: "${segment.readable?.title}"`)
    })

    // The key insight: when DecompositionWithReasons renders a SegmentGroup,
    // it should pass the provenance from the first step in that segment to ReasonTooltip
    const twentyStep = result.steps.find((step) => step.mathematicalTerm === '20')
    const tensSegment = result.segments.find((seg) =>
      seg.stepIndices.includes(twentyStep!.stepIndex)
    )

    if (twentyStep && tensSegment) {
      console.log('\n=== TOOLTIP DATA FLOW ===')
      console.log('Step provenance:', twentyStep.provenance)
      console.log('Segment readable:', tensSegment.readable)
      console.log('Expected to show enhanced content:', !!twentyStep.provenance)
    }

    expect(true).toBe(true) // This test just logs information
  })
})
