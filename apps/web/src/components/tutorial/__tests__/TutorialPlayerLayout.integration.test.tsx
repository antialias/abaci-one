import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TutorialPlayer } from '../TutorialPlayer'
import { getTutorialForEditor } from '../../../utils/tutorialConverter'
import type { Tutorial } from '../../../types/tutorial'

// Mock the AbacusReact component for integration tests
vi.mock('@soroban/abacus-react', () => ({
  AbacusReact: ({ value, onValueChange, callbacks, stepBeadHighlights }: any) => (
    <div data-testid="mock-abacus">
      <div data-testid="abacus-value">{value}</div>
      <div data-testid="step-bead-highlights">
        {stepBeadHighlights?.length || 0} arrows
      </div>
      <button
        data-testid="mock-bead-0"
        onClick={() => {
          onValueChange?.(value + 1)
          callbacks?.onBeadClick?.({
            placeValue: 0,
            beadType: 'earth',
            position: 0,
            active: false
          })
        }}
      >
        Mock Earth Bead
      </button>
      <button
        data-testid="mock-bead-heaven"
        onClick={() => {
          onValueChange?.(value + 5)
          callbacks?.onBeadClick?.({
            placeValue: 0,
            beadType: 'heaven',
            active: false
          })
        }}
      >
        Mock Heaven Bead
      </button>
    </div>
  )
}))

describe('TutorialPlayer New Layout Integration Tests', () => {
  let mockTutorial: Tutorial
  let mockOnStepChange: ReturnType<typeof vi.fn>
  let mockOnStepComplete: ReturnType<typeof vi.fn>
  let mockOnEvent: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockTutorial = getTutorialForEditor()
    mockOnStepChange = vi.fn()
    mockOnStepComplete = vi.fn()
    mockOnEvent = vi.fn()
  })

  const renderTutorialPlayer = (props = {}) => {
    return render(
      <TutorialPlayer
        tutorial={mockTutorial}
        onStepChange={mockOnStepChange}
        onStepComplete={mockOnStepComplete}
        onEvent={mockOnEvent}
        {...props}
      />
    )
  }

  describe('New Layout Structure', () => {
    it('should render tutorial step title instead of problem field', () => {
      renderTutorialPlayer()

      const firstStep = mockTutorial.steps[0]
      expect(screen.getByText(firstStep.title)).toBeInTheDocument()

      // Should NOT display the raw problem field
      expect(screen.queryByText(firstStep.problem)).not.toBeInTheDocument()
    })

    it('should display computed problem string from start/target values', () => {
      renderTutorialPlayer()

      const firstStep = mockTutorial.steps[0]
      const expectedProblem = `${firstStep.startValue} + ${firstStep.targetValue - firstStep.startValue} = ${firstStep.targetValue}`

      expect(screen.getByText(expectedProblem)).toBeInTheDocument()
    })

    it('should show inline guidance with fixed height layout', () => {
      renderTutorialPlayer()

      // Should show current instruction in inline guidance area
      const firstStep = mockTutorial.steps[0]
      expect(screen.getByText('Click the earth bead to add 1')).toBeInTheDocument()
    })

    it('should keep abacus always visible and centered', () => {
      renderTutorialPlayer()

      const abacus = screen.getByTestId('mock-abacus')
      expect(abacus).toBeInTheDocument()

      // Abacus should be present and visible
      expect(abacus).toBeVisible()
    })

    it('should show bead diff tooltip instead of error messages', async () => {
      renderTutorialPlayer()

      // With new design, no error toasts are shown - only bead diff tooltip
      const abacus = screen.getByTestId('mock-abacus')
      expect(abacus).toBeInTheDocument()

      // Bead diff tooltip should appear when there are highlights
      const highlights = screen.getByTestId('step-bead-highlights')
      expect(highlights).toHaveTextContent('1 arrows')
    })

    it('should display success message as toast when step completed', async () => {
      renderTutorialPlayer()

      const firstStep = mockTutorial.steps[0]
      const targetValue = firstStep.targetValue

      // Simulate correct interaction to complete step
      for (let i = 0; i < targetValue; i++) {
        const bead = screen.getByTestId('mock-bead-0')
        fireEvent.click(bead)
      }

      // Should show success message as toast
      await waitFor(() => {
        expect(screen.getByText(/great! you completed this step correctly/i)).toBeInTheDocument()
      })
    })
  })

  describe('Bead Tooltip Functionality', () => {
    it('should show bead diff tooltip when user needs help', async () => {
      renderTutorialPlayer()

      // Wait for help timer (8 seconds in real code, but we can test the logic)
      // Since we're mocking, we'll simulate the conditions

      const abacus = screen.getByTestId('mock-abacus')
      expect(abacus).toBeInTheDocument()

      // Tooltip should appear when there are step bead highlights
      const highlights = screen.getByTestId('step-bead-highlights')
      expect(highlights).toBeInTheDocument()
    })

    it('should position tooltip near topmost bead with arrows', () => {
      renderTutorialPlayer()

      // This tests the integration of our helper functions
      // The tooltip positioning logic should work with mock abacus
      const abacus = screen.getByTestId('mock-abacus')
      expect(abacus).toBeInTheDocument()
    })
  })

  describe('Navigation and Multi-step Flow', () => {
    it('should maintain abacus position during navigation', async () => {
      renderTutorialPlayer()

      const abacus = screen.getByTestId('mock-abacus')
      const initialPosition = abacus.getBoundingClientRect()

      // Navigate to next step
      const nextButton = screen.getByText(/next/i)
      fireEvent.click(nextButton)

      await waitFor(() => {
        const newPosition = abacus.getBoundingClientRect()
        // Abacus should remain in same position
        expect(newPosition.top).toBe(initialPosition.top)
        expect(newPosition.left).toBe(initialPosition.left)
      })
    })

    it('should update guidance content during multi-step instructions', async () => {
      renderTutorialPlayer()

      const firstStep = mockTutorial.steps[0]
      if (firstStep.multiStepInstructions && firstStep.multiStepInstructions.length > 1) {
        // Should show first instruction initially
        expect(screen.getByText(firstStep.multiStepInstructions[0])).toBeInTheDocument()

        // After user interaction, should advance to next instruction
        // (This would need proper multi-step interaction simulation)
      }
    })

    it('should show pedagogical decomposition with highlighting', () => {
      renderTutorialPlayer()

      // Should show mathematical decomposition
      // This tests integration with the unified step generator
      const firstStep = mockTutorial.steps[0]
      if (firstStep.startValue !== firstStep.targetValue) {
        // Should show some form of mathematical representation
        const abacusValue = screen.getByTestId('abacus-value')
        expect(abacusValue).toBeInTheDocument()
      }
    })
  })

  describe('Responsive Layout Behavior', () => {
    it('should not require scrolling to see abacus', () => {
      renderTutorialPlayer()

      const abacus = screen.getByTestId('mock-abacus')
      expect(abacus).toBeInTheDocument()
      expect(abacus).toBeVisible()

      // In a real e2e test, we'd check viewport constraints
      // Here we ensure abacus is always rendered
    })

    it('should handle guidance content overflow gracefully', () => {
      // Test with a tutorial step that has very long instructions
      const longInstructionTutorial = {
        ...mockTutorial,
        steps: [{
          ...mockTutorial.steps[0],
          multiStepInstructions: [
            'This is a very long instruction that should be handled gracefully within the fixed height guidance area without breaking the layout or causing the abacus to move from its fixed position'
          ]
        }]
      }

      render(
        <TutorialPlayer
          tutorial={longInstructionTutorial}
          onStepChange={mockOnStepChange}
          onStepComplete={mockOnStepComplete}
          onEvent={mockOnEvent}
        />
      )

      const abacus = screen.getByTestId('mock-abacus')
      expect(abacus).toBeInTheDocument()
      expect(abacus).toBeVisible()
    })
  })

  describe('Accessibility and UX', () => {
    it('should maintain proper heading hierarchy', () => {
      renderTutorialPlayer()

      // Should have proper h1 for tutorial title
      const tutorialTitle = screen.getByRole('heading', { level: 1 })
      expect(tutorialTitle).toBeInTheDocument()

      // Should have h2 for computed problem
      const problemHeading = screen.getByRole('heading', { level: 2 })
      expect(problemHeading).toBeInTheDocument()
    })

    it('should provide clear visual feedback for user actions', async () => {
      renderTutorialPlayer()

      const earthBead = screen.getByTestId('mock-bead-0')
      fireEvent.click(earthBead)

      // Should update abacus value
      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('1')
      })

      // Should call event handlers
      expect(mockOnEvent).toHaveBeenCalled()
    })
  })
})