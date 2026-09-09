import { describe, expect, it } from 'vitest'
import { defaultParams, type FilamentMap } from '../abacus-model'
import { type AbacusPrintSignatureInputs, abacusPrintSignature } from '../print-idempotency'
import { describeJobError, normalizeJobs } from '../print-jobs'
import { describeSubmitFailure } from '../print-submit-failure'

describe('two-stage job plumbing (Gitea #38 / THH #456)', () => {
  it('keeps the chain THH echoes on a Stage B row, null elsewhere', () => {
    const rows = normalizeJobs({
      jobs: [
        { id: 'b', name: 'Stage B', phase: 'ready', chain: { continuesJobId: 'a' } },
        { id: 'a', name: 'Stage A', phase: 'completed' },
        { id: 'c', name: 'junk chain', phase: 'queued', chain: { continuesJobId: '' } },
      ],
    })
    expect(rows.map((r) => r.chain)).toEqual([{ continuesJobId: 'a' }, null, null])
  })
  it('describes split_failed from the job-level code, since THH gives it no cause', () => {
    const d = describeJobError({
      code: 'split_failed',
      message: 'seam z=1.6 is not on a layer boundary',
      cause: null,
      summary: null,
      context: null,
      recovery: null,
      technical: null,
    })
    expect(d.summary).toMatch(/split at the feet seam/)
    expect(d.retrySameInput).toBe(false)
  })
  it('names the three submit-time codes a split or chained ticket can draw', () => {
    expect(describeSubmitFailure(400, { detail: { code: 'invalid_chain' } }).remediation).toMatch(
      /run Stage A again/
    )
    expect(
      describeSubmitFailure(400, { detail: { code: 'invalid_filaments' } }).remediation
    ).toMatch(/same family/)
    expect(describeSubmitFailure(400, { detail: { code: 'invalid_job' } }).headline).toMatch(
      /shape of this job/
    )
    expect(
      describeSubmitFailure(400, {
        detail: { code: 'invalid_chain', message: 'prior job x1 is not the last on the plate' },
      }).headline
    ).toBe('prior job x1 is not the last on the plate')
  })
})

describe('two-stage idempotency (Gitea #38)', () => {
  const filamentMap: FilamentMap = {
    slots: ['TPU for AMS', 'Wood PLA'],
    frame: 1,
    markerWhite: 1,
    markerBlack: 0,
    beadRoles: [0, 1, 0, 1],
    markerContrast: 21,
    feet: 0,
  }
  const base: AbacusPrintSignatureInputs = {
    params: { ...defaultParams, feet_mode: 'printed' },
    filamentMap,
    slotLabels: ['TPU for AMS', 'Wood PLA'],
    style: { basePreset: '0.20mm-standard', process: {} },
    startPolicy: 'auto',
    supportInterfaceSlotId: null,
  }
  it('Stage A, Stage B and a one-job print of the same design are three different keys', () => {
    const single = abacusPrintSignature(base)
    const a = abacusPrintSignature({
      ...base,
      twoStage: { stage: 'A', atZMm: 1.6, feedFamily: 'TPU', variant: 'tpu-floor' },
    })
    const b = abacusPrintSignature({
      ...base,
      startPolicy: 'hold',
      twoStage: { stage: 'B', continuesJobId: 'job-a', variant: 'tpu-floor' },
    })
    expect(new Set([single, a, b]).size).toBe(3)
    expect(abacusPrintSignature({ ...base, twoStage: null })).toBe(single)
    // A different Stage A to chain onto is a different Stage B.
    expect(
      abacusPrintSignature({
        ...base,
        startPolicy: 'hold',
        twoStage: { stage: 'B', continuesJobId: 'job-a2', variant: 'tpu-floor' },
      })
    ).not.toBe(b)
    // The feet-only variant (Gitea #45) is a different Stage A, and a different Stage B.
    expect(
      abacusPrintSignature({
        ...base,
        twoStage: { stage: 'A', atZMm: 1.6, feedFamily: 'TPU', variant: 'feet-only' },
      })
    ).not.toBe(a)
    expect(
      abacusPrintSignature({
        ...base,
        startPolicy: 'hold',
        twoStage: { stage: 'B', continuesJobId: 'job-a', variant: 'feet-only' },
      })
    ).not.toBe(b)
  })
})
