import 'server-only'

// Server-side THH print-gateway client for the Abacus Studio filament catalog
// (Gitea epic #5, P3). Reads the printer's currently-loaded AMS spools so the
// studio can quantize a design onto what the machine can actually lay down.
//
// Auth: a server-held bearer token (never shipped to the browser — that's why
// this module is `server-only` and the studio reaches it through the
// /api/print/filaments route). The token is a paired or env credential on the
// THH side; here it's just `THH_PRINT_TOKEN`. The path prefix is `/api/print/v1`
// (see ./types on why that's not a "v1 vs v2" choice).
//
// Every failure is a typed, expected outcome — the studio degrades to the
// params catalog rather than erroring — so this returns a discriminated result
// and never throws for a network/auth problem.

import type { ThhFilamentRow, ThhPrinterRow, ThhUnavailableReason } from './types'

const DEFAULT_ORIGIN = 'https://things.haunt.house'
const REQUEST_TIMEOUT_MS = 5000

export type ThhClientResult =
  | { ok: true; printerId: string; rows: ThhFilamentRow[]; fetchedAt: string }
  | { ok: false; reason: ThhUnavailableReason }

type FetchImpl = typeof fetch
type Env = Record<string, string | undefined>

// Read config per-call (not at module load) so the route always sees current
// env and tests can inject. Never logs the token.
function readConfig(env: Env) {
  const token = env.THH_PRINT_TOKEN?.trim()
  const origin = (env.THH_PRINT_ORIGIN?.trim() || DEFAULT_ORIGIN).replace(/\/+$/, '')
  const printerId = env.THH_PRINT_PRINTER_ID?.trim() || null
  return { token, origin, printerId }
}

// A GET that resolves to the parsed body + status, or the sentinel 'network'
// when the request never completed (DNS, timeout, connection refused).
type GetResult = { status: number; json: unknown } | 'network'

function normalizePrinters(json: unknown): ThhPrinterRow[] | null {
  const arr = Array.isArray(json) ? json : (json as { printers?: unknown } | null)?.printers
  if (!Array.isArray(arr)) return null
  return arr.filter((p): p is ThhPrinterRow => typeof (p as ThhPrinterRow)?.id === 'string')
}

function normalizeFilaments(json: unknown): ThhFilamentRow[] | null {
  const arr = Array.isArray(json) ? json : (json as { filaments?: unknown } | null)?.filaments
  if (!Array.isArray(arr)) return null
  return arr as ThhFilamentRow[]
}

// Map a completed-but-unhappy response to the reason the studio should show.
// 401/403 → unauthorized; 5xx → treat as unreachable (gateway hiccup, retry
// later); anything else the caller decides.
function statusReason(status: number): ThhUnavailableReason | null {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status >= 500) return 'unreachable'
  return null
}

export async function getLoadedFilaments(
  opts: { env?: Env; fetchImpl?: FetchImpl } = {}
): Promise<ThhClientResult> {
  const env = opts.env ?? process.env
  const doFetch = opts.fetchImpl ?? fetch
  const { token, origin, printerId: configuredId } = readConfig(env)
  if (!token) return { ok: false, reason: 'not-configured' }

  const get = async (path: string): Promise<GetResult> => {
    try {
      const res = await doFetch(`${origin}${path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: 'no-store',
      })
      let json: unknown = null
      try {
        json = await res.json()
      } catch {
        json = null
      }
      return { status: res.status, json }
    } catch {
      return 'network'
    }
  }

  // 1. Resolve the printer: an explicit env id, else discover the multi-material
  //    one (the studio needs an AMS; fall back to the first row if none flags it).
  let printerId = configuredId
  if (!printerId) {
    const r = await get('/api/print/v1/printers')
    if (r === 'network') return { ok: false, reason: 'unreachable' }
    const reason = statusReason(r.status)
    if (reason) return { ok: false, reason }
    const rows = normalizePrinters(r.json)
    if (!rows) return { ok: false, reason: 'bad-response' }
    const pick = rows.find((p) => p.multiMaterial) ?? rows[0]
    if (!pick) return { ok: false, reason: 'no-printer' }
    printerId = pick.id
  }

  // 2. The loaded filaments for that printer.
  const r = await get(`/api/print/v1/printers/${encodeURIComponent(printerId)}/filaments`)
  if (r === 'network') return { ok: false, reason: 'unreachable' }
  if (r.status === 404) return { ok: false, reason: 'no-printer' }
  const reason = statusReason(r.status)
  if (reason) return { ok: false, reason }
  const rows = normalizeFilaments(r.json)
  if (!rows) return { ok: false, reason: 'bad-response' }

  return { ok: true, printerId, rows, fetchedAt: new Date().toISOString() }
}
