import React from 'react'
import { PlayerTooltip } from './PlayerTooltip'

interface NetworkPlayer {
  id: string
  emoji?: string
  name?: string
  color?: string
  memberName?: string
  isOnline?: boolean
}

interface NetworkPlayerIndicatorProps {
  player: NetworkPlayer
  shouldEmphasize: boolean
  // Game state for turn indicator
  currentPlayerId?: string
  playerScores?: Record<string, number>
  playerStreaks?: Record<string, number>
}

/**
 * Displays a network player with a special "network" frame border
 * to distinguish them from local players
 */
export function NetworkPlayerIndicator({
  player,
  shouldEmphasize,
  currentPlayerId,
  playerScores = {},
  playerStreaks = {},
}: NetworkPlayerIndicatorProps) {
  const [isHovered, setIsHovered] = React.useState(false)
  const playerName = player.name || `Network Player ${player.id.slice(0, 8)}`
  const extraInfo = player.memberName ? `Controlled by ${player.memberName}` : undefined
  const isOnline = player.isOnline !== false // Default to online if not specified

  // Turn indicator logic (same as ActivePlayersList)
  const isCurrentPlayer = currentPlayerId ? player.id === currentPlayerId : false
  const hasGameState = currentPlayerId !== undefined
  const score = playerScores[player.id] || 0
  const streak = playerStreaks[player.id] || 0

  // Helper to get celebration level based on consecutive matches
  const getCelebrationLevel = (consecutiveMatches: number) => {
    if (consecutiveMatches >= 5) return 'legendary'
    if (consecutiveMatches >= 3) return 'epic'
    if (consecutiveMatches >= 2) return 'great'
    return 'normal'
  }
  const celebrationLevel = getCelebrationLevel(streak)

  return (
    <PlayerTooltip
      playerName={playerName}
      playerColor={player.color}
      isLocal={false}
      extraInfo={extraInfo}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <div
          style={{
            position: 'relative',
            fontSize: '56px',
            lineHeight: 1,
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.3))',
            cursor: 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: hasGameState ? (isCurrentPlayer ? 1 : 0.65) : 1,
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
        {/* Network frame border - only show when not current player */}
        {!isCurrentPlayer && (
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
        )}

        {/* Turn indicator border ring - show when current player */}
        {isCurrentPlayer && hasGameState && (
          <div
            style={{
              position: 'absolute',
              inset: '-8px',
              borderRadius: '50%',
              border: `4px solid ${player.color || '#3b82f6'}`,
              boxShadow: `0 0 0 2px white, 0 0 20px ${player.color || '#3b82f6'}80`,
              animation: 'borderPulse 2s ease-in-out infinite',
              zIndex: -1,
            }}
          />
        )}

        {/* Turn indicator arrow badge */}
        {isCurrentPlayer && hasGameState && (
          <div
            style={{
              position: 'absolute',
              top: '-12px',
              left: '-12px',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: '3px solid white',
              background: `linear-gradient(135deg, ${player.color || '#3b82f6'}, ${player.color || '#3b82f6'}dd)`,
              color: 'white',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 4px 12px ${player.color || '#3b82f6'}80`,
              zIndex: 3,
              animation: 'turnBadgePulse 1.5s ease-in-out infinite',
            }}
          >
            ▶
          </div>
        )}

        {/* Player emoji or fallback */}
        {player.emoji || '🌐'}

        {/* Score badge - bottom right (same position as network badge when no score) */}
        {hasGameState && score > 0 ? (
          <div
            style={{
              position: 'absolute',
              bottom: '-6px',
              right: '-6px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: '3px solid white',
              background: player.color || '#3b82f6',
              color: 'white',
              fontSize: '11px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
              zIndex: 2,
              lineHeight: 1,
            }}
          >
            {score}
          </div>
        ) : (
          /* Network icon badge - show when no score */
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
              animation: isOnline ? 'none' : 'offlinePulse 2s ease-in-out infinite',
            }}
          >
            📡
          </div>
        )}

        {/* Streak badge - top right */}
        {hasGameState && streak >= 2 && (
          <div
            style={{
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              fontSize: '20px',
              filter:
                celebrationLevel === 'legendary'
                  ? 'drop-shadow(0 0 8px #a855f7)'
                  : celebrationLevel === 'epic'
                    ? 'drop-shadow(0 0 8px #f97316)'
                    : 'drop-shadow(0 0 8px #22c55e)',
              animation: isCurrentPlayer ? 'streakPulse 1s ease-in-out infinite' : 'none',
              zIndex: 2,
            }}
          >
            🔥
          </div>
        )}

        <style
          dangerouslySetInnerHTML={{
            __html: `
            @keyframes offlinePulse {
              0%, 100% {
                opacity: 1;
              }
              50% {
                opacity: 0.3;
              }
            }

            @keyframes avatarFloat {
              0%, 100% {
                transform: scale(1.1) translateY(0px);
              }
              50% {
                transform: scale(1.1) translateY(-6px);
              }
            }

            @keyframes borderPulse {
              0%, 100% {
                opacity: 1;
                box-shadow: 0 0 0 2px white, 0 0 20px currentColor;
              }
              50% {
                opacity: 0.8;
                box-shadow: 0 0 0 2px white, 0 0 30px currentColor;
              }
            }

            @keyframes streakPulse {
              0%, 100% {
                transform: scale(1);
                opacity: 1;
              }
              50% {
                transform: scale(1.2);
                opacity: 0.8;
              }
            }

            @keyframes turnBadgePulse {
              0%, 100% {
                transform: scale(1);
                box-shadow: 0 4px 12px currentColor;
              }
              50% {
                transform: scale(1.15);
                box-shadow: 0 6px 20px currentColor;
              }
            }
          `,
          }}
        />
        </div>

        {/* Turn label */}
        {isCurrentPlayer && hasGameState && (
          <div
            style={{
              fontSize: '11px',
              fontWeight: 'bold',
              color: player.color || '#3b82f6',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              textShadow: '0 2px 4px rgba(0,0,0,0.2)',
              marginTop: '-2px',
            }}
          >
            Their turn
          </div>
        )}
      </div>
    </PlayerTooltip>
  )
}
