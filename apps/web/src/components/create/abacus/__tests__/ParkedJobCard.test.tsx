/**
 * ParkedJobCard (gh#9) — the parked-job resolver. Pins the contract that keeps
 * a stalled auto-start recoverable: acknowledging sends EVERY parked reason
 * code (THH refuses otherwise), a bare `ready` job starts with none, a printing
 * job offers Stop (never Start), overrides are two-tap, and a missing bed photo
 * self-hides. Presentational, so it renders with plain props — no live service.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ParkedJobCard } from '../ParkedJobCard'
import type { JobRow } from '../print-jobs'
import { describeSubmitFailure } from '../print-submit-failure'

function job(overrides: Partial<JobRow>): JobRow {
  return {
    id: 'job-1',
    name: 'Abacus',
    phase: 'needs_attention',
    progress: null,
    error: null,
    attention: [],
    notices: [],
    startPolicy: 'auto',
    acknowledged: [],
    updatedAt: 1_784_700_000,
    ...overrides,
  }
}

const needsAttention = job({
  attention: [
    { code: 'bed_not_clear', detail: 'The bed does not look clear.' },
    { code: 'verdict:x', detail: 'A verdict failed.' },
  ],
})

describe('ParkedJobCard', () => {
  it('shows the service reasons verbatim', () => {
    render(<ParkedJobCard job={needsAttention} onStart={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('The bed does not look clear.')).toBeInTheDocument()
    expect(screen.getByText('A verdict failed.')).toBeInTheDocument()
  })

  it('acknowledging is two-tap and sends EVERY reason code', () => {
    const onStart = vi.fn()
    const { container } = render(
      <ParkedJobCard job={needsAttention} onStart={onStart} onCancel={vi.fn()} />
    )
    const start = container.querySelector('[data-action="acknowledge-start"]') as HTMLButtonElement
    expect(start.textContent).toBe('Acknowledge & start')

    // First tap arms — no call yet.
    fireEvent.click(start)
    expect(onStart).not.toHaveBeenCalled()
    expect(start.textContent).toBe('Start anyway?')

    // Second tap commits with all codes, in order.
    fireEvent.click(start)
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onStart).toHaveBeenCalledWith(['bed_not_clear', 'verdict:x'])
  })

  it('blur disarms an armed override', () => {
    const onStart = vi.fn()
    const { container } = render(
      <ParkedJobCard job={needsAttention} onStart={onStart} onCancel={vi.fn()} />
    )
    const start = container.querySelector('[data-action="acknowledge-start"]') as HTMLButtonElement
    fireEvent.click(start)
    expect(start.textContent).toBe('Start anyway?')
    fireEvent.blur(start)
    expect(start.textContent).toBe('Acknowledge & start')
    // A subsequent single click only re-arms, it does not commit.
    fireEvent.click(start)
    expect(onStart).not.toHaveBeenCalled()
  })

  it('a bare ready job starts with an empty acknowledge list', () => {
    const onStart = vi.fn()
    const { container } = render(
      <ParkedJobCard
        job={job({ phase: 'ready', attention: [] })}
        onStart={onStart}
        onCancel={vi.fn()}
      />
    )
    const start = container.querySelector('[data-action="acknowledge-start"]') as HTMLButtonElement
    expect(start.textContent).toBe('Start print')
    fireEvent.click(start)
    fireEvent.click(start)
    expect(onStart).toHaveBeenCalledWith([])
  })

  it('a parked job cancels in a single tap with stopPrint false', () => {
    const onCancel = vi.fn()
    const { container } = render(
      <ParkedJobCard job={needsAttention} onStart={vi.fn()} onCancel={onCancel} />
    )
    fireEvent.click(container.querySelector('[data-action="cancel-job"]') as HTMLButtonElement)
    expect(onCancel).toHaveBeenCalledWith(false)
  })

  it('a printing job offers Stop (two-tap, stopPrint true) and never Start', () => {
    const onStart = vi.fn()
    const onCancel = vi.fn()
    const printing = job({
      phase: 'printing',
      attention: [{ code: 'nozzle_confirm', detail: 'Confirm the nozzle, then Resume.' }],
    })
    const { container } = render(
      <ParkedJobCard job={printing} onStart={onStart} onCancel={onCancel} />
    )
    // No Start control while printing.
    expect(container.querySelector('[data-action="acknowledge-start"]')).toBeNull()
    // The pause reason is shown.
    expect(screen.getByText('Confirm the nozzle, then Resume.')).toBeInTheDocument()

    const stop = container.querySelector('[data-action="stop-print"]') as HTMLButtonElement
    fireEvent.click(stop)
    expect(onCancel).not.toHaveBeenCalled()
    expect(stop.textContent).toBe('Stop the print?')
    fireEvent.click(stop)
    expect(onCancel).toHaveBeenCalledWith(true)
  })

  it('hides the bed photo when the frame endpoint has none', () => {
    const { container } = render(
      <ParkedJobCard job={needsAttention} onStart={vi.fn()} onCancel={vi.fn()} />
    )
    const img = container.querySelector('[data-element="parked-job-frame"]') as HTMLImageElement
    expect(img).not.toBeNull()
    expect(img.src).toContain('/api/abacus/print/jobs/job-1/attention-frame?t=1784700000')
    fireEvent.error(img)
    expect(container.querySelector('[data-element="parked-job-frame"]')).toBeNull()
  })

  it('renders a start refusal with the service’s honest copy', () => {
    const failure = describeSubmitFailure(409, {
      detail: {
        code: 'acknowledgement_required',
        message: 'Confirm the bed first.',
        missing: ['bed_not_clear'],
      },
    })
    const { container } = render(
      <ParkedJobCard
        job={needsAttention}
        onStart={vi.fn()}
        onCancel={vi.fn()}
        startFailure={failure}
      />
    )
    const err = container.querySelector('[data-element="parked-job-error"]') as HTMLElement
    expect(err).not.toBeNull()
    expect(err.getAttribute('data-error-code')).toBe('acknowledgement_required')
    expect(err.textContent).toContain('Confirm the bed first.')
  })

  it('disables the start button while its own start is pending', () => {
    const onStart = vi.fn()
    const { container } = render(
      <ParkedJobCard job={needsAttention} onStart={onStart} onCancel={vi.fn()} startPending />
    )
    const start = container.querySelector('[data-action="acknowledge-start"]') as HTMLButtonElement
    expect(start.disabled).toBe(true)
    expect(start.textContent).toBe('Starting…')
    fireEvent.click(start)
    fireEvent.click(start)
    expect(onStart).not.toHaveBeenCalled()
  })
})
