/**
 * Jobs-roster projection (gh#162). The proxy is a pure pass-through, so this
 * projection is the only interpreter of the service's wire shape — above all
 * it must carry the service's error explanation through verbatim (dropping it
 * is how the first real print failure rendered as a bare `failed`).
 */
import { describe, expect, it } from 'vitest'
import { describeJobError, isParked, normalizeJobs, PARKED_PHASES } from '../print-jobs'

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
    expect(rows[0].error).toMatchObject({
      code: 'slice_failed',
      message: failedJob.error.message,
      cause: null,
      summary: null,
    })
  })

  it('healthy jobs project with error null and empty resolve fields', () => {
    const rows = normalizeJobs([
      { jobId: 'j1', name: 'one', phase: 'printing', progress: 40 },
      { id: 'j2', status: 'sliced' },
    ])
    expect(rows).toEqual([
      {
        id: 'j1',
        name: 'one',
        phase: 'printing',
        progress: 40,
        error: null,
        attention: [],
        notices: [],
        startPolicy: null,
        acknowledged: [],
        updatedAt: null,
        source: null,
        authoring: null,
      },
      {
        id: 'j2',
        name: 'j2',
        phase: 'sliced',
        progress: null,
        error: null,
        attention: [],
        notices: [],
        startPolicy: null,
        acknowledged: [],
        updatedAt: null,
        source: null,
        authoring: null,
      },
    ])
  })

  it('carries an error regardless of the phase word', () => {
    const rows = normalizeJobs([
      { jobId: 'j1', phase: 'printing', error: { code: 'print_failed', message: 'nozzle jam' } },
    ])
    expect(rows[0].error).toMatchObject({ code: 'print_failed', message: 'nozzle jam' })
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
    expect(normalizeJobs([{ jobId: 'j', error: { code: 'stage_failed' } }])[0].error).toMatchObject(
      {
        code: 'stage_failed',
        message: null,
      }
    )
    expect(
      normalizeJobs([{ jobId: 'j', error: { code: 'stage_failed', message: '' } }])[0].error
    ).toMatchObject({ code: 'stage_failed', message: null })
  })

  it('keeps structured wipe-tower guidance, context, technical detail, and authoring', () => {
    const [row] = normalizeJobs([
      {
        jobId: 'wipe-1',
        phase: 'failed',
        source: { app: 'abaci-one', artifactId: 'design-7' },
        authoring: {
          editUrl: 'https://abaci.one/create/abacus?design=7',
          editTool: 'Abacus Studio',
        },
        error: {
          code: 'wipe_tower_collision',
          message: 'slicer failed (exit 155): G-code conflicts detected',
          cause: 'wipe_tower_collision',
          summary: 'The wipe tower overlaps generated supports. No print was sent.',
          context: { supportsEnabled: true, wipeTower: { profile: 'v1' } },
          recovery: {
            retrySameInput: false,
            recommended: 'relayout_plate',
            options: ['relayout_plate'],
            message: 'Rebuild the plate and resubmit.',
          },
          technical: { component: 'slicer', exitCode: 155, detail: 'G-code conflict' },
        },
      },
    ])
    expect(row.error?.cause).toBe('wipe_tower_collision')
    expect(row.error?.context?.supportsEnabled).toBe(true)
    expect(row.source?.artifactId).toBe('design-7')
    expect(row.authoring?.editTool).toBe('Abacus Studio')
    expect(describeJobError(row.error!)).toEqual({
      summary: 'The wipe tower overlaps generated supports. No print was sent.',
      action: 'Rebuild the plate and resubmit.',
      retrySameInput: false,
      recommended: 'relayout_plate',
      technical: 'exit 155 · G-code conflict',
    })
  })

  it('tolerates garbage top-level shapes', () => {
    expect(normalizeJobs(undefined)).toEqual([])
    expect(normalizeJobs('nope')).toEqual([])
    expect(normalizeJobs({ jobs: 'nope' })).toEqual([])
    expect(normalizeJobs([null, 'x', { name: 'no id' }])).toEqual([])
  })
})

/** The resolve fields (gh#9): why a job parked + how to release it. The proxy
 *  is a pass-through, so dropping these here is exactly how a parked job would
 *  become a dead-end with no way to start or cancel it. */
describe('normalizeJobs — resolve fields', () => {
  /** A real needs_attention shape: a bed-vision reason + policy + updatedAt. */
  const parkedJob = {
    jobId: 'j-parked',
    phase: 'needs_attention',
    startPolicy: 'auto',
    acknowledged: ['prior_code'],
    updatedAt: 1_784_700_000.5,
    attention: {
      reasons: [
        { code: 'bed_not_clear', detail: 'The bed does not look clear.', frameRef: 'frame-7' },
        { code: 'verdict:x', detail: 'A verdict failed.' },
      ],
    },
  }

  it('projects attention reasons, startPolicy, acknowledged, and updatedAt', () => {
    const [row] = normalizeJobs([parkedJob])
    expect(row.phase).toBe('needs_attention')
    expect(row.startPolicy).toBe('auto')
    expect(row.acknowledged).toEqual(['prior_code'])
    expect(row.updatedAt).toBe(1_784_700_000.5)
    expect(row.attention).toEqual([
      { code: 'bed_not_clear', detail: 'The bed does not look clear.', frameRef: 'frame-7' },
      { code: 'verdict:x', detail: 'A verdict failed.' },
    ])
  })

  it('drops reasons without a usable code but keeps the well-formed ones', () => {
    const [row] = normalizeJobs([
      {
        jobId: 'j',
        attention: {
          reasons: [
            { detail: 'no code' },
            { code: '', detail: 'empty code' },
            { code: 7, detail: 'numeric code' },
            'not-an-object',
            { code: 'good', detail: 'kept' },
          ],
        },
      },
    ])
    expect(row.attention).toEqual([{ code: 'good', detail: 'kept' }])
  })

  it('a reason with a missing/blank detail keeps the code, detail null', () => {
    const [row] = normalizeJobs([
      {
        jobId: 'j',
        attention: { reasons: [{ code: 'bed_not_clear' }, { code: 'x', detail: '' }] },
      },
    ])
    expect(row.attention).toEqual([
      { code: 'bed_not_clear', detail: null },
      { code: 'x', detail: null },
    ])
  })

  it('tolerates malformed attention/policy shapes without dropping the job', () => {
    const cases: unknown[] = [
      { jobId: 'j', attention: 'boom' },
      { jobId: 'j', attention: 42 },
      { jobId: 'j', attention: null },
      { jobId: 'j', attention: {} },
      { jobId: 'j', attention: { reasons: 'nope' } },
      { jobId: 'j', startPolicy: 9, acknowledged: 'nope', updatedAt: 'soon' },
    ]
    for (const item of cases) {
      const [row] = normalizeJobs([item])
      expect(row.attention, JSON.stringify(item)).toEqual([])
      expect(row.acknowledged, JSON.stringify(item)).toEqual([])
    }
    // A non-number updatedAt / non-string startPolicy fall back to null.
    const [row] = normalizeJobs([{ jobId: 'j', startPolicy: 9, updatedAt: 'soon' }])
    expect(row.startPolicy).toBeNull()
    expect(row.updatedAt).toBeNull()
  })
})

/** The advisory channel (THH #429): checks the service COULDN'T run. We submit
 *  with `startPolicy: 'auto'`, so a job carrying one of these started with
 *  nothing having looked at the build plate — and this projection is the only
 *  thing standing between that fact and silence. */
describe('normalizeJobs — notices', () => {
  /** The shape THH documents for an exhausted vision quota. */
  const quotaNotice = {
    code: 'bed_check_unavailable',
    detail:
      'the bed wasn’t checked — the OpenAI account is out of quota. Nothing looked at the build plate. Top up billing at platform.openai.com to bring the check back.',
    cause: 'insufficient_quota',
  }

  it('carries the notice through verbatim, with its machine cause', () => {
    const [row] = normalizeJobs([{ jobId: 'j', phase: 'printing', notices: [quotaNotice] }])
    expect(row.notices).toEqual([quotaNotice])
  })

  it('survives to the finished job — a notice is never cleared', () => {
    const [row] = normalizeJobs([{ jobId: 'j', phase: 'completed', notices: [quotaNotice] }])
    expect(row.phase).toBe('completed')
    expect(row.notices).toEqual([quotaNotice])
  })

  it('is independent of attention — an unparked job can carry one', () => {
    const [row] = normalizeJobs([{ jobId: 'j', phase: 'printing', notices: [quotaNotice] }])
    expect(row.attention).toEqual([])
    expect(row.notices).toHaveLength(1)
  })

  it('drops entries without a usable code but keeps the well-formed ones', () => {
    const [row] = normalizeJobs([
      {
        jobId: 'j',
        notices: [
          { detail: 'no code' },
          { code: '', detail: 'empty code' },
          { code: 7, detail: 'numeric code' },
          'not-an-object',
          null,
          { code: 'good', detail: 'kept', cause: 'network' },
        ],
      },
    ])
    expect(row.notices).toEqual([{ code: 'good', detail: 'kept', cause: 'network' }])
  })

  it('a missing/blank detail or cause keeps the code, the rest null', () => {
    const [row] = normalizeJobs([
      {
        jobId: 'j',
        notices: [{ code: 'bed_check_unavailable' }, { code: 'x', detail: '', cause: '' }],
      },
    ])
    expect(row.notices).toEqual([
      { code: 'bed_check_unavailable', detail: null, cause: null },
      { code: 'x', detail: null, cause: null },
    ])
  })

  it('tolerates malformed notices shapes without dropping the job', () => {
    // NB the wire shape is a BARE list — a `{reasons: …}`-style wrapper is not
    // the contract here, and must project to empty rather than be guessed at.
    const cases: unknown[] = [
      { jobId: 'j', notices: 'boom' },
      { jobId: 'j', notices: 42 },
      { jobId: 'j', notices: null },
      { jobId: 'j', notices: {} },
      { jobId: 'j', notices: { notices: [quotaNotice] } },
    ]
    for (const item of cases) {
      const [row] = normalizeJobs([item])
      expect(row, JSON.stringify(item)).toBeDefined()
      expect(row.notices, JSON.stringify(item)).toEqual([])
    }
  })
})

describe('isParked / PARKED_PHASES', () => {
  it('the two non-terminal parked phases are startable/cancelable', () => {
    expect(PARKED_PHASES).toEqual(['ready', 'needs_attention'])
    expect(isParked('ready')).toBe(true)
    expect(isParked('needs_attention')).toBe(true)
  })

  it('running and terminal phases are not parked', () => {
    for (const phase of ['queued', 'slicing', 'printing', 'completed', 'failed', 'canceled']) {
      expect(isParked(phase), phase).toBe(false)
    }
  })
})
