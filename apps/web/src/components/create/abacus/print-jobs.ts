/**
 * Jobs-roster projection for the print panel (gh#162).
 *
 * The `/api/abacus/print/jobs` proxy passes the service's job list through
 * untouched, so this is the ONLY place the wire shape is interpreted. The
 * error carries the service's own explanation of a failure — it must survive
 * the projection verbatim (dropping it is exactly how the first real print
 * failure rendered as a bare `failed`).
 *
 * Beyond the error, the service also ships each job's `attention` reasons (why
 * it parked), its `startPolicy`, and what's already been `acknowledged`. Those
 * are what let the panel RESOLVE a parked job in place instead of leaving it a
 * dead-end — so they must survive the projection too (dropping them is exactly
 * why a held job used to block every later submit with no way out).
 *
 * `notices` (THH #429) is a THIRD channel and a different kind of fact: not why
 * the job stopped, but what the service couldn't CHECK before letting it run.
 * We send `startPolicy: 'auto'`, so when the service's bed camera can't reach
 * its vision provider our print now starts unattended with nothing having
 * looked at the plate — and the notice is the only thing that says so. Dropping
 * it here makes that silent.
 */

export type JobError = { code: string; message: string | null }

/** One reason the service parked a job, from `attention.reasons[]`. `detail`
 *  is the service's own human sentence; `code` is what {@link isParked} jobs
 *  must acknowledge to start. `frameRef` (when present) marks the reason that
 *  carries the bed photo — informational; the photo loads from the job-level
 *  `attention-frame` endpoint, not this ref. */
export type AttentionReason = { code: string; detail: string | null; frameRef?: string | null }

/** One thing the service COULDN'T verify, from the job's `notices[]` (THH #429).
 *
 *  The opposite of an {@link AttentionReason} in every way that matters: it
 *  blocks nothing, is never acknowledged, is never cleared, and is still on the
 *  job at `completed` — which is the surface where "nothing looked at the build
 *  plate" is most worth knowing. `detail` is the service's own sentence (prose,
 *  and prose changes); `cause` is the stable machine class to branch on:
 *  `insufficient_quota` | `http_<NNN>` | `network` | `no_frame` |
 *  `capture_failed`.
 *
 *  An EMPTY list is not proof the bed was checked — a service with no vision
 *  key configured checks nothing and says nothing. Absence means only that
 *  nothing went wrong that the service considers worth reporting. */
export type JobNotice = { code: string; detail: string | null; cause: string | null }

export type JobRow = {
  id: string
  name: string
  phase: string
  progress: number | null
  error: JobError | null
  /** Reasons the service is holding this job (empty unless it parked). */
  attention: AttentionReason[]
  /** Checks the service couldn't run (empty when nothing went unchecked). */
  notices: JobNotice[]
  /** `'auto'` | `'hold'` as the service recorded it, or null. */
  startPolicy: string | null
  /** Reason codes already confirmed on this job. */
  acknowledged: string[]
  /** The service's last-touched epoch (seconds); a cache-buster for the frame. */
  updatedAt: number | null
}

/** The two non-terminal phases a job rests in while it waits for a human: a
 *  clean `hold` slice (`ready`) or a preflight that found something to confirm
 *  (`needs_attention`). Both count as busy upstream — so both are what the
 *  panel must be able to start or cancel. */
export const PARKED_PHASES = ['ready', 'needs_attention'] as const

/** Whether a phase is one the panel can start or cancel (see {@link PARKED_PHASES}). */
export function isParked(phase: string): boolean {
  return (PARKED_PHASES as readonly string[]).includes(phase)
}

/** The service's `error: {code, message}` — attached only when the job failed. */
function normalizeJobError(value: unknown): JobError | null {
  if (typeof value !== 'object' || value === null) return null
  const rec = value as Record<string, unknown>
  if (typeof rec.code !== 'string' || rec.code.length === 0) return null
  return {
    code: rec.code,
    message: typeof rec.message === 'string' && rec.message.length > 0 ? rec.message : null,
  }
}

/** The service's `attention: {reasons: [{code, detail, frameRef?}]}` — a job is
 *  only actionable through the reasons it reports, so a reason without a usable
 *  `code` is dropped rather than guessed at. */
function normalizeAttention(value: unknown): AttentionReason[] {
  if (typeof value !== 'object' || value === null) return []
  const reasons = (value as { reasons?: unknown }).reasons
  if (!Array.isArray(reasons)) return []
  const out: AttentionReason[] = []
  for (const item of reasons) {
    if (typeof item !== 'object' || item === null) continue
    const rec = item as Record<string, unknown>
    if (typeof rec.code !== 'string' || rec.code.length === 0) continue
    const reason: AttentionReason = {
      code: rec.code,
      detail: typeof rec.detail === 'string' && rec.detail.length > 0 ? rec.detail : null,
    }
    if (typeof rec.frameRef === 'string' && rec.frameRef.length > 0) reason.frameRef = rec.frameRef
    out.push(reason)
  }
  return out
}

/** The service's `notices: [{code, detail, cause}]` — a BARE list, unlike
 *  `attention`'s `{reasons: […]}` wrapper. Same rule as the reasons: an entry
 *  without a usable `code` is dropped rather than guessed at. */
function normalizeNotices(value: unknown): JobNotice[] {
  if (!Array.isArray(value)) return []
  const out: JobNotice[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue
    const rec = item as Record<string, unknown>
    if (typeof rec.code !== 'string' || rec.code.length === 0) continue
    out.push({
      code: rec.code,
      detail: typeof rec.detail === 'string' && rec.detail.length > 0 ? rec.detail : null,
      cause: typeof rec.cause === 'string' && rec.cause.length > 0 ? rec.cause : null,
    })
  }
  return out
}

/** A list of non-empty strings (e.g. `acknowledged` reason codes), or []. */
function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0)
}

/** Defensive projection of the proxy's pass-through jobs read (open wire shape). */
export function normalizeJobs(data: unknown): JobRow[] {
  const list = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null && Array.isArray((data as { jobs?: unknown }).jobs)
      ? ((data as { jobs: unknown[] }).jobs as unknown[])
      : []
  const rows: JobRow[] = []
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue
    const rec = item as Record<string, unknown>
    const id = [rec.jobId, rec.id].find((v): v is string => typeof v === 'string' && v.length > 0)
    if (!id) continue
    rows.push({
      id,
      name: typeof rec.name === 'string' ? rec.name : id,
      phase:
        typeof rec.phase === 'string'
          ? rec.phase
          : typeof rec.status === 'string'
            ? rec.status
            : '—',
      progress: typeof rec.progress === 'number' ? rec.progress : null,
      // Carried whenever the service attached one, regardless of the phase
      // word — if the service says why, the panel must be able to say why.
      error: normalizeJobError(rec.error),
      // Why the job is parked + how to release it — the data the resolver card
      // needs. Absent/healthy jobs project to empty, so the card simply won't
      // render for them.
      attention: normalizeAttention(rec.attention),
      // What the service couldn't check before running it. Never gates
      // anything, so it rides every phase — including the finished job, which
      // is where an unchecked bed is most worth knowing about.
      notices: normalizeNotices(rec.notices),
      startPolicy: typeof rec.startPolicy === 'string' ? rec.startPolicy : null,
      acknowledged: normalizeStringArray(rec.acknowledged),
      updatedAt: typeof rec.updatedAt === 'number' ? rec.updatedAt : null,
    })
  }
  return rows
}
