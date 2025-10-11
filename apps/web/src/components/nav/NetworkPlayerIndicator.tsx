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
          fontSize: shouldEmphasize ? '48px' : '20px',
          lineHeight: 1,
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          cursor: 'default',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Network frame border */}
        <div
          style={{
            position: 'absolute',
            inset: '-6px',
            borderRadius: '8px',
            background: `
            linear-gradient(135deg,
              rgba(59, 130, 246, 0.4),
              rgba(147, 51, 234, 0.4),
              rgba(236, 72, 153, 0.4))
          `,
            opacity: isHovered ? 1 : 0.7,
            transition: 'opacity 0.2s ease',
            zIndex: -1,
          }}
        />

        {/* Animated network signal indicator */}
        <div
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: 'rgba(34, 197, 94, 0.9)',
            boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)',
            animation: 'networkPulse 2s ease-in-out infinite',
            zIndex: 1,
          }}
        />

        {/* Player emoji or fallback */}
        <div
          style={{
            position: 'relative',
            filter: shouldEmphasize ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))' : 'none',
          }}
        >
          {player.emoji || '🌐'}
        </div>

        {/* Network icon badge */}
        <div
          style={{
            position: 'absolute',
            bottom: '-4px',
            left: '-4px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: '2px solid white',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            color: 'white',
            fontSize: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            zIndex: 1,
          }}
        >
          📡
        </div>

        <style
          dangerouslySetInnerHTML={{
            __html: `
            @keyframes networkPulse {
              0%, 100% {
                opacity: 1;
                transform: scale(1);
              }
              50% {
                opacity: 0.5;
                transform: scale(1.2);
              }
            }
          `,
          }}
        />
      </div>
    </PlayerTooltip>
  )
}
