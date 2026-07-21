/**
 * Browser transport for `@eink/print-dialog`'s client (Phase 2b, Gitea #9).
 *
 * The kit's `TransportFetch` is structural (it compiles with no DOM lib), so
 * the browser side supplies this tiny adapter over the real `fetch`. Auth and
 * tenancy live entirely here, at the kit's designed seam: requests go to
 * abaci's own proxy (`/api/abacus/print/*`) with the session cookie, and the
 * `?connectionId=` selector rides as a query param so the kit's `basePath`
 * stays a plain prefix. The kit does its own ETag revalidation, so the HTTP
 * cache is bypassed (`no-store`) — one caching layer, not two.
 */
import {
  createPrintServiceClient,
  type PrintServiceClient,
  type TransportFetch,
} from '@eink/print-dialog'

/** The proxy prefix all print-service reads go through. */
export const PRINT_PROXY_BASE_PATH = '/api/abacus/print'

/** Append `connectionId` to a URL that may or may not already have a query. */
function withConnectionId(url: string, connectionId: string | undefined): string {
  if (!connectionId) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}connectionId=${encodeURIComponent(connectionId)}`
}

/**
 * A `TransportFetch` over the browser's `fetch`, scoped to one connection.
 * Omit `connectionId` to let the proxy fall back to the user's sole connection.
 */
export function createProxyTransportFetch(connectionId?: string): TransportFetch {
  return (url, init) =>
    fetch(withConnectionId(url, connectionId), {
      method: init?.method,
      headers: init?.headers ? { ...init.headers } : undefined,
      // The kit's abort semantics detach the caller rather than cancel the
      // request; only forward a signal that is a real DOM AbortSignal.
      signal: init?.signal instanceof AbortSignal ? init.signal : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
    })
}

/** The package client aimed at abaci's proxy for one connection. */
export function createAbacusPrintClient(connectionId?: string): PrintServiceClient {
  return createPrintServiceClient({
    fetch: createProxyTransportFetch(connectionId),
    basePath: PRINT_PROXY_BASE_PATH,
  })
}
