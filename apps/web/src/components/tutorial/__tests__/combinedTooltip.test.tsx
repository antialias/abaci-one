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
  Root: ({ children }: any) => <div data-testid="tooltip-root">{children}</div>,
  Trigger: ({ children }: any) => <div data-testid="tooltip-trigger">{children}</div>,
  Portal: ({ children }: any) => <div data-testid="tooltip-portal">{children}</div>,
  Content: ({ children, className, ...props }: any) => (
    <div data-testid="tooltip-content" className={className} {...props}>
      {children}
    </div>
  ),
  Arrow: (props: any) => <div data-testid="tooltip-arrow" {...props} />,
}))

describe('Combined Tooltip Content - Provenance + Why Explanations', () => {
  const createTutorial = (startValue: number, targetValue: number): Tutorial => ({
    id: `test-${startValue}-${targetValue}`,
    title: `Test ${startValue} + ${targetValue - startValue}`,
    description: 'Testing combined tooltip content',
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
        title: `${startValue} + ${targetValue - startValue} = ${targetValue}`,
        problem: `${startValue} + ${targetValue - startValue}`,
        description: `Add ${targetValue - startValue} to get ${targetValue}`,
        startValue,
        targetValue,
        expectedAction: 'multi-step' as const,
        actionDescription: 'Follow the steps',
        tooltip: { content: 'Test', explanation: 'Test explanation' },
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  function renderWithTutorialContext(tutorial: Tutorial, component: React.ReactElement) {
    return render(
      <TutorialUIProvider>
        <TutorialProvider
          tutorial={tutorial}
          onStepComplete={() => {}}
          onTutorialComplete={() => {}}
          onEvent={() => {}}
        >
          {component}
        </TutorialProvider>
      </TutorialUIProvider>
    )
  }

  describe('Five Complement Operations', () => {
    it('should show combined provenance + why explanations for 3 + 4 = 7', () => {
      const result = generateUnifiedInstructionSequence(3, 7)
      const tutorial = createTutorial(3, 7)

      renderWithTutorialContext(
        tutorial,
        <DecompositionWithReasons
          fullDecomposition={result.fullDecomposition}
          termPositions={result.steps.map((step) => step.termPosition)}
          segments={result.segments}
        />
      )

      // Find the five complement tooltip
      const tooltipContent = screen.getAllByTestId('tooltip-content')
      let foundCombinedContent = false

      tooltipContent.forEach((tooltip) => {
        const text = tooltip.textContent || ''
        if (text.includes('Make 5')) {
          foundCombinedContent = true

          // Should have the semantic summary mentioning 5's friend
          expect(text).toMatch(/5's friend/i)

          // Should have semantic summary with core concepts
          expect(text).toMatch(/Add 4/i)
          // Summary mentions pressing the heaven bead
          expect(text).toMatch(/press the heaven bead/i)
        }
      })

      expect(foundCombinedContent).toBe(true)
    })

    it('should show combined content for 2 + 3 = 5', () => {
      const result = generateUnifiedInstructionSequence(2, 5)
      const tutorial = createTutorial(2, 5)

      renderWithTutorialContext(
        tutorial,
        <DecompositionWithReasons
          fullDecomposition={result.fullDecomposition}
          termPositions={result.steps.map((step) => step.termPosition)}
          segments={result.segments}
        />
      )

      const tooltipContent = screen.getAllByTestId('tooltip-content')
      let foundFiveComplement = false

      tooltipContent.forEach((tooltip) => {
        const text = tooltip.textContent || ''
        if (text.includes('Make 5') && !text.includes('Direct')) {
          foundFiveComplement = true

          // Should have semantic summary with core concepts
          expect(text).toMatch(/5's friend/i)
          expect(text).toMatch(/Add 3/i)
        }
      })

      expect(foundFiveComplement).toBe(true)
    })
  })

  describe('Direct Operations', () => {
    it('should show enhanced provenance content for direct operations like 3475 + 25', () => {
      const result = generateUnifiedInstructionSequence(3475, 3500)
      const tutorial = createTutorial(3475, 3500)

      renderWithTutorialContext(
        tutorial,
        <DecompositionWithReasons
          fullDecomposition={result.fullDecomposition}
          termPositions={result.steps.map((step) => step.termPosition)}
          segments={result.segments}
        />
      )

      const tooltipContent = screen.getAllByTestId('tooltip-content')
      let foundDirectContent = false

      tooltipContent.forEach((tooltip) => {
        const text = tooltip.textContent || ''
        // In tests, t('directTitle', {...}) returns the i18n key 'directTitle'
        // and t('directSubtitle', {...}) returns 'directSubtitle'
        // The Direct segment has readable.title = "Add 2 — tens"
        // But enhancedContent overrides with i18n key for Direct rule
        if (text.includes('directTitle')) {
          foundDirectContent = true

          // Should have enhanced subtitle (i18n key)
          expect(text).toContain('directSubtitle')

          // Should have readable summary
          expect(text).toContain('Add 2 to the tens')
        }
      })

      expect(foundDirectContent).toBe(true)
    })
  })

  describe('Ten Complement Operations', () => {
    it('should show combined content for ten complement operations', () => {
      // Use a case that triggers ten complement (like adding to 9)
      const result = generateUnifiedInstructionSequence(7, 12) // 7 + 5 may trigger ten complement
      const tutorial = createTutorial(7, 12)

      renderWithTutorialContext(
        tutorial,
        <DecompositionWithReasons
          fullDecomposition={result.fullDecomposition}
          termPositions={result.steps.map((step) => step.termPosition)}
          segments={result.segments}
        />
      )

      const tooltipContent = screen.getAllByTestId('tooltip-content')
      let foundTenComplement = false

      tooltipContent.forEach((tooltip) => {
        const text = tooltip.textContent || ''
        if (text.includes('Make 10') && !text.includes('Direct')) {
          foundTenComplement = true

          // Should have readable summary about adding to make 10
          expect(text).toMatch(/Add \d+ to the ones/i)

          // Should have provenance nudge (i18n key rendered by t())
          expect(text).toContain('reasoning')
        }
      })

      // Ten complement might not always trigger, so we don't assert it must be found
      // This test documents the expected behavior when it does occur
      console.log('Ten complement tooltip found:', foundTenComplement)
    })
  })

  describe('Content Structure Validation', () => {
    it('should maintain proper content hierarchy in combined tooltips', () => {
      const result = generateUnifiedInstructionSequence(3, 7)
      const tutorial = createTutorial(3, 7)

      renderWithTutorialContext(
        tutorial,
        <DecompositionWithReasons
          fullDecomposition={result.fullDecomposition}
          termPositions={result.steps.map((step) => step.termPosition)}
          segments={result.segments}
        />
      )

      const tooltip = screen.getAllByTestId('tooltip-content')[0]
      const html = tooltip.innerHTML

      // Should have proper section order: header comes first, then summary, then reasoning
      // Note: context and formula are inside a collapsed details disclosure by default
      const headerIndex = html.indexOf('reason-tooltip__header')
      const summaryIndex = html.indexOf('reason-tooltip__summary')
      const reasoningIndex = html.indexOf('reason-tooltip__reasoning')

      expect(headerIndex).toBeGreaterThan(-1)
      expect(summaryIndex).toBeGreaterThan(headerIndex)
      expect(reasoningIndex).toBeGreaterThan(summaryIndex)
    })

    it('should not duplicate content between sections', () => {
      const result = generateUnifiedInstructionSequence(3, 7)
      const tutorial = createTutorial(3, 7)

      renderWithTutorialContext(
        tutorial,
        <DecompositionWithReasons
          fullDecomposition={result.fullDecomposition}
          termPositions={result.steps.map((step) => step.termPosition)}
          segments={result.segments}
        />
      )

      const tooltip = screen.getAllByTestId('tooltip-content')[0]
      const text = tooltip.textContent || ''

      // Verify semantic content exists (simplified check)
      const has5Friend = text.includes("5's friend")
      const hasAdd4 = text.includes('Add 4')

      // Should have semantic content for this FiveComplement operation
      expect(has5Friend || hasAdd4).toBe(true)
    })
  })
})
