import React from 'react'
import { PlayerTooltip } from './PlayerTooltip'

interface NetworkPlayer {
  id: string
  emoji?: string
  name?: string
  color?: string
  memberName?: string
}

interface NetworkPlayerIndicatorProps {
  player: NetworkPlayer
  shouldEmphasize: boolean
}

/**
 * Displays a network player with a special "network" frame border
 * to distinguish them from local players
 */
export function NetworkPlayerIndicator({ player, shouldEmphasize }: NetworkPlayerIndicatorProps) {
  const [isHovered, setIsHovered] = React.useState(false)
  const playerName = player.name || `Network Player ${player.id.slice(0, 8)}`
  const extraInfo = player.memberName ? `Controlled by ${player.memberName}` : undefined

  return (
    <PlayerTooltip
      playerName={playerName}
      playerColor={player.color}
      isLocal={false}
      extraInfo={extraInfo}
    >
      <div
        style={{
          position: 'relative',
          fontSize: '56px',
          lineHeight: 1,
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          cursor: 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Network frame border - larger and more prominent */}
        <div
          style={{
            position: 'absolute',
            inset: '-8px',
            borderRadius: '12px',
            background: `
            linear-gradient(135deg,
              rgba(59, 130, 246, 0.5),
              rgba(147, 51, 234, 0.5),
              rgba(236, 72, 153, 0.5))
          `,
            opacity: isHovered ? 1 : 0.8,
            transition: 'opacity 0.2s ease',
            boxShadow: '0 6px 16px rgba(59, 130, 246, 0.3)',
            zIndex: -1,
          }}
        />

        {/* Player emoji or fallback */}
        <div
          style={{
            position: 'relative',
            filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.3))',
          }}
        >
          {player.emoji || '🌐'}
        </div>

        {/* Network icon badge - larger */}
        <div
          style={{
            position: 'absolute',
            bottom: '-6px',
            left: '-6px',
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            border: '3px solid white',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            color: 'white',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
            zIndex: 1,
          }}
        >
          📡
        </div>
      </div>
    </PlayerTooltip>
  )
}
