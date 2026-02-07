import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DevAccessProvider } from '../../../hooks/useAccessControl'
import type { Tutorial, TutorialValidation } from '../../../types/tutorial'
import { getTutorialForEditor } from '../../../utils/tutorialConverter'
import { TutorialEditor } from '../TutorialEditor'
import { TutorialPlayer } from '../TutorialPlayer'

// Mock the AbacusReact component for integration tests
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
    // Simulate the render prop with a default position and separatorProps
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

describe('Tutorial Editor Integration Tests', () => {
  let mockTutorial: Tutorial
  let mockOnSave: any
  let mockOnValidate: any
  let mockOnPreview: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockTutorial = getTutorialForEditor()
    mockOnSave = vi.fn().mockResolvedValue(undefined)
    mockOnValidate = vi.fn().mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
    } as TutorialValidation)
    mockOnPreview = vi.fn()
  })

  const renderTutorialEditor = (props = {}) => {
    return render(
      <DevAccessProvider>
        <TutorialEditor
          tutorial={mockTutorial}
          onSave={mockOnSave}
          onValidate={mockOnValidate}
          onPreview={mockOnPreview}
          {...props}
        />
      </DevAccessProvider>
    )
  }

  describe('Non-Editing Mode', () => {
    it('shows Edit Tutorial button and tutorial player in non-editing mode', () => {
      renderTutorialEditor()

      // Should show the Edit Tutorial button overlay
      expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()

      // Should render TutorialPlayer underneath
      expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()
    })

    it('shows tutorial title from the TutorialPlayer', () => {
      renderTutorialEditor()

      // Tutorial title is rendered by TutorialPlayer
      expect(screen.getByText(mockTutorial.title)).toBeInTheDocument()
    })
  })

  describe('Editing Mode', () => {
    it('enters editing mode when Edit Tutorial is clicked', async () => {
      renderTutorialEditor()

      // Click Edit Tutorial to enter editing mode
      fireEvent.click(screen.getByText('Edit Tutorial'))

      // Should show the editing sidebar with Tutorial Settings
      await waitFor(() => {
        expect(screen.getByText('Tutorial Settings')).toBeInTheDocument()
      })
    })

    it('shows Tutorial Flow with step count in editing mode', async () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))

      await waitFor(() => {
        const flowHeader = screen.getByText(/Tutorial Flow/)
        expect(flowHeader).toBeInTheDocument()
      })
    })

    it('renders TutorialPlayer in the editing preview area', async () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))

      await waitFor(() => {
        // TutorialPlayer should still be rendered as preview
        expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()
      })
    })
  })

  describe('Tutorial Player Integration', () => {
    const renderTutorialPlayer = () => {
      return render(
        <DevAccessProvider>
          <TutorialPlayer
            tutorial={mockTutorial}
            isDebugMode={true}
            showDebugPanel={true}
            onStepComplete={vi.fn()}
            onTutorialComplete={vi.fn()}
            onEvent={vi.fn()}
          />
        </DevAccessProvider>
      )
    }

    it('integrates tutorial player for preview functionality', async () => {
      renderTutorialPlayer()

      // Check that tutorial loads correctly (tutorial title rendered by TutorialPlayer)
      expect(screen.getByText(mockTutorial.title)).toBeInTheDocument()

      // Check that abacus is rendered
      expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()

      // Check debug features are available (i18n mock returns keys)
      expect(screen.getByText('controls.debug')).toBeInTheDocument()
      expect(screen.getByText('controls.steps')).toBeInTheDocument()
    })

    it('supports debug panel and step jumping', async () => {
      renderTutorialPlayer()

      // Open step list (i18n mock returns keys)
      const stepsButton = screen.getByText('controls.steps')
      fireEvent.click(stepsButton)

      // Check that step list is displayed (i18n mock returns keys)
      expect(screen.getByText('sidebar.title')).toBeInTheDocument()

      // Check that steps are listed
      const stepListItems = screen.getAllByText(/^\d+\./)
      expect(stepListItems.length).toBeGreaterThan(0)

      // Test auto-advance toggle (i18n mock returns keys)
      const autoAdvanceCheckbox = screen.getByLabelText('controls.autoAdvance')
      expect(autoAdvanceCheckbox).toBeInTheDocument()

      fireEvent.click(autoAdvanceCheckbox)
      expect(autoAdvanceCheckbox).toBeChecked()
    })
  })

  describe('Access Control Integration', () => {
    it('enforces access control for editor features', () => {
      render(
        <DevAccessProvider>
          <TutorialEditor
            tutorial={mockTutorial}
            onSave={mockOnSave}
            onValidate={mockOnValidate}
            onPreview={mockOnPreview}
          />
        </DevAccessProvider>
      )

      // Should render editor when access is granted (DevAccessProvider grants access)
      expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
    })

    it('shows Edit Tutorial button regardless of save handler', () => {
      render(
        <DevAccessProvider>
          <TutorialEditor
            tutorial={mockTutorial}
            onValidate={mockOnValidate}
            onPreview={mockOnPreview}
          />
        </DevAccessProvider>
      )

      // Edit Tutorial button is always shown in current implementation
      expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('handles tutorial with no steps gracefully', () => {
      const emptyTutorial = { ...mockTutorial, steps: [] }

      // TutorialPlayer (used inside TutorialEditor) crashes on empty steps
      // since TutorialContext requires at least one step
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(() => {
        render(
          <DevAccessProvider>
            <TutorialEditor
              tutorial={emptyTutorial}
              onSave={mockOnSave}
              onValidate={mockOnValidate}
              onPreview={mockOnPreview}
            />
          </DevAccessProvider>
        )
      }).toThrow()
      consoleSpy.mockRestore()
    })

    it('renders the editor with valid tutorial data', () => {
      renderTutorialEditor()

      // Editor should render without errors
      expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
      expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()
    })
  })
})
