'use client'

// Design sharing (Gitea #24) — the client half of the access sub-resource.
//
// Sharing is a property of an ALREADY-SAVED design, so this hook is keyed on
// the saved id, not on the ?design= URL param. A 404 from the read is the
// expected answer for "not yours" (and for a design that no longer exists):
// it is not an error to shout about, it simply means this viewer has no
// sharing to manage, so the UI hides the control.
//
// A 404 is NOT interchangeable with a failed request, and the difference is
// load-bearing: collapsing both into "not shared" made the studio tell a
// stranger reading a shared design that only they could open it, and made one
// flaky response render an owner's shared design as private with its revoke
// control missing. So the two are distinguished and the UI is told which of
// the three things it actually knows — see DesignShareAccess.
//
// The toggle is optimistic — one click should move the control, not wait on a
// round trip — and rolls back if the server refuses.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'
import { abacusDesignKeys } from '@/lib/queryKeys'

export interface DesignShareState {
  shared: boolean
  sharedAt: number | null
}

/**
 * What the viewer knows about who may open the saved design.
 * - `manageable` — it's yours (or you're an admin): `shared` is authoritative.
 * - `not-yours`  — a 404. You may still be READING it, in which case it is
 *   necessarily shared, since an unshared design 404s the read too.
 * - `unknown`    — not asked yet, or the request failed. Claim nothing.
 */
export type DesignShareAccess = 'manageable' | 'not-yours' | 'unknown'

const PRIVATE: DesignShareState = { shared: false, sharedAt: null }

/** A 404 from the access resource — "not yours", the one refusal that is an
 *  ANSWER rather than a failure. Tagged by name so the check survives bundling
 *  and duplicate module instances. */
class NotYoursError extends Error {
  constructor() {
    super('Not yours')
    this.name = 'NotYoursError'
  }
}

const isNotYours = (error: unknown) => error instanceof Error && error.name === 'NotYoursError'

async function fetchShareState(designId: string): Promise<DesignShareState> {
  const res = await api(`abacus/designs/${encodeURIComponent(designId)}/share`)
  if (res.status === 404) throw new NotYoursError()
  if (!res.ok) throw new Error('Failed to load sharing')
  const data: unknown = await res.json()
  const shared = (data as { shared?: unknown } | null)?.shared === true
  const rawAt = (data as { sharedAt?: unknown } | null)?.sharedAt
  return { shared, sharedAt: typeof rawAt === 'number' ? rawAt : null }
}

export function useAbacusDesignShare(designId: string | null) {
  const queryClient = useQueryClient()
  const key = abacusDesignKeys.share(designId ?? 'none')

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchShareState(designId as string),
    enabled: Boolean(designId),
    // "Not yours" is settled — asking again cannot change it. Anything else is
    // a failure worth retrying, because latching it would leave the owner
    // looking at a design that claims to be private and offers no way to
    // un-share it.
    retry: (failureCount, error) => !isNotYours(error) && failureCount < 2,
    staleTime: 30_000,
  })

  const mutation = useMutation({
    mutationFn: async (next: boolean): Promise<DesignShareState> => {
      const res = await api(`abacus/designs/${encodeURIComponent(designId as string)}/share`, {
        method: next ? 'POST' : 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to change sharing')
      return fetchShareState(designId as string)
    },
    onMutate: async (next: boolean) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<DesignShareState>(key)
      queryClient.setQueryData<DesignShareState>(key, {
        shared: next,
        sharedAt: next ? (previous?.sharedAt ?? Date.now()) : null,
      })
      return { previous }
    },
    onError: (_error, _next, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSuccess: (settled) => {
      queryClient.setQueryData(key, settled)
      // this design just entered or left the ledger of what you've made public
      queryClient.invalidateQueries({ queryKey: abacusDesignKeys.sharedList() })
    },
  })

  const access: DesignShareAccess = query.isSuccess
    ? 'manageable'
    : isNotYours(query.error)
      ? 'not-yours'
      : 'unknown'

  return {
    /** authoritative ONLY when access is 'manageable' — read it with `access` */
    shared: (query.data ?? PRIVATE).shared,
    access,
    /** the viewer owns this design and may flip its sharing */
    canShare: query.isSuccess,
    setShared: mutation.mutate,
    isPending: mutation.isPending,
    /** only the MUTATION's failure — a 404 read is an expected, silent answer */
    isError: mutation.isError,
  }
}
