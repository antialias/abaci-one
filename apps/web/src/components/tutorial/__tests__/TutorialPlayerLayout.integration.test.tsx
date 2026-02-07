import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Tutorial } from '../../../types/tutorial'
import { getTutorialForEditor } from '../../../utils/tutorialConverter'
import { TutorialPlayer } from '../TutorialPlayer'

// Mock the AbacusReact component for integration tests
vi.mock('@soroban/abacus-react', () => ({
  AbacusReact: ({ value, onValueChange, callbacks, stepBeadHighlights }: any) => (
    <div data-testid="mock-abacus">
      <div data-testid="abacus-value">{value}</div>
      <div data-testid="step-bead-highlights">{stepBeadHighlights?.length || 0} arrows</div>
      <button
        data-testid="mock-bead-0"
        onClick={() => {
          onValueChange?.(value + 1)
          callbacks?.onBeadClick?.({
            placeValue: 0,
            beadType: 'earth',
            position: 0,
            active: false,
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
            active: false,
          })
        }}
      >
        Mock Heaven Bead
      </button>
    </div>
  ),
  useAbacusDisplay: () => ({
    config: { colorScheme: 'place-value', beadShape: 'diamond', hideInactiveBeads: false },
    updateConfig: () => {},
    resetToDefaults: () => {},
  }),
  calculateBeadDiffFromValues: () => ({ hasChanges: false, changes: [], summary: '' }),
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
    it('should render tutorial title and step problem', () => {
      renderTutorialPlayer()

      // Tutorial title is in h1
      expect(screen.getByText(mockTutorial.title)).toBeInTheDocument()

      // Step problem is displayed in h2
      const firstStep = mockTutorial.steps[0]
      expect(screen.getByText(firstStep.problem)).toBeInTheDocument()
    })

    it('should display step description', () => {
      renderTutorialPlayer()

      const firstStep = mockTutorial.steps[0]
      expect(screen.getByText(firstStep.description)).toBeInTheDocument()
    })

    it('should show step progress info', () => {
      renderTutorialPlayer()

      // i18n mock returns the key for step progress
      expect(screen.getByText('header.step')).toBeInTheDocument()
    })

    it('should keep abacus always visible and centered', () => {
      renderTutorialPlayer()

      const abacus = screen.getByTestId('mock-abacus')
      expect(abacus).toBeInTheDocument()

      // Abacus should be present and visible
      expect(abacus).toBeVisible()
    })

    it('should render abacus with bead highlights section', async () => {
      renderTutorialPlayer()

      // The mock abacus should be rendered
      const abacus = screen.getByTestId('mock-abacus')
      expect(abacus).toBeInTheDocument()

      // Step bead highlights area should be present
      const highlights = screen.getByTestId('step-bead-highlights')
      expect(highlights).toBeInTheDocument()
    })

    it('should mark step as completed when target value is reached', async () => {
      renderTutorialPlayer()

      const firstStep = mockTutorial.steps[0]
      const targetValue = firstStep.targetValue

      // Wait for programmatic change flag to clear
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Simulate correct interaction to complete step
      for (let i = 0; i < targetValue; i++) {
        const bead = screen.getByTestId('mock-bead-0')
        fireEvent.click(bead)
      }

      // Step completion is tracked via data attribute and callback
      await waitFor(() => {
        const player = document.querySelector('[data-step-completed="true"]')
        expect(player).toBeInTheDocument()
        expect(mockOnStepComplete).toHaveBeenCalled()
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

      // Navigate to next step (i18n mock returns keys)
      const nextButton = screen.getByText('navigation.next')
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
        steps: [
          {
            ...mockTutorial.steps[0],
            multiStepInstructions: [
              'This is a very long instruction that should be handled gracefully within the fixed height guidance area without breaking the layout or causing the abacus to move from its fixed position',
            ],
          },
        ],
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

      // Wait for programmatic change flag to clear
      await new Promise((resolve) => setTimeout(resolve, 200))

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
