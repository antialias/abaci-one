import { describe, expect, it } from 'vitest'
import { describeSubmitFailure } from '../print-submit-failure'

describe('describeSubmitFailure', () => {
  it('reads printer_busy and names the blocking job, never advising a blind retry', () => {
    const f = describeSubmitFailure(409, {
      detail: { code: 'printer_busy', message: 'busy', activeJob: { jobId: 'j0' } },
    })
    expect(f.code).toBe('printer_busy')
    expect(f.blockingJobId).toBe('j0')
    expect(f.headline).toMatch(/busy with another job/i)
    expect(f.remediation).toBeTruthy()
    // A conflict is a state to resolve, not a retry.
    expect(f.remediation).not.toMatch(/try again\.?$/i)
    expect(f.remediation).toMatch(/cancel it/i)
  })

  it('tolerates printer_busy with the active job under `id` instead of `jobId`', () => {
    const f = describeSubmitFailure(409, {
      detail: { code: 'printer_busy', activeJob: { id: 'abc' } },
    })
    expect(f.blockingJobId).toBe('abc')
  })

  it('printer_busy with no active job still explains and advises', () => {
    const f = describeSubmitFailure(409, { detail: { code: 'printer_busy' } })
    expect(f.blockingJobId).toBeNull()
    expect(f.headline).toMatch(/another job/i)
    expect(f.remediation).toMatch(/cancel it/i)
  })

  it('routes invalid_ticket per-key detail back to the editor', () => {
    const f = describeSubmitFailure(400, {
      detail: {
        code: 'invalid_ticket',
        message: 'bad',
        keys: { layer_height: 'out of range' },
      },
    })
    expect(f.code).toBe('invalid_ticket')
    expect(f.invalidTicket).not.toBeNull()
    expect(f.headline).toMatch(/highlighted below/i)
  })

  it('surfaces acknowledgement_required with the missing confirmations', () => {
    const f = describeSubmitFailure(409, {
      detail: {
        code: 'acknowledgement_required',
        message: 'ack',
        missing: ['bed_unknown', 3, 'ams'],
      },
    })
    expect(f.code).toBe('acknowledgement_required')
    expect(f.missing).toEqual(['bed_unknown', 'ams']) // non-strings dropped
    expect(f.remediation).toMatch(/bed_unknown, ams/)
  })

  it('shows an unknown coded refusal VERBATIM rather than a bare status', () => {
    const f = describeSubmitFailure(409, {
      detail: {
        code: 'nozzle_mismatch',
        message: 'This printer has a 0.4mm nozzle; the job needs 0.2mm.',
      },
    })
    expect(f.code).toBe('nozzle_mismatch')
    expect(f.headline).toBe('This printer has a 0.4mm nozzle; the job needs 0.2mm.')
    // Honest about the conflict; no "Try again."
    expect(f.remediation).toMatch(/conflicts/i)
    expect(f.headline).not.toMatch(/409/)
  })

  it('a 409 with no body is a conflict, NOT "Submit failed (409). Try again."', () => {
    const f = describeSubmitFailure(409, null)
    expect(f.code).toBe('http_409')
    expect(f.headline).toMatch(/conflicts with its current state/i)
    expect(f.headline).not.toMatch(/try again/i)
    expect(f.remediation).not.toMatch(/^this is usually temporary/i)
  })

  it('treats 5xx / unreachable as transient and invites a retry', () => {
    expect(describeSubmitFailure(503, null).remediation).toMatch(/temporary/i)
    expect(describeSubmitFailure(0, null).headline).toMatch(/unreachable/i)
    expect(describeSubmitFailure(0, null).remediation).toMatch(/temporary/i)
  })

  it('maps a 401/403 to a re-pair, not a retry', () => {
    const f = describeSubmitFailure(403, null)
    expect(f.headline).toMatch(/credentials/i)
    expect(f.remediation).toMatch(/re-pair/i)
    expect(f.remediation).toMatch(/Settings/i)
  })

  it('never reproduces the old opaque "Submit failed (N). Try again." string', () => {
    for (const status of [400, 401, 403, 409, 422, 500, 503, 0]) {
      for (const body of [null, {}, { detail: {} }, { detail: { code: 'weird' } }]) {
        const f = describeSubmitFailure(status, body)
        expect(f.headline).not.toMatch(/^Submit failed \(\d+\)\. Try again\.$/)
        expect(f.headline.length).toBeGreaterThan(0)
      }
    }
  })
})
