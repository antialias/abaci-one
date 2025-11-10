import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Tutorial } from '../../../types/tutorial'
import { TutorialPlayer } from '../TutorialPlayer'

// Mock AbacusReact to capture the customStyles prop
vi.mock('@soroban/abacus-react', () => ({
  AbacusReact: vi.fn(({ customStyles }) => {
    // Store the customStyles for testing
    ;(global as any).lastCustomStyles = customStyles
    return <div data-testid="mock-abacus" />
  }),
}))

describe('TutorialPlayer Highlighting', () => {
  const mockTutorial: Tutorial = {
    id: 'test-tutorial',
    title: 'Test Tutorial',
    description: 'Test tutorial for highlighting',
    category: 'Test',
    difficulty: 'beginner',
    estimatedDuration: 5,
    steps: [
      {
        id: 'step-1',
        title: 'Test Step 1',
        problem: '0 + 1',
        description: 'Add 1 to the abacus',
        startValue: 0,
        targetValue: 1,
        highlightBeads: [{ placeValue: 0, beadType: 'earth', position: 0 }],
        expectedAction: 'add',
        actionDescription: 'Click the first earth bead',
        tooltip: {
          content: 'Adding earth beads',
          explanation: 'Earth beads are worth 1 each',
        },
        errorMessages: {
          wrongBead: 'Click the highlighted earth bead',
          wrongAction: 'Move the bead UP',
          hint: 'Earth beads move up when adding',
        },
      },
      {
        id: 'step-2',
        title: 'Multi-bead Step',
        problem: '3 + 4',
        description: 'Use complement: 4 = 5 - 1',
        startValue: 3,
        targetValue: 7,
        highlightBeads: [
          { placeValue: 0, beadType: 'heaven' },
          { placeValue: 0, beadType: 'earth', position: 0 },
        ],
        expectedAction: 'multi-step',
        actionDescription: 'Add heaven bead, then remove earth bead',
        tooltip: {
          content: 'Five Complement',
          explanation: '4 = 5 - 1',
        },
        errorMessages: {
          wrongBead: 'Follow the two-step process',
          wrongAction: 'Add heaven, then remove earth',
          hint: 'Complement thinking: 4 = 5 - 1',
        },
      },
    ],
    tags: ['test'],
    author: 'Test Author',
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date(),
    isPublished: true,
  }

  it('should highlight single bead in correct column (ones place)', () => {
    render(<TutorialPlayer tutorial={mockTutorial} />)

    const customStyles = (global as any).lastCustomStyles

    // placeValue: 0 (ones place) should map to columnIndex: 4 in customStyles
    expect(customStyles).toBeDefined()
    expect(customStyles.beads).toBeDefined()
    expect(customStyles.beads[4]).toBeDefined() // columnIndex 4 = rightmost column = ones place
    expect(customStyles.beads[4].earth).toBeDefined()
    expect(customStyles.beads[4].earth[0]).toEqual({
      fill: '#fbbf24',
      stroke: '#f59e0b',
      strokeWidth: 3,
    })
  })

  it('should highlight multiple beads in same column for complement operations', () => {
    // Advance to step 2 (multi-bead highlighting)
    render(<TutorialPlayer tutorial={mockTutorial} initialStepIndex={1} />)

    const customStyles = (global as any).lastCustomStyles

    // Both heaven and earth beads should be highlighted in ones place (columnIndex 4)
    expect(customStyles).toBeDefined()
    expect(customStyles.beads).toBeDefined()
    expect(customStyles.beads[4]).toBeDefined() // columnIndex 4 = rightmost column = ones place

    // Heaven bead should be highlighted
    expect(customStyles.beads[4].heaven).toEqual({
      fill: '#fbbf24',
      stroke: '#f59e0b',
      strokeWidth: 3,
    })

    // Earth bead position 0 should be highlighted
    expect(customStyles.beads[4].earth).toBeDefined()
    expect(customStyles.beads[4].earth[0]).toEqual({
      fill: '#fbbf24',
      stroke: '#f59e0b',
      strokeWidth: 3,
    })
  })

  it('should not highlight leftmost column when highlighting ones place', () => {
    render(<TutorialPlayer tutorial={mockTutorial} />)

    const customStyles = (global as any).lastCustomStyles

    // columnIndex 0 (leftmost) should NOT be highlighted for ones place operations
    expect(customStyles.beads[0]).toBeUndefined()
    expect(customStyles.beads[1]).toBeUndefined()
    expect(customStyles.beads[2]).toBeUndefined()
    expect(customStyles.beads[3]).toBeUndefined()

    // Only columnIndex 4 (rightmost = ones place) should be highlighted
    expect(customStyles.beads[4]).toBeDefined()
  })

  it('should convert placeValue to columnIndex correctly', () => {
    const testCases = [
      { placeValue: 0, expectedColumnIndex: 4 }, // ones place
      { placeValue: 1, expectedColumnIndex: 3 }, // tens place
      { placeValue: 2, expectedColumnIndex: 2 }, // hundreds place
      { placeValue: 3, expectedColumnIndex: 1 }, // thousands place
      { placeValue: 4, expectedColumnIndex: 0 }, // ten-thousands place
    ]

    testCases.forEach(({ placeValue, expectedColumnIndex }) => {
      const testTutorial = {
        ...mockTutorial,
        steps: [
          {
            ...mockTutorial.steps[0],
            highlightBeads: [{ placeValue, beadType: 'earth' as const, position: 0 }],
          },
        ],
      }

      render(<TutorialPlayer tutorial={testTutorial} />)

      const customStyles = (global as any).lastCustomStyles
      expect(customStyles.beads[expectedColumnIndex]).toBeDefined()

      // Cleanup for next iteration
      delete (global as any).lastCustomStyles
    })
  })
})
