'use client'

// Design-snapshot read/write (Gitea #22): the `?design=<id>` deep link's data
// side. The read hydrates the studio once per id (snapshots are immutable
// content behind an immutable id — staleTime Infinity, no retry on the
// permanent 404 the access gate answers). The write is the submit-path helper:
// TOTAL by contract — a failed snapshot degrades the print's edit link to
// today's shallow form, it must never block or fail the print itself.

import { useQuery } from '@tanstack/react-query'
import {
  type AbacusDesignProvenance,
  type AbacusDesignSnapshot,
  parseDesignSnapshot,
} from '@/lib/abacus/design-snapshot'
import { api } from '@/lib/queryClient'
import { abacusDesignKeys } from '@/lib/queryKeys'

/** How long the snapshot POST may take before the submit stops waiting on it.
 *  Generous vs the render it races (which has a 180s budget) but bounded — a
 *  hung snapshot must not hold the whole print hostage. */
const PERSIST_TIMEOUT_MS = 10_000

async function fetchDesignSnapshot(designId: string): Promise<AbacusDesignSnapshot> {
  const res = await api(`abacus/designs/${encodeURIComponent(designId)}`)
  if (!res.ok) throw new Error('Failed to fetch design snapshot')
  const data: unknown = await res.json()
  const design = parseDesignSnapshot((data as { design?: unknown } | null)?.design)
  if (!design) throw new Error('Design snapshot failed to parse')
  return design
}

/**
 * Hook: fetch a stored design snapshot for hydration. `isError` covers the
 * whole degrade family (denied, gone, unparseable) — the page maps it to the
 * "design unavailable" notice, mirroring `playerUnavailable`.
 */
export function useAbacusDesignSnapshot(designId: string | null) {
  return useQuery({
    queryKey: abacusDesignKeys.detail(designId ?? 'none'),
    queryFn: () => fetchDesignSnapshot(designId as string),
    enabled: Boolean(designId),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })
}

/**
 * Persist the studio's current design; resolves the stored id, or null on ANY
 * failure (network, refusal, timeout, junk response) — never throws. Identical
 * resubmits converge on the same id server-side (owner-scoped content hash).
 */
export async function persistAbacusDesign(
  design: AbacusDesignSnapshot,
  provenance: AbacusDesignProvenance
): Promise<string | null> {
  try {
    const res = await api('abacus/designs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ design, provenance }),
      signal: AbortSignal.timeout(PERSIST_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const body: unknown = await res.json().catch(() => null)
    const id = (body as { id?: unknown } | null)?.id
    return typeof id === 'string' && id.length > 0 ? id : null
  } catch {
    return null
  }
}
