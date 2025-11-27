'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'
import { useKnowYourWorld } from '../Provider'
import type { MapData } from '../types'
import { getCountryFlagEmoji, WORLD_MAP, USA_MAP, DEFAULT_DIFFICULTY_CONFIG } from '../maps'

// Animation duration in ms - must match MapRenderer
const GIVE_UP_ANIMATION_DURATION = 2000

interface GameInfoPanelProps {
  mapData: MapData
  currentRegionName: string | null
  currentRegionId: string | null
  selectedMap: 'world' | 'usa'
  foundCount: number
  totalRegions: number
  progress: number
}

export function GameInfoPanel({
  mapData,
  currentRegionName,
  currentRegionId,
  selectedMap,
  foundCount,
  totalRegions,
  progress,
}: GameInfoPanelProps) {
  // Get flag emoji for world map countries (not USA states)
  const flagEmoji =
    selectedMap === 'world' && currentRegionId ? getCountryFlagEmoji(currentRegionId) : ''
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { state, lastError, clearError, giveUp, requestHint } = useKnowYourWorld()

  // Get current difficulty level config
  const currentDifficultyLevel = useMemo(() => {
    const mapDiffConfig =
      (selectedMap === 'world' ? WORLD_MAP : USA_MAP).difficultyConfig || DEFAULT_DIFFICULTY_CONFIG
    return (
      mapDiffConfig.levels.find((level) => level.id === state.difficulty) || mapDiffConfig.levels[0]
    )
  }, [selectedMap, state.difficulty])

  // Parse error message and format based on difficulty config
  const formattedError = useMemo(() => {
    if (!lastError) return null

    // Check for "CLICKED:" prefix which indicates a wrong click
    if (lastError.startsWith('CLICKED:')) {
      const regionName = lastError.slice('CLICKED:'.length)
      if (currentDifficultyLevel?.wrongClickShowsName) {
        return `That was ${regionName}`
      }
      return null // Just show "Wrong!" without region name
    }

    // Other errors pass through as-is
    return lastError
  }, [lastError, currentDifficultyLevel])

  // Track if animation is in progress (local state based on timestamp)
  const [isAnimating, setIsAnimating] = useState(false)

  // Determine if hints are available based on difficulty config
  const hintsAvailable = useMemo(() => {
    const hintsMode = currentDifficultyLevel?.hintsMode
    if (hintsMode === 'none') return false
    if (hintsMode === 'limited') {
      const limit = currentDifficultyLevel?.hintLimit ?? 0
      return (state.hintsUsed ?? 0) < limit
    }
    return hintsMode === 'onRequest'
  }, [currentDifficultyLevel, state.hintsUsed])

  // Calculate remaining hints for limited mode
  const remainingHints = useMemo(() => {
    if (currentDifficultyLevel?.hintsMode !== 'limited') return null
    const limit = currentDifficultyLevel?.hintLimit ?? 0
    return Math.max(0, limit - (state.hintsUsed ?? 0))
  }, [currentDifficultyLevel, state.hintsUsed])

  // Handle hint request
  const handleHint = useCallback(() => {
    if (hintsAvailable && state.gamePhase === 'playing' && !isAnimating) {
      requestHint()
    }
  }, [hintsAvailable, state.gamePhase, isAnimating, requestHint])

  // Check if animation is in progress based on timestamp
  useEffect(() => {
    if (!state.giveUpReveal?.timestamp) {
      setIsAnimating(false)
      return
    }

    const elapsed = Date.now() - state.giveUpReveal.timestamp
    if (elapsed < GIVE_UP_ANIMATION_DURATION) {
      setIsAnimating(true)
      // Clear animation flag after remaining time
      const timeout = setTimeout(() => {
        setIsAnimating(false)
      }, GIVE_UP_ANIMATION_DURATION - elapsed)
      return () => clearTimeout(timeout)
    } else {
      setIsAnimating(false)
    }
  }, [state.giveUpReveal?.timestamp])

  // Handle give up with keyboard shortcut (G key)
  const handleGiveUp = useCallback(() => {
    if (!isAnimating && state.gamePhase === 'playing') {
      giveUp()
    }
  }, [isAnimating, state.gamePhase, giveUp])

  // Keyboard shortcut for give up (works even in pointer lock mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 'G' key for Give Up
      if (e.key === 'g' || e.key === 'G') {
        // Don't trigger if user is typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return
        }
        handleGiveUp()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleGiveUp])

  // Auto-dismiss errors after 3 seconds
  useEffect(() => {
    if (lastError) {
      const timeout = setTimeout(() => clearError(), 3000)
      return () => clearTimeout(timeout)
    }
  }, [lastError, clearError])

  return (
    <div
      data-component="game-info-panel"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '2',
        padding: '3',
        height: '100%',
        overflow: 'hidden', // No scrolling
      })}
    >
      {/* Top row: Current prompt + Progress inline */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '3',
          minHeight: 0, // Allow shrinking
        })}
      >
        {/* Current Prompt - takes most space */}
        <div
          data-section="current-prompt"
          className={css({
            flex: 1,
            textAlign: 'center',
            padding: '2',
            bg: isDark ? 'blue.900' : 'blue.50',
            rounded: 'md',
            border: '2px solid',
            borderColor: 'blue.500',
            minWidth: 0, // Allow shrinking
            display: 'flex',
            flexDirection: 'column',
            gap: '1',
          })}
        >
          <div
            className={css({
              fontSize: '2xs',
              color: isDark ? 'blue.300' : 'blue.700',
              fontWeight: 'semibold',
            })}
          >
            Find:
          </div>
          <div
            className={css({
              fontSize: 'lg',
              fontWeight: 'bold',
              color: isDark ? 'blue.100' : 'blue.900',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2',
            })}
          >
            {flagEmoji && <span className={css({ fontSize: 'xl' })}>{flagEmoji}</span>}
            <span>{currentRegionName || '...'}</span>
          </div>
        </div>

        {/* Progress - compact */}
        <div
          data-section="progress"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1',
            flexShrink: 0,
          })}
        >
          <div
            className={css({
              fontSize: '2xs',
              color: isDark ? 'gray.400' : 'gray.600',
              fontWeight: 'semibold',
            })}
          >
            Progress
          </div>
          <div
            className={css({
              fontSize: 'xl',
              fontWeight: 'bold',
              color: isDark ? 'green.400' : 'green.600',
            })}
          >
            {foundCount}/{totalRegions}
          </div>
        </div>

        {/* Hint button - only show if hints are enabled */}
        {currentDifficultyLevel?.hintsMode !== 'none' && (
          <button
            data-action="request-hint"
            onClick={handleHint}
            disabled={!hintsAvailable || isAnimating || state.gamePhase !== 'playing'}
            className={css({
              padding: '2',
              fontSize: 'xs',
              fontWeight: 'semibold',
              bg: hintsAvailable
                ? isDark
                  ? 'yellow.800'
                  : 'yellow.100'
                : isDark
                  ? 'gray.700'
                  : 'gray.200',
              color: hintsAvailable
                ? isDark
                  ? 'yellow.200'
                  : 'yellow.800'
                : isDark
                  ? 'gray.500'
                  : 'gray.500',
              border: '2px solid',
              borderColor: hintsAvailable ? 'yellow.500' : isDark ? 'gray.600' : 'gray.300',
              rounded: 'md',
              cursor: hintsAvailable ? 'pointer' : 'not-allowed',
              opacity: hintsAvailable ? 1 : 0.6,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5',
              _hover: hintsAvailable ? { bg: isDark ? 'yellow.700' : 'yellow.200' } : {},
            })}
            title={remainingHints !== null ? `${remainingHints} hints remaining` : 'Show hint'}
          >
            <span>💡</span>
            {remainingHints !== null && (
              <span className={css({ fontSize: '2xs' })}>{remainingHints}</span>
            )}
          </button>
        )}
      </div>

      {/* Error Display - only shows when error exists */}
      {lastError && (
        <div
          data-element="error-banner"
          className={css({
            padding: '2',
            bg: 'red.100',
            color: 'red.900',
            rounded: 'md',
            border: '2px solid',
            borderColor: 'red.500',
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            fontSize: 'sm',
          })}
        >
          <span>⚠️</span>
          <div className={css({ flex: 1, fontWeight: 'bold' })}>
            Wrong!{formattedError ? ` ${formattedError}` : ''}
          </div>
          <button
            onClick={clearError}
            className={css({
              padding: '1',
              fontSize: 'xs',
              cursor: 'pointer',
              fontWeight: 'bold',
            })}
          >
            ✕
          </button>
        </div>
      )}

      {/* Bottom row: Progress bar + metadata inline */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '3',
          minHeight: 0,
        })}
      >
        {/* Progress Bar - takes most space */}
        <div
          className={css({
            flex: 1,
            bg: isDark ? 'gray.800' : 'gray.200',
            rounded: 'full',
            height: '5',
            overflow: 'hidden',
            position: 'relative',
          })}
        >
          <div
            className={css({
              bg: 'green.500',
              height: '100%',
              transition: 'width 0.5s ease',
            })}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Compact metadata */}
        <div
          data-section="game-info"
          className={css({
            display: 'flex',
            gap: '2',
            fontSize: '2xs',
            color: isDark ? 'gray.400' : 'gray.600',
            flexShrink: 0,
          })}
        >
          <span title={mapData.name}>
            {state.gameMode === 'cooperative' && '🤝'}
            {state.gameMode === 'race' && '🏁'}
            {state.gameMode === 'turn-based' && '↔️'}
          </span>
          <span>
            {state.difficulty === 'learning' && '🌱'}
            {state.difficulty === 'easy' && '😊'}
            {state.difficulty === 'normal' && '🎯'}
            {state.difficulty === 'expert' && '🏆'}
            {/* Legacy fallback */}
            {state.difficulty === 'hard' && '🤔'}
          </span>
        </div>
      </div>
    </div>
  )
}
