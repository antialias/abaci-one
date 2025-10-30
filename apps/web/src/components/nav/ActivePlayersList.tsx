import React from 'react'
import { PlayerTooltip } from './PlayerTooltip'
import type { PlayerBadge } from './types'

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
  // Game state for turn indicator
  currentPlayerId?: string
  playerScores?: Record<string, number>
  playerStreaks?: Record<string, number>
  playerBadges?: Record<string, PlayerBadge>
}

export function ActivePlayersList({
  activePlayers,
  shouldEmphasize,
  onRemovePlayer,
  onConfigurePlayer,
  currentPlayerId,
  playerScores = {},
  playerStreaks = {},
  playerBadges = {},
}: ActivePlayersListProps) {
  const [hoveredPlayerId, setHoveredPlayerId] = React.useState<string | null>(null)

  // Helper to get celebration level based on consecutive matches
  const getCelebrationLevel = (consecutiveMatches: number) => {
    if (consecutiveMatches >= 5) return 'legendary'
    if (consecutiveMatches >= 3) return 'epic'
    if (consecutiveMatches >= 2) return 'great'
    return 'normal'
  }

  return (
    <>
      {activePlayers.map((player) => {
        const isCurrentPlayer = currentPlayerId ? player.id === currentPlayerId : false
        const hasGameState = currentPlayerId !== undefined
        const score = playerScores[player.id] || 0
        const streak = playerStreaks[player.id] || 0
        const celebrationLevel = getCelebrationLevel(streak)
        const badge = playerBadges[player.id]

        return (
          <PlayerTooltip
            key={player.id}
            playerName={player.name}
            playerColor={player.color}
            isLocal={player.isLocal !== false}
            createdAt={player.createdAt}
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
                  fontSize: isCurrentPlayer && hasGameState ? '70px' : '56px',
                  lineHeight: 1,
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.3))',
                  cursor: shouldEmphasize ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: hasGameState ? (isCurrentPlayer ? 1 : 0.65) : 1,
                  transform: isCurrentPlayer && hasGameState ? 'scale(1.1)' : 'scale(1)',
                  animation:
                    isCurrentPlayer && hasGameState
                      ? 'avatarFloat 3s ease-in-out infinite'
                      : 'none',
                }}
                onClick={() => shouldEmphasize && onConfigurePlayer(player.id)}
                onMouseEnter={() => shouldEmphasize && setHoveredPlayerId(player.id)}
                onMouseLeave={() => shouldEmphasize && setHoveredPlayerId(null)}
              >
                {/* Border ring for current player */}
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

                {player.emoji}

                {/* Score badge - bottom right */}
                {hasGameState && score > 0 && (
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

                {badge && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      background: badge.background ?? 'rgba(148, 163, 184, 0.25)',
                      color: badge.color ?? '#0f172a',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      boxShadow: badge.shadowColor
                        ? `0 4px 12px ${badge.shadowColor}`
                        : '0 4px 12px rgba(15, 23, 42, 0.25)',
                      border: badge.borderColor
                        ? `2px solid ${badge.borderColor}`
                        : '2px solid rgba(255,255,255,0.4)',
                      backdropFilter: 'blur(4px)',
                      marginTop: '6px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {badge.icon && (
                      <span
                        aria-hidden
                        style={{
                          fontSize: '14px',
                          filter: 'drop-shadow(0 2px 4px rgba(15,23,42,0.35))',
                        }}
                      >
                        {badge.icon}
                      </span>
                    )}
                    <span>{badge.label}</span>
                  </div>
                )}

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
                        e.currentTarget.style.background =
                          'linear-gradient(135deg, #3b82f6, #2563eb)'
                        e.currentTarget.style.transform = 'scale(1.2)'
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          'linear-gradient(135deg, #6b7280, #4b5563)'
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
                        e.currentTarget.style.background =
                          'linear-gradient(135deg, #dc2626, #b91c1c)'
                        e.currentTarget.style.transform = 'scale(1.15)'
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.5)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          'linear-gradient(135deg, #ef4444, #dc2626)'
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

              {/* Turn label */}
              {isCurrentPlayer && hasGameState && (
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: '900',
                    color: player.color || '#3b82f6',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    textShadow: `
                      -1px -1px 0 white,
                      1px -1px 0 white,
                      -1px 1px 0 white,
                      1px 1px 0 white,
                      0 2px 4px rgba(0,0,0,0.3)
                    `,
                    marginTop: '-2px',
                    position: 'relative',
                    zIndex: 10,
                  }}
                >
                  Your turn
                </div>
              )}
            </div>
          </PlayerTooltip>
        )
      })}

      {/* Animation styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
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
    </>
  )
}
