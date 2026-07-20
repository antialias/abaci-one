'use client'

import { useQuery } from '@tanstack/react-query'
import type { FilamentCatalog } from '@/components/create/abacus/abacus-catalog'
import { api } from '@/lib/queryClient'
import { abacusFilamentKeys } from '@/lib/queryKeys'
import type { ThhUnavailableReason } from '@/lib/thh/types'

type FilamentCatalogResponse =
  | { ok: true; catalog: FilamentCatalog }
  | { ok: false; reason: ThhUnavailableReason }

async function fetchThhCatalog(): Promise<FilamentCatalogResponse> {
  const res = await api('print/filaments')
  // The route reports expected-unavailable as 200 { ok:false }; a non-2xx here
  // means an unexpected server fault, which React Query should treat as an error.
  if (!res.ok) throw new Error(`Filament catalog request failed: ${res.status}`)
  return res.json()
}

/**
 * The THH loaded-AMS filament catalog for the Abacus Studio print projection.
 *
 * Server state, so it lives behind React Query (never `fetch()` in a component).
 * Returns `catalog: null` plus an `unavailable` reason whenever THH isn't
 * configured or reachable — the studio then falls back to the params-derived,
 * color-only catalog. The AMS state changes slowly, so it's cached for a minute.
 */
export function useThhFilamentCatalog() {
  const query = useQuery({
    queryKey: abacusFilamentKeys.catalog(),
    queryFn: fetchThhCatalog,
    staleTime: 60_000,
  })
  const data = query.data
  return {
    catalog: data?.ok ? data.catalog : null,
    unavailable: data && !data.ok ? data.reason : null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  }
}
