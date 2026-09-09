/**
 * Disclosure — the studio's fold.
 *
 * `keepMounted` is the load-bearing behaviour and the reason this file exists.
 * The print-settings editor is expensive to build and holds unsaved edits, so it
 * must not mount before someone asks for it (that was PrintPanel's
 * `settingsEverOpened`) and must not UNMOUNT when they fold it away (that was
 * the same flag's second half). Mount-on-first-open-then-hide is one property,
 * not two, and it now belongs to the primitive instead of to a caller.
 *
 * Controlled mode exists for the same caller: the floating print rail widens
 * while the settings are open, so something outside the Disclosure has to be
 * able to read — and set — whether it is.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Disclosure } from '../Disclosure'

describe('Disclosure — uncontrolled', () => {
  it('starts closed, opens on click, and reports it in aria-expanded', () => {
    render(
      <Disclosure label="Advanced">
        <p>Bead gap</p>
      </Disclosure>
    )
    const header = screen.getByRole('button', { name: /Advanced/ })
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Bead gap')).toBeNull()

    fireEvent.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Bead gap')).toBeInTheDocument()

    fireEvent.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Bead gap')).toBeNull()
  })

  it('honours defaultOpen', () => {
    render(
      <Disclosure label="Advanced" defaultOpen>
        <p>Bead gap</p>
      </Disclosure>
    )
    expect(screen.getByRole('button', { name: /Advanced/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(screen.getByText('Bead gap')).toBeInTheDocument()
  })

  it('points the header at the panel it controls', () => {
    render(
      <Disclosure label="Advanced" defaultOpen>
        <p>Bead gap</p>
      </Disclosure>
    )
    const id = screen.getByRole('button', { name: /Advanced/ }).getAttribute('aria-controls')
    expect(id).toBeTruthy()
    expect(document.getElementById(id as string)).toContainElement(screen.getByText('Bead gap'))
  })
})

describe('Disclosure — keepMounted', () => {
  it('mounts on first open and then stays mounted, hidden', () => {
    const { container } = render(
      <Disclosure label="Print settings" keepMounted>
        <p>Layer height</p>
      </Disclosure>
    )
    const header = screen.getByRole('button', { name: /Print settings/ })
    // never mounted before it is wanted
    expect(screen.queryByText('Layer height')).toBeNull()

    fireEvent.click(header)
    const panel = screen.getByText('Layer height')
    expect(panel).toBeInTheDocument()

    // …and never unmounted after: still in the DOM, hidden rather than removed
    fireEvent.click(header)
    expect(container.textContent).toContain('Layer height')
    const panelEl = document.getElementById(header.getAttribute('aria-controls') as string)
    expect(panelEl).not.toBeNull()
    expect(panelEl).toHaveAttribute('hidden')
    expect(panelEl?.style.display).toBe('none')
    expect(header).toHaveAttribute('aria-expanded', 'false')
  })

  it('drops the children entirely without keepMounted', () => {
    const { container } = render(
      <Disclosure label="Print settings" defaultOpen>
        <p>Layer height</p>
      </Disclosure>
    )
    fireEvent.click(screen.getByRole('button', { name: /Print settings/ }))
    expect(container.textContent).not.toContain('Layer height')
  })
})

describe('Disclosure — controlled', () => {
  it('takes its open state from the prop and asks the owner to change it', () => {
    const onOpenChange = vi.fn()
    const { rerender } = render(
      <Disclosure label="Print settings" open={false} onOpenChange={onOpenChange}>
        <p>Layer height</p>
      </Disclosure>
    )
    const header = screen.getByRole('button', { name: /Print settings/ })

    fireEvent.click(header)
    expect(onOpenChange).toHaveBeenCalledWith(true)
    // the owner has not said yes yet, so nothing opened on its own
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Layer height')).toBeNull()

    rerender(
      <Disclosure label="Print settings" open onOpenChange={onOpenChange}>
        <p>Layer height</p>
      </Disclosure>
    )
    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Layer height')).toBeInTheDocument()
  })

  it('drives a caller that owns the state, keepMounted and all', () => {
    function Host() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <span data-element="host-state">{open ? 'wide' : 'narrow'}</span>
          <Disclosure label="Print settings" keepMounted open={open} onOpenChange={setOpen}>
            <p>Layer height</p>
          </Disclosure>
        </>
      )
    }
    const { container } = render(<Host />)
    const header = screen.getByRole('button', { name: /Print settings/ })

    fireEvent.click(header)
    expect(container.querySelector('[data-element="host-state"]')).toHaveTextContent('wide')
    expect(screen.getByText('Layer height')).toBeInTheDocument()

    fireEvent.click(header)
    expect(container.querySelector('[data-element="host-state"]')).toHaveTextContent('narrow')
    expect(container.textContent).toContain('Layer height')
  })
})

describe('Disclosure — the attributes the rails select on', () => {
  it('keeps its data-element and data-action, defaults included', () => {
    const { container, rerender } = render(
      <Disclosure label="Advanced">
        <p>x</p>
      </Disclosure>
    )
    expect(container.querySelector('[data-element="disclosure"]')).not.toBeNull()
    expect(container.querySelector('[data-action="toggle-disclosure"]')).not.toBeNull()

    rerender(
      <Disclosure
        label="Print settings"
        dataElement="print-settings"
        dataAction="toggle-print-settings"
      >
        <p>x</p>
      </Disclosure>
    )
    expect(container.querySelector('[data-element="print-settings"]')).not.toBeNull()
    expect(container.querySelector('[data-action="toggle-print-settings"]')).not.toBeNull()
  })
})
