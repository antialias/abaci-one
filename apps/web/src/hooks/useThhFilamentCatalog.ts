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
 * A read that can be expectedly unavailable. The proxy expresses "no service
 * / can't reach it / bad token" as HTTP statuses; those become data (not
 * thrown errors) so React Query doesn't retry-storm a printer that's simply
 * offline. Anything else is a real fault and throws.
 */
type Degradable<T> = { ok: true; value: T } | { ok: false; reason: PrintUnavailableReason }

function degradeReason(status: number): PrintUnavailableReason | null {
  if (status === 404) return 'not-configured'
  if (status === 502) return 'unreachable'
  if (status === 401 || status === 403) return 'unauthorized'
  return null
}

async function fetchDegradable<T>(path: string): Promise<Degradable<T>> {
  const res = await api(path)
  if (!res.ok) {
    const reason = degradeReason(res.status)
    if (reason) return { ok: false, reason }
    throw new Error(`${path} failed: ${res.status}`)
  }
  return { ok: true, value: (await res.json()) as T }
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
 */
export function useThhFilamentCatalog() {
  const printers = useQuery({
    queryKey: abacusPrintKeys.printers(),
    queryFn: () => fetchDegradable<ThhPrintersResponse>('abacus/print/printers'),
    staleTime: 60_000,
  })

  const printerId = useMemo(() => {
    if (!printers.data?.ok) return null
    const rows = printers.data.value.printers ?? []
    return (rows.find((p) => p.multiMaterial) ?? rows[0])?.id ?? null
  }, [printers.data])

  const filaments = useQuery({
    queryKey: abacusPrintKeys.filaments(printerId ?? 'none'),
    queryFn: () =>
      fetchDegradable<ThhFilamentsResponse>(
        `abacus/print/printers/${encodeURIComponent(printerId ?? '')}/filaments`
      ),
    enabled: printerId !== null,
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

  return {
    catalog,
    printerId,
    unavailable,
    isLoading: printers.isLoading || (printerId !== null && filaments.isLoading),
    isFetching: printers.isFetching || filaments.isFetching,
  }
}
