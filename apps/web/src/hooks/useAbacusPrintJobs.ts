'use client'

// Abacus Studio — print-jobs roster + the two actions that RESOLVE a parked
// job (Gitea #9). All three go through abaci's ownership-gated proxy; the proxy
// relays THH byte-for-byte, so the roster read carries each job's `attention`
// reasons (see ./create/abacus/print-jobs projection) and the mutations post
// the exact bodies THH's start/cancel endpoints expect.
//
// State moves on doorbell rings (usePrintJobRing invalidates the roster key),
// so these mutations only need to invalidate the same key on success — the
// follow-up phase ring and this invalidate converge on a single refetch. No
// poll, no optimistic phase-guessing: the service is the source of truth.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type JobRow, normalizeJobs } from '@/components/create/abacus/print-jobs'
import { PrintServiceError } from '@/components/create/abacus/print-submit-failure'
import { api } from '@/lib/queryClient'
import { abacusPrintKeys } from '@/lib/queryKeys'

/** Start (or acknowledge-and-start) a parked job. `acknowledge` must list every
 *  reason code the job is parked on — THH refuses `acknowledgement_required`
 *  otherwise; a bare `ready` job takes `[]`. */
export interface StartPrintJobVars {
  jobId: string
  acknowledge: string[]
}

/** Cancel a job. A `printing` job requires `stopPrint: true` (THH refuses
 *  `job_printing` otherwise); a parked job cancels cleanly with `false`. */
export interface CancelPrintJobVars {
  jobId: string
  stopPrint: boolean
}

/**
 * The jobs roster, normalized. Read-only companion to the ring: the same query
 * key `usePrintJobRing` invalidates, so a ring or a mutation both land here.
 */
export function useAbacusPrintJobs(options: { enabled: boolean }) {
  const query = useQuery({
    queryKey: abacusPrintKeys.jobs(),
    queryFn: async (): Promise<unknown> => {
      const res = await api('abacus/print/jobs')
      if (!res.ok) throw new Error(`jobs read failed: ${res.status}`)
      return (await res.json()) as unknown
    },
    enabled: options.enabled,
    staleTime: 5_000,
  })
  const jobRows: JobRow[] = normalizeJobs(query.data)
  return { ...query, jobRows }
}

/** POST the start, throwing a {@link PrintServiceError} on refusal so the caller
 *  can render THH's honest, coded reason. Invalidates the roster on success. */
export function useStartPrintJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ jobId, acknowledge }: StartPrintJobVars): Promise<unknown> => {
      const res = await api(`abacus/print/jobs/${encodeURIComponent(jobId)}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledge }),
      })
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) throw new PrintServiceError(res.status, body)
      return body
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: abacusPrintKeys.jobs() })
    },
  })
}

/** POST the cancel/stop, throwing a {@link PrintServiceError} on refusal.
 *  Invalidates the roster on success. */
export function useCancelPrintJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ jobId, stopPrint }: CancelPrintJobVars): Promise<unknown> => {
      const res = await api(`abacus/print/jobs/${encodeURIComponent(jobId)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stopPrint }),
      })
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) throw new PrintServiceError(res.status, body)
      return body
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: abacusPrintKeys.jobs() })
    },
  })
}
