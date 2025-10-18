'use client'

import { useRouter } from 'next/navigation'
import { useRoomData, useSetRoomGame } from '@/hooks/useRoomData'
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
  const { mutate: setRoomGame } = useSetRoomGame()

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
    const handleGameSelect = (gameType: GameType) => {
      console.log('[RoomPage] handleGameSelect called with gameType:', gameType)

      // All games are now in the registry
      if (hasGame(gameType)) {
        const gameDef = getGame(gameType)
        if (!gameDef?.manifest.available) {
          console.log('[RoomPage] Registry game not available, blocking selection')
          return
        }

        console.log('[RoomPage] Selecting registry game:', gameType)
        setRoomGame({
          roomId: roomData.id,
          gameName: gameType,
        })
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
              mb: '8',
              textAlign: 'center',
            })}
          >
            Choose a Game
          </h1>

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
              return (
                <button
                  key={gameType}
                  onClick={() => handleGameSelect(gameType as GameType)}
                  disabled={!isAvailable}
                  className={css({
                    background: config.gradient,
                    border: '2px solid',
                    borderColor: config.borderColor || 'blue.200',
                    borderRadius: '2xl',
                    padding: '6',
                    cursor: !isAvailable ? 'not-allowed' : 'pointer',
                    opacity: !isAvailable ? 0.5 : 1,
                    transition: 'all 0.3s ease',
                    _hover: !isAvailable
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
              return (
                <button
                  key={gameDef.manifest.name}
                  onClick={() => handleGameSelect(gameDef.manifest.name)}
                  disabled={!isAvailable}
                  className={css({
                    background: gameDef.manifest.gradient,
                    border: '2px solid',
                    borderColor: gameDef.manifest.borderColor,
                    borderRadius: '2xl',
                    padding: '6',
                    cursor: !isAvailable ? 'not-allowed' : 'pointer',
                    opacity: !isAvailable ? 0.5 : 1,
                    transition: 'all 0.3s ease',
                    _hover: !isAvailable
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
