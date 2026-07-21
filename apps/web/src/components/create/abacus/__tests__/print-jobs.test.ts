/**
 * Jobs-roster projection (gh#162). The proxy is a pure pass-through, so this
 * projection is the only interpreter of the service's wire shape — above all
 * it must carry the service's error explanation through verbatim (dropping it
 * is how the first real print failure rendered as a bare `failed`).
 */
import { describe, expect, it } from 'vitest'
import { normalizeJobs } from '../print-jobs'

/** The real THH failed-job shape from prod, 2026-07-21 (trimmed to wire fields). */
const failedJob = {
  jobId: 'printapi-1784671559560-4926465f',
  name: 'abacus',
  phase: 'failed',
  progress: null,
  error: {
    code: 'slice_failed',
    message:
      'slice failed: slicer failed (exit 194): The temperature difference of the filaments used is too large. Please verify the slicing of all plates in Orca Slicer before uploading.',
  },
}

describe('normalizeJobs', () => {
  it('carries the service error through verbatim', () => {
    const rows = normalizeJobs({ jobs: [failedJob] })
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('printapi-1784671559560-4926465f')
    expect(rows[0].phase).toBe('failed')
    expect(rows[0].error).toEqual({
      code: 'slice_failed',
      message: failedJob.error.message,
    })
  })

  it('healthy jobs project with error null', () => {
    const rows = normalizeJobs([
      { jobId: 'j1', name: 'one', phase: 'printing', progress: 40 },
      { id: 'j2', status: 'sliced' },
    ])
    expect(rows).toEqual([
      { id: 'j1', name: 'one', phase: 'printing', progress: 40, error: null },
      { id: 'j2', name: 'j2', phase: 'sliced', progress: null, error: null },
    ])
  })

  it('carries an error regardless of the phase word', () => {
    const rows = normalizeJobs([
      { jobId: 'j1', phase: 'printing', error: { code: 'print_failed', message: 'nozzle jam' } },
    ])
    expect(rows[0].error).toEqual({ code: 'print_failed', message: 'nozzle jam' })
  })

  it('rejects malformed error shapes without dropping the job', () => {
    const cases: unknown[] = [
      { jobId: 'j', error: 'boom' },
      { jobId: 'j', error: 42 },
      { jobId: 'j', error: null },
      { jobId: 'j', error: {} },
      { jobId: 'j', error: { code: '' } },
      { jobId: 'j', error: { code: 7, message: 'x' } },
      { jobId: 'j', error: { message: 'no code' } },
    ]
    for (const job of cases) {
      const rows = normalizeJobs([job])
      expect(rows, JSON.stringify(job)).toHaveLength(1)
      expect(rows[0].error, JSON.stringify(job)).toBeNull()
    }
  })

  it('a code with a missing or empty message keeps the code, message null', () => {
    expect(normalizeJobs([{ jobId: 'j', error: { code: 'stage_failed' } }])[0].error).toEqual({
      code: 'stage_failed',
      message: null,
    })
    expect(
      normalizeJobs([{ jobId: 'j', error: { code: 'stage_failed', message: '' } }])[0].error
    ).toEqual({ code: 'stage_failed', message: null })
  })

  it('tolerates garbage top-level shapes', () => {
    expect(normalizeJobs(undefined)).toEqual([])
    expect(normalizeJobs('nope')).toEqual([])
    expect(normalizeJobs({ jobs: 'nope' })).toEqual([])
    expect(normalizeJobs([null, 'x', { name: 'no id' }])).toEqual([])
  })
})
