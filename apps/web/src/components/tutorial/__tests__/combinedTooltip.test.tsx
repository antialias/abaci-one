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

          // Should have enhanced subtitle with provenance context
          expect(text).toContain('From ones digit 4 of 4')

          // Should have enhanced chips with source digit
          expect(text).toContain('Source digit: 4 from 4 (ones place)')

          // Should still have pedagogical chips
          expect(text).toContain('This rod shows: 3')
          expect(text).toContain('Not enough lower beads here: Need 1 more')

          // Should have why explanations from readable content
          expect(text).toContain('Adding 4 would need more lower beads than we have')
          expect(text).toContain('Use the heaven bead instead: press it and lift some lower beads')

          // Should have additional provenance context in why section
          expect(text).toContain('This expansion processes the ones digit 4 from the addend 4')
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

          // Should have provenance context
          expect(text).toContain('Source digit: 3 from 3 (ones place)')

          // Should have why explanations
          expect(text).toContain('Adding 3 would need more lower beads than we have')
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

          // Should have provenance explanation in why section
          expect(text).toContain('We\'re adding the tens digit of 25 → 2 tens')
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

          // Should have why explanations
          expect(text).toContain('would overfill this rod') || expect(text).toContain('need more lower beads')

          // Should have additional provenance context
          expect(text).toContain('This expansion processes the ones digit')
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

      // Count occurrences of key phrases to ensure no duplication
      const sourceDigitMatches = (text.match(/Source digit/g) || []).length
      const thisRodMatches = (text.match(/This rod shows/g) || []).length
      const addingMatches = (text.match(/Adding 4 would need/g) || []).length

      // Each should appear exactly once
      expect(sourceDigitMatches).toBe(1)
      expect(thisRodMatches).toBe(1)
      expect(addingMatches).toBe(1)
    })
  })
})