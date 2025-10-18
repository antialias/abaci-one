'use client'

import { css } from '../../../../styled-system/css'
import { useCardSorting } from '../Provider'

export function PlayingPhase() {
  const {
    state,
    selectedCardId,
    selectCard,
    placeCard,
    removeCard,
    checkSolution,
    revealNumbers,
    goToSetup,
    canCheckSolution,
    placedCount,
    elapsedTime,
  } = useCardSorting()

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
      // No card selected - remove card if slot is occupied
      if (state.placedCards[position]) {
        removeCard(position)
      }
    } else {
      // Card is selected - place it
      placeCard(selectedCardId, position)
    }
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
              display: 'grid',
              gridTemplateColumns: {
                base: '1',
                sm: '2',
                md: '3',
              },
              gap: '0.75rem',
            })}
          >
            {state.availableCards.map((card) => (
              <div
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                className={css({
                  padding: '0.5rem',
                  border: '2px solid',
                  borderColor: selectedCardId === card.id ? 'blue.500' : 'gray.300',
                  borderRadius: '0.5rem',
                  background: selectedCardId === card.id ? 'blue.50' : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  transform: selectedCardId === card.id ? 'scale(1.05)' : 'scale(1)',
                  _hover: {
                    transform: 'scale(1.05)',
                    borderColor: 'blue.500',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  },
                })}
              >
                <div
                  dangerouslySetInnerHTML={{ __html: card.svgContent }}
                  className={css({
                    width: '100%',
                    '& svg': {
                      width: '100%',
                      height: 'auto',
                    },
                  })}
                />
                {state.numbersRevealed && (
                  <div
                    className={css({
                      textAlign: 'center',
                      marginTop: '0.5rem',
                      fontSize: 'lg',
                      fontWeight: 'bold',
                      color: 'gray.700',
                    })}
                  >
                    {card.number}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Position slots */}
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
              flexDirection: 'column',
              gap: '0.5rem',
            })}
          >
            {state.placedCards.map((card, index) => {
              const gradientStyle = getSlotGradient(index, state.cardCount)

              return (
                <div
                  key={index}
                  onClick={() => handleSlotClick(index)}
                  className={css({
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    border: '2px solid',
                    borderColor:
                      gradientStyle.color === '#ffffff' ? 'rgba(255,255,255,0.4)' : '#2c5f76',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    minHeight: '80px',
                    _hover: {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    },
                  })}
                  style={gradientStyle}
                >
                  <div
                    className={css({
                      fontSize: 'sm',
                      fontWeight: 'bold',
                      opacity: 0.7,
                    })}
                  >
                    #{index + 1}
                  </div>
                  {card ? (
                    <div
                      className={css({
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                      })}
                    >
                      <div
                        dangerouslySetInnerHTML={{
                          __html: card.svgContent,
                        }}
                        className={css({
                          width: '120px',
                          '& svg': {
                            width: '100%',
                            height: 'auto',
                          },
                        })}
                      />
                      {state.numbersRevealed && (
                        <div
                          className={css({
                            fontSize: 'xl',
                            fontWeight: 'bold',
                          })}
                        >
                          {card.number}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className={css({
                        flex: 1,
                        fontSize: 'sm',
                        opacity: 0.5,
                        fontStyle: 'italic',
                      })}
                    >
                      {selectedCardId ? 'Click to place card' : 'Empty'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
