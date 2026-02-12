'use client'

import type { ReactNode } from 'react'
import { css } from '../../../../../styled-system/css'

export interface FlipCardProps {
  card: { id: string; matched: boolean; matchedBy?: string }
  isFlipped: boolean
  isMatched: boolean
  onClick: () => void
  disabled?: boolean
  renderFront: () => ReactNode
  cardBackStyle: { gradient: string; icon: string }
  /** Player-specific matched color (null = default green) */
  matchedCardStyle: { gradient: string } | null
  /** Active players for player badge rendering */
  activePlayers: Array<{ id: string; emoji: string }>
}

export function FlipCard({
  card,
  isFlipped,
  isMatched,
  onClick,
  disabled = false,
  renderFront,
  cardBackStyle,
  matchedCardStyle,
  activePlayers,
}: FlipCardProps) {
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

  const getBackGradient = () => {
    if (isMatched && matchedCardStyle) {
      return matchedCardStyle.gradient
    }
    if (isMatched) {
      return 'linear-gradient(135deg, #48bb78, #38a169)' // Default green
    }
    return cardBackStyle.gradient
  }

  const getBackIcon = () => {
    if (isMatched && card.matchedBy) {
      const matchedPlayer = activePlayers.find((p) => p.id === card.matchedBy)
      return matchedPlayer?.emoji || '✓'
    }
    if (isMatched) return '✓'
    return cardBackStyle.icon
  }

  const getBorderColor = () => {
    if (isMatched) {
      const playerIndex = getPlayerIndex(card.matchedBy)
      if (playerIndex === 0) return '#74b9ff'
      if (playerIndex === 1) return '#fd79a8'
      return '#48bb78'
    }
    if (isFlipped) return '#667eea'
    return '#e2e8f0'
  }

  const getMatchedGlowColor = () => {
    const playerIndex = getPlayerIndex(card.matchedBy)
    if (playerIndex === 0) return 'rgba(116, 185, 255, 0.4)'
    if (playerIndex === 1) return 'rgba(253, 121, 168, 0.4)'
    return 'rgba(72, 187, 120, 0.4)'
  }

  const getPlayerBadgeGradient = () => {
    const playerIndex = getPlayerIndex(card.matchedBy)
    if (playerIndex === 0) return 'linear-gradient(135deg, #74b9ff, #0984e3)'
    return 'linear-gradient(135deg, #fd79a8, #e84393)'
  }

  const getPlayerBadgeGlow = () => {
    const playerIndex = getPlayerIndex(card.matchedBy)
    if (playerIndex === 0)
      return '0 0 20px rgba(116, 185, 255, 0.6), 0 0 40px rgba(116, 185, 255, 0.4)'
    return '0 0 20px rgba(253, 121, 168, 0.6), 0 0 40px rgba(253, 121, 168, 0.4)'
  }

  const getPlayerHaloGradient = () => {
    const playerIndex = getPlayerIndex(card.matchedBy)
    if (playerIndex === 0)
      return 'linear-gradient(45deg, #74b9ff, #a29bfe, #6c5ce7, #74b9ff)'
    return 'linear-gradient(45deg, #fd79a8, #fdcb6e, #e17055, #fd79a8)'
  }

  const getPlayerBorderColor = () => {
    const playerIndex = getPlayerIndex(card.matchedBy)
    if (playerIndex === 0) return '#74b9ff'
    return '#fd79a8'
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
            background: getBackGradient(),
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
            <div className={css({ fontSize: '32px' })}>{getBackIcon()}</div>
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
              ? `0 0 20px ${getMatchedGlowColor()}`
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
                  borderColor: getPlayerBorderColor(),
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
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
                    animation: 'spinningHalo 2s linear infinite',
                    zIndex: -1,
                  },
                })}
                style={{
                  background: getPlayerBadgeGradient(),
                  boxShadow: getPlayerBadgeGlow(),
                }}
              >
                {/* The ::before pseudo-element needs inline style for dynamic gradient */}
                <style>{`
                  [data-flip-card-badge-${card.id}]::before {
                    background: ${getPlayerHaloGradient()};
                  }
                `}</style>
                <span
                  data-flip-card-badge-id={card.id}
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

          {/* Card front content — rendered by the variant */}
          {renderFront()}
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

// Global animation styles for FlipCard
const flipCardAnimations = `
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
`

// Inject global styles
if (typeof document !== 'undefined' && !document.getElementById('flip-card-animations')) {
  const style = document.createElement('style')
  style.id = 'flip-card-animations'
  style.textContent = flipCardAnimations
  document.head.appendChild(style)
}
