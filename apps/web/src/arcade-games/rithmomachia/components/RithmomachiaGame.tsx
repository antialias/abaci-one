'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { RosterWarning } from '@/components/nav/GameContextNav'
import { SetupPlayerRequirement } from '@/components/nav/SetupPlayerRequirement'
import type { PlayerBadge } from '@/components/nav/types'
import { PageWithNav } from '@/components/PageWithNav'
import { StandardGameLayout } from '@/components/StandardGameLayout'
import { useFullscreen } from '@/contexts/FullscreenContext'
import { useGameMode } from '@/contexts/GameModeContext'
import { useAbacusSettings } from '@/hooks/useAbacusSettings'
import { useDeactivatePlayer, useKickUser, useRoomData } from '@/hooks/useRoomData'
import { useViewerId } from '@/hooks/useViewerId'
import { css } from '../../../../styled-system/css'
import { useRithmomachia } from '../Provider'
import type { RithmomachiaConfig } from '../types'
import { BoardDisplay } from './board/BoardDisplay'
import { PlayingGuideModal } from './PlayingGuideModal'

function useRosterWarning(phase: 'setup' | 'playing'): RosterWarning | undefined {
  const { rosterStatus, whitePlayerId, blackPlayerId } = useRithmomachia()
  const { players: playerMap, activePlayers: activePlayerIds, addPlayer, setActive } = useGameMode()
  const { roomData } = useRoomData()
  const { data: viewerId } = useViewerId()
  const { mutate: kickUser } = useKickUser()
  const { mutate: deactivatePlayer } = useDeactivatePlayer()

  return useMemo(() => {
    // Don't show notice for 'ok' or 'noLocalControl' (observers are allowed)
    if (rosterStatus.status === 'ok' || rosterStatus.status === 'noLocalControl') {
      return undefined
    }

    const playersArray = Array.from(playerMap.values()).sort((a, b) => {
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

    const isHost =
      roomData && viewerId
        ? roomData.members.find((m) => m.userId === viewerId)?.isCreator === true
        : false

    const removableLocalPlayers = playersArray.filter(
      (player) =>
        player.isLocal !== false &&
        activePlayerIds.has(player.id) &&
        player.id !== whitePlayerId &&
        player.id !== blackPlayerId
    )

    const kickablePlayers =
      isHost && roomData
        ? playersArray.filter(
            (player) =>
              player.isLocal === false &&
              activePlayerIds.has(player.id) &&
              player.id !== whitePlayerId &&
              player.id !== blackPlayerId
          )
        : []

    const inactiveLocalPlayer = playersArray.find(
      (player) => player.isLocal !== false && !activePlayerIds.has(player.id)
    )

    const handleKick = (player: any) => {
      if (!roomData) return
      for (const [userId, players] of Object.entries(roomData.memberPlayers)) {
        if (players.some((p) => p.id === player.id)) {
          kickUser({ roomId: roomData.id, userId })
          break
        }
      }
    }

    if (rosterStatus.status === 'tooFew') {
      // During setup, don't show nav banner - SetupPlayerRequirement panel handles this
      if (phase === 'setup') {
        return undefined
      }

      // During playing phase, show nav warning banner
      const actions = []
      if (inactiveLocalPlayer) {
        actions.push({
          label: `Activate ${inactiveLocalPlayer.name}`,
          onClick: () => setActive(inactiveLocalPlayer.id, true),
        })
      } else {
        actions.push({
          label: 'Create local player',
          onClick: () => addPlayer({ isActive: true }),
        })
      }

      return {
        heading: 'Need two active players',
        description: 'Gameplay is paused until two players are active.',
        actions,
      }
    }

    return undefined
  }, [
    rosterStatus.status,
    phase,
    playerMap,
    activePlayerIds,
    whitePlayerId,
    blackPlayerId,
    roomData,
    viewerId,
    addPlayer,
    setActive,
    kickUser,
    deactivatePlayer,
  ])
}

/**
 * Main Rithmomachia game component.
 * Orchestrates the game phases and UI.
 */
export function RithmomachiaGame() {
  const router = useRouter()
  const {
    state,
    resetGame,
    goToSetup,
    whitePlayerId,
    blackPlayerId,
    assignWhitePlayer,
    assignBlackPlayer,
  } = useRithmomachia()

  // Get abacus settings for native abacus numbers
  const { data: abacusSettings } = useAbacusSettings()
  const useNativeAbacusNumbers = abacusSettings?.nativeAbacusNumbers ?? false
  const { setFullscreenElement } = useFullscreen()
  const gameRef = useRef<HTMLDivElement>(null)
  const rosterWarning = useRosterWarning(state.gamePhase === 'setup' ? 'setup' : 'playing')
  const [isGuideOpen, setIsGuideOpen] = useState(false)

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
      rosterWarning={rosterWarning}
      whitePlayerId={whitePlayerId}
      blackPlayerId={blackPlayerId}
      onAssignWhitePlayer={assignWhitePlayer}
      onAssignBlackPlayer={assignBlackPlayer}
      gamePhase={state.gamePhase}
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
              position: 'relative',
            })}
          >
            {state.gamePhase === 'setup' && <SetupPhase onOpenGuide={() => setIsGuideOpen(true)} />}
            {state.gamePhase === 'playing' && (
              <PlayingPhase onOpenGuide={() => setIsGuideOpen(true)} />
            )}
            {state.gamePhase === 'results' && <ResultsPhase />}
          </main>
        </div>
      </StandardGameLayout>

      {/* Playing Guide Modal - persists across all phases */}
      <PlayingGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </PageWithNav>
  )
}

/**
 * Setup phase: game configuration and start button.
 */
function SetupPhase({ onOpenGuide }: { onOpenGuide: () => void }) {
  const { state, startGame, setConfig, lastError, clearError, rosterStatus } = useRithmomachia()
  const { players: playerMap, activePlayers: activePlayerIds, addPlayer, setActive } = useGameMode()
  const startDisabled = rosterStatus.status !== 'ok'

  const toggleSetting = (key: keyof typeof state) => {
    if (typeof state[key] === 'boolean') {
      setConfig(key as keyof RithmomachiaConfig, !state[key])
    }
  }

  const updateThreshold = (value: number) => {
    setConfig('pointWinThreshold', Math.max(1, value))
  }

  // Prepare data for SetupPlayerRequirement
  const activePlayers = Array.from(playerMap.values()).filter((p) => activePlayerIds.has(p.id))
  const inactivePlayers = Array.from(playerMap.values()).filter((p) => !activePlayerIds.has(p.id))

  return (
    <div
      data-component="setup-phase-container"
      className={css({
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      {/* Animated mathematical symbols background */}
      <div
        data-element="background-symbols"
        className={css({
          position: 'absolute',
          inset: 0,
          opacity: 0.1,
          fontSize: '20vh',
          color: 'white',
          pointerEvents: 'none',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-around',
          alignItems: 'center',
        })}
      >
        <span>∑</span>
        <span>π</span>
        <span>∞</span>
        <span>±</span>
        <span>∫</span>
        <span>√</span>
      </div>

      {/* Main content container - uses full viewport */}
      <div
        data-element="main-content"
        className={css({
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '1vh',
          overflow: 'hidden',
          p: '1.5vh',
        })}
      >
        {lastError && (
          <div
            data-element="error-banner"
            className={css({
              width: '100%',
              p: '2vh',
              bg: 'rgba(220, 38, 38, 0.9)',
              borderRadius: 'lg',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backdropFilter: 'blur(10px)',
            })}
          >
            <span className={css({ color: 'white', fontWeight: 'bold', fontSize: '1.8vh' })}>
              ⚠️ {lastError}
            </span>
            <button
              type="button"
              onClick={clearError}
              className={css({
                px: '2vh',
                py: '1vh',
                bg: 'rgba(255, 255, 255, 0.3)',
                color: 'white',
                borderRadius: 'md',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '1.6vh',
                _hover: { bg: 'rgba(255, 255, 255, 0.5)' },
              })}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Player requirement panel - styled for medieval theme */}
        {rosterStatus.status === 'tooFew' && (
          <div
            className={css({
              '& > div': {
                maxWidth: '100%',
                margin: '0',
                padding: '1.5vh',
                background: 'rgba(30, 27, 75, 0.85)',
                border: '0.3vh solid rgba(251, 191, 36, 0.6)',
                borderRadius: '1.5vh',
                backdropFilter: 'blur(10px)',
                '& h2': {
                  fontSize: '2vh',
                  background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                  color: 'transparent',
                  backgroundClip: 'text',
                },
                '& p': {
                  fontSize: '1.4vh',
                  color: 'rgba(255, 255, 255, 0.8)',
                },
                '& button': {
                  fontSize: '1.4vh',
                  padding: '0.8vh 1.5vh',
                },
              },
            })}
          >
            <SetupPlayerRequirement
              minPlayers={2}
              currentPlayers={activePlayers}
              inactivePlayers={inactivePlayers}
              onAddPlayer={(playerId) => setActive(playerId, true)}
              onConfigurePlayer={() => {
                /* TODO: Add configure player handler */
              }}
              gameTitle="Rithmomachia"
            />
          </div>
        )}

        {/* Only show setup config when we have enough players */}
        {rosterStatus.status !== 'tooFew' && (
          <>
            {/* Title Section - Compact medieval manuscript style */}
            <div
              data-element="title-section"
              className={css({
                textAlign: 'center',
                bg: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '1.5vh',
                p: '1.5vh',
                boxShadow: '0 1vh 3vh rgba(0,0,0,0.5)',
                width: '100%',
                position: 'relative',
                border: '0.3vh solid',
                borderColor: 'rgba(251, 191, 36, 0.6)',
                backdropFilter: 'blur(10px)',
                flexShrink: 0,
              })}
            >
              {/* Ornamental corners - smaller */}
              <div
                className={css({
                  position: 'absolute',
                  top: '-0.5vh',
                  left: '-0.5vh',
                  width: '2.5vh',
                  height: '2.5vh',
                  borderTop: '0.3vh solid',
                  borderLeft: '0.3vh solid',
                  borderColor: 'rgba(251, 191, 36, 0.8)',
                  borderRadius: '1.5vh 0 0 0',
                })}
              />
              <div
                className={css({
                  position: 'absolute',
                  top: '-0.5vh',
                  right: '-0.5vh',
                  width: '2.5vh',
                  height: '2.5vh',
                  borderTop: '0.3vh solid',
                  borderRight: '0.3vh solid',
                  borderColor: 'rgba(251, 191, 36, 0.8)',
                  borderRadius: '0 1.5vh 0 0',
                })}
              />
              <div
                className={css({
                  position: 'absolute',
                  bottom: '-0.5vh',
                  left: '-0.5vh',
                  width: '2.5vh',
                  height: '2.5vh',
                  borderBottom: '0.3vh solid',
                  borderLeft: '0.3vh solid',
                  borderColor: 'rgba(251, 191, 36, 0.8)',
                  borderRadius: '0 0 0 1.5vh',
                })}
              />
              <div
                className={css({
                  position: 'absolute',
                  bottom: '-0.5vh',
                  right: '-0.5vh',
                  width: '2.5vh',
                  height: '2.5vh',
                  borderBottom: '0.3vh solid',
                  borderRight: '0.3vh solid',
                  borderColor: 'rgba(251, 191, 36, 0.8)',
                  borderRadius: '0 0 1.5vh 0',
                })}
              />

              <h1
                className={css({
                  fontSize: '3.5vh',
                  fontWeight: 'bold',
                  mb: '0.5vh',
                  color: '#7c2d12',
                  textShadow:
                    '0.15vh 0.15vh 0 rgba(251, 191, 36, 0.5), 0.3vh 0.3vh 0.5vh rgba(0,0,0,0.3)',
                  letterSpacing: '0.2vh',
                })}
              >
                ⚔️ RITHMOMACHIA ⚔️
              </h1>
              <div
                className={css({
                  height: '0.2vh',
                  width: '60%',
                  margin: '0 auto 0.5vh',
                  background:
                    'linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.8), transparent)',
                })}
              />
              <p
                className={css({
                  color: '#92400e',
                  fontSize: '1.8vh',
                  fontWeight: 'bold',
                  mb: '0.3vh',
                  fontStyle: 'italic',
                })}
              >
                The Philosopher's Game
              </p>
              <p
                className={css({
                  color: '#78350f',
                  fontSize: '1.2vh',
                  lineHeight: '1.4',
                  fontWeight: '500',
                  mb: '0.8vh',
                })}
              >
                Win by forming mathematical progressions in enemy territory
              </p>
              <button
                type="button"
                data-action="open-guide"
                onClick={onOpenGuide}
                className={css({
                  bg: 'linear-gradient(135deg, #7c2d12, #92400e)',
                  color: 'white',
                  border: '2px solid rgba(251, 191, 36, 0.6)',
                  borderRadius: '0.8vh',
                  px: '1.5vh',
                  py: '0.8vh',
                  fontSize: '1.3vh',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5vh',
                  mx: 'auto',
                  boxShadow: '0 0.3vh 0.8vh rgba(0, 0, 0, 0.3)',
                  _hover: {
                    bg: 'linear-gradient(135deg, #92400e, #7c2d12)',
                    transform: 'translateY(-0.2vh)',
                    boxShadow: '0 0.5vh 1.2vh rgba(0, 0, 0, 0.4)',
                  },
                })}
              >
                <span>📖</span>
                <span>How to Play</span>
              </button>
            </div>

            {/* Game Settings - Compact with flex: 1 to take remaining space */}
            <div
              data-element="game-settings"
              className={css({
                width: '100%',
                flex: 1,
                minHeight: 0,
                bg: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '1.5vh',
                p: '1.5vh',
                boxShadow: '0 1vh 3vh rgba(0,0,0,0.5)',
                border: '0.2vh solid',
                borderColor: 'rgba(251, 191, 36, 0.4)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              })}
            >
              <h2
                className={css({
                  fontSize: '2vh',
                  fontWeight: 'bold',
                  mb: '1vh',
                  color: '#7c2d12',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5vh',
                  flexShrink: 0,
                })}
              >
                <span>⚙️</span>
                <span>Game Rules</span>
              </h2>

              <div
                className={css({
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(35%, 1fr))',
                  gap: '1vh',
                  flex: 1,
                  minHeight: 0,
                  alignContent: 'start',
                })}
              >
                {/* Point Victory */}
                <div
                  data-setting="point-victory"
                  onClick={() => toggleSetting('pointWinEnabled')}
                  className={css({
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1vh',
                    p: '1.5vh',
                    bg: state.pointWinEnabled
                      ? 'rgba(251, 191, 36, 0.25)'
                      : 'rgba(139, 92, 246, 0.1)',
                    borderRadius: '1vh',
                    border: '0.3vh solid',
                    borderColor: state.pointWinEnabled
                      ? 'rgba(251, 191, 36, 0.8)'
                      : 'rgba(139, 92, 246, 0.3)',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: state.pointWinEnabled
                      ? '0 0.5vh 2vh rgba(251, 191, 36, 0.4)'
                      : '0 0.2vh 0.5vh rgba(0,0,0,0.1)',
                    _hover: {
                      bg: state.pointWinEnabled
                        ? 'rgba(251, 191, 36, 0.35)'
                        : 'rgba(139, 92, 246, 0.2)',
                      borderColor: state.pointWinEnabled
                        ? 'rgba(251, 191, 36, 1)'
                        : 'rgba(139, 92, 246, 0.5)',
                      transform: 'translateY(-0.2vh)',
                    },
                    _active: {
                      transform: 'scale(0.98)',
                    },
                  })}
                >
                  <div
                    className={css({
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    })}
                  >
                    <div className={css({ flex: 1, pointerEvents: 'none' })}>
                      <div
                        className={css({
                          fontWeight: 'bold',
                          fontSize: '1.6vh',
                          color: state.pointWinEnabled ? '#92400e' : '#7c2d12',
                        })}
                      >
                        {state.pointWinEnabled && '✓ '}Point Victory
                      </div>
                      <div className={css({ fontSize: '1.3vh', color: '#78350f' })}>
                        Win at {state.pointWinThreshold}pts
                      </div>
                    </div>
                    {state.pointWinEnabled && (
                      <div
                        className={css({
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: '4vh',
                          height: '4vh',
                          borderRadius: '0 1vh 0 100%',
                          bg: 'rgba(251, 191, 36, 0.4)',
                          pointerEvents: 'none',
                        })}
                      />
                    )}
                  </div>

                  {/* Threshold input - only visible when enabled */}
                  {state.pointWinEnabled && (
                    <div
                      data-element="threshold-input-container"
                      onClick={(e) => e.stopPropagation()}
                      className={css({
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        pt: '0.8vh',
                        borderTop: '0.15vh solid',
                        borderColor: 'rgba(251, 191, 36, 0.3)',
                      })}
                    >
                      <div
                        className={css({ fontSize: '1.2vh', fontWeight: 'bold', color: '#92400e' })}
                      >
                        Threshold:
                      </div>
                      <input
                        type="number"
                        value={state.pointWinThreshold}
                        onChange={(e) => updateThreshold(Number.parseInt(e.target.value, 10))}
                        onClick={(e) => e.stopPropagation()}
                        min="1"
                        className={css({
                          width: '6vh',
                          minHeight: '2.5vh',
                          px: '0.5vh',
                          py: '0.3vh',
                          borderRadius: '0.5vh',
                          border: '0.15vh solid',
                          borderColor: 'rgba(251, 191, 36, 0.6)',
                          bg: 'rgba(255, 255, 255, 0.9)',
                          textAlign: 'center',
                          fontSize: '1.4vh',
                          fontWeight: 'bold',
                          color: '#7c2d12',
                          _focus: {
                            outline: 'none',
                            borderColor: 'rgba(251, 191, 36, 1)',
                            boxShadow: '0 0 0.5vh rgba(251, 191, 36, 0.5)',
                          },
                        })}
                      />
                    </div>
                  )}
                </div>

                {/* Threefold Repetition */}
                <div
                  data-setting="threefold-repetition"
                  onClick={() => toggleSetting('repetitionRule')}
                  className={css({
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: '1.5vh',
                    bg: state.repetitionRule
                      ? 'rgba(251, 191, 36, 0.25)'
                      : 'rgba(139, 92, 246, 0.1)',
                    borderRadius: '1vh',
                    border: '0.3vh solid',
                    borderColor: state.repetitionRule
                      ? 'rgba(251, 191, 36, 0.8)'
                      : 'rgba(139, 92, 246, 0.3)',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: state.repetitionRule
                      ? '0 0.5vh 2vh rgba(251, 191, 36, 0.4)'
                      : '0 0.2vh 0.5vh rgba(0,0,0,0.1)',
                    _hover: {
                      bg: state.repetitionRule
                        ? 'rgba(251, 191, 36, 0.35)'
                        : 'rgba(139, 92, 246, 0.2)',
                      borderColor: state.repetitionRule
                        ? 'rgba(251, 191, 36, 1)'
                        : 'rgba(139, 92, 246, 0.5)',
                      transform: 'translateY(-0.2vh)',
                    },
                    _active: {
                      transform: 'scale(0.98)',
                    },
                  })}
                >
                  <div className={css({ flex: 1, pointerEvents: 'none' })}>
                    <div
                      className={css({
                        fontWeight: 'bold',
                        fontSize: '1.6vh',
                        color: state.repetitionRule ? '#92400e' : '#7c2d12',
                      })}
                    >
                      {state.repetitionRule && '✓ '}Threefold Draw
                    </div>
                    <div className={css({ fontSize: '1.3vh', color: '#78350f' })}>
                      Same position 3x
                    </div>
                  </div>
                  {state.repetitionRule && (
                    <div
                      className={css({
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: '4vh',
                        height: '4vh',
                        borderRadius: '0 1vh 0 100%',
                        bg: 'rgba(251, 191, 36, 0.4)',
                        pointerEvents: 'none',
                      })}
                    />
                  )}
                </div>

                {/* Fifty Move Rule */}
                <div
                  data-setting="fifty-move-rule"
                  onClick={() => toggleSetting('fiftyMoveRule')}
                  className={css({
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: '1.5vh',
                    bg: state.fiftyMoveRule
                      ? 'rgba(251, 191, 36, 0.25)'
                      : 'rgba(139, 92, 246, 0.1)',
                    borderRadius: '1vh',
                    border: '0.3vh solid',
                    borderColor: state.fiftyMoveRule
                      ? 'rgba(251, 191, 36, 0.8)'
                      : 'rgba(139, 92, 246, 0.3)',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: state.fiftyMoveRule
                      ? '0 0.5vh 2vh rgba(251, 191, 36, 0.4)'
                      : '0 0.2vh 0.5vh rgba(0,0,0,0.1)',
                    _hover: {
                      bg: state.fiftyMoveRule
                        ? 'rgba(251, 191, 36, 0.35)'
                        : 'rgba(139, 92, 246, 0.2)',
                      borderColor: state.fiftyMoveRule
                        ? 'rgba(251, 191, 36, 1)'
                        : 'rgba(139, 92, 246, 0.5)',
                      transform: 'translateY(-0.2vh)',
                    },
                    _active: {
                      transform: 'scale(0.98)',
                    },
                  })}
                >
                  <div className={css({ flex: 1, pointerEvents: 'none' })}>
                    <div
                      className={css({
                        fontWeight: 'bold',
                        fontSize: '1.6vh',
                        color: state.fiftyMoveRule ? '#92400e' : '#7c2d12',
                      })}
                    >
                      {state.fiftyMoveRule && '✓ '}Fifty-Move Draw
                    </div>
                    <div className={css({ fontSize: '1.3vh', color: '#78350f' })}>
                      50 moves no event
                    </div>
                  </div>
                  {state.fiftyMoveRule && (
                    <div
                      className={css({
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: '4vh',
                        height: '4vh',
                        borderRadius: '0 1vh 0 100%',
                        bg: 'rgba(251, 191, 36, 0.4)',
                        pointerEvents: 'none',
                      })}
                    />
                  )}
                </div>

                {/* Harmony Persistence */}
                <div
                  data-setting="flexible-harmony"
                  onClick={() => toggleSetting('allowAnySetOnRecheck')}
                  className={css({
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: '1.5vh',
                    bg: state.allowAnySetOnRecheck
                      ? 'rgba(251, 191, 36, 0.25)'
                      : 'rgba(139, 92, 246, 0.1)',
                    borderRadius: '1vh',
                    border: '0.3vh solid',
                    borderColor: state.allowAnySetOnRecheck
                      ? 'rgba(251, 191, 36, 0.8)'
                      : 'rgba(139, 92, 246, 0.3)',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: state.allowAnySetOnRecheck
                      ? '0 0.5vh 2vh rgba(251, 191, 36, 0.4)'
                      : '0 0.2vh 0.5vh rgba(0,0,0,0.1)',
                    _hover: {
                      bg: state.allowAnySetOnRecheck
                        ? 'rgba(251, 191, 36, 0.35)'
                        : 'rgba(139, 92, 246, 0.2)',
                      borderColor: state.allowAnySetOnRecheck
                        ? 'rgba(251, 191, 36, 1)'
                        : 'rgba(139, 92, 246, 0.5)',
                      transform: 'translateY(-0.2vh)',
                    },
                    _active: {
                      transform: 'scale(0.98)',
                    },
                  })}
                >
                  <div className={css({ flex: 1, pointerEvents: 'none' })}>
                    <div
                      className={css({
                        fontWeight: 'bold',
                        fontSize: '1.6vh',
                        color: state.allowAnySetOnRecheck ? '#92400e' : '#7c2d12',
                      })}
                    >
                      {state.allowAnySetOnRecheck && '✓ '}Flexible Harmony
                    </div>
                    <div className={css({ fontSize: '1.3vh', color: '#78350f' })}>
                      Any valid set
                    </div>
                  </div>
                  {state.allowAnySetOnRecheck && (
                    <div
                      className={css({
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: '4vh',
                        height: '4vh',
                        borderRadius: '0 1vh 0 100%',
                        bg: 'rgba(251, 191, 36, 0.4)',
                        pointerEvents: 'none',
                      })}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Start Button - Compact but dramatic */}
            <button
              type="button"
              data-action="start-game"
              onClick={startGame}
              disabled={startDisabled}
              className={css({
                width: '100%',
                py: '2vh',
                bg: startDisabled
                  ? 'rgba(100, 100, 100, 0.5)'
                  : 'linear-gradient(135deg, rgba(251, 191, 36, 0.95) 0%, rgba(245, 158, 11, 0.95) 100%)',
                color: startDisabled ? 'rgba(200, 200, 200, 0.7)' : '#7c2d12',
                borderRadius: '1.5vh',
                fontSize: '2.5vh',
                fontWeight: 'bold',
                cursor: startDisabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                boxShadow: startDisabled
                  ? '0 0.5vh 1.5vh rgba(0,0,0,0.2)'
                  : '0 1vh 3vh rgba(251, 191, 36, 0.6), inset 0 -0.3vh 0.5vh rgba(124, 45, 18, 0.3)',
                border: '0.3vh solid',
                borderColor: startDisabled ? 'rgba(100, 100, 100, 0.3)' : 'rgba(245, 158, 11, 0.8)',
                textTransform: 'uppercase',
                letterSpacing: '0.3vh',
                textShadow: startDisabled
                  ? 'none'
                  : '0.1vh 0.1vh 0.3vh rgba(124, 45, 18, 0.5), 0 0 1vh rgba(255, 255, 255, 0.3)',
                flexShrink: 0,
                position: 'relative',
                overflow: 'hidden',
                _hover: startDisabled
                  ? undefined
                  : {
                      transform: 'translateY(-0.5vh) scale(1.02)',
                      boxShadow:
                        '0 1.5vh 4vh rgba(251, 191, 36, 0.8), inset 0 -0.3vh 0.5vh rgba(124, 45, 18, 0.4)',
                      borderColor: 'rgba(251, 191, 36, 1)',
                    },
                _active: startDisabled
                  ? undefined
                  : {
                      transform: 'translateY(-0.2vh) scale(0.98)',
                    },
                _before: startDisabled
                  ? undefined
                  : {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: '-100%',
                      width: '100%',
                      height: '100%',
                      background:
                        'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)',
                      animation: 'shimmer 3s infinite',
                    },
              })}
            >
              ⚔️ BEGIN BATTLE ⚔️
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Playing phase: main game board and controls.
 */
function PlayingPhase({ onOpenGuide }: { onOpenGuide: () => void }) {
  const { state, isMyTurn, lastError, clearError, rosterStatus } = useRithmomachia()

  // Get abacus settings for native abacus numbers
  const { data: abacusSettings } = useAbacusSettings()
  const useNativeAbacusNumbers = abacusSettings?.nativeAbacusNumbers ?? false

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
          gap: '3',
        })}
      >
        <div>
          <span className={css({ fontWeight: 'bold' })}>Turn: </span>
          <span className={css({ color: state.turn === 'W' ? 'gray.800' : 'gray.600' })}>
            {state.turn === 'W' ? 'White' : 'Black'}
          </span>
        </div>
        <div className={css({ display: 'flex', gap: '2', alignItems: 'center' })}>
          <button
            type="button"
            data-action="open-guide-playing"
            onClick={onOpenGuide}
            className={css({
              px: '3',
              py: '1',
              bg: 'linear-gradient(135deg, #7c2d12, #92400e)',
              color: 'white',
              border: '1px solid rgba(251, 191, 36, 0.6)',
              borderRadius: 'md',
              fontSize: 'sm',
              fontWeight: 'semibold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '1',
              transition: 'all 0.2s',
              _hover: {
                bg: 'linear-gradient(135deg, #92400e, #7c2d12)',
                transform: 'translateY(-1px)',
              },
            })}
          >
            <span>📖</span>
            <span>Guide</span>
          </button>
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
