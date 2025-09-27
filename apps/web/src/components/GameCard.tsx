'use client'

import { css } from '../../styled-system/css'
import { useGameMode } from '../contexts/GameModeContext'
import { GAMES_CONFIG, GameType } from './GameSelector'

interface GameCardProps {
  gameType: GameType
  config: typeof GAMES_CONFIG[GameType]
  variant?: 'compact' | 'detailed'
  className?: string
}

export function GameCard({
  gameType,
  config,
  variant = 'detailed',
  className
}: GameCardProps) {
  const { activePlayerCount } = useGameMode()

  // Check if a game is available based on active player count
  const isGameAvailable = () => {
    return activePlayerCount <= config.maxPlayers && activePlayerCount > 0
  }

  const handleGameClick = () => {
    if (isGameAvailable()) {
      window.location.href = config.url
    }
  }

  const available = isGameAvailable()

  return (
    <div
      onClick={handleGameClick}
      className={css({
        background: 'white',
        rounded: variant === 'compact' ? 'xl' : '2xl',
        p: variant === 'compact' ? '3' : '4',
        border: '2px solid',
        borderColor: available ? 'blue.200' : 'gray.200',
        boxShadow: variant === 'compact'
          ? '0 2px 8px rgba(0, 0, 0, 0.1)'
          : '0 4px 12px rgba(0, 0, 0, 0.1)',
        opacity: available ? 1 : 0.5,
        cursor: available ? 'pointer' : 'not-allowed',
        transition: 'all 0.3s ease',
        _hover: available ? {
          transform: variant === 'compact' ? 'translateY(-1px)' : 'translateY(-2px)',
          boxShadow: variant === 'compact'
            ? '0 4px 12px rgba(59, 130, 246, 0.15)'
            : '0 8px 20px rgba(59, 130, 246, 0.15)',
          borderColor: 'blue.300'
        } : {}
      }, className)}
    >
      <div className={css({
        textAlign: 'center'
      })}>
        <div className={css({
          fontSize: variant === 'compact' ? 'xl' : '2xl',
          mb: variant === 'compact' ? '1' : '2'
        })}>
          {config.icon}
        </div>
        <h4 className={css({
          fontSize: variant === 'compact' ? 'base' : 'lg',
          fontWeight: 'bold',
          color: 'gray.800',
          mb: '1'
        })}>
          {config.name}
        </h4>
        {variant === 'detailed' && (
          <p className={css({
            fontSize: 'sm',
            color: 'gray.600',
            mb: '2'
          })}>
            {config.description}
          </p>
        )}
        <div className={css({
          fontSize: 'xs',
          color: available ? 'green.600' : 'red.600',
          fontWeight: 'semibold'
        })}>
          {activePlayerCount <= config.maxPlayers
            ? `✓ ${activePlayerCount}/${config.maxPlayers} players`
            : `✗ Too many players (max ${config.maxPlayers})`
          }
        </div>
      </div>
    </div>
  )
}