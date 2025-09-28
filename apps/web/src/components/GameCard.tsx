'use client'

import { useRouter } from 'next/navigation'
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
  const router = useRouter()

  // Check if a game is available based on active player count
  const isGameAvailable = () => {
    return activePlayerCount <= config.maxPlayers && activePlayerCount > 0
  }

  const handleGameClick = () => {
    if (isGameAvailable() && config.available !== false) {
      console.log('🔄 GameCard: Navigating with Next.js router (no page reload)')
      // Use Next.js router for client-side navigation - this preserves fullscreen!
      router.push(config.url)
    }
  }

  const available = isGameAvailable() && config.available !== false

  return (
    <div
      onClick={handleGameClick}
      className={css({
        background: config.gradient || 'white',
        rounded: variant === 'compact' ? 'xl' : '2xl',
        p: variant === 'compact' ? '3' : { base: '3', md: '4', lg: '6' },
        border: '2px solid',
        borderColor: available ? config.borderColor || 'blue.200' : 'gray.200',
        boxShadow: variant === 'compact'
          ? '0 4px 12px rgba(0, 0, 0, 0.1)'
          : '0 10px 40px rgba(0, 0, 0, 0.1)',
        opacity: available ? 1 : 0.5,
        cursor: available ? 'pointer' : 'not-allowed',
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        position: 'relative',
        overflow: 'visible',
        _hover: available ? {
          transform: variant === 'compact' ? 'translateY(-2px) scale(1.02)' : 'translateY(-8px) scale(1.02)',
          boxShadow: variant === 'compact'
            ? '0 8px 25px rgba(59, 130, 246, 0.15)'
            : '0 25px 50px rgba(59, 130, 246, 0.15)',
          borderColor: config.color === 'green' ? 'green.300' : config.color === 'purple' ? 'purple.300' : 'blue.300'
        } : {}
      }, className)}
    >
      {/* Game icon with enhanced styling */}
      <div className={css({
        textAlign: 'center',
        mb: variant === 'compact' ? '1' : { base: '1', md: '2' }
      })}>
        <div className={css({
          fontSize: variant === 'compact' ? 'xl' : { base: 'xl', md: '2xl', lg: '3xl' },
          mb: variant === 'compact' ? '1' : { base: '1', md: '2' },
          display: 'inline-block',
          transform: 'perspective(1000px)',
          transition: 'all 0.3s ease'
        })}>
          {config.icon}
        </div>

        <h4 className={css({
          fontSize: variant === 'compact' ? 'md' : { base: 'lg', md: 'xl', lg: '2xl' },
          fontWeight: 'bold',
          color: 'gray.900',
          mb: variant === 'compact' ? '0.5' : { base: '1', md: '2' }
        })}>
          {variant === 'detailed' ? config.fullName || config.name : config.name}
        </h4>

        {variant === 'detailed' && (
          <p className={css({
            fontSize: { base: 'xs', md: 'sm', lg: 'base' },
            color: 'gray.600',
            mb: { base: '2', md: '3' },
            lineHeight: 'relaxed',
            display: { base: 'none', sm: 'block' }
          })}>
            {config.description}
          </p>
        )}

        {/* Feature chips */}
        {variant === 'detailed' && config.chips && (
          <div className={css({
            display: 'flex',
            flexWrap: 'wrap',
            gap: { base: '1', md: '2' },
            justifyContent: 'center',
            mb: { base: '2', md: '3' }
          })}>
            {config.chips.map((chip, index) => (
              <span
                key={index}
                className={css({
                  px: { base: '2', md: '3' },
                  py: { base: '0.5', md: '1' },
                  background: config.color === 'green'
                    ? 'linear-gradient(135deg, #d1fae5, #a7f3d0)'
                    : config.color === 'purple'
                    ? 'linear-gradient(135deg, #e0e7ff, #c7d2fe)'
                    : 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
                  color: config.color === 'green'
                    ? 'green.800'
                    : config.color === 'purple'
                    ? 'indigo.800'
                    : 'blue.800',
                  rounded: 'full',
                  fontSize: { base: '2xs', md: 'xs' },
                  fontWeight: 'semibold',
                  border: '1px solid',
                  borderColor: config.color === 'green'
                    ? 'green.200'
                    : config.color === 'purple'
                    ? 'indigo.200'
                    : 'blue.200',
                  opacity: available ? 1 : 0.8
                })}
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        {/* Player availability indicator */}
        <div className={css({
          fontSize: variant === 'compact' ? '2xs' : { base: '2xs', md: 'xs', lg: 'sm' },
          color: available ? 'green.600' : 'red.600',
          fontWeight: 'semibold',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '1',
          px: { base: '1.5', md: '2' },
          py: { base: '0.5', md: '1' },
          background: available ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          rounded: 'full',
          border: '1px solid',
          borderColor: available ? 'green.200' : 'red.200'
        })}>
          {activePlayerCount <= config.maxPlayers
            ? `✓ ${activePlayerCount}/${config.maxPlayers} ${activePlayerCount === 1 ? 'player' : 'players'}`
            : `✗ Too many players (max ${config.maxPlayers})`
          }
        </div>
      </div>
    </div>
  )
}