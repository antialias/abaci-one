'use client'

// Abacus Studio — print-service connection management (Gitea epic #5, #8.2).
//
// The browser half of the pairing flow: list the account's paired print
// services, add one by redeeming a `CODE@host` pairing artifact, rename it,
// remove it, and probe it for reachability. The server does all the secret
// handling — the minted token never reaches here; a connection is only ever
// the browser-safe {@link PrintConnectionDTO}.
//
// Transport is centralized in the module-level `*Connection` functions — the
// seam PrintConnectionsManager's kit adapter closes over, and the one a future
// shared transport package would inject.

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'
import { abacusPrintKeys } from '@/lib/queryKeys'

/** Browser-safe connection view. Mirrors `PrintConnectionView` from
 *  `@/lib/abacus/print/connections`, but Dates arrive as JSON strings. */
export interface PrintConnectionDTO {
  id: string
  name: string
  origin: string
  webhookRegistered: boolean
  createdAt: string
  updatedAt: string
}

/** On-demand reachability verdict from the `[id]/probe` route. Never thrown —
 *  a broken connection is a state to show, not an error. */
export interface PrintProbeResult {
  ok: boolean
  reason?: string
  printerCount?: number
}

/** Pull the server's `{ error }` message, falling back to a generic line. */
async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: unknown } | null
  return typeof data?.error === 'string' && data.error ? data.error : fallback
}

export async function fetchConnections(): Promise<PrintConnectionDTO[]> {
  const res = await api('abacus/print/connections')
  if (!res.ok) throw new Error(await readError(res, 'Failed to load print connections'))
  const data = (await res.json()) as { connections?: PrintConnectionDTO[] }
  return data.connections ?? []
}

/** Redeem a `CODE@host` pairing artifact. The server splits, exchanges the
 *  code for a durable token, seals it, and registers the doorbell webhook. */
export async function pairConnection(artifact: string): Promise<PrintConnectionDTO> {
  const res = await api('abacus/print/connections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artifact }),
  })
  if (!res.ok) throw new Error(await readError(res, 'Pairing failed'))
  const data = (await res.json()) as { connection: PrintConnectionDTO }
  return data.connection
}

export async function renameConnection(id: string, name: string): Promise<PrintConnectionDTO> {
  const res = await api(`abacus/print/connections/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(await readError(res, 'Rename failed'))
  const data = (await res.json()) as { connection: PrintConnectionDTO }
  return data.connection
}

export async function removeConnection(id: string): Promise<void> {
  const res = await api(`abacus/print/connections/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await readError(res, 'Remove failed'))
}

export async function probeConnection(id: string): Promise<PrintProbeResult> {
  const res = await api(`abacus/print/connections/${id}/probe`)
  if (!res.ok) throw new Error(await readError(res, 'Probe failed'))
  return (await res.json()) as PrintProbeResult
}

/**
 * The roster query plus one cache-invalidation closure. Any connection change
 * invalidates `abacusPrintKeys.all` so printer discovery, the filament
 * roster, and the job queue all re-read against the new set.
 *
 * `invalidateAll` RETURNS its promise on purpose: the shared kit awaits it as
 * `onChanged`, so a row's pending state holds until the refetched roster
 * lands. All mutations (pair/rename/remove/probe) go through the kit adapter
 * in PrintConnectionsManager, which calls the module transport functions
 * above directly.
 */
export function useAbacusPrintConnections() {
  const queryClient = useQueryClient()
  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: abacusPrintKeys.all })

  const connectionsQuery = useQuery({
    queryKey: abacusPrintKeys.connections(),
    queryFn: fetchConnections,
  })

  return { connectionsQuery, invalidateAll }
}
