'use client'

import { useRef, useState } from 'react'
import { css } from '../../styled-system/css'
import { useGameMode } from '../contexts/GameModeContext'
import { useUserProfile } from '../contexts/UserProfileContext'
import { GameSelector } from './GameSelector'

interface ChampionArenaProps {
  onGameModeChange?: (mode: 'single' | 'battle' | 'tournament') => void
  onConfigurePlayer?: (playerId: number) => void
  className?: string
}

export function ChampionArena({
  onGameModeChange,
  onConfigurePlayer,
  className,
}: ChampionArenaProps) {
  const { profile, updatePlayerEmoji, updatePlayerName } = useUserProfile()
  const { gameMode, players, updatePlayer, activePlayerCount } = useGameMode()
  const [draggedPlayer, setDraggedPlayer] = useState<number | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isRosterDragOver, setIsRosterDragOver] = useState(false)
  const [_configurePlayer, _setConfigurePlayer] = useState<number | null>(null)
  const [_tempName, _setTempName] = useState('')
  const arenaRef = useRef<HTMLDivElement>(null)

  const availablePlayers = players.filter((player) => !player.isActive)
  const arenaPlayers = players.filter((player) => player.isActive)

  const handleDragStart = (playerId: number) => {
    setDraggedPlayer(playerId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!arenaRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  const handleArenaDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    if (draggedPlayer) {
      // Check if player is being dragged from arena (to avoid self-drop)
      const playerInArena = arenaPlayers.find((p) => p.id === draggedPlayer)
      if (playerInArena) {
        setDraggedPlayer(null)
        return
      }

      // Activate the dragged player
      updatePlayer(draggedPlayer, { isActive: true })

      // Determine new game mode based on active player count
      const newActiveCount = arenaPlayers.length + 1
      let newMode: 'single' | 'battle' | 'tournament' = 'single'

      if (newActiveCount === 1) {
        newMode = 'single'
      } else if (newActiveCount === 2) {
        newMode = 'battle'
      } else {
        newMode = 'tournament'
      }

      // gameMode is now computed from active player count
      onGameModeChange?.(newMode)
      setDraggedPlayer(null)
    }
  }

  const handleRosterDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsRosterDragOver(true)
  }

  const handleRosterDragLeave = (e: React.DragEvent) => {
    const rosterContainer = e.currentTarget as HTMLElement
    if (!rosterContainer.contains(e.relatedTarget as Node)) {
      setIsRosterDragOver(false)
    }
  }

  const handleRosterDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsRosterDragOver(false)

    if (draggedPlayer) {
      // Check if player is being dragged from arena
      const playerInArena = arenaPlayers.find((p) => p.id === draggedPlayer)
      if (playerInArena) {
        console.log('Removing player from arena via drag:', draggedPlayer)
        handleRemoveFromArena(draggedPlayer)
      }
      setDraggedPlayer(null)
    }
  }

  const handleAddToArena = (playerId: number) => {
    console.log('Adding player to arena:', playerId)

    // Check if player is already in the arena
    const playerInArena = arenaPlayers.find((p) => p.id === playerId)
    if (playerInArena) {
      console.log('Player already in arena, skipping addition')
      return
    }

    // Activate the player
    updatePlayer(playerId, { isActive: true })

    // Determine new game mode based on new active player count
    const newActiveCount = arenaPlayers.length + 1
    let newMode: 'single' | 'battle' | 'tournament' = 'single'

    if (newActiveCount === 1) {
      newMode = 'single'
    } else if (newActiveCount === 2) {
      newMode = 'battle'
    } else {
      newMode = 'tournament'
    }

    console.log('New mode will be:', newMode, 'with', newActiveCount, 'active players')

    // Update game mode
    // gameMode is now computed from active player count
    onGameModeChange?.(newMode)
  }

  const handleRemoveFromArena = (playerId: number) => {
    console.log('Removing player from arena:', playerId)

    // Check if player is actually in the arena
    const playerInArena = arenaPlayers.find((p) => p.id === playerId)
    if (!playerInArena) {
      console.log('Player not in arena, skipping removal')
      return
    }

    // Calculate what the new count will be after removing this player
    const newActiveCount = arenaPlayers.length - 1
    let newMode: 'single' | 'battle' | 'tournament' = 'single'

    // Determine new mode first
    if (newActiveCount === 0) {
      newMode = 'single'
    } else if (newActiveCount === 1) {
      newMode = 'single'
    } else if (newActiveCount === 2) {
      newMode = 'battle'
    } else {
      newMode = 'tournament'
    }

    console.log('New mode will be:', newMode, 'with', newActiveCount, 'active players')

    // Remove the player
    updatePlayer(playerId, { isActive: false })

    // Note: Allow arena to be completely empty - user can drag champions back in

    // Update game mode
    // gameMode is now computed from active player count
    onGameModeChange?.(newMode)
  }

  const getPlayerEmoji = (id: number) => {
    if (id === 1) return profile.player1Emoji
    if (id === 2) return profile.player2Emoji
    const player = players.find((p) => p.id === id)
    return player?.emoji || '😀'
  }

  const getPlayerName = (id: number) => {
    if (id === 1) return profile.player1Name
    if (id === 2) return profile.player2Name
    const player = players.find((p) => p.id === id)
    return player?.name || `Player ${id}`
  }

  return (
    <div
      className={
        css({
          background: 'white',
          rounded: '3xl',
          p: '8',
          border: '2px solid',
          borderColor: 'gray.200',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.3s ease',
        }) + (className ? ` ${className}` : '')
      }
    >
      {/* Header */}
      <div
        className={css({
          textAlign: 'center',
          mb: '8',
        })}
      >
        <h2
          className={css({
            fontSize: { base: '2xl', md: '3xl' },
            fontWeight: 'bold',
            color: 'gray.900',
            mb: '2',
          })}
        >
          🏟️ Champion Arena
        </h2>
        <p
          className={css({
            color: 'gray.600',
            fontSize: 'lg',
            mb: '4',
          })}
        >
          Drag or click champions to move them between roster and arena!
        </p>

        {/* Current Mode Indicator */}
        <div
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2',
            background:
              arenaPlayers.length === 0
                ? 'linear-gradient(135deg, #f3f4f6, #e5e7eb)'
                : gameMode === 'single'
                  ? 'linear-gradient(135deg, #dbeafe, #bfdbfe)'
                  : gameMode === 'battle'
                    ? 'linear-gradient(135deg, #e9d5ff, #ddd6fe)'
                    : 'linear-gradient(135deg, #fef3c7, #fde68a)',
            px: '4',
            py: '2',
            rounded: 'full',
            border: '2px solid',
            borderColor:
              arenaPlayers.length === 0
                ? 'gray.300'
                : gameMode === 'single'
                  ? 'blue.300'
                  : gameMode === 'battle'
                    ? 'purple.300'
                    : 'yellow.300',
          })}
        >
          <span className={css({ fontSize: 'lg' })}>
            {arenaPlayers.length === 0
              ? '🎯'
              : gameMode === 'single'
                ? '👤'
                : gameMode === 'battle'
                  ? '⚔️'
                  : '🏆'}
          </span>
          <span
            className={css({
              fontWeight: 'bold',
              color:
                arenaPlayers.length === 0
                  ? 'gray.700'
                  : gameMode === 'single'
                    ? 'blue.800'
                    : gameMode === 'battle'
                      ? 'purple.800'
                      : 'yellow.800',
              textTransform: 'uppercase',
              fontSize: 'sm',
            })}
          >
            {arenaPlayers.length === 0
              ? 'Select Champions'
              : gameMode === 'single'
                ? 'Solo Mode'
                : gameMode === 'battle'
                  ? 'Battle Mode'
                  : 'Tournament Mode'}
          </span>
        </div>
      </div>

      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: { base: '1fr', lg: '1fr 1fr' },
          gap: '8',
          alignItems: 'start',
        })}
      >
        {/* Available Champions Roster */}
        <div
          className={css({
            order: { base: 2, lg: 1 },
          })}
        >
          <h3
            className={css({
              fontSize: 'xl',
              fontWeight: 'bold',
              color: 'gray.800',
              mb: '4',
              textAlign: 'center',
            })}
          >
            🎯 Available Champions
          </h3>

          <div
            onDragOver={handleRosterDragOver}
            onDragLeave={handleRosterDragLeave}
            onDrop={handleRosterDrop}
            className={css({
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4',
              justifyContent: 'center',
              p: '6',
              background: isRosterDragOver
                ? 'linear-gradient(135deg, #fef3c7, #fde68a)'
                : 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
              rounded: '2xl',
              border: '2px dashed',
              borderColor: isRosterDragOver ? 'yellow.400' : 'gray.300',
              minH: '32',
              transition: 'all 0.3s ease',
            })}
          >
            {availablePlayers.map((player) => (
              <div
                key={player.id}
                draggable
                onDragStart={() => handleDragStart(player.id)}
                onClick={() => {
                  console.log('Roster card clicked for player:', player.id)
                  handleAddToArena(player.id)
                }}
                className={css({
                  position: 'relative',
                  background: 'white',
                  rounded: '2xl',
                  p: '4',
                  textAlign: 'center',
                  cursor: 'grab',
                  border: '2px solid',
                  borderColor: player.color,
                  boxShadow: '0 8px 20px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.3s ease',
                  width: '120px',
                  minWidth: '120px',
                  flexShrink: 0,
                  _hover: {
                    transform: 'translateY(-4px) scale(1.05)',
                    boxShadow: '0 12px 30px rgba(0, 0, 0, 0.15)',
                    '& .champion-emoji': {
                      transform: 'scale(1.2) rotate(10deg)',
                      animation: 'championBounce 0.6s ease-in-out',
                    },
                  },
                  _active: {
                    cursor: 'grabbing',
                    transform: 'scale(0.95)',
                  },
                })}
              >
                <div
                  className={`${css({
                    fontSize: '3xl',
                    mb: '2',
                    transition: 'all 0.3s ease',
                  })} champion-emoji`}
                >
                  {getPlayerEmoji(player.id)}
                </div>
                <div
                  className={css({
                    fontSize: 'sm',
                    fontWeight: 'bold',
                    color: 'gray.800',
                  })}
                >
                  {getPlayerName(player.id)}
                </div>
                <div
                  className={css({
                    fontSize: 'xs',
                    color: 'gray.600',
                    mt: '1',
                  })}
                >
                  Level {Math.floor((profile.gamesPlayed || 0) / 5) + 1}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onConfigurePlayer?.(player.id)
                  }}
                  className={css({
                    position: 'absolute',
                    top: '2',
                    right: '2',
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid',
                    borderColor: 'gray.300',
                    rounded: 'full',
                    w: '6',
                    h: '6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'xs',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    zIndex: 10,
                    _hover: {
                      background: 'white',
                      borderColor: player.color,
                      transform: 'scale(1.1)',
                    },
                  })}
                >
                  ⚙️
                </button>
              </div>
            ))}

            {availablePlayers.length === 0 && (
              <div
                className={css({
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  color: 'gray.500',
                  fontSize: 'sm',
                  fontStyle: 'italic',
                  py: '8',
                })}
              >
                All champions are in the arena! 🎮
              </div>
            )}
          </div>
        </div>

        {/* Arena Drop Zone */}
        <div
          className={css({
            order: { base: 1, lg: 2 },
          })}
        >
          <h3
            className={css({
              fontSize: 'xl',
              fontWeight: 'bold',
              color: 'gray.800',
              mb: '4',
              textAlign: 'center',
            })}
          >
            🏟️ Battle Arena
          </h3>

          <div
            ref={arenaRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleArenaDrop}
            className={css({
              p: '8',
              background: isDragOver
                ? 'linear-gradient(135deg, #dcfce7, #bbf7d0)'
                : 'linear-gradient(135deg, #fef3c7, #fde68a)',
              rounded: '3xl',
              border: '3px dashed',
              borderColor: isDragOver ? 'green.400' : 'yellow.400',
              minH: '64',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
              position: 'relative',
              overflow: 'hidden',
            })}
          >
            {/* Arena Background Pattern */}
            <div
              className={css({
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage:
                  'radial-gradient(circle at 25% 25%, rgba(251, 191, 36, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(245, 158, 11, 0.1) 0%, transparent 50%)',
                pointerEvents: 'none',
              })}
            />

            {arenaPlayers.length === 0 ? (
              <div
                className={css({
                  textAlign: 'center',
                  zIndex: 1,
                })}
              >
                <div
                  className={css({
                    fontSize: '4xl',
                    mb: '4',
                    opacity: isDragOver ? 1 : 0.6,
                    transition: 'all 0.3s ease',
                  })}
                >
                  {isDragOver ? '✨' : '🏟️'}
                </div>
                <p
                  className={css({
                    color: 'gray.700',
                    fontWeight: 'semibold',
                    fontSize: 'lg',
                  })}
                >
                  {isDragOver ? 'Drop to enter the arena!' : 'Drag champions here'}
                </p>
                <p
                  className={css({
                    color: 'gray.600',
                    fontSize: 'sm',
                    mt: '2',
                  })}
                >
                  1 champion = Solo • 2 = Battle • 3+ = Tournament
                </p>
              </div>
            ) : (
              <div
                className={css({
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4',
                  justifyContent: 'center',
                  w: 'full',
                  zIndex: 1,
                })}
              >
                {arenaPlayers.map((player, index) => (
                  <div
                    key={player.id}
                    draggable
                    onDragStart={() => handleDragStart(player.id)}
                    className={css({
                      background: 'white',
                      rounded: '2xl',
                      p: '4',
                      textAlign: 'center',
                      border: '3px solid',
                      borderColor: player.color,
                      boxShadow: `0 0 20px ${player.color}40`,
                      position: 'relative',
                      animation: `arenaEntry 0.6s ease-out ${index * 0.1}s both`,
                      cursor: 'grab',
                      transition: 'all 0.3s ease',
                      _active: {
                        cursor: 'grabbing',
                      },
                      width: '120px',
                      minWidth: '120px',
                      flexShrink: 0,
                      _hover: {
                        transform: 'translateY(-2px) scale(1.05)',
                        boxShadow: `0 8px 25px ${player.color}60`,
                      },
                    })}
                    onClick={() => {
                      console.log('Arena card clicked for player:', player.id)
                      handleRemoveFromArena(player.id)
                    }}
                  >
                    {/* Remove Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        console.log('Remove button clicked for player:', player.id)
                        handleRemoveFromArena(player.id)
                      }}
                      className={css({
                        position: 'absolute',
                        top: '-2',
                        right: '-2',
                        w: '6',
                        h: '6',
                        background: 'red.500',
                        rounded: 'full',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 'xs',
                        color: 'white',
                        cursor: 'pointer',
                        border: 'none',
                        opacity: 1,
                        transition: 'all 0.3s ease',
                        zIndex: 10,
                        _hover: {
                          background: 'red.600',
                          transform: 'scale(1.1)',
                        },
                      })}
                    >
                      ✕
                    </button>

                    {/* Champion Ready Animation */}
                    <div
                      className={css({
                        position: 'absolute',
                        top: '-4px',
                        left: '-4px',
                        right: '-4px',
                        bottom: '-4px',
                        borderRadius: '20px',
                        border: '2px solid',
                        borderColor: player.color,
                        animation: 'championReady 2s ease-in-out infinite',
                        opacity: 0.6,
                      })}
                    />

                    <div
                      className={css({
                        fontSize: '3xl',
                        mb: '2',
                        animation: 'championFloat 3s ease-in-out infinite',
                      })}
                    >
                      {getPlayerEmoji(player.id)}
                    </div>
                    <div
                      className={css({
                        fontSize: 'sm',
                        fontWeight: 'bold',
                        color: 'gray.800',
                      })}
                    >
                      {getPlayerName(player.id)}
                    </div>
                    <div
                      className={css({
                        fontSize: 'xs',
                        color: 'green.700',
                        fontWeight: 'semibold',
                        mt: '1',
                      })}
                    >
                      READY! 🔥
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Available Games Section */}
      <GameSelector
        variant="detailed"
        className={css({
          mt: '8',
          pt: '8',
          borderTop: '2px solid',
          borderColor: 'gray.200',
        })}
      />
    </div>
  )
}

// Enhanced animations for champion arena
const championArenaAnimations = `
@keyframes championBounce {
  0% { transform: scale(1) rotate(0deg); }
  25% { transform: scale(1.1) rotate(5deg); }
  50% { transform: scale(1.2) rotate(0deg); }
  75% { transform: scale(1.1) rotate(-5deg); }
  100% { transform: scale(1) rotate(0deg); }
}

@keyframes championFloat {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  33% { transform: translateY(-4px) rotate(2deg); }
  66% { transform: translateY(-2px) rotate(-2deg); }
}

@keyframes championReady {
  0%, 100% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.05);
    opacity: 1;
  }
}

@keyframes arenaEntry {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0.8) rotate(180deg);
  }
  60% {
    opacity: 1;
    transform: translateY(-5px) scale(1.1) rotate(-10deg);
  }
  80% {
    transform: translateY(2px) scale(0.95) rotate(5deg);
  }
  100% {
    opacity: 1;
    transform: translateY(0px) scale(1) rotate(0deg);
  }
}

@keyframes arenaGlow {
  0%, 100% {
    box-shadow: 0 0 20px rgba(251, 191, 36, 0.3);
  }
  50% {
    box-shadow: 0 0 30px rgba(251, 191, 36, 0.6);
  }
}
`

// Inject champion arena animations
if (typeof document !== 'undefined' && !document.getElementById('champion-arena-animations')) {
  const style = document.createElement('style')
  style.id = 'champion-arena-animations'
  style.textContent = championArenaAnimations
  document.head.appendChild(style)
}
