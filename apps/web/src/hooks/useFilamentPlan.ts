'use client'

import { type FilamentPlanRequestV1, type FilamentPlanResponseV1, readFilamentPlanResponse } from '@eink/print-dialog'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { filamentPlanRequestKey } from '@/components/create/abacus/abacus-plan-request'
import type { PrintUnavailableReason } from '@/lib/abacus/print/filament-wire'
import { api } from '@/lib/queryClient'
import { abacusPrintKeys } from '@/lib/queryKeys'

/**
 * The service's filament plan for a design (THH#442 / Gitea #37) — which loaded
 * spool each palette role prints in, decided by the printer rather than by a
 * local color approximation.
 *
 * This read is what makes the swap from `materialize`'s synchronous redmean
 * match honest: the question "which spool is closest, compatible, and actually
 * loaded" cannot be answered from the browser, so the answer arrives over the
 * wire and therefore arrives late. The cost of `late` is paid entirely by the
 * query key (see `abacusPrintKeys.filamentPlan`), which names both inputs the
 * plan depends on — the request bytes and the roster bytes — so a cached plan is
 * correct by construction and a changed roster cannot be painted stale.
 *
 * Failures degrade rather than throw, matching `useThhFilamentCatalog`: a print
 * service that is unpaired, offline or upgrading leaves the studio rendering the
 * DESIGNED colors with the print path closed, never an error page and never a
 * spinner with no way out.
 */

type PlanResult =
  | { ok: true; value: FilamentPlanResponseV1 }
  | { ok: false; reason: PrintUnavailableReason }

function degradeReason(status: number): PrintUnavailableReason {
  if (status === 404) return 'not-configured'
  if (status === 502) return 'unreachable'
  if (status === 401 || status === 403) return 'unauthorized'
  return 'error'
}

async function fetchPlan(path: string, request: FilamentPlanRequestV1): Promise<PlanResult> {
  try {
    const res = await api(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    // A plan the printer can't fully satisfy is a 200 carrying `degraded` /
    // `unresolved` — the studio renders those as warnings. Only transport and
    // validation failures land here.
    if (!res.ok) return { ok: false, reason: degradeReason(res.status) }
    // Guard the boundary: `readFilamentPlanResponse` throws on anything that
    // isn't a plan, which is what keeps a proxy error page or a stray HTML body
    // from being consumed as assignments. It becomes a degrade, not a crash.
    return { ok: true, value: readFilamentPlanResponse(await res.json()) }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

export interface UseFilamentPlanOptions {
  /** Null until a printer is discovered — the plan is printer-specific. */
  printerId: string | null
  /** The design's intent. Null disables the read (nothing to plan). */
  request: FilamentPlanRequestV1 | null
  /** Identity of the raw roster, from `useThhFilamentCatalog`. */
  rosterSignature: string
  connectionId?: string
  enabled?: boolean
}

export function useFilamentPlan({
  printerId,
  request,
  rosterSignature,
  connectionId,
  enabled = true,
}: UseFilamentPlanOptions) {
  const requestKey = request ? filamentPlanRequestKey(request) : ''
  const cq = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : ''

  // An empty roster signature means the roster read hasn't landed (or failed).
  // Planning against a roster we haven't seen would cache the answer under a key
  // that can't distinguish "no roster yet" from "roster with nothing loaded".
  const ready = enabled && printerId !== null && request !== null && rosterSignature !== ''

  const query = useQuery({
    queryKey: abacusPrintKeys.filamentPlan(
      printerId ?? 'none',
      requestKey,
      rosterSignature,
      connectionId
    ),
    queryFn: () =>
      fetchPlan(
        `abacus/print/printers/${encodeURIComponent(printerId ?? '')}/filament-plan${cq}`,
        request as FilamentPlanRequestV1
      ),
    enabled: ready,
    // The key already names every input, so a cached entry can never be wrong —
    // only evicted. `Infinity` says exactly that: don't re-ask a question whose
    // inputs are pinned in the key. Freshness comes from the roster read's own
    // 60s staleness moving the key, not from re-polling the planner.
    //
    // INVALIDATION is therefore structural, and there is deliberately nothing to
    // invalidate on a roster change: the doorbell's `filaments(printerId)` bust
    // refetches the roster, the new rows produce a new `rosterSignature`, and the
    // plan moves to a different key on its own. A prefix bust of
    // `abacusPrintKeys.all` (connection switch, manual refresh) still reaches this
    // query as a backstop.
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 10 * 60_000,
    // Hold the previous answer while a new key resolves, so clicking a pin does
    // not blank the mapping panel and flip the 3D hero to the designed colors for
    // one frame. The stale answer is only ever wrong about the thing that just
    // changed, and the pin — the one thing the user is looking at — is echoed
    // locally by `materialize` on the same frame.
    //
    // The safety this rests on: `materialize` warns 'plan-unresolved' only for a
    // role the service EXPLICITLY could not place, never for one this answer
    // simply doesn't mention. Without that split, a design change would flash "no
    // loaded filament can serve this" about a role the planner has not been asked
    // about yet.
    placeholderData: keepPreviousData,
  })

  return {
    plan: query.data?.ok ? query.data.value : null,
    unavailable: query.data && !query.data.ok ? query.data.reason : null,
    isLoading: ready && query.isLoading,
    isFetching: query.isFetching,
    /** True while `plan` is the PREVIOUS key's answer and a fresh one is in flight. */
    isPlaceholder: query.isPlaceholderData,
  }
}
