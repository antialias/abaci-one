import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TutorialEditor } from '../TutorialEditor'
import { DevAccessProvider } from '../../../hooks/useAccessControl'
import type { Tutorial, TutorialValidation } from '../../../types/tutorial'

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
      highlightBeads: [{ columnIndex: 4, beadType: 'earth', position: 0 }],
      expectedAction: 'add',
      actionDescription: 'Click the first bead',
      tooltip: {
        content: 'Test tooltip',
        explanation: 'Test explanation'
      },
      errorMessages: {
        wrongBead: 'Wrong bead clicked',
        wrongAction: 'Wrong action',
        hint: 'Test hint'
      }
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
        explanation: 'Second explanation'
      },
      errorMessages: {
        wrongBead: 'Wrong bead for step 2',
        wrongAction: 'Wrong action for step 2',
        hint: 'Step 2 hint'
      }
    }
  ],
  tags: ['test'],
  author: 'Test Author',
  version: '1.0.0',
  createdAt: new Date(),
  updatedAt: new Date(),
  isPublished: false
}

const mockValidationResult: TutorialValidation = {
  isValid: true,
  errors: [],
  warnings: []
}

const renderTutorialEditor = (props: Partial<React.ComponentProps<typeof TutorialEditor>> = {}) => {
  const defaultProps = {
    tutorial: mockTutorial,
    onSave: vi.fn(),
    onValidate: vi.fn().mockResolvedValue(mockValidationResult),
    onPreview: vi.fn()
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
    it('renders tutorial information in read-only mode by default', () => {
      renderTutorialEditor()

      expect(screen.getByText('Test Tutorial')).toBeInTheDocument()
      expect(screen.getByText('A test tutorial for editing')).toBeInTheDocument()
      expect(screen.getByText('test')).toBeInTheDocument()
      expect(screen.getByText('beginner')).toBeInTheDocument()
      expect(screen.getByText('15 minutes')).toBeInTheDocument()
    })

    it('shows edit tutorial button when onSave is provided', () => {
      renderTutorialEditor()

      expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
    })

    it('does not show edit button when onSave is not provided', () => {
      renderTutorialEditor({ onSave: undefined })

      expect(screen.queryByText('Edit Tutorial')).not.toBeInTheDocument()
    })

    it('displays tutorial steps in collapsed state', () => {
      renderTutorialEditor()

      expect(screen.getByText('1. Step 1')).toBeInTheDocument()
      expect(screen.getByText('2. Step 2')).toBeInTheDocument()
      expect(screen.getByText('0 + 1')).toBeInTheDocument()
      expect(screen.getByText('1 + 1')).toBeInTheDocument()
    })
  })

  describe('Edit Mode Toggle', () => {
    it('enters edit mode when edit button is clicked', () => {
      renderTutorialEditor()

      const editButton = screen.getByText('Edit Tutorial')
      fireEvent.click(editButton)

      expect(screen.getByText('Save Changes')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.queryByText('Edit Tutorial')).not.toBeInTheDocument()
    })

    it('exits edit mode when cancel button is clicked', () => {
      renderTutorialEditor()

      // Enter edit mode
      fireEvent.click(screen.getByText('Edit Tutorial'))
      expect(screen.getByText('Save Changes')).toBeInTheDocument()

      // Exit edit mode
      fireEvent.click(screen.getByText('Cancel'))
      expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
      expect(screen.queryByText('Save Changes')).not.toBeInTheDocument()
    })

    it('shows form inputs in edit mode', () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))

      // Check for tutorial metadata inputs
      expect(screen.getByDisplayValue('Test Tutorial')).toBeInTheDocument()
      expect(screen.getByDisplayValue('A test tutorial for editing')).toBeInTheDocument()
      expect(screen.getByDisplayValue('test')).toBeInTheDocument()
    })
  })

  describe('Tutorial Metadata Editing', () => {
    it('allows editing tutorial title', () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))

      const titleInput = screen.getByDisplayValue('Test Tutorial')
      fireEvent.change(titleInput, { target: { value: 'Updated Tutorial Title' } })

      expect(titleInput).toHaveValue('Updated Tutorial Title')
    })

    it('allows editing tutorial description', () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))

      const descriptionInput = screen.getByDisplayValue('A test tutorial for editing')
      fireEvent.change(descriptionInput, { target: { value: 'Updated description' } })

      expect(descriptionInput).toHaveValue('Updated description')
    })

    it('allows editing category and difficulty', () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))

      const categoryInput = screen.getByDisplayValue('test')
      const difficultySelect = screen.getByDisplayValue('beginner')

      fireEvent.change(categoryInput, { target: { value: 'advanced' } })
      fireEvent.change(difficultySelect, { target: { value: 'intermediate' } })

      expect(categoryInput).toHaveValue('advanced')
      expect(difficultySelect).toHaveValue('intermediate')
    })

    it('allows editing estimated duration', () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))

      const durationInput = screen.getByDisplayValue('15')
      fireEvent.change(durationInput, { target: { value: '20' } })

      expect(durationInput).toHaveValue('20')
    })

    it('allows editing tags', () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))

      const tagsInput = screen.getByDisplayValue('test')
      fireEvent.change(tagsInput, { target: { value: 'test, advanced, math' } })

      expect(tagsInput).toHaveValue('test, advanced, math')
    })
  })

  describe('Step Management', () => {
    it('expands step editing form when step is clicked', () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))

      const stepButton = screen.getByText('1. Step 1')
      fireEvent.click(stepButton)

      // Check for step editing inputs
      expect(screen.getByDisplayValue('Step 1')).toBeInTheDocument()
      expect(screen.getByDisplayValue('0 + 1')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Add one')).toBeInTheDocument()
    })

    it('allows editing step properties', () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))
      fireEvent.click(screen.getByText('1. Step 1'))

      const stepTitleInput = screen.getByDisplayValue('Step 1')
      const problemInput = screen.getByDisplayValue('0 + 1')
      const descriptionInput = screen.getByDisplayValue('Add one')

      fireEvent.change(stepTitleInput, { target: { value: 'Updated Step Title' } })
      fireEvent.change(problemInput, { target: { value: '2 + 2' } })
      fireEvent.change(descriptionInput, { target: { value: 'Updated description' } })

      expect(stepTitleInput).toHaveValue('Updated Step Title')
      expect(problemInput).toHaveValue('2 + 2')
      expect(descriptionInput).toHaveValue('Updated description')
    })

    it('shows add step button in edit mode', () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))

      expect(screen.getByText('+ Add Step')).toBeInTheDocument()
    })

    it('adds new step when add button is clicked', () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))

      const initialStepCount = screen.getAllByText(/^\d+\./).length
      fireEvent.click(screen.getByText('+ Add Step'))

      const newStepCount = screen.getAllByText(/^\d+\./).length
      expect(newStepCount).toBe(initialStepCount + 1)
    })

    it('shows step action buttons when step is expanded', () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))
      fireEvent.click(screen.getByText('1. Step 1'))

      expect(screen.getByText('Preview')).toBeInTheDocument()
      expect(screen.getByText('Duplicate')).toBeInTheDocument()
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    it('duplicates step when duplicate button is clicked', () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))
      fireEvent.click(screen.getByText('1. Step 1'))

      const initialStepCount = screen.getAllByText(/^\d+\./).length
      fireEvent.click(screen.getByText('Duplicate'))

      const newStepCount = screen.getAllByText(/^\d+\./).length
      expect(newStepCount).toBe(initialStepCount + 1)
    })

    it('removes step when delete button is clicked', () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))
      fireEvent.click(screen.getByText('1. Step 1'))

      const initialStepCount = screen.getAllByText(/^\d+\./).length
      fireEvent.click(screen.getByText('Delete'))

      const newStepCount = screen.getAllByText(/^\d+\./).length
      expect(newStepCount).toBe(initialStepCount - 1)
    })
  })

  describe('Preview Functionality', () => {
    it('calls onPreview when step preview button is clicked', () => {
      const onPreview = vi.fn()
      renderTutorialEditor({ onPreview })

      fireEvent.click(screen.getByText('Edit Tutorial'))
      fireEvent.click(screen.getByText('1. Step 1'))
      fireEvent.click(screen.getByText('Preview'))

      expect(onPreview).toHaveBeenCalledWith(expect.any(Object), 0)
    })

    it('calls onPreview when global preview button is clicked', () => {
      const onPreview = vi.fn()
      renderTutorialEditor({ onPreview })

      fireEvent.click(screen.getByText('Edit Tutorial'))

      const previewButtons = screen.getAllByText('Preview Tutorial')
      fireEvent.click(previewButtons[0])

      expect(onPreview).toHaveBeenCalledWith(expect.any(Object), 0)
    })
  })

  describe('Save Functionality', () => {
    it('calls onSave when save button is clicked', async () => {
      const onSave = vi.fn()
      renderTutorialEditor({ onSave })

      fireEvent.click(screen.getByText('Edit Tutorial'))

      // Make a change
      const titleInput = screen.getByDisplayValue('Test Tutorial')
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } })

      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
          title: 'Updated Title'
        }))
      })
    })

    it('calls validation before saving', async () => {
      const onValidate = vi.fn().mockResolvedValue(mockValidationResult)
      const onSave = vi.fn()
      renderTutorialEditor({ onSave, onValidate })

      fireEvent.click(screen.getByText('Edit Tutorial'))
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(onValidate).toHaveBeenCalled()
      })
    })

    it('prevents saving when validation fails', async () => {
      const onValidate = vi.fn().mockResolvedValue({
        isValid: false,
        errors: [{ stepId: '', field: 'title', message: 'Title required', severity: 'error' }],
        warnings: []
      })
      const onSave = vi.fn()
      renderTutorialEditor({ onSave, onValidate })

      fireEvent.click(screen.getByText('Edit Tutorial'))
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(onValidate).toHaveBeenCalled()
        expect(onSave).not.toHaveBeenCalled()
      })
    })
  })

  describe('Validation Display', () => {
    it('shows validation errors when validation fails', async () => {
      const onValidate = vi.fn().mockResolvedValue({
        isValid: false,
        errors: [{ stepId: '', field: 'title', message: 'Title is required', severity: 'error' }],
        warnings: []
      })
      renderTutorialEditor({ onValidate })

      fireEvent.click(screen.getByText('Edit Tutorial'))
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument()
      })
    })

    it('shows validation warnings', async () => {
      const onValidate = vi.fn().mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [{ stepId: '', field: 'description', message: 'Description could be longer', severity: 'warning' }]
      })
      renderTutorialEditor({ onValidate })

      fireEvent.click(screen.getByText('Edit Tutorial'))
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(screen.getByText('Description could be longer')).toBeInTheDocument()
      })
    })

    it('displays step-specific validation errors', async () => {
      const onValidate = vi.fn().mockResolvedValue({
        isValid: false,
        errors: [{ stepId: 'step-1', field: 'problem', message: 'Problem is required', severity: 'error' }],
        warnings: []
      })
      renderTutorialEditor({ onValidate })

      fireEvent.click(screen.getByText('Edit Tutorial'))
      fireEvent.click(screen.getByText('1. Step 1'))
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(screen.getByText('Problem is required')).toBeInTheDocument()
      })
    })
  })

  describe('Step Reordering', () => {
    it('shows move up/down buttons for steps', () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))
      fireEvent.click(screen.getByText('1. Step 1'))

      // Step 1 should have move down button but no move up
      expect(screen.getByLabelText(/Move.*down/i)).toBeInTheDocument()
      expect(screen.queryByLabelText(/Move.*up/i)).not.toBeInTheDocument()
    })

    it('enables both move buttons for middle steps', () => {
      const tutorialWithMoreSteps = {
        ...mockTutorial,
        steps: [
          ...mockTutorial.steps,
          {
            id: 'step-3',
            title: 'Step 3',
            problem: '2 + 1',
            description: 'Add one more',
            startValue: 2,
            targetValue: 3,
            expectedAction: 'add',
            actionDescription: 'Click the third bead',
            tooltip: { content: 'Third tooltip', explanation: 'Third explanation' },
            errorMessages: { wrongBead: 'Wrong bead', wrongAction: 'Wrong action', hint: 'Hint' }
          }
        ]
      }

      renderTutorialEditor({ tutorial: tutorialWithMoreSteps })

      fireEvent.click(screen.getByText('Edit Tutorial'))
      fireEvent.click(screen.getByText('2. Step 2'))

      // Middle step should have both buttons
      expect(screen.getByLabelText(/Move.*up/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Move.*down/i)).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes for form controls', () => {
      renderTutorialEditor()

      fireEvent.click(screen.getByText('Edit Tutorial'))

      const titleInput = screen.getByDisplayValue('Test Tutorial')
      expect(titleInput).toHaveAttribute('aria-label')
    })

    it('has proper heading structure', () => {
      renderTutorialEditor()

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test Tutorial')
    })

    it('has proper button roles and labels', () => {
      renderTutorialEditor()

      const editButton = screen.getByText('Edit Tutorial')
      expect(editButton).toHaveAttribute('type', 'button')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty tutorial gracefully', () => {
      const emptyTutorial = { ...mockTutorial, steps: [], title: '', description: '' }

      expect(() => {
        renderTutorialEditor({ tutorial: emptyTutorial })
      }).not.toThrow()
    })

    it('handles tutorial with single step', () => {
      const singleStepTutorial = { ...mockTutorial, steps: [mockTutorial.steps[0]] }

      renderTutorialEditor({ tutorial: singleStepTutorial })
      fireEvent.click(screen.getByText('Edit Tutorial'))

      expect(screen.getByText('1. Step 1')).toBeInTheDocument()
      expect(screen.queryByText('2.')).not.toBeInTheDocument()
    })

    it('handles invalid step data gracefully', () => {
      const invalidStepTutorial = {
        ...mockTutorial,
        steps: [{
          ...mockTutorial.steps[0],
          startValue: -1,
          targetValue: -1
        }]
      }

      expect(() => {
        renderTutorialEditor({ tutorial: invalidStepTutorial })
      }).not.toThrow()
    })

    it('prevents deleting the last step', () => {
      const singleStepTutorial = { ...mockTutorial, steps: [mockTutorial.steps[0]] }

      renderTutorialEditor({ tutorial: singleStepTutorial })
      fireEvent.click(screen.getByText('Edit Tutorial'))
      fireEvent.click(screen.getByText('1. Step 1'))

      const deleteButton = screen.getByText('Delete')
      expect(deleteButton).toBeDisabled()
    })
  })

  describe('Read-only Mode', () => {
    it('does not show edit controls when onSave is not provided', () => {
      renderTutorialEditor({ onSave: undefined })

      expect(screen.queryByText('Edit Tutorial')).not.toBeInTheDocument()
      expect(screen.getByText('Test Tutorial')).toBeInTheDocument()
      expect(screen.getByText('1. Step 1')).toBeInTheDocument()
    })

    it('allows clicking steps in read-only mode for viewing', () => {
      renderTutorialEditor({ onSave: undefined })

      fireEvent.click(screen.getByText('1. Step 1'))

      // Should show step details but no edit controls
      expect(screen.getByText('0 + 1')).toBeInTheDocument()
      expect(screen.queryByDisplayValue('Step 1')).not.toBeInTheDocument()
    })
  })
})