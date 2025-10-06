import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useArcadeSocket } from './useArcadeSocket'
import { useViewerId } from './useViewerId'
import type { ArcadeSessionResponse } from '@/app/api/arcade-session/types'

export interface UseArcadeGuardOptions {
  /**
   * Whether to enable the guard
   * @default true
   */
  enabled?: boolean

  /**
   * Callback when redirecting to active session
   */
  onRedirect?: (gameUrl: string) => void
}

export interface UseArcadeGuardReturn {
  /**
   * Whether there's an active arcade session
   */
  hasActiveSession: boolean

  /**
   * Whether currently loading session state
   */
  loading: boolean

  /**
   * Active session details if exists
   */
  activeSession: {
    gameUrl: string
    currentGame: string
  } | null
}

/**
 * Hook for guarding arcade navigation and auto-resuming sessions
 *
 * Automatically redirects users to their active arcade session if they
 * navigate to a different page while a session is active.
 *
 * @example
 * ```tsx
 * // In arcade game pages:
 * const { hasActiveSession, loading } = useArcadeGuard()
 *
 * if (loading) return <LoadingSpinner />
 * ```
 */
export function useArcadeGuard(
  options: UseArcadeGuardOptions = {}
): UseArcadeGuardReturn {
  const { enabled = true, onRedirect } = options
  const router = useRouter()
  const pathname = usePathname()
  const { data: userId, isLoading: isLoadingUserId } = useViewerId()

  const [hasActiveSession, setHasActiveSession] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeSession, setActiveSession] = useState<{
    gameUrl: string
    currentGame: string
  } | null>(null)

  // WebSocket connection to listen for session changes
  const { connected, joinSession } = useArcadeSocket({
    onSessionState: (data) => {
      setHasActiveSession(true)
      setActiveSession({
        gameUrl: data.gameUrl,
        currentGame: data.currentGame,
      })

      // Redirect if we're not already on the active game page
      if (pathname !== data.gameUrl) {
        console.log('[ArcadeGuard] Redirecting to active session:', data.gameUrl)
        onRedirect?.(data.gameUrl)
        router.push(data.gameUrl)
      }
    },

    onNoActiveSession: () => {
      setHasActiveSession(false)
      setActiveSession(null)
      setLoading(false)
    },

    onSessionEnded: () => {
      console.log('[ArcadeGuard] Session ended, clearing active session')
      setHasActiveSession(false)
      setActiveSession(null)
    },
  })

  // Check for active session on mount and when userId changes
  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    if (isLoadingUserId) {
      setLoading(true)
      return
    }

    if (!userId) {
      setLoading(false)
      return
    }

    const checkSession = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/arcade-session?userId=${userId}`)

        if (response.ok) {
          const data: ArcadeSessionResponse = await response.json()
          const session = data.session // API wraps response in { session: {...} }

          setHasActiveSession(true)
          setActiveSession({
            gameUrl: session.gameUrl,
            currentGame: session.currentGame,
          })

          // Redirect if we're not already on the active game page
          if (pathname !== session.gameUrl) {
            console.log('[ArcadeGuard] Redirecting to active session:', session.gameUrl)
            onRedirect?.(session.gameUrl)
            router.push(session.gameUrl)
          }
        } else if (response.status === 404) {
          // No active session
          setHasActiveSession(false)
          setActiveSession(null)
        }
      } catch (error) {
        console.error('[ArcadeGuard] Failed to check session:', error)
      } finally {
        setLoading(false)
      }
    }

    checkSession()
  }, [userId, enabled, pathname, router, onRedirect, isLoadingUserId])

  // Join WebSocket room when connected
  useEffect(() => {
    if (connected && userId) {
      joinSession(userId)
    }
  }, [connected, userId, joinSession])

  return {
    hasActiveSession,
    loading,
    activeSession,
  }
}
