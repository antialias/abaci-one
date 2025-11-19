'use client'

import { useEffect } from 'react'
import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'
import { useKnowYourWorld } from '../Provider'
import { getFilteredMapData } from '../maps'
import { MapRenderer } from './MapRenderer'

export function PlayingPhase() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { state, clickRegion, lastError, clearError } = useKnowYourWorld()

  const mapData = getFilteredMapData(state.selectedMap, state.selectedContinent, state.difficulty)
  const totalRegions = mapData.regions.length
  const foundCount = state.regionsFound.length
  const progress = (foundCount / totalRegions) * 100

  // Auto-dismiss errors after 3 seconds
  useEffect(() => {
    if (lastError) {
      const timeout = setTimeout(() => clearError(), 3000)
      return () => clearTimeout(timeout)
    }
  }, [lastError, clearError])

  // Get the display name for the current prompt
  const currentRegionName = state.currentPrompt
    ? mapData.regions.find((r) => r.id === state.currentPrompt)?.name
    : null

  // Debug logging
  console.log('[PlayingPhase] Current prompt lookup:', {
    currentPrompt: state.currentPrompt,
    currentRegionName,
    difficulty: state.difficulty,
    totalFilteredRegions: mapData.regions.length,
    filteredRegionIds: mapData.regions.map((r) => r.id).slice(0, 10),
    regionsToFindCount: state.regionsToFind.length,
    regionsToFindSample: state.regionsToFind.slice(0, 5),
  })

  return (
    <div
      data-component="playing-phase"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '4',
        paddingTop: '20',
        paddingX: '4',
        paddingBottom: '4',
        maxWidth: '1200px',
        margin: '0 auto',
      })}
    >
      {/* Current Prompt */}
      <div
        data-section="current-prompt"
        className={css({
          textAlign: 'center',
          padding: '6',
          bg: isDark ? 'blue.900' : 'blue.50',
          rounded: 'xl',
          border: '3px solid',
          borderColor: 'blue.500',
        })}
      >
        <div
          className={css({
            fontSize: 'sm',
            color: isDark ? 'blue.300' : 'blue.700',
            marginBottom: '2',
            fontWeight: 'semibold',
          })}
        >
          Find this location:
        </div>
        <div
          className={css({
            fontSize: '4xl',
            fontWeight: 'bold',
            color: isDark ? 'blue.100' : 'blue.900',
          })}
        >
          {currentRegionName || '...'}
        </div>
      </div>

      {/* Error Display */}
      {lastError && (
        <div
          data-element="error-banner"
          className={css({
            padding: '4',
            bg: 'red.100',
            color: 'red.900',
            rounded: 'lg',
            border: '2px solid',
            borderColor: 'red.500',
            display: 'flex',
            alignItems: 'center',
            gap: '3',
          })}
        >
          <span className={css({ fontSize: '2xl' })}>⚠️</span>
          <div className={css({ flex: '1' })}>
            <div className={css({ fontWeight: 'bold' })}>Incorrect!</div>
            <div className={css({ fontSize: 'sm' })}>{lastError}</div>
          </div>
          <button
            onClick={clearError}
            className={css({
              padding: '2',
              bg: 'red.200',
              rounded: 'md',
              fontSize: 'sm',
              fontWeight: 'semibold',
              cursor: 'pointer',
              _hover: {
                bg: 'red.300',
              },
            })}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Progress Bar */}
      <div
        data-section="progress"
        className={css({
          bg: isDark ? 'gray.800' : 'gray.200',
          rounded: 'full',
          height: '8',
          overflow: 'hidden',
          position: 'relative',
        })}
      >
        <div
          className={css({
            bg: 'green.500',
            height: '100%',
            transition: 'width 0.5s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          })}
          style={{ width: `${progress}%` }}
        >
          <span
            className={css({
              fontSize: 'sm',
              fontWeight: 'bold',
              color: 'white',
            })}
          >
            {foundCount} / {totalRegions}
          </span>
        </div>
      </div>

      {/* Map */}
      <MapRenderer
        mapData={mapData}
        regionsFound={state.regionsFound}
        currentPrompt={state.currentPrompt}
        difficulty={state.difficulty}
        selectedMap={state.selectedMap}
        selectedContinent={state.selectedContinent}
        onRegionClick={clickRegion}
        guessHistory={state.guessHistory}
        playerMetadata={state.playerMetadata}
      />

      {/* Game Mode Info */}
      <div
        data-section="game-info"
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '3',
          textAlign: 'center',
          fontSize: 'sm',
          color: isDark ? 'gray.400' : 'gray.600',
        })}
      >
        <div>
          <div className={css({ fontWeight: 'bold', color: isDark ? 'gray.300' : 'gray.700' })}>
            Map
          </div>
          <div>{mapData.name}</div>
        </div>
        <div>
          <div className={css({ fontWeight: 'bold', color: isDark ? 'gray.300' : 'gray.700' })}>
            Mode
          </div>
          <div>
            {state.gameMode === 'cooperative' && '🤝 Cooperative'}
            {state.gameMode === 'race' && '🏁 Race'}
            {state.gameMode === 'turn-based' && '↔️ Turn-Based'}
          </div>
        </div>
        <div>
          <div className={css({ fontWeight: 'bold', color: isDark ? 'gray.300' : 'gray.700' })}>
            Difficulty
          </div>
          <div>
            {state.difficulty === 'easy' && '😊 Easy'}
            {state.difficulty === 'hard' && '🤔 Hard'}
          </div>
        </div>
      </div>
    </div>
  )
}
