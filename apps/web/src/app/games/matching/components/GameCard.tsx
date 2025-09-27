'use client'

import { AbacusReact } from '@soroban/abacus-react'
import { useAbacusConfig } from '../../../../contexts/AbacusDisplayContext'
import { useUserProfile } from '../../../../contexts/UserProfileContext'
import type { GameCardProps } from '../context/types'
import { css } from '../../../../../styled-system/css'

export function GameCard({ card, isFlipped, isMatched, onClick, disabled = false }: GameCardProps) {
  const appConfig = useAbacusConfig()
  const { profile } = useUserProfile()

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
    transition: 'all 0.2s ease'
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
    transition: 'all 0.2s ease'
  })

  // Dynamic styling based on card type and state
  const getCardBackGradient = () => {
    if (isMatched) {
      // Player-specific colors for matched cards
      if (card.matchedBy === 1) {
        return 'linear-gradient(135deg, #74b9ff, #0984e3)' // Blue for player 1
      } else if (card.matchedBy === 2) {
        return 'linear-gradient(135deg, #fd79a8, #e84393)' // Pink for player 2
      }
      return 'linear-gradient(135deg, #48bb78, #38a169)' // Default green for single player
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
      console.log('Matched card:', card.id, 'matchedBy:', card.matchedBy, 'emojis:', profile.player1Emoji, profile.player2Emoji)
      // Show player emoji for matched cards in two-player mode
      if (card.matchedBy === 1) {
        console.log('Returning player 1 emoji:', profile.player1Emoji)
        return profile.player1Emoji
      } else if (card.matchedBy === 2) {
        console.log('Returning player 2 emoji:', profile.player2Emoji)
        return profile.player2Emoji
      }
      console.log('Returning default checkmark')
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
      if (card.matchedBy === 1) {
        return '#74b9ff' // Blue for player 1
      } else if (card.matchedBy === 2) {
        return '#fd79a8' // Pink for player 2
      }
      return '#48bb78' // Default green for single player
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
        _hover: disabled || isMatched ? {} : {
          transform: 'translateY(-2px)'
        }
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
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
        })}
      >
        {/* Card Back (hidden/face-down state) */}
        <div
          className={cardBackStyles}
          style={{
            background: getCardBackGradient()
          }}
        >
          <div className={css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px'
          })}>
            <div className={css({ fontSize: '32px' })}>
              {getCardBackIcon()}
            </div>
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
              ? card.matchedBy === 1
                ? '0 0 20px rgba(116, 185, 255, 0.4)' // Blue glow for player 1
                : card.matchedBy === 2
                ? '0 0 20px rgba(253, 121, 168, 0.4)' // Pink glow for player 2
                : '0 0 20px rgba(72, 187, 120, 0.4)' // Default green glow
              : isFlipped
              ? '0 0 15px rgba(102, 126, 234, 0.3)'
              : 'none'
          }}
        >
          {card.type === 'abacus' ? (
            <div className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              '& svg': {
                maxWidth: '100%',
                maxHeight: '100%'
              }
            })}>
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
            <div className={css({
              fontSize: '32px',
              fontWeight: 'bold',
              color: 'gray.800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            })}>
              {card.number}
            </div>
          ) : card.type === 'complement' ? (
            <div className={css({
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            })}>
              <div className={css({
                fontSize: '28px',
                fontWeight: 'bold',
                color: 'gray.800'
              })}>
                {card.number}
              </div>
              <div className={css({
                fontSize: '16px',
                color: 'gray.600',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              })}>
                <span>{card.targetSum === 5 ? '✋' : '🔟'}</span>
                <span>Friends</span>
              </div>
              {card.complement !== undefined && (
                <div className={css({
                  fontSize: '12px',
                  color: 'gray.500'
                })}>
                  + {card.complement} = {card.targetSum}
                </div>
              )}
            </div>
          ) : (
            <div className={css({
              fontSize: '24px',
              color: 'gray.500'
            })}>
              ?
            </div>
          )}
        </div>
      </div>

      {/* Match animation overlay */}
      {isMatched && (
        <div className={css({
          position: 'absolute',
          top: '-5px',
          left: '-5px',
          right: '-5px',
          bottom: '-5px',
          borderRadius: '16px',
          background: 'linear-gradient(45deg, transparent, rgba(72, 187, 120, 0.3), transparent)',
          animation: 'pulse 2s infinite',
          pointerEvents: 'none',
          zIndex: 1
        })} />
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