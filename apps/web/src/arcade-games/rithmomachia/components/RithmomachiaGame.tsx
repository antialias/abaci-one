'use client'

import * as Tooltip from '@radix-ui/react-tooltip'
import { animated, to, useSpring } from '@react-spring/web'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import type { PlayerBadge } from '@/components/nav/types'
import { StandardGameLayout } from '@/components/StandardGameLayout'
import { Z_INDEX } from '@/constants/zIndex'
import { useGameMode } from '@/contexts/GameModeContext'
import { useFullscreen } from '@/contexts/FullscreenContext'
import { css } from '../../../../styled-system/css'
import { useRithmomachia } from '../Provider'
import type { Piece, RelationKind, RithmomachiaConfig } from '../types'
import { validateMove } from '../utils/pathValidator'
import { getEffectiveValue } from '../utils/pieceSetup'
import {
  checkDiff,
  checkDivisor,
  checkEqual,
  checkMultiple,
  checkProduct,
  checkRatio,
  checkSum,
} from '../utils/relationEngine'
import { PieceRenderer } from './PieceRenderer'

/**
 * Error notification when no capture is possible
 */
function CaptureErrorDialog({
  targetPos,
  cellSize,
  onClose,
  closing,
}: {
  targetPos: { x: number; y: number }
  cellSize: number
  onClose: () => void
  closing: boolean
}) {
  const entranceSpring = useSpring({
    from: { opacity: 0, y: -20 },
    opacity: closing ? 0 : 1,
    y: closing ? -20 : 0,
    config: { tension: 300, friction: 25 },
  })

  return (
    <animated.g
      style={{
        opacity: entranceSpring.opacity,
      }}
      transform={to([entranceSpring.y], (y) => `translate(${targetPos.x}, ${targetPos.y + y})`)}
    >
      <foreignObject
        x={-cellSize * 1.8}
        y={-cellSize * 0.5}
        width={cellSize * 3.6}
        height={cellSize}
        style={{ overflow: 'visible' }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: '#f1f5f9',
            padding: `${cellSize * 0.12}px ${cellSize * 0.18}px`,
            borderRadius: `${cellSize * 0.12}px`,
            fontSize: `${cellSize * 0.16}px`,
            fontWeight: 500,
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: `${cellSize * 0.15}px`,
            backdropFilter: 'blur(8px)',
            letterSpacing: '0.01em',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: `${cellSize * 0.1}px`,
              flex: 1,
            }}
          >
            <span
              style={{
                fontSize: `${cellSize * 0.2}px`,
                opacity: 0.7,
              }}
            >
              ⚠
            </span>
            <span>No valid relation</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            style={{
              padding: `${cellSize * 0.06}px ${cellSize * 0.12}px`,
              borderRadius: `${cellSize * 0.08}px`,
              border: 'none',
              background: 'rgba(148, 163, 184, 0.2)',
              color: '#cbd5e1',
              fontSize: `${cellSize * 0.13}px`,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(148, 163, 184, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(148, 163, 184, 0.2)'
            }}
          >
            OK
          </button>
        </div>
      </foreignObject>
    </animated.g>
  )
}

/**
 * Main Rithmomachia game component.
 * Orchestrates the game phases and UI.
 */
export function RithmomachiaGame() {
  const router = useRouter()
  const { state, resetGame, goToSetup, whitePlayerId, blackPlayerId } = useRithmomachia()
  const { setFullscreenElement } = useFullscreen()
  const gameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Register this component's main div as the fullscreen element
    if (gameRef.current) {
      setFullscreenElement(gameRef.current)
    }
  }, [setFullscreenElement])

  const currentPlayerId = useMemo(() => {
    if (state.turn === 'W') {
      return whitePlayerId ?? undefined
    }
    if (state.turn === 'B') {
      return blackPlayerId ?? undefined
    }
    return undefined
  }, [state.turn, whitePlayerId, blackPlayerId])

  const playerBadges = useMemo<Record<string, PlayerBadge>>(() => {
    const badges: Record<string, PlayerBadge> = {}
    if (whitePlayerId) {
      badges[whitePlayerId] = {
        label: 'White',
        icon: '⚪',
        background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.95), rgba(226, 232, 240, 0.9))',
        color: '#0f172a',
        borderColor: 'rgba(226, 232, 240, 0.8)',
        shadowColor: 'rgba(148, 163, 184, 0.35)',
      }
    }
    if (blackPlayerId) {
      badges[blackPlayerId] = {
        label: 'Black',
        icon: '⚫',
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.92), rgba(15, 23, 42, 0.94))',
        color: '#f8fafc',
        borderColor: 'rgba(30, 41, 59, 0.9)',
        shadowColor: 'rgba(15, 23, 42, 0.45)',
      }
    }
    return badges
  }, [whitePlayerId, blackPlayerId])

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
      currentPlayerId={currentPlayerId}
      playerBadges={playerBadges}
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

function RosterStatusNotice({ phase }: { phase: 'setup' | 'playing' }) {
  const { rosterStatus, whitePlayerId, blackPlayerId } = useRithmomachia()
  const { players: playerMap, activePlayers: activePlayerIds, addPlayer, setActive } = useGameMode()

  const playersArray = useMemo(() => {
    const list = Array.from(playerMap.values())
    return list.sort((a, b) => {
      const aTime =
        typeof a.createdAt === 'number'
          ? a.createdAt
          : a.createdAt instanceof Date
            ? a.createdAt.getTime()
            : 0
      const bTime =
        typeof b.createdAt === 'number'
          ? b.createdAt
          : b.createdAt instanceof Date
            ? b.createdAt.getTime()
            : 0
      return aTime - bTime
    })
  }, [playerMap])

  const inactiveLocalPlayer = useMemo(
    () =>
      playersArray.find(
        (player) => player.isLocal !== false && !activePlayerIds.has(player.id)
      ) || null,
    [playersArray, activePlayerIds]
  )

  const removableLocalPlayer = useMemo(
    () =>
      playersArray.find(
        (player) =>
          player.isLocal !== false &&
          activePlayerIds.has(player.id) &&
          player.id !== whitePlayerId &&
          player.id !== blackPlayerId
      ) || null,
    [playersArray, activePlayerIds, whitePlayerId, blackPlayerId]
  )

  const quickFix = useMemo(() => {
    if (rosterStatus.status === 'tooFew') {
      if (inactiveLocalPlayer) {
        return {
          label: `Activate ${inactiveLocalPlayer.name}`,
          action: () => setActive(inactiveLocalPlayer.id, true),
        }
      }

      return {
        label: 'Create local player',
        action: () => addPlayer({ isActive: true }),
      }
    }

    if (rosterStatus.status === 'noLocalControl') {
      if (inactiveLocalPlayer) {
        return {
          label: `Activate ${inactiveLocalPlayer.name}`,
          action: () => setActive(inactiveLocalPlayer.id, true),
        }
      }

      return null
    }

    if (rosterStatus.status === 'tooMany' && removableLocalPlayer) {
      return {
        label: `Deactivate ${removableLocalPlayer.name}`,
        action: () => setActive(removableLocalPlayer.id, false),
      }
    }

    return null
  }, [rosterStatus.status, inactiveLocalPlayer, removableLocalPlayer, addPlayer, setActive])

  const heading = useMemo(() => {
    switch (rosterStatus.status) {
      case 'tooFew':
        return 'Need two active players'
      case 'tooMany':
        return 'Too many active players'
      case 'noLocalControl':
        return 'Join the roster from this device'
      default:
        return ''
    }
  }, [rosterStatus.status])

  const description = useMemo(() => {
    switch (rosterStatus.status) {
      case 'tooFew':
        return phase === 'setup'
          ? 'Rithmomachia needs exactly two active players before the match can begin. Use the roster controls in the game nav to activate or add another player.'
          : 'Gameplay is paused until two players are active. Use the roster controls in the game nav to activate or add another player and resume the match.'
      case 'tooMany':
        return 'Rithmomachia supports only two active players. Use the game nav roster to deactivate extras so each color has exactly one seat.'
      case 'noLocalControl':
        return phase === 'setup'
          ? 'All active seats belong to other devices. Activate a local player from the game nav if you want to start from this computer.'
          : 'All active seats belong to other devices. Activate a local player in the game nav if you want to make moves from this computer.'
      default:
        return ''
    }
  }, [phase, rosterStatus.status])

  if (rosterStatus.status === 'ok') {
    return null
  }

  return (
    <div
      className={css({
        width: '100%',
        borderWidth: '2px',
        borderColor: 'amber.400',
        backgroundColor: 'amber.50',
        color: 'amber.900',
        p: '4',
        borderRadius: 'md',
        display: 'flex',
        flexDirection: { base: 'column', md: 'row' },
        gap: '3',
        justifyContent: 'space-between',
        alignItems: { base: 'flex-start', md: 'center' },
      })}
    >
      <div>
        <h3 className={css({ fontWeight: 'bold', fontSize: 'lg' })}>{heading}</h3>
        <p className={css({ fontSize: 'sm', lineHeight: '1.5', mt: '1' })}>{description}</p>
      </div>
      {quickFix && (
        <button
          type="button"
          onClick={quickFix.action}
          className={css({
            px: '3',
            py: '2',
            bg: 'amber.500',
            color: 'white',
            borderRadius: 'md',
            fontWeight: 'semibold',
            fontSize: 'sm',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            _hover: { bg: 'amber.600' },
            flexShrink: 0,
          })}
        >
          {quickFix.label}
        </button>
      )}
    </div>
  )
}

/**
 * Setup phase: game configuration and start button.
 */
function SetupPhase() {
  const { state, startGame, setConfig, lastError, clearError, rosterStatus } = useRithmomachia()
  const startDisabled = rosterStatus.status !== 'ok'

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

      <RosterStatusNotice phase="setup" />

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
        disabled={startDisabled}
        className={css({
          px: '8',
          py: '4',
          bg: startDisabled ? 'gray.400' : 'purple.600',
          color: 'white',
          borderRadius: 'lg',
          fontSize: 'lg',
          fontWeight: 'bold',
          cursor: startDisabled ? 'not-allowed' : 'pointer',
          opacity: startDisabled ? 0.7 : 1,
          transition: 'all 0.2s ease',
          _hover: startDisabled
            ? undefined
            : {
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
  const { state, isMyTurn, lastError, clearError, rosterStatus } = useRithmomachia()

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

      <RosterStatusNotice phase="playing" />

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
        {!isMyTurn && rosterStatus.status === 'ok' && (
          <div
            className={css({
              px: '3',
              py: '1',
              bg: 'gray.200',
              color: 'gray.700',
              borderRadius: 'md',
              fontSize: 'sm',
              fontWeight: 'semibold',
            })}
          >
            Waiting for {state.turn === 'W' ? 'White' : 'Black'}
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
 * Single animated helper piece
 */
function AnimatedHelperPiece({
  piece,
  boardPos,
  ringX,
  ringY,
  cellSize,
  onSelectHelper,
  closing,
  onHover,
}: {
  piece: Piece
  boardPos: { x: number; y: number }
  ringX: number
  ringY: number
  cellSize: number
  onSelectHelper: (pieceId: string) => void
  closing: boolean
  onHover?: (pieceId: string | null) => void
}) {
  console.log(
    `[AnimatedHelperPiece] Rendering piece ${piece.id}: boardPos=(${boardPos.x}, ${boardPos.y}), ringPos=(${ringX}, ${ringY}), closing=${closing}`
  )

  // Animate from board position to ring position
  const spring = useSpring({
    from: { x: boardPos.x, y: boardPos.y, opacity: 0 },
    x: closing ? boardPos.x : ringX,
    y: closing ? boardPos.y : ringY,
    opacity: closing ? 0 : 1,
    config: { tension: 280, friction: 20 },
  })

  console.log(
    `[AnimatedHelperPiece] Spring config for ${piece.id}: from=(${boardPos.x}, ${boardPos.y}), to=(${closing ? boardPos.x : ringX}, ${closing ? boardPos.y : ringY})`
  )

  const value = getEffectiveValue(piece)
  if (value === undefined || value === null) return null

  return (
    <animated.g
      style={{
        opacity: spring.opacity,
        cursor: 'pointer',
      }}
      transform={to([spring.x, spring.y], (x, y) => `translate(${x}, ${y})`)}
      onClick={(e) => {
        e.stopPropagation()
        onSelectHelper(piece.id)
      }}
      onMouseEnter={() => onHover?.(piece.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      {/* Render the actual piece with a highlight ring */}
      <circle
        cx={0}
        cy={0}
        r={cellSize * 0.5}
        fill="rgba(250, 204, 21, 0.3)"
        stroke="rgba(250, 204, 21, 0.9)"
        strokeWidth={4}
      />
      <g transform={`translate(${-cellSize / 2}, ${-cellSize / 2})`}>
        <PieceRenderer type={piece.type} color={piece.color} value={value} size={cellSize} />
      </g>
    </animated.g>
  )
}

/**
 * Helper piece selection - pieces fly from board to selection ring
 * Hovering over a helper shows a preview of the number bond
 */
function HelperSelectionOptions({
  helpers,
  targetPos,
  cellSize,
  gap,
  padding,
  onSelectHelper,
  closing = false,
  moverPiece,
  targetPiece,
  relation,
}: {
  helpers: Array<{ piece: Piece; boardPos: { x: number; y: number } }>
  targetPos: { x: number; y: number }
  cellSize: number
  gap: number
  padding: number
  onSelectHelper: (pieceId: string) => void
  closing?: boolean
  moverPiece: Piece
  targetPiece: Piece
  relation: RelationKind
}) {
  const [hoveredHelperId, setHoveredHelperId] = useState<string | null>(null)
  const maxRadius = cellSize * 1.2
  const angleStep = helpers.length > 1 ? 360 / helpers.length : 0

  console.log('[HelperSelectionOptions] targetPos:', targetPos)
  console.log('[HelperSelectionOptions] cellSize:', cellSize)
  console.log('[HelperSelectionOptions] maxRadius:', maxRadius)
  console.log('[HelperSelectionOptions] angleStep:', angleStep)
  console.log('[HelperSelectionOptions] helpers.length:', helpers.length)

  // Find the hovered helper and its ring position
  const hoveredHelperData = helpers.find((h) => h.piece.id === hoveredHelperId)
  const hoveredHelperIndex = helpers.findIndex((h) => h.piece.id === hoveredHelperId)
  let hoveredHelperRingPos = null
  if (hoveredHelperIndex !== -1) {
    const angle = hoveredHelperIndex * angleStep
    const rad = (angle * Math.PI) / 180
    hoveredHelperRingPos = {
      x: targetPos.x + Math.cos(rad) * maxRadius,
      y: targetPos.y + Math.sin(rad) * maxRadius,
    }
  }

  // Color scheme based on relation type
  const colorMap: Record<RelationKind, string> = {
    SUM: '#ef4444', // red
    DIFF: '#f97316', // orange
    PRODUCT: '#8b5cf6', // purple
    RATIO: '#3b82f6', // blue
    EQUAL: '#10b981', // green
    MULTIPLE: '#eab308', // yellow
    DIVISOR: '#06b6d4', // cyan
  }
  const color = colorMap[relation] || '#6b7280'

  // Operator symbols
  const operatorMap: Record<RelationKind, string> = {
    SUM: '+',
    DIFF: '−',
    PRODUCT: '×',
    RATIO: '÷',
    EQUAL: '=',
    MULTIPLE: '×',
    DIVISOR: '÷',
  }
  const operator = operatorMap[relation] || '?'

  return (
    <g>
      {helpers.map(({ piece, boardPos }, index) => {
        const angle = index * angleStep
        const rad = (angle * Math.PI) / 180

        // Target position in ring
        const ringX = targetPos.x + Math.cos(rad) * maxRadius
        const ringY = targetPos.y + Math.sin(rad) * maxRadius

        console.log(
          `[HelperSelectionOptions] piece ${piece.id} (${piece.square}): index=${index}, angle=${angle}°, boardPos=(${boardPos.x}, ${boardPos.y}), ringPos=(${ringX}, ${ringY})`
        )

        return (
          <AnimatedHelperPiece
            key={piece.id}
            piece={piece}
            boardPos={boardPos}
            ringX={ringX}
            ringY={ringY}
            cellSize={cellSize}
            onSelectHelper={onSelectHelper}
            closing={closing}
            onHover={setHoveredHelperId}
          />
        )
      })}

      {/* Show number bond preview when hovering over a helper - draw triangle between actual pieces */}
      {hoveredHelperData && hoveredHelperRingPos && (
        <g>
          {(() => {
            // Use actual positions of all three pieces
            const helperPos = hoveredHelperRingPos // Helper is in the ring
            const moverBoardPos = hoveredHelperData.boardPos // Mover is on the board at its current position
            const targetBoardPos = targetPos // Target is on the board at capture position

            // Calculate positions from square coordinates
            const file = moverPiece.square.charCodeAt(0) - 65
            const rank = Number.parseInt(moverPiece.square.slice(1), 10)
            const row = 8 - rank
            const moverPos = {
              x: padding + file * (cellSize + gap) + cellSize / 2,
              y: padding + row * (cellSize + gap) + cellSize / 2,
            }

            const targetFile = targetPiece.square.charCodeAt(0) - 65
            const targetRank = Number.parseInt(targetPiece.square.slice(1), 10)
            const targetRow = 8 - targetRank
            const targetBoardPosition = {
              x: padding + targetFile * (cellSize + gap) + cellSize / 2,
              y: padding + targetRow * (cellSize + gap) + cellSize / 2,
            }

            return (
              <>
                {/* Triangle connecting lines between actual piece positions */}
                <g opacity={0.5}>
                  <line
                    x1={moverPos.x}
                    y1={moverPos.y}
                    x2={helperPos.x}
                    y2={helperPos.y}
                    stroke={color}
                    strokeWidth={4}
                  />
                  <line
                    x1={moverPos.x}
                    y1={moverPos.y}
                    x2={targetBoardPosition.x}
                    y2={targetBoardPosition.y}
                    stroke={color}
                    strokeWidth={4}
                  />
                  <line
                    x1={helperPos.x}
                    y1={helperPos.y}
                    x2={targetBoardPosition.x}
                    y2={targetBoardPosition.y}
                    stroke={color}
                    strokeWidth={4}
                  />
                </g>

                {/* Operator symbol in center of triangle */}
                <text
                  x={(moverPos.x + helperPos.x + targetBoardPosition.x) / 3}
                  y={(moverPos.y + helperPos.y + targetBoardPosition.y) / 3}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={color}
                  fontSize={cellSize * 0.8}
                  fontWeight="900"
                  fontFamily="Georgia, 'Times New Roman', serif"
                  opacity={0.9}
                >
                  {operator}
                </text>

                {/* No cloned pieces - using actual pieces already on board/ring */}
              </>
            )
          })()}
        </g>
      )}
    </g>
  )
}

/**
 * Number Bond Visualization - uses actual piece positions for smooth rotation/collapse
 * Pieces start at their actual positions (mover on board, helper in ring, target on board)
 * Animation: Rotate and collapse to target position, only mover remains
 */
function NumberBondVisualization({
  moverPiece,
  helperPiece,
  targetPiece,
  relation,
  targetPos,
  cellSize,
  onConfirm,
  closing = false,
  autoAnimate = true,
  moverStartPos,
  helperStartPos,
  padding,
  gap,
}: {
  moverPiece: Piece
  helperPiece: Piece
  targetPiece: Piece
  relation: RelationKind
  targetPos: { x: number; y: number }
  cellSize: number
  onConfirm: () => void
  closing?: boolean
  autoAnimate?: boolean
  moverStartPos: { x: number; y: number }
  helperStartPos: { x: number; y: number }
  padding: number
  gap: number
}) {
  const [animating, setAnimating] = useState(false)

  // Auto-trigger animation immediately when component mounts (after helper selection)
  useEffect(() => {
    if (!autoAnimate) return
    const timer = setTimeout(() => {
      setAnimating(true)
    }, 300) // Short delay to show the triangle briefly
    return () => clearTimeout(timer)
  }, [autoAnimate])

  // Color scheme based on relation type
  const colorMap: Record<RelationKind, string> = {
    SUM: '#ef4444', // red
    DIFF: '#f97316', // orange
    PRODUCT: '#8b5cf6', // purple
    RATIO: '#3b82f6', // blue
    EQUAL: '#10b981', // green
    MULTIPLE: '#eab308', // yellow
    DIVISOR: '#06b6d4', // cyan
  }
  const color = colorMap[relation] || '#6b7280'

  // Operation symbol based on relation
  const operatorMap: Record<RelationKind, string> = {
    SUM: '+',
    DIFF: '−',
    PRODUCT: '×',
    RATIO: '÷',
    EQUAL: '=',
    MULTIPLE: '×',
    DIVISOR: '÷',
  }
  const operator = operatorMap[relation]

  // Calculate actual board position for target
  const targetFile = targetPiece.square.charCodeAt(0) - 65
  const targetRank = Number.parseInt(targetPiece.square.slice(1), 10)
  const targetRow = 8 - targetRank
  const targetBoardPos = {
    x: padding + targetFile * (cellSize + gap) + cellSize / 2,
    y: padding + targetRow * (cellSize + gap) + cellSize / 2,
  }

  // Animation: Rotate and collapse from actual positions to target
  const captureAnimation = useSpring({
    from: { rotation: 0, progress: 0, opacity: 1 },
    rotation: animating ? Math.PI * 20 : 0, // 10 full rotations
    progress: animating ? 1 : 0, // 0 = at start positions, 1 = at target position
    opacity: animating ? 0 : 1,
    config: animating ? { duration: 2500 } : { tension: 280, friction: 20 },
    onRest: () => {
      if (animating) {
        onConfirm()
      }
    },
  })

  // Get piece values
  const getMoverValue = () => getEffectiveValue(moverPiece)
  const getHelperValue = () => getEffectiveValue(helperPiece)
  const getTargetValue = () => getEffectiveValue(targetPiece)

  return (
    <g>
      {/* Triangle connecting lines between actual piece positions - fade during animation */}
      <animated.g opacity={to([captureAnimation.opacity], (op) => (animating ? op * 0.5 : 0.5))}>
        <line
          x1={moverStartPos.x}
          y1={moverStartPos.y}
          x2={helperStartPos.x}
          y2={helperStartPos.y}
          stroke={color}
          strokeWidth={4}
        />
        <line
          x1={moverStartPos.x}
          y1={moverStartPos.y}
          x2={targetBoardPos.x}
          y2={targetBoardPos.y}
          stroke={color}
          strokeWidth={4}
        />
        <line
          x1={helperStartPos.x}
          y1={helperStartPos.y}
          x2={targetBoardPos.x}
          y2={targetBoardPos.y}
          stroke={color}
          strokeWidth={4}
        />
      </animated.g>

      {/* Operator symbol in center of triangle - fade during animation */}
      <animated.text
        x={(moverStartPos.x + helperStartPos.x + targetBoardPos.x) / 3}
        y={(moverStartPos.y + helperStartPos.y + targetBoardPos.y) / 3}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={cellSize * 0.8}
        fontWeight="900"
        fontFamily="Georgia, 'Times New Roman', serif"
        opacity={to([captureAnimation.opacity], (op) => (animating ? op * 0.9 : 0.9))}
      >
        {operator}
      </animated.text>

      {/* Mover piece - starts at board position, spirals to target, STAYS VISIBLE */}
      <animated.g
        transform={to([captureAnimation.rotation, captureAnimation.progress], (rot, prog) => {
          // Interpolate from start position to target position
          const x = moverStartPos.x + (targetBoardPos.x - moverStartPos.x) * prog
          const y = moverStartPos.y + (targetBoardPos.y - moverStartPos.y) * prog

          // Add spiral rotation around the interpolated center
          const spiralRadius = (1 - prog) * cellSize * 0.5
          const spiralX = x + Math.cos(rot) * spiralRadius
          const spiralY = y + Math.sin(rot) * spiralRadius

          return `translate(${spiralX}, ${spiralY})`
        })}
        opacity={1} // Mover stays fully visible
      >
        <g transform={`translate(${-cellSize / 2}, ${-cellSize / 2})`}>
          <PieceRenderer
            type={moverPiece.type}
            color={moverPiece.color}
            value={getMoverValue() || 0}
            size={cellSize}
          />
        </g>
      </animated.g>

      {/* Helper piece - starts in ring, spirals to target, FADES OUT */}
      <animated.g
        transform={to([captureAnimation.rotation, captureAnimation.progress], (rot, prog) => {
          const x = helperStartPos.x + (targetBoardPos.x - helperStartPos.x) * prog
          const y = helperStartPos.y + (targetBoardPos.y - helperStartPos.y) * prog

          const spiralRadius = (1 - prog) * cellSize * 0.5
          const angle = rot + (Math.PI * 2) / 3 // Offset by 120°
          const spiralX = x + Math.cos(angle) * spiralRadius
          const spiralY = y + Math.sin(angle) * spiralRadius

          return `translate(${spiralX}, ${spiralY})`
        })}
        opacity={to([captureAnimation.opacity], (op) => (animating ? op : 1))}
      >
        <g transform={`translate(${-cellSize / 2}, ${-cellSize / 2})`}>
          <PieceRenderer
            type={helperPiece.type}
            color={helperPiece.color}
            value={getHelperValue() || 0}
            size={cellSize}
          />
        </g>
      </animated.g>

      {/* Target piece - stays at board position, spirals in place, FADES OUT */}
      <animated.g
        transform={to([captureAnimation.rotation, captureAnimation.progress], (rot, prog) => {
          const x = targetBoardPos.x
          const y = targetBoardPos.y

          const spiralRadius = (1 - prog) * cellSize * 0.5
          const angle = rot + (Math.PI * 4) / 3 // Offset by 240°
          const spiralX = x + Math.cos(angle) * spiralRadius
          const spiralY = y + Math.sin(angle) * spiralRadius

          return `translate(${spiralX}, ${spiralY})`
        })}
        opacity={to([captureAnimation.opacity], (op) => (animating ? op : 1))}
      >
        <g transform={`translate(${-cellSize / 2}, ${-cellSize / 2})`}>
          <PieceRenderer
            type={targetPiece.type}
            color={targetPiece.color}
            value={getTargetValue() || 0}
            size={cellSize}
          />
        </g>
      </animated.g>
    </g>
  )
}

/**
 * Animated floating capture relation options with number bond preview on hover
 */
function CaptureRelationOptions({
  targetPos,
  cellSize,
  gap,
  padding,
  onSelectRelation,
  closing = false,
  availableRelations,
  moverPiece,
  targetPiece,
  allPieces,
  findValidHelpers,
}: {
  targetPos: { x: number; y: number }
  cellSize: number
  gap: number
  padding: number
  onSelectRelation: (relation: RelationKind) => void
  closing?: boolean
  availableRelations: RelationKind[]
  moverPiece: Piece
  targetPiece: Piece
  allPieces: Piece[]
  findValidHelpers: (moverValue: number, targetValue: number, relation: RelationKind) => Piece[]
}) {
  const [hoveredRelation, setHoveredRelation] = useState<RelationKind | null>(null)
  const [currentHelperIndex, setCurrentHelperIndex] = useState(0)

  // Cycle through valid helpers every 1.5 seconds when hovering
  useEffect(() => {
    if (!hoveredRelation) {
      setCurrentHelperIndex(0)
      return
    }

    const moverValue = getEffectiveValue(moverPiece)
    const targetValue = getEffectiveValue(targetPiece)

    if (
      moverValue === undefined ||
      moverValue === null ||
      targetValue === undefined ||
      targetValue === null
    ) {
      return
    }

    const validHelpers = findValidHelpers(moverValue, targetValue, hoveredRelation)
    if (validHelpers.length <= 1) {
      // No need to cycle if only one or zero helpers
      setCurrentHelperIndex(0)
      return
    }

    // Cycle through helpers every 1.5 seconds
    const interval = setInterval(() => {
      setCurrentHelperIndex((prev) => (prev + 1) % validHelpers.length)
    }, 1500)

    return () => clearInterval(interval)
  }, [hoveredRelation, moverPiece, targetPiece, findValidHelpers])

  // Generate tooltip text with actual numbers for the currently displayed helper
  const getTooltipText = (relation: RelationKind): string => {
    if (relation !== hoveredRelation) {
      // Not hovered, use generic text
      const genericMap: Record<RelationKind, string> = {
        EQUAL: 'Equality: a = b',
        MULTIPLE: 'Multiple: b is multiple of a',
        DIVISOR: 'Divisor: a divides b',
        SUM: 'Sum: a + h = b (helper)',
        DIFF: 'Difference: |a - h| = b (helper)',
        PRODUCT: 'Product: a × h = b (helper)',
        RATIO: 'Ratio: a/h = b/h (helper)',
      }
      return genericMap[relation] || relation
    }

    const moverValue = getEffectiveValue(moverPiece)
    const targetValue = getEffectiveValue(targetPiece)

    if (
      moverValue === undefined ||
      moverValue === null ||
      targetValue === undefined ||
      targetValue === null
    ) {
      return relation
    }

    // Relations that don't need helpers - show equation with just mover and target
    const helperRelations: RelationKind[] = ['SUM', 'DIFF', 'PRODUCT', 'RATIO']
    const needsHelper = helperRelations.includes(relation)

    if (!needsHelper) {
      // Generate equation with just mover and target values
      switch (relation) {
        case 'EQUAL':
          return `${moverValue} = ${targetValue}`
        case 'MULTIPLE':
          return `${targetValue} is multiple of ${moverValue}`
        case 'DIVISOR':
          return `${moverValue} divides ${targetValue}`
        default:
          return relation
      }
    }

    // Relations that need helpers
    const validHelpers = findValidHelpers(moverValue, targetValue, relation)
    if (validHelpers.length === 0) {
      return `${relation}: No valid helpers`
    }

    const currentHelper = validHelpers[currentHelperIndex]
    const helperValue = getEffectiveValue(currentHelper)

    if (helperValue === undefined || helperValue === null) {
      return relation
    }

    // Generate equation with actual numbers including helper
    switch (relation) {
      case 'SUM':
        return `${moverValue} + ${helperValue} = ${targetValue}`
      case 'DIFF':
        return `|${moverValue} - ${helperValue}| = ${targetValue}`
      case 'PRODUCT':
        return `${moverValue} × ${helperValue} = ${targetValue}`
      case 'RATIO':
        return `${moverValue}/${helperValue} = ${targetValue}/${helperValue}`
      default:
        return relation
    }
  }

  const allRelations = [
    { relation: 'EQUAL', label: '=', angle: 0, color: '#8b5cf6' },
    {
      relation: 'MULTIPLE',
      label: '×n',
      angle: 51.4,
      color: '#a855f7',
    },
    {
      relation: 'DIVISOR',
      label: '÷',
      angle: 102.8,
      color: '#c084fc',
    },
    {
      relation: 'SUM',
      label: '+',
      angle: 154.3,
      color: '#3b82f6',
    },
    {
      relation: 'DIFF',
      label: '−',
      angle: 205.7,
      color: '#06b6d4',
    },
    {
      relation: 'PRODUCT',
      label: '×',
      angle: 257.1,
      color: '#10b981',
    },
    {
      relation: 'RATIO',
      label: '÷÷',
      angle: 308.6,
      color: '#f59e0b',
    },
  ]

  // Filter to only available relations and redistribute angles evenly
  const availableRelationDefs = allRelations.filter((r) =>
    availableRelations.includes(r.relation as RelationKind)
  )
  const angleStep = availableRelationDefs.length > 1 ? 360 / availableRelationDefs.length : 0
  const relations = availableRelationDefs.map((r, index) => ({
    ...r,
    angle: index * angleStep,
  }))

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
        {relations.map(({ relation, label, angle, color }) => {
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
                        onSelectRelation(relation as RelationKind)
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
                        setHoveredRelation(relation as RelationKind)
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
                        setHoveredRelation(null)
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
                        {getTooltipText(relation as RelationKind)}
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

        {/* Number bond preview when hovering over a relation - cycle through valid helpers */}
        {hoveredRelation &&
          (() => {
            const moverValue = getEffectiveValue(moverPiece)
            const targetValue = getEffectiveValue(targetPiece)

            if (
              moverValue === undefined ||
              moverValue === null ||
              targetValue === undefined ||
              targetValue === null
            ) {
              return null
            }

            const validHelpers = findValidHelpers(moverValue, targetValue, hoveredRelation)

            if (validHelpers.length === 0) {
              return null
            }

            // Show only the current helper
            const currentHelper = validHelpers[currentHelperIndex]

            // Color scheme based on relation type
            const colorMap: Record<RelationKind, string> = {
              SUM: '#ef4444', // red
              DIFF: '#f97316', // orange
              PRODUCT: '#8b5cf6', // purple
              RATIO: '#3b82f6', // blue
              EQUAL: '#10b981', // green
              MULTIPLE: '#eab308', // yellow
              DIVISOR: '#06b6d4', // cyan
            }
            const color = colorMap[hoveredRelation] || '#6b7280'

            // Operator symbols
            const operatorMap: Record<RelationKind, string> = {
              SUM: '+',
              DIFF: '−',
              PRODUCT: '×',
              RATIO: '÷',
              EQUAL: '=',
              MULTIPLE: '×',
              DIVISOR: '÷',
            }
            const operator = operatorMap[hoveredRelation] || '?'

            // Calculate mover position on board
            const moverFile = moverPiece.square.charCodeAt(0) - 65
            const moverRank = Number.parseInt(moverPiece.square.slice(1), 10)
            const moverRow = 8 - moverRank
            const moverPos = {
              x: padding + moverFile * (cellSize + gap) + cellSize / 2,
              y: padding + moverRow * (cellSize + gap) + cellSize / 2,
            }

            // Calculate target position on board
            const targetFile = targetPiece.square.charCodeAt(0) - 65
            const targetRank = Number.parseInt(targetPiece.square.slice(1), 10)
            const targetRow = 8 - targetRank
            const targetBoardPos = {
              x: padding + targetFile * (cellSize + gap) + cellSize / 2,
              y: padding + targetRow * (cellSize + gap) + cellSize / 2,
            }

            // Calculate current helper position on board
            const helperFile = currentHelper.square.charCodeAt(0) - 65
            const helperRank = Number.parseInt(currentHelper.square.slice(1), 10)
            const helperRow = 8 - helperRank
            const helperPos = {
              x: padding + helperFile * (cellSize + gap) + cellSize / 2,
              y: padding + helperRow * (cellSize + gap) + cellSize / 2,
            }

            return (
              <g key={currentHelper.id}>
                {/* Triangle connecting lines */}
                <g opacity={0.5}>
                  <line
                    x1={moverPos.x}
                    y1={moverPos.y}
                    x2={helperPos.x}
                    y2={helperPos.y}
                    stroke={color}
                    strokeWidth={4}
                  />
                  <line
                    x1={moverPos.x}
                    y1={moverPos.y}
                    x2={targetBoardPos.x}
                    y2={targetBoardPos.y}
                    stroke={color}
                    strokeWidth={4}
                  />
                  <line
                    x1={helperPos.x}
                    y1={helperPos.y}
                    x2={targetBoardPos.x}
                    y2={targetBoardPos.y}
                    stroke={color}
                    strokeWidth={4}
                  />
                </g>

                {/* Operator symbol - smart placement to avoid collinear collapse */}
                {(() => {
                  // Calculate center of triangle
                  const centerX = (moverPos.x + helperPos.x + targetBoardPos.x) / 3
                  const centerY = (moverPos.y + helperPos.y + targetBoardPos.y) / 3

                  // Check if pieces are nearly collinear using cross product
                  // Vector from mover to helper
                  const v1x = helperPos.x - moverPos.x
                  const v1y = helperPos.y - moverPos.y
                  // Vector from mover to target
                  const v2x = targetBoardPos.x - moverPos.x
                  const v2y = targetBoardPos.y - moverPos.y

                  // Cross product magnitude (2D)
                  const crossProduct = Math.abs(v1x * v2y - v1y * v2x)

                  // If cross product is small, pieces are nearly collinear
                  const minTriangleArea = cellSize * cellSize * 0.5 // Minimum triangle area threshold
                  const isCollinear = crossProduct < minTriangleArea

                  let operatorX = centerX
                  let operatorY = centerY

                  if (isCollinear) {
                    // Find the line connecting the three points (use mover to target as reference)
                    const lineLength = Math.sqrt(v2x * v2x + v2y * v2y)

                    if (lineLength > 0) {
                      // Perpendicular direction (rotate 90 degrees)
                      const perpX = -v2y / lineLength
                      const perpY = v2x / lineLength

                      // Offset operator perpendicular to the line
                      const offsetDistance = cellSize * 0.8
                      operatorX = centerX + perpX * offsetDistance
                      operatorY = centerY + perpY * offsetDistance
                    }
                  }

                  return (
                    <text
                      x={operatorX}
                      y={operatorY}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={color}
                      fontSize={cellSize * 0.8}
                      fontWeight="900"
                      fontFamily="Georgia, 'Times New Roman', serif"
                      opacity={0.9}
                    >
                      {operator}
                    </text>
                  )
                })()}
              </g>
            )
          })()}
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
  opacity = 1,
}: {
  piece: Piece
  cellSize: number
  padding: number
  opacity?: number
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
            opacity,
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
  const [selectedRelation, setSelectedRelation] = useState<RelationKind | null>(null)
  const [selectedHelper, setSelectedHelper] = useState<{
    helperPiece: Piece
    moverPiece: Piece
    targetPiece: Piece
  } | null>(null)

  // Handle closing animation completion
  useEffect(() => {
    if (closingDialog) {
      // Wait for animation to complete (400ms allows spring to fully settle)
      const timer = setTimeout(() => {
        setCaptureDialogOpen(false)
        setCaptureTarget(null)
        setSelectedRelation(null)
        setSelectedHelper(null)
        setClosingDialog(false)
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [closingDialog])

  // Function to dismiss the dialog with animation
  const dismissDialog = () => {
    setSelectedRelation(null)
    setSelectedHelper(null)
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
      // Validate the move is legal before proceeding
      const validation = validateMove(selectedPiece, selectedSquare, square, state.pieces)

      if (!validation.valid) {
        // Invalid move - silently ignore or show error
        // TODO: Could show error message to user
        return
      }

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

  // Find valid helper pieces for a given relation
  const findValidHelpers = (
    moverValue: number,
    targetValue: number,
    relation: RelationKind
  ): Piece[] => {
    if (!captureTarget) return []

    const validHelpers: Piece[] = []
    const friendlyPieces = Object.values(state.pieces).filter(
      (p) => !p.captured && p.color === playerColor && p.id !== captureTarget.pieceId
    )

    for (const piece of friendlyPieces) {
      const helperValue = getEffectiveValue(piece)
      if (helperValue === undefined || helperValue === null) continue

      let isValid = false
      switch (relation) {
        case 'SUM':
          isValid = checkSum(moverValue, targetValue, helperValue).valid
          break
        case 'DIFF':
          isValid = checkDiff(moverValue, targetValue, helperValue).valid
          break
        case 'PRODUCT':
          isValid = checkProduct(moverValue, targetValue, helperValue).valid
          break
        case 'RATIO':
          isValid = checkRatio(moverValue, targetValue, helperValue).valid
          break
      }

      if (isValid) {
        validHelpers.push(piece)
      }
    }

    return validHelpers
  }

  // Find ALL available relations for this capture
  const findAvailableRelations = (moverValue: number, targetValue: number): RelationKind[] => {
    const available: RelationKind[] = []

    // Check non-helper relations
    if (checkEqual(moverValue, targetValue).valid) available.push('EQUAL')
    if (checkMultiple(moverValue, targetValue).valid) available.push('MULTIPLE')
    if (checkDivisor(moverValue, targetValue).valid) available.push('DIVISOR')

    // Check helper relations - only include if at least one valid helper exists
    if (findValidHelpers(moverValue, targetValue, 'SUM').length > 0) available.push('SUM')
    if (findValidHelpers(moverValue, targetValue, 'DIFF').length > 0) available.push('DIFF')
    if (findValidHelpers(moverValue, targetValue, 'PRODUCT').length > 0) available.push('PRODUCT')
    if (findValidHelpers(moverValue, targetValue, 'RATIO').length > 0) available.push('RATIO')

    console.log('[findAvailableRelations] available:', available)
    return available
  }

  const handleCaptureWithRelation = (relation: RelationKind) => {
    console.log('[handleCaptureWithRelation] Called with relation:', relation)
    console.log('[handleCaptureWithRelation] captureTarget:', captureTarget)

    if (!captureTarget) {
      console.log('[handleCaptureWithRelation] No capture target, returning')
      return
    }

    // Check if this relation requires a helper
    const helperRelations: RelationKind[] = ['SUM', 'DIFF', 'PRODUCT', 'RATIO']
    const needsHelper = helperRelations.includes(relation)
    console.log('[handleCaptureWithRelation] needsHelper:', needsHelper)

    if (needsHelper) {
      // Get mover and target values
      const moverPiece = Object.values(state.pieces).find(
        (p) => p.id === captureTarget.pieceId && !p.captured
      )
      const targetPiece = Object.values(state.pieces).find(
        (p) => p.square === captureTarget.to && !p.captured
      )

      console.log('[handleCaptureWithRelation] moverPiece:', moverPiece)
      console.log('[handleCaptureWithRelation] targetPiece:', targetPiece)

      if (!moverPiece || !targetPiece) {
        console.log('[handleCaptureWithRelation] Missing piece, returning')
        return
      }

      const moverValue = getEffectiveValue(moverPiece)
      const targetValue = getEffectiveValue(targetPiece)

      console.log('[handleCaptureWithRelation] moverValue:', moverValue)
      console.log('[handleCaptureWithRelation] targetValue:', targetValue)

      if (
        moverValue === undefined ||
        moverValue === null ||
        targetValue === undefined ||
        targetValue === null
      ) {
        console.log('[handleCaptureWithRelation] Undefined/null value, returning')
        return
      }

      // Find valid helpers
      const validHelpers = findValidHelpers(moverValue, targetValue, relation)
      console.log('[handleCaptureWithRelation] validHelpers:', validHelpers)

      if (validHelpers.length === 0) {
        // No valid helpers - relation is impossible
        console.log('[handleCaptureWithRelation] No valid helpers found')
        return
      }

      // Automatically select the first valid helper (skip helper selection UI)
      console.log('[handleCaptureWithRelation] Auto-selecting first helper:', validHelpers[0])
      setSelectedRelation(relation)
      setSelectedHelper({
        helperPiece: validHelpers[0],
        moverPiece,
        targetPiece,
      })
    } else {
      console.log('[handleCaptureWithRelation] No helper needed, executing capture immediately')
      // No helper needed - execute capture immediately
      const targetPiece = Object.values(state.pieces).find(
        (p) => p.square === captureTarget.to && !p.captured
      )
      if (!targetPiece) return

      const captureData = {
        relation,
        targetPieceId: targetPiece.id,
      }

      makeMove(captureTarget.from, captureTarget.to, captureTarget.pieceId, undefined, captureData)
      dismissDialog()
      setSelectedSquare(null)
    }
  }

  const handleHelperSelection = (helperPieceId: string) => {
    if (!captureTarget || !selectedRelation) return

    // Get pieces for number bond visualization
    const moverPiece = Object.values(state.pieces).find(
      (p) => p.id === captureTarget.pieceId && !p.captured
    )
    const targetPiece = Object.values(state.pieces).find(
      (p) => p.square === captureTarget.to && !p.captured
    )
    const helperPiece = Object.values(state.pieces).find(
      (p) => p.id === helperPieceId && !p.captured
    )

    if (!moverPiece || !targetPiece || !helperPiece) return

    // Show number bond visualization
    setSelectedHelper({
      helperPiece,
      moverPiece,
      targetPiece,
    })
  }

  const handleNumberBondConfirm = () => {
    if (!captureTarget || !selectedRelation || !selectedHelper) return

    const captureData = {
      relation: selectedRelation,
      targetPieceId: selectedHelper.targetPiece.id,
      helperPieceId: selectedHelper.helperPiece.id,
    }

    makeMove(captureTarget.from, captureTarget.to, captureTarget.pieceId, undefined, captureData)
    dismissDialog()
    setSelectedSquare(null)
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

  // Calculate square position in SVG coordinates
  const getSquarePosition = (square: string) => {
    const file = square.charCodeAt(0) - 65
    const rank = Number.parseInt(square.slice(1), 10)
    const row = 8 - rank
    const x = padding + file * (cellSize + gap) + cellSize / 2
    const y = padding + row * (cellSize + gap) + cellSize / 2
    console.log(
      `[getSquarePosition] square: ${square}, file: ${file}, rank: ${rank}, row: ${row}, x: ${x}, y: ${y}, cellSize: ${cellSize}, gap: ${gap}, padding: ${padding}`
    )
    return { x, y }
  }

  // Calculate target square position for floating capture options
  const getTargetSquarePosition = () => {
    if (!captureTarget) return null
    const pos = getSquarePosition(captureTarget.to)
    console.log('[getTargetSquarePosition] captureTarget.to:', captureTarget.to, 'position:', pos)
    return pos
  }

  const targetPos = getTargetSquarePosition()
  if (targetPos) {
    console.log('[BoardDisplay] targetPos calculated:', targetPos)
  }

  // Prepare helper data with board positions (if showing helpers)
  const helpersWithPositions = (() => {
    console.log('[helpersWithPositions] selectedRelation:', selectedRelation)
    console.log('[helpersWithPositions] captureTarget:', captureTarget)

    if (!selectedRelation || !captureTarget) {
      console.log('[helpersWithPositions] No selectedRelation or captureTarget, returning empty')
      return []
    }

    const moverPiece = Object.values(state.pieces).find(
      (p) => p.id === captureTarget.pieceId && !p.captured
    )
    const targetPiece = Object.values(state.pieces).find(
      (p) => p.square === captureTarget.to && !p.captured
    )

    console.log('[helpersWithPositions] moverPiece:', moverPiece)
    console.log('[helpersWithPositions] targetPiece:', targetPiece)

    if (!moverPiece || !targetPiece) {
      console.log('[helpersWithPositions] Missing pieces, returning empty')
      return []
    }

    const moverValue = getEffectiveValue(moverPiece)
    const targetValue = getEffectiveValue(targetPiece)

    console.log('[helpersWithPositions] moverValue:', moverValue)
    console.log('[helpersWithPositions] targetValue:', targetValue)

    if (
      moverValue === undefined ||
      moverValue === null ||
      targetValue === undefined ||
      targetValue === null
    ) {
      console.log('[helpersWithPositions] Undefined/null values, returning empty')
      return []
    }

    const validHelpers = findValidHelpers(moverValue, targetValue, selectedRelation)
    console.log('[helpersWithPositions] validHelpers found:', validHelpers.length)

    const helpersWithPos = validHelpers.map((piece) => ({
      piece,
      boardPos: getSquarePosition(piece.square),
    }))
    console.log('[helpersWithPositions] helpersWithPos:', helpersWithPos)

    return helpersWithPos
  })()

  // Calculate available relations for this capture
  const availableRelations = (() => {
    if (!captureTarget) return []

    const moverPiece = Object.values(state.pieces).find(
      (p) => p.id === captureTarget.pieceId && !p.captured
    )
    const targetPiece = Object.values(state.pieces).find(
      (p) => p.square === captureTarget.to && !p.captured
    )

    if (!moverPiece || !targetPiece) return []

    const moverValue = getEffectiveValue(moverPiece)
    const targetValue = getEffectiveValue(targetPiece)

    if (
      moverValue === undefined ||
      moverValue === null ||
      targetValue === undefined ||
      targetValue === null
    )
      return []

    return findAvailableRelations(moverValue, targetValue)
  })()

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
        {activePieces.map((piece) => {
          // Show low opacity for pieces currently being shown as helper options or in the number bond
          const isBorrowedHelper = helpersWithPositions.some((h) => h.piece.id === piece.id)
          const isBorrowedMover = selectedHelper && selectedHelper.moverPiece.id === piece.id
          const isInNumberBond = isBorrowedHelper || isBorrowedMover
          return (
            <SvgPiece
              key={piece.id}
              piece={piece}
              cellSize={cellSize + gap}
              padding={padding}
              opacity={isInNumberBond ? 0.2 : 1}
            />
          )
        })}

        {/* Floating capture relation options, helper selection, or number bond */}
        {(() => {
          console.log('[Render] captureDialogOpen:', captureDialogOpen)
          console.log('[Render] targetPos:', targetPos)
          console.log('[Render] selectedRelation:', selectedRelation)
          console.log('[Render] selectedHelper:', selectedHelper)
          console.log('[Render] helpersWithPositions.length:', helpersWithPositions.length)
          console.log('[Render] closingDialog:', closingDialog)

          // Phase 3: Show number bond after helper selected
          if (captureDialogOpen && targetPos && selectedRelation && selectedHelper) {
            console.log('[Render] Showing NumberBondVisualization')

            // Calculate mover position on board
            const moverFile = selectedHelper.moverPiece.square.charCodeAt(0) - 65
            const moverRank = Number.parseInt(selectedHelper.moverPiece.square.slice(1), 10)
            const moverRow = 8 - moverRank
            const moverStartPos = {
              x: padding + moverFile * (cellSize + gap) + cellSize / 2,
              y: padding + moverRow * (cellSize + gap) + cellSize / 2,
            }

            // Find helper position in ring
            const helperIndex = helpersWithPositions.findIndex(
              (h) => h.piece.id === selectedHelper.helperPiece.id
            )
            const maxRadius = cellSize * 1.2
            const angleStep =
              helpersWithPositions.length > 1 ? 360 / helpersWithPositions.length : 0
            const angle = helperIndex * angleStep
            const rad = (angle * Math.PI) / 180
            const helperStartPos = {
              x: targetPos.x + Math.cos(rad) * maxRadius,
              y: targetPos.y + Math.sin(rad) * maxRadius,
            }

            return (
              <NumberBondVisualization
                moverPiece={selectedHelper.moverPiece}
                helperPiece={selectedHelper.helperPiece}
                targetPiece={selectedHelper.targetPiece}
                relation={selectedRelation}
                targetPos={targetPos}
                cellSize={cellSize}
                onConfirm={handleNumberBondConfirm}
                closing={closingDialog}
                moverStartPos={moverStartPos}
                helperStartPos={helperStartPos}
                padding={padding}
                gap={gap}
              />
            )
          }

          // Phase 2: Show helper selection
          if (
            captureDialogOpen &&
            targetPos &&
            selectedRelation &&
            !selectedHelper &&
            helpersWithPositions.length > 0
          ) {
            console.log('[Render] Showing HelperSelectionOptions')

            // Extract mover and target pieces for number bond preview
            const moverPiece = Object.values(state.pieces).find(
              (p) => p.id === captureTarget?.pieceId
            )
            const targetPiece = Object.values(state.pieces).find(
              (p) => p.square === captureTarget?.to && !p.captured
            )

            if (!moverPiece || !targetPiece) {
              console.log('[Render] Missing mover or target piece for helper selection')
              return null
            }

            return (
              <HelperSelectionOptions
                helpers={helpersWithPositions}
                targetPos={targetPos}
                cellSize={cellSize}
                gap={gap}
                padding={padding}
                onSelectHelper={handleHelperSelection}
                closing={closingDialog}
                moverPiece={moverPiece}
                targetPiece={targetPiece}
                relation={selectedRelation}
              />
            )
          }

          // Phase 1: Show relation options OR error if no valid relations
          if (captureDialogOpen && targetPos && !selectedRelation) {
            console.log('[Render] Showing CaptureRelationOptions')
            console.log('[Render] availableRelations:', availableRelations)

            // Extract mover and target pieces for number bond preview
            const moverPiece = Object.values(state.pieces).find(
              (p) => p.id === captureTarget?.pieceId
            )
            const targetPiece = Object.values(state.pieces).find(
              (p) => p.square === captureTarget?.to && !p.captured
            )

            if (!moverPiece || !targetPiece) {
              console.log('[Render] Missing mover or target piece for relation options')
              return null
            }

            // Show error message if no valid relations
            if (availableRelations.length === 0) {
              return (
                <CaptureErrorDialog
                  targetPos={targetPos}
                  cellSize={cellSize}
                  onClose={dismissDialog}
                  closing={closingDialog}
                />
              )
            }

            return (
              <CaptureRelationOptions
                targetPos={targetPos}
                cellSize={cellSize}
                gap={gap}
                padding={padding}
                onSelectRelation={handleCaptureWithRelation}
                closing={closingDialog}
                availableRelations={availableRelations}
                moverPiece={moverPiece}
                targetPiece={targetPiece}
                allPieces={activePieces}
                findValidHelpers={findValidHelpers}
              />
            )
          }

          console.log('[Render] Showing nothing')
          return null
        })()}
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
