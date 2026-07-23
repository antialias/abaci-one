'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  type FilamentCatalog,
  thhFilamentsToCatalog,
} from '@/components/create/abacus/abacus-catalog'
import type {
  PrintUnavailableReason,
  ThhFilamentsResponse,
  ThhPrintersResponse,
} from '@/lib/abacus/print/filament-wire'
import { api } from '@/lib/queryClient'
import { abacusPrintKeys } from '@/lib/queryKeys'

/**
 * A read whose failures are all data, never thrown. The proxy expresses its
 * failure modes as HTTP statuses; we turn EVERY non-2xx into a surfaced reason
 * so (a) React Query never retry-storms a printer that's simply offline, and
 * (b) nothing gets swallowed into a dead loader. "Falling back" used to mean an
 * unmapped status threw, React Query went to `isError`, and the panel — which
 * only reads `data` — showed an eternal spinner with no error and no
 * remediation. Now the status becomes a `reason` the panel can act on.
 */
type Degradable<T> = { ok: true; value: T } | { ok: false; reason: PrintUnavailableReason }

function degradeReason(status: number): PrintUnavailableReason {
  if (status === 404) return 'not-configured'
  if (status === 502) return 'unreachable'
  if (status === 401 || status === 403) return 'unauthorized'
  // 400 (ambiguous connection), 5xx, anything else: a real failure the user must
  // see. Surfaced generically rather than masked.
  return 'error'
}

async function fetchDegradable<T>(path: string): Promise<Degradable<T>> {
  try {
    const res = await api(path)
    if (!res.ok) return { ok: false, reason: degradeReason(res.status) }
    return { ok: true, value: (await res.json()) as T }
  } catch {
    // A rejected fetch or malformed body — the proxy itself is down or broke.
    // Surface it as state instead of throwing into React Query's error path
    // (which the studio renders as a contentless loader).
    return { ok: false, reason: 'error' }
  }
}

/**
 * The live filament roster for the Abacus Studio print projection (#8.5),
 * read through the abacus print proxy: discover printers, prefer the
 * multi-material one, project its loaded-AMS roster onto FilamentCatalog.
 *
 * Server state, so it lives behind React Query (never `fetch()` in a
 * component). Returns `catalog: null` plus an `unavailable` reason whenever
 * the service isn't paired or reachable — the studio then falls back to the
 * params-derived, color-only catalog. AMS state changes slowly, so reads are
 * cached for a minute; doorbell invalidations (#8.4) refresh them early.
 *
 * `enabled` gates the whole read: the paper/express fabrication lane passes
 * false so it never touches the print service (no printer discovery, no AMS
 * poll) — only the 3D-print target pays for the filament roster.
 */
export interface UseThhFilamentCatalogOptions {
  enabled?: boolean
  /** The connection to read against. Omit to let the proxy fall back to the
   *  user's sole connection; required once they've paired more than one, or the
   *  proxy 400s ("Multiple connections — pass ?connectionId="). */
  connectionId?: string
}

export function useThhFilamentCatalog({
  enabled = true,
  connectionId,
}: UseThhFilamentCatalogOptions = {}) {
  const cq = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : ''
  const printers = useQuery({
    queryKey: abacusPrintKeys.printers(connectionId),
    queryFn: () => fetchDegradable<ThhPrintersResponse>(`abacus/print/printers${cq}`),
    enabled,
    staleTime: 60_000,
  })

  // The printer the roster + submit target: the AMS-equipped one if any, else the
  // first. We keep the whole row (not just the id) so the panel can word an
  // empty-roster notice correctly — an AMS printer with nothing loaded reads very
  // differently from a single-extruder printer that has no AMS at all.
  const chosenPrinter = useMemo(() => {
    if (!printers.data?.ok) return null
    const rows = printers.data.value.printers ?? []
    return rows.find((p) => p.multiMaterial) ?? rows[0] ?? null
  }, [printers.data])
  const printerId = chosenPrinter?.id ?? null

  const filaments = useQuery({
    queryKey: abacusPrintKeys.filaments(printerId ?? 'none', connectionId),
    queryFn: () =>
      fetchDegradable<ThhFilamentsResponse>(
        `abacus/print/printers/${encodeURIComponent(printerId ?? '')}/filaments${cq}`
      ),
    enabled: enabled && printerId !== null,
    staleTime: 60_000,
  })

  const catalog: FilamentCatalog | null = useMemo(() => {
    if (!filaments.data?.ok) return null
    return thhFilamentsToCatalog(
      filaments.data.value.filaments ?? [],
      new Date(filaments.dataUpdatedAt || Date.now()).toISOString()
    )
  }, [filaments.data, filaments.dataUpdatedAt])

  const unavailable: PrintUnavailableReason | null =
    printers.data && !printers.data.ok
      ? printers.data.reason
      : printers.data?.ok && printerId === null
        ? 'no-printer'
        : filaments.data && !filaments.data.ok
          ? filaments.data.reason
          : null

  // Printer found + roster read cleanly, but it reports zero loaded spools. This
  // is NOT a failure (unavailable stays null) — the service is fine, there's just
  // nothing loaded (empty AMS, or a single-extruder printer whose direct spool the
  // AMS-only roster never lists). The studio falls back to the params catalog for
  // the preview; the panel surfaces this explicitly rather than showing a mute
  // disabled button, since it's a distinct, actionable state.
  const rosterEmpty =
    filaments.data?.ok === true && (filaments.data.value.filaments?.length ?? 0) === 0

  // Live AMS presence from the roster read (things-haunt-house#382): true/false
  // when the service reports it, `undefined` against a pre-#382 service that omits
  // the flag. The panel resolves the tri-state with `amsPresent ?? printerMultiMaterial`
  // (?? not ||): a live `false` must NOT fall through to the static model capability —
  // that's the whole point of preferring the live signal — while an absent flag falls
  // back to exactly today's behavior.
  const amsPresent: boolean | undefined = filaments.data?.ok
    ? filaments.data.value.amsPresent
    : undefined

  // A spool IS loaded on the external holder, but THH couldn't resolve its material
  // (`external:true` with a null/empty family). The catalog dropped that row (no
  // PLA default — honest-unknown), so we recover the signal from the RAW rows here.
  // The panel uses it to say "loaded but unidentified" instead of "nothing loaded".
  const externalUnprintable =
    filaments.data?.ok === true &&
    (filaments.data.value.filaments ?? []).some((r) => r.external === true && !r.family)

  return {
    catalog,
    printerId,
    printerMultiMaterial: chosenPrinter?.multiMaterial ?? false,
    rosterEmpty,
    amsPresent,
    externalUnprintable,
    unavailable,
    isLoading: printers.isLoading || (printerId !== null && filaments.isLoading),
    isFetching: printers.isFetching || filaments.isFetching,
  }
}
