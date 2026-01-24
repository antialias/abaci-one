'use client'

import { useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'

// Generate a unique session ID for this browser tab
function generateSessionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  return `${timestamp}-${random}`
}

// Heartbeat interval in milliseconds (30 seconds)
const HEARTBEAT_INTERVAL_MS = 30_000

/**
 * Hook that sends periodic heartbeats to track active sessions.
 *
 * Features:
 * - Only sends heartbeats when the tab is visible (Page Visibility API)
 * - Generates a unique session ID per tab
 * - Sends path changes for page view tracking
 * - Non-blocking: uses beacon API for reliability
 * - Minimal impact: tiny payload, infrequent requests
 */
export function useHeartbeat() {
  const sessionIdRef = useRef<string | null>(null)
  const pathname = usePathname()
  const lastPathRef = useRef<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Get or create session ID
  const getSessionId = useCallback(() => {
    if (!sessionIdRef.current) {
      // Try to get from sessionStorage for tab persistence
      const stored = typeof window !== 'undefined'
        ? sessionStorage.getItem('heartbeat_session_id')
        : null
      if (stored) {
        sessionIdRef.current = stored
      } else {
        sessionIdRef.current = generateSessionId()
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('heartbeat_session_id', sessionIdRef.current)
        }
      }
    }
    return sessionIdRef.current
  }, [])

  // Send heartbeat
  const sendHeartbeat = useCallback(
    (path?: string) => {
      if (typeof window === 'undefined') return

      // Only send if tab is visible
      if (document.visibilityState !== 'visible') return

      const sessionId = getSessionId()
      const payload = JSON.stringify({
        sessionId,
        path: path || undefined,
      })

      // Use sendBeacon for reliability (doesn't block navigation)
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/heartbeat', payload)
      } else {
        // Fallback to fetch (non-blocking)
        fetch('/api/heartbeat', {
          method: 'POST',
          body: payload,
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
        }).catch(() => {
          // Ignore errors - heartbeat is best-effort
        })
      }
    },
    [getSessionId]
  )

  // Setup heartbeat interval
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Send initial heartbeat with path
    sendHeartbeat(pathname)
    lastPathRef.current = pathname

    // Setup interval
    intervalRef.current = setInterval(() => {
      sendHeartbeat()
    }, HEARTBEAT_INTERVAL_MS)

    // Handle visibility change - send heartbeat when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [sendHeartbeat, pathname])

  // Send heartbeat on path change
  useEffect(() => {
    if (pathname && pathname !== lastPathRef.current) {
      sendHeartbeat(pathname)
      lastPathRef.current = pathname
    }
  }, [pathname, sendHeartbeat])
}
