import React from 'react'
import { PlayerTooltip } from './PlayerTooltip'

interface Player {
  id: string
  name: string
  emoji: string
  color?: string
  createdAt?: Date | number
  isLocal?: boolean
}

interface ActivePlayersListProps {
  activePlayers: Player[]
  shouldEmphasize: boolean
  onRemovePlayer: (playerId: string) => void
  onConfigurePlayer: (playerId: string) => void
}

export function ActivePlayersList({
  activePlayers,
  shouldEmphasize,
  onRemovePlayer,
  onConfigurePlayer,
}: ActivePlayersListProps) {
  const [hoveredPlayerId, setHoveredPlayerId] = React.useState<string | null>(null)

  return (
    <>
      {activePlayers.map((player) => (
        <PlayerTooltip
          key={player.id}
          playerName={player.name}
          playerColor={player.color}
          isLocal={player.isLocal !== false}
          createdAt={player.createdAt}
        >
          <div
            style={{
              position: 'relative',
              fontSize: shouldEmphasize ? '56px' : '56px',
              lineHeight: 1,
              transition: 'font-size 0.4s cubic-bezier(0.4, 0, 0.2, 1), filter 0.4s ease',
              filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.3))',
              cursor: shouldEmphasize ? 'pointer' : 'default',
            }}
            onClick={() => shouldEmphasize && onConfigurePlayer(player.id)}
            onMouseEnter={() => shouldEmphasize && setHoveredPlayerId(player.id)}
            onMouseLeave={() => shouldEmphasize && setHoveredPlayerId(null)}
          >
            {player.emoji}
            {shouldEmphasize && hoveredPlayerId === player.id && (
              <>
                {/* Configure button - bottom left */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onConfigurePlayer(player.id)
                  }}
                  style={{
                    position: 'absolute',
                    bottom: '-6px',
                    left: '-6px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: '3px solid white',
                    background: 'linear-gradient(135deg, #6b7280, #4b5563)',
                    color: 'white',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    transition: 'all 0.2s ease',
                    padding: 0,
                    lineHeight: 1,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)'
                    e.currentTarget.style.transform = 'scale(1.2)'
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #6b7280, #4b5563)'
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)'
                  }}
                  aria-label={`Configure ${player.name}`}
                >
                  ⚙
                </button>

                {/* Remove button - top right */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemovePlayer(player.id)
                  }}
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    border: '3px solid white',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    transition: 'all 0.2s ease',
                    padding: 0,
                    lineHeight: 1,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626, #b91c1c)'
                    e.currentTarget.style.transform = 'scale(1.15)'
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.5)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)'
                  }}
                  aria-label={`Remove ${player.name}`}
                >
                  ×
                </button>
              </>
            )}
          </div>
        </PlayerTooltip>
      ))}
    </>
  )
}
