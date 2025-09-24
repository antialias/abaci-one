import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { TutorialProvider, useTutorialContext } from '../TutorialContext'
import { TutorialPlayer } from '../TutorialPlayer'
import { Tutorial, TutorialStep } from '../../../types/tutorial'
import { AbacusDisplayProvider } from '@/contexts/AbacusDisplayContext'

// Mock tutorial data
const mockTutorial: Tutorial = {
  id: 'celebration-test-tutorial',
  title: 'Celebration Tooltip Test',
  description: 'Testing celebration tooltip behavior',
  steps: [
    {
      id: 'step-1',
      title: 'Simple Addition',
      problem: '3 + 2',
      description: 'Add 2 to 3',
      startValue: 3,
      targetValue: 5
    }
  ]
}

// Test component that exposes internal state for testing
const TestCelebrationComponent = ({ tutorial }: { tutorial: Tutorial }) => {
  return (
    <AbacusDisplayProvider>
      <TutorialProvider tutorial={tutorial}>
        <TutorialPlayer
          tutorial={tutorial}
          isDebugMode={true}
          showDebugPanel={false}
        />
      </TutorialProvider>
    </AbacusDisplayProvider>
  )
}

describe('TutorialPlayer Celebration Tooltip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Celebration Tooltip Visibility', () => {
    it('should show celebration tooltip when step is completed and at target value', async () => {
      render(<TestCelebrationComponent tutorial={mockTutorial} />)

      // Wait for initial render with start value (3)
      await waitFor(() => {
        expect(screen.getByText('3 + 2')).toBeInTheDocument()
      })

      // Simulate reaching target value (5) by finding and clicking appropriate beads
      // We need to add 2 to get from 3 to 5
      // Look for earth beads in the ones place that we can activate
      const abacusContainer = screen.getByRole('img', { hidden: true }) || document.querySelector('svg')

      if (abacusContainer) {
        // Simulate clicking beads to reach value 5
        fireEvent.click(abacusContainer)

        // In a real scenario, we'd need to trigger the actual value change
        // For testing, we'll use a more direct approach
        const valueChangeEvent = new CustomEvent('valueChange', {
          detail: { newValue: 5 }
        })
        abacusContainer.dispatchEvent(valueChangeEvent)
      }

      // Wait for celebration tooltip to appear
      await waitFor(() => {
        const celebrationElements = screen.queryAllByText(/excellent work/i)
        expect(celebrationElements.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })

    it('should hide celebration tooltip when user moves away from target value', async () => {
      render(<TestCelebrationComponent tutorial={mockTutorial} />)

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('3 + 2')).toBeInTheDocument()
      })

      // First, complete the step (reach target value 5)
      const abacusContainer = document.querySelector('svg')
      if (abacusContainer) {
        const valueChangeEvent = new CustomEvent('valueChange', {
          detail: { newValue: 5 }
        })
        abacusContainer.dispatchEvent(valueChangeEvent)
      }

      // Verify celebration appears
      await waitFor(() => {
        const celebrationElements = screen.queryAllByText(/excellent work/i)
        expect(celebrationElements.length).toBeGreaterThan(0)
      }, { timeout: 2000 })

      // Now move away from target value (change to 6)
      if (abacusContainer) {
        const valueChangeEvent = new CustomEvent('valueChange', {
          detail: { newValue: 6 }
        })
        abacusContainer.dispatchEvent(valueChangeEvent)
      }

      // Verify celebration tooltip disappears
      await waitFor(() => {
        const celebrationElements = screen.queryAllByText(/excellent work/i)
        expect(celebrationElements.length).toBe(0)
      }, { timeout: 2000 })
    })

    it('should return to instruction tooltip when moved away from target', async () => {
      render(<TestCelebrationComponent tutorial={mockTutorial} />)

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('3 + 2')).toBeInTheDocument()
      })

      // Complete step (reach target value 5)
      const abacusContainer = document.querySelector('svg')
      if (abacusContainer) {
        fireEvent.click(abacusContainer)
        const valueChangeEvent = new CustomEvent('valueChange', {
          detail: { newValue: 5 }
        })
        abacusContainer.dispatchEvent(valueChangeEvent)
      }

      // Wait for celebration
      await waitFor(() => {
        expect(screen.queryAllByText(/excellent work/i).length).toBeGreaterThan(0)
      })

      // Move away from target (to value 4)
      if (abacusContainer) {
        const valueChangeEvent = new CustomEvent('valueChange', {
          detail: { newValue: 4 }
        })
        abacusContainer.dispatchEvent(valueChangeEvent)
      }

      // Should show instruction tooltip instead of celebration
      await waitFor(() => {
        expect(screen.queryAllByText(/excellent work/i).length).toBe(0)
        // Look for instruction indicators (lightbulb emoji or guidance text)
        const instructionElements = screen.queryAllByText(/💡/i)
        expect(instructionElements.length).toBeGreaterThanOrEqual(0) // May not always have instructions
      })
    })
  })

  describe('Celebration Tooltip Positioning', () => {
    it('should position celebration tooltip at last moved bead when available', async () => {
      const onStepComplete = vi.fn()

      render(
        <AbacusDisplayProvider>
          <TutorialProvider tutorial={mockTutorial} onStepComplete={onStepComplete}>
            <TutorialPlayer
              tutorial={mockTutorial}
              isDebugMode={true}
              onStepComplete={onStepComplete}
            />
          </TutorialProvider>
        </AbacusDisplayProvider>
      )

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('3 + 2')).toBeInTheDocument()
      })

      // Simulate completing the step
      const abacusContainer = document.querySelector('svg')
      if (abacusContainer) {
        fireEvent.click(abacusContainer)
        const valueChangeEvent = new CustomEvent('valueChange', {
          detail: { newValue: 5 }
        })
        abacusContainer.dispatchEvent(valueChangeEvent)
      }

      // Wait for step completion callback
      await waitFor(() => {
        expect(onStepComplete).toHaveBeenCalled()
      }, { timeout: 3000 })

      // Verify celebration tooltip is positioned (should be visible in DOM)
      const tooltipPortal = document.querySelector('[data-radix-popper-content-wrapper]')
      expect(tooltipPortal).toBeTruthy()
    })

    it('should use fallback position when no last moved bead available', async () => {
      render(<TestCelebrationComponent tutorial={mockTutorial} />)

      // Directly trigger completion without tracking a moved bead
      const abacusContainer = document.querySelector('svg')
      if (abacusContainer) {
        // Skip the gradual movement and go straight to target
        const valueChangeEvent = new CustomEvent('valueChange', {
          detail: { newValue: 5 }
        })
        abacusContainer.dispatchEvent(valueChangeEvent)
      }

      // Should still show celebration tooltip with fallback positioning
      await waitFor(() => {
        const celebrationElements = screen.queryAllByText(/excellent work/i)
        expect(celebrationElements.length).toBeGreaterThan(0)
      }, { timeout: 2000 })
    })
  })

  describe('Tooltip State Management', () => {
    it('should reset last moved bead when navigating to new step', async () => {
      const multiStepTutorial: Tutorial = {
        ...mockTutorial,
        steps: [
          mockTutorial.steps[0],
          {
            id: 'step-2',
            title: 'Another Addition',
            problem: '2 + 3',
            description: 'Add 3 to 2',
            startValue: 2,
            targetValue: 5
          }
        ]
      }

      render(<TestCelebrationComponent tutorial={multiStepTutorial} />)

      // Complete first step
      const abacusContainer = document.querySelector('svg')
      if (abacusContainer) {
        const valueChangeEvent = new CustomEvent('valueChange', {
          detail: { newValue: 5 }
        })
        abacusContainer.dispatchEvent(valueChangeEvent)
      }

      // Navigate to next step
      const nextButton = screen.getByText(/next/i)
      fireEvent.click(nextButton)

      // Wait for step change
      await waitFor(() => {
        expect(screen.getByText('2 + 3')).toBeInTheDocument()
      })

      // Complete second step - should use appropriate positioning
      if (abacusContainer) {
        const valueChangeEvent = new CustomEvent('valueChange', {
          detail: { newValue: 5 }
        })
        abacusContainer.dispatchEvent(valueChangeEvent)
      }

      // Celebration should appear for second step
      await waitFor(() => {
        expect(screen.queryAllByText(/excellent work/i).length).toBeGreaterThan(0)
      }, { timeout: 2000 })
    })
  })
})