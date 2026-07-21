/**
 * Jobs-roster projection for the print panel (gh#162).
 *
 * The `/api/abacus/print/jobs` proxy passes the service's job list through
 * untouched, so this is the ONLY place the wire shape is interpreted. The
 * error carries the service's own explanation of a failure — it must survive
 * the projection verbatim (dropping it is exactly how the first real print
 * failure rendered as a bare `failed`).
 */

export type JobError = { code: string; message: string | null }

export type JobRow = {
  id: string
  name: string
  phase: string
  progress: number | null
  error: JobError | null
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
    })
  }
  return rows
}
