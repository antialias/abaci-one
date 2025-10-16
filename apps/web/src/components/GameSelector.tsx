'use client'

import { useMemo } from 'react'
import { css } from '../../styled-system/css'
import { useGameMode } from '../contexts/GameModeContext'
import { getAllGames } from '../lib/arcade/game-registry'
import { GameCard } from './GameCard'

// Game configuration defining player limits
// Note: "matching" (formerly "battle-arena") has been migrated to the modular game system
export const GAMES_CONFIG = {
  'complement-race': {
    name: 'Speed Complement Race',
    fullName: 'Speed Complement Race 🏁',
    maxPlayers: 1,
    description: 'Race against AI opponents while solving complement problems',
    longDescription:
      'Battle Swift AI and Math Bot in an epic race! Find complement numbers to speed ahead. Choose your mode and difficulty to begin the ultimate math challenge.',
    url: '/arcade/complement-race',
    icon: '🏁',
    chips: ['🤖 AI Opponents', '🔥 Speed Challenge', '🏆 Three Game Modes'],
    color: 'blue',
    gradient: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
    borderColor: 'blue.200',
    difficulty: 'Intermediate',
    available: true,
  },
  'master-organizer': {
    name: 'Master Organizer',
    fullName: 'Master Organizer 🎴',
    maxPlayers: 3,
    description: 'Sort scattered cards into perfect harmony',
    longDescription:
      'Chaos to order! Drag and sort scattered number cards into perfect harmony. Can you organize the mathematical mayhem?',
    url: '/arcade/master-organizer',
    icon: '🎴',
    chips: ['🛠️ In Development', '🧩 Sorting & Logic', '📈 Intermediate'],
    color: 'indigo',
    gradient: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)',
    borderColor: 'indigo.200',
    difficulty: 'Intermediate',
    available: false,
  },
} as const

export type GameType = keyof typeof GAMES_CONFIG | string

/**
 * Get all games from both legacy config and new registry
 */
function getAllGameConfigs() {
  const legacyGames = Object.entries(GAMES_CONFIG).map(([gameType, config]) => ({
    gameType,
    config,
  }))

  // Get games from registry and transform to legacy format
  const registryGames = getAllGames().map((gameDef) => ({
    gameType: gameDef.manifest.name,
    config: {
      name: gameDef.manifest.displayName,
      fullName: gameDef.manifest.displayName,
      maxPlayers: gameDef.manifest.maxPlayers,
      description: gameDef.manifest.description,
      longDescription: gameDef.manifest.longDescription,
      url: `/arcade/room?game=${gameDef.manifest.name}`, // Registry games load in room
      icon: gameDef.manifest.icon,
      chips: gameDef.manifest.chips,
      color: gameDef.manifest.color,
      gradient: gameDef.manifest.gradient,
      borderColor: gameDef.manifest.borderColor,
      difficulty: gameDef.manifest.difficulty,
      available: gameDef.manifest.available,
    },
  }))

  return [...legacyGames, ...registryGames]
}

interface GameSelectorProps {
  variant?: 'compact' | 'detailed'
  showHeader?: boolean
  emptyStateMessage?: string
  className?: string
}

export function GameSelector({
  variant = 'detailed',
  showHeader = true,
  emptyStateMessage = 'Select champions to see available games',
  className,
}: GameSelectorProps) {
  const { activePlayerCount } = useGameMode()

  // Memoize the combined games list
  const allGames = useMemo(() => getAllGameConfigs(), [])

  return (
    <div
      className={`${css({
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      })} ${className || ''}`}
    >
      {showHeader && (
        <h3
          className={css({
            fontSize: variant === 'compact' ? 'lg' : { base: 'lg', md: 'xl' },
            fontWeight: 'bold',
            color: 'gray.800',
            mb: { base: '2', md: '3' },
            textAlign: 'center',
            flexShrink: 0,
          })}
        >
          🎮 Available Games
        </h3>
      )}

      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: { base: '1fr', md: 'repeat(2, 1fr)' },
          gridTemplateRows: { base: 'repeat(4, 1fr)', md: 'repeat(2, 1fr)' },
          gap: variant === 'compact' ? '2' : { base: '2', md: '3' },
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        })}
      >
        {allGames.map(({ gameType, config }) => (
          <GameCard
            key={gameType}
            gameType={gameType as GameType}
            config={config}
            variant={variant}
          />
        ))}
      </div>
    </div>
  )
}
