'use client'

import { css } from '../../../../../styled-system/css'
import { useGameMode } from '../../../../contexts/GameModeContext'
import { useUserProfile } from '../../../../contexts/UserProfileContext'
import { useArcadeMemoryPairs } from '../context/ArcadeMemoryPairsContext'
import { gamePlurals } from '../../../../utils/pluralization'

interface PlayerStatusBarProps {
  className?: string
}

export function PlayerStatusBar({ className }: PlayerStatusBarProps) {
  const { players: playerMap, activePlayers: activePlayerIds } = useGameMode()
  const { state } = useArcadeMemoryPairs()

  // Get active players array
  const activePlayersData = Array.from(activePlayerIds)
    .map(id => playerMap.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)

  // Map active players to display data with scores
  // State now uses player IDs (UUIDs) as keys
  const activePlayers = activePlayersData.map((player) => ({
    ...player,
    displayName: player.name,
    displayEmoji: player.emoji,
    score: state.scores[player.id] || 0,
    consecutiveMatches: state.consecutiveMatches?.[player.id] || 0
  }))

  // Get celebration level based on consecutive matches
  const getCelebrationLevel = (consecutiveMatches: number) => {
    if (consecutiveMatches >= 5) return 'legendary'
    if (consecutiveMatches >= 3) return 'epic'
    if (consecutiveMatches >= 2) return 'great'
    return 'normal'
  }

  if (activePlayers.length <= 1) {
    // Simple single player indicator
    return (
      <div className={`${css({
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'white',
        rounded: 'lg',
        p: { base: '2', md: '3' },
        border: '2px solid',
        borderColor: 'blue.200',
        mb: { base: '2', md: '3' },
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      })} ${className || ''}`}>
        <div className={css({
          display: 'flex',
          alignItems: 'center',
          gap: { base: '2', md: '3' }
        })}>
          <div className={css({
            fontSize: { base: 'xl', md: '2xl' }
          })}>
            {activePlayers[0]?.displayEmoji || '🚀'}
          </div>
          <div className={css({
            fontSize: { base: 'sm', md: 'md' },
            fontWeight: 'bold',
            color: 'gray.700'
          })}>
            {activePlayers[0]?.displayName || 'Player 1'}
          </div>
          <div className={css({
            fontSize: { base: 'xs', md: 'sm' },
            color: 'blue.600',
            fontWeight: 'medium'
          })}>
            {gamePlurals.pair(state.matchedPairs)} of {state.totalPairs} • {gamePlurals.move(state.moves)}
          </div>
        </div>
      </div>
    )
  }

  // For multiplayer, show competitive status bar
  return (
    <div className={`${css({
      background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
      rounded: 'xl',
      p: { base: '2', md: '3' },
      border: '2px solid',
      borderColor: 'gray.200',
      mb: { base: '3', md: '4' }
    })} ${className || ''}`}>
      <div className={css({
        display: 'grid',
        gridTemplateColumns: activePlayers.length <= 2
          ? 'repeat(2, 1fr)'
          : activePlayers.length === 3
          ? 'repeat(3, 1fr)'
          : 'repeat(2, 1fr) repeat(2, 1fr)',
        gap: { base: '2', md: '3' },
        alignItems: 'center'
      })}>
        {activePlayers.map((player) => {
          const isCurrentPlayer = player.id === state.currentPlayer
          const isLeading = player.score === Math.max(...activePlayers.map(p => p.score)) && player.score > 0
          const celebrationLevel = getCelebrationLevel(player.consecutiveMatches)

          return (
            <div
              key={player.id}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: { base: '2', md: '3' },
                p: isCurrentPlayer ? { base: '3', md: '4' } : { base: '2', md: '2' },
                rounded: isCurrentPlayer ? '2xl' : 'lg',
                background: isCurrentPlayer
                  ? `linear-gradient(135deg, ${player.color || '#3b82f6'}15, ${player.color || '#3b82f6'}25, ${player.color || '#3b82f6'}15)`
                  : 'white',
                border: isCurrentPlayer ? '4px solid' : '2px solid',
                borderColor: isCurrentPlayer
                  ? (player.color || '#3b82f6')
                  : 'gray.200',
                boxShadow: isCurrentPlayer
                  ? '0 0 0 2px white, 0 0 0 6px ' + (player.color || '#3b82f6') + '40, 0 12px 32px rgba(0,0,0,0.2)'
                  : '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                position: 'relative',
                transform: isCurrentPlayer ? 'scale(1.08) translateY(-4px)' : 'scale(1)',
                zIndex: isCurrentPlayer ? 10 : 1,
                animation: isCurrentPlayer
                  ? (celebrationLevel === 'legendary' ? 'legendary-celebration 0.8s ease-out, turn-entrance 0.6s ease-out'
                     : celebrationLevel === 'epic' ? 'epic-celebration 0.7s ease-out, turn-entrance 0.6s ease-out'
                     : celebrationLevel === 'great' ? 'great-celebration 0.6s ease-out, turn-entrance 0.6s ease-out'
                     : 'turn-entrance 0.6s ease-out')
                  : 'none'
              })}
            >

              {/* Leading crown with sparkle */}
              {isLeading && (
                <div className={css({
                  position: 'absolute',
                  top: isCurrentPlayer ? '-3' : '-1',
                  right: isCurrentPlayer ? '-3' : '-1',
                  background: 'linear-gradient(135deg, #ffd700, #ffaa00)',
                  rounded: 'full',
                  w: isCurrentPlayer ? '10' : '6',
                  h: isCurrentPlayer ? '10' : '6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isCurrentPlayer ? 'lg' : 'xs',
                  zIndex: 10,
                  animation: 'none',
                  boxShadow: '0 0 20px rgba(255, 215, 0, 0.6)'
                })}>
                  👑
                </div>
              )}

              {/* Subtle turn indicator */}
              {isCurrentPlayer && (
                <div className={css({
                  position: 'absolute',
                  top: '-2',
                  left: '-2',
                  background: player.color || '#3b82f6',
                  rounded: 'full',
                  w: '4',
                  h: '4',
                  animation: 'gentle-sway 2s ease-in-out infinite',
                  zIndex: 5
                })} />
              )}

              {/* Living, breathing player emoji */}
              <div className={css({
                fontSize: isCurrentPlayer ? { base: '2xl', md: '3xl' } : { base: 'lg', md: 'xl' },
                flexShrink: 0,
                animation: isCurrentPlayer
                  ? 'float 3s ease-in-out infinite'
                  : 'breathe 5s ease-in-out infinite',
                transform: isCurrentPlayer ? 'scale(1.2)' : 'scale(1)',
                transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                textShadow: isCurrentPlayer ? '0 0 20px currentColor' : 'none',
                cursor: 'pointer',
                '&:hover': {
                  transform: isCurrentPlayer ? 'scale(1.3)' : 'scale(1.1)',
                  animation: 'gentle-sway 1s ease-in-out infinite'
                }
              })}>
                {player.displayEmoji}
              </div>

              {/* Enhanced player info */}
              <div className={css({
                flex: 1,
                minWidth: 0
              })}>
                <div className={css({
                  fontSize: isCurrentPlayer ? { base: 'md', md: 'lg' } : { base: 'xs', md: 'sm' },
                  fontWeight: 'black',
                  color: isCurrentPlayer ? 'gray.900' : 'gray.700',
                  animation: 'none',
                  textShadow: isCurrentPlayer ? '0 0 10px currentColor' : 'none'
                })}>
                  {player.displayName}
                </div>
                <div className={css({
                  fontSize: isCurrentPlayer ? { base: 'sm', md: 'md' } : { base: '2xs', md: 'xs' },
                  color: isCurrentPlayer ? (player.color || '#3b82f6') : 'gray.500',
                  fontWeight: isCurrentPlayer ? 'black' : 'semibold',
                  animation: 'none'
                })}>
                  {gamePlurals.pair(player.score)}
                  {isCurrentPlayer && (
                    <span className={css({
                      color: 'red.600',
                      fontWeight: 'black',
                      fontSize: isCurrentPlayer ? { base: 'sm', md: 'lg' } : 'inherit',
                      animation: 'none',
                      textShadow: '0 0 15px currentColor'
                    })}>
                      {' • Your turn'}
                    </span>
                  )}
                  {player.consecutiveMatches > 1 && (
                    <div className={css({
                      fontSize: { base: '2xs', md: 'xs' },
                      color: celebrationLevel === 'legendary' ? 'purple.600' :
                             celebrationLevel === 'epic' ? 'orange.600' :
                             celebrationLevel === 'great' ? 'green.600' : 'gray.500',
                      fontWeight: 'black',
                      animation: isCurrentPlayer ? 'streak-pulse 1s ease-in-out infinite' : 'none',
                      textShadow: isCurrentPlayer ? '0 0 10px currentColor' : 'none'
                    })}>
                      🔥 {player.consecutiveMatches} streak!
                    </div>
                  )}
                </div>
              </div>

              {/* Simple score display for current player */}
              {isCurrentPlayer && (
                <div className={css({
                  background: 'blue.500',
                  color: 'white',
                  px: { base: '2', md: '3' },
                  py: { base: '1', md: '2' },
                  rounded: 'md',
                  fontSize: { base: 'sm', md: 'md' },
                  fontWeight: 'bold'
                })}>
                  {player.score}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Epic animations for extreme emphasis
const epicAnimations = `
@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.1);
  }
}

@keyframes gentle-pulse {
  0%, 100% {
    box-shadow: 0 0 0 2px white, 0 0 0 6px rgba(102, 126, 234, 0.3), 0 12px 32px rgba(0,0,0,0.1);
  }
  50% {
    box-shadow: 0 0 0 2px white, 0 0 0 6px rgba(102, 126, 234, 0.5), 0 12px 32px rgba(0,0,0,0.2);
  }
}

@keyframes gentle-bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

@keyframes gentle-sway {
  0%, 100% { transform: rotate(-2deg) scale(1); }
  50% { transform: rotate(2deg) scale(1.05); }
}

@keyframes breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-6px); }
}

@keyframes turn-entrance {
  0% {
    transform: scale(0.8) rotate(-10deg);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.1) rotate(5deg);
    opacity: 1;
  }
  100% {
    transform: scale(1.08) rotate(0deg);
    opacity: 1;
  }
}

@keyframes turn-exit {
  0% {
    transform: scale(1.08);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 0.8;
  }
}

@keyframes spotlight {
  0%, 100% {
    background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%);
    transform: translateX(-100%);
  }
  50% {
    background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%);
    transform: translateX(100%);
  }
}

@keyframes neon-flicker {
  0%, 100% {
    text-shadow: 0 0 5px currentColor, 0 0 10px currentColor, 0 0 15px currentColor;
    opacity: 1;
  }
  50% {
    text-shadow: 0 0 2px currentColor, 0 0 5px currentColor, 0 0 8px currentColor;
    opacity: 0.8;
  }
}

@keyframes crown-sparkle {
  0%, 100% {
    transform: rotate(0deg) scale(1);
    filter: brightness(1);
  }
  25% {
    transform: rotate(-5deg) scale(1.1);
    filter: brightness(1.5);
  }
  75% {
    transform: rotate(5deg) scale(1.1);
    filter: brightness(1.5);
  }
}

@keyframes streak-pulse {
  0%, 100% {
    opacity: 0.9;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
}

@keyframes great-celebration {
  0% {
    transform: scale(1.08) translateY(-4px);
    box-shadow: 0 0 0 2px white, 0 0 0 6px #22c55e40, 0 12px 32px rgba(0,0,0,0.2);
  }
  50% {
    transform: scale(1.12) translateY(-6px);
    box-shadow: 0 0 0 2px white, 0 0 0 8px #22c55e60, 0 15px 35px rgba(34,197,94,0.3);
  }
  100% {
    transform: scale(1.08) translateY(-4px);
    box-shadow: 0 0 0 2px white, 0 0 0 6px #22c55e40, 0 12px 32px rgba(0,0,0,0.2);
  }
}

@keyframes epic-celebration {
  0% {
    transform: scale(1.08) translateY(-4px);
    box-shadow: 0 0 0 2px white, 0 0 0 6px #f97316, 0 12px 32px rgba(0,0,0,0.2);
  }
  25% {
    transform: scale(1.15) translateY(-8px) rotate(2deg);
    box-shadow: 0 0 0 3px white, 0 0 0 10px #f97316, 0 18px 40px rgba(249,115,22,0.4);
  }
  75% {
    transform: scale(1.15) translateY(-8px) rotate(-2deg);
    box-shadow: 0 0 0 3px white, 0 0 0 10px #f97316, 0 18px 40px rgba(249,115,22,0.4);
  }
  100% {
    transform: scale(1.08) translateY(-4px);
    box-shadow: 0 0 0 2px white, 0 0 0 6px #f97316, 0 12px 32px rgba(0,0,0,0.2);
  }
}

@keyframes legendary-celebration {
  0% {
    transform: scale(1.08) translateY(-4px);
    box-shadow: 0 0 0 2px white, 0 0 0 6px #a855f7, 0 12px 32px rgba(0,0,0,0.2);
  }
  20% {
    transform: scale(1.2) translateY(-12px) rotate(5deg);
    box-shadow: 0 0 0 4px gold, 0 0 0 12px #a855f7, 0 25px 50px rgba(168,85,247,0.5);
  }
  40% {
    transform: scale(1.18) translateY(-10px) rotate(-3deg);
    box-shadow: 0 0 0 3px gold, 0 0 0 10px #a855f7, 0 20px 45px rgba(168,85,247,0.4);
  }
  60% {
    transform: scale(1.22) translateY(-14px) rotate(3deg);
    box-shadow: 0 0 0 4px gold, 0 0 0 12px #a855f7, 0 25px 50px rgba(168,85,247,0.5);
  }
  80% {
    transform: scale(1.15) translateY(-8px) rotate(-1deg);
    box-shadow: 0 0 0 3px gold, 0 0 0 8px #a855f7, 0 18px 40px rgba(168,85,247,0.3);
  }
  100% {
    transform: scale(1.08) translateY(-4px);
    box-shadow: 0 0 0 2px white, 0 0 0 6px #a855f7, 0 12px 32px rgba(0,0,0,0.2);
  }
}
`

// Inject animation styles
if (typeof document !== 'undefined' && !document.getElementById('player-status-animations')) {
  const style = document.createElement('style')
  style.id = 'player-status-animations'
  style.textContent = epicAnimations
  document.head.appendChild(style)
}