'use client'

import { useState, type ComponentType } from 'react'
import { css } from '../../../../../styled-system/css'
import { useGameMode } from '@/contexts/GameModeContext'
import { useGameLayoutMode } from '@/contexts/GameLayoutContext'
import type {
  BaseMatchingCard,
  BaseMatchingConfig,
  MatchingPairsContextValue,
  SetupContentProps,
} from '../types'

// Inject bounce animation
const bounceAnimation = `
@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
}
`

if (typeof document !== 'undefined' && !document.getElementById('generic-setup-animations')) {
  const style = document.createElement('style')
  style.id = 'generic-setup-animations'
  style.textContent = bounceAnimation
  document.head.appendChild(style)
}

export interface GenericSetupPhaseProps<
  TCard extends BaseMatchingCard,
  TConfig extends BaseMatchingConfig,
> {
  /** The matching-pairs context value from useMatchingPairs() */
  ctx: MatchingPairsContextValue<TCard, TConfig>
  /** Variant's SetupContent component */
  SetupContent: ComponentType<SetupContentProps<TConfig>>
}

/**
 * Generic setup phase wrapper that provides:
 * - Config change warning dialog
 * - No-players warning
 * - Turn timer selection for multiplayer
 * - Start/Resume button
 *
 * Renders the variant's SetupContent in the middle.
 */
export function GenericSetupPhase<
  TCard extends BaseMatchingCard,
  TConfig extends BaseMatchingConfig,
>({ ctx, SetupContent }: GenericSetupPhaseProps<TCard, TConfig>) {
  const { state, setConfig, setTurnTimer, startGame, resumeGame, canResumeGame, hasConfigChanged } =
    ctx
  const { activePlayerCount } = useGameMode()
  const layoutMode = useGameLayoutMode()
  const isCompact = layoutMode === 'container'

  // Pause/Resume warning dialog state
  const [showConfigWarning, setShowConfigWarning] = useState(false)
  const [hasSeenWarning, setHasSeenWarning] = useState(false)
  const [pendingConfigChange, setPendingConfigChange] = useState<{
    field: string
    value: any
  } | null>(null)

  const shouldShowWarning = state.pausedGamePhase && !hasSeenWarning && !hasConfigChanged

  // Wrapped setConfig that checks for paused game warning
  const handleSetConfig = (field: string, value: any) => {
    if (shouldShowWarning) {
      setPendingConfigChange({ field, value })
      setShowConfigWarning(true)
    } else {
      setConfig(field, value)
    }
  }

  const applyPendingChange = () => {
    if (pendingConfigChange) {
      setConfig(pendingConfigChange.field, pendingConfigChange.value)
      setHasSeenWarning(true)
      setPendingConfigChange(null)
      setShowConfigWarning(false)
    }
  }

  const cancelConfigChange = () => {
    setPendingConfigChange(null)
    setShowConfigWarning(false)
  }

  const handleStartOrResumeGame = () => {
    if (canResumeGame) {
      resumeGame()
    } else {
      startGame()
    }
  }

  // Build a setConfig that goes through the warning handler
  const wrappedSetConfig = <K extends string>(field: K, value: any) => {
    handleSetConfig(field, value)
  }

  // Extract config from state for the SetupContent
  const config = state as unknown as TConfig

  return (
    <div
      data-component="generic-setup-phase"
      data-compact={isCompact}
      className={css({
        textAlign: 'center',
        padding: isCompact ? '12px 16px' : { base: '12px 16px', sm: '16px 20px', md: '20px' },
        maxWidth: '800px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        height: isCompact ? '100%' : 'auto',
        overflow: isCompact ? 'hidden' : 'auto',
      })}
    >
      <div
        data-element="setup-content"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: isCompact ? '12px' : { base: '8px', sm: '12px', md: '16px' },
          margin: '0 auto',
          flex: 1,
          minHeight: 0,
          width: '100%',
        })}
      >
        {/* Config change warning */}
        {showConfigWarning && (
          <div
            data-element="config-warning-dialog"
            className={css({
              p: '4',
              background:
                'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.15))',
              border: '2px solid',
              borderColor: 'yellow.400',
              rounded: 'xl',
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(251, 191, 36, 0.2)',
            })}
          >
            <p
              className={css({
                color: 'yellow.700',
                fontSize: { base: '15px', md: '17px' },
                fontWeight: 'bold',
                marginBottom: '8px',
              })}
            >
              ⚠️ Warning: Changing Settings Will End Current Game
            </p>
            <p
              className={css({
                color: 'gray.600',
                fontSize: { base: '13px', md: '14px' },
                marginBottom: '12px',
              })}
            >
              You have a paused game in progress. Changing any setting will end it and you won't be
              able to resume.
            </p>
            <div
              className={css({
                display: 'flex',
                gap: '8px',
                justifyContent: 'center',
                flexWrap: 'wrap',
              })}
            >
              <button
                data-action="keep-game"
                className={css({
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                  _hover: {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                  },
                })}
                onClick={cancelConfigChange}
              >
                ✓ Keep Game & Cancel Change
              </button>
              <button
                data-action="end-game"
                className={css({
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                  _hover: {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                  },
                })}
                onClick={applyPendingChange}
              >
                ✗ End Game & Apply Change
              </button>
            </div>
          </div>
        )}

        {/* No players warning */}
        {activePlayerCount === 0 && (
          <div
            data-element="no-players-warning"
            className={css({
              p: '4',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '2px solid',
              borderColor: 'red.300',
              rounded: 'xl',
              textAlign: 'center',
            })}
          >
            <p
              className={css({
                color: 'red.700',
                fontSize: { base: '14px', md: '16px' },
                fontWeight: 'bold',
              })}
            >
              ⚠️ Go back to the arcade to select players before starting the game
            </p>
          </div>
        )}

        {/* Variant-specific setup content */}
        <SetupContent config={config} setConfig={wrappedSetConfig} isCompact={isCompact} />

        {/* Turn Timer (multiplayer only) */}
        {activePlayerCount > 1 && (
          <div data-section="turn-timer-selection">
            <label
              className={css({
                display: 'block',
                fontSize: '20px',
                fontWeight: 'bold',
                marginBottom: '16px',
                color: 'gray.700',
              })}
            >
              Turn Timer
            </label>
            <div
              className={css({
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                flexWrap: 'wrap',
              })}
            >
              {([15, 30, 45, 60] as const).map((timer) => {
                const timerInfo: Record<15 | 30 | 45 | 60, { icon: string; label: string }> = {
                  15: { icon: '💨', label: 'Lightning' },
                  30: { icon: '⚡', label: 'Quick' },
                  45: { icon: '🏃', label: 'Standard' },
                  60: { icon: '🧘', label: 'Relaxed' },
                }
                const isSelected = state.turnTimer === timer

                return (
                  <button
                    key={timer}
                    data-action="select-turn-timer"
                    data-timer={timer}
                    data-selected={isSelected}
                    className={css({
                      border: 'none',
                      borderRadius: { base: '12px', md: '16px' },
                      padding: { base: '12px 16px', sm: '14px 20px', md: '16px 24px' },
                      fontSize: { base: '14px', sm: '15px', md: '16px' },
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      minWidth: { base: '120px', sm: '140px', md: '160px' },
                      textAlign: 'center',
                      background: isSelected
                        ? 'linear-gradient(135deg, #a78bfa, #8b5cf6)'
                        : 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
                      color: isSelected ? 'white' : '#475569',
                      boxShadow: isSelected
                        ? '0 8px 25px rgba(167, 139, 250, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
                        : '0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)',
                      _hover: {
                        transform: 'translateY(-3px) scale(1.02)',
                      },
                    })}
                    onClick={() => {
                      if (shouldShowWarning) {
                        handleSetConfig('turnTimer', timer)
                      } else {
                        setTurnTimer(timer)
                      }
                    }}
                  >
                    <div
                      className={css({
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                      })}
                    >
                      <span className={css({ fontSize: '24px' })}>{timerInfo[timer].icon}</span>
                      <span className={css({ fontSize: '18px', fontWeight: 'bold' })}>
                        {timer}s
                      </span>
                      <span className={css({ fontSize: '12px', opacity: 0.8 })}>
                        {timerInfo[timer].label}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
            <p
              className={css({
                fontSize: '14px',
                color: 'gray.500',
                marginTop: '8px',
              })}
            >
              Time limit for each player's turn
            </p>
          </div>
        )}

        {/* Start/Resume Button */}
        <div
          data-section="start-button-container"
          className={css({
            marginTop: 'auto',
            paddingTop: isCompact ? '12px' : { base: '12px', md: '16px' },
            position: isCompact ? 'relative' : 'sticky',
            bottom: 0,
            background: isCompact ? 'transparent' : 'rgba(255,255,255,0.95)',
            backdropFilter: isCompact ? 'none' : 'blur(10px)',
            borderTop: isCompact ? 'none' : '1px solid rgba(0,0,0,0.1)',
            margin: isCompact ? '0' : '0 -16px -12px -16px',
            padding: isCompact ? '0' : { base: '12px 16px', md: '16px' },
          })}
        >
          <button
            data-action={canResumeGame ? 'resume-game' : 'start-game'}
            className={css({
              background: canResumeGame
                ? 'linear-gradient(135deg, #10b981 0%, #059669 50%, #34d399 100%)'
                : 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 50%, #ff9ff3 100%)',
              color: 'white',
              border: 'none',
              borderRadius: isCompact ? '16px' : { base: '16px', sm: '20px', md: '24px' },
              padding: isCompact
                ? '12px 24px'
                : { base: '14px 28px', sm: '16px 32px', md: '18px 36px' },
              fontSize: isCompact ? '16px' : { base: '16px', sm: '18px', md: '20px' },
              fontWeight: 'black',
              cursor: 'pointer',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: canResumeGame
                ? '0 8px 20px rgba(16, 185, 129, 0.4), inset 0 2px 0 rgba(255,255,255,0.3)'
                : '0 8px 20px rgba(255, 107, 107, 0.4), inset 0 2px 0 rgba(255,255,255,0.3)',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              position: 'relative',
              overflow: 'hidden',
              width: '100%',
              _hover: {
                transform: {
                  base: 'translateY(-2px)',
                  md: 'translateY(-3px) scale(1.02)',
                },
                boxShadow: canResumeGame
                  ? '0 12px 30px rgba(16, 185, 129, 0.6), inset 0 2px 0 rgba(255,255,255,0.3)'
                  : '0 12px 30px rgba(255, 107, 107, 0.6), inset 0 2px 0 rgba(255,255,255,0.3)',
              },
              _active: {
                transform: 'translateY(-1px) scale(1.01)',
              },
            })}
            onClick={handleStartOrResumeGame}
          >
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: isCompact ? '6px' : { base: '6px', md: '8px' },
                justifyContent: 'center',
              })}
            >
              <span
                className={css({
                  fontSize: isCompact ? '18px' : { base: '18px', sm: '20px', md: '24px' },
                  animation: isCompact ? 'none' : 'bounce 2s infinite',
                })}
              >
                {canResumeGame ? '▶️' : '🚀'}
              </span>
              <span>{canResumeGame ? 'RESUME GAME' : 'START GAME'}</span>
              <span
                className={css({
                  fontSize: isCompact ? '18px' : { base: '18px', sm: '20px', md: '24px' },
                  animation: isCompact ? 'none' : 'bounce 2s infinite',
                  animationDelay: '0.5s',
                })}
              >
                🎮
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
