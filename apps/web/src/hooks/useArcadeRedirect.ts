import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useArcadeSocket } from './useArcadeSocket'
import { useViewerId } from './useViewerId'

export interface UseArcadeRedirectOptions {
  /**
   * The current game this page represents (e.g., 'matching', 'memory-quiz')
   * If null, this is the arcade lobby
   */
  currentGame?: string | null
}

export interface UseArcadeRedirectReturn {
  /**
   * Whether we're checking for an active session
   */
  isChecking: boolean

  /**
   * Whether user has an active session
   */
  hasActiveSession: boolean

  /**
   * The URL of the active game (if any)
   */
  activeGameUrl: string | null

  /**
   * Whether players can be modified (only true in arcade lobby with no active session)
   */
  canModifyPlayers: boolean
}

/**
 * Hook to handle arcade session redirects
 *
 * - If on /arcade and user has active session → redirect to that game
 * - If on a game page and user has different active session → redirect to that game
 * - If on a game page that matches active session → allow (locked in)
 *
 * @example
 * ```tsx
 * // In /arcade page
 * const { canModifyPlayers } = useArcadeRedirect({ currentGame: null })
 *
 * // In /arcade/matching page
 * const { canModifyPlayers } = useArcadeRedirect({ currentGame: 'matching' })
 * ```
 */
export function useArcadeRedirect(
  options: UseArcadeRedirectOptions = {}
): UseArcadeRedirectReturn {
  const { currentGame } = options
  const router = useRouter()
  const pathname = usePathname()
  const { data: viewerId } = useViewerId()

  const [isChecking, setIsChecking] = useState(true)
  const [hasActiveSession, setHasActiveSession] = useState(false)
  const [activeGameUrl, setActiveGameUrl] = useState<string | null>(null)
  const [activeGameName, setActiveGameName] = useState<string | null>(null)

  const { connected, joinSession } = useArcadeSocket({
    onSessionState: (data) => {
      console.log('[ArcadeRedirect] Got session state:', data)
      setIsChecking(false)
      setHasActiveSession(true)
      setActiveGameUrl(data.gameUrl)
      setActiveGameName(data.currentGame)

      // Determine if we need to redirect
      const isArcadeLobby = currentGame === null || currentGame === undefined
      const isWrongGame = currentGame && currentGame !== data.currentGame

      if (isArcadeLobby || isWrongGame) {
        console.log('[ArcadeRedirect] Redirecting to active game:', data.gameUrl)
        router.push(data.gameUrl)
      }
    },

    onNoActiveSession: () => {
      console.log('[ArcadeRedirect] No active session')
      setIsChecking(false)
      setHasActiveSession(false)
      setActiveGameUrl(null)
      setActiveGameName(null)

      // No redirect needed - user can navigate to any game page to start a new session
      // Only redirect when they have an active session for a different game
    },

    onSessionEnded: () => {
      console.log('[ArcadeRedirect] Session ended')
      setHasActiveSession(false)
      setActiveGameUrl(null)
      setActiveGameName(null)
    },
  })

  // Check for active session when connected
  useEffect(() => {
    if (connected && viewerId) {
      console.log('[ArcadeRedirect] Checking for active session')
      setIsChecking(true)
      joinSession(viewerId)
    }
  }, [connected, viewerId, joinSession])

  // Can modify players whenever there's no active session
  // (applies to arcade lobby and game setup pages)
  const canModifyPlayers = !hasActiveSession && !isChecking

  return {
    isChecking,
    hasActiveSession,
    activeGameUrl,
    canModifyPlayers,
  }
}
