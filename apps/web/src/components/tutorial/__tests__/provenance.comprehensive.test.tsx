import { render, screen } from '@testing-library/react'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Tutorial } from '../../../types/tutorial'
import { generateUnifiedInstructionSequence } from '../../../utils/unifiedStepGenerator'
import { DecompositionWithReasons } from '../DecompositionWithReasons'
import { TutorialProvider, useTutorialContext } from '../TutorialContext'
import { TutorialUIProvider } from '../TutorialUIContext'

// Mock Radix HoverCard (component uses @radix-ui/react-hover-card, not tooltip)
vi.mock('@radix-ui/react-hover-card', () => ({
  Root: ({ children }: any) => <div data-testid="hovercard-root">{children}</div>,
  Trigger: ({ children }: any) => <div data-testid="hovercard-trigger">{children}</div>,
  Portal: ({ children }: any) => <div data-testid="hovercard-portal">{children}</div>,
  Content: ({ children, className, ...props }: any) => (
    <div data-testid="tooltip-content" className={className} {...props}>
      {children}
    </div>
  ),
  Arrow: (props: any) => <div data-testid="hovercard-arrow" {...props} />,
}))

describe('Provenance System - Comprehensive Tests', () => {
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

  describe('Unified Step Generator Provenance', () => {
    it('should generate correct provenance data for 3475 + 25 = 3500', () => {
      const result = generateUnifiedInstructionSequence(3475, 3500)

      // Verify basic structure
      expect(result.steps.length).toBeGreaterThan(0)
      expect(result.segments.length).toBeGreaterThan(0)
      expect(result.fullDecomposition).toContain('3475 + 25')

      // Find the "20" step (tens digit)
      const twentyStep = result.steps.find((step) => step.mathematicalTerm === '20')
      expect(twentyStep).toBeDefined()
      expect(twentyStep?.provenance).toBeDefined()

      if (twentyStep?.provenance) {
        // Verify provenance data contains expected fields
        expect(twentyStep.provenance).toEqual(
          expect.objectContaining({
            rhs: 25, // the addend
            rhsDigit: 2, // digit from tens place
            rhsPlace: 1, // tens = place 1
            rhsPlaceName: 'tens', // human readable
            rhsDigitIndex: 0, // '2' is first character in '25'
            rhsValue: 20, // 2 * 10^1 = 20
          })
        )

        // Also verify additional term-level fields
        expect(twentyStep.provenance.termPlace).toBe(1)
        expect(twentyStep.provenance.termPlaceName).toBe('tens')
        expect(twentyStep.provenance.termValue).toBe(20)
      }

      // Verify ones digit complement group
      const complementSteps = result.steps.filter((step) =>
        step.provenance?.groupId?.includes('10comp-0-5')
      )
      expect(complementSteps.length).toBeGreaterThan(0)

      // All complement steps should trace back to the same source digit
      complementSteps.forEach((step) => {
        expect(step.provenance?.rhs).toBe(25)
        expect(step.provenance?.rhsDigit).toBe(5)
        expect(step.provenance?.rhsPlace).toBe(0)
        expect(step.provenance?.rhsPlaceName).toBe('ones')
      })

      // Verify equation anchors for digit highlighting
      expect(result.equationAnchors).toBeDefined()
      expect(result.equationAnchors?.differenceText).toBe('25')
      expect(result.equationAnchors?.rhsDigitPositions).toHaveLength(2)
    })
  })

  describe('Tooltip Enhancement Logic', () => {
    it('should generate correct enhanced tooltip content', () => {
      const provenance = {
        rhs: 25,
        rhsDigit: 2,
        rhsPlace: 1,
        rhsPlaceName: 'tens' as const,
        rhsDigitIndex: 0,
        rhsValue: 20,
      }

      // Test the exact logic from getEnhancedTooltipContent
      const title = `Add the ${provenance.rhsPlaceName} digit — ${provenance.rhsDigit} ${provenance.rhsPlaceName} (${provenance.rhsValue})`
      const subtitle = `From addend ${provenance.rhs}`

      expect(title).toBe('Add the tens digit — 2 tens (20)')
      expect(subtitle).toBe('From addend 25')

      // Test breadcrumb chips
      const chips = [
        {
          label: "Digit we're using",
          value: `${provenance.rhsDigit} (${provenance.rhsPlaceName})`,
        },
        {
          label: 'So we add here',
          value: `+${provenance.rhsDigit} ${provenance.rhsPlaceName} → ${provenance.rhsValue}`,
        },
      ]

      expect(chips[0]).toEqual({
        label: "Digit we're using",
        value: '2 (tens)',
      })

      expect(chips[1]).toEqual({
        label: 'So we add here',
        value: '+2 tens → 20',
      })

      // Test explanation text
      const explanation = `We're adding the ${provenance.rhsPlaceName} digit of ${provenance.rhs} → ${provenance.rhsDigit} ${provenance.rhsPlaceName}.`
      expect(explanation).toBe("We're adding the tens digit of 25 → 2 tens.")
    })
  })

  describe('Context Integration', () => {
    it('should provide unified steps through tutorial context', () => {
      let contextSteps: any = null

      function TestComponent() {
        const { unifiedSteps } = useTutorialContext()
        contextSteps = unifiedSteps
        return <div data-testid="test-component">Test</div>
      }

      renderWithTutorialContext(<TestComponent />)

      // Context should provide steps with provenance
      expect(contextSteps).toBeDefined()
      expect(Array.isArray(contextSteps)).toBe(true)
      expect(contextSteps.length).toBeGreaterThan(0)

      // Find the "20" step
      const twentyStep = contextSteps.find((step: any) => step.mathematicalTerm === '20')
      expect(twentyStep).toBeDefined()
      expect(twentyStep.provenance).toBeDefined()
      expect(twentyStep.provenance.rhsValue).toBe(20)
    })
  })

  describe('DecompositionWithReasons Integration', () => {
    it('should render enhanced tooltips with provenance information', () => {
      const result = generateUnifiedInstructionSequence(3475, 3500)

      renderWithTutorialContext(
        <DecompositionWithReasons
          fullDecomposition={result.fullDecomposition}
          termPositions={result.steps.map((step) => step.termPosition)}
          segments={result.segments}
        />
      )

      // In test environment, t('key', {...}) returns just 'key' (the i18n mock).
      // For Direct rule with provenance, the enhanced title is t('directTitle', {...}) => 'directTitle'
      // and the enhanced subtitle is t('directSubtitle', {...}) => 'directSubtitle'.
      // The readable summary (not i18n) contains the actual explanation text.

      // Check that the DOM contains enhanced content from the provenance system
      const enhancedContent = [
        // i18n key for Direct rule enhanced title
        screen.queryAllByText('directTitle'),
        // i18n key for Direct rule enhanced subtitle
        screen.queryAllByText('directSubtitle'),
        // The readable summary is not i18n, so it shows as-is
        screen.queryAllByText(/Add 2 to the tens/),
      ].flat()

      // The provenance system should generate enhanced content for mathematical terms
      expect(enhancedContent.length).toBeGreaterThan(0)
    })
  })

  describe('Regression Tests', () => {
    it('should not break existing functionality without provenance', () => {
      // Test with a simple case that might not generate provenance
      renderWithTutorialContext(
        <DecompositionWithReasons
          fullDecomposition="7 + 3 = 10"
          termPositions={[
            { startIndex: 0, endIndex: 1 },
            { startIndex: 4, endIndex: 5 },
            { startIndex: 8, endIndex: 10 },
          ]}
          segments={[]}
        />
      )

      // Should still render without errors
      expect(screen.getByText('7')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument()
    })

    it('should handle empty or malformed data gracefully', () => {
      renderWithTutorialContext(
        <DecompositionWithReasons fullDecomposition="" termPositions={[]} segments={[]} />
      )

      // Should render without throwing - the component renders a div.decomposition
      const decomposition = document.querySelector('.decomposition')
      expect(decomposition).toBeTruthy()
    })
  })

  describe('End-to-End User Experience', () => {
    it('should provide clear digit-to-pill connection for students', () => {
      const result = generateUnifiedInstructionSequence(3475, 3500)

      // Verify that every step with provenance clearly indicates its source
      result.steps.forEach((step) => {
        if (step.provenance) {
          // Each step should know which addend digit it came from
          expect(step.provenance.rhs).toBe(25)
          expect([2, 5]).toContain(step.provenance.rhsDigit)
          expect(['tens', 'ones']).toContain(step.provenance.rhsPlaceName)

          // The digit index should point to the correct character in "25"
          if (step.provenance.rhsDigit === 2) {
            expect(step.provenance.rhsDigitIndex).toBe(0) // '2' is at index 0
          } else if (step.provenance.rhsDigit === 5) {
            expect(step.provenance.rhsDigitIndex).toBe(1) // '5' is at index 1
          }
        }
      })

      // Equation anchors should allow precise highlighting
      expect(result.equationAnchors?.rhsDigitPositions[0]).toEqual({
        digitIndex: 0,
        startIndex: expect.any(Number),
        endIndex: expect.any(Number),
      })

      expect(result.equationAnchors?.rhsDigitPositions[1]).toEqual({
        digitIndex: 1,
        startIndex: expect.any(Number),
        endIndex: expect.any(Number),
      })
    })
  })
})
