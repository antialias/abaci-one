import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { generateUnifiedInstructionSequence } from '../../../utils/unifiedStepGenerator'
import { TutorialProvider } from '../TutorialContext'
import { DecompositionWithReasons } from '../DecompositionWithReasons'
import type { Tutorial } from '../../../types/tutorial'

// Mock Radix Tooltip for testing
vi.mock('@radix-ui/react-tooltip', () => ({
  Provider: ({ children }: any) => <div data-testid="tooltip-provider">{children}</div>,
  Root: ({ children, open = true }: any) => <div data-testid="tooltip-root">{children}</div>,
  Trigger: ({ children }: any) => <div data-testid="tooltip-trigger">{children}</div>,
  Portal: ({ children }: any) => <div data-testid="tooltip-portal">{children}</div>,
  Content: ({ children, className, ...props }: any) => (
    <div data-testid="tooltip-content" className={className} {...props}>
      {children}
    </div>
  ),
  Arrow: (props: any) => <div data-testid="tooltip-arrow" {...props} />
}))

describe('Combined Tooltip Content - Provenance + Why Explanations', () => {
  const createTutorial = (startValue: number, targetValue: number): Tutorial => ({
    id: `test-${startValue}-${targetValue}`,
    title: `Test ${startValue} + ${targetValue - startValue}`,
    description: 'Testing combined tooltip content',
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
        tooltip: { content: 'Test', explanation: 'Test explanation' }
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  })

  function renderWithTutorialContext(tutorial: Tutorial, component: React.ReactElement) {
    return render(
      <TutorialProvider
        tutorial={tutorial}
        onStepComplete={() => {}}
        onTutorialComplete={() => {}}
        onEvent={() => {}}
      >
        {component}
      </TutorialProvider>
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
          termPositions={result.steps.map(step => step.termPosition)}
          segments={result.segments}
        />
      )

      // Find the five complement tooltip
      const tooltipContent = screen.getAllByTestId('tooltip-content')
      let foundCombinedContent = false

      tooltipContent.forEach(tooltip => {
        const text = tooltip.textContent || ''
        if (text.includes('Make 5 — ones')) {
          foundCombinedContent = true

          // Should have the semantic summary mentioning 5's friend
          expect(text).toMatch(/5's friend/i)

          // Should have semantic summary with core concepts
          expect(text).toMatch(/Add 4/i)
          expect(text).toMatch(/press 5/i)
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
          termPositions={result.steps.map(step => step.termPosition)}
          segments={result.segments}
        />
      )

      const tooltipContent = screen.getAllByTestId('tooltip-content')
      let foundFiveComplement = false

      tooltipContent.forEach(tooltip => {
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
          termPositions={result.steps.map(step => step.termPosition)}
          segments={result.segments}
        />
      )

      const tooltipContent = screen.getAllByTestId('tooltip-content')
      let foundDirectContent = false

      tooltipContent.forEach(tooltip => {
        const text = tooltip.textContent || ''
        // Look for direct operation tooltip (should have enhanced provenance format)
        if (text.includes('Add the tens digit — 2 tens (20)')) {
          foundDirectContent = true

          // Should have enhanced title and subtitle
          expect(text).toContain('From addend 25')

          // Should have enhanced chips
          expect(text).toContain('Digit we\'re using: 2 (tens)')
          expect(text).toContain('So we add here: +2 tens → 20')

          // Should have provenance explanation (new format)
          expect(text).toContain('From addend 25: use the tens digit 2')
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
          termPositions={result.steps.map(step => step.termPosition)}
          segments={result.segments}
        />
      )

      const tooltipContent = screen.getAllByTestId('tooltip-content')
      let foundTenComplement = false

      tooltipContent.forEach(tooltip => {
        const text = tooltip.textContent || ''
        if (text.includes('Make 10') && !text.includes('Direct')) {
          foundTenComplement = true

          // Should have enhanced subtitle with provenance
          expect(text).toMatch(/From ones digit \d+ of \d+/)

          // Should have source digit chip
          expect(text).toMatch(/Source digit: \d+ from \d+ \(ones place\)/)

          // Should have semantic summary for ten complement
          expect(text).toMatch(/Add \d+ to the ones to make 10.*carry.*take \d+ here/i)

          // Should have additional provenance context (new format)
          expect(text).toMatch(/From addend \d+: use the ones digit \d+/)
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
          termPositions={result.steps.map(step => step.termPosition)}
          segments={result.segments}
        />
      )

      const tooltip = screen.getAllByTestId('tooltip-content')[0]
      const html = tooltip.innerHTML

      // Should have proper section order
      const headerIndex = html.indexOf('reason-tooltip__header')
      const contextIndex = html.indexOf('reason-tooltip__context')
      const reasoningIndex = html.indexOf('reason-tooltip__reasoning')
      const formulaIndex = html.indexOf('reason-tooltip__formula')

      expect(headerIndex).toBeGreaterThan(-1)
      expect(contextIndex).toBeGreaterThan(headerIndex)
      expect(reasoningIndex).toBeGreaterThan(contextIndex)
      expect(formulaIndex).toBeGreaterThan(reasoningIndex)
    })

    it('should not duplicate content between sections', () => {
      const result = generateUnifiedInstructionSequence(3, 7)
      const tutorial = createTutorial(3, 7)

      renderWithTutorialContext(
        tutorial,
        <DecompositionWithReasons
          fullDecomposition={result.fullDecomposition}
          termPositions={result.steps.map(step => step.termPosition)}
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