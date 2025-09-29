import React from 'react'

type GameMode = 'none' | 'single' | 'battle' | 'tournament'

interface GameModeIndicatorProps {
  gameMode: GameMode
  shouldEmphasize: boolean
  showFullscreenSelection: boolean
}

const gameModeConfig = {
  none: { label: 'Select Players', emoji: '👥', color: '#6b7280' },
  single: { label: 'Solo', emoji: '🎯', color: '#3b82f6' },
  battle: { label: 'Battle', emoji: '⚔️', color: '#8b5cf6' },
  tournament: { label: 'Tournament', emoji: '🏆', color: '#f59e0b' }
}

export function GameModeIndicator({ gameMode, shouldEmphasize, showFullscreenSelection }: GameModeIndicatorProps) {
  const modeInfo = gameModeConfig[gameMode]

  return (
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
  )
}