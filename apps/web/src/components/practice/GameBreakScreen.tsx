'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { getGame } from '@/lib/arcade/game-registry'
import {
  getPracticeApprovedGames,
  getRandomPracticeApprovedGame,
} from '@/lib/arcade/practice-approved-games'
import { useGameBreakRoom } from '@/hooks/useGameBreakRoom'
import type { GameBreakSelectionMode, PracticeBreakGameConfig } from '@/db/schema/session-plans'
import { GameLayoutProvider } from '@/contexts/GameLayoutContext'
import type { GameResultsReport } from '@/lib/arcade/game-sdk/types'
import { css } from '../../../styled-system/css'
import { PracticeGameModeProvider } from './PracticeGameModeProvider'
import { useGameBreakAudio } from './hooks/useGameBreakAudio'

export interface GameBreakScreenProps {
  isVisible: boolean
  maxDurationMinutes: number
  startTime: number
  student: {
    id: string
    name: string
    emoji: string
    color: string
  }
  onComplete: (reason: 'timeout' | 'gameFinished' | 'skipped', results?: GameResultsReport) => void
  onGameSelected?: (gameType: string) => void
  /** How the game is selected: auto-start or kid-chooses */
  selectionMode?: GameBreakSelectionMode
  /** Pre-selected game name, 'random', or null */
  selectedGame?: string | 'random' | null
  /**
   * Pre-configured game settings, nested by game name.
   * Example: { 'matching': { difficulty: 6, gameType: 'abacus-numeral', skipSetupPhase: true } }
   */
  gameConfig?: PracticeBreakGameConfig
}

type GameBreakPhase = 'initializing' | 'auto-starting' | 'selecting' | 'playing' | 'completed'

export function GameBreakScreen({
  isVisible,
  maxDurationMinutes,
  startTime,
  student,
  onComplete,
  onGameSelected,
  selectionMode = 'kid-chooses',
  selectedGame = null,
  gameConfig,
}: GameBreakScreenProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Use practice-approved games instead of all available games
  const availableGames = useMemo(() => getPracticeApprovedGames(), [])

  // Track the game name to auto-start (resolved from 'random' if needed)
  const [autoStartGameName, setAutoStartGameName] = useState<string | null>(null)

  const [phase, setPhase] = useState<GameBreakPhase>('initializing')
  const [selectedGameName, setSelectedGameName] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const animationFrameRef = useRef<number | null>(null)
  const hasCompletedRef = useRef(false)
  const hasCleanedUpRef = useRef(false)

  // Speak game break cues on phase transitions
  useGameBreakAudio({ phase, isVisible })

  const maxDurationMs = maxDurationMinutes * 60 * 1000

  const { room, isCreating, selectGame, cleanup } = useGameBreakRoom({
    studentName: student.name,
    enabled: isVisible,
    gameConfig,
    onRoomReady: () => {
      if (phase === 'initializing') {
        if (selectionMode === 'auto-start') {
          // Determine which game to auto-start
          let gameName: string | null = null

          if (selectedGame === 'random' || selectedGame === null) {
            // Pick a random practice-approved game
            const randomGame = getRandomPracticeApprovedGame()
            gameName = randomGame?.manifest.name ?? null
          } else {
            // Use the pre-selected game
            gameName = selectedGame
          }

          if (gameName) {
            setAutoStartGameName(gameName)
            setPhase('auto-starting')
          } else {
            // Fallback to kid-chooses if no game available
            setPhase('selecting')
          }
        } else {
          // Kid-chooses mode: show selection screen
          setPhase('selecting')
        }
      }
    },
  })

  // Handle auto-start delay - start game after brief message
  useEffect(() => {
    if (phase === 'auto-starting' && autoStartGameName) {
      const timer = setTimeout(() => {
        handleSelectGame(autoStartGameName)
      }, 1500) // 1.5 second delay to show "Playing X!" message

      return () => clearTimeout(timer)
    }
  }, [phase, autoStartGameName])

  const handleComplete = useCallback(
    async (reason: 'timeout' | 'gameFinished' | 'skipped', gameState?: Record<string, unknown>) => {
      if (hasCompletedRef.current) return
      hasCompletedRef.current = true

      // Generate results report if game finished normally
      let results: GameResultsReport | undefined
      if (reason === 'gameFinished' && gameState && selectedGameName) {
        const game = getGame(selectedGameName)
        // getResultsReport is defined on concrete validator implementations (e.g. MatchingGameValidator)
        // but not on the base GameValidator interface, so we need to check dynamically
        const validator = game?.validator as Record<string, unknown> | undefined
        if (validator && typeof validator.getResultsReport === 'function' && gameConfig) {
          // Get the config for this specific game
          const config = gameConfig[selectedGameName] ?? game!.defaultConfig
          try {
            results = (
              validator.getResultsReport as (
                state: Record<string, unknown>,
                config: unknown
              ) => GameResultsReport
            )(gameState, config)
          } catch (err) {
            console.error('Failed to generate results report:', err)
          }
        }
      }

      if (!hasCleanedUpRef.current) {
        hasCleanedUpRef.current = true
        await cleanup()
      }

      onComplete(reason, results)
    },
    [cleanup, onComplete, selectedGameName, gameConfig]
  )

  const handleSkip = useCallback(() => {
    handleComplete('skipped')
  }, [handleComplete])

  const handleSelectGame = useCallback(
    async (gameName: string) => {
      try {
        await selectGame(gameName)
        setSelectedGameName(gameName)
        setPhase('playing')
        onGameSelected?.(gameName)
      } catch (err) {
        console.error('Failed to select game:', err)
      }
    },
    [selectGame, onGameSelected]
  )

  useEffect(() => {
    if (!isVisible) {
      hasCompletedRef.current = false
      hasCleanedUpRef.current = false
      setElapsedMs(0)
      setPhase('initializing')
      setSelectedGameName(null)
      setAutoStartGameName(null)
      return
    }

    const updateTimer = () => {
      const now = Date.now()
      const elapsed = now - startTime
      setElapsedMs(elapsed)

      if (elapsed >= maxDurationMs) {
        handleComplete('timeout')
      } else {
        animationFrameRef.current = requestAnimationFrame(updateTimer)
      }
    }

    animationFrameRef.current = requestAnimationFrame(updateTimer)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isVisible, startTime, maxDurationMs, handleComplete])

  useEffect(() => {
    return () => {
      if (!hasCleanedUpRef.current) {
        hasCleanedUpRef.current = true
        cleanup()
      }
    }
  }, [cleanup])

  if (!isVisible) return null

  const remainingMs = Math.max(0, maxDurationMs - elapsedMs)
  const remainingMinutes = Math.floor(remainingMs / 60000)
  const remainingSeconds = Math.floor((remainingMs % 60000) / 1000)
  const percentRemaining = (remainingMs / maxDurationMs) * 100

  const activeGame = selectedGameName ? getGame(selectedGameName) : null

  if (phase === 'playing' && activeGame && room?.gameName) {
    const { Provider, GameComponent } = activeGame
    // Game break timer/progress bar is now shown in PracticeSubNav via gameBreakHud prop
    // This component just renders the game itself
    return (
      <div
        data-component="game-break-screen"
        data-phase="playing"
        data-element="game-container"
        className={css({
          // Fill the available space (parent handles positioning)
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        })}
      >
        <GameLayoutProvider mode="container">
          <PracticeGameModeProvider
            student={student}
            roomData={room}
            onGameComplete={(gameState) => handleComplete('gameFinished', gameState)}
          >
            <Provider>
              <GameComponent />
            </Provider>
          </PracticeGameModeProvider>
        </GameLayoutProvider>
      </div>
    )
  }

  return (
    <div
      data-component="game-break-screen"
      data-phase={phase}
      className={css({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.95)' : 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1.5rem',
      })}
    >
      <div
        data-element="game-break-content"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
          padding: '2rem',
          maxWidth: '480px',
          width: '100%',
          backgroundColor: isDark ? 'gray.800' : 'white',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        })}
      >
        <div
          data-element="header"
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          })}
        >
          <div
            data-element="student-badge"
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            })}
          >
            <span
              className={css({
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
              })}
              style={{ backgroundColor: student.color }}
            >
              {student.emoji}
            </span>
            <span
              className={css({
                fontWeight: '600',
                fontSize: '1rem',
                color: isDark ? 'gray.200' : 'gray.700',
              })}
            >
              {student.name}
            </span>
          </div>

          <div
            data-element="timer"
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.375rem 0.75rem',
              borderRadius: '8px',
            })}
            style={{
              backgroundColor:
                percentRemaining > 30
                  ? isDark
                    ? 'rgba(34, 197, 94, 0.2)'
                    : 'rgba(34, 197, 94, 0.1)'
                  : isDark
                    ? 'rgba(234, 179, 8, 0.2)'
                    : 'rgba(234, 179, 8, 0.1)',
            }}
          >
            <span className={css({ fontSize: '1rem' })}>⏱️</span>
            <span
              className={css({
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: '600',
                fontSize: '1rem',
              })}
              style={{
                color:
                  percentRemaining > 30
                    ? isDark
                      ? '#86efac'
                      : '#16a34a'
                    : isDark
                      ? '#fde047'
                      : '#ca8a04',
              }}
            >
              {remainingMinutes}:{remainingSeconds.toString().padStart(2, '0')}
            </span>
          </div>
        </div>

        <div data-element="title-section" className={css({ textAlign: 'center' })}>
          <h2
            className={css({
              fontSize: '1.75rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.800',
              marginBottom: '0.25rem',
            })}
          >
            🎮 Game Break!
          </h2>
          <p
            className={css({
              fontSize: '1rem',
              color: isDark ? 'gray.400' : 'gray.600',
            })}
          >
            {phase === 'initializing'
              ? 'Setting up...'
              : phase === 'auto-starting'
                ? 'Get ready!'
                : phase === 'selecting'
                  ? 'Pick a game to play'
                  : 'Great job!'}
          </p>
        </div>

        {phase === 'initializing' && (
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
            })}
          >
            <span
              className={css({
                fontSize: '1rem',
                color: isDark ? 'gray.400' : 'gray.500',
              })}
            >
              {isCreating ? 'Creating game room...' : 'Preparing...'}
            </span>
          </div>
        )}

        {phase === 'auto-starting' && autoStartGameName && (
          <div
            data-element="auto-start-message"
            className={css({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              padding: '2rem',
            })}
          >
            <span
              className={css({
                fontSize: '4rem',
                animation: 'pulse 1s ease-in-out infinite',
              })}
            >
              {getGame(autoStartGameName)?.manifest.icon ?? '🎮'}
            </span>
            <span
              className={css({
                fontSize: '1.25rem',
                fontWeight: '600',
                color: isDark ? 'gray.200' : 'gray.700',
              })}
            >
              Playing {getGame(autoStartGameName)?.manifest.displayName ?? 'Game'}!
            </span>
            <span
              className={css({
                fontSize: '0.875rem',
                color: isDark ? 'gray.400' : 'gray.500',
              })}
            >
              Starting...
            </span>
          </div>
        )}

        {phase === 'selecting' && (
          <div
            data-element="game-grid"
            className={css({
              display: 'grid',
              gridTemplateColumns:
                availableGames.length <= 3
                  ? `repeat(${availableGames.length}, 1fr)`
                  : 'repeat(3, 1fr)',
              gap: '0.75rem',
              width: '100%',
              maxHeight: '300px',
              overflowY: 'auto',
            })}
          >
            {availableGames.map((game) => {
              // Highlight this game if it's the pre-selected default (in kid-chooses mode)
              const isDefault =
                selectionMode === 'kid-chooses' &&
                selectedGame !== null &&
                selectedGame !== 'random' &&
                game.manifest.name === selectedGame

              return (
                <button
                  key={game.manifest.name}
                  type="button"
                  data-game={game.manifest.name}
                  data-default={isDefault}
                  onClick={() => handleSelectGame(game.manifest.name)}
                  className={css({
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '1rem',
                    borderRadius: '12px',
                    border: '2px solid',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                    _hover: {
                      transform: 'translateY(-2px)',
                    },
                  })}
                  style={{
                    borderColor: isDefault
                      ? isDark
                        ? 'rgba(34, 197, 94, 0.5)'
                        : 'rgba(34, 197, 94, 0.6)'
                      : isDark
                        ? 'rgba(255,255,255,0.1)'
                        : 'rgba(0,0,0,0.08)',
                    backgroundColor: isDefault
                      ? isDark
                        ? 'rgba(34, 197, 94, 0.15)'
                        : 'rgba(34, 197, 94, 0.1)'
                      : isDark
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.02)',
                    boxShadow: isDefault
                      ? `0 0 0 3px ${isDark ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.25)'}`
                      : undefined,
                  }}
                >
                  {isDefault && (
                    <span
                      className={css({
                        position: 'absolute',
                        top: '-8px',
                        right: '-8px',
                        fontSize: '0.625rem',
                        fontWeight: '600',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '4px',
                        backgroundColor: isDark ? 'green.600' : 'green.500',
                        color: 'white',
                      })}
                    >
                      Suggested
                    </span>
                  )}
                  <span className={css({ fontSize: '2rem' })}>{game.manifest.icon}</span>
                  <span
                    className={css({
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      color: isDark ? 'gray.300' : 'gray.600',
                      textAlign: 'center',
                    })}
                  >
                    {game.manifest.displayName}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <button
          type="button"
          data-action="skip-break"
          onClick={handleSkip}
          className={css({
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            fontWeight: '600',
            color: isDark ? 'gray.300' : 'gray.600',
            backgroundColor: isDark ? 'gray.700' : 'gray.200',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            _hover: {
              backgroundColor: isDark ? 'gray.600' : 'gray.300',
            },
          })}
        >
          Back to Practice →
        </button>
      </div>
    </div>
  )
}

export default GameBreakScreen
