'use client'

import { css } from '../../../../styled-system/css'
import { useCardSorting } from '../Provider'
import { useSpring, animated, config, useSprings } from '@react-spring/web'
import { useState, useEffect, useRef, useMemo } from 'react'
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

interface CardPosition {
  x: number
  y: number
  rotation: number
}

export function ResultsPhase() {
  const { state, startGame, goToSetup, exitSession, players } = useCardSorting()
  const { scoreBreakdown } = state
  const [showCorrections, setShowCorrections] = useState(false)

  // Determine if this is a collaborative game
  const isCollaborative = state.gameMode === 'collaborative'

  // Get user's sequence from placedCards
  const userSequence = state.placedCards.filter((c): c is SortingCard => c !== null)

  // Get viewport dimensions for converting percentage positions to pixels
  const containerRef = useRef<HTMLDivElement>(null)
  const viewportDimensionsRef = useRef({
    width: window.innerWidth,
    height: window.innerHeight,
  })
  const [, forceUpdate] = useState({})

  useEffect(() => {
    const updateDimensions = () => {
      viewportDimensionsRef.current = {
        width: window.innerWidth,
        height: window.innerHeight,
      }
      forceUpdate({}) // Force re-render for viewport updates
    }
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Calculate grid positions for cards (final positions)
  // Use percentage-based coordinates (same as game board)
  const calculateGridPosition = (cardIndex: number) => {
    const gridCols = 3
    const cardWidthPct = 14 // ~140px on ~1000px viewport
    const cardHeightPct = 22.5 // ~180px on ~800px viewport
    const gapPct = 2

    // Center the grid horizontally
    const gridWidth = gridCols * cardWidthPct + (gridCols - 1) * gapPct
    const startXPct = (100 - gridWidth) / 2

    const col = cardIndex % gridCols
    const row = Math.floor(cardIndex / gridCols)

    return {
      x: startXPct + col * (cardWidthPct + gapPct),
      y: 15 + row * (cardHeightPct + gapPct), // Start from 15% down
      rotation: 0,
    }
  }

  // Get initial positions from game table (already in percentage)
  const getInitialPosition = (cardId: string) => {
    const cardPos = state.cardPositions.find((p) => p.cardId === cardId)
    if (!cardPos) {
      return { x: 50, y: 50, rotation: 0 }
    }

    // Already in percentage, just pass through
    return {
      x: cardPos.x,
      y: cardPos.y,
      rotation: cardPos.rotation,
    }
  }

  // Create springs for each card - memoize initial positions
  const initialPositions = useMemo(() => {
    return userSequence.map((card) => getInitialPosition(card.id))
  }, []) // Empty deps - only calculate once on mount

  const [springs, api] = useSprings(
    userSequence.length,
    (index) => {
      console.log('[ResultsPhase] Creating spring', index, 'from', initialPositions[index])
      return {
        from: initialPositions[index],
        to: initialPositions[index],
        immediate: false,
        config: config.gentle,
      }
    },
    [] // Empty deps - only create once, never recreate
  )

  console.log('[ResultsPhase] Component render, springs.length:', springs.length)

  // Immediately start animating to grid positions (only once)
  useEffect(() => {
    console.log('[ResultsPhase] Animation effect running')

    // Small delay to ensure mount
    const timer = setTimeout(() => {
      console.log('[ResultsPhase] Starting animation to grid positions')
      api.start((index) => {
        const card = userSequence[index]
        const correctIndex = state.correctOrder.findIndex((c) => c.id === card.id)
        const gridPos = calculateGridPosition(correctIndex)
        console.log('[ResultsPhase] Animating card', index, 'to', gridPos)
        return {
          to: gridPos,
          immediate: false,
          config: { ...config.gentle, tension: 120, friction: 26 },
        }
      })
    }, 100)

    // After animation completes, lock positions by setting immediate: true
    const lockTimer = setTimeout(() => {
      console.log('[ResultsPhase] Locking positions with immediate: true')
      api.start((index) => {
        const card = userSequence[index]
        const correctIndex = state.correctOrder.findIndex((c) => c.id === card.id)
        const gridPos = calculateGridPosition(correctIndex)
        console.log('[ResultsPhase] Locking card', index, 'at', gridPos)
        return {
          to: gridPos,
          immediate: true, // No more animations - locked in place
        }
      })
    }, 1100) // Wait for animation to complete (100ms + 1000ms)

    return () => {
      console.log('[ResultsPhase] Animation effect cleanup')
      clearTimeout(timer)
      clearTimeout(lockTimer)
    }
  }, []) // Empty deps - only run once

  // Show corrections after animation completes
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowCorrections(true)
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  // Panel slide-in animation
  const panelSpring = useSpring({
    from: { opacity: 0, transform: 'translateX(50px)' },
    to: { opacity: 1, transform: 'translateX(0px)' },
    config: config.gentle,
  })

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
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
      })}
    >
      {/* Full viewport for cards (same coordinate system as game board) */}
      <div
        ref={containerRef}
        className={css({
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        })}
      >
        {/* Cards with animated positions */}
        {userSequence.map((card, userIndex) => {
          const spring = springs[userIndex]
          if (!spring) return null

          // Check if this card is correct for its position in the user's sequence
          // Same logic as during gameplay: does the card at this position match the correct card for this position?
          const isCorrect = state.correctOrder[userIndex]?.id === card.id
          const correctIndex = state.correctOrder.findIndex((c) => c.id === card.id)

          return (
            <animated.div
              key={card.id}
              style={{
                position: 'absolute',
                left: spring.x.to((x) => `${(x / 100) * viewportDimensionsRef.current.width}px`),
                top: spring.y.to((y) => `${(y / 100) * viewportDimensionsRef.current.height}px`),
                transform: spring.rotation.to((r) => `rotate(${r}deg)`),
                width: '140px',
                height: '180px',
                zIndex: 5,
              }}
            >
              {/* Card */}
              <div
                className={css({
                  width: '100%',
                  height: '100%',
                  background: 'white',
                  borderRadius: '8px',
                  border: '3px solid',
                  borderColor: isCorrect ? '#22c55e' : showCorrections ? '#ef4444' : '#0369a1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  boxSizing: 'border-box',
                  position: 'relative',
                  boxShadow: isCorrect
                    ? '0 0 20px rgba(34, 197, 94, 0.4)'
                    : showCorrections
                      ? '0 0 20px rgba(239, 68, 68, 0.4)'
                      : '0 4px 8px rgba(0, 0, 0, 0.1)',
                })}
                dangerouslySetInnerHTML={{ __html: card.svgContent }}
              />

              {/* Correct/Incorrect indicator */}
              {showCorrections && (
                <div
                  className={css({
                    position: 'absolute',
                    top: '-12px',
                    right: '-12px',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: isCorrect ? '#22c55e' : '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
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
                  bottom: '-8px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: isCorrect ? '#22c55e' : showCorrections ? '#ef4444' : '#0369a1',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                })}
              >
                #{showCorrections ? correctIndex + 1 : userIndex + 1}
              </div>
            </animated.div>
          )
        })}

        {/* Correction message */}
        {showCorrections && (
          <div
            className={css({
              position: 'absolute',
              bottom: '20px',
              left: '20px',
              right: '20px',
              padding: '12px 16px',
              background: 'rgba(59, 130, 246, 0.2)',
              border: '2px solid rgba(59, 130, 246, 0.4)',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#1e3a8a',
              textAlign: 'center',
              animation: 'scoreReveal 0.6s ease-out 0.5s both',
            })}
          >
            {isPerfect
              ? '🎉 Perfect arrangement!'
              : '↗️ Cards have moved to their correct positions'}
          </div>
        )}
      </div>

      {/* Right side: Score panel */}
      <animated.div
        style={panelSpring}
        className={css({
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: '400px',
          background: 'rgba(255, 255, 255, 0.95)',
          borderLeft: '3px solid rgba(59, 130, 246, 0.3)',
          padding: '40px',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.1)',
        })}
      >
        {/* Score Circle */}
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          })}
        >
          <div
            className={css({
              width: '160px',
              height: '160px',
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
                fontSize: '64px',
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
                fontSize: '20px',
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
                padding: '6px 16px',
                background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
                borderRadius: '20px',
                fontSize: '13px',
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
              fontSize: '18px',
              fontWeight: '600',
              color: '#0c4a6e',
            })}
          >
            {getMessage(scoreBreakdown.finalScore)}
          </div>

          {/* Time Badge */}
          <div
            className={css({
              padding: '8px 20px',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '2px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '20px',
              fontSize: '16px',
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
              borderRadius: '12px',
              padding: '16px',
              border: '2px solid rgba(139, 92, 246, 0.2)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
            })}
          >
            <div
              className={css({
                fontSize: '13px',
                fontWeight: '700',
                color: '#64748b',
                marginBottom: '12px',
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
                gap: '8px',
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
                      gap: '6px',
                      padding: '6px 12px',
                      background: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.2)',
                      borderRadius: '20px',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#5b21b6',
                    })}
                  >
                    <span style={{ fontSize: '18px' }}>{player.emoji}</span>
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
            gap: '12px',
          })}
        >
          {/* Exact Matches */}
          <div
            className={css({
              background: 'white',
              borderRadius: '12px',
              padding: '12px',
              border: '2px solid rgba(59, 130, 246, 0.2)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
            })}
          >
            <div
              className={css({
                fontSize: '11px',
                fontWeight: '600',
                color: '#64748b',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              })}
            >
              Exact
            </div>
            <div
              className={css({
                fontSize: '28px',
                fontWeight: 'bold',
                color: '#0c4a6e',
              })}
            >
              {scoreBreakdown.exactMatches}
              <span
                className={css({
                  fontSize: '14px',
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
              borderRadius: '12px',
              padding: '12px',
              border: '2px solid rgba(59, 130, 246, 0.2)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
            })}
          >
            <div
              className={css({
                fontSize: '11px',
                fontWeight: '600',
                color: '#64748b',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              })}
            >
              Sequence
            </div>
            <div
              className={css({
                fontSize: '28px',
                fontWeight: 'bold',
                color: '#0c4a6e',
              })}
            >
              {scoreBreakdown.lcsLength}
              <span
                className={css({
                  fontSize: '14px',
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
              borderRadius: '12px',
              padding: '12px',
              border: '2px solid rgba(59, 130, 246, 0.2)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
            })}
          >
            <div
              className={css({
                fontSize: '11px',
                fontWeight: '600',
                color: '#64748b',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              })}
            >
              Wrong
            </div>
            <div
              className={css({
                fontSize: '28px',
                fontWeight: 'bold',
                color: '#0c4a6e',
              })}
            >
              {scoreBreakdown.inversions}
            </div>
          </div>
        </div>

        {/* Warning if numbers revealed */}
        {scoreBreakdown.numbersRevealed && (
          <div
            className={css({
              padding: '12px 16px',
              background: 'rgba(251, 146, 60, 0.2)',
              border: '2px solid rgba(251, 146, 60, 0.4)',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#9a3412',
              textAlign: 'center',
            })}
          >
            👁️ Numbers were revealed during play
          </div>
        )}

        {/* Action Buttons */}
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            marginTop: 'auto',
          })}
        >
          <button
            type="button"
            onClick={startGame}
            className={css({
              padding: '14px 24px',
              background: 'linear-gradient(135deg, #86efac, #22c55e)',
              border: '3px solid #22c55e',
              borderRadius: '12px',
              fontSize: '16px',
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
              padding: '12px 20px',
              background: 'white',
              border: '2px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              fontSize: '14px',
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
              padding: '12px 20px',
              background: 'white',
              border: '2px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              fontSize: '14px',
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
      </animated.div>
    </div>
  )
}
