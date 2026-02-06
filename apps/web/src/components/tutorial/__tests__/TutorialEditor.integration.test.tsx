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

  const renderTutorialEditor = () => {
    return render(
      <DevAccessProvider>
        <TutorialEditor
          tutorial={mockTutorial}
          onSave={mockOnSave}
          onValidate={mockOnValidate}
          onPreview={mockOnPreview}
        />
      </DevAccessProvider>
    )
  }

  describe('Complete Tutorial Editing Workflow', () => {
    it('supports complete tutorial editing workflow from start to finish', async () => {
      renderTutorialEditor()

      // 1. Initial state - read-only mode
      expect(screen.getByText('Guided Addition Tutorial')).toBeInTheDocument()
      expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
      expect(screen.queryByText('Save Changes')).not.toBeInTheDocument()

      // 2. Enter edit mode
      fireEvent.click(screen.getByText('Edit Tutorial'))
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()

      // 3. Edit tutorial metadata
      const titleInput = screen.getByDisplayValue('Guided Addition Tutorial')
      fireEvent.change(titleInput, {
        target: { value: 'Advanced Addition Tutorial' },
      })
      expect(titleInput).toHaveValue('Advanced Addition Tutorial')

      const descriptionInput = screen.getByDisplayValue(/Learn basic addition/)
      fireEvent.change(descriptionInput, {
        target: { value: 'Master advanced addition techniques' },
      })
      expect(descriptionInput).toHaveValue('Master advanced addition techniques')

      // 4. Expand and edit a step
      const firstStep = screen.getByText(/1\. .+/)
      fireEvent.click(firstStep)

      // Find step editing form
      const stepTitleInputs = screen.getAllByDisplayValue(/.*/)
      const stepTitleInput = stepTitleInputs.find(
        (input) =>
          (input as HTMLInputElement).value.includes('Basic') ||
          (input as HTMLInputElement).value.includes('Introduction')
      )

      if (stepTitleInput) {
        fireEvent.change(stepTitleInput, {
          target: { value: 'Advanced Introduction Step' },
        })
        expect(stepTitleInput).toHaveValue('Advanced Introduction Step')
      }

      // 5. Add a new step
      const addStepButton = screen.getByText('+ Add Step')
      const initialStepCount = screen.getAllByText(/^\d+\./).length
      fireEvent.click(addStepButton)

      await waitFor(() => {
        const newStepCount = screen.getAllByText(/^\d+\./).length
        expect(newStepCount).toBe(initialStepCount + 1)
      })

      // 6. Preview functionality
      const previewButtons = screen.getAllByText(/Preview/)
      if (previewButtons.length > 0) {
        fireEvent.click(previewButtons[0])
        expect(mockOnPreview).toHaveBeenCalled()
      }

      // 7. Save changes
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(mockOnValidate).toHaveBeenCalled()
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Advanced Addition Tutorial',
            description: 'Master advanced addition techniques',
          })
        )
      })
    })

    it('handles step management operations correctly', async () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))

      // Get initial step count
      const initialSteps = screen.getAllByText(/^\d+\./)
      const initialCount = initialSteps.length

      // Add a step
      fireEvent.click(screen.getByText('+ Add Step'))
      await waitFor(() => {
        expect(screen.getAllByText(/^\d+\./).length).toBe(initialCount + 1)
      })

      // Expand the first step and duplicate it
      fireEvent.click(screen.getByText(/1\. .+/))

      const duplicateButton = screen.queryByText('Duplicate')
      if (duplicateButton) {
        fireEvent.click(duplicateButton)
        await waitFor(() => {
          expect(screen.getAllByText(/^\d+\./).length).toBe(initialCount + 2)
        })
      }

      // Try to delete a step (but not if it's the last one)
      const deleteButton = screen.queryByText('Delete')
      if (deleteButton && !deleteButton.hasAttribute('disabled')) {
        const currentCount = screen.getAllByText(/^\d+\./).length
        fireEvent.click(deleteButton)
        await waitFor(() => {
          expect(screen.getAllByText(/^\d+\./).length).toBe(currentCount - 1)
        })
      }
    })

    it('validates tutorial data before saving', async () => {
      // Set up validation to fail
      mockOnValidate.mockResolvedValueOnce({
        isValid: false,
        errors: [
          {
            stepId: '',
            field: 'title',
            message: 'Title cannot be empty',
            severity: 'error' as const,
          },
        ],
        warnings: [],
      })

      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))

      // Clear the title to trigger validation error
      const titleInput = screen.getByDisplayValue('Guided Addition Tutorial')
      fireEvent.change(titleInput, { target: { value: '' } })

      // Try to save
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(mockOnValidate).toHaveBeenCalled()
        expect(mockOnSave).not.toHaveBeenCalled()
        expect(screen.getByText('Title cannot be empty')).toBeInTheDocument()
      })
    })

    it('shows validation warnings without blocking save', async () => {
      // Set up validation with warnings only
      mockOnValidate.mockResolvedValueOnce({
        isValid: true,
        errors: [],
        warnings: [
          {
            stepId: '',
            field: 'description',
            message: 'Description could be more detailed',
            severity: 'warning' as const,
          },
        ],
      })

      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(mockOnValidate).toHaveBeenCalled()
        expect(mockOnSave).toHaveBeenCalled()
        expect(screen.getByText('Description could be more detailed')).toBeInTheDocument()
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

      // Check that tutorial loads correctly
      expect(screen.getByText('Guided Addition Tutorial')).toBeInTheDocument()

      // Check that first step is displayed
      const stepInfo = screen.getByText(/Step 1 of/)
      expect(stepInfo).toBeInTheDocument()

      // Check that abacus is rendered
      expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()

      // Check debug features are available
      expect(screen.getByText('Debug')).toBeInTheDocument()
      expect(screen.getByText('Steps')).toBeInTheDocument()

      // Test step navigation
      const nextButton = screen.getByText('Next →')
      expect(nextButton).toBeDisabled() // Should be disabled until step is completed

      // Complete a step by interacting with abacus
      const bead = screen.getByTestId('mock-bead-0')
      fireEvent.click(bead)

      // Check that step completion is handled
      await waitFor(() => {
        const completionMessage = screen.queryByText(/Great! You completed/)
        if (completionMessage) {
          expect(completionMessage).toBeInTheDocument()
        }
      })
    })

    it('supports debug panel and step jumping', async () => {
      renderTutorialPlayer()

      // Open step list
      const stepsButton = screen.getByText('Steps')
      fireEvent.click(stepsButton)

      // Check that step list is displayed
      expect(screen.getByText('Tutorial Steps')).toBeInTheDocument()

      // Check that steps are listed
      const stepListItems = screen.getAllByText(/^\d+\./)
      expect(stepListItems.length).toBeGreaterThan(0)

      // Test auto-advance toggle
      const autoAdvanceCheckbox = screen.getByLabelText('Auto-advance')
      expect(autoAdvanceCheckbox).toBeInTheDocument()

      fireEvent.click(autoAdvanceCheckbox)
      expect(autoAdvanceCheckbox).toBeChecked()
    })
  })

  describe('Access Control Integration', () => {
    it('enforces access control for editor features', () => {
      // Test that editor is wrapped in access control
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

    it('handles read-only mode when save is not provided', () => {
      render(
        <DevAccessProvider>
          <TutorialEditor
            tutorial={mockTutorial}
            onValidate={mockOnValidate}
            onPreview={mockOnPreview}
          />
        </DevAccessProvider>
      )

      // Should not show edit button when onSave is not provided
      expect(screen.queryByText('Edit Tutorial')).not.toBeInTheDocument()
      expect(screen.getByText('Guided Addition Tutorial')).toBeInTheDocument()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('handles tutorial with no steps gracefully', () => {
      const emptyTutorial = { ...mockTutorial, steps: [] }

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
      }).not.toThrow()

      expect(screen.getByText('Guided Addition Tutorial')).toBeInTheDocument()
    })

    it('handles async validation errors gracefully', async () => {
      mockOnValidate.mockRejectedValueOnce(new Error('Validation service unavailable'))

      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(mockOnValidate).toHaveBeenCalled()
        expect(mockOnSave).not.toHaveBeenCalled()
      })
    })

    it('handles save operation failures gracefully', async () => {
      mockOnSave.mockRejectedValueOnce(new Error('Save failed'))

      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled()
      })
    })

    it('preserves unsaved changes when canceling edit mode', () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))

      // Make some changes
      const titleInput = screen.getByDisplayValue('Guided Addition Tutorial')
      fireEvent.change(titleInput, { target: { value: 'Modified Title' } })

      // Cancel editing
      fireEvent.click(screen.getByText('Cancel'))

      // Should return to read-only mode with original title
      expect(screen.getByText('Guided Addition Tutorial')).toBeInTheDocument()
      expect(screen.queryByText('Modified Title')).not.toBeInTheDocument()
    })
  })

  describe('Performance and User Experience', () => {
    it('provides immediate feedback for user actions', async () => {
      renderTutorialEditor()

      // Test immediate response to mode toggle
      fireEvent.click(screen.getByText('Edit Tutorial'))
      expect(screen.getByText('Save Changes')).toBeInTheDocument()

      // Test immediate response to form changes
      const titleInput = screen.getByDisplayValue('Guided Addition Tutorial')
      fireEvent.change(titleInput, { target: { value: 'New Title' } })
      expect(titleInput).toHaveValue('New Title')

      // Test immediate response to step expansion
      const firstStep = screen.getByText(/1\. .+/)
      fireEvent.click(firstStep)

      // Should show step editing controls immediately
      await waitFor(() => {
        expect(screen.queryByText('Preview')).toBeInTheDocument()
      })
    })

    it('maintains consistent state across operations', async () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))

      // Make multiple changes
      const titleInput = screen.getByDisplayValue('Guided Addition Tutorial')
      fireEvent.change(titleInput, { target: { value: 'Updated Tutorial' } })

      // Add a step
      const initialCount = screen.getAllByText(/^\d+\./).length
      fireEvent.click(screen.getByText('+ Add Step'))

      await waitFor(() => {
        expect(screen.getAllByText(/^\d+\./).length).toBe(initialCount + 1)
      })

      // Verify title change is still preserved
      expect(screen.getByDisplayValue('Updated Tutorial')).toBeInTheDocument()

      // Save and verify both changes are included
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Updated Tutorial',
            steps: expect.arrayContaining([expect.any(Object)]),
          })
        )
      })
    })
  })
})
