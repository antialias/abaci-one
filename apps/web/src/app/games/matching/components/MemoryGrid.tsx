'use client'

import { useState, useEffect, useMemo } from 'react'
import { useMemoryPairs } from '../context/MemoryPairsContext'
import { useUserProfile } from '../../../../contexts/UserProfileContext'
import { GameCard } from './GameCard'
import { EmojiPicker } from './EmojiPicker'
import { getGridConfiguration } from '../utils/cardGeneration'
import { css } from '../../../../../styled-system/css'

// Helper function to calculate optimal grid dimensions
function calculateOptimalGrid(cards: number, aspectRatio: number, config: any) {
  // For consistent grid layout, we need to ensure r×c = totalCards
  // Choose columns based on viewport, then calculate exact rows needed

  let targetColumns
  const width = typeof window !== 'undefined' ? window.innerWidth : 1024

  // Choose column count based on viewport
  if (aspectRatio >= 1.6 && width >= 1200) {
    // Ultra-wide: prefer wider grids
    targetColumns = config.landscapeColumns || config.desktopColumns || 6
  } else if (aspectRatio >= 1.33 && width >= 768) {
    // Desktop/landscape: use desktop columns
    targetColumns = config.desktopColumns || config.landscapeColumns || 6
  } else if (aspectRatio >= 1.0 && width >= 600) {
    // Tablet: use tablet columns
    targetColumns = config.tabletColumns || config.desktopColumns || 4
  } else {
    // Mobile: use mobile columns
    targetColumns = config.mobileColumns || 3
  }

  // Calculate exact rows needed for this column count
  const rows = Math.ceil(cards / targetColumns)

  // If we have leftover cards that would create an uneven bottom row,
  // try to redistribute for a more balanced grid
  const leftoverCards = cards % targetColumns
  if (leftoverCards > 0 && leftoverCards < targetColumns / 2 && targetColumns > 3) {
    // Try one less column for a more balanced grid
    const altColumns = targetColumns - 1
    const altRows = Math.ceil(cards / altColumns)
    const altLeftover = cards % altColumns

    // Use alternative if it creates a more balanced grid
    if (altLeftover === 0 || altLeftover > leftoverCards) {
      return { columns: altColumns, rows: altRows }
    }
  }

  return { columns: targetColumns, rows }
}

// Custom hook to calculate proper grid dimensions for consistent r×c layout
function useGridDimensions(gridConfig: any, totalCards: number) {
  const [gridDimensions, setGridDimensions] = useState(() => {
    // Calculate optimal rows and columns based on total cards and viewport
    if (typeof window !== 'undefined') {
      const aspectRatio = window.innerWidth / window.innerHeight
      return calculateOptimalGrid(totalCards, aspectRatio, gridConfig)
    }
    return { columns: gridConfig.mobileColumns || 3, rows: Math.ceil(totalCards / (gridConfig.mobileColumns || 3)) }
  })

  useEffect(() => {
    const updateGrid = () => {
      if (typeof window === 'undefined') return

      const aspectRatio = window.innerWidth / window.innerHeight
      setGridDimensions(calculateOptimalGrid(totalCards, aspectRatio, gridConfig))
    }

    updateGrid()
    window.addEventListener('resize', updateGrid)
    return () => window.removeEventListener('resize', updateGrid)
  }, [gridConfig, totalCards])

  return gridDimensions
}

export function MemoryGrid() {
  const { state, flipCard } = useMemoryPairs()
  const { profile, updatePlayerEmoji } = useUserProfile()
  const [showEmojiPicker, setShowEmojiPicker] = useState<{ player: 1 | 2 } | null>(null)

  if (!state.gameCards.length) {
    return null
  }

  const gridConfig = useMemo(() => getGridConfiguration(state.difficulty), [state.difficulty])
  const gridDimensions = useGridDimensions(gridConfig, state.gameCards.length)


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
      padding: { base: '12px', sm: '16px', md: '20px' },
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: { base: '12px', sm: '16px', md: '20px' }
    })}>

      {/* Game Info Header */}
      <div className={css({
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        maxWidth: '800px',
        padding: { base: '12px 16px', sm: '14px 20px', md: '16px 24px' },
        background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(248,250,252,0.9))',
        borderRadius: '16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        border: '1px solid rgba(255,255,255,0.8)'
      })}>

        <div className={css({
          display: 'grid',
          gridTemplateColumns: { base: 'repeat(3, 1fr)', sm: 'repeat(3, auto)' },
          gap: { base: '8px', sm: '12px', md: '20px' },
          justifyContent: { base: 'stretch', sm: 'center' },
          width: { base: '100%', sm: 'auto' }
        })}>
          <div className={css({ textAlign: 'center' })}>
            <div className={css({ fontSize: { base: '18px', sm: '20px', md: '24px' }, fontWeight: 'bold', color: 'blue.600' })}>
              {state.matchedPairs}
            </div>
            <div className={css({ fontSize: { base: '10px', sm: '11px', md: '12px' }, color: 'gray.600' })}>
              Matched
            </div>
          </div>

          <div className={css({ textAlign: 'center' })}>
            <div className={css({ fontSize: { base: '18px', sm: '20px', md: '24px' }, fontWeight: 'bold', color: 'purple.600' })}>
              {state.moves}
            </div>
            <div className={css({ fontSize: { base: '10px', sm: '11px', md: '12px' }, color: 'gray.600' })}>
              Moves
            </div>
          </div>

          <div className={css({ textAlign: 'center' })}>
            <div className={css({ fontSize: { base: '18px', sm: '20px', md: '24px' }, fontWeight: 'bold', color: 'green.600' })}>
              {state.totalPairs}
            </div>
            <div className={css({ fontSize: { base: '10px', sm: '11px', md: '12px' }, color: 'gray.600' })}>
              Total Pairs
            </div>
          </div>
        </div>

        {/* Multiplayer Scores */}
        {state.gameMode === 'multiplayer' && (
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
                {state.scores[1] || 0}
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
                {state.scores[2] || 0}
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

      {/* Cards Grid - Consistent r×c Layout */}
      <div
        style={{
          display: 'grid',
          gap: '6px',
          justifyContent: 'center',
          maxWidth: '100%',
          margin: '0 auto',
          padding: '0 8px',
          // Consistent grid ensuring all cards fit in r×c layout
          gridTemplateColumns: `repeat(${gridDimensions.columns}, 1fr)`,
          gridTemplateRows: `repeat(${gridDimensions.rows}, 1fr)`
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
                // Fully responsive card sizing - no fixed pixel sizes
                width: '100%',
                minWidth: '100px',
                maxWidth: '200px',
                // Dimming effect for invalid cards
                opacity: isDimmed ? 0.3 : 1,
                transition: 'opacity 0.3s ease',
                filter: isDimmed ? 'grayscale(0.7)' : 'none'
              })}>
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