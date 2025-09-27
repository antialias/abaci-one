'use client'

import { useState } from 'react'
import { useMemoryPairs } from '../context/MemoryPairsContext'
import { useUserProfile } from '../../../../contexts/UserProfileContext'
import { GameCard } from './GameCard'
import { EmojiPicker } from './EmojiPicker'
import { getGridConfiguration } from '../utils/cardGeneration'
import { css } from '../../../../../styled-system/css'

export function MemoryGrid() {
  const { state, flipCard } = useMemoryPairs()
  const { profile, updatePlayerEmoji } = useUserProfile()
  const [showEmojiPicker, setShowEmojiPicker] = useState<{ player: 1 | 2 } | null>(null)

  if (!state.gameCards.length) {
    return null
  }

  const gridConfig = getGridConfiguration(state.difficulty)

  const handleCardClick = (cardId: string) => {
    flipCard(cardId)
  }

  const handlePlayerClick = (player: 1 | 2) => {
    setShowEmojiPicker({ player })
  }

  const handleEmojiSelect = (emoji: string) => {
    if (showEmojiPicker) {
      updatePlayerEmoji(showEmojiPicker.player, emoji)
      setShowEmojiPicker(null)
    }
  }

  return (
    <div className={css({
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '20px'
    })}>

      {/* Game Info Header */}
      <div className={css({
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        maxWidth: '800px',
        padding: '16px 24px',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(248,250,252,0.9))',
        borderRadius: '16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        border: '1px solid rgba(255,255,255,0.8)'
      })}>

        <div className={css({ display: 'flex', alignItems: 'center', gap: '20px' })}>
          <div className={css({ textAlign: 'center' })}>
            <div className={css({ fontSize: '24px', fontWeight: 'bold', color: 'blue.600' })}>
              {state.matchedPairs}
            </div>
            <div className={css({ fontSize: '12px', color: 'gray.600' })}>
              Matched
            </div>
          </div>

          <div className={css({ textAlign: 'center' })}>
            <div className={css({ fontSize: '24px', fontWeight: 'bold', color: 'purple.600' })}>
              {state.moves}
            </div>
            <div className={css({ fontSize: '12px', color: 'gray.600' })}>
              Moves
            </div>
          </div>

          <div className={css({ textAlign: 'center' })}>
            <div className={css({ fontSize: '24px', fontWeight: 'bold', color: 'green.600' })}>
              {state.totalPairs}
            </div>
            <div className={css({ fontSize: '12px', color: 'gray.600' })}>
              Total Pairs
            </div>
          </div>
        </div>

        {/* Two-Player Scores */}
        {state.gameMode === 'two-player' && (
          <div className={css({ display: 'flex', alignItems: 'center', gap: '24px' })}>
            <button
              className={css({
                textAlign: 'center',
                padding: '12px 20px',
                borderRadius: '16px',
                background: state.currentPlayer === 1 ? 'blue.100' : 'gray.100',
                border: '3px solid',
                borderColor: state.currentPlayer === 1 ? 'blue.400' : 'gray.300',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                _hover: {
                  transform: 'scale(1.05)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }
              })}
              onClick={() => handlePlayerClick(1)}
            >
              <div className={css({
                fontSize: '40px',
                marginBottom: '4px',
                transition: 'transform 0.2s ease',
                _hover: { transform: 'scale(1.1)' }
              })}>
                {profile.player1Emoji}
              </div>
              <div className={css({ fontSize: '28px', fontWeight: 'bold', color: 'blue.600' })}>
                {state.scores.player1}
              </div>
              <div className={css({ fontSize: '12px', color: 'gray.600', marginTop: '4px' })}>
                Click to change character
              </div>
            </button>

            <div className={css({
              fontSize: '24px',
              color: 'gray.500',
              fontWeight: 'bold'
            })}>
              VS
            </div>

            <button
              className={css({
                textAlign: 'center',
                padding: '12px 20px',
                borderRadius: '16px',
                background: state.currentPlayer === 2 ? 'red.100' : 'gray.100',
                border: '3px solid',
                borderColor: state.currentPlayer === 2 ? 'red.400' : 'gray.300',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                _hover: {
                  transform: 'scale(1.05)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }
              })}
              onClick={() => handlePlayerClick(2)}
            >
              <div className={css({
                fontSize: '40px',
                marginBottom: '4px',
                transition: 'transform 0.2s ease',
                _hover: { transform: 'scale(1.1)' }
              })}>
                {profile.player2Emoji}
              </div>
              <div className={css({ fontSize: '28px', fontWeight: 'bold', color: 'red.600' })}>
                {state.scores.player2}
              </div>
              <div className={css({ fontSize: '12px', color: 'gray.600', marginTop: '4px' })}>
                Click to change character
              </div>
            </button>
          </div>
        )}

        {/* Single Player Progress */}
        {state.gameMode === 'single' && (
          <div className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          })}>
            <div className={css({
              width: '120px',
              height: '8px',
              background: 'gray.200',
              borderRadius: '4px',
              overflow: 'hidden'
            })}>
              <div className={css({
                width: `${(state.matchedPairs / state.totalPairs) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #667eea, #764ba2)',
                transition: 'width 0.3s ease',
                borderRadius: '4px'
              })} />
            </div>
            <span className={css({
              fontSize: '14px',
              fontWeight: 'bold',
              color: 'gray.600'
            })}>
              {Math.round((state.matchedPairs / state.totalPairs) * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Cards Grid */}
      <div
        className={css({
          display: 'grid',
          gap: '12px',
          justifyContent: 'center',
          maxWidth: '100%',
          margin: '0 auto',
          // Responsive grid adjustments
          '@media (max-width: 768px)': {
            gap: '8px',
            padding: '0 10px'
          }
        })}
        style={{
          gridTemplateColumns: gridConfig.gridTemplate,
          width: 'fit-content'
        }}
      >
        {state.gameCards.map(card => {
          const isFlipped = state.flippedCards.some(c => c.id === card.id) || card.matched
          const isMatched = card.matched

          // Smart card filtering for abacus-numeral mode
          let isValidForSelection = true
          let isDimmed = false

          if (state.gameType === 'abacus-numeral' && state.flippedCards.length === 1 && !isFlipped && !isMatched) {
            const firstFlippedCard = state.flippedCards[0]

            // If first card is abacus, only numeral cards should be clickable
            if (firstFlippedCard.type === 'abacus' && card.type !== 'number') {
              isValidForSelection = false
              isDimmed = true
            }
            // If first card is numeral, only abacus cards should be clickable
            else if (firstFlippedCard.type === 'number' && card.type !== 'abacus') {
              isValidForSelection = false
              isDimmed = true
            }
            // Also check if it's a potential match by number
            else if (
              (firstFlippedCard.type === 'abacus' && card.type === 'number' && card.number !== firstFlippedCard.number) ||
              (firstFlippedCard.type === 'number' && card.type === 'abacus' && card.number !== firstFlippedCard.number)
            ) {
              // Don't completely disable, but could add subtle visual hint for non-matching numbers
              // For now, keep all valid type combinations clickable
            }
          }

          return (
            <div
              key={card.id}
              className={css({
                aspectRatio: '3/4',
                // Responsive card sizing
                '@media (min-width: 1024px)': {
                  width: gridConfig.cardSize.width,
                  height: gridConfig.cardSize.height
                },
                '@media (max-width: 1023px) and (min-width: 768px)': {
                  width: `calc(${gridConfig.cardSize.width} * 0.8)`,
                  height: `calc(${gridConfig.cardSize.height} * 0.8)`
                },
                '@media (max-width: 767px)': {
                  width: `calc(${gridConfig.cardSize.width} * 0.6)`,
                  height: `calc(${gridConfig.cardSize.height} * 0.6)`
                },
                // Dimming effect for invalid cards
                opacity: isDimmed ? 0.3 : 1,
                transition: 'opacity 0.3s ease',
                filter: isDimmed ? 'grayscale(0.7)' : 'none'
              })}
              style={{
                width: gridConfig.cardSize.width,
                height: gridConfig.cardSize.height
              }}
            >
              <GameCard
                card={card}
                isFlipped={isFlipped}
                isMatched={isMatched}
                onClick={() => isValidForSelection ? handleCardClick(card.id) : undefined}
                disabled={state.isProcessingMove || !isValidForSelection}
              />
            </div>
          )
        })}
      </div>

      {/* Mismatch Feedback */}
      {state.showMismatchFeedback && (
        <div className={css({
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'linear-gradient(135deg, #ff6b6b, #ee5a24)',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '16px',
          fontSize: '18px',
          fontWeight: 'bold',
          boxShadow: '0 8px 25px rgba(255, 107, 107, 0.4)',
          zIndex: 1000,
          animation: 'shake 0.5s ease-in-out'
        })}>
          <div className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          })}>
            <span>❌</span>
            <span>Not a match! Try again.</span>
          </div>
        </div>
      )}

      {/* Processing Overlay */}
      {state.isProcessingMove && (
        <div className={css({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.1)',
          zIndex: 999,
          pointerEvents: 'none'
        })} />
      )}

      {/* Emoji Picker Modal */}
      {showEmojiPicker && (
        <EmojiPicker
          currentEmoji={showEmojiPicker.player === 1 ? profile.player1Emoji : profile.player2Emoji}
          onEmojiSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(null)}
          playerNumber={showEmojiPicker.player}
        />
      )}
    </div>
  )
}

// Add shake animation for mismatch feedback
const shakeAnimation = `
@keyframes shake {
  0%, 100% { transform: translate(-50%, -50%) translateX(0); }
  25% { transform: translate(-50%, -50%) translateX(-5px); }
  75% { transform: translate(-50%, -50%) translateX(5px); }
}
`

// Inject animation styles
if (typeof document !== 'undefined' && !document.getElementById('memory-grid-animations')) {
  const style = document.createElement('style')
  style.id = 'memory-grid-animations'
  style.textContent = shakeAnimation
  document.head.appendChild(style)
}