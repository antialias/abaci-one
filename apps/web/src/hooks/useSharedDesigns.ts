'use client'

// The caller's shared-design ledger (Gitea #24).
//
// The share toggle can only ever address the design currently on screen, and a
// design id is an immutable content snapshot — so the moment you edit past a
// design you shared, the studio rewrites the address bar (router.replace, no
// history entry) and that design becomes unreachable while staying public.
// This is the way back: every design of yours that is currently open to the
// world, with a one-click un-share on each.
//
// Un-sharing here is the same DELETE the toggle uses, so the two can never
// disagree — and it invalidates the toggle's key, in case the row you just
// revoked happens to be the design on screen.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'
import { abacusDesignKeys } from '@/lib/queryKeys'

export interface SharedDesignSummary {
  id: string
  sharedAt: number | null
  /** column count, or null if the stored envelope no longer parses */
  cols: number | null
  /** the engraved top text, when there is one — usually whose abacus it is */
  label: string | null
}

async function fetchSharedDesigns(): Promise<{
  designs: SharedDesignSummary[]
  truncated: boolean
}> {
  const res = await api('abacus/designs')
  if (!res.ok) throw new Error('Failed to load shared designs')
  const data: unknown = await res.json()
  const raw = (data as { designs?: unknown } | null)?.designs
  const designs = Array.isArray(raw) ? (raw as SharedDesignSummary[]) : []
  return { designs, truncated: (data as { truncated?: unknown } | null)?.truncated === true }
}

export function useSharedDesigns() {
  const queryClient = useQueryClient()
  const key = abacusDesignKeys.sharedList()

  const query = useQuery({
    queryKey: key,
    queryFn: fetchSharedDesigns,
    retry: false,
    staleTime: 30_000,
  })

  const unshare = useMutation({
    mutationFn: async (designId: string): Promise<string> => {
      const res = await api(`abacus/designs/${encodeURIComponent(designId)}/share`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to un-share design')
      return designId
    },
    onSuccess: (designId) => {
      queryClient.setQueryData<{ designs: SharedDesignSummary[]; truncated: boolean }>(
        key,
        (prev) =>
          prev ? { ...prev, designs: prev.designs.filter((d) => d.id !== designId) } : prev
      )
      // the revoked row may be the design on screen — let its toggle catch up
      queryClient.invalidateQueries({ queryKey: abacusDesignKeys.share(designId) })
    },
  })

  return {
    designs: query.data?.designs ?? [],
    truncated: query.data?.truncated ?? false,
    unshare: unshare.mutate,
    /** which row is in flight, so only that row's control goes quiet */
    unsharingId: unshare.isPending ? (unshare.variables ?? null) : null,
    unshareFailed: unshare.isError,
  }
}
