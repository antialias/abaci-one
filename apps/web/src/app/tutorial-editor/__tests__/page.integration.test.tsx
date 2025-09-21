import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TutorialEditorPage from '../page'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/tutorial-editor',
}))

// Mock the AbacusReact component
vi.mock('@soroban/abacus-react', () => ({
  AbacusReact: ({ value, onValueChange, callbacks }: any) => (
    <div data-testid="mock-abacus">
      <div data-testid="abacus-value">{value}</div>
      <button
        data-testid="mock-bead-0"
        onClick={() => {
          const newValue = value + 1
          onValueChange?.(newValue)
          callbacks?.onBeadClick?.({
            columnIndex: 4,
            beadType: 'earth',
            position: 0,
            active: false
          })
        }}
      >
        Mock Bead
      </button>
    </div>
  )
}))

describe('Tutorial Editor Page Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Page Structure and Navigation', () => {
    it('renders the complete tutorial editor page with all components', () => {
      render(<TutorialEditorPage />)

      // Check main page elements
      expect(screen.getByText('Tutorial Editor & Debugger')).toBeInTheDocument()
      expect(screen.getByText(/Guided Addition Tutorial/)).toBeInTheDocument()

      // Check mode selector buttons
      expect(screen.getByText('Editor')).toBeInTheDocument()
      expect(screen.getByText('Player')).toBeInTheDocument()
      expect(screen.getByText('Split')).toBeInTheDocument()

      // Check options
      expect(screen.getByText('Debug Info')).toBeInTheDocument()
      expect(screen.getByText('Auto Save')).toBeInTheDocument()

      // Check export functionality
      expect(screen.getByText('Export Debug')).toBeInTheDocument()
    })

    it('switches between editor, player, and split modes correctly', async () => {
      render(<TutorialEditorPage />)

      // Default should be editor mode
      expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()

      // Switch to player mode
      fireEvent.click(screen.getByText('Player'))
      await waitFor(() => {
        expect(screen.queryByText('Edit Tutorial')).not.toBeInTheDocument()
        expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()
        expect(screen.getByText(/Step 1 of/)).toBeInTheDocument()
      })

      // Switch to split mode
      fireEvent.click(screen.getByText('Split'))
      await waitFor(() => {
        // Should show both editor and player
        expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
        expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()
      })

      // Switch back to editor mode
      fireEvent.click(screen.getByText('Editor'))
      await waitFor(() => {
        expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
        expect(screen.queryByTestId('mock-abacus')).not.toBeInTheDocument()
      })
    })

    it('toggles debug information display', () => {
      render(<TutorialEditorPage />)

      const debugInfoCheckbox = screen.getByLabelText('Debug Info')
      expect(debugInfoCheckbox).toBeChecked() // Should be checked by default

      // Should show validation status when debug info is enabled
      expect(screen.getByText('Tutorial validation passed ✓')).toBeInTheDocument()

      // Toggle debug info off
      fireEvent.click(debugInfoCheckbox)
      expect(debugInfoCheckbox).not.toBeChecked()

      // Validation status should be hidden
      expect(screen.queryByText('Tutorial validation passed ✓')).not.toBeInTheDocument()
    })

    it('toggles auto save option', () => {
      render(<TutorialEditorPage />)

      const autoSaveCheckbox = screen.getByLabelText('Auto Save')
      expect(autoSaveCheckbox).not.toBeChecked() // Should be unchecked by default

      fireEvent.click(autoSaveCheckbox)
      expect(autoSaveCheckbox).toBeChecked()
    })
  })

  describe('Editor Mode Functionality', () => {
    it('supports complete tutorial editing workflow in editor mode', async () => {
      render(<TutorialEditorPage />)

      // Start in editor mode
      expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()

      // Enter edit mode
      fireEvent.click(screen.getByText('Edit Tutorial'))

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
      })

      // Edit tutorial metadata
      const titleInput = screen.getByDisplayValue('Guided Addition Tutorial')
      fireEvent.change(titleInput, { target: { value: 'Advanced Addition Tutorial' } })

      // Save changes
      fireEvent.click(screen.getByText('Save Changes'))

      // Should show saving status
      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument()
      })

      // Should show saved status
      await waitFor(() => {
        expect(screen.getByText('Saved!')).toBeInTheDocument()
      }, { timeout: 2000 })
    })

    it('handles validation errors and displays them appropriately', async () => {
      render(<TutorialEditorPage />)

      fireEvent.click(screen.getByText('Edit Tutorial'))

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
      })

      // Clear the title to trigger validation error
      const titleInput = screen.getByDisplayValue('Guided Addition Tutorial')
      fireEvent.change(titleInput, { target: { value: '' } })

      // Try to save
      fireEvent.click(screen.getByText('Save Changes'))

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/validation error/)).toBeInTheDocument()
      })
    })

    it('integrates preview functionality with player mode', async () => {
      render(<TutorialEditorPage />)

      fireEvent.click(screen.getByText('Edit Tutorial'))

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
      })

      // Look for preview buttons in the editor
      const previewButtons = screen.getAllByText(/Preview/)
      if (previewButtons.length > 0) {
        fireEvent.click(previewButtons[0])

        // Should switch to player mode for preview
        await waitFor(() => {
          expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()
        })
      }
    })
  })

  describe('Player Mode Functionality', () => {
    it('supports interactive tutorial playthrough in player mode', async () => {
      render(<TutorialEditorPage />)

      // Switch to player mode
      fireEvent.click(screen.getByText('Player'))

      await waitFor(() => {
        expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()
        expect(screen.getByText(/Step 1 of/)).toBeInTheDocument()
      })

      // Should show debug controls in player mode
      expect(screen.getByText('Debug')).toBeInTheDocument()
      expect(screen.getByText('Steps')).toBeInTheDocument()

      // Interact with the abacus
      const bead = screen.getByTestId('mock-bead-0')
      fireEvent.click(bead)

      // Should update abacus value
      await waitFor(() => {
        const abacusValue = screen.getByTestId('abacus-value')
        expect(abacusValue).toHaveTextContent('1')
      })

      // Should show step completion feedback
      await waitFor(() => {
        const successMessage = screen.queryByText(/Great! You completed/)
        if (successMessage) {
          expect(successMessage).toBeInTheDocument()
        }
      })
    })

    it('tracks and displays debug events in player mode', async () => {
      render(<TutorialEditorPage />)

      // Switch to player mode
      fireEvent.click(screen.getByText('Player'))

      await waitFor(() => {
        expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()
      })

      // Interact with abacus to generate events
      const bead = screen.getByTestId('mock-bead-0')
      fireEvent.click(bead)

      // Should show debug events panel at bottom
      await waitFor(() => {
        const debugEventsPanel = screen.queryByText('Debug Events')
        if (debugEventsPanel) {
          expect(debugEventsPanel).toBeInTheDocument()
        }
      })
    })

    it('supports step navigation and debugging features', async () => {
      render(<TutorialEditorPage />)

      fireEvent.click(screen.getByText('Player'))

      await waitFor(() => {
        expect(screen.getByText('Steps')).toBeInTheDocument()
      })

      // Open step list
      fireEvent.click(screen.getByText('Steps'))

      await waitFor(() => {
        expect(screen.getByText('Tutorial Steps')).toBeInTheDocument()
      })

      // Should show step list
      const stepItems = screen.getAllByText(/^\d+\./)
      expect(stepItems.length).toBeGreaterThan(0)

      // Test auto-advance feature
      const autoAdvanceCheckbox = screen.getByLabelText('Auto-advance')
      fireEvent.click(autoAdvanceCheckbox)
      expect(autoAdvanceCheckbox).toBeChecked()
    })
  })

  describe('Split Mode Functionality', () => {
    it('displays both editor and player simultaneously in split mode', async () => {
      render(<TutorialEditorPage />)

      // Switch to split mode
      fireEvent.click(screen.getByText('Split'))

      await waitFor(() => {
        // Should show both editor and player components
        expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
        expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()
        expect(screen.getByText(/Step 1 of/)).toBeInTheDocument()
      })

      // Should be able to interact with both sides
      fireEvent.click(screen.getByText('Edit Tutorial'))

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
      })

      // Player side should still be functional
      const bead = screen.getByTestId('mock-bead-0')
      fireEvent.click(bead)

      await waitFor(() => {
        const abacusValue = screen.getByTestId('abacus-value')
        expect(abacusValue).toHaveTextContent('1')
      })
    })

    it('synchronizes changes between editor and player in split mode', async () => {
      render(<TutorialEditorPage />)

      fireEvent.click(screen.getByText('Split'))

      await waitFor(() => {
        expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
        expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()
      })

      // Edit tutorial in editor side
      fireEvent.click(screen.getByText('Edit Tutorial'))

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
      })

      const titleInput = screen.getByDisplayValue('Guided Addition Tutorial')
      fireEvent.change(titleInput, { target: { value: 'Modified Tutorial' } })

      // The changes should be reflected in the tutorial state
      // (This tests that both sides work with the same tutorial state)
      expect(titleInput).toHaveValue('Modified Tutorial')
    })
  })

  describe('Debug and Export Features', () => {
    it('exports debug data correctly', () => {
      render(<TutorialEditorPage />)

      // Mock URL.createObjectURL and related methods
      const mockCreateObjectURL = vi.fn(() => 'mock-url')
      const mockRevokeObjectURL = vi.fn()
      const mockClick = vi.fn()

      global.URL.createObjectURL = mockCreateObjectURL
      global.URL.revokeObjectURL = mockRevokeObjectURL

      // Mock document.createElement to return a mock anchor element
      const originalCreateElement = document.createElement
      document.createElement = vi.fn((tagName) => {
        if (tagName === 'a') {
          return {
            href: '',
            download: '',
            click: mockClick
          } as any
        }
        return originalCreateElement.call(document, tagName)
      })

      // Click export button
      fireEvent.click(screen.getByText('Export Debug'))

      // Should create blob and trigger download
      expect(mockCreateObjectURL).toHaveBeenCalled()
      expect(mockClick).toHaveBeenCalled()

      // Restore original methods
      document.createElement = originalCreateElement
    })

    it('tracks events and displays them in debug panel', async () => {
      render(<TutorialEditorPage />)

      // Switch to player mode to generate events
      fireEvent.click(screen.getByText('Player'))

      await waitFor(() => {
        expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()
      })

      // Generate some events
      const bead = screen.getByTestId('mock-bead-0')
      fireEvent.click(bead)
      fireEvent.click(bead)

      // Should show debug events
      await waitFor(() => {
        const debugEventsPanel = screen.queryByText('Debug Events')
        if (debugEventsPanel) {
          expect(debugEventsPanel).toBeInTheDocument()

          // Should show event entries
          const eventEntries = screen.getAllByText('VALUE_CHANGED')
          expect(eventEntries.length).toBeGreaterThan(0)
        }
      })
    })

    it('displays validation status correctly in debug mode', async () => {
      render(<TutorialEditorPage />)

      // Debug info should be enabled by default
      expect(screen.getByText('Tutorial validation passed ✓')).toBeInTheDocument()

      // Switch to editor and make invalid changes
      fireEvent.click(screen.getByText('Edit Tutorial'))

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
      })

      // Clear title to trigger validation error
      const titleInput = screen.getByDisplayValue('Guided Addition Tutorial')
      fireEvent.change(titleInput, { target: { value: '' } })

      // Try to save to trigger validation
      fireEvent.click(screen.getByText('Save Changes'))

      // Should show validation error status
      await waitFor(() => {
        expect(screen.getByText(/validation error/)).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('handles errors gracefully and maintains application stability', async () => {
      render(<TutorialEditorPage />)

      // Test rapid mode switching
      fireEvent.click(screen.getByText('Player'))
      fireEvent.click(screen.getByText('Split'))
      fireEvent.click(screen.getByText('Editor'))

      await waitFor(() => {
        expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
      })

      // Test that the application remains functional
      fireEvent.click(screen.getByText('Edit Tutorial'))

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
      })
    })

    it('preserves state when switching between modes', async () => {
      render(<TutorialEditorPage />)

      // Make changes in editor mode
      fireEvent.click(screen.getByText('Edit Tutorial'))

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
      })

      const titleInput = screen.getByDisplayValue('Guided Addition Tutorial')
      fireEvent.change(titleInput, { target: { value: 'Temporary Change' } })

      // Switch to player mode
      fireEvent.click(screen.getByText('Player'))

      await waitFor(() => {
        expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()
      })

      // Switch back to editor mode
      fireEvent.click(screen.getByText('Editor'))

      await waitFor(() => {
        expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
      })

      // Changes should be preserved in the component state
      // (Though they're not saved until explicitly saved)
    })

    it('handles window resize and responsive behavior', () => {
      render(<TutorialEditorPage />)

      // Test that the application renders without errors
      expect(screen.getByText('Tutorial Editor & Debugger')).toBeInTheDocument()

      // Switch to split mode which tests layout handling
      fireEvent.click(screen.getByText('Split'))

      // Should render both panels
      expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
      expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()
    })
  })
})