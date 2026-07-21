/**
 * Server-side transport to a THH print service (Abacus Studio Phase 2a, #8).
 *
 * This is transport, not a client: it knows the fixed REST prefix
 * (`/api/print/v1` — "v2" names the *ticket format*, the URL never changes),
 * injects the connection's bearer token, and normalizes the service's error
 * envelope. It holds no endpoint paths and no HTTP semantics beyond that —
 * routes pass paths through verbatim, and the shared `@eink/print-dialog`
 * client provides the typed protocol surface browser-side.
 */
import { open } from '@/lib/secret-box'

/** Fixed REST base path on the print service. */
export const PRINT_SERVICE_BASE_PATH = '/api/print/v1'

const DEFAULT_TIMEOUT_MS = 5_000

/** The slice of a print_service_connections row the transport needs. */
export interface PrintServiceTarget {
  /** Service origin, e.g. "https://things.haunt.house" (trailing slash tolerated) */
  origin: string
  /** secret-box-sealed bearer token; omit only for the unauthenticated /pair call */
  tokenSealed?: string
}

/**
 * Typed failure from the print service or the network path to it.
 * `status` is the upstream HTTP status, or 0 for network/timeout failures.
 * `code` is the service's machine code from `{detail: {code, message}}`
 * (e.g. "invalid_style", "printer_busy", "not_pairable"), or a transport
 * synthetic: "unreachable" (network/timeout) / "bad_response" (unparseable).
 */
export class PrintServiceError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'PrintServiceError'
    this.status = status
    this.code = code
  }
}

export interface PrintServiceFetchInit extends Omit<RequestInit, 'cache' | 'signal'> {
  /** Override the default 5s timeout (e.g. multipart job submit) */
  timeoutMs?: number
}

/**
 * Fetch `${origin}/api/print/v1${path}` with auth injected.
 *
 * Returns the raw upstream Response — including non-2xx and 304 — so
 * pass-through proxy routes can relay status/headers/body byte-faithfully.
 * Throws {@link PrintServiceError} (status 0, code "unreachable") only when no
 * HTTP response was obtained at all. Callers wanting throw-on-error semantics
 * layer {@link ensureOk} on top.
 */
export async function printServiceFetch(
  target: PrintServiceTarget,
  path: string,
  init: PrintServiceFetchInit = {}
): Promise<Response> {
  const { timeoutMs, headers: initHeaders, ...rest } = init
  const origin = target.origin.replace(/\/+$/, '')
  const headers = new Headers(initHeaders)
  if (target.tokenSealed) headers.set('Authorization', `Bearer ${open(target.tokenSealed)}`)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')

  try {
    return await fetch(`${origin}${PRINT_SERVICE_BASE_PATH}${path}`, {
      ...rest,
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs ?? DEFAULT_TIMEOUT_MS),
    })
  } catch (err) {
    throw new PrintServiceError(
      0,
      'unreachable',
      `print service unreachable: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

/**
 * Resolve a non-OK Response into a thrown {@link PrintServiceError}, parsing
 * the service's `{detail: {code, message}}` envelope (falling back to
 * "bad_response" when the body isn't that shape). Returns the Response
 * unchanged when `res.ok`.
 */
export async function ensureOk(res: Response): Promise<Response> {
  if (res.ok) return res
  let code = 'bad_response'
  let message = `print service returned ${res.status}`
  try {
    const body = (await res.json()) as { detail?: { code?: string; message?: string } }
    if (body?.detail?.code) code = body.detail.code
    if (body?.detail?.message) message = body.detail.message
  } catch {
    // non-JSON error body — keep the fallbacks
  }
  throw new PrintServiceError(res.status, code, message)
}
