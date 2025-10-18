'use client'

import { css } from '../../../../styled-system/css'
import { useCardSorting } from '../Provider'
import { useState, useEffect } from 'react'

export function PlayingPhase() {
  const {
    state,
    selectedCardId,
    selectCard,
    placeCard,
    insertCard,
    removeCard,
    checkSolution,
    revealNumbers,
    goToSetup,
    canCheckSolution,
    placedCount,
    elapsedTime,
  } = useCardSorting()

  // Status message (mimics Python updateSortingStatus)
  const [statusMessage, setStatusMessage] = useState(
    `Arrange the ${state.cardCount} cards in ascending order (smallest to largest)`
  )

  // Update status message based on state
  useEffect(() => {
    if (state.gamePhase !== 'playing') return

    if (selectedCardId) {
      const card = state.availableCards.find((c) => c.id === selectedCardId)
      if (card) {
        setStatusMessage(
          `Selected card with value ${card.number}. Click a position or + button to place it.`
        )
      }
    } else if (placedCount === state.cardCount) {
      setStatusMessage('All cards placed! Click "Check My Solution" to see how you did.')
    } else {
      setStatusMessage(
        `${placedCount}/${state.cardCount} cards placed. Select ${placedCount === 0 ? 'a' : 'another'} card to continue.`
      )
    }
  }, [selectedCardId, placedCount, state.cardCount, state.gamePhase, state.availableCards])

  // Format time display
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Calculate gradient for position slots (darker = smaller, lighter = larger)
  const getSlotGradient = (position: number, total: number) => {
    const intensity = position / (total - 1 || 1)
    const lightness = 30 + intensity * 45 // 30% to 75%
    return {
      background: `hsl(220, 8%, ${lightness}%)`,
      color: lightness > 60 ? '#2c3e50' : '#ffffff',
      borderColor: lightness > 60 ? '#2c5f76' : 'rgba(255,255,255,0.4)',
    }
  }

  const handleCardClick = (cardId: string) => {
    if (selectedCardId === cardId) {
      selectCard(null) // Deselect
    } else {
      selectCard(cardId)
    }
  }

  const handleSlotClick = (position: number) => {
    if (!selectedCardId) {
      // No card selected - if slot has a card, move it back and auto-select
      if (state.placedCards[position]) {
        const cardToMove = state.placedCards[position]!
        removeCard(position)
        // Auto-select the card that was moved back
        selectCard(cardToMove.id)
      } else {
        setStatusMessage('Select a card first, or click a placed card to move it back.')
      }
    } else {
      // Card is selected - place it (replaces existing card if any)
      placeCard(selectedCardId, position)
    }
  }

  const handleInsertClick = (insertPosition: number) => {
    if (!selectedCardId) {
      setStatusMessage('Please select a card first, then click where to insert it.')
      return
    }
    insertCard(selectedCardId, insertPosition)
  }

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        height: '100%',
      })}
    >
      {/* Status message */}
      <div
        className={css({
          padding: '0.75rem 1rem',
          background: '#e3f2fd',
          borderLeft: '4px solid #2c5f76',
          borderRadius: '0.25rem',
          fontSize: 'sm',
          fontWeight: '500',
          color: '#2c3e50',
          flexShrink: 0,
        })}
      >
        {statusMessage}
      </div>

      {/* Header with timer and actions */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem',
          background: 'teal.50',
          borderRadius: '0.5rem',
          flexShrink: 0,
        })}
      >
        <div className={css({ display: 'flex', gap: '2rem' })}>
          <div>
            <div
              className={css({
                fontSize: 'sm',
                color: 'gray.600',
                fontWeight: '600',
              })}
            >
              Time
            </div>
            <div
              className={css({
                fontSize: 'xl',
                fontWeight: 'bold',
                color: 'teal.700',
              })}
            >
              {formatTime(elapsedTime)}
            </div>
          </div>
          <div>
            <div
              className={css({
                fontSize: 'sm',
                color: 'gray.600',
                fontWeight: '600',
              })}
            >
              Progress
            </div>
            <div
              className={css({
                fontSize: 'xl',
                fontWeight: 'bold',
                color: 'teal.700',
              })}
            >
              {placedCount}/{state.cardCount}
            </div>
          </div>
        </div>

        <div className={css({ display: 'flex', gap: '0.5rem' })}>
          {state.showNumbers && !state.numbersRevealed && (
            <button
              type="button"
              onClick={revealNumbers}
              className={css({
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                background: 'orange.500',
                color: 'white',
                fontSize: 'sm',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer',
                _hover: {
                  background: 'orange.600',
                },
              })}
            >
              Reveal Numbers
            </button>
          )}
          <button
            type="button"
            onClick={checkSolution}
            disabled={!canCheckSolution}
            className={css({
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              background: canCheckSolution ? 'teal.600' : 'gray.300',
              color: 'white',
              fontSize: 'sm',
              fontWeight: '600',
              border: 'none',
              cursor: canCheckSolution ? 'pointer' : 'not-allowed',
              opacity: canCheckSolution ? 1 : 0.6,
              _hover: {
                background: canCheckSolution ? 'teal.700' : 'gray.300',
              },
            })}
          >
            Check Solution
          </button>
          <button
            type="button"
            onClick={goToSetup}
            className={css({
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              background: 'gray.600',
              color: 'white',
              fontSize: 'sm',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              _hover: {
                background: 'gray.700',
              },
            })}
          >
            End Game
          </button>
        </div>
      </div>

      {/* Main game area */}
      <div
        className={css({
          display: 'flex',
          gap: '2rem',
          flex: 1,
          overflow: 'auto',
        })}
      >
        {/* Available cards */}
        <div className={css({ flex: 1, minWidth: '200px' })}>
          <h3
            className={css({
              fontSize: 'lg',
              fontWeight: 'bold',
              marginBottom: '1rem',
              color: 'gray.700',
            })}
          >
            Available Cards
          </h3>
          <div
            className={css({
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              justifyContent: 'center',
              padding: '15px',
              background: 'rgba(255,255,255,0.5)',
              borderRadius: '8px',
              minHeight: '120px',
              border: '2px dashed #2c5f76',
            })}
          >
            {state.availableCards.map((card) => (
              <div
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                className={css({
                  width: '90px',
                  height: '90px',
                  padding: '8px',
                  border: '2px solid',
                  borderColor: selectedCardId === card.id ? '#1976d2' : 'transparent',
                  borderRadius: '8px',
                  background: selectedCardId === card.id ? '#e3f2fd' : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  userSelect: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  _hover: {
                    transform: 'translateY(-5px)',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                    borderColor: '#2c5f76',
                  },
                })}
                style={
                  selectedCardId === card.id
                    ? {
                        transform: 'scale(1.1)',
                        boxShadow: '0 6px 20px rgba(25, 118, 210, 0.3)',
                      }
                    : undefined
                }
              >
                <div
                  dangerouslySetInnerHTML={{ __html: card.svgContent }}
                  className={css({
                    width: '74px',
                    height: '74px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    '& svg': {
                      width: '100%',
                      height: '100%',
                      display: 'block',
                    },
                  })}
                />
                {state.numbersRevealed && (
                  <div
                    className={css({
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      background: '#ffc107',
                      color: '#333',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                    })}
                  >
                    {card.number}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Position slots with insert buttons */}
        <div className={css({ flex: 2, minWidth: '300px' })}>
          <h3
            className={css({
              fontSize: 'lg',
              fontWeight: 'bold',
              marginBottom: '1rem',
              color: 'gray.700',
            })}
          >
            Sort Positions (Smallest → Largest)
          </h3>
          <div
            className={css({
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '15px',
              background: 'rgba(255,255,255,0.7)',
              borderRadius: '8px',
              border: '2px dashed #2c5f76',
            })}
          >
            {/* Insert button before first position */}
            <button
              type="button"
              onClick={() => handleInsertClick(0)}
              disabled={!selectedCardId}
              className={css({
                width: '32px',
                height: '50px',
                background: selectedCardId ? '#1976d2' : '#2c5f76',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                fontSize: '24px',
                fontWeight: 'bold',
                cursor: selectedCardId ? 'pointer' : 'default',
                opacity: selectedCardId ? 1 : 0.3,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                _hover: {
                  opacity: 1,
                  background: '#1976d2',
                  transform: selectedCardId ? 'scale(1.1)' : 'none',
                },
              })}
            >
              +
            </button>

            {/* Render each position slot followed by an insert button */}
            {state.placedCards.map((card, index) => {
              const gradientStyle = getSlotGradient(index, state.cardCount)
              const isEmpty = card === null

              return (
                <>
                  {/* Position slot */}
                  <div
                    key={`slot-${index}`}
                    onClick={() => handleSlotClick(index)}
                    className={css({
                      width: '90px',
                      height: '110px',
                      padding: '0.5rem',
                      borderRadius: '8px',
                      border: '2px solid',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.25rem',
                      position: 'relative',
                      _hover: {
                        transform: selectedCardId && isEmpty ? 'scale(1.05)' : 'none',
                        boxShadow:
                          selectedCardId && isEmpty ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                      },
                    })}
                    style={
                      isEmpty
                        ? {
                            ...gradientStyle,
                            // Active state: add slight glow when card is selected
                            boxShadow: selectedCardId
                              ? '0 0 0 2px #1976d2, 0 2px 8px rgba(25, 118, 210, 0.3)'
                              : 'none',
                          }
                        : {
                            background: '#fff',
                            color: '#333',
                            borderColor: '#2c5f76',
                          }
                    }
                  >
                    {card ? (
                      <>
                        <div
                          dangerouslySetInnerHTML={{
                            __html: card.svgContent,
                          }}
                          className={css({
                            width: '70px',
                            height: '70px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            margin: '0 auto',
                            '& svg': {
                              width: '100%',
                              height: '100%',
                              display: 'block',
                            },
                          })}
                        />
                        <div
                          className={css({
                            fontSize: 'xs',
                            opacity: 0.7,
                            fontStyle: 'italic',
                            textAlign: 'center',
                          })}
                        >
                          ← Click to move back
                        </div>
                      </>
                    ) : (
                      <div
                        className={css({
                          fontSize: 'sm',
                          fontStyle: 'italic',
                          textAlign: 'center',
                        })}
                        style={{ color: gradientStyle.color }}
                      >
                        {index === 0 ? 'Smallest' : index === state.cardCount - 1 ? 'Largest' : ''}
                      </div>
                    )}
                  </div>

                  {/* Insert button after this position */}
                  <button
                    key={`insert-${index + 1}`}
                    type="button"
                    onClick={() => handleInsertClick(index + 1)}
                    disabled={!selectedCardId}
                    className={css({
                      width: '32px',
                      height: '50px',
                      background: selectedCardId ? '#1976d2' : '#2c5f76',
                      color: 'white',
                      border: 'none',
                      borderRadius: '20px',
                      fontSize: '24px',
                      fontWeight: 'bold',
                      cursor: selectedCardId ? 'pointer' : 'default',
                      opacity: selectedCardId ? 1 : 0.3,
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      _hover: {
                        opacity: 1,
                        background: '#1976d2',
                        transform: selectedCardId ? 'scale(1.1)' : 'none',
                      },
                    })}
                  >
                    +
                  </button>
                </>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
