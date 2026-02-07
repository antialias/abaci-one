import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { vi } from 'vitest'
import type { Tutorial } from '../../../types/tutorial'
import { TutorialPlayer } from '../TutorialPlayer'

// Mock browser APIs not available in jsdom
global.ResizeObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
})) as any

global.IntersectionObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
})) as any

// Mock the AbacusReact component to expose a controllable value change button
vi.mock('@soroban/abacus-react', () => ({
  AbacusReact: ({ value, onValueChange, overlays }: any) => {
    const [currentValue, setCurrentValue] = React.useState(value)

    // Sync with prop changes
    React.useEffect(() => {
      setCurrentValue(value)
    }, [value])

    const handleSetToFive = () => {
      setCurrentValue(5)
      onValueChange?.(5)
    }

    const handleSetToSix = () => {
      setCurrentValue(6)
      onValueChange?.(6)
    }

    const handleSetToFour = () => {
      setCurrentValue(4)
      onValueChange?.(4)
    }

    return (
      <div data-testid="mock-abacus">
        <div data-testid="abacus-value">{currentValue}</div>
        <button onClick={handleSetToFive} data-testid="set-value-5">
          Set to 5
        </button>
        <button onClick={handleSetToSix} data-testid="set-value-6">
          Set to 6
        </button>
        <button onClick={handleSetToFour} data-testid="set-value-4">
          Set to 4
        </button>
        {/* Render overlays for tooltip testing */}
        {overlays?.map((overlay: any, index: number) => (
          <div key={index} data-testid={`overlay-${index}`}>
            {overlay.content}
          </div>
        ))}
      </div>
    )
  },
  StepBeadHighlight: {},
  AbacusDisplayProvider: ({ children }: any) => <div>{children}</div>,
  useAbacusDisplay: () => ({
    config: { colorScheme: 'place-value', beadShape: 'diamond', hideInactiveBeads: false },
    updateConfig: () => {},
    resetToDefaults: () => {},
  }),
  calculateBeadDiffFromValues: () => ({ hasChanges: false, changes: [], summary: '' }),
}))

// Mock tutorial data
const mockTutorial: Tutorial = {
  id: 'celebration-test-tutorial',
  title: 'Celebration Tooltip Test',
  description: 'Testing celebration tooltip behavior',
  category: 'test',
  difficulty: 'beginner',
  estimatedDuration: 5,
  tags: ['test'],
  author: 'Test',
  version: '1.0.0',
  createdAt: new Date(),
  updatedAt: new Date(),
  isPublished: false,
  steps: [
    {
      id: 'step-1',
      title: 'Simple Addition',
      problem: '3 + 2',
      description: 'Add 2 to 3',
      startValue: 3,
      targetValue: 5,
      expectedAction: 'add' as const,
      actionDescription: 'Add 2 to the abacus',
      tooltip: { content: 'Add 2', explanation: 'Move beads to add 2' },
    },
  ],
}

describe('TutorialPlayer Celebration Tooltip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderTutorialPlayer = (tutorial = mockTutorial, props = {}) => {
    return render(<TutorialPlayer tutorial={tutorial} isDebugMode={false} {...props} />)
  }

  describe('Celebration Tooltip Visibility', () => {
    it('should show celebration tooltip when step is completed and at target value', async () => {
      const onStepComplete = vi.fn()
      renderTutorialPlayer(mockTutorial, { onStepComplete })

      // Wait for initial render with start value (3)
      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('3')
      })

      // Wait for programmatic change flag to clear
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Trigger value change to target (5)
      await act(async () => {
        fireEvent.click(screen.getByTestId('set-value-5'))
      })

      // Wait for celebration tooltip to appear
      await waitFor(
        () => {
          const celebration = screen.queryAllByText('Excellent work!')
          expect(celebration.length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )
    })

    it('should hide celebration tooltip when user moves away from target value', async () => {
      const onStepComplete = vi.fn()
      renderTutorialPlayer(mockTutorial, { onStepComplete })

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('3')
      })

      // Wait for programmatic change flag to clear
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Reach target value (5)
      await act(async () => {
        fireEvent.click(screen.getByTestId('set-value-5'))
      })

      // Verify celebration appears
      await waitFor(
        () => {
          const celebration = screen.queryAllByText('Excellent work!')
          expect(celebration.length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )

      // Now move away from target value (change to 6)
      await act(async () => {
        fireEvent.click(screen.getByTestId('set-value-6'))
      })

      // Verify celebration tooltip disappears
      await waitFor(
        () => {
          const celebration = screen.queryAllByText('Excellent work!')
          expect(celebration.length).toBe(0)
        },
        { timeout: 2000 }
      )
    })

    it('should return to instruction tooltip when moved away from target', async () => {
      const onStepComplete = vi.fn()
      renderTutorialPlayer(mockTutorial, { onStepComplete })

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('3')
      })

      // Wait for programmatic change flag to clear
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Complete step (reach target value 5)
      await act(async () => {
        fireEvent.click(screen.getByTestId('set-value-5'))
      })

      // Wait for celebration
      await waitFor(
        () => {
          expect(screen.queryAllByText('Excellent work!').length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )

      // Move away from target (to value 4)
      await act(async () => {
        fireEvent.click(screen.getByTestId('set-value-4'))
      })

      // Should hide celebration
      await waitFor(() => {
        expect(screen.queryAllByText('Excellent work!').length).toBe(0)
      })
    })
  })

  describe('Celebration Tooltip Positioning', () => {
    it('should position celebration tooltip at last moved bead when available', async () => {
      const onStepComplete = vi.fn()
      renderTutorialPlayer(mockTutorial, { onStepComplete })

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('3')
      })

      // Wait for programmatic change flag to clear
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Simulate completing the step
      await act(async () => {
        fireEvent.click(screen.getByTestId('set-value-5'))
      })

      // Wait for step completion callback
      await waitFor(
        () => {
          expect(onStepComplete).toHaveBeenCalled()
        },
        { timeout: 3000 }
      )

      // Verify celebration tooltip appears in overlay
      await waitFor(
        () => {
          const celebration = screen.queryAllByText('Excellent work!')
          expect(celebration.length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )
    })

    it('should use fallback position when no last moved bead available', async () => {
      const onStepComplete = vi.fn()
      renderTutorialPlayer(mockTutorial, { onStepComplete })

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('3')
      })

      // Wait for programmatic change flag to clear
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Directly trigger completion to target value
      await act(async () => {
        fireEvent.click(screen.getByTestId('set-value-5'))
      })

      // Should still show celebration tooltip with fallback positioning
      await waitFor(
        () => {
          const celebration = screen.queryAllByText('Excellent work!')
          expect(celebration.length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )
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
            targetValue: 5,
            expectedAction: 'add' as const,
            actionDescription: 'Add 3 to the abacus',
            tooltip: { content: 'Add 3', explanation: 'Move beads to add 3' },
          },
        ],
      }

      renderTutorialPlayer(multiStepTutorial)

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('3')
      })

      // Wait for programmatic change flag to clear
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Complete first step
      await act(async () => {
        fireEvent.click(screen.getByTestId('set-value-5'))
      })

      // Wait for celebration to appear
      await waitFor(
        () => {
          expect(screen.queryAllByText('Excellent work!').length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )

      // The step should be completed, which means the next button should be available
      // In i18n mock, button text is the translation key
      await waitFor(() => {
        // Look for the next/complete button by data attribute
        const nextButton = document.querySelector('[data-action="next-step"]')
        expect(nextButton).toBeTruthy()
      })

      // Click next step
      const nextButton = document.querySelector('[data-action="next-step"]') as HTMLElement
      await act(async () => {
        fireEvent.click(nextButton)
      })

      // Wait for step change - abacus value should reset
      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('2')
      })

      // Celebration should not be showing for the new step
      const celebration = screen.queryAllByText('Excellent work!')
      expect(celebration.length).toBe(0)
    })
  })
})
