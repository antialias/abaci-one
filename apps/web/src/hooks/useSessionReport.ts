'use client'

/**
 * The session report (session architecture §4, Phase 4a), live.
 *
 * Reads `GET …/plans/[planId]/report` (signed-in viewers) or
 * `GET /api/observe/[token]/report` (share links) through React Query, and
 * keeps it current from the server's pushes on the gated report room
 * (`subscribe-session-report`, joined with the caller's credential: the
 * signed-in viewer's id with `observe` on the player, or the share token):
 * - `session-report { report }` replaces the cached report only when its
 *   `rowVersion` is newer (pushes from several servers may arrive out of
 *   order; a fetch that started before a push never overwrites it either);
 * - `session-ended` invalidates the query, so the ended report is fetched;
 * - every socket `connect` (first and re-) refetches, since pushes sent while
 *   disconnected are lost (React Query's `refetchOnReconnect` follows the
 *   network, not the socket).
 * No polling and no timers: the query keeps the app QueryClient's defaults,
 * and recovery comes from push, socket reconnect and invalidation.
 */

import { type QueryClient, type QueryKey, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type {
  SessionReportEvent,
  SubscribeSessionReportRequest,
} from '@/lib/classroom/socket-events'
import type { SessionReport } from '@/lib/curriculum/session-report'
import { api } from '@/lib/queryClient'
import { sessionReportKeys } from '@/lib/queryKeys'
import { createSocket } from '@/lib/socket'

export type SessionReportSource =
  /** A signed-in viewer; `viewerId` is checked for `observe` on the player to join the push room */
  | { playerId: string; planId: string; viewerId: string }
  /** A share-link holder */
  | { token: string }

export function sessionReportKeyOf(source: SessionReportSource): QueryKey {
  return 'token' in source
    ? sessionReportKeys.token(source.token)
    : sessionReportKeys.plan(source.planId)
}

function reportPathOf(source: SessionReportSource): string {
  return 'token' in source
    ? `observe/${encodeURIComponent(source.token)}/report`
    : `curriculum/${source.playerId}/sessions/plans/${source.planId}/report`
}

/** The newer of two reports by `rowVersion` (the held one on a tie). */
export function newerReport(
  held: SessionReport | undefined,
  incoming: SessionReport
): SessionReport {
  return held && held.sessionId === incoming.sessionId && held.rowVersion >= incoming.rowVersion
    ? held
    : incoming
}

export class SessionReportError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'SessionReportError'
  }
}

async function fetchReport(
  queryClient: QueryClient,
  source: SessionReportSource,
  key: QueryKey
): Promise<SessionReport> {
  const res = await api(reportPathOf(source))
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new SessionReportError(body.error ?? 'Failed to load session report', res.status)
  }
  const { report } = (await res.json()) as { report: SessionReport }
  // A push that landed while this request was in flight is newer: keep it
  return newerReport(queryClient.getQueryData<SessionReport>(key), report)
}

export function useSessionReport(
  source: SessionReportSource | null,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const queryClient = useQueryClient()
  const key = source ? sessionReportKeyOf(source) : sessionReportKeys.all
  const keyHash = JSON.stringify(key)

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchReport(queryClient, source!, key),
    enabled: enabled && source !== null,
  })

  // The session id: the plan's, or (share links) the report's once fetched
  const sessionId = source
    ? 'planId' in source
      ? source.planId
      : query.data?.sessionId
    : undefined
  // The credential for the gated room
  const credential: Omit<SubscribeSessionReportRequest, 'sessionId'> | null = source
    ? 'token' in source
      ? { shareToken: source.token }
      : { viewerId: source.viewerId, playerId: source.playerId }
    : null
  const credentialHash = JSON.stringify(credential)

  useEffect(() => {
    if (!enabled || !sessionId || !credential) return
    const socket = createSocket({ reconnection: true })
    const refetch = () => queryClient.invalidateQueries({ queryKey: key }, { cancelRefetch: false })

    socket.on('connect', () => {
      // The gated push room; the server checks the credential (session-report-access.ts)
      socket.emit('subscribe-session-report', { sessionId, ...credential })
      void refetch()
    })
    socket.on('session-report', ({ report }: SessionReportEvent) => {
      if (report?.sessionId !== sessionId) return
      queryClient.setQueryData<SessionReport>(key, (held) => newerReport(held, report))
    })
    socket.on('session-ended', (event: { sessionId?: string }) => {
      if (event?.sessionId !== sessionId) return
      void refetch()
    })

    return () => {
      socket.emit('unsubscribe-session-report', { sessionId })
      socket.disconnect()
    }
  }, [enabled, sessionId, keyHash, credentialHash, queryClient])

  return query
}
