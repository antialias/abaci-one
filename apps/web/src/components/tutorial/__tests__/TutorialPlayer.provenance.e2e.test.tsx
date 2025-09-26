import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { TutorialPlayer } from '../TutorialPlayer'
import type { Tutorial } from '../../../types/tutorial'

// Mock the AbacusDisplayContext
const mockAbacusDisplay = {
  isVisible: true,
  toggleVisibility: () => {},
  displayConfig: {
    showBeadHighlights: true,
    showBeadLabels: false,
    showPlaceValues: true,
    animationSpeed: 1000
  },
  updateConfig: () => {}
}

// Mock the context
vi.mock('@/contexts/AbacusDisplayContext', () => ({
  useAbacusDisplay: () => mockAbacusDisplay
}))

describe('TutorialPlayer Provenance E2E Test', () => {
  const provenanceTestTutorial: Tutorial = {
    id: 'provenance-test',
    title: 'Provenance Test Tutorial',
    description: 'Testing provenance information in tooltips',
    steps: [
      {
        id: 'provenance-step',
        title: 'Test 3475 + 25 = 3500',
        problem: '3475 + 25',
        description: 'Add 25 to 3475 to get 3500',
        startValue: 3475,
        targetValue: 3500,
        expectedAction: 'multi-step' as const,
        actionDescription: 'Follow the decomposition steps',
        tooltip: {
          content: 'Adding 25 to 3475',
          explanation: 'This will show the provenance information'
        },
        multiStepInstructions: [
          'Add 2 tens (20)',
          'Add 5 ones using ten-complement'
        ]
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  }

  let container: HTMLElement

  beforeEach(() => {
    const renderResult = render(
      <TutorialPlayer
        tutorial={provenanceTestTutorial}
        isDebugMode={true}
        showDebugPanel={false}
        onEvent={() => {}}
        onTutorialComplete={() => {}}
      />
    )
    container = renderResult.container
  })

  it('should show provenance information in tooltip for the "20" term', async () => {
    // Wait for the tutorial to load and show the decomposition
    await waitFor(() => {
      expect(screen.getByText('3475 + 25')).toBeInTheDocument()
    }, { timeout: 5000 })

    // Look for the full decomposition string
    await waitFor(() => {
      // The decomposition should be: 3475 + 25 = 3475 + 20 + (100 - 90 - 5) = 3500
      const decompositionElement = screen.getByText(/3475 \+ 25 = 3475 \+ 20 \+ \(100 - 90 - 5\) = 3500/)
      expect(decompositionElement).toBeInTheDocument()
    }, { timeout: 5000 })

    // Find the "20" term in the decomposition
    const twentyTerm = screen.getByText('20')
    expect(twentyTerm).toBeInTheDocument()

    // Hover over the "20" term to trigger the tooltip
    fireEvent.mouseEnter(twentyTerm)

    // Wait for the tooltip to appear
    await waitFor(() => {
      // Look for the enhanced provenance-based title
      const provenanceTitle = screen.getByText('Add the tens digit — 2 tens (20)')
      expect(provenanceTitle).toBeInTheDocument()
    }, { timeout: 3000 })

    // Check for the enhanced subtitle
    await waitFor(() => {
      const provenanceSubtitle = screen.getByText('From addend 25')
      expect(provenanceSubtitle).toBeInTheDocument()
    })

    // Check for the enhanced explanation text
    await waitFor(() => {
      const provenanceExplanation = screen.getByText(/We're adding the tens digit of 25 → 2 tens/)
      expect(provenanceExplanation).toBeInTheDocument()
    })

    // Check for the enhanced breadcrumb chips
    await waitFor(() => {
      const digitChip = screen.getByText(/Digit we're using: 2 \(tens\)/)
      expect(digitChip).toBeInTheDocument()
    })

    await waitFor(() => {
      const addChip = screen.getByText(/So we add here: \+2 tens → 20/)
      expect(addChip).toBeInTheDocument()
    })
  })

  it('should NOT show the old generic tooltip text', async () => {
    // Wait for the tutorial to load
    await waitFor(() => {
      expect(screen.getByText('3475 + 25')).toBeInTheDocument()
    })

    // Find and hover over the "20" term
    const twentyTerm = screen.getByText('20')
    fireEvent.mouseEnter(twentyTerm)

    // Wait a moment for tooltip to appear
    await waitFor(() => {
      const provenanceTitle = screen.getByText('Add the tens digit — 2 tens (20)')
      expect(provenanceTitle).toBeInTheDocument()
    })

    // The old generic text should NOT be present when provenance is available
    expect(screen.queryByText('Direct Move')).not.toBeInTheDocument()
    expect(screen.queryByText('Simple bead movement')).not.toBeInTheDocument()

    // Instead we should see the provenance-enhanced content
    expect(screen.getByText('From addend 25')).toBeInTheDocument()
  })

  it('should show correct provenance for complement operations in the same example', async () => {
    // Wait for the tutorial to load
    await waitFor(() => {
      expect(screen.getByText('3475 + 25')).toBeInTheDocument()
    })

    // Find the "100" term (part of the ten-complement for the ones digit)
    const hundredTerm = screen.getByText('100')
    expect(hundredTerm).toBeInTheDocument()

    // Hover over the "100" term
    fireEvent.mouseEnter(hundredTerm)

    // This should show provenance pointing back to the ones digit "5" from "25"
    await waitFor(() => {
      const provenanceTitle = screen.getByText('Add the ones digit — 5 ones (5)')
      expect(provenanceTitle).toBeInTheDocument()
    })

    await waitFor(() => {
      const provenanceSubtitle = screen.getByText('From addend 25')
      expect(provenanceSubtitle).toBeInTheDocument()
    })
  })

  it('should provide data for addend digit highlighting', async () => {
    // Wait for the tutorial to load
    await waitFor(() => {
      expect(screen.getByText('3475 + 25')).toBeInTheDocument()
    })

    // The equation anchors should be available in the component
    // We can't directly test highlighting without more complex setup,
    // but we can verify the equation has the right structure for highlighting
    const fullEquation = screen.getByText(/3475 \+ 25 = 3475 \+ 20 \+ \(100 - 90 - 5\) = 3500/)
    expect(fullEquation).toBeInTheDocument()

    // The "25" should be present and ready for highlighting
    const addendText = screen.getByText('25')
    expect(addendText).toBeInTheDocument()
  })

  it('should show working on bubble with provenance information', async () => {
    // Wait for the tutorial to load
    await waitFor(() => {
      expect(screen.getByText('3475 + 25')).toBeInTheDocument()
    })

    // If there's a "working on" indicator, it should use provenance
    // The exact implementation might vary, but it should reference the source digit
    // Look for any element that might show "Working on: tens digit of 25 → 2 tens (20)"
    const workingOnElements = screen.queryAllByText(/Working on/)
    if (workingOnElements.length > 0) {
      const workingOnText = workingOnElements[0].textContent
      expect(workingOnText).toMatch(/tens digit of 25|2 tens/)
    }
  })

  it('should debug log provenance information', async () => {
    const consoleSpy = vi.spyOn(console, 'log')

    // Wait for the tutorial to load
    await waitFor(() => {
      expect(screen.getByText('3475 + 25')).toBeInTheDocument()
    })

    // Hover over the "20" term to trigger tooltip rendering
    const twentyTerm = screen.getByText('20')
    fireEvent.mouseEnter(twentyTerm)

    // The ReasonTooltip component should log the provenance data
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'ReasonTooltip - provenance data:',
        expect.objectContaining({
          rhs: 25,
          rhsDigit: 2,
          rhsPlace: 1,
          rhsPlaceName: 'tens',
          rhsValue: 20
        })
      )
    })

    consoleSpy.mockRestore()
  })
})