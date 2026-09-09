/**
 * StudioCheckbox — the studio's on/off box.
 *
 * The description is the interesting part: it is a SIBLING of the label, tied to
 * the input by aria-describedby, so the accessible name stays the choice ("Slow
 * first layer") and the reason is heard after it rather than glued onto it.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StudioCheckbox } from '../StudioCheckbox'

describe('StudioCheckbox', () => {
  it('toggles', () => {
    const onChange = vi.fn()
    render(<StudioCheckbox label="Slow first layer" checked={false} onChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Slow first layer' }))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('reports the unchecking too', () => {
    const onChange = vi.fn()
    render(<StudioCheckbox label="Slow first layer" checked onChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Slow first layer' }))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  // userEvent, not fireEvent: fireEvent dispatches straight at the node and a
  // disabled input will happily run the handler, which would pass this test
  // while the real control was live.
  it('ignores clicks while disabled', async () => {
    const onChange = vi.fn()
    render(<StudioCheckbox label="Slow first layer" checked={false} onChange={onChange} disabled />)
    const box = screen.getByRole('checkbox', { name: 'Slow first layer' })
    expect(box).toBeDisabled()
    await userEvent.click(box)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders a description and describes the input with it', () => {
    render(
      <StudioCheckbox
        label="Slow first layer"
        checked={false}
        onChange={vi.fn()}
        description="Sticks better on a cold plate."
      />
    )
    expect(screen.getByRole('checkbox', { name: 'Slow first layer' })).toHaveAccessibleDescription(
      'Sticks better on a cold plate.'
    )
  })

  it('keeps the debug panel’s data-element by default and lets a caller override it', () => {
    const { container, rerender } = render(
      <StudioCheckbox label="Slow first layer" checked={false} onChange={vi.fn()} />
    )
    expect(container.querySelector('[data-element="debug-checkbox"]')).not.toBeNull()

    rerender(
      <StudioCheckbox
        label="Slow first layer"
        checked={false}
        onChange={vi.fn()}
        dataElement="print-slow-first-layer"
      />
    )
    expect(container.querySelector('[data-element="print-slow-first-layer"]')).not.toBeNull()
  })
})
