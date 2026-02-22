'use client'

import { useSession } from 'next-auth/react'
import { usePracticeNotifications } from '@/hooks/usePracticeNotifications'

/**
 * Invisible component that listens for practice-notification Socket.IO
 * events and shows in-app toast notifications.
 * Mounted in ClientProviders so it's active on every page.
 */
export function PracticeNotificationListener() {
  const { data: session } = useSession()
  usePracticeNotifications(session?.user?.id)
  return null
}
