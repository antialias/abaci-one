import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AbacusReact } from '../AbacusReact'

describe('AbacusReact Zero State Interaction Bug', () => {
  it('should handle bead clicks correctly when starting from value 0', () => {
    const mockOnValueChange = vi.fn()
    const mockOnBeadClick = vi.fn()

    render(
      <AbacusReact
        value={0}
        columns={5}
        interactive={true}
        gestures={false}
        animated={false}
        onValueChange={mockOnValueChange}
        callbacks={{
          onBeadClick: mockOnBeadClick
        }}
      />
    )

    // Test clicking the leftmost column (index 0) heaven bead
    console.log('Testing leftmost column (visual column 0) heaven bead click...')
    const leftmostHeavenBead = screen.getByTestId('bead-col-0-heaven')
    fireEvent.click(leftmostHeavenBead)

    // Check if the callback was called with correct column index
    expect(mockOnBeadClick).toHaveBeenCalledWith(
      expect.objectContaining({
        columnIndex: 0,
        beadType: 'heaven'
      })
    )

    // The value should change to 50000 (5 in leftmost column of 5-column abacus)
    expect(mockOnValueChange).toHaveBeenCalledWith(50000)

    mockOnValueChange.mockClear()
    mockOnBeadClick.mockClear()
  })

  it('should handle middle column clicks correctly when starting from value 0', () => {
    const mockOnValueChange = vi.fn()
    const mockOnBeadClick = vi.fn()

    render(
      <AbacusReact
        value={0}
        columns={5}
        interactive={true}
        gestures={false}
        animated={false}
        onValueChange={mockOnValueChange}
        callbacks={{
          onBeadClick: mockOnBeadClick
        }}
      />
    )

    // Test clicking middle column (index 2) heaven bead
    console.log('Testing middle column (visual column 2) heaven bead click...')
    const middleHeavenBead = screen.getByTestId('bead-col-2-heaven')
    fireEvent.click(middleHeavenBead)

    // Check if the callback was called with correct column index
    expect(mockOnBeadClick).toHaveBeenCalledWith(
      expect.objectContaining({
        columnIndex: 2,
        beadType: 'heaven'
      })
    )

    // The value should change to 500 (5 in middle column)
    expect(mockOnValueChange).toHaveBeenCalledWith(500)
  })

  it('should handle rightmost column clicks correctly when starting from value 0', () => {
    const mockOnValueChange = vi.fn()
    const mockOnBeadClick = vi.fn()

    render(
      <AbacusReact
        value={0}
        columns={5}
        interactive={true}
        gestures={false}
        animated={false}
        onValueChange={mockOnValueChange}
        callbacks={{
          onBeadClick: mockOnBeadClick
        }}
      />
    )

    // Test clicking rightmost column (index 4) heaven bead
    console.log('Testing rightmost column (visual column 4) heaven bead click...')
    const rightmostHeavenBead = screen.getByTestId('bead-col-4-heaven')
    fireEvent.click(rightmostHeavenBead)

    // Check if the callback was called with correct column index
    expect(mockOnBeadClick).toHaveBeenCalledWith(
      expect.objectContaining({
        columnIndex: 4,
        beadType: 'heaven'
      })
    )

    // The value should change to 5 (5 in rightmost column)
    expect(mockOnValueChange).toHaveBeenCalledWith(5)
  })

  it('should handle earth bead clicks correctly when starting from value 0', () => {
    const mockOnValueChange = vi.fn()
    const mockOnBeadClick = vi.fn()

    render(
      <AbacusReact
        value={0}
        columns={5}
        interactive={true}
        gestures={false}
        animated={false}
        onValueChange={mockOnValueChange}
        callbacks={{
          onBeadClick: mockOnBeadClick
        }}
      />
    )

    // Earth beads start after heaven beads
    // Layout: 5 heaven beads, then 20 earth beads (4 per column)
    console.log('Testing leftmost column (visual column 0) first earth bead click...')
    const leftmostEarthBead = screen.getByTestId('bead-col-0-earth-pos-0')
    fireEvent.click(leftmostEarthBead)

    // Check if the callback was called with correct column index
    expect(mockOnBeadClick).toHaveBeenCalledWith(
      expect.objectContaining({
        columnIndex: 0,
        beadType: 'earth',
        position: 0
      })
    )

    // The value should change to 10000 (1 in leftmost column)
    expect(mockOnValueChange).toHaveBeenCalledWith(10000)
  })

  it('should handle sequential clicks across different columns', () => {
    const mockOnValueChange = vi.fn()
    let currentValue = 0

    const TestComponent = () => {
      return (
        <AbacusReact
          value={currentValue}
          columns={5}
          interactive={true}
          gestures={false}
          animated={false}
          onValueChange={(newValue) => {
            currentValue = newValue
            mockOnValueChange(newValue)
          }}
        />
      )
    }

    const { rerender } = render(<TestComponent />)

    // Click rightmost column heaven bead (should set value to 5)
    fireEvent.click(screen.getByTestId('bead-col-4-heaven'))
    rerender(<TestComponent />)
    expect(mockOnValueChange).toHaveBeenLastCalledWith(5)

    // Click middle column heaven bead (should set value to 505)
    fireEvent.click(screen.getByTestId('bead-col-2-heaven'))
    rerender(<TestComponent />)
    expect(mockOnValueChange).toHaveBeenLastCalledWith(505)

    // Click leftmost column earth bead (should set value to 10505)
    fireEvent.click(screen.getByTestId('bead-col-0-earth-pos-0'))
    rerender(<TestComponent />)
    expect(mockOnValueChange).toHaveBeenLastCalledWith(10505)

    console.log('Final value after sequential clicks:', currentValue)
    expect(currentValue).toBe(10505)
  })

  it('should debug the bead layout and column mapping', () => {
    const mockOnBeadClick = vi.fn()

    render(
      <AbacusReact
        value={0}
        columns={5}
        interactive={true}
        callbacks={{
          onBeadClick: mockOnBeadClick
        }}
      />
    )

    const beads = screen.getAllByRole('button')

    console.log(`\n=== BEAD LAYOUT DEBUG ===`)
    console.log(`Total interactive beads found: ${beads.length}`)
    console.log(`Expected: 25 beads (5 heaven + 20 earth)`)

    // Test specific beads using data-testid
    const testBeads = [
      'bead-col-0-heaven',
      'bead-col-1-heaven',
      'bead-col-2-heaven',
      'bead-col-0-earth-pos-0',
      'bead-col-0-earth-pos-1',
      'bead-col-1-earth-pos-0',
      'bead-col-2-earth-pos-0',
      'bead-col-4-heaven',
      'bead-col-4-earth-pos-3'
    ]

    testBeads.forEach((testId) => {
      try {
        const bead = screen.getByTestId(testId)
        mockOnBeadClick.mockClear()
        fireEvent.click(bead)

        if (mockOnBeadClick.mock.calls.length > 0) {
          const call = mockOnBeadClick.mock.calls[0][0]
          console.log(`${testId}: column=${call.columnIndex}, type=${call.beadType}, position=${call.position || 'N/A'}`)
        } else {
          console.log(`${testId}: No callback fired`)
        }
      } catch (error) {
        console.log(`${testId}: Element not found`)
      }
    })
  })

  it('should handle numeral entry correctly when starting from value 0', () => {
    const mockOnValueChange = vi.fn()
    const mockOnColumnClick = vi.fn()

    render(
      <AbacusReact
        value={0}
        columns={5}
        interactive={true}
        gestures={false}
        animated={false}
        showNumbers={true}
        onValueChange={mockOnValueChange}
        callbacks={{
          onColumnClick: mockOnColumnClick
        }}
      />
    )

    // Find elements that should trigger column clicks (numeral areas)
    // This is harder to test directly, but we can simulate the behavior

    // Simulate clicking on column 2 numeral area and typing "7"
    // This should be equivalent to setColumnValue(2, 7)

    // For now, let's just verify that the component renders correctly
    // with showNumbers enabled
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0) // Interactive beads exist

    console.log('Numeral entry test - component renders with showNumbers=true')
  })
})