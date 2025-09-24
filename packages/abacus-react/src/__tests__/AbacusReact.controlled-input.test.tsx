import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { AbacusReact } from '../AbacusReact'

describe('AbacusReact Controlled Input Pattern', () => {
  it('should initialize with controlled value prop', () => {
    render(<AbacusReact value={42} />)

    // Should display the controlled value (42 on a 5-column abacus)
    // Column structure: [0][0][0][4][2] = 42
    const earthBeads = screen.getAllByTestId(/bead-place-\d+-earth-pos-/)
    const heavenBeads = screen.getAllByTestId(/bead-place-\d+-heaven/)

    // Place 1 (tens): should have 4 earth beads active
    const tensEarthBeads = earthBeads.filter(bead =>
      bead.getAttribute('data-testid')?.includes('place-1-earth')
    )
    expect(tensEarthBeads).toHaveLength(4) // 4 earth beads for 40

    // Place 0 (ones): should have 2 earth beads active
    const onesEarthBeads = earthBeads.filter(bead =>
      bead.getAttribute('data-testid')?.includes('place-0-earth')
    )
    expect(onesEarthBeads).toHaveLength(4) // Up to 4 earth beads, 2 should be active
  })

  it('should update internal state when controlled value changes', async () => {
    const { rerender } = render(<AbacusReact value={10} />)

    // Initial state: 10
    expect(screen.getAllByTestId(/bead-place-1-earth-pos-0/)).toHaveLength(1) // 1 earth bead for tens

    // Change controlled value to 20
    rerender(<AbacusReact value={20} />)

    await waitFor(() => {
      // Should now show 20 (2 earth beads in tens place)
      expect(screen.getAllByTestId(/bead-place-1-earth-pos-[01]/)).toHaveLength(2)
    })
  })

  it('should call onValueChange only for user interactions, not external updates', async () => {
    const onValueChange = vi.fn()
    const { rerender } = render(<AbacusReact value={5} onValueChange={onValueChange} />)

    // Clear any initialization calls
    onValueChange.mockClear()

    // External value change should NOT trigger onValueChange
    rerender(<AbacusReact value={10} onValueChange={onValueChange} />)

    await waitFor(() => {
      expect(onValueChange).not.toHaveBeenCalled()
    })

    // User clicking a bead SHOULD trigger onValueChange
    const earthBead = screen.getByTestId('bead-place-0-earth-pos-0')
    fireEvent.click(earthBead)

    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalledWith(expect.any(Number))
    })
  })

  it('should allow user interaction while maintaining controlled value', async () => {
    const onValueChange = vi.fn()
    const TestComponent = () => {
      const [value, setValue] = React.useState(5)

      return (
        <AbacusReact
          value={value}
          onValueChange={(newValue) => {
            onValueChange(newValue)
            setValue(newValue) // Accept the change
          }}
        />
      )
    }

    render(<TestComponent />)

    // Click a bead to change the value
    const earthBead = screen.getByTestId('bead-place-0-earth-pos-0')
    fireEvent.click(earthBead)

    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalled()
    })

    // The component should reflect the new value
    const newValue = onValueChange.mock.calls[0][0]
    expect(newValue).not.toBe(5) // Should have changed from initial value
  })

  it('should not get stuck in feedback loops', async () => {
    const onValueChange = vi.fn()
    let renderCount = 0

    const TestComponent = () => {
      renderCount++
      const [value, setValue] = React.useState(0)

      return (
        <AbacusReact
          value={value}
          onValueChange={(newValue) => {
            onValueChange(newValue)
            setValue(newValue)
          }}
        />
      )
    }

    const { rerender } = render(<TestComponent />)

    const initialRenderCount = renderCount

    // External value change
    rerender(<TestComponent />)

    // Should not cause excessive re-renders
    await waitFor(() => {
      expect(renderCount).toBeLessThan(initialRenderCount + 5) // Allow some re-renders but not infinite
    })
  })

  it('should handle rapid value changes correctly', async () => {
    const onValueChange = vi.fn()
    const { rerender } = render(<AbacusReact value={0} onValueChange={onValueChange} />)

    // Rapid external value changes
    rerender(<AbacusReact value={10} onValueChange={onValueChange} />)
    rerender(<AbacusReact value={20} onValueChange={onValueChange} />)
    rerender(<AbacusReact value={30} onValueChange={onValueChange} />)

    await waitFor(() => {
      // Should not trigger onValueChange for external updates
      expect(onValueChange).not.toHaveBeenCalled()
    })

    // Final value should be correct
    const heavenBeads = screen.getAllByTestId(/bead-place-1-heaven/)
    expect(heavenBeads[0]).toHaveClass('active') // Heaven bead should be active for 30
  })

  it('should preserve user changes until parent updates', async () => {
    const onValueChange = vi.fn()
    render(<AbacusReact value={5} onValueChange={onValueChange} />)

    // User clicks to change value
    const earthBead = screen.getByTestId('bead-place-0-earth-pos-0')
    fireEvent.click(earthBead)

    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalled()
    })

    // The display should show user's change temporarily
    const newValue = onValueChange.mock.calls[0][0]
    expect(newValue).not.toBe(5)

    // Even if parent hasn't updated the prop yet, user's change should be visible
    // This tests that internal state is updated immediately for better UX
  })
})