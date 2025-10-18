'use client'

import { css } from '../../../../styled-system/css'
import { useCardSorting } from '../Provider'

export function ResultsPhase() {
  const { state, startGame, goToSetup, exitSession } = useCardSorting()
  const { scoreBreakdown } = state

  if (!scoreBreakdown) {
    return (
      <div className={css({ textAlign: 'center', padding: '2rem' })}>
        <p>No score data available</p>
      </div>
    )
  }

  const getMessage = (score: number) => {
    if (score === 100) return '🎉 Perfect! All cards in correct order!'
    if (score >= 80) return '👍 Excellent! Very close to perfect!'
    if (score >= 60) return '👍 Good job! You understand the pattern!'
    return '💪 Keep practicing! Focus on reading each abacus carefully.'
  }

  const getEmoji = (score: number) => {
    if (score === 100) return '🏆'
    if (score >= 80) return '⭐'
    if (score >= 60) return '👍'
    return '📈'
  }

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        padding: '1rem',
        overflow: 'auto',
      })}
    >
      {/* Score Display */}
      <div className={css({ textAlign: 'center' })}>
        <div className={css({ fontSize: '4rem', marginBottom: '0.5rem' })}>
          {getEmoji(scoreBreakdown.finalScore)}
        </div>
        <h2
          className={css({
            fontSize: { base: '2xl', md: '3xl' },
            fontWeight: 'bold',
            marginBottom: '0.5rem',
            color: 'gray.800',
          })}
        >
          Your Score: {scoreBreakdown.finalScore}%
        </h2>
        <p className={css({ fontSize: 'lg', color: 'gray.600' })}>
          {getMessage(scoreBreakdown.finalScore)}
        </p>
      </div>

      {/* Score Breakdown */}
      <div
        className={css({
          background: 'white',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        })}
      >
        <h3
          className={css({
            fontSize: 'xl',
            fontWeight: 'bold',
            marginBottom: '1rem',
            color: 'gray.800',
          })}
        >
          Score Breakdown
        </h3>

        <div className={css({ display: 'flex', flexDirection: 'column', gap: '1rem' })}>
          {/* Exact Position Matches */}
          <div>
            <div
              className={css({
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.25rem',
              })}
            >
              <span className={css({ fontSize: 'sm', fontWeight: '600' })}>
                Exact Position Matches (30%)
              </span>
              <span className={css({ fontSize: 'sm', color: 'gray.600' })}>
                {scoreBreakdown.exactMatches}/{state.cardCount} cards
              </span>
            </div>
            <div
              className={css({
                width: '100%',
                height: '1.5rem',
                background: 'gray.200',
                borderRadius: '9999px',
                overflow: 'hidden',
              })}
            >
              <div
                className={css({
                  height: '100%',
                  background: 'teal.500',
                  transition: 'width 0.5s ease',
                })}
                style={{ width: `${scoreBreakdown.exactPositionScore}%` }}
              />
            </div>
          </div>

          {/* Relative Order */}
          <div>
            <div
              className={css({
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.25rem',
              })}
            >
              <span className={css({ fontSize: 'sm', fontWeight: '600' })}>
                Relative Order (50%)
              </span>
              <span className={css({ fontSize: 'sm', color: 'gray.600' })}>
                {scoreBreakdown.lcsLength}/{state.cardCount} in sequence
              </span>
            </div>
            <div
              className={css({
                width: '100%',
                height: '1.5rem',
                background: 'gray.200',
                borderRadius: '9999px',
                overflow: 'hidden',
              })}
            >
              <div
                className={css({
                  height: '100%',
                  background: 'teal.500',
                  transition: 'width 0.5s ease',
                })}
                style={{ width: `${scoreBreakdown.relativeOrderScore}%` }}
              />
            </div>
          </div>

          {/* Organization */}
          <div>
            <div
              className={css({
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.25rem',
              })}
            >
              <span className={css({ fontSize: 'sm', fontWeight: '600' })}>Organization (20%)</span>
              <span className={css({ fontSize: 'sm', color: 'gray.600' })}>
                {scoreBreakdown.inversions} out-of-order pairs
              </span>
            </div>
            <div
              className={css({
                width: '100%',
                height: '1.5rem',
                background: 'gray.200',
                borderRadius: '9999px',
                overflow: 'hidden',
              })}
            >
              <div
                className={css({
                  height: '100%',
                  background: 'teal.500',
                  transition: 'width 0.5s ease',
                })}
                style={{ width: `${scoreBreakdown.inversionScore}%` }}
              />
            </div>
          </div>

          {/* Time Taken */}
          <div
            className={css({
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: '0.5rem',
              borderTop: '1px solid',
              borderColor: 'gray.200',
            })}
          >
            <span className={css({ fontSize: 'sm', fontWeight: '600' })}>Time Taken</span>
            <span className={css({ fontSize: 'sm', color: 'gray.600' })}>
              {Math.floor(scoreBreakdown.elapsedTime / 60)}:
              {(scoreBreakdown.elapsedTime % 60).toString().padStart(2, '0')}
            </span>
          </div>

          {scoreBreakdown.numbersRevealed && (
            <div
              className={css({
                padding: '0.75rem',
                background: 'orange.50',
                borderRadius: '0.5rem',
                border: '1px solid',
                borderColor: 'orange.200',
                fontSize: 'sm',
                color: 'orange.700',
                textAlign: 'center',
              })}
            >
              ⚠️ Numbers were revealed during play
            </div>
          )}
        </div>
      </div>

      {/* Comparison */}
      <div
        className={css({
          background: 'white',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        })}
      >
        <h3
          className={css({
            fontSize: 'xl',
            fontWeight: 'bold',
            marginBottom: '1rem',
            color: 'gray.800',
          })}
        >
          Comparison
        </h3>

        <div className={css({ display: 'flex', flexDirection: 'column', gap: '1.5rem' })}>
          {/* User's Answer */}
          <div>
            <h4
              className={css({
                fontSize: 'md',
                fontWeight: '600',
                marginBottom: '0.5rem',
                color: 'gray.700',
              })}
            >
              Your Answer:
            </h4>
            <div className={css({ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' })}>
              {state.placedCards.map((card, i) => {
                if (!card) return null
                const isCorrect = card.number === state.correctOrder[i]?.number

                return (
                  <div
                    key={i}
                    className={css({
                      padding: '0.5rem',
                      border: '2px solid',
                      borderColor: isCorrect ? 'green.500' : 'red.500',
                      borderRadius: '0.375rem',
                      background: isCorrect ? 'green.50' : 'red.50',
                      textAlign: 'center',
                      minWidth: '60px',
                    })}
                  >
                    <div
                      className={css({
                        fontSize: 'xs',
                        color: 'gray.600',
                        marginBottom: '0.25rem',
                      })}
                    >
                      #{i + 1}
                    </div>
                    <div
                      className={css({
                        fontSize: 'lg',
                        fontWeight: 'bold',
                        color: isCorrect ? 'green.700' : 'red.700',
                      })}
                    >
                      {card.number}
                    </div>
                    {isCorrect ? (
                      <div className={css({ fontSize: 'xs' })}>✓</div>
                    ) : (
                      <div className={css({ fontSize: 'xs' })}>✗</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Correct Order */}
          <div>
            <h4
              className={css({
                fontSize: 'md',
                fontWeight: '600',
                marginBottom: '0.5rem',
                color: 'gray.700',
              })}
            >
              Correct Order:
            </h4>
            <div className={css({ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' })}>
              {state.correctOrder.map((card, i) => (
                <div
                  key={i}
                  className={css({
                    padding: '0.5rem',
                    border: '2px solid',
                    borderColor: 'gray.300',
                    borderRadius: '0.375rem',
                    background: 'gray.50',
                    textAlign: 'center',
                    minWidth: '60px',
                  })}
                >
                  <div
                    className={css({
                      fontSize: 'xs',
                      color: 'gray.600',
                      marginBottom: '0.25rem',
                    })}
                  >
                    #{i + 1}
                  </div>
                  <div
                    className={css({
                      fontSize: 'lg',
                      fontWeight: 'bold',
                      color: 'gray.700',
                    })}
                  >
                    {card.number}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          maxWidth: '400px',
          margin: '0 auto',
          width: '100%',
        })}
      >
        <button
          type="button"
          onClick={startGame}
          className={css({
            padding: '1rem',
            borderRadius: '0.5rem',
            background: 'teal.600',
            color: 'white',
            fontWeight: '600',
            fontSize: 'lg',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            _hover: {
              background: 'teal.700',
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            },
          })}
        >
          New Game (Same Settings)
        </button>
        <button
          type="button"
          onClick={goToSetup}
          className={css({
            padding: '1rem',
            borderRadius: '0.5rem',
            background: 'gray.600',
            color: 'white',
            fontWeight: '600',
            fontSize: 'lg',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            _hover: {
              background: 'gray.700',
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            },
          })}
        >
          Change Settings
        </button>
        <button
          type="button"
          onClick={exitSession}
          className={css({
            padding: '1rem',
            borderRadius: '0.5rem',
            background: 'white',
            color: 'gray.700',
            fontWeight: '600',
            fontSize: 'lg',
            border: '2px solid',
            borderColor: 'gray.300',
            cursor: 'pointer',
            transition: 'all 0.2s',
            _hover: {
              borderColor: 'gray.400',
              background: 'gray.50',
            },
          })}
        >
          Exit to Room
        </button>
      </div>
    </div>
  )
}
