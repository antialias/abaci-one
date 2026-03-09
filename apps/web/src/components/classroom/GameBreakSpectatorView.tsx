'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { getGame } from '@/lib/arcade/game-registry'
import { GameLayoutProvider } from '@/contexts/GameLayoutContext'
import { GameModeProviderWithHooks } from '@/contexts/GameModeProviderWithHooks'
import { useArcadeSessionState } from '@/contexts/ArcadeSessionStateContext'
import { SpectatorModeProvider } from '@/contexts/SpectatorModeContext'
import { CoPlayProvider, type CoPlayInfo } from '@/contexts/CoPlayContext'
import { useJoinRoom, useLeaveRoom } from '@/hooks/useRoomData'
import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../styled-system/css'
import type { ObservedGameBreakState } from '@/hooks/useSessionObserver'
import { CoPlayGameModeProvider } from './CoPlayGameModeProvider'

interface CoPlayProfile {
  name: string
  emoji: string
  color: string
}

interface GameBreakSpectatorViewProps {
  breakState: ObservedGameBreakState
  studentName: string
  /** If provided, observer participates as a co-player instead of spectating */
  coPlayProfile?: CoPlayProfile
  /** Observer's user ID — required for co-play mode */
  observerId?: string
}

/**
 * Renders a live view of a game break — either as spectator or co-play participant.
 *
 * The observer joins the game break's arcade room as a member. In spectator mode,
 * the game renders read-only. In co-play mode, the game renders interactively
 * and the observer can play alongside the student.
 *
 * On unmount (break ends), the observer leaves the room.
 */
export function GameBreakSpectatorView({
  breakState,
  studentName,
  coPlayProfile,
  observerId,
}: GameBreakSpectatorViewProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const isCoPlay = !!(coPlayProfile && observerId)
  const game = getGame(breakState.gameId)
  const coPlayMode = game?.manifest.coPlay?.mode

  // Determine if co-play is actually possible for this game
  const canCoPlay = isCoPlay && coPlayMode && coPlayMode !== 'none'

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
          console.error('[GameBreakObserver] Failed to join room:', err)
          setJoinError(err instanceof Error ? err.message : 'Failed to join game room')
        }
      })

    return () => {
      cancelled = true
      // Leave the room on unmount
      leaveRoom.mutateAsync(roomId).catch((err) => {
        console.error('[GameBreakObserver] Failed to leave room:', err)
      })
    }
    // Only run on mount/unmount — roomId shouldn't change during a break
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakState.roomId])

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
        data-element="game-break-observer-loading"
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
          {canCoPlay ? 'Joining' : 'Connecting to'} {studentName}&apos;s game...
        </p>
      </div>
    )
  }

  const { Provider, GameComponent } = game

  if (canCoPlay) {
    const coPlayInfo: CoPlayInfo = {
      playerId: observerId,
      playerName: coPlayProfile.name,
      emoji: coPlayProfile.emoji,
      color: coPlayProfile.color,
    }

    return (
      <div
        data-element="game-break-coplay"
        className={css({
          width: '100%',
          height: '100%',
          minHeight: '300px',
          overflow: 'hidden',
          position: 'relative',
        })}
      >
        {/* Co-play badge */}
        <div
          data-element="coplay-badge"
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
            backgroundColor: isDark ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.15)',
            color: isDark ? '#86efac' : '#16a34a',
          }}
        >
          Playing
        </div>
        <CoPlayProvider info={coPlayInfo}>
          <CoPlayGameModeProvider observerId={observerId} player={coPlayProfile}>
            <GameLayoutProvider mode="container">
              <Provider>
                <LoadingGate
                  studentName={studentName}
                  isDark={isDark}
                  label="Loading game..."
                >
                  <GameComponent />
                </LoadingGate>
              </Provider>
            </GameLayoutProvider>
          </CoPlayGameModeProvider>
        </CoPlayProvider>
      </div>
    )
  }

  // Spectator mode (default)
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
      {/* SpectatorModeProvider tells game components to skip all interaction setup */}
      <SpectatorModeProvider>
        <GameLayoutProvider mode="container">
          <GameModeProviderWithHooks>
            <Provider>
              <LoadingGate
                studentName={studentName}
                isDark={isDark}
                label={`Loading ${studentName}'s game...`}
              >
                <GameComponent />
              </LoadingGate>
            </Provider>
          </GameModeProviderWithHooks>
        </GameLayoutProvider>
      </SpectatorModeProvider>
    </div>
  )
}

/**
 * Loading gate that waits for the game Provider to receive authoritative server state
 * before rendering children. Prevents showing the game's setup/config screen while
 * the arcade session is connecting and loading state.
 */
function LoadingGate({
  children,
  studentName,
  isDark,
  label,
}: {
  children: ReactNode
  studentName: string
  isDark: boolean
  label: string
}) {
  const { hasReceivedServerState } = useArcadeSessionState()

  if (!hasReceivedServerState) {
    return (
      <div
        data-element="observer-loading-gate"
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
          {label}
        </p>
      </div>
    )
  }

  return <>{children}</>
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
