'use client'

import { useHeartbeat } from '@/lib/useHeartbeat'

/**
 * Invisible component that tracks user session activity via heartbeat.
 * Add this to the root layout to enable session metrics.
 */
export function HeartbeatTracker() {
  useHeartbeat()
  return null
}
