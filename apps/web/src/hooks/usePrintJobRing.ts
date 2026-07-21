'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { PRINT_JOB_UPDATED_EVENT, type PrintJobUpdatedEvent } from '@/lib/abacus/print/ring-events'
import { abacusPrintKeys } from '@/lib/queryKeys'
import { createSocket } from '@/lib/socket'

/**
 * Doorbell listener for Abacus Studio print jobs (Phase 2a, #8.4), modeled
 * on `useParentSocket`.
 *
 * Joins the viewer's `user:` room and, on each print-job-updated ring,
 * invalidates the print proxy query keys so React Query re-reads the real
 * state through the authenticated proxy. The ring payload itself is never
 * trusted as state — it's identifiers only.
 *
 * Mount once per surface that shows job state (the #9 print panel). The
 * slow safety-net poll on active-job queries backstops missed rings and
 * carries progress %, which never rings.
 *
 * @param userId - The viewer's user id (undefined = don't connect)
 */
export function usePrintJobRing(userId: string | undefined): { connected: boolean } {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!userId) return

    const socket = createSocket({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('join-user-channel', { userId })
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.on(PRINT_JOB_UPDATED_EVENT, (data: PrintJobUpdatedEvent) => {
      // Job state changed → re-read the roster and the specific job.
      queryClient.invalidateQueries({ queryKey: abacusPrintKeys.jobs() })
      if (data.jobId) {
        queryClient.invalidateQueries({ queryKey: abacusPrintKeys.job(data.jobId) })
      }
      // A phase change can also mean AMS state moved (spool consumed/swapped);
      // refresh that printer's filament snapshot early rather than waiting
      // out the staleTime.
      if (data.printerId) {
        queryClient.invalidateQueries({ queryKey: abacusPrintKeys.filaments(data.printerId) })
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [userId, queryClient])

  return { connected }
}
