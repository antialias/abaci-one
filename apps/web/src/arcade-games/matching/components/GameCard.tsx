'use client'

import { AbacusReact, useAbacusConfig } from '@soroban/abacus-react'
import { css } from '../../../../styled-system/css'
import { useGameMode } from '@/contexts/GameModeContext'
import type { GameCardProps } from '../types'

export function GameCard({ card, isFlipped, isMatched, onClick, disabled = false }: GameCardProps) {
  const appConfig = useAbacusConfig()
  const { players: playerMap, activePlayers: activePlayerIds } = useGameMode()

  // Get active players array for mapping numeric IDs to actual players
  const activePlayers = Array.from(activePlayerIds)
    .map((id) => playerMap.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)

  // Helper to get player index from ID (0-based)
  const getPlayerIndex = (playerId: string | undefined): number => {
    if (!playerId) return -1
    return activePlayers.findIndex((p) => p.id === playerId)
  }

  const cardBackStyles = css({
    position: 'absolute',
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '28px',
    fontWeight: 'bold',
    textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
    cursor: disabled ? 'default' : 'pointer',
    userSelect: 'none',
    transition: 'all 0.2s ease',
  })

  const cardFrontStyles = css({
    position: 'absolute',
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
    borderRadius: '12px',
    background: 'white',
    border: '3px solid',
    transform: 'rotateY(180deg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px',
    overflow: 'hidden',
    transition: 'all 0.2s ease',
  })

  // Dynamic styling based on card type and state
  const getCardBackGradient = () => {
    if (isMatched) {
      // Player-specific colors for matched cards - find player index by ID
      const playerIndex = getPlayerIndex(card.matchedBy)
      if (playerIndex === 0) {
        return 'linear-gradient(135deg, #74b9ff, #0984e3)' // Blue for first player
      } else if (playerIndex === 1) {
        return 'linear-gradient(135deg, #fd79a8, #e84393)' // Pink for second player
      }
      return 'linear-gradient(135deg, #48bb78, #38a169)' // Default green for single player or 3+
    }

    switch (card.type) {
      case 'abacus':
        return 'linear-gradient(135deg, #7b4397, #dc2430)'
      case 'number':
        return 'linear-gradient(135deg, #2E86AB, #A23B72)'
      case 'complement':
        return 'linear-gradient(135deg, #F18F01, #6A994E)'
      default:
        return 'linear-gradient(135deg, #667eea, #764ba2)'
    }
  }

  const getCardBackIcon = () => {
    if (isMatched) {
      // Show player emoji for matched cards in multiplayer mode
      if (card.matchedBy) {
        const matchedPlayer = activePlayers.find((p) => p.id === card.matchedBy)
        return matchedPlayer?.emoji || '✓'
      }
      return '✓' // Default checkmark for single player
    }

    switch (card.type) {
      case 'abacus':
        return '🧮'
      case 'number':
        return '🔢'
      case 'complement':
        return '🤝'
      default:
        return '❓'
    }
  }

  const getBorderColor = () => {
    if (isMatched) {
      // Player-specific border colors for matched cards
      const playerIndex = getPlayerIndex(card.matchedBy)
      if (playerIndex === 0) {
        return '#74b9ff' // Blue for first player
      } else if (playerIndex === 1) {
        return '#fd79a8' // Pink for second player
      }
      return '#48bb78' // Default green for single player or 3+
    }
    if (isFlipped) return '#667eea'
    return '#e2e8f0'
  }

  return (
    <div
      className={css({
        perspective: '1000px',
        width: '100%',
        height: '100%',
        cursor: disabled || isMatched ? 'default' : 'pointer',
        transition: 'transform 0.2s ease',
        _hover:
          disabled || isMatched
            ? {}
            : {
                transform: 'translateY(-2px)',
              },
      })}
      onClick={disabled || isMatched ? undefined : onClick}
    >
      <div
        className={css({
          position: 'relative',
          width: '100%',
          height: '100%',
          textAlign: 'center',
          transition: 'transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1)',
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        })}
      >
        {/* Card Back (hidden/face-down state) */}
        <div
          className={cardBackStyles}
          style={{
            background: getCardBackGradient(),
          }}
        >
          <div
            className={css({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            })}
          >
            <div className={css({ fontSize: '32px' })}>{getCardBackIcon()}</div>
            {isMatched && (
              <div className={css({ fontSize: '14px', opacity: 0.9 })}>
                {card.matchedBy ? 'Claimed!' : 'Matched!'}
              </div>
            )}
          </div>
        </div>

        {/* Card Front (revealed/face-up state) */}
        <div
          className={cardFrontStyles}
          style={{
            borderColor: getBorderColor(),
            boxShadow: isMatched
              ? getPlayerIndex(card.matchedBy) === 0
                ? '0 0 20px rgba(116, 185, 255, 0.4)' // Blue glow for player 1
                : getPlayerIndex(card.matchedBy) === 1
                  ? '0 0 20px rgba(253, 121, 168, 0.4)' // Pink glow for player 2
                  : '0 0 20px rgba(72, 187, 120, 0.4)' // Default green glow
              : isFlipped
                ? '0 0 15px rgba(102, 126, 234, 0.3)'
                : 'none',
          }}
        >
          {/* Player Badge for matched cards */}
          {isMatched && card.matchedBy && (
            <>
              {/* Explosion Ring */}
              <div
                className={css({
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: '3px solid',
                  borderColor: getPlayerIndex(card.matchedBy) === 0 ? '#74b9ff' : '#fd79a8',
                  animation: 'explosionRing 0.6s ease-out',
                  zIndex: 9,
                })}
              />

              {/* Main Badge */}
              <div
                className={css({
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background:
                    getPlayerIndex(card.matchedBy) === 0
                      ? 'linear-gradient(135deg, #74b9ff, #0984e3)'
                      : 'linear-gradient(135deg, #fd79a8, #e84393)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  boxShadow:
                    getPlayerIndex(card.matchedBy) === 0
                      ? '0 0 20px rgba(116, 185, 255, 0.6), 0 0 40px rgba(116, 185, 255, 0.4)'
                      : '0 0 20px rgba(253, 121, 168, 0.6), 0 0 40px rgba(253, 121, 168, 0.4)',
                  animation: 'epicClaim 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  zIndex: 10,
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: '-2px',
                    left: '-2px',
                    right: '-2px',
                    bottom: '-2px',
                    borderRadius: '50%',
                    background:
                      getPlayerIndex(card.matchedBy) === 0
                        ? 'linear-gradient(45deg, #74b9ff, #a29bfe, #6c5ce7, #74b9ff)'
                        : 'linear-gradient(45deg, #fd79a8, #fdcb6e, #e17055, #fd79a8)',
                    animation: 'spinningHalo 2s linear infinite',
                    zIndex: -1,
                  },
                })}
              >
                <span
                  className={css({
                    animation: 'emojiBlast 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.4s both',
                    filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.8))',
                  })}
                >
                  {card.matchedBy
                    ? activePlayers.find((p) => p.id === card.matchedBy)?.emoji || '✓'
                    : '✓'}
                </span>
              </div>

              {/* Sparkle Effects */}
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={css({
                    position: 'absolute',
                    top: '22px',
                    right: '22px',
                    width: '4px',
                    height: '4px',
                    background: '#ffeaa7',
                    borderRadius: '50%',
                    animation: `sparkle${i + 1} 1.5s ease-out`,
                    zIndex: 8,
                  })}
                />
              ))}
            </>
          )}
          {card.type === 'abacus' ? (
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
                '& svg': {
                  maxWidth: '100%',
                  maxHeight: '100%',
                },
              })}
            >
              <AbacusReact
                value={card.number}
                columns="auto"
                beadShape={appConfig.beadShape}
                colorScheme={appConfig.colorScheme}
                hideInactiveBeads={appConfig.hideInactiveBeads}
                scaleFactor={0.8} // Smaller for card display
                interactive={false}
                showNumbers={false}
                animated={false}
              />
            </div>
          ) : card.type === 'number' ? (
            <div
              className={css({
                fontSize: '32px',
                fontWeight: 'bold',
                color: 'gray.800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              {card.number}
            </div>
          ) : card.type === 'complement' ? (
            <div
              className={css({
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              })}
            >
              <div
                className={css({
                  fontSize: '28px',
                  fontWeight: 'bold',
                  color: 'gray.800',
                })}
              >
                {card.number}
              </div>
              <div
                className={css({
                  fontSize: '16px',
                  color: 'gray.600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                })}
              >
                <span>{card.targetSum === 5 ? '✋' : '🔟'}</span>
                <span>Friends</span>
              </div>
              {card.complement !== undefined && (
                <div
                  className={css({
                    fontSize: '12px',
                    color: 'gray.500',
                  })}
                >
                  + {card.complement} = {card.targetSum}
                </div>
              )}
            </div>
          ) : (
            <div
              className={css({
                fontSize: '24px',
                color: 'gray.500',
              })}
            >
              ?
            </div>
          )}
        </div>
      </div>

      {/* Match animation overlay */}
      {isMatched && (
        <div
          className={css({
            position: 'absolute',
            top: '-5px',
            left: '-5px',
            right: '-5px',
            bottom: '-5px',
            borderRadius: '16px',
            background: 'linear-gradient(45deg, transparent, rgba(72, 187, 120, 0.3), transparent)',
            animation: 'pulse 2s infinite',
            pointerEvents: 'none',
            zIndex: 1,
          })}
        />
      )}
    </div>
  )
}

// Add global animation styles
const globalCardAnimations = `
@keyframes pulse {
  0%, 100% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.02);
  }
}

@keyframes explosionRing {
  0% {
    transform: scale(0);
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
  100% {
    transform: scale(4);
    opacity: 0;
  }
}

@keyframes epicClaim {
  0% {
    opacity: 0;
    transform: scale(0) rotate(-360deg);
  }
  30% {
    opacity: 1;
    transform: scale(1.4) rotate(-180deg);
  }
  60% {
    transform: scale(0.8) rotate(-90deg);
  }
  80% {
    transform: scale(1.1) rotate(-30deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

@keyframes emojiBlast {
  0% {
    transform: scale(0) rotate(180deg);
    opacity: 0;
  }
  70% {
    transform: scale(1.5) rotate(-10deg);
    opacity: 1;
  }
  85% {
    transform: scale(0.9) rotate(5deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

@keyframes spinningHalo {
  0% {
    transform: rotate(0deg);
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: rotate(360deg);
    opacity: 0.8;
  }
}

@keyframes sparkle1 {
  0% { transform: translate(0, 0) scale(0); opacity: 1; }
  50% { opacity: 1; }
  100% { transform: translate(-20px, -15px) scale(1); opacity: 0; }
}

@keyframes sparkle2 {
  0% { transform: translate(0, 0) scale(0); opacity: 1; }
  50% { opacity: 1; }
  100% { transform: translate(15px, -20px) scale(1); opacity: 0; }
}

@keyframes sparkle3 {
  0% { transform: translate(0, 0) scale(0); opacity: 1; }
  50% { opacity: 1; }
  100% { transform: translate(-25px, 10px) scale(1); opacity: 0; }
}

@keyframes sparkle4 {
  0% { transform: translate(0, 0) scale(0); opacity: 1; }
  50% { opacity: 1; }
  100% { transform: translate(20px, 15px) scale(1); opacity: 0; }
}

@keyframes sparkle5 {
  0% { transform: translate(0, 0) scale(0); opacity: 1; }
  50% { opacity: 1; }
  100% { transform: translate(-10px, -25px) scale(1); opacity: 0; }
}

@keyframes sparkle6 {
  0% { transform: translate(0, 0) scale(0); opacity: 1; }
  50% { opacity: 1; }
  100% { transform: translate(25px, -5px) scale(1); opacity: 0; }
}

@keyframes bounceIn {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
  70% {
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes cardFlip {
  0% { transform: rotateY(0deg); }
  100% { transform: rotateY(180deg); }
}

@keyframes matchSuccess {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

@keyframes invalidMove {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-3px); }
  75% { transform: translateX(3px); }
}
`

// Inject global styles
if (typeof document !== 'undefined' && !document.getElementById('memory-card-animations')) {
  const style = document.createElement('style')
  style.id = 'memory-card-animations'
  style.textContent = globalCardAnimations
  document.head.appendChild(style)
}
