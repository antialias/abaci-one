import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CommitmentSummary } from '../abacus-commitment'
import { PrintDecision } from '../PrintDecision'

const summary = Object.fromEntries(
  ['pieces', 'filaments', 'supports', 'feet', 'infill', 'jobs', 'time'].map((key) => [
    key,
    { value: key === 'pieces' ? 'One piece · 100.0 × 50.0 mm' : key },
  ])
) as CommitmentSummary
const precedes = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('PrintDecision', () => {
  it('puts the card and ordered gates before the submit', () => {
    const { container } = render(
      <PrintDecision
        summary={summary}
        gates={[<div key="a" data-element="gate-a" />, <div key="b" data-element="gate-b" />]}
        submit={{ label: 'Print', disabled: false, pending: false, onClick: vi.fn() }}
      />
    )
    const card = container.querySelector('[data-element="print-commitment-card"]')!
    const gates = container.querySelector('[data-element="print-gates"]')!
    const submit = container.querySelector('[data-action="submit-print-job"]')!
    expect(precedes(card, gates)).toBe(true)
    expect(precedes(gates, submit)).toBe(true)
    expect(screen.getByText('Before you can print')).toBeInTheDocument()
    expect([...gates.children].slice(1).map((node) => node.getAttribute('data-element'))).toEqual([
      'gate-a',
      'gate-b',
    ])
  })

  it('omits the gate wrapper when no gate is active', () => {
    const { container } = render(
      <PrintDecision
        summary={summary}
        gates={[]}
        submit={{ label: 'Print', disabled: false, pending: false, onClick: vi.fn() }}
      />
    )
    expect(container.querySelector('[data-element="print-gates"]')).toBeNull()
  })

  it('puts the plate after pieces inside the card', () => {
    const { container } = render(
      <PrintDecision
        summary={summary}
        plate={<div data-element="plate" />}
        gates={[]}
        submit={{ label: 'Print', disabled: false, pending: false, onClick: vi.fn() }}
      />
    )
    const pieces = container.querySelector('[data-line="pieces"]')!
    const plate = container.querySelector('[data-element="print-commitment-plate"]')!
    expect(pieces.contains(plate)).toBe(true)
    expect(precedes(pieces.querySelector('dd')!, plate)).toBe(true)
  })

  it('wires submit label, disabled state, and click', () => {
    const onClick = vi.fn()
    const { rerender } = render(
      <PrintDecision
        summary={summary}
        gates={[]}
        submit={{ label: 'Print now', disabled: false, pending: false, onClick }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Print now' }))
    expect(onClick).toHaveBeenCalledOnce()
    rerender(
      <PrintDecision
        summary={summary}
        gates={[]}
        submit={{ label: 'Working…', disabled: true, pending: true, onClick }}
      />
    )
    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled()
  })
})
