'use client'

import React from 'react'
import { AppNavBar } from './AppNavBar'
import { useGameMode } from '../contexts/GameModeContext'
import { useUserProfile } from '../contexts/UserProfileContext'

interface PageWithNavProps {
  navTitle?: string
  navEmoji?: string
  emphasizeGameContext?: boolean
  children: React.ReactNode
}

export function PageWithNav({ navTitle, navEmoji, emphasizeGameContext = false, children }: PageWithNavProps) {
  const { players, activePlayerCount, updatePlayer } = useGameMode()
  const { profile } = useUserProfile()
  const [mounted, setMounted] = React.useState(false)
  const [hoveredPlayerId, setHoveredPlayerId] = React.useState<number | null>(null)

  // Delay mounting animation slightly for smooth transition
  React.useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  const handleRemovePlayer = (playerId: number) => {
    updatePlayer(playerId, { isActive: false })
  }

  // Transform players to use profile emojis for players 1 and 2 (same as EnhancedChampionArena)
  const activePlayers = players
    .filter(p => p.isActive)
    .map(player => ({
      ...player,
      emoji: player.id === 1 ? profile.player1Emoji : player.id === 2 ? profile.player2Emoji : player.emoji,
      name: player.id === 1 ? profile.player1Name : player.id === 2 ? profile.player2Name : player.name
    }))

  // Compute game mode from active player count
  const gameMode = activePlayerCount === 1 ? 'single' :
                   activePlayerCount === 2 ? 'battle' :
                   activePlayerCount >= 3 ? 'tournament' : 'single'

  const gameModeConfig = {
    single: { label: 'Solo', emoji: '🎯', color: '#3b82f6' },
    battle: { label: 'Battle', emoji: '⚔️', color: '#8b5cf6' },
    tournament: { label: 'Tournament', emoji: '🏆', color: '#f59e0b' }
  }

  const modeInfo = gameModeConfig[gameMode]

  // Use mounted state to trigger initial animation
  const shouldEmphasize = emphasizeGameContext && mounted

  // Create nav content if title is provided
  const navContent = navTitle ? (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: shouldEmphasize ? '16px' : '12px',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      <h1 style={{
        fontSize: '18px',
        fontWeight: 'bold',
        background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
        backgroundClip: 'text',
        color: 'transparent',
        margin: 0
      }}>
        {navEmoji && `${navEmoji} `}{navTitle}
      </h1>

      {/* Game Mode Badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: shouldEmphasize ? '10px' : '4px',
        padding: shouldEmphasize ? '12px 24px' : '4px 8px',
        background: shouldEmphasize
          ? `linear-gradient(135deg, ${modeInfo.color}25, ${modeInfo.color}35)`
          : `${modeInfo.color}20`,
        border: `${shouldEmphasize ? '3px' : '2px'} solid ${modeInfo.color}${shouldEmphasize ? '70' : '40'}`,
        borderRadius: shouldEmphasize ? '16px' : '6px',
        fontSize: shouldEmphasize ? '20px' : '12px',
        fontWeight: 'bold',
        color: modeInfo.color,
        boxShadow: shouldEmphasize ? `0 6px 20px ${modeInfo.color}40, inset 0 1px 0 rgba(255,255,255,0.3)` : 'none',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: shouldEmphasize ? 'scale(1.05)' : 'scale(1)'
      }}>
        <span style={{
          fontSize: shouldEmphasize ? '28px' : '12px',
          transition: 'font-size 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>{modeInfo.emoji}</span>
        <span>{modeInfo.label}</span>
      </div>

      {/* Active Players */}
      {activePlayers.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: shouldEmphasize ? '12px' : '2px',
          padding: shouldEmphasize ? '12px 20px' : '0',
          background: shouldEmphasize
            ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.08))'
            : 'transparent',
          borderRadius: shouldEmphasize ? '16px' : '0',
          border: shouldEmphasize ? '3px solid rgba(255, 255, 255, 0.25)' : 'none',
          boxShadow: shouldEmphasize ? '0 6px 20px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255,255,255,0.3)' : 'none',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: shouldEmphasize ? 'scale(1.05)' : 'scale(1)'
        }}>
          {activePlayers.map(player => (
            <div
              key={player.id}
              style={{
                position: 'relative',
                fontSize: shouldEmphasize ? '48px' : '20px',
                lineHeight: 1,
                transition: 'font-size 0.4s cubic-bezier(0.4, 0, 0.2, 1), filter 0.4s ease',
                filter: shouldEmphasize ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))' : 'none',
                transform: shouldEmphasize ? 'translateY(0)' : 'translateY(0)',
                cursor: 'pointer'
              }}
              title={player.name}
              onMouseEnter={() => setHoveredPlayerId(player.id)}
              onMouseLeave={() => setHoveredPlayerId(null)}
            >
              {player.emoji}
              {hoveredPlayerId === player.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemovePlayer(player.id)
                  }}
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: '2px solid white',
                    background: '#ef4444',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    transition: 'all 0.2s ease',
                    padding: 0,
                    lineHeight: 1
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#dc2626'
                    e.currentTarget.style.transform = 'scale(1.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#ef4444'
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                  aria-label={`Remove ${player.name}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  ) : null

  return (
    <>
      <AppNavBar navSlot={navContent} />
      {children}
    </>
  )
}