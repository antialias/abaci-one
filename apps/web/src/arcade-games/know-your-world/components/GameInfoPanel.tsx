'use client'

import { useEffect } from 'react'
import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'
import { useKnowYourWorld } from '../Provider'
import type { MapData } from '../types'

interface GameInfoPanelProps {
  mapData: MapData
  currentRegionName: string | null
  foundCount: number
  totalRegions: number
  progress: number
}

export function GameInfoPanel({
  mapData,
  currentRegionName,
  foundCount,
  totalRegions,
  progress,
}: GameInfoPanelProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { state, lastError, clearError, giveUp } = useKnowYourWorld()

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
            })}
          >
            {currentRegionName || '...'}
          </div>
          <button
            onClick={giveUp}
            data-action="give-up"
            className={css({
              padding: '1',
              fontSize: '2xs',
              cursor: 'pointer',
              bg: isDark ? 'yellow.800' : 'yellow.100',
              color: isDark ? 'yellow.200' : 'yellow.800',
              rounded: 'sm',
              border: '1px solid',
              borderColor: isDark ? 'yellow.600' : 'yellow.400',
              fontWeight: 'bold',
              transition: 'all 0.2s',
              _hover: {
                bg: isDark ? 'yellow.700' : 'yellow.200',
                transform: 'scale(1.02)',
              },
            })}
          >
            Give Up
          </button>
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
          <div className={css({ flex: 1, fontWeight: 'bold' })}>Wrong! {lastError}</div>
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
            {state.difficulty === 'easy' && '😊'}
            {state.difficulty === 'hard' && '🤔'}
          </span>
        </div>
      </div>
    </div>
  )
}
