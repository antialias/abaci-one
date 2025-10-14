'use client'

import { useRouter } from 'next/navigation'
import { useRoomData, useSetRoomGame } from '@/hooks/useRoomData'
import { MemoryPairsGame } from '../matching/components/MemoryPairsGame'
import { RoomMemoryPairsProvider } from '../matching/context/RoomMemoryPairsProvider'
import { MemoryQuizGame } from '../memory-quiz/components/MemoryQuizGame'
import { RoomMemoryQuizProvider } from '../memory-quiz/context/RoomMemoryQuizProvider'
import { GAMES_CONFIG } from '@/components/GameSelector'
import type { GameType } from '@/components/GameSelector'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../../styled-system/css'

// Map GameType keys to internal game names
const GAME_TYPE_TO_NAME: Record<GameType, string> = {
  'battle-arena': 'matching',
  'memory-lightning': 'memory-quiz',
  'complement-race': 'complement-race',
  'master-organizer': 'master-organizer',
}

/**
 * /arcade/room - Renders the game for the user's current room
 * Since users can only be in one room at a time, this is a simple singular route
 *
 * Shows game selection when no game is set, then shows the game itself once selected.
 * URL never changes - it's always /arcade/room regardless of selection, setup, or gameplay.
 *
 * Note: We don't redirect to /arcade if no room exists to avoid navigation loops.
 * Instead, we show a friendly message with a link back to the Champion Arena.
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
      const gameConfig = GAMES_CONFIG[gameType]
      if (gameConfig.available === false) {
        return // Don't allow selecting unavailable games
      }

      // Map GameType to internal game name
      const internalGameName = GAME_TYPE_TO_NAME[gameType]

      setRoomGame({
        roomId: roomData.id,
        gameName: internalGameName,
        gameConfig: {},
      })
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
            {Object.entries(GAMES_CONFIG).map(([gameType, config]) => (
              <button
                key={gameType}
                onClick={() => handleGameSelect(gameType as GameType)}
                disabled={config.available === false}
                className={css({
                  background: config.gradient,
                  border: '2px solid',
                  borderColor: config.borderColor || 'blue.200',
                  borderRadius: '2xl',
                  padding: '6',
                  cursor: config.available === false ? 'not-allowed' : 'pointer',
                  opacity: config.available === false ? 0.5 : 1,
                  transition: 'all 0.3s ease',
                  _hover:
                    config.available === false
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
            ))}
          </div>
        </div>
      </PageWithNav>
    )
  }

  // Render the appropriate game based on room's gameName
  switch (roomData.gameName) {
    case 'matching':
      return (
        <RoomMemoryPairsProvider>
          <MemoryPairsGame />
        </RoomMemoryPairsProvider>
      )

    case 'memory-quiz':
      return (
        <RoomMemoryQuizProvider>
          <MemoryQuizGame />
        </RoomMemoryQuizProvider>
      )

    // TODO: Add other games (complement-race, etc.)
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
