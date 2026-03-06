'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Socket } from 'socket.io-client'
import { createSocket } from '@/lib/socket'
import { useToast } from '@/components/common/ToastContext'
import type { GenericNotificationEvent } from '@/lib/classroom/socket-events'

/**
 * Hook that listens for notification events on the user's Socket.IO channel
 * and shows in-app toasts.
 *
 * Should be mounted once in a layout that wraps authenticated pages.
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

    socket.on('notification', (data: GenericNotificationEvent) => {
      console.log('[Notifications] %s: %s', data.type, data.title)

      showToast({
        type: 'info',
        title: data.title,
        description: data.body,
        duration: 10000,
        action: data.url
          ? {
              label: 'View',
              onClick: () => router.push(data.url),
            }
          : undefined,
      })
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [userId, router, showToast])
}
