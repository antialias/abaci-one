/**
 * StudioColor — the labelled colour well.
 *
 * The hex is rendered as TEXT beside the swatch on purpose: a native colour
 * input shows only a filled rectangle, and "which of these two near-blacks did I
 * pick?" is exactly the question a filament map has to answer without opening a
 * picker.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StudioColor } from '../StudioColor'

describe('StudioColor', () => {
  it('shows the label and the hex', () => {
    render(<StudioColor label="Frame" value="#1a1a1a" onChange={vi.fn()} />)
    expect(screen.getByText('Frame')).toBeInTheDocument()
    expect(screen.getByText('#1a1a1a')).toBeInTheDocument()
  })

  it('reports the new hex on change', () => {
    const onChange = vi.fn()
    render(<StudioColor label="Frame" value="#1a1a1a" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Frame'), { target: { value: '#e11d48' } })
    expect(onChange).toHaveBeenCalledWith('#e11d48')
  })

  it('keeps the debug panel’s data-element by default and lets a caller override it', () => {
    const { container, rerender } = render(
      <StudioColor label="Frame" value="#1a1a1a" onChange={vi.fn()} />
    )
    expect(container.querySelector('[data-element="debug-color"]')).not.toBeNull()

    rerender(
      <StudioColor
        label="Frame"
        value="#1a1a1a"
        onChange={vi.fn()}
        dataElement="abacus-frame-color"
      />
    )
    expect(container.querySelector('[data-element="abacus-frame-color"]')).not.toBeNull()
  })
})
