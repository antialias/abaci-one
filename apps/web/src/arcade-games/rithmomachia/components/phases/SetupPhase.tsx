'use client'

import { SetupPlayerRequirement } from '@/components/nav/SetupPlayerRequirement'
import { useGameMode } from '@/contexts/GameModeContext'
import { css } from '../../../../../styled-system/css'
import { useRithmomachia } from '../../Provider'
import type { RithmomachiaConfig } from '../../types'

export interface SetupPhaseProps {
  onOpenGuide: () => void
}

export function SetupPhase({ onOpenGuide }: SetupPhaseProps) {
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
