'use client'

import { useEffect, useRef, useState } from 'react'
import { getGame } from '@/lib/arcade/game-registry'
import { GameLayoutProvider } from '@/contexts/GameLayoutContext'
import { GameModeProviderWithHooks } from '@/contexts/GameModeProviderWithHooks'
import { useJoinRoom, useLeaveRoom } from '@/hooks/useRoomData'
import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../styled-system/css'
import type { ObservedGameBreakState } from '@/hooks/useSessionObserver'

interface GameBreakSpectatorViewProps {
  breakState: ObservedGameBreakState
  studentName: string
}

/**
 * Renders a live spectator view of a game break.
 *
 * The observer joins the game break's arcade room as a member, which makes
 * useRoomData return the break room's data. The game's Provider + GameComponent
 * then render in spectator mode automatically (observer has no active players
 * in the game).
 *
 * On unmount (break ends), the observer leaves the room.
 */
export function GameBreakSpectatorView({
  breakState,
  studentName,
}: GameBreakSpectatorViewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const joinRoom = useJoinRoom()
  const leaveRoom = useLeaveRoom()
  const [hasJoined, setHasJoined] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const roomIdRef = useRef(breakState.roomId)
  roomIdRef.current = breakState.roomId

  // Join the game break room on mount
  useEffect(() => {
    let cancelled = false
    const roomId = breakState.roomId

    joinRoom
      .mutateAsync({ roomId })
      .then(() => {
        if (!cancelled) {
          setHasJoined(true)
          setJoinError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[GameBreakSpectator] Failed to join room:', err)
          setJoinError(err instanceof Error ? err.message : 'Failed to join game room')
        }
      })

    return () => {
      cancelled = true
      // Leave the room on unmount
      leaveRoom.mutateAsync(roomId).catch((err) => {
        console.error('[GameBreakSpectator] Failed to leave room:', err)
      })
    }
    // Only run on mount/unmount — roomId shouldn't change during a break
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakState.roomId])

  const game = getGame(breakState.gameId)

  // If game isn't registered (shouldn't happen), show fallback
  if (!game) {
    return (
      <GameBreakFallback
        studentName={studentName}
        gameName={breakState.gameName}
        phase={breakState.phase}
        isDark={isDark}
      />
    )
  }

  // Show loading while joining the room
  if (!hasJoined) {
    if (joinError) {
      return (
        <GameBreakFallback
          studentName={studentName}
          gameName={breakState.gameName}
          phase={breakState.phase}
          isDark={isDark}
          error={joinError}
        />
      )
    }

    return (
      <div
        data-element="game-break-spectator-loading"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          padding: '2rem',
          minHeight: '200px',
        })}
      >
        <span className={css({ fontSize: '2rem' })}>🎮</span>
        <p
          className={css({
            fontSize: '0.875rem',
            color: isDark ? 'gray.400' : 'gray.500',
          })}
        >
          Connecting to {studentName}&apos;s game...
        </p>
      </div>
    )
  }

  const { Provider, GameComponent } = game

  return (
    <div
      data-element="game-break-spectator"
      className={css({
        width: '100%',
        height: '100%',
        minHeight: '300px',
        overflow: 'hidden',
        position: 'relative',
      })}
    >
      {/* Spectator badge */}
      <div
        data-element="spectator-badge"
        className={css({
          position: 'absolute',
          top: '8px',
          right: '8px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.25rem 0.625rem',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: '500',
          pointerEvents: 'none',
        })}
        style={{
          backgroundColor: isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.15)',
          color: isDark ? '#a5b4fc' : '#4f46e5',
        }}
      >
        Spectating
      </div>
      <GameLayoutProvider mode="container">
        <GameModeProviderWithHooks>
          <Provider>
            <GameComponent />
          </Provider>
        </GameModeProviderWithHooks>
      </GameLayoutProvider>
    </div>
  )
}

/**
 * Fallback for when the game can't be rendered (unregistered game, join error, etc.)
 */
function GameBreakFallback({
  studentName,
  gameName,
  phase,
  isDark,
  error,
}: {
  studentName: string
  gameName: string
  phase: string
  isDark: boolean
  error?: string
}) {
  return (
    <div
      data-element="game-break-fallback"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
        minHeight: '200px',
      })}
    >
      <span className={css({ fontSize: '3rem' })}>🎮</span>
      <h3
        className={css({
          fontSize: '1.25rem',
          fontWeight: '600',
          color: isDark ? 'gray.100' : 'gray.800',
        })}
      >
        Game Break
      </h3>
      <p
        className={css({
          fontSize: '1rem',
          color: isDark ? 'gray.300' : 'gray.600',
        })}
      >
        {phase === 'selecting'
          ? `${studentName} is choosing a game...`
          : phase === 'playing'
            ? `${studentName} is playing ${gameName}`
            : `${studentName} finished playing`}
      </p>
      {error && (
        <p
          className={css({
            fontSize: '0.75rem',
            color: isDark ? 'red.400' : 'red.600',
          })}
        >
          {error}
        </p>
      )}
    </div>
  )
}
