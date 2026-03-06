'use client'

import { useSession } from 'next-auth/react'
import { usePracticeNotifications } from '@/hooks/usePracticeNotifications'

/**
 * Invisible component that listens for Socket.IO notification events
 * and shows in-app toasts. Mounted in ClientProviders so it's active
 * on every page for authenticated users.
 */
export function PracticeNotificationListener() {
  const { data: session } = useSession()
  usePracticeNotifications(session?.user?.id)
  return null
}
