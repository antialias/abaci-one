/**
 * StudioSlider — the studio's own copy of the borrowed debug slider.
 *
 * Two properties are pinned here because the rails depend on them and neither
 * is visible in a screenshot: the header row shows the FORMATTED value (a rail
 * full of `0.30000000000000004` is what `formatValue` exists to prevent), and
 * `disabled` really is inert rather than merely faded — the feet sliders grey
 * out when the geometry can't seat them, and a greyed slider that still moves
 * would let someone commit a print they were just told they can't have.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { StudioSlider } from '../StudioSlider'

// jsdom lacks ResizeObserver, which the radix slider needs.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

describe('StudioSlider', () => {
  it('shows the label and the formatted value', () => {
    render(
      <StudioSlider
        label="Bead gap"
        value={0.35}
        min={0}
        max={1}
        step={0.05}
        onChange={vi.fn()}
        formatValue={(v) => `${v.toFixed(2)} mm`}
      />
    )
    expect(screen.getByText('Bead gap')).toBeInTheDocument()
    expect(screen.getByText('0.35 mm')).toBeInTheDocument()
  })

  it('falls back to the raw value with no formatter', () => {
    render(<StudioSlider label="Columns" value={13} min={1} max={21} onChange={vi.fn()} />)
    expect(screen.getByText('13')).toBeInTheDocument()
  })

  it('steps up on ArrowRight', () => {
    const onChange = vi.fn()
    render(
      <StudioSlider label="Columns" value={13} min={1} max={21} step={2} onChange={onChange} />
    )
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Columns' }), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith(15)
  })

  it('does not move while disabled', () => {
    const onChange = vi.fn()
    render(
      <StudioSlider label="Columns" value={13} min={1} max={21} onChange={onChange} disabled />
    )
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Columns' }), { key: 'ArrowRight' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps the debug panel’s data-element by default and lets a caller override it', () => {
    const { container, rerender } = render(
      <StudioSlider label="Columns" value={13} min={1} max={21} onChange={vi.fn()} />
    )
    expect(container.querySelector('[data-element="debug-slider"]')).not.toBeNull()

    rerender(
      <StudioSlider
        label="Columns"
        value={13}
        min={1}
        max={21}
        onChange={vi.fn()}
        dataElement="abacus-columns"
      />
    )
    expect(container.querySelector('[data-element="abacus-columns"]')).not.toBeNull()
  })
})
