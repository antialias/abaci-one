'use client'

import { css } from '../../../../styled-system/css'
import { useCardSorting } from '../Provider'
import { useState, useEffect } from 'react'
import type { SortingCard } from '../types'

// Add result animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @keyframes scoreReveal {
      0% {
        transform: scale(0.8);
        opacity: 0;
      }
      60% {
        transform: scale(1.1);
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }
    @keyframes perfectCelebrate {
      0%, 100% { transform: scale(1) rotate(0deg); }
      25% { transform: scale(1.1) rotate(-5deg); }
      75% { transform: scale(1.1) rotate(5deg); }
    }
  `
  document.head.appendChild(style)
}

export function ResultsPhase() {
  const { state, startGame, goToSetup, exitSession, players } = useCardSorting()
  const { scoreBreakdown } = state
  const [showCorrections, setShowCorrections] = useState(false)

  // Determine if this is a collaborative game
  const isCollaborative = state.gameMode === 'collaborative'

  // Get user's sequence from placedCards
  const userSequence = state.placedCards.filter((c): c is SortingCard => c !== null)

  // Show corrections after a delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowCorrections(true)
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  if (!scoreBreakdown) {
    return (
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          fontSize: '18px',
          color: '#666',
        })}
      >
        No score data available
      </div>
    )
  }

  const isPerfect = scoreBreakdown.finalScore === 100
  const isExcellent = scoreBreakdown.finalScore >= 80

  const getMessage = (score: number) => {
    if (isCollaborative) {
      if (score === 100) return 'Perfect teamwork! All cards in correct order!'
      if (score >= 80) return 'Excellent collaboration! Very close to perfect!'
      if (score >= 60) return 'Good team effort! You worked well together!'
      return 'Keep working together! Communication is key.'
    }
    if (score === 100) return 'Perfect! All cards in correct order!'
    if (score >= 80) return 'Excellent! Very close to perfect!'
    if (score >= 60) return 'Good job! You understand the pattern!'
    return 'Keep practicing! Focus on reading each abacus carefully.'
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div
      className={css({
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: { base: 'column-reverse', md: 'row' },
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
        overflow: 'auto',
      })}
    >
      {/* Cards Grid Area */}
      <div
        className={css({
          flex: { base: '0 0 auto', md: 1 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: { base: '16px 12px', md: '40px' },
          overflow: { base: 'visible', md: 'auto' },
        })}
      >
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: { base: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(3, 1fr)' },
            gap: { base: '12px', md: '16px' },
            maxWidth: '600px',
            width: '100%',
          })}
        >
          {userSequence.map((card, userIndex) => {
            const isCorrect = state.correctOrder[userIndex]?.id === card.id
            const correctIndex = state.correctOrder.findIndex((c) => c.id === card.id)

            return (
              <div
                key={card.id}
                className={css({
                  position: 'relative',
                  width: '100%',
                  paddingBottom: '125%', // 5:4 aspect ratio
                })}
              >
                {/* Card */}
                <div
                  className={css({
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'white',
                    borderRadius: { base: '6px', md: '8px' },
                    border: { base: '2px solid', md: '3px solid' },
                    borderColor: isCorrect ? '#22c55e' : showCorrections ? '#ef4444' : '#0369a1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: { base: '4px', md: '8px' },
                    boxSizing: 'border-box',
                    boxShadow: isCorrect
                      ? '0 0 20px rgba(34, 197, 94, 0.4)'
                      : showCorrections
                        ? '0 0 20px rgba(239, 68, 68, 0.4)'
                        : '0 4px 8px rgba(0, 0, 0, 0.1)',
                    animation: 'scoreReveal 0.5s ease-out',
                  })}
                  dangerouslySetInnerHTML={{ __html: card.svgContent }}
                />

                {/* Correct/Incorrect indicator */}
                {showCorrections && (
                  <div
                    className={css({
                      position: 'absolute',
                      top: { base: '-8px', md: '-12px' },
                      right: { base: '-8px', md: '-12px' },
                      width: { base: '24px', md: '32px' },
                      height: { base: '24px', md: '32px' },
                      borderRadius: '50%',
                      background: isCorrect ? '#22c55e' : '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: { base: '16px', md: '20px' },
                      color: 'white',
                      fontWeight: 'bold',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                      animation: 'scoreReveal 0.4s ease-out',
                    })}
                  >
                    {isCorrect ? '✓' : '✗'}
                  </div>
                )}

                {/* Position number */}
                <div
                  className={css({
                    position: 'absolute',
                    bottom: { base: '-6px', md: '-8px' },
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: isCorrect ? '#22c55e' : showCorrections ? '#ef4444' : '#0369a1',
                    color: 'white',
                    padding: { base: '3px 6px', md: '4px 8px' },
                    borderRadius: { base: '8px', md: '12px' },
                    fontSize: { base: '10px', md: '12px' },
                    fontWeight: 'bold',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                  })}
                >
                  #{showCorrections ? correctIndex + 1 : userIndex + 1}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Score panel */}
      <div
        className={css({
          width: { base: '100%', md: '400px' },
          background: 'rgba(255, 255, 255, 0.95)',
          borderLeft: { base: 'none', md: '3px solid rgba(59, 130, 246, 0.3)' },
          borderBottom: { base: '3px solid rgba(59, 130, 246, 0.3)', md: 'none' },
          padding: { base: '20px 16px', md: '40px' },
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: { base: '16px', md: '24px' },
          boxShadow: {
            base: '0 4px 20px rgba(0, 0, 0, 0.1)',
            md: '-4px 0 20px rgba(0, 0, 0, 0.1)',
          },
        })}
      >
        {/* Score Circle */}
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: { base: '12px', md: '16px' },
          })}
        >
          <div
            className={css({
              width: { base: '120px', md: '160px' },
              height: { base: '120px', md: '160px' },
              borderRadius: '50%',
              background: isPerfect
                ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                : isExcellent
                  ? 'linear-gradient(135deg, #86efac, #22c55e)'
                  : 'linear-gradient(135deg, #93c5fd, #3b82f6)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isPerfect
                ? '0 0 40px rgba(245, 158, 11, 0.5), 0 10px 30px rgba(0, 0, 0, 0.2)'
                : '0 10px 30px rgba(0, 0, 0, 0.15)',
              animation: isPerfect
                ? 'perfectCelebrate 0.6s ease-in-out'
                : 'scoreReveal 0.6s ease-out',
            })}
            style={{
              animationName: isPerfect ? 'perfectCelebrate' : 'scoreReveal',
            }}
          >
            <div
              className={css({
                fontSize: { base: '48px', md: '64px' },
                fontWeight: 'bold',
                color: 'white',
                lineHeight: 1,
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
              })}
            >
              {scoreBreakdown.finalScore}
            </div>
            <div
              className={css({
                fontSize: { base: '16px', md: '20px' },
                fontWeight: '600',
                color: 'white',
                opacity: 0.9,
              })}
            >
              {isPerfect ? '🏆' : isExcellent ? '⭐' : '%'}
            </div>
          </div>

          {/* Team/Solo Label */}
          {isCollaborative && (
            <div
              className={css({
                padding: { base: '5px 12px', md: '6px 16px' },
                background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
                borderRadius: '20px',
                fontSize: { base: '12px', md: '13px' },
                fontWeight: '700',
                color: 'white',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
              })}
            >
              👥 Team Score
            </div>
          )}

          <div
            className={css({
              textAlign: 'center',
              fontSize: { base: '15px', md: '18px' },
              fontWeight: '600',
              color: '#0c4a6e',
              lineHeight: 1.3,
            })}
          >
            {getMessage(scoreBreakdown.finalScore)}
          </div>

          {/* Time Badge */}
          <div
            className={css({
              padding: { base: '6px 16px', md: '8px 20px' },
              background: 'rgba(59, 130, 246, 0.1)',
              border: '2px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '20px',
              fontSize: { base: '14px', md: '16px' },
              fontWeight: '600',
              color: '#0c4a6e',
            })}
          >
            ⏱️ {formatTime(scoreBreakdown.elapsedTime)}
          </div>
        </div>

        {/* Team Members (collaborative mode only) */}
        {isCollaborative && state.activePlayers.length > 0 && (
          <div
            className={css({
              background: 'white',
              borderRadius: { base: '10px', md: '12px' },
              padding: { base: '12px', md: '16px' },
              border: '2px solid rgba(139, 92, 246, 0.2)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
            })}
          >
            <div
              className={css({
                fontSize: { base: '11px', md: '13px' },
                fontWeight: '700',
                color: '#64748b',
                marginBottom: { base: '8px', md: '12px' },
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              })}
            >
              Team Members ({state.activePlayers.length})
            </div>
            <div
              className={css({
                display: 'flex',
                flexWrap: 'wrap',
                gap: { base: '6px', md: '8px' },
              })}
            >
              {state.activePlayers
                .map((playerId) => players.get(playerId))
                .filter((player): player is NonNullable<typeof player> => player !== undefined)
                .map((player) => (
                  <div
                    key={player.id}
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: { base: '4px', md: '6px' },
                      padding: { base: '5px 10px', md: '6px 12px' },
                      background: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.2)',
                      borderRadius: '20px',
                      fontSize: { base: '13px', md: '14px' },
                      fontWeight: '500',
                      color: '#5b21b6',
                    })}
                  >
                    <span style={{ fontSize: '16px' }}>{player.emoji}</span>
                    <span>{player.name}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Score Details - Compact Cards */}
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: { base: '8px', md: '12px' },
          })}
        >
          {/* Exact Matches */}
          <div
            className={css({
              background: 'white',
              borderRadius: { base: '10px', md: '12px' },
              padding: { base: '10px 8px', md: '12px' },
              border: '2px solid rgba(59, 130, 246, 0.2)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
            })}
          >
            <div
              className={css({
                fontSize: { base: '9px', md: '11px' },
                fontWeight: '600',
                color: '#64748b',
                marginBottom: { base: '3px', md: '4px' },
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              })}
            >
              Exact
            </div>
            <div
              className={css({
                fontSize: { base: '22px', md: '28px' },
                fontWeight: 'bold',
                color: '#0c4a6e',
              })}
            >
              {scoreBreakdown.exactMatches}
              <span
                className={css({
                  fontSize: { base: '12px', md: '14px' },
                  color: '#64748b',
                  fontWeight: '500',
                })}
              >
                /{state.cardCount}
              </span>
            </div>
          </div>

          {/* Sequence */}
          <div
            className={css({
              background: 'white',
              borderRadius: { base: '10px', md: '12px' },
              padding: { base: '10px 8px', md: '12px' },
              border: '2px solid rgba(59, 130, 246, 0.2)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
            })}
          >
            <div
              className={css({
                fontSize: { base: '9px', md: '11px' },
                fontWeight: '600',
                color: '#64748b',
                marginBottom: { base: '3px', md: '4px' },
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              })}
            >
              Sequence
            </div>
            <div
              className={css({
                fontSize: { base: '22px', md: '28px' },
                fontWeight: 'bold',
                color: '#0c4a6e',
              })}
            >
              {scoreBreakdown.lcsLength}
              <span
                className={css({
                  fontSize: { base: '12px', md: '14px' },
                  color: '#64748b',
                  fontWeight: '500',
                })}
              >
                /{state.cardCount}
              </span>
            </div>
          </div>

          {/* Misplaced */}
          <div
            className={css({
              background: 'white',
              borderRadius: { base: '10px', md: '12px' },
              padding: { base: '10px 8px', md: '12px' },
              border: '2px solid rgba(59, 130, 246, 0.2)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
            })}
          >
            <div
              className={css({
                fontSize: { base: '9px', md: '11px' },
                fontWeight: '600',
                color: '#64748b',
                marginBottom: { base: '3px', md: '4px' },
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              })}
            >
              Wrong
            </div>
            <div
              className={css({
                fontSize: { base: '22px', md: '28px' },
                fontWeight: 'bold',
                color: '#0c4a6e',
              })}
            >
              {scoreBreakdown.inversions}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: { base: '8px', md: '10px' },
            marginTop: 'auto',
          })}
        >
          <button
            type="button"
            onClick={startGame}
            className={css({
              padding: { base: '12px 20px', md: '14px 24px' },
              background: 'linear-gradient(135deg, #86efac, #22c55e)',
              border: { base: '2px solid #22c55e', md: '3px solid #22c55e' },
              borderRadius: { base: '10px', md: '12px' },
              fontSize: { base: '14px', md: '16px' },
              fontWeight: '700',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              _hover: {
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 20px rgba(34, 197, 94, 0.4)',
              },
            })}
          >
            🎮 Play Again
          </button>

          <button
            type="button"
            onClick={goToSetup}
            className={css({
              padding: { base: '10px 16px', md: '12px 20px' },
              background: 'white',
              border: '2px solid rgba(59, 130, 246, 0.3)',
              borderRadius: { base: '10px', md: '12px' },
              fontSize: { base: '13px', md: '14px' },
              fontWeight: '700',
              color: '#0c4a6e',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              _hover: {
                borderColor: 'rgba(59, 130, 246, 0.5)',
                background: 'rgba(59, 130, 246, 0.05)',
              },
            })}
          >
            ⚙️ Settings
          </button>

          <button
            type="button"
            onClick={exitSession}
            className={css({
              padding: { base: '10px 16px', md: '12px 20px' },
              background: 'white',
              border: '2px solid rgba(239, 68, 68, 0.3)',
              borderRadius: { base: '10px', md: '12px' },
              fontSize: { base: '13px', md: '14px' },
              fontWeight: '700',
              color: '#991b1b',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              _hover: {
                borderColor: 'rgba(239, 68, 68, 0.5)',
                background: 'rgba(239, 68, 68, 0.05)',
              },
            })}
          >
            🚪 Exit
          </button>
        </div>
      </div>
    </div>
  )
}
