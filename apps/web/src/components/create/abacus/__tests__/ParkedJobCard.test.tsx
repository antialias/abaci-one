/**
 * ParkedJobCard (gh#9) — the parked-job resolver. Pins the contract that keeps
 * a stalled auto-start recoverable: acknowledging sends EVERY parked reason
 * code (THH refuses otherwise), a bare `ready` job starts with none, Start is
 * ONE tap (the reasons are on the card and a start is undoable from it), a
 * printing job offers Stop (never Start) and Stop alone is two-tap because it
 * is not undoable, and a missing bed photo self-hides. Presentational, so it
 * renders with plain props — no live service.
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
    chain: null,
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

  it('gives an unverified filament fallback a specific, workable acceptance gate', () => {
    const onStart = vi.fn()
    const fallback = job({
      attention: [
        {
          code: 'filament_profile_unverified:0',
          detail:
            "Filament 1 reports unrecognized material family 'PLA-WOOD'. THH inferred the PLA material class and sliced it with fallback profile 'pla-basic'. Verify the material and temperature settings before starting.",
        },
      ],
    })
    const { container } = render(
      <ParkedJobCard job={fallback} onStart={onStart} onCancel={vi.fn()} />
    )
    expect(
      screen.getByText('Review required — this filament was sliced with a fallback profile.')
    ).toBeInTheDocument()
    expect(screen.getByText(/Verify the material and temperature settings/)).toBeInTheDocument()

    const start = container.querySelector('[data-action="acknowledge-start"]') as HTMLButtonElement
    fireEvent.click(start)
    expect(onStart).toHaveBeenCalledWith(['filament_profile_unverified:0'])
  })

  it('acknowledging is ONE tap and sends EVERY reason code', () => {
    const onStart = vi.fn()
    const { container } = render(
      <ParkedJobCard job={needsAttention} onStart={onStart} onCancel={vi.fn()} />
    )
    const start = container.querySelector('[data-action="acknowledge-start"]') as HTMLButtonElement
    // The button says what it does, and the consequence is on it for a reader.
    expect(start.textContent).toBe('Acknowledge & start')
    expect(start.getAttribute('aria-label')).toBe(
      'Acknowledge and start, despite: The bed does not look clear.; A verdict failed.'
    )

    // One tap commits with all codes, in order — no arming, no "anyway?".
    fireEvent.click(start)
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onStart).toHaveBeenCalledWith(['bed_not_clear', 'verdict:x'])
    expect(start.textContent).toBe('Acknowledge & start')
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
    // Nothing to override, nothing to confirm: no aria-label, one tap.
    expect(start.getAttribute('aria-label')).toBeNull()
    fireEvent.click(start)
    expect(onStart).toHaveBeenCalledTimes(1)
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

  it('a fault pause says the printer reported an error and links each code to its own page', () => {
    const paused = job({
      phase: 'printing',
      attention: [
        {
          code: 'print_paused_fault',
          detail:
            'Printer paused at reported layer 6 (8%). It reported HMS 07FF-2000-0002-0004. Our file at that layer changes from filament 2 (PLA, slot 0.1) to filament 0 (TPU, slot 0.3), load 4 of filament 0 in this file.',
          printer: {
            gcodeState: 'PAUSE',
            hms: [
              {
                hex: '07FF-2000-0002-0004',
                wiki: 'https://wiki.bambulab.com/en/x1/troubleshooting/hmscode/07FF_2000_0002_0004',
              },
              { hex: '0300-4000' },
            ],
            layer: 6,
            percent: 8,
          },
        },
      ],
    })
    const { container } = render(
      <ParkedJobCard job={paused} onStart={vi.fn()} onCancel={vi.fn()} />
    )
    expect(screen.getByText(/the printer reported an error/)).toBeInTheDocument()
    // The service's sentence, verbatim — no diagnosis added here.
    expect(screen.getByText(/Printer paused at reported layer 6/)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: '07FF-2000-0002-0004' })
    expect(link).toHaveAttribute(
      'href',
      'https://wiki.bambulab.com/en/x1/troubleshooting/hmscode/07FF_2000_0002_0004'
    )
    // A code the service could not link is still shown, as text.
    expect(screen.getByText('0300-4000')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '0300-4000' })).toBeNull()
    expect(container.querySelector('[data-action="acknowledge-start"]')).toBeNull()
    expect(container.querySelector('[data-action="stop-print"]')).not.toBeNull()
  })

  it('a pause with no reported error says so and shows no code links', () => {
    const paused = job({
      phase: 'printing',
      attention: [
        {
          code: 'print_paused',
          detail: 'Printer paused at reported layer 12 (40%). It reported no error code.',
          printer: { gcodeState: 'PAUSE', hms: [], layer: 12, percent: 40 },
        },
      ],
    })
    const { container } = render(
      <ParkedJobCard job={paused} onStart={vi.fn()} onCancel={vi.fn()} />
    )
    expect(screen.getByText(/the printer reported no error/)).toBeInTheDocument()
    expect(container.querySelector('[data-element="parked-job-printer-codes"]')).toBeNull()
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

  it('a chained Stage B parked on chain_start_disabled cannot be started by acknowledging (Gitea #38)', () => {
    const onStart = vi.fn()
    const chained = job({
      name: 'Abacus — Stage B',
      chain: { continuesJobId: 'job-a' },
      attention: [
        {
          code: 'chain_start_disabled',
          detail: 'Chained starts are disabled on this gateway (CHAINED_START_ENABLED).',
        },
      ],
    })
    const { container } = render(
      <ParkedJobCard job={chained} onStart={onStart} onCancel={vi.fn()} />
    )
    expect(
      screen.getByText('Prepared, but chained starts are switched off on this print service.')
    ).toBeInTheDocument()
    const start = container.querySelector('[data-action="acknowledge-start"]') as HTMLButtonElement
    expect(start.disabled).toBe(true)
    expect(start.title).toMatch(/CHAINED_START_ENABLED/)
    fireEvent.click(start)
    fireEvent.click(start)
    expect(onStart).not.toHaveBeenCalled()
  })
})
