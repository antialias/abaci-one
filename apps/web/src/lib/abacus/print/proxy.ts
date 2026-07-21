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
import { getOwnedJob } from './job-ownership'
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
