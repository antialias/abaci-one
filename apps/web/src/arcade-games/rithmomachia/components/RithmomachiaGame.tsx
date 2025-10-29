'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { animated, useSpring } from '@react-spring/web'
import { PageWithNav } from '@/components/PageWithNav'
import { StandardGameLayout } from '@/components/StandardGameLayout'
import { useFullscreen } from '@/contexts/FullscreenContext'
import { css } from '../../../../styled-system/css'
import { useRithmomachia } from '../Provider'
import type { RithmomachiaConfig, Piece } from '../types'
import { PieceRenderer } from './PieceRenderer'

/**
 * Main Rithmomachia game component.
 * Orchestrates the game phases and UI.
 */
export function RithmomachiaGame() {
  const router = useRouter()
  const { state, resetGame, goToSetup } = useRithmomachia()
  const { setFullscreenElement } = useFullscreen()
  const gameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Register this component's main div as the fullscreen element
    if (gameRef.current) {
      setFullscreenElement(gameRef.current)
    }
  }, [setFullscreenElement])

  return (
    <PageWithNav
      navTitle="Rithmomachia"
      navEmoji="🎲"
      emphasizePlayerSelection={state.gamePhase === 'setup'}
      onExitSession={() => {
        router.push('/arcade')
      }}
      onNewGame={resetGame}
      onSetup={goToSetup}
    >
      <StandardGameLayout>
        <div
          ref={gameRef}
          className={css({
            flex: 1,
            padding: { base: '12px', sm: '16px', md: '20px' },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            overflow: 'auto',
          })}
        >
          <main
            className={css({
              width: '100%',
              maxWidth: '1200px',
              background: 'rgba(255,255,255,0.95)',
              borderRadius: { base: '12px', md: '20px' },
              padding: { base: '12px', sm: '16px', md: '24px', lg: '32px' },
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            })}
          >
            {state.gamePhase === 'setup' && <SetupPhase />}
            {state.gamePhase === 'playing' && <PlayingPhase />}
            {state.gamePhase === 'results' && <ResultsPhase />}
          </main>
        </div>
      </StandardGameLayout>
    </PageWithNav>
  )
}

/**
 * Setup phase: game configuration and start button.
 */
function SetupPhase() {
  const { state, startGame, setConfig, lastError, clearError } = useRithmomachia()

  const toggleSetting = (key: keyof typeof state) => {
    if (typeof state[key] === 'boolean') {
      setConfig(key as keyof RithmomachiaConfig, !state[key])
    }
  }

  const updateThreshold = (value: number) => {
    setConfig('pointWinThreshold', Math.max(1, value))
  }

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6',
        p: '6',
        maxWidth: '800px',
        margin: '0 auto',
      })}
    >
      {lastError && (
        <div
          className={css({
            width: '100%',
            p: '4',
            bg: 'red.100',
            borderColor: 'red.400',
            borderWidth: '2px',
            borderRadius: 'md',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          })}
        >
          <span className={css({ color: 'red.800', fontWeight: 'semibold' })}>⚠️ {lastError}</span>
          <button
            type="button"
            onClick={clearError}
            className={css({
              px: '3',
              py: '1',
              bg: 'red.200',
              color: 'red.800',
              borderRadius: 'sm',
              fontWeight: 'semibold',
              cursor: 'pointer',
              _hover: { bg: 'red.300' },
            })}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className={css({ textAlign: 'center' })}>
        <h1 className={css({ fontSize: '3xl', fontWeight: 'bold', mb: '2' })}>Rithmomachia</h1>
        <p className={css({ color: 'gray.600', fontSize: 'lg' })}>The Battle of Numbers</p>
        <p className={css({ color: 'gray.500', fontSize: 'sm', mt: '2', maxWidth: '600px' })}>
          A medieval strategy game where pieces capture through mathematical relations. Win by
          achieving harmony (a mathematical progression) in enemy territory!
        </p>
      </div>

      {/* Game Settings */}
      <div
        className={css({
          width: '100%',
          bg: 'white',
          borderRadius: 'lg',
          p: '6',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        })}
      >
        <h2 className={css({ fontSize: 'xl', fontWeight: 'bold', mb: '4' })}>Game Rules</h2>

        <div className={css({ display: 'flex', flexDirection: 'column', gap: '4' })}>
          {/* Point Victory */}
          <div
            className={css({
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: '3',
              bg: 'gray.50',
              borderRadius: 'md',
            })}
          >
            <div>
              <div className={css({ fontWeight: 'semibold' })}>Point Victory</div>
              <div className={css({ fontSize: 'sm', color: 'gray.600' })}>
                Win by capturing pieces worth {state.pointWinThreshold} points
              </div>
            </div>
            <label className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
              <input
                type="checkbox"
                checked={state.pointWinEnabled}
                onChange={() => toggleSetting('pointWinEnabled')}
                className={css({ cursor: 'pointer', width: '18px', height: '18px' })}
              />
            </label>
          </div>

          {/* Point Threshold (only visible if point win enabled) */}
          {state.pointWinEnabled && (
            <div
              className={css({
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: '3',
                bg: 'purple.50',
                borderRadius: 'md',
                ml: '4',
              })}
            >
              <div className={css({ fontWeight: 'semibold' })}>Point Threshold</div>
              <input
                type="number"
                value={state.pointWinThreshold}
                onChange={(e) => updateThreshold(Number.parseInt(e.target.value, 10))}
                min="1"
                className={css({
                  width: '80px',
                  px: '3',
                  py: '2',
                  borderRadius: 'md',
                  border: '1px solid',
                  borderColor: 'purple.300',
                  textAlign: 'center',
                  fontSize: 'md',
                  fontWeight: 'semibold',
                })}
              />
            </div>
          )}

          {/* Threefold Repetition */}
          <div
            className={css({
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: '3',
              bg: 'gray.50',
              borderRadius: 'md',
            })}
          >
            <div>
              <div className={css({ fontWeight: 'semibold' })}>Threefold Repetition Draw</div>
              <div className={css({ fontSize: 'sm', color: 'gray.600' })}>
                Draw if same position occurs 3 times
              </div>
            </div>
            <label className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
              <input
                type="checkbox"
                checked={state.repetitionRule}
                onChange={() => toggleSetting('repetitionRule')}
                className={css({ cursor: 'pointer', width: '18px', height: '18px' })}
              />
            </label>
          </div>

          {/* Fifty Move Rule */}
          <div
            className={css({
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: '3',
              bg: 'gray.50',
              borderRadius: 'md',
            })}
          >
            <div>
              <div className={css({ fontWeight: 'semibold' })}>Fifty-Move Rule</div>
              <div className={css({ fontSize: 'sm', color: 'gray.600' })}>
                Draw if 50 moves with no capture or harmony
              </div>
            </div>
            <label className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
              <input
                type="checkbox"
                checked={state.fiftyMoveRule}
                onChange={() => toggleSetting('fiftyMoveRule')}
                className={css({ cursor: 'pointer', width: '18px', height: '18px' })}
              />
            </label>
          </div>

          {/* Harmony Persistence */}
          <div
            className={css({
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: '3',
              bg: 'gray.50',
              borderRadius: 'md',
            })}
          >
            <div>
              <div className={css({ fontWeight: 'semibold' })}>Flexible Harmony</div>
              <div className={css({ fontSize: 'sm', color: 'gray.600' })}>
                Allow any valid harmony for persistence (not just the declared one)
              </div>
            </div>
            <label className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
              <input
                type="checkbox"
                checked={state.allowAnySetOnRecheck}
                onChange={() => toggleSetting('allowAnySetOnRecheck')}
                className={css({ cursor: 'pointer', width: '18px', height: '18px' })}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Start Button */}
      <button
        type="button"
        onClick={startGame}
        className={css({
          px: '8',
          py: '4',
          bg: 'purple.600',
          color: 'white',
          borderRadius: 'lg',
          fontSize: 'lg',
          fontWeight: 'bold',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          _hover: {
            bg: 'purple.700',
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)',
          },
        })}
      >
        Start Game
      </button>
    </div>
  )
}

/**
 * Playing phase: main game board and controls.
 */
function PlayingPhase() {
  const { state, isMyTurn, lastError, clearError } = useRithmomachia()

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '4',
        p: '4',
      })}
    >
      {lastError && (
        <div
          className={css({
            width: '100%',
            p: '4',
            bg: 'red.100',
            borderColor: 'red.400',
            borderWidth: '2px',
            borderRadius: 'md',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          })}
        >
          <span className={css({ color: 'red.800', fontWeight: 'semibold' })}>⚠️ {lastError}</span>
          <button
            type="button"
            onClick={clearError}
            className={css({
              px: '3',
              py: '1',
              bg: 'red.200',
              color: 'red.800',
              borderRadius: 'sm',
              fontWeight: 'semibold',
              cursor: 'pointer',
              _hover: { bg: 'red.300' },
            })}
          >
            Dismiss
          </button>
        </div>
      )}

      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: '4',
          bg: 'gray.100',
          borderRadius: 'md',
        })}
      >
        <div>
          <span className={css({ fontWeight: 'bold' })}>Turn: </span>
          <span className={css({ color: state.turn === 'W' ? 'gray.800' : 'gray.600' })}>
            {state.turn === 'W' ? 'White' : 'Black'}
          </span>
        </div>
        {isMyTurn && (
          <div
            className={css({
              px: '3',
              py: '1',
              bg: 'green.100',
              color: 'green.800',
              borderRadius: 'md',
              fontSize: 'sm',
              fontWeight: 'semibold',
            })}
          >
            Your Turn
          </div>
        )}
      </div>

      <BoardDisplay />

      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4',
        })}
      >
        <div className={css({ p: '4', bg: 'gray.100', borderRadius: 'md' })}>
          <h3 className={css({ fontWeight: 'bold', mb: '2' })}>White Captured</h3>
          <div className={css({ fontSize: 'sm' })}>{state.capturedPieces.W.length} pieces</div>
        </div>
        <div className={css({ p: '4', bg: 'gray.100', borderRadius: 'md' })}>
          <h3 className={css({ fontWeight: 'bold', mb: '2' })}>Black Captured</h3>
          <div className={css({ fontSize: 'sm' })}>{state.capturedPieces.B.length} pieces</div>
        </div>
      </div>
    </div>
  )
}

/**
 * Animated piece component that smoothly transitions between squares.
 */
function AnimatedPiece({
  piece,
  gridSize,
}: {
  piece: Piece
  gridSize: { width: number; height: number }
}) {
  // Parse square to get column and row
  const file = piece.square.charCodeAt(0) - 65 // A=0, B=1, etc.
  const rank = Number.parseInt(piece.square.slice(1), 10) // 1-8

  // Calculate position (inverted rank for display: rank 8 = row 0)
  const col = file
  const row = 8 - rank

  // Animate position changes
  const spring = useSpring({
    left: `${(col / 16) * 100}%`,
    top: `${(row / 8) * 100}%`,
    config: { tension: 280, friction: 60 },
  })

  return (
    <animated.div
      style={{
        ...spring,
        position: 'absolute',
        width: `${100 / 16}%`,
        height: `${100 / 8}%`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <PieceRenderer
        type={piece.type}
        color={piece.color}
        value={piece.type === 'P' ? piece.pyramidFaces?.[0] || 0 : piece.value || 0}
        size={56}
      />
    </animated.div>
  )
}

/**
 * Board display component (simplified for v1).
 */
function BoardDisplay() {
  const { state, makeMove, playerColor, isMyTurn } = useRithmomachia()
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)

  const handleSquareClick = (square: string, piece: (typeof state.pieces)[string] | undefined) => {
    if (!isMyTurn) return

    // If no piece selected, select this piece if it's yours
    if (!selectedSquare) {
      if (piece && piece.color === playerColor) {
        setSelectedSquare(square)
      }
      return
    }

    // If clicking the same square, deselect
    if (selectedSquare === square) {
      setSelectedSquare(null)
      return
    }

    // If clicking another piece of yours, select that instead
    if (piece && piece.color === playerColor) {
      setSelectedSquare(square)
      return
    }

    // Otherwise, attempt to move
    const selectedPiece = Object.values(state.pieces).find(
      (p) => p.square === selectedSquare && !p.captured
    )
    if (selectedPiece) {
      // Simple move (no capture logic for now - just basic movement)
      makeMove(selectedSquare, square, selectedPiece.id)
      setSelectedSquare(null)
    }
  }

  // Get all active pieces
  const activePieces = Object.values(state.pieces).filter((p) => !p.captured)

  return (
    <div
      className={css({
        position: 'relative',
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
      })}
    >
      {/* Board grid */}
      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(16, 1fr)',
          gap: '1',
          bg: 'gray.300',
          p: '2',
          borderRadius: 'md',
          aspectRatio: '16/8',
        })}
      >
        {Array.from({ length: 8 }, (_, rank) => {
          const actualRank = 8 - rank
          return Array.from({ length: 16 }, (_, file) => {
            const square = `${String.fromCharCode(65 + file)}${actualRank}`
            const piece = Object.values(state.pieces).find(
              (p) => p.square === square && !p.captured
            )
            const isLight = (file + actualRank) % 2 === 0
            const isSelected = selectedSquare === square

            return (
              <div
                key={square}
                onClick={() => handleSquareClick(square, piece)}
                className={css({
                  bg: isSelected ? 'yellow.300' : isLight ? 'gray.100' : 'gray.200',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  fontSize: 'xs',
                  aspectRatio: '1',
                  position: 'relative',
                  cursor: isMyTurn ? 'pointer' : 'default',
                  _hover: isMyTurn
                    ? { bg: isSelected ? 'yellow.400' : isLight ? 'purple.100' : 'purple.200' }
                    : {},
                  border: isSelected ? '2px solid' : 'none',
                  borderColor: 'purple.600',
                })}
              />
            )
          })
        })}
      </div>

      {/* Animated pieces layer - matches board padding */}
      <div
        className={css({
          position: 'absolute',
          top: '0.5rem',
          left: '0.5rem',
          right: '0.5rem',
          bottom: '0.5rem',
          pointerEvents: 'none',
        })}
      >
        {activePieces.map((piece) => (
          <AnimatedPiece key={piece.id} piece={piece} gridSize={{ width: 16, height: 8 }} />
        ))}
      </div>
    </div>
  )
}

/**
 * Results phase: show winner and game summary.
 */
function ResultsPhase() {
  const { state, resetGame, goToSetup, exitSession, lastError, clearError } = useRithmomachia()
  const winnerText = state.winner === 'W' ? 'White' : 'Black'
  const totalMoves = state.history.length

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        gap: '4',
      })}
    >
      {lastError && (
        <div
          className={css({
            width: '100%',
            maxWidth: '600px',
            p: '4',
            bg: 'red.100',
            borderColor: 'red.400',
            borderWidth: '2px',
            borderRadius: 'md',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          })}
        >
          <span className={css({ color: 'red.800', fontWeight: 'semibold' })}>⚠️ {lastError}</span>
          <button
            type="button"
            onClick={clearError}
            className={css({
              px: '3',
              py: '1',
              bg: 'red.200',
              color: 'red.800',
              borderRadius: 'sm',
              fontWeight: 'semibold',
              cursor: 'pointer',
              _hover: { bg: 'red.300' },
            })}
          >
            Dismiss
          </button>
        </div>
      )}

      <h1 className={css({ fontSize: '3xl', fontWeight: 'bold' })}>Game Over</h1>

      {state.winner ? (
        <>
          <div className={css({ fontSize: '2xl', color: 'purple.600', fontWeight: 'semibold' })}>
            {winnerText} Wins!
          </div>
          <div className={css({ fontSize: 'lg', color: 'gray.600' })}>
            Victory by {state.winCondition?.toLowerCase().replace('_', ' ')}
          </div>
        </>
      ) : (
        <div className={css({ fontSize: '2xl', color: 'gray.600' })}>Draw</div>
      )}

      <div className={css({ display: 'flex', gap: '4', mt: '4' })}>
        <div className={css({ p: '4', bg: 'gray.100', borderRadius: 'md' })}>
          <div className={css({ fontWeight: 'bold' })}>White Captured</div>
          <div>{state.capturedPieces.W.length} pieces</div>
        </div>
        <div className={css({ p: '4', bg: 'gray.100', borderRadius: 'md' })}>
          <div className={css({ fontWeight: 'bold' })}>Black Captured</div>
          <div>{state.capturedPieces.B.length} pieces</div>
        </div>
      </div>

      {state.pointsCaptured && (
        <div className={css({ display: 'flex', gap: '4' })}>
          <div className={css({ p: '4', bg: 'purple.100', borderRadius: 'md' })}>
            <div className={css({ fontWeight: 'bold', color: 'purple.700' })}>White Points</div>
            <div className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>
              {state.pointsCaptured.W}
            </div>
          </div>
          <div className={css({ p: '4', bg: 'purple.100', borderRadius: 'md' })}>
            <div className={css({ fontWeight: 'bold', color: 'purple.700' })}>Black Points</div>
            <div className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>
              {state.pointsCaptured.B}
            </div>
          </div>
        </div>
      )}

      <div className={css({ fontSize: 'sm', color: 'gray.500', mt: '4' })}>
        Total moves: {totalMoves}
      </div>

      {/* Action Buttons */}
      <div
        className={css({
          display: 'flex',
          flexDirection: { base: 'column', sm: 'row' },
          gap: '3',
          mt: '6',
        })}
      >
        <button
          type="button"
          onClick={resetGame}
          className={css({
            px: '6',
            py: '3',
            bg: 'purple.600',
            color: 'white',
            borderRadius: 'md',
            fontWeight: 'semibold',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            _hover: {
              bg: 'purple.700',
              transform: 'translateY(-2px)',
            },
          })}
        >
          🎮 Play Again
        </button>

        <button
          type="button"
          onClick={goToSetup}
          className={css({
            px: '6',
            py: '3',
            bg: 'white',
            color: 'gray.700',
            border: '2px solid',
            borderColor: 'gray.300',
            borderRadius: 'md',
            fontWeight: 'semibold',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            _hover: {
              borderColor: 'gray.400',
              bg: 'gray.50',
            },
          })}
        >
          ⚙️ Settings
        </button>

        <button
          type="button"
          onClick={exitSession}
          className={css({
            px: '6',
            py: '3',
            bg: 'white',
            color: 'red.700',
            border: '2px solid',
            borderColor: 'red.300',
            borderRadius: 'md',
            fontWeight: 'semibold',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            _hover: {
              borderColor: 'red.400',
              bg: 'red.50',
            },
          })}
        >
          🚪 Exit
        </button>
      </div>
    </div>
  )
}
