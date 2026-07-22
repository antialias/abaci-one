/**
 * Byte-faithful proxy plumbing for print-service pass-through routes
 * (Abacus Studio Phase 2a, #8.3).
 *
 * The proxy adds auth + tenancy and NOTHING else: request bodies and
 * upstream responses flow through unmodified (the single sanctioned
 * exception — stamping `job.source.app` on submit — lives in the submit
 * route, not here). Conditional-request headers are forwarded so the
 * package client's ETag revalidation works end-to-end.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getOwnedConnection, resolveConnection } from './connections'
import { getOwnedJob, listOwnedJobIds } from './job-ownership'
import { PrintServiceError, printServiceFetch } from './print-service-fetch'

/** Request headers forwarded upstream (conditional reads + content negotiation). */
const FORWARD_REQUEST_HEADERS = ['if-none-match', 'if-modified-since', 'accept', 'content-type']

/** Response headers relayed back to the browser. */
const RELAY_RESPONSE_HEADERS = [
  'etag',
  'content-type',
  'cache-control',
  'last-modified',
  'content-disposition',
]

/** Re-emit an upstream Response with status + allow-listed headers, streaming the body. */
export function relayResponse(upstream: Response): Response {
  const headers = new Headers()
  for (const name of RELAY_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  return new Response(upstream.body, { status: upstream.status, headers })
}

/** Map proxy-layer failures (never upstream HTTP errors — those relay raw). */
export function proxyErrorResponse(error: unknown): NextResponse {
  if (error instanceof PrintServiceError && error.code === 'unreachable') {
    return NextResponse.json({ error: 'Print service unreachable' }, { status: 502 })
  }
  if (error instanceof Error && typeof (error as { status?: unknown }).status === 'number') {
    // resolveConnection's typed 400/404
    return NextResponse.json(
      { error: error.message },
      { status: (error as unknown as { status: number }).status }
    )
  }
  console.error('[print-proxy] unexpected failure:', error)
  return NextResponse.json({ error: 'Print proxy failure' }, { status: 500 })
}

/**
 * The standard pass-through: resolve the caller's connection (explicit
 * `?connectionId=` or their sole one), forward the request to
 * `upstreamPath`, relay the response byte-faithfully.
 */
export async function proxyPass(
  request: NextRequest,
  userId: string,
  upstreamPath: string,
  init: { timeoutMs?: number } = {}
): Promise<Response> {
  try {
    const connection = await resolveConnection(
      userId,
      request.nextUrl.searchParams.get('connectionId')
    )

    const headers = new Headers()
    for (const name of FORWARD_REQUEST_HEADERS) {
      const value = request.headers.get(name)
      if (value) headers.set(name, value)
    }

    const method = request.method
    const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer()

    const upstream = await printServiceFetch(
      { origin: connection.origin, tokenSealed: connection.tokenSealed },
      upstreamPath,
      { method, headers, body, timeoutMs: init.timeoutMs }
    )
    return relayResponse(upstream)
  } catch (error) {
    return proxyErrorResponse(error)
  }
}

/** The service job id, matched the way the client projection (`normalizeJobs`)
 *  keys on it — `jobId` first, then `id` — so the ownership intersection lines
 *  up exactly with the rows the panel renders. */
function rosterJobId(job: unknown): string | undefined {
  if (typeof job !== 'object' || job === null) return undefined
  const rec = job as Record<string, unknown>
  return [rec.jobId, rec.id].find((v): v is string => typeof v === 'string' && v.length > 0)
}

/**
 * Intersect an upstream roster payload with the caller's owned job ids,
 * preserving the payload's outer shape (a bare array or a `{jobs: [...]}`
 * envelope) so the client's `normalizeJobs` sees the exact structure it already
 * parses — just scoped to jobs this user submitted through abaci.
 */
export function filterRosterToOwned(body: unknown, owned: Set<string>): unknown {
  const keep = (job: unknown): boolean => {
    const id = rosterJobId(job)
    return id !== undefined && owned.has(id)
  }
  if (Array.isArray(body)) return body.filter(keep)
  if (typeof body === 'object' && body !== null) {
    const rec = body as Record<string, unknown>
    if (Array.isArray(rec.jobs)) return { ...rec, jobs: rec.jobs.filter(keep) }
  }
  // Unknown shape ⇒ fail closed: an ownership filter must never leak the raw list.
  return []
}

/**
 * Ownership-scoped roster read for `GET /jobs`.
 *
 * Unlike {@link proxyPass}, this CANNOT relay byte-faithfully. The print
 * service's bearer token is shared by every app paired to that service, so its
 * raw `/jobs` list includes jobs abaci never submitted (other integrators) and
 * jobs owned by other abaci users. We fetch the upstream list, intersect it
 * with THIS user's ownership rows, and return only their jobs — the same
 * tenancy rule {@link proxyPassForJob} enforces per job, applied to the list.
 *
 * ETag/conditional relay is intentionally dropped: the upstream validators
 * describe the *unfiltered* list, so honoring them would leak or stale the
 * scoped view. The roster is small and React Query caches it client-side.
 */
export async function proxyRosterForOwner(
  request: NextRequest,
  userId: string,
  init: { timeoutMs?: number } = {}
): Promise<Response> {
  try {
    const connection = await resolveConnection(
      userId,
      request.nextUrl.searchParams.get('connectionId')
    )

    const upstream = await printServiceFetch(
      { origin: connection.origin, tokenSealed: connection.tokenSealed },
      '/jobs',
      { method: 'GET', timeoutMs: init.timeoutMs }
    )

    // Upstream non-2xx: relay raw — there's no list to scope, and the client's
    // `!res.ok` path wants the real status.
    if (!upstream.ok) return relayResponse(upstream)

    const [owned, body] = await Promise.all([
      listOwnedJobIds(userId),
      upstream.json() as Promise<unknown>,
    ])
    return NextResponse.json(filterRosterToOwned(body, owned))
  } catch (error) {
    return proxyErrorResponse(error)
  }
}

/**
 * Pass-through for `jobs/[jobId]` sub-routes. The connection comes from the
 * job's ownership row (recorded at submit) — a job the caller didn't submit
 * through abaci is indistinguishable from a nonexistent one (404), and
 * `?connectionId=` is ignored.
 */
export async function proxyPassForJob(
  request: NextRequest,
  userId: string,
  jobId: string,
  buildPath: (encodedJobId: string) => string,
  init: { timeoutMs?: number } = {}
): Promise<Response> {
  try {
    const owned = await getOwnedJob(userId, jobId)
    const connection = owned && (await getOwnedConnection(userId, owned.connectionId))
    if (!connection) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const headers = new Headers()
    for (const name of FORWARD_REQUEST_HEADERS) {
      const value = request.headers.get(name)
      if (value) headers.set(name, value)
    }

    const method = request.method
    const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer()

    const upstream = await printServiceFetch(
      { origin: connection.origin, tokenSealed: connection.tokenSealed },
      buildPath(encodeURIComponent(jobId)),
      { method, headers, body, timeoutMs: init.timeoutMs }
    )
    return relayResponse(upstream)
  } catch (error) {
    return proxyErrorResponse(error)
  }
}
