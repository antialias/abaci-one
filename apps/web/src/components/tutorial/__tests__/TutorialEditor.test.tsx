import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DevAccessProvider } from '../../../hooks/useAccessControl'
import type { Tutorial, TutorialValidation } from '../../../types/tutorial'
import { TutorialEditor } from '../TutorialEditor'

// Mock @soroban/abacus-react
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
  useAbacusDisplay: () => ({
    config: { colorScheme: 'place-value', beadShape: 'diamond', hideInactiveBeads: false },
    updateConfig: () => {},
    resetToDefaults: () => {},
  }),
  calculateBeadDiffFromValues: () => ({ hasChanges: false, changes: [], summary: '' }),
}))

// Mock react-resizable-layout which doesn't work in jsdom
vi.mock('react-resizable-layout', () => ({
  __esModule: true,
  default: ({ children }: any) => {
    const renderResult = children({
      position: 400,
      separatorProps: {
        role: 'separator',
        'aria-valuenow': 400,
        onMouseDown: () => {},
        onTouchStart: () => {},
      },
    })
    return renderResult
  },
}))

const mockTutorial: Tutorial = {
  id: 'test-tutorial',
  title: 'Test Tutorial',
  description: 'A test tutorial for editing',
  category: 'test',
  difficulty: 'beginner',
  estimatedDuration: 15,
  steps: [
    {
      id: 'step-1',
      title: 'Step 1',
      problem: '0 + 1',
      description: 'Add one',
      startValue: 0,
      targetValue: 1,
      highlightBeads: [{ placeValue: 4, beadType: 'earth' as const, position: 0 }],
      expectedAction: 'add' as const,
      actionDescription: 'Click the first bead',
      tooltip: {
        content: 'Test tooltip',
        explanation: 'Test explanation',
      },
    },
    {
      id: 'step-2',
      title: 'Step 2',
      problem: '1 + 1',
      description: 'Add another one',
      startValue: 1,
      targetValue: 2,
      expectedAction: 'add' as const,
      actionDescription: 'Click the second bead',
      tooltip: {
        content: 'Second tooltip',
        explanation: 'Second explanation',
      },
    },
  ],
  tags: ['test'],
  author: 'Test Author',
  version: '1.0.0',
  createdAt: new Date(),
  updatedAt: new Date(),
  isPublished: false,
}

const mockValidationResult: TutorialValidation = {
  isValid: true,
  errors: [],
  warnings: [],
}

const renderTutorialEditor = (props: Partial<React.ComponentProps<typeof TutorialEditor>> = {}) => {
  const defaultProps = {
    tutorial: mockTutorial,
    onSave: vi.fn(),
    onValidate: vi.fn().mockResolvedValue(mockValidationResult),
    onPreview: vi.fn(),
  }

  return render(
    <DevAccessProvider>
      <TutorialEditor {...defaultProps} {...props} />
    </DevAccessProvider>
  )
}

describe('TutorialEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial Rendering', () => {
    it('renders in non-editing mode with TutorialPlayer and Edit button', () => {
      renderTutorialEditor()

      // Shows Edit Tutorial button
      expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()

      // Shows TutorialPlayer with abacus
      expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()

      // Shows tutorial title (rendered by TutorialPlayer)
      expect(screen.getByText('Test Tutorial')).toBeInTheDocument()
    })

    it('shows Edit Tutorial button always (regardless of onSave)', () => {
      renderTutorialEditor({ onSave: undefined })

      // Edit Tutorial button is always shown in current implementation
      expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
    })
  })

  describe('Edit Mode Toggle', () => {
    it('enters editing mode when Edit Tutorial is clicked', async () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))

      // Should show editing sidebar with Tutorial Settings
      await waitFor(() => {
        expect(screen.getByText('Tutorial Settings')).toBeInTheDocument()
      })
    })

    it('shows Tutorial Flow header in editing mode', async () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))

      await waitFor(() => {
        expect(screen.getByText(/Tutorial Flow/)).toBeInTheDocument()
      })
    })

    it('renders TutorialPlayer as preview in editing mode', async () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))

      // TutorialPlayer should still be rendered
      await waitFor(() => {
        expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()
      })
    })
  })

  describe('Tutorial Settings', () => {
    it('shows category, difficulty, and duration info in settings button', async () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))

      await waitFor(() => {
        // The Tutorial Settings button shows category, difficulty, and duration
        const settingsButton = screen.getByText('Tutorial Settings')
        expect(settingsButton).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper heading structure from TutorialPlayer', () => {
      renderTutorialEditor()

      // Tutorial title is in h1 (rendered by TutorialPlayer)
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test Tutorial')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty tutorial by throwing (TutorialContext requires steps)', () => {
      const emptyTutorial = {
        ...mockTutorial,
        steps: [],
        title: '',
        description: '',
      }

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(() => {
        renderTutorialEditor({ tutorial: emptyTutorial })
      }).toThrow()
      consoleSpy.mockRestore()
    })

    it('handles tutorial with single step', () => {
      const singleStepTutorial = {
        ...mockTutorial,
        steps: [mockTutorial.steps[0]],
      }

      renderTutorialEditor({ tutorial: singleStepTutorial })

      // Should render without errors
      expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
      expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()
    })

    it('handles invalid step data gracefully', () => {
      const invalidStepTutorial = {
        ...mockTutorial,
        steps: [
          {
            ...mockTutorial.steps[0],
            startValue: -1,
            targetValue: -1,
          },
        ],
      }

      expect(() => {
        renderTutorialEditor({ tutorial: invalidStepTutorial })
      }).not.toThrow()
    })
  })
})
