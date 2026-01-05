import type React from 'react'

interface GameControlButtonsProps {
  onSetup?: () => void
  onNewGame?: () => void
  onQuit?: () => void
}

// Button configurations matching the refined translucent aesthetic
const buttonConfigs = {
  setup: {
    emoji: '⚙️',
    label: 'Setup',
    color: '#6b7280', // neutral gray
  },
  newGame: {
    emoji: '🎮',
    label: 'New Game',
    color: '#3b82f6', // blue
  },
  quit: {
    emoji: '🏟️',
    label: 'Quit',
    color: '#f59e0b', // amber/orange
  },
}

export function GameControlButtons({ onSetup, onNewGame, onQuit }: GameControlButtonsProps) {
  const createButtonStyle = (color: string, isHovered = false): React.CSSProperties => ({
    background: isHovered ? `linear-gradient(135deg, ${color}30, ${color}40)` : `${color}20`,
    border: `2px solid ${color}${isHovered ? '60' : '40'}`,
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: color,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.2s ease',
    boxShadow: isHovered ? `0 2px 8px ${color}30` : 'none',
  })

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>, color: string) => {
    const btn = e.currentTarget
    btn.style.background = `linear-gradient(135deg, ${color}30, ${color}40)`
    btn.style.borderColor = `${color}60`
    btn.style.boxShadow = `0 2px 8px ${color}30`
    btn.style.transform = 'translateY(-1px)'
  }

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>, color: string) => {
    const btn = e.currentTarget
    btn.style.background = `${color}20`
    btn.style.borderColor = `${color}40`
    btn.style.boxShadow = 'none'
    btn.style.transform = 'translateY(0)'
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '6px',
        alignItems: 'center',
        flexWrap: 'nowrap',
      }}
    >
      {onSetup && (
        <button
          type="button"
          onClick={onSetup}
          style={createButtonStyle(buttonConfigs.setup.color)}
          onMouseEnter={(e) => handleMouseEnter(e, buttonConfigs.setup.color)}
          onMouseLeave={(e) => handleMouseLeave(e, buttonConfigs.setup.color)}
          aria-label="Setup game"
        >
          <span style={{ fontSize: '12px' }}>{buttonConfigs.setup.emoji}</span>
          <span style={{ whiteSpace: 'nowrap' }}>{buttonConfigs.setup.label}</span>
        </button>
      )}

      {onNewGame && (
        <button
          type="button"
          onClick={onNewGame}
          style={createButtonStyle(buttonConfigs.newGame.color)}
          onMouseEnter={(e) => handleMouseEnter(e, buttonConfigs.newGame.color)}
          onMouseLeave={(e) => handleMouseLeave(e, buttonConfigs.newGame.color)}
          aria-label="Start new game"
        >
          <span style={{ fontSize: '12px' }}>{buttonConfigs.newGame.emoji}</span>
          <span style={{ whiteSpace: 'nowrap' }}>{buttonConfigs.newGame.label}</span>
        </button>
      )}

      {onQuit && (
        <button
          type="button"
          onClick={onQuit}
          style={createButtonStyle(buttonConfigs.quit.color)}
          onMouseEnter={(e) => handleMouseEnter(e, buttonConfigs.quit.color)}
          onMouseLeave={(e) => handleMouseLeave(e, buttonConfigs.quit.color)}
          aria-label="Quit to arcade"
        >
          <span style={{ fontSize: '12px' }}>{buttonConfigs.quit.emoji}</span>
          <span style={{ whiteSpace: 'nowrap' }}>{buttonConfigs.quit.label}</span>
        </button>
      )}
    </div>
  )
}
