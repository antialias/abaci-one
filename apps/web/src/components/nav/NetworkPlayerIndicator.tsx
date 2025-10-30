import { useState } from 'react'
import { PlayerTooltip } from './PlayerTooltip'
import { ReportPlayerModal } from './ReportPlayerModal'
import type { PlayerBadge } from './types'

interface NetworkPlayer {
  id: string
  emoji?: string
  name?: string
  color?: string
  memberName?: string
  isOnline?: boolean
  userId?: string // The actual user ID controlling this player
}

interface NetworkPlayerIndicatorProps {
  player: NetworkPlayer
  shouldEmphasize: boolean
  // Game state for turn indicator
  currentPlayerId?: string
  playerScores?: Record<string, number>
  playerStreaks?: Record<string, number>
  playerBadges?: Record<string, PlayerBadge>
  // Moderation props
  roomId?: string
  currentUserId?: string
  isCurrentUserHost?: boolean
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
  playerBadges = {},
  roomId,
  currentUserId,
  isCurrentUserHost,
}: NetworkPlayerIndicatorProps) {
  const [showReportModal, setShowReportModal] = useState(false)

  const playerName = player.name || `Network Player ${player.id.slice(0, 8)}`
  const extraInfo = player.memberName ? `Controlled by ${player.memberName}` : undefined
  const isOnline = player.isOnline !== false // Default to online if not specified

  // Show report button if:
  // - We have roomId and currentUserId
  // - Current user is NOT the host
  // - This player is not the current user
  // - Player has a userId
  const canReport = Boolean(
    roomId &&
      currentUserId &&
      !isCurrentUserHost &&
      player.userId &&
      player.userId !== currentUserId
  )

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
  const badge = playerBadges[player.id]

  return (
    <>
      <PlayerTooltip
        playerName={playerName}
        playerColor={player.color}
        isLocal={false}
        extraInfo={extraInfo}
        canReport={canReport}
        onReport={() => setShowReportModal(true)}
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
          >
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
                  border: badge.borderColor ? `2px solid ${badge.borderColor}` : '2px solid rgba(255,255,255,0.4)',
                  backdropFilter: 'blur(4px)',
                  marginTop: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                {badge.icon && (
                  <span
                    aria-hidden
                    style={{ fontSize: '14px', filter: 'drop-shadow(0 2px 4px rgba(15,23,42,0.35))' }}
                  >
                    {badge.icon}
                  </span>
                )}
                <span>{badge.label}</span>
              </div>
            )}

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
              Their turn
            </div>
          )}
        </div>
      </PlayerTooltip>

      {/* Report modal */}
      {canReport && player.userId && (
        <ReportPlayerModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          roomId={roomId!}
          reportedUser={{
            id: player.userId,
            name: player.memberName || playerName,
          }}
        />
      )}
    </>
  )
}
