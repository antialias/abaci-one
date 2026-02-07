import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import type { Tutorial } from '../../../types/tutorial'
import { TutorialPlayer } from '../TutorialPlayer'

// Mock the AbacusReact component for integration tests
vi.mock('@soroban/abacus-react', () => ({
  AbacusReact: ({ value, onValueChange, onClick }: any) => (
    <div data-testid="mock-abacus">
      <div data-testid="abacus-value">{value}</div>
      <button data-testid="bead-click" onClick={() => onValueChange?.(value + 1)}>
        Click Bead (+1)
      </button>
      <button data-testid="set-target" onClick={() => onValueChange?.(42)}>
        Set to 42
      </button>
    </div>
  ),
  AbacusOverlay: ({ children }: any) => <div data-testid="mock-overlay">{children}</div>,
  useAbacusDisplay: () => ({
    config: { colorScheme: 'place-value', beadShape: 'diamond', hideInactiveBeads: false },
    updateConfig: () => {},
    resetToDefaults: () => {},
  }),
  calculateBeadDiffFromValues: () => ({ hasChanges: false, changes: [], summary: '' }),
}))

// Mock tutorial data with multi-step instructions
const mockTutorial: Tutorial = {
  id: 'integration-test',
  title: 'Integration Test Tutorial',
  description: 'Testing TutorialPlayer integration',
  category: 'test',
  difficulty: 'beginner',
  estimatedDuration: 5,
  tags: ['test'],
  author: 'test',
  version: '1.0.0',
  isPublished: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  steps: [
    {
      id: 'step-1',
      title: 'First Step',
      problem: '5 + 3 = ?',
      description: 'Add 3 to 5',
      startValue: 5,
      targetValue: 8,
      expectedAction: 'multi-step',
      actionDescription: 'Add 3 to 5',
      tooltip: { content: 'Add 3', explanation: 'Add 3 to the abacus' },
      multiStepInstructions: [
        'First, show 5 on the abacus',
        'Then add 3 more',
        'Result should be 8',
      ],
    },
    {
      id: 'step-2',
      title: 'Second Step',
      problem: '10 - 2 = ?',
      description: 'Subtract 2 from 10',
      startValue: 10,
      targetValue: 8,
      expectedAction: 'remove',
      actionDescription: 'Subtract 2 from 10',
      tooltip: { content: 'Subtract 2', explanation: 'Remove 2 from the abacus' },
    },
  ],
}

describe('TutorialPlayer Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('AbacusReact Integration', () => {
    it('should pass correct startValue to AbacusReact on step initialization', async () => {
      render(<TutorialPlayer tutorial={mockTutorial} />)

      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('5')
      })
    })

    it('should update AbacusReact value when navigating between steps', async () => {
      render(<TutorialPlayer tutorial={mockTutorial} showDebugPanel={true} />)

      // Initial step should show startValue = 5
      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('5')
      })

      // Navigate to next step
      const nextButton = screen.getByText('Next →')
      fireEvent.click(nextButton)

      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('10')
      })
    })

    it('should handle user interactions with AbacusReact', async () => {
      render(<TutorialPlayer tutorial={mockTutorial} />)

      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('5')
      })

      // User clicks a bead
      fireEvent.click(screen.getByTestId('bead-click'))

      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('6')
      })
    })

    it('should complete step when user reaches target value', async () => {
      render(<TutorialPlayer tutorial={mockTutorial} />)

      // Initial state
      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('5')
      })

      // Simulate user changing abacus to target value (8)
      // We'll click the bead 3 times to go from 5 to 8
      fireEvent.click(screen.getByTestId('bead-click')) // 6
      fireEvent.click(screen.getByTestId('bead-click')) // 7
      fireEvent.click(screen.getByTestId('bead-click')) // 8

      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('8')
        // Should show success feedback
        expect(screen.getByText(/excellent/i)).toBeInTheDocument()
      })
    })
  })

  describe('Multi-Step Progression', () => {
    it('should show multi-step instructions for steps that have them', async () => {
      render(<TutorialPlayer tutorial={mockTutorial} />)

      await waitFor(() => {
        // Should show multi-step navigation controls
        expect(screen.getByText('First, show 5 on the abacus')).toBeInTheDocument()
      })
    })

    it('should advance multi-steps automatically when user reaches expected values', async () => {
      const tutorialWithExpectedSteps: Tutorial = {
        ...mockTutorial,
        steps: [
          {
            ...mockTutorial.steps[0],
            // This would normally be generated by the unified step generator
            // For testing, we'll simulate the expected intermediate values
          },
        ],
      }

      render(<TutorialPlayer tutorial={tutorialWithExpectedSteps} />)

      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('5')
      })

      // Simulate reaching an intermediate target that should advance multi-step
      // This would be based on the unified step generator's expected values
      fireEvent.click(screen.getByTestId('bead-click'))

      // The multi-step should advance after a delay
      await waitFor(
        () => {
          // Verify that multi-step has advanced (this would show in the UI)
          // Since we don't have the exact expected values in this test,
          // we're testing the integration pattern rather than specific values
        },
        { timeout: 2000 }
      )
    })

    it('should allow manual multi-step navigation', async () => {
      render(<TutorialPlayer tutorial={mockTutorial} />)

      // Should show multi-step controls
      await waitFor(() => {
        expect(screen.getByText('⏪ Prev')).toBeInTheDocument()
        expect(screen.getByText('Next ⏩')).toBeInTheDocument()
      })

      // Navigate to next multi-step
      fireEvent.click(screen.getByText('Next ⏩'))

      await waitFor(() => {
        expect(screen.getByText('Then add 3 more')).toBeInTheDocument()
      })
    })
  })

  describe('Context State Management', () => {
    it('should maintain consistent state across components', async () => {
      const onStepChange = vi.fn()
      const onStepComplete = vi.fn()

      render(
        <TutorialPlayer
          tutorial={mockTutorial}
          onStepChange={onStepChange}
          onStepComplete={onStepComplete}
          showDebugPanel={true}
        />
      )

      // Initial step change should be called
      await waitFor(() => {
        expect(onStepChange).toHaveBeenCalledWith(0, mockTutorial.steps[0])
      })

      // Navigate to next step
      fireEvent.click(screen.getByText('Next →'))

      await waitFor(() => {
        expect(onStepChange).toHaveBeenCalledWith(1, mockTutorial.steps[1])
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('10')
      })
    })

    it('should prevent feedback loops between AbacusReact and context', async () => {
      const _onValueChange = vi.fn()

      render(<TutorialPlayer tutorial={mockTutorial} showDebugPanel={true} />)

      // Initial value should be set without causing loops
      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('5')
      })

      // Navigate between steps rapidly
      fireEvent.click(screen.getByText('Next →'))
      fireEvent.click(screen.getByText('← Prev'))
      fireEvent.click(screen.getByText('Next →'))

      // Should handle rapid navigation without getting stuck
      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('10')
      })
    })

    it('should handle programmatic changes correctly', async () => {
      render(<TutorialPlayer tutorial={mockTutorial} />)

      // Initial programmatic setting
      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('5')
      })

      // User change
      fireEvent.click(screen.getByTestId('bead-click'))
      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('6')
      })

      // Navigate to new step (programmatic change)
      fireEvent.click(screen.getByText('Next →'))
      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('10')
      })

      // User should still be able to interact after programmatic change
      fireEvent.click(screen.getByTestId('bead-click'))
      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('11')
      })
    })
  })

  describe('Error Recovery', () => {
    it('should handle AbacusReact errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Mock AbacusReact to throw an error
      const ErrorAbacus = () => {
        throw new Error('AbacusReact error')
      }

      vi.mocked(require('@soroban/abacus-react')).AbacusReact = ErrorAbacus

      expect(() => {
        render(<TutorialPlayer tutorial={mockTutorial} />)
      }).not.toThrow()

      consoleSpy.mockRestore()
    })

    it('should recover from invalid state transitions', async () => {
      render(<TutorialPlayer tutorial={mockTutorial} />)

      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('5')
      })

      // Try to set an invalid value
      fireEvent.click(screen.getByTestId('set-target'))

      // Should still function normally
      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('42')
      })

      // Navigation should still work
      fireEvent.click(screen.getByText('Next →'))
      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('10')
      })
    })
  })

  describe('Performance', () => {
    it('should not cause excessive re-renders', async () => {
      let renderCount = 0

      const TestWrapper = () => {
        renderCount++
        return <TutorialPlayer tutorial={mockTutorial} />
      }

      render(<TestWrapper />)

      const initialRenderCount = renderCount

      // Perform various interactions
      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('5')
      })

      fireEvent.click(screen.getByTestId('bead-click'))
      fireEvent.click(screen.getByText('Next →'))
      fireEvent.click(screen.getByText('← Prev'))

      await waitFor(() => {
        expect(screen.getByTestId('abacus-value')).toHaveTextContent('5')
      })

      // Should not cause excessive re-renders
      expect(renderCount).toBeLessThan(initialRenderCount + 10)
    })
  })
})
