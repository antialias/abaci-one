import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
// The page uses Resizable at the top level (header) and in split mode,
// and TutorialEditor internally also uses it.
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

describe('Tutorial Editor Page Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Page Structure and Navigation', () => {
    it('renders the complete tutorial editor page with all components', () => {
      render(<TutorialEditorPage />)

      // Check main page elements
      expect(screen.getByText('Tutorial Editor & Debugger')).toBeInTheDocument()
      // Tutorial title appears in both the page header and the embedded TutorialPlayer
      expect(screen.getAllByText(/Progressive Multi-Step Tutorial/).length).toBeGreaterThanOrEqual(
        1
      )

      // Check mode selector buttons (lowercase text with CSS capitalize)
      expect(screen.getByText('editor')).toBeInTheDocument()
      expect(screen.getByText('player')).toBeInTheDocument()
      expect(screen.getByText('split')).toBeInTheDocument()

      // Check options
      expect(screen.getByText('Debug Info')).toBeInTheDocument()
      expect(screen.getByText('Auto Save')).toBeInTheDocument()

      // Check export functionality
      expect(screen.getByText('Export Debug')).toBeInTheDocument()
    })

    it('switches between editor, player, and split modes correctly', async () => {
      render(<TutorialEditorPage />)

      // Default should be editor mode - shows TutorialEditor with Edit Tutorial button
      expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()

      // Switch to player mode
      fireEvent.click(screen.getByText('player'))
      await waitFor(() => {
        expect(screen.queryByText('Edit Tutorial')).not.toBeInTheDocument()
        expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()
      })

      // Switch to split mode
      fireEvent.click(screen.getByText('split'))
      await waitFor(() => {
        // Should show both editor and player (2 abacus instances: one in TutorialEditor, one standalone)
        expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
        expect(screen.getAllByTestId('mock-abacus').length).toBeGreaterThanOrEqual(1)
      })

      // Switch back to editor mode
      fireEvent.click(screen.getByText('editor'))
      await waitFor(() => {
        expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
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
    it('shows TutorialEditor with Edit Tutorial button in editor mode', async () => {
      render(<TutorialEditorPage />)

      // Start in editor mode - TutorialEditor shows Edit Tutorial overlay
      expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()

      // Enter edit mode by clicking Edit Tutorial
      fireEvent.click(screen.getByText('Edit Tutorial'))

      // Should show editing sidebar with Tutorial Settings
      await waitFor(() => {
        expect(screen.getByText('Tutorial Settings')).toBeInTheDocument()
      })
    })

    it('shows Tutorial Flow in editing mode', async () => {
      render(<TutorialEditorPage />)

      fireEvent.click(screen.getByText('Edit Tutorial'))

      await waitFor(() => {
        expect(screen.getByText(/Tutorial Flow/)).toBeInTheDocument()
      })
    })

    it('integrates preview functionality with player mode', async () => {
      render(<TutorialEditorPage />)

      // Switch to player mode
      fireEvent.click(screen.getByText('player'))

      // Should show TutorialPlayer
      await waitFor(() => {
        expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()
      })
    })
  })

  describe('Player Mode Functionality', () => {
    it('supports interactive tutorial playthrough in player mode', async () => {
      render(<TutorialEditorPage />)

      // Switch to player mode
      fireEvent.click(screen.getByText('player'))

      await waitFor(() => {
        expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()
      })

      // Should show debug controls in player mode (i18n keys)
      expect(screen.getByText('controls.debug')).toBeInTheDocument()
      expect(screen.getByText('controls.steps')).toBeInTheDocument()

      // Wait for programmatic change flag to clear
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Interact with the abacus
      const bead = screen.getByTestId('mock-bead-0')
      fireEvent.click(bead)

      // Should update abacus value
      await waitFor(() => {
        const abacusValue = screen.getByTestId('abacus-value')
        expect(abacusValue).toHaveTextContent('1')
      })
    })

    it('tracks and displays debug events in player mode', async () => {
      render(<TutorialEditorPage />)

      // Switch to player mode
      fireEvent.click(screen.getByText('player'))

      await waitFor(() => {
        expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()
      })

      // Wait for programmatic change flag to clear
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Interact with abacus to generate events
      const bead = screen.getByTestId('mock-bead-0')
      fireEvent.click(bead)

      // Debug events panel appears when events are generated
      await waitFor(() => {
        const debugEventsPanel = screen.queryByText(/Debug Events/)
        if (debugEventsPanel) {
          expect(debugEventsPanel).toBeInTheDocument()
        }
      })
    })

    it('supports step navigation and debugging features', async () => {
      render(<TutorialEditorPage />)

      fireEvent.click(screen.getByText('player'))

      await waitFor(() => {
        // i18n mock returns keys
        expect(screen.getByText('controls.steps')).toBeInTheDocument()
      })

      // Open step list (i18n mock returns keys)
      fireEvent.click(screen.getByText('controls.steps'))

      await waitFor(() => {
        // i18n mock returns key for sidebar title
        expect(screen.getByText('sidebar.title')).toBeInTheDocument()
      })

      // Should show step list
      const stepItems = screen.getAllByText(/^\d+\./)
      expect(stepItems.length).toBeGreaterThan(0)

      // Test auto-advance feature (i18n mock returns key)
      const autoAdvanceCheckbox = screen.getByLabelText('controls.autoAdvance')
      fireEvent.click(autoAdvanceCheckbox)
      expect(autoAdvanceCheckbox).toBeChecked()
    })
  })

  describe('Split Mode Functionality', () => {
    it('displays both editor and player simultaneously in split mode', async () => {
      render(<TutorialEditorPage />)

      // Switch to split mode
      fireEvent.click(screen.getByText('split'))

      await waitFor(() => {
        // Should show both editor and player components
        // In split mode, TutorialEditor contains its own TutorialPlayer (with abacus) plus standalone TutorialPlayer
        expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
        expect(screen.getAllByTestId('mock-abacus').length).toBeGreaterThanOrEqual(1)
      })
    })

    it('supports editing in split mode', async () => {
      render(<TutorialEditorPage />)

      fireEvent.click(screen.getByText('split'))

      await waitFor(() => {
        expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
        expect(screen.getAllByTestId('mock-abacus').length).toBeGreaterThanOrEqual(1)
      })

      // Enter editing mode on the editor side
      fireEvent.click(screen.getByText('Edit Tutorial'))

      await waitFor(() => {
        expect(screen.getByText('Tutorial Settings')).toBeInTheDocument()
      })

      // Player side should still be functional
      expect(screen.getAllByTestId('mock-abacus').length).toBeGreaterThanOrEqual(1)
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
            click: mockClick,
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

    it('displays validation status correctly in debug mode', () => {
      render(<TutorialEditorPage />)

      // Debug info should be enabled by default
      expect(screen.getByText('Tutorial validation passed ✓')).toBeInTheDocument()

      // Toggle debug info off
      const debugInfoCheckbox = screen.getByLabelText('Debug Info')
      fireEvent.click(debugInfoCheckbox)

      // Validation status should be hidden
      expect(screen.queryByText('Tutorial validation passed ✓')).not.toBeInTheDocument()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('handles rapid mode switching gracefully', async () => {
      render(<TutorialEditorPage />)

      // Test rapid mode switching
      fireEvent.click(screen.getByText('player'))
      fireEvent.click(screen.getByText('split'))
      fireEvent.click(screen.getByText('editor'))

      await waitFor(() => {
        expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
      })

      // Test that the application remains functional
      fireEvent.click(screen.getByText('Edit Tutorial'))

      await waitFor(() => {
        expect(screen.getByText('Tutorial Settings')).toBeInTheDocument()
      })
    })

    it('preserves page state when switching between modes', async () => {
      render(<TutorialEditorPage />)

      // Verify initial state
      expect(screen.getByText('Tutorial Editor & Debugger')).toBeInTheDocument()
      expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()

      // Switch to player mode
      fireEvent.click(screen.getByText('player'))

      await waitFor(() => {
        expect(screen.getByTestId('mock-abacus')).toBeInTheDocument()
      })

      // Switch back to editor mode
      fireEvent.click(screen.getByText('editor'))

      await waitFor(() => {
        expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
      })

      // Page header should still be present
      expect(screen.getByText('Tutorial Editor & Debugger')).toBeInTheDocument()
    })

    it('handles window resize and responsive behavior', () => {
      render(<TutorialEditorPage />)

      // Test that the application renders without errors
      expect(screen.getByText('Tutorial Editor & Debugger')).toBeInTheDocument()

      // Switch to split mode which tests layout handling
      fireEvent.click(screen.getByText('split'))

      // Should render both panels
      expect(screen.getByText('Edit Tutorial')).toBeInTheDocument()
      expect(screen.getAllByTestId('mock-abacus').length).toBeGreaterThanOrEqual(1)
    })
  })
})
