'use client'

// "My abacuses" (Gitea #11) — the caller's designs, and the client-side home of
// a design's mutable metadata: its name, and whether it's listed.
//
// Grown from #24's shared-design ledger, which existed for one reason: the share
// toggle can only ever address the design currently on screen, and a design id
// is an immutable content snapshot — so the moment you edit past a design you
// shared, the studio rewrites the address bar (router.replace, no history entry)
// and that design becomes unreachable while staying public. That promise now
// rides along inside a wider list, and the route keeps it by listing a shared
// design even when it's hidden.
//
// Un-sharing here is the same DELETE the toggle uses, so the two can never
// disagree — and it invalidates the toggle's key, in case the row you just
// revoked happens to be the design on screen.
//
// Removing is a HIDE, never a delete: design rows are permanent so that a
// ?design= link printed on a THH job card keeps resolving. It commits
// immediately and offers an undo (rather than deferring behind a timer) because
// a hide is reversible server-side — nothing is lost while the offer stands.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/queryClient'
import { abacusDesignKeys } from '@/lib/queryKeys'

/** How long the undo offer stands after a removal. Long enough to notice and
 *  change your mind, short enough that the rail doesn't accumulate history. */
const UNDO_WINDOW_MS = 8_000

export interface MyDesignSummary {
  id: string
  /** what the owner called it, or null if never named */
  name: string | null
  /** non-null while anyone with the link may open it (#24) */
  sharedAt: number | null
  createdAt: number
  /** column count, or null if the stored envelope no longer parses */
  cols: number | null
  /** the engraved top text, when there is one — usually whose abacus it is */
  label: string | null
}

interface DesignList {
  designs: MyDesignSummary[]
  truncated: boolean
}

async function fetchMyDesigns(): Promise<DesignList> {
  const res = await api('abacus/designs')
  if (!res.ok) throw new Error('Failed to load designs')
  const data: unknown = await res.json()
  const raw = (data as { designs?: unknown } | null)?.designs
  const designs = Array.isArray(raw) ? (raw as MyDesignSummary[]) : []
  return { designs, truncated: (data as { truncated?: unknown } | null)?.truncated === true }
}

async function patchDesign(designId: string, body: { name?: string | null; hidden?: boolean }) {
  const res = await api(`abacus/designs/${encodeURIComponent(designId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to update design')
}

export function useMyDesigns() {
  const queryClient = useQueryClient()
  const key = abacusDesignKeys.list()

  const query = useQuery({
    queryKey: key,
    queryFn: fetchMyDesigns,
    retry: false,
    staleTime: 30_000,
  })

  const patchList = useCallback(
    (update: (designs: MyDesignSummary[]) => MyDesignSummary[]) => {
      queryClient.setQueryData<DesignList>(key, (prev) =>
        prev ? { ...prev, designs: update(prev.designs) } : prev
      )
    },
    [queryClient, key]
  )

  const unshare = useMutation({
    mutationFn: async (designId: string): Promise<string> => {
      const res = await api(`abacus/designs/${encodeURIComponent(designId)}/share`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to un-share design')
      return designId
    },
    onSuccess: (designId) => {
      // The row itself stays — un-sharing is not removing. It only leaves the
      // list if it was ALSO hidden, which the refetch settles.
      patchList((designs) => designs.map((d) => (d.id === designId ? { ...d, sharedAt: null } : d)))
      queryClient.invalidateQueries({ queryKey: key })
      // the revoked row may be the design on screen — let its toggle catch up
      queryClient.invalidateQueries({ queryKey: abacusDesignKeys.share(designId) })
    },
  })

  const rename = useMutation({
    mutationFn: async (vars: { id: string; name: string | null }) => {
      await patchDesign(vars.id, { name: vars.name })
      return vars
    },
    onSuccess: ({ id, name }) =>
      patchList((designs) => designs.map((d) => (d.id === id ? { ...d, name } : d))),
  })

  // What the undo offer is for. Held here rather than in the component so the
  // offer survives a re-render of the list it was removed from.
  const [undoable, setUndoable] = useState<{ id: string; name: string | null } | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearUndo = useCallback(() => {
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = null
    setUndoable(null)
  }, [])
  useEffect(() => () => clearUndo(), [clearUndo])

  const remove = useMutation({
    mutationFn: async (design: MyDesignSummary) => {
      await patchDesign(design.id, { hidden: true })
      return design
    },
    onSuccess: (design) => {
      patchList((designs) => designs.filter((d) => d.id !== design.id))
      if (undoTimer.current) clearTimeout(undoTimer.current)
      setUndoable({ id: design.id, name: design.name })
      undoTimer.current = setTimeout(() => setUndoable(null), UNDO_WINDOW_MS)
    },
  })

  const undoRemove = useMutation({
    mutationFn: async (designId: string) => {
      await patchDesign(designId, { hidden: false })
    },
    onSuccess: () => {
      clearUndo()
      queryClient.invalidateQueries({ queryKey: key })
    },
  })

  return {
    designs: query.data?.designs ?? [],
    truncated: query.data?.truncated ?? false,
    sharedCount: (query.data?.designs ?? []).filter((d) => d.sharedAt !== null).length,
    unshare: unshare.mutate,
    /** which row is in flight, so only that row's control goes quiet */
    unsharingId: unshare.isPending ? (unshare.variables ?? null) : null,
    unshareFailed: unshare.isError,
    rename: (id: string, name: string | null) => rename.mutate({ id, name }),
    renameFailed: rename.isError,
    remove: remove.mutate,
    removingId: remove.isPending ? (remove.variables?.id ?? null) : null,
    removeFailed: remove.isError,
    /** the last removal, while its undo offer stands */
    undoable,
    undoRemove: undoRemove.mutate,
  }
}
