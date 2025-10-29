'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { animated, useSpring } from '@react-spring/web'
import * as Tooltip from '@radix-ui/react-tooltip'
import { PageWithNav } from '@/components/PageWithNav'
import { StandardGameLayout } from '@/components/StandardGameLayout'
import { useFullscreen } from '@/contexts/FullscreenContext'
import { Z_INDEX } from '@/constants/zIndex'
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
 * Animated floating capture relation options
 */
function CaptureRelationOptions({
  targetPos,
  cellSize,
  gap,
  onSelectRelation,
  closing = false,
}: {
  targetPos: { x: number; y: number }
  cellSize: number
  gap: number
  onSelectRelation: (relation: string) => void
  closing?: boolean
}) {
  const relations = [
    { relation: 'EQUAL', label: '=', tooltip: 'Equality: a = b', angle: 0, color: '#8b5cf6' },
    {
      relation: 'MULTIPLE',
      label: '×n',
      tooltip: 'Multiple: b is multiple of a',
      angle: 51.4,
      color: '#a855f7',
    },
    {
      relation: 'DIVISOR',
      label: '÷',
      tooltip: 'Divisor: a divides b',
      angle: 102.8,
      color: '#c084fc',
    },
    {
      relation: 'SUM',
      label: '+',
      tooltip: 'Sum: a + h = b (helper)',
      angle: 154.3,
      color: '#3b82f6',
    },
    {
      relation: 'DIFF',
      label: '−',
      tooltip: 'Difference: |a - h| = b (helper)',
      angle: 205.7,
      color: '#06b6d4',
    },
    {
      relation: 'PRODUCT',
      label: '×',
      tooltip: 'Product: a × h = b (helper)',
      angle: 257.1,
      color: '#10b981',
    },
    {
      relation: 'RATIO',
      label: '÷÷',
      tooltip: 'Ratio: a/h = b/h (helper)',
      angle: 308.6,
      color: '#f59e0b',
    },
  ]

  const maxRadius = cellSize * 1.2
  const buttonSize = 64

  // Animate all buttons simultaneously - reverse animation when closing
  const spring = useSpring({
    from: { radius: 0, opacity: 0 },
    radius: closing ? 0 : maxRadius,
    opacity: closing ? 0 : 0.85,
    config: { tension: 280, friction: 20 },
  })

  return (
    <Tooltip.Provider delayDuration={0} disableHoverableContent>
      <g>
        {relations.map(({ relation, label, tooltip, angle, color }) => {
          const rad = (angle * Math.PI) / 180

          return (
            <animated.g
              key={relation}
              transform={spring.radius.to(
                (r) =>
                  `translate(${targetPos.x + Math.cos(rad) * r}, ${targetPos.y + Math.sin(rad) * r})`
              )}
            >
              <foreignObject
                x={-buttonSize / 2}
                y={-buttonSize / 2}
                width={buttonSize}
                height={buttonSize}
                style={{ overflow: 'visible' }}
              >
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <animated.button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectRelation(relation)
                      }}
                      style={{
                        width: buttonSize,
                        height: buttonSize,
                        borderRadius: '50%',
                        border: '3px solid rgba(255, 255, 255, 0.9)',
                        backgroundColor: color,
                        color: 'white',
                        fontSize: '28px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: spring.opacity,
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.15)'
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
                      }}
                    >
                      {label}
                    </animated.button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content asChild sideOffset={8}>
                      <div
                        style={{
                          background: 'rgba(0,0,0,0.95)',
                          color: 'white',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 600,
                          maxWidth: '240px',
                          zIndex: 10000,
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                          pointerEvents: 'none',
                        }}
                      >
                        {tooltip}
                        <Tooltip.Arrow
                          style={{
                            fill: 'rgba(0,0,0,0.95)',
                          }}
                        />
                      </div>
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </foreignObject>
            </animated.g>
          )
        })}
      </g>
    </Tooltip.Provider>
  )
}

/**
 * Render a piece within SVG coordinates
 */
function SvgPiece({
  piece,
  cellSize,
  padding,
}: {
  piece: Piece
  cellSize: number
  padding: number
}) {
  const file = piece.square.charCodeAt(0) - 65 // A=0
  const rank = Number.parseInt(piece.square.slice(1), 10) // 1-8
  const row = 8 - rank // Invert for display

  const x = padding + file * cellSize
  const y = padding + row * cellSize

  const spring = useSpring({
    x,
    y,
    config: { tension: 280, friction: 60 },
  })

  const pieceSize = cellSize * 0.85

  return (
    <animated.g transform={spring.x.to((xVal) => `translate(${xVal}, ${spring.y.get()})`)}>
      <foreignObject x={0} y={0} width={cellSize} height={cellSize}>
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PieceRenderer
            type={piece.type}
            color={piece.color}
            value={piece.type === 'P' ? piece.pyramidFaces?.[0] || 0 : piece.value || 0}
            size={pieceSize}
          />
        </div>
      </foreignObject>
    </animated.g>
  )
}

/**
 * Board display component (simplified for v1).
 */
function BoardDisplay() {
  const { state, makeMove, playerColor, isMyTurn } = useRithmomachia()
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [captureDialogOpen, setCaptureDialogOpen] = useState(false)
  const [closingDialog, setClosingDialog] = useState(false)
  const [captureTarget, setCaptureTarget] = useState<{
    from: string
    to: string
    pieceId: string
  } | null>(null)
  const [hoveredRelation, setHoveredRelation] = useState<string | null>(null)

  // Handle closing animation completion
  useEffect(() => {
    if (closingDialog) {
      // Wait for animation to complete (400ms allows spring to fully settle)
      const timer = setTimeout(() => {
        setCaptureDialogOpen(false)
        setCaptureTarget(null)
        setClosingDialog(false)
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [closingDialog])

  // Function to dismiss the dialog with animation
  const dismissDialog = () => {
    setClosingDialog(true)
  }

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
      // If target square has an enemy piece, open capture dialog
      if (piece && piece.color !== playerColor) {
        setCaptureTarget({ from: selectedSquare, to: square, pieceId: selectedPiece.id })
        setCaptureDialogOpen(true)
      } else {
        // Simple move (no capture)
        makeMove(selectedSquare, square, selectedPiece.id)
        setSelectedSquare(null)
      }
    }
  }

  const handleCaptureWithRelation = (relation: string) => {
    if (captureTarget) {
      // Get target piece ID
      const targetPiece = Object.values(state.pieces).find(
        (p) => p.square === captureTarget.to && !p.captured
      )
      if (!targetPiece) return

      const captureData = {
        relation: relation as any, // RelationKind
        targetPieceId: targetPiece.id,
        // TODO: For relations that require helpers (SUM, DIFF, PRODUCT, RATIO),
        // we need to add UI for selecting helper pieces. For now, just try without helper.
      }

      makeMove(captureTarget.from, captureTarget.to, captureTarget.pieceId, undefined, captureData)
      setCaptureDialogOpen(false)
      setCaptureTarget(null)
      setSelectedSquare(null)
    }
  }

  // Get all active pieces
  const activePieces = Object.values(state.pieces).filter((p) => !p.captured)

  // SVG dimensions
  const cols = 16
  const rows = 8
  const cellSize = 100 // SVG units per cell
  const gap = 2
  const padding = 10
  const boardWidth = cols * cellSize + (cols - 1) * gap + padding * 2
  const boardHeight = rows * cellSize + (rows - 1) * gap + padding * 2

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isMyTurn) return

    // If capture dialog is open, dismiss it with animation on any click (buttons have stopPropagation)
    if (captureDialogOpen && !closingDialog) {
      dismissDialog()
      return
    }

    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * boardWidth - padding
    const y = ((e.clientY - rect.top) / rect.height) * boardHeight - padding

    // Convert to grid coordinates
    const col = Math.floor(x / (cellSize + gap))
    const row = Math.floor(y / (cellSize + gap))

    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      const square = `${String.fromCharCode(65 + col)}${8 - row}`
      const piece = Object.values(state.pieces).find((p) => p.square === square && !p.captured)
      handleSquareClick(square, piece)
    }
  }

  // Calculate target square position for floating capture options
  const getTargetSquarePosition = () => {
    if (!captureTarget) return null
    const file = captureTarget.to.charCodeAt(0) - 65
    const rank = Number.parseInt(captureTarget.to.slice(1), 10)
    const row = 8 - rank
    const x = padding + file * (cellSize + gap) + cellSize / 2
    const y = padding + row * (cellSize + gap) + cellSize / 2
    return { x, y }
  }

  const targetPos = getTargetSquarePosition()

  return (
    <div
      className={css({
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        position: 'relative',
        zIndex: Z_INDEX.GAME.OVERLAY,
      })}
    >
      {/* Unified SVG Board */}
      <svg
        viewBox={`0 0 ${boardWidth} ${boardHeight}`}
        className={css({
          width: '100%',
          cursor: isMyTurn ? 'pointer' : 'default',
          overflow: 'visible',
        })}
        onClick={handleSvgClick}
      >
        {/* Board background */}
        <rect x={0} y={0} width={boardWidth} height={boardHeight} fill="#d1d5db" rx={8} />

        {/* Board squares */}
        {Array.from({ length: rows }, (_, row) => {
          const actualRank = 8 - row
          return Array.from({ length: cols }, (_, col) => {
            const square = `${String.fromCharCode(65 + col)}${actualRank}`
            const piece = Object.values(state.pieces).find(
              (p) => p.square === square && !p.captured
            )
            const isLight = (col + actualRank) % 2 === 0
            const isSelected = selectedSquare === square

            const x = padding + col * (cellSize + gap)
            const y = padding + row * (cellSize + gap)

            return (
              <rect
                key={square}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                fill={isSelected ? '#fde047' : isLight ? '#f3f4f6' : '#e5e7eb'}
                stroke={isSelected ? '#9333ea' : 'none'}
                strokeWidth={isSelected ? 2 : 0}
              />
            )
          })
        })}

        {/* Pieces */}
        {activePieces.map((piece) => (
          <SvgPiece key={piece.id} piece={piece} cellSize={cellSize + gap} padding={padding} />
        ))}

        {/* Floating capture relation options */}
        {captureDialogOpen && targetPos && (
          <CaptureRelationOptions
            targetPos={targetPos}
            cellSize={cellSize}
            gap={gap}
            onSelectRelation={handleCaptureWithRelation}
            closing={closingDialog}
          />
        )}
      </svg>
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
