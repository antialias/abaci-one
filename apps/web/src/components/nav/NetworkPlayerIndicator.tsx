import { useState } from 'react'
import { PlayerTooltip } from './PlayerTooltip'
import { ReportPlayerModal } from './ReportPlayerModal'
import type { PlayerBadge } from './types'
import { useDeactivatePlayer } from '@/hooks/useRoomData'

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
  // Side assignments (for 2-player games)
  whitePlayerId?: string | null
  blackPlayerId?: string | null
  onAssignWhitePlayer?: (playerId: string | null) => void
  onAssignBlackPlayer?: (playerId: string | null) => void
  // Room context for assignment permissions
  isInRoom?: boolean
  // Game phase (for showing spectating vs assign)
  gamePhase?: 'setup' | 'playing' | 'results'
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
  whitePlayerId,
  blackPlayerId,
  onAssignWhitePlayer,
  onAssignBlackPlayer,
  isInRoom = true, // Network players are always in a room
  gamePhase,
}: NetworkPlayerIndicatorProps) {
  const [showReportModal, setShowReportModal] = useState(false)
  const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null)
  const [hoveredBadge, setHoveredBadge] = useState(false)
  const [clickCooldown, setClickCooldown] = useState(false)
  const { mutate: deactivatePlayer } = useDeactivatePlayer()

  // Determine if user can assign players
  // For network players: Can assign only if user is host (always in a room)
  const canAssignPlayers = isCurrentUserHost

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

  // Handler for deactivating player (host only)
  const handleDeactivate = () => {
    if (!roomId || !isCurrentUserHost) return
    deactivatePlayer({ roomId, playerId: player.id })
  }

  // Handler to assign to white
  const handleAssignWhite = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onAssignWhitePlayer) return
    onAssignWhitePlayer(player.id)
    setClickCooldown(true)
  }

  // Handler to assign to black
  const handleAssignBlack = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onAssignBlackPlayer) return
    onAssignBlackPlayer(player.id)
    setClickCooldown(true)
  }

  // Handler to swap sides
  const handleSwap = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onAssignWhitePlayer || !onAssignBlackPlayer) return

    if (whitePlayerId === player.id) {
      // Currently white, swap with black player
      const currentBlack = blackPlayerId ?? null
      onAssignWhitePlayer(currentBlack)
      onAssignBlackPlayer(player.id)
    } else if (blackPlayerId === player.id) {
      // Currently black, swap with white player
      const currentWhite = whitePlayerId ?? null
      onAssignBlackPlayer(currentWhite)
      onAssignWhitePlayer(player.id)
    }
  }

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
            onMouseEnter={() => setHoveredPlayerId(player.id)}
            onMouseLeave={() => setHoveredPlayerId(null)}
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

            {/* Close button - top left (host only, on hover) */}
            {shouldEmphasize && isCurrentUserHost && hoveredPlayerId === player.id && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeactivate()
                }}
                style={{
                  position: 'absolute',
                  top: '-6px',
                  left: '-6px',
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
                onFocus={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626, #b91c1c)'
                  e.currentTarget.style.transform = 'scale(1.15)'
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.5)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)'
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)'
                }}
                aria-label={`Deactivate ${playerName}`}
              >
                ×
              </button>
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

          {/* Side assignment badge (white/black for 2-player games) */}
          {onAssignWhitePlayer && onAssignBlackPlayer && (
            <div
              style={{
                marginTop: '8px',
                width: '88px', // Fixed width to prevent layout shift
                transition: 'none', // Prevent any inherited transitions
              }}
              onMouseEnter={() => canAssignPlayers && setHoveredBadge(true)}
              onMouseLeave={() => {
                setHoveredBadge(false)
                setClickCooldown(false)
              }}
            >
              {/* Unassigned player - show split button on hover */}
              {whitePlayerId !== player.id && blackPlayerId !== player.id && (
                <>
                  {canAssignPlayers ? (
                    // Host: show interactive assignment buttons
                    <>
                      {hoveredBadge && !clickCooldown ? (
                        // Hover state: split button
                        <div style={{ display: 'flex', width: '100%' }}>
                          <div
                            onClick={handleAssignWhite}
                            style={{
                              flex: 1,
                              padding: '4px 0',
                              borderRadius: '12px 0 0 12px',
                              fontSize: '10px',
                              fontWeight: '800',
                              letterSpacing: '0.5px',
                              textTransform: 'uppercase',
                              cursor: 'pointer',
                              background: 'linear-gradient(135deg, #f0f0f0, #ffffff)',
                              color: '#1a202c',
                              border: '2px solid #cbd5e0',
                              borderRight: 'none',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                              textAlign: 'center',
                            }}
                          >
                            W
                          </div>
                          <div
                            onClick={handleAssignBlack}
                            style={{
                              flex: 1,
                              padding: '4px 0',
                              borderRadius: '0 12px 12px 0',
                              fontSize: '10px',
                              fontWeight: '800',
                              letterSpacing: '0.5px',
                              textTransform: 'uppercase',
                              cursor: 'pointer',
                              background: 'linear-gradient(135deg, #2d3748, #1a202c)',
                              color: '#ffffff',
                              border: '2px solid #4a5568',
                              borderLeft: 'none',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                              textAlign: 'center',
                            }}
                          >
                            B
                          </div>
                        </div>
                      ) : (
                        // Normal state: ASSIGN or SPECTATING button
                        <div
                          style={{
                            width: '100%',
                            padding: '4px 0',
                            borderRadius: '12px',
                            fontSize: '10px',
                            fontWeight: '800',
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            background: 'linear-gradient(135deg, #e5e7eb, #d1d5db)',
                            color: '#6b7280',
                            border: '2px solid #9ca3af',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            textAlign: 'center',
                            transition: 'none',
                          }}
                        >
                          {gamePhase === 'playing' ? 'SPECTATING' : 'ASSIGN'}
                        </div>
                      )}
                    </>
                  ) : // Guest: show SPECTATING during gameplay, nothing during setup
                  gamePhase === 'playing' ? (
                    <div
                      style={{
                        width: '100%',
                        padding: '4px 0',
                        borderRadius: '12px',
                        fontSize: '10px',
                        fontWeight: '800',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        background: 'transparent',
                        color: '#9ca3af',
                        border: '2px solid transparent',
                        textAlign: 'center',
                        opacity: 0.5,
                      }}
                    >
                      SPECTATING
                    </div>
                  ) : (
                    // During setup/results: show nothing
                    <div style={{ width: '100%', height: '28px' }} />
                  )}
                </>
              )}

              {/* White player - show SWAP to black on hover */}
              {whitePlayerId === player.id && (
                <>
                  {canAssignPlayers ? (
                    // Host: show interactive swap
                    <>
                      {hoveredBadge && !clickCooldown ? (
                        // Hover state: SWAP with black styling
                        <div
                          onClick={handleSwap}
                          style={{
                            width: '100%',
                            padding: '4px 0',
                            borderRadius: '12px',
                            fontSize: '10px',
                            fontWeight: '800',
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            background: 'linear-gradient(135deg, #2d3748, #1a202c)',
                            color: '#ffffff',
                            border: '2px solid #4a5568',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                            textAlign: 'center',
                          }}
                        >
                          SWAP
                        </div>
                      ) : (
                        // Normal state: WHITE
                        <div
                          style={{
                            width: '100%',
                            padding: '4px 0',
                            borderRadius: '12px',
                            fontSize: '10px',
                            fontWeight: '800',
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            background: 'linear-gradient(135deg, #f0f0f0, #ffffff)',
                            color: '#1a202c',
                            border: '2px solid #cbd5e0',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            textAlign: 'center',
                          }}
                        >
                          WHITE
                        </div>
                      )}
                    </>
                  ) : (
                    // Guest: show static WHITE label
                    <div
                      style={{
                        width: '100%',
                        padding: '4px 0',
                        borderRadius: '12px',
                        fontSize: '10px',
                        fontWeight: '800',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        cursor: 'default',
                        background: 'linear-gradient(135deg, #f0f0f0, #ffffff)',
                        color: '#1a202c',
                        border: '2px solid #cbd5e0',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        textAlign: 'center',
                        opacity: 0.8,
                      }}
                    >
                      WHITE
                    </div>
                  )}
                </>
              )}

              {/* Black player - show SWAP to white on hover */}
              {blackPlayerId === player.id && (
                <>
                  {canAssignPlayers ? (
                    // Host: show interactive swap
                    <>
                      {hoveredBadge && !clickCooldown ? (
                        // Hover state: SWAP with white styling
                        <div
                          onClick={handleSwap}
                          style={{
                            width: '100%',
                            padding: '4px 0',
                            borderRadius: '12px',
                            fontSize: '10px',
                            fontWeight: '800',
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            background: 'linear-gradient(135deg, #f0f0f0, #ffffff)',
                            color: '#1a202c',
                            border: '2px solid #cbd5e0',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                            textAlign: 'center',
                          }}
                        >
                          SWAP
                        </div>
                      ) : (
                        // Normal state: BLACK
                        <div
                          style={{
                            width: '100%',
                            padding: '4px 0',
                            borderRadius: '12px',
                            fontSize: '10px',
                            fontWeight: '800',
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            background: 'linear-gradient(135deg, #2d3748, #1a202c)',
                            color: '#ffffff',
                            border: '2px solid #4a5568',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            textAlign: 'center',
                          }}
                        >
                          BLACK
                        </div>
                      )}
                    </>
                  ) : (
                    // Guest: show static BLACK label
                    <div
                      style={{
                        width: '100%',
                        padding: '4px 0',
                        borderRadius: '12px',
                        fontSize: '10px',
                        fontWeight: '800',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        cursor: 'default',
                        background: 'linear-gradient(135deg, #2d3748, #1a202c)',
                        color: '#ffffff',
                        border: '2px solid #4a5568',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        textAlign: 'center',
                        opacity: 0.8,
                      }}
                    >
                      BLACK
                    </div>
                  )}
                </>
              )}
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
