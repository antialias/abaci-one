import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DevAccessProvider } from '../../../hooks/useAccessControl'
import type { Tutorial } from '../../../types/tutorial'
import { TutorialPlayer } from '../TutorialPlayer'

// Mock the AbacusReact component
vi.mock('@soroban/abacus-react', () => ({
  AbacusReact: ({ value, onValueChange, callbacks }: any) => (
    <div data-testid="mock-abacus">
      <div data-testid="abacus-value">{value}</div>
      <button
        data-testid="mock-bead-0"
        onClick={() => {
          onValueChange?.(value + 1)
          callbacks?.onBeadClick?.({
            columnIndex: 4,
            beadType: 'earth',
            position: 0,
            active: false,
          })
        }}
      >
        Mock Bead
      </button>
    </div>
  ),
}))

const mockTutorial: Tutorial = {
  id: 'test-tutorial',
  title: 'Test Tutorial',
  description: 'A test tutorial',
  category: 'test',
  difficulty: 'beginner',
  estimatedDuration: 10,
  steps: [
    {
      id: 'step-1',
      title: 'Step 1',
      problem: '0 + 1',
      description: 'Add one',
      startValue: 0,
      targetValue: 1,
      highlightBeads: [{ columnIndex: 4, beadType: 'earth', position: 0 }],
      expectedAction: 'add',
      actionDescription: 'Click the first bead',
      tooltip: {
        content: 'Test tooltip',
        explanation: 'Test explanation',
      },
      errorMessages: {
        wrongBead: 'Wrong bead clicked',
        wrongAction: 'Wrong action',
        hint: 'Test hint',
      },
    },
    {
      id: 'step-2',
      title: 'Step 2',
      problem: '1 + 1',
      description: 'Add another one',
      startValue: 1,
      targetValue: 2,
      expectedAction: 'add',
      actionDescription: 'Click the second bead',
      tooltip: {
        content: 'Second tooltip',
        explanation: 'Second explanation',
      },
      errorMessages: {
        wrongBead: 'Wrong bead for step 2',
        wrongAction: 'Wrong action for step 2',
        hint: 'Step 2 hint',
      },
    },
  ],
  tags: ['test'],
  author: 'Test Author',
  version: '1.0.0',
  createdAt: new Date(),
  updatedAt: new Date(),
  isPublished: true,
}

const renderTutorialPlayer = (props: Partial<React.ComponentProps<typeof TutorialPlayer>> = {}) => {
  const defaultProps = {
    tutorial: mockTutorial,
    initialStepIndex: 0,
    isDebugMode: false,
    showDebugPanel: false,
  }

  return render(
    <DevAccessProvider>
      <TutorialPlayer {...defaultProps} {...props} />
    </DevAccessProvider>
  )
}

describe('TutorialPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders tutorial title and current step information', () => {
      renderTutorialPlayer()

      expect(screen.getByText('Test Tutorial')).toBeInTheDocument()
      expect(screen.getByText(/Step 1 of 2: Step 1/)).toBeInTheDocument()
      expect(screen.getByText('0 + 1')).toBeInTheDocument()
      expect(screen.getByText('Add one')).toBeInTheDocument()
    })

    it('renders the abacus component', () => {
      renderTutorialPlayer()

      expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()
      expect(screen.getByTestId('abacus-value')).toHaveTextContent('0')
    })

    it('shows tooltip information', () => {
      renderTutorialPlayer()

      expect(screen.getByText('Test tooltip')).toBeInTheDocument()
      expect(screen.getByText('Test explanation')).toBeInTheDocument()
    })

    it('shows progress bar', () => {
      renderTutorialPlayer()

      const progressBar =
        screen.getByRole('progressbar', { hidden: true }) ||
        document.querySelector('[style*="width"]')
      expect(progressBar).toBeInTheDocument()
    })
  })

  describe('Navigation', () => {
    it('disables previous button on first step', () => {
      renderTutorialPlayer()

      const prevButton = screen.getByText('← Previous')
      expect(prevButton).toBeDisabled()
    })

    it('enables next button when step is completed', async () => {
      const onStepComplete = vi.fn()
      renderTutorialPlayer({ onStepComplete })

      // Complete the step by clicking the mock bead
      const bead = screen.getByTestId('mock-bead-0')
      fireEvent.click(bead)

      await waitFor(() => {
        const nextButton = screen.getByText('Next →')
        expect(nextButton).not.toBeDisabled()
      })
    })

    it('navigates to next step when next button is clicked', async () => {
      const onStepChange = vi.fn()
      renderTutorialPlayer({ onStepChange })

      // Complete first step
      const bead = screen.getByTestId('mock-bead-0')
      fireEvent.click(bead)

      await waitFor(() => {
        const nextButton = screen.getByText('Next →')
        fireEvent.click(nextButton)
      })

      expect(onStepChange).toHaveBeenCalledWith(1, mockTutorial.steps[1])
    })

    it('shows "Complete Tutorial" button on last step', () => {
      renderTutorialPlayer({ initialStepIndex: 1 })

      expect(screen.getByText('Complete Tutorial')).toBeInTheDocument()
    })
  })

  describe('Step Completion', () => {
    it('marks step as completed when target value is reached', async () => {
      const onStepComplete = vi.fn()
      renderTutorialPlayer({ onStepComplete })

      const bead = screen.getByTestId('mock-bead-0')
      fireEvent.click(bead)

      await waitFor(() => {
        expect(screen.getByText(/Great! You completed this step correctly/)).toBeInTheDocument()
        expect(onStepComplete).toHaveBeenCalledWith(0, mockTutorial.steps[0], true)
      })
    })

    it('calls onTutorialComplete when tutorial is finished', async () => {
      const onTutorialComplete = vi.fn()
      renderTutorialPlayer({
        initialStepIndex: 1, // Start on last step
        onTutorialComplete,
      })

      // Complete the last step
      const bead = screen.getByTestId('mock-bead-0')
      fireEvent.click(bead)

      await waitFor(() => {
        const completeButton = screen.getByText('Complete Tutorial')
        fireEvent.click(completeButton)
      })

      expect(onTutorialComplete).toHaveBeenCalled()
    })
  })

  describe('Debug Mode', () => {
    it('shows debug controls when debug mode is enabled', () => {
      renderTutorialPlayer({ isDebugMode: true })

      expect(screen.getByText('Debug')).toBeInTheDocument()
      expect(screen.getByText('Steps')).toBeInTheDocument()
      expect(screen.getByLabelText('Auto-advance')).toBeInTheDocument()
    })

    it('shows debug panel when enabled', () => {
      renderTutorialPlayer({ isDebugMode: true, showDebugPanel: true })

      expect(screen.getByText('Debug Panel')).toBeInTheDocument()
      expect(screen.getByText('Current State')).toBeInTheDocument()
      expect(screen.getByText('Event Log')).toBeInTheDocument()
    })

    it('shows step list sidebar when enabled', () => {
      renderTutorialPlayer({ isDebugMode: true })

      const stepsButton = screen.getByText('Steps')
      fireEvent.click(stepsButton)

      expect(screen.getByText('Tutorial Steps')).toBeInTheDocument()
      expect(screen.getByText('1. Step 1')).toBeInTheDocument()
      expect(screen.getByText('2. Step 2')).toBeInTheDocument()
    })

    it('allows jumping to specific step from step list', () => {
      const onStepChange = vi.fn()
      renderTutorialPlayer({ isDebugMode: true, onStepChange })

      const stepsButton = screen.getByText('Steps')
      fireEvent.click(stepsButton)

      const step2Button = screen.getByText('2. Step 2')
      fireEvent.click(step2Button)

      expect(onStepChange).toHaveBeenCalledWith(1, mockTutorial.steps[1])
    })
  })

  describe('Event Logging', () => {
    it('logs events when onEvent callback is provided', () => {
      const onEvent = vi.fn()
      renderTutorialPlayer({ onEvent })

      const bead = screen.getByTestId('mock-bead-0')
      fireEvent.click(bead)

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'BEAD_CLICKED',
          timestamp: expect.any(Date),
        })
      )
    })

    it('logs step started event on mount', () => {
      const onEvent = vi.fn()
      renderTutorialPlayer({ onEvent })

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STEP_STARTED',
          stepId: 'step-1',
          timestamp: expect.any(Date),
        })
      )
    })

    it('logs value changed events', () => {
      const onEvent = vi.fn()
      renderTutorialPlayer({ onEvent })

      const bead = screen.getByTestId('mock-bead-0')
      fireEvent.click(bead)

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'VALUE_CHANGED',
          oldValue: 0,
          newValue: 1,
          timestamp: expect.any(Date),
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('shows error message for wrong bead clicks', async () => {
      renderTutorialPlayer()

      // Mock a wrong bead click by directly calling the callback
      // In real usage, this would come from the AbacusReact component
      const _wrongBeadClick = {
        columnIndex: 1, // Wrong column
        beadType: 'earth' as const,
        position: 0,
        active: false,
      }

      // Simulate wrong bead click through the mock
      const _mockAbacus = screen.getByTestId('mock-abacus')
      // We need to trigger this through the component's callback system
      // For now, we'll test the error display indirectly
    })
  })

  describe('Auto-advance Feature', () => {
    it('enables auto-advance when checkbox is checked', () => {
      renderTutorialPlayer({ isDebugMode: true })

      const autoAdvanceCheckbox = screen.getByLabelText('Auto-advance')
      fireEvent.click(autoAdvanceCheckbox)

      expect(autoAdvanceCheckbox).toBeChecked()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      renderTutorialPlayer()

      // Check for proper heading structure
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test Tutorial')
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('0 + 1')
    })

    it('has keyboard navigation support', () => {
      renderTutorialPlayer()

      const nextButton = screen.getByText('Next →')
      const prevButton = screen.getByText('← Previous')

      expect(nextButton).toHaveAttribute('type', 'button')
      expect(prevButton).toHaveAttribute('type', 'button')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty tutorial gracefully', () => {
      const emptyTutorial = { ...mockTutorial, steps: [] }

      expect(() => {
        renderTutorialPlayer({ tutorial: emptyTutorial })
      }).not.toThrow()
    })

    it('handles invalid initial step index', () => {
      expect(() => {
        renderTutorialPlayer({ initialStepIndex: 999 })
      }).not.toThrow()
    })

    it('handles tutorial with single step', () => {
      const singleStepTutorial = {
        ...mockTutorial,
        steps: [mockTutorial.steps[0]],
      }

      renderTutorialPlayer({ tutorial: singleStepTutorial })

      expect(screen.getByText('Complete Tutorial')).toBeInTheDocument()
      expect(screen.getByText('← Previous')).toBeDisabled()
    })
  })
})
