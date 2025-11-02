'use client'

import { SetupPlayerRequirement } from '@/components/nav/SetupPlayerRequirement'
import { useGameMode } from '@/contexts/GameModeContext'
import { css } from '../../../../../styled-system/css'
import { useRithmomachia } from '../../Provider'
import type { RithmomachiaConfig } from '../../types'
import { GameRuleCard } from './GameRuleCard'
import { SetupHeader } from './SetupHeader'
import { StartButton } from './StartButton'

export interface SetupPhaseProps {
  onOpenGuide: () => void
  isGuideOpen: boolean
}

export function SetupPhase({ onOpenGuide, isGuideOpen }: SetupPhaseProps) {
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
            <SetupHeader onOpenGuide={onOpenGuide} isGuideOpen={isGuideOpen} />

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
                <GameRuleCard
                  title="Point Victory"
                  description={`Win at ${state.pointWinThreshold}pts`}
                  enabled={state.pointWinEnabled}
                  onClick={() => toggleSetting('pointWinEnabled')}
                  dataAttribute="point-victory"
                >
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
                </GameRuleCard>

                <GameRuleCard
                  title="Threefold Draw"
                  description="Same position 3x"
                  enabled={state.repetitionRule}
                  onClick={() => toggleSetting('repetitionRule')}
                  dataAttribute="threefold-repetition"
                />

                <GameRuleCard
                  title="Fifty-Move Draw"
                  description="50 moves no event"
                  enabled={state.fiftyMoveRule}
                  onClick={() => toggleSetting('fiftyMoveRule')}
                  dataAttribute="fifty-move-rule"
                />

                <GameRuleCard
                  title="Flexible Harmony"
                  description="Any valid set"
                  enabled={state.allowAnySetOnRecheck}
                  onClick={() => toggleSetting('allowAnySetOnRecheck')}
                  dataAttribute="flexible-harmony"
                />
              </div>
            </div>

            <StartButton onClick={startGame} disabled={startDisabled} />
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Playing phase: main game board and controls.
 */
