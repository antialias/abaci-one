'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Socket } from 'socket.io-client'
import { createSocket } from '@/lib/socket'
import { useToast } from '@/components/common/ToastContext'
import type { PracticeNotificationEvent } from '@/lib/classroom/socket-events'

/**
 * Hook that listens for practice-notification events on the user's
 * Socket.IO channel and shows an in-app toast with a "Watch" action.
 *
 * Should be mounted once in a layout that wraps authenticated parent pages.
 * Relies on the parent already being joined to `user:${userId}` via
 * useParentSocket — this hook piggybacks on that connection or creates
 * its own if needed.
 *
 * @param userId - The authenticated user's ID (null/undefined to disable)
 */
export function usePracticeNotifications(userId: string | undefined): void {
  const socketRef = useRef<Socket | null>(null)
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    if (!userId) return

    const socket = createSocket({ reconnection: true })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join-user-channel', { userId })
    })

    socket.on('practice-notification', (data: PracticeNotificationEvent) => {
      console.log('[PracticeNotifications] %s started practicing', data.playerName)

      showToast({
        type: 'info',
        title: `${data.playerEmoji} ${data.playerName} started practicing!`,
        description: 'Tap to watch live',
        duration: 10000,
        action: {
          label: 'Watch',
          onClick: () => router.push(data.observeUrl),
        },
      })
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [userId, router, showToast])
}
