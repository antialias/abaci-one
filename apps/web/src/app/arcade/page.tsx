'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useRoomData, useSetRoomGame } from '@/hooks/useRoomData'
import { useViewerId } from '@/hooks/useViewerId'
import { GAMES_CONFIG } from '@/components/GameSelector'
import type { GameType } from '@/components/GameSelector'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../styled-system/css'
import { getAllGames, getGame, hasGame } from '@/lib/arcade/game-registry'

/**
 * /arcade - Renders the game for the user's current room
 * Since users can only be in one room at a time, this is a simple singular route
 *
 * Shows game selection when no game is set, then shows the game itself once selected.
 * URL never changes - it's always /arcade regardless of selection, setup, or gameplay.
 *
 * Note: We show a friendly message with a link if no room exists to avoid navigation loops.
 *
 * Note: ModerationNotifications is handled by PageWithNav inside each game component,
 * so we don't need to render it here.
 */
export default function RoomPage() {
  const router = useRouter()
  const { roomData, isLoading } = useRoomData()
  const { data: viewerId } = useViewerId()
  const { mutate: setRoomGame } = useSetRoomGame()
  const [permissionError, setPermissionError] = useState<string | null>(null)

  // Show loading state
  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontSize: '18px',
          color: '#666',
        }}
      >
        Loading room...
      </div>
    )
  }

  // Show error if no room (instead of redirecting)
  if (!roomData) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontSize: '18px',
          color: '#666',
          gap: '1rem',
        }}
      >
        <div>No active room found</div>
        <a
          href="/arcade"
          style={{
            color: '#3b82f6',
            textDecoration: 'underline',
          }}
        >
          Go to Champion Arena
        </a>
      </div>
    )
  }

  // Show game selection if no game is set
  if (!roomData.gameName) {
    // Determine if current user is the host
    const currentMember = roomData.members.find((m) => m.userId === viewerId)
    const isHost = currentMember?.isCreator === true
    const hostMember = roomData.members.find((m) => m.isCreator)

    const handleGameSelect = (gameType: GameType) => {
      console.log('[RoomPage] handleGameSelect called with gameType:', gameType)

      // Check if user is host before allowing selection
      if (!isHost) {
        setPermissionError(
          `Only the room host can select a game. Ask ${hostMember?.displayName || 'the host'} to choose.`
        )
        // Clear error after 5 seconds
        setTimeout(() => setPermissionError(null), 5000)
        return
      }

      // Clear any previous errors
      setPermissionError(null)

      // All games are now in the registry
      if (hasGame(gameType)) {
        const gameDef = getGame(gameType)
        if (!gameDef?.manifest.available) {
          console.log('[RoomPage] Registry game not available, blocking selection')
          return
        }

        console.log('[RoomPage] Selecting registry game:', gameType)
        setRoomGame(
          {
            roomId: roomData.id,
            gameName: gameType,
          },
          {
            onError: (error: any) => {
              console.error('[RoomPage] Failed to set game:', error)
              setPermissionError(
                error.message || 'Failed to select game. Only the host can change games.'
              )
              setTimeout(() => setPermissionError(null), 5000)
            },
          }
        )
        return
      }

      console.log('[RoomPage] Unknown game type:', gameType)
    }

    return (
      <PageWithNav
        navTitle="Choose Game"
        navEmoji="🎮"
        emphasizePlayerSelection={true}
        onExitSession={() => router.push('/arcade')}
      >
        <div
          className={css({
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3a 50%, #2d1b69 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4',
          })}
        >
          <h1
            className={css({
              fontSize: { base: '2xl', md: '3xl' },
              fontWeight: 'bold',
              color: 'white',
              mb: '4',
              textAlign: 'center',
            })}
          >
            Choose a Game
          </h1>

          {/* Host info and permission messaging */}
          <div
            className={css({
              maxWidth: '800px',
              width: '100%',
              mb: '6',
            })}
          >
            {isHost ? (
              <div
                className={css({
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  color: '#86efac',
                  fontSize: 'sm',
                  textAlign: 'center',
                })}
              >
                👑 You're the room host. Select a game to start playing.
              </div>
            ) : (
              <div
                className={css({
                  background: 'rgba(234, 179, 8, 0.1)',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  color: '#fde047',
                  fontSize: 'sm',
                  textAlign: 'center',
                })}
              >
                ⏳ Waiting for {hostMember?.displayName || 'the host'} to select a game...
              </div>
            )}

            {/* Permission error message */}
            {permissionError && (
              <div
                className={css({
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  color: '#fca5a5',
                  fontSize: 'sm',
                  textAlign: 'center',
                  mt: '3',
                })}
              >
                ⚠️ {permissionError}
              </div>
            )}
          </div>

          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: { base: '1fr', md: 'repeat(2, 1fr)' },
              gap: '4',
              maxWidth: '800px',
              width: '100%',
            })}
          >
            {/* Legacy games */}
            {Object.entries(GAMES_CONFIG).map(([gameType, config]: [string, any]) => {
              const isAvailable = !('available' in config) || config.available !== false
              const isDisabled = !isHost || !isAvailable
              return (
                <button
                  key={gameType}
                  onClick={() => handleGameSelect(gameType as GameType)}
                  disabled={isDisabled}
                  className={css({
                    background: config.gradient,
                    border: '2px solid',
                    borderColor: config.borderColor || 'blue.200',
                    borderRadius: '2xl',
                    padding: '6',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.4 : 1,
                    transition: 'all 0.3s ease',
                    _hover: isDisabled
                      ? {}
                      : {
                          transform: 'translateY(-4px) scale(1.02)',
                          boxShadow: '0 20px 40px rgba(59, 130, 246, 0.2)',
                        },
                  })}
                >
                  <div
                    className={css({
                      fontSize: '4xl',
                      mb: '2',
                    })}
                  >
                    {config.icon}
                  </div>
                  <h3
                    className={css({
                      fontSize: 'xl',
                      fontWeight: 'bold',
                      color: 'gray.900',
                      mb: '2',
                    })}
                  >
                    {config.name}
                  </h3>
                  <p
                    className={css({
                      fontSize: 'sm',
                      color: 'gray.600',
                    })}
                  >
                    {config.description}
                  </p>
                </button>
              )
            })}

            {/* Registry games */}
            {getAllGames().map((gameDef) => {
              const isAvailable = gameDef.manifest.available
              const isDisabled = !isHost || !isAvailable
              return (
                <button
                  key={gameDef.manifest.name}
                  onClick={() => handleGameSelect(gameDef.manifest.name)}
                  disabled={isDisabled}
                  style={{
                    background: gameDef.manifest.gradient,
                  }}
                  className={css({
                    border: '2px solid',
                    borderColor: gameDef.manifest.borderColor,
                    borderRadius: '2xl',
                    padding: '6',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.4 : 1,
                    transition: 'all 0.3s ease',
                    _hover: isDisabled
                      ? {}
                      : {
                          transform: 'translateY(-4px) scale(1.02)',
                          boxShadow: '0 20px 40px rgba(59, 130, 246, 0.2)',
                        },
                  })}
                >
                  <div
                    className={css({
                      fontSize: '4xl',
                      mb: '2',
                    })}
                  >
                    {gameDef.manifest.icon}
                  </div>
                  <h3
                    className={css({
                      fontSize: 'xl',
                      fontWeight: 'bold',
                      color: 'gray.900',
                      mb: '2',
                    })}
                  >
                    {gameDef.manifest.displayName}
                  </h3>
                  <p
                    className={css({
                      fontSize: 'sm',
                      color: 'gray.600',
                    })}
                  >
                    {gameDef.manifest.description}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      </PageWithNav>
    )
  }

  // Check if this is a registry game first
  if (hasGame(roomData.gameName)) {
    const gameDef = getGame(roomData.gameName)
    if (!gameDef) {
      return (
        <PageWithNav
          navTitle="Game Not Found"
          navEmoji="⚠️"
          emphasizePlayerSelection={true}
          onExitSession={() => router.push('/arcade')}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100vh',
              fontSize: '18px',
              color: '#666',
            }}
          >
            Game "{roomData.gameName}" not found in registry
          </div>
        </PageWithNav>
      )
    }

    // Render registry game dynamically
    const { Provider, GameComponent } = gameDef
    return (
      <Provider>
        <GameComponent />
      </Provider>
    )
  }

  // Render legacy games based on room's gameName
  switch (roomData.gameName) {
    // TODO: Add other legacy games (complement-race, etc.) once migrated
    default:
      return (
        <PageWithNav
          navTitle="Game Not Available"
          navEmoji="⚠️"
          emphasizePlayerSelection={true}
          onExitSession={() => router.push('/arcade')}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100vh',
              fontSize: '18px',
              color: '#666',
            }}
          >
            Game "{roomData.gameName}" not yet supported
          </div>
        </PageWithNav>
      )
  }
}
