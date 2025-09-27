'use client'

import { css } from '../../styled-system/css'
import { useGameMode } from '../contexts/GameModeContext'
import { GameCard } from './GameCard'

// Game configuration defining player limits
export const GAMES_CONFIG = {
  'memory-lightning': {
    name: 'Speed Memory Quiz',
    maxPlayers: 1,
    description: 'Solo memory challenge',
    url: '/games/memory-quiz',
    icon: '⚡'
  },
  'battle-arena': {
    name: 'Matching Pairs Battle',
    maxPlayers: 4,
    description: 'Multiplayer memory battle',
    url: '/games/matching',
    icon: '⚔️'
  }
} as const

export type GameType = keyof typeof GAMES_CONFIG

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
  className
}: GameSelectorProps) {
  const { activePlayerCount } = useGameMode()

  return (
    <div className={className}>
      {showHeader && (
        <h3 className={css({
          fontSize: variant === 'compact' ? 'lg' : 'xl',
          fontWeight: 'bold',
          color: 'gray.800',
          mb: '4',
          textAlign: 'center'
        })}>
          🎮 Available Games
        </h3>
      )}

      {activePlayerCount === 0 ? (
        <div className={css({
          textAlign: 'center',
          py: variant === 'compact' ? '4' : '8',
          color: 'gray.500'
        })}>
          <div className={css({ fontSize: variant === 'compact' ? '2xl' : '3xl', mb: '2' })}>🎯</div>
          <p className={css({ fontSize: variant === 'compact' ? 'sm' : 'base' })}>
            {emptyStateMessage}
          </p>
        </div>
      ) : (
        <div className={css({
          display: 'grid',
          gridTemplateColumns: { base: '1fr', md: variant === 'compact' ? 'repeat(2, 1fr)' : 'repeat(2, 1fr)' },
          gap: variant === 'compact' ? '3' : '4'
        })}>
          {Object.entries(GAMES_CONFIG).map(([gameType, config]) => (
            <GameCard
              key={gameType}
              gameType={gameType as GameType}
              config={config}
              variant={variant}
            />
          ))}
        </div>
      )}
    </div>
  )
}