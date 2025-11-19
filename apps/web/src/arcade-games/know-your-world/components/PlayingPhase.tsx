'use client'

import { useEffect, useState, useRef } from 'react'
import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'
import { useKnowYourWorld } from '../Provider'
import { getFilteredMapData } from '../maps'
import { MapRenderer } from './MapRenderer'

export function PlayingPhase() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { state, clickRegion, lastError, clearError } = useKnowYourWorld()

  const [pointerLocked, setPointerLocked] = useState(false)
  const [showLockPrompt, setShowLockPrompt] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

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

  // Set up pointer lock event listeners
  useEffect(() => {
    const handlePointerLockChange = () => {
      const isLocked = document.pointerLockElement === containerRef.current
      console.log('[PlayingPhase] Pointer lock change event:', {
        isLocked,
        pointerLockElement: document.pointerLockElement,
        containerElement: containerRef.current,
        elementsMatch: document.pointerLockElement === containerRef.current,
      })
      setPointerLocked(isLocked)
      console.log('[Pointer Lock]', isLocked ? '🔒 LOCKED' : '🔓 UNLOCKED')
    }

    const handlePointerLockError = () => {
      console.error('[Pointer Lock] ❌ Failed to acquire pointer lock')
      setPointerLocked(false)
      setShowLockPrompt(true) // Show prompt again if lock fails
    }

    document.addEventListener('pointerlockchange', handlePointerLockChange)
    document.addEventListener('pointerlockerror', handlePointerLockError)

    console.log('[PlayingPhase] Pointer lock listeners attached')

    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange)
      document.removeEventListener('pointerlockerror', handlePointerLockError)
      console.log('[PlayingPhase] Pointer lock listeners removed')
    }
  }, [])

  // Release pointer lock when component unmounts (game ends)
  useEffect(() => {
    return () => {
      if (document.pointerLockElement) {
        console.log('[Pointer Lock] 🔓 RELEASING (PlayingPhase unmount)')
        document.exitPointerLock()
      }
    }
  }, [])

  // Request pointer lock on first click
  const handleContainerClick = () => {
    console.log('[PlayingPhase] Container clicked:', {
      pointerLocked,
      hasContainer: !!containerRef.current,
      showLockPrompt,
      willRequestLock: !pointerLocked && containerRef.current && showLockPrompt,
    })

    if (!pointerLocked && containerRef.current && showLockPrompt) {
      console.log('[Pointer Lock] 🔒 REQUESTING pointer lock (user clicked)')
      try {
        containerRef.current.requestPointerLock()
        console.log('[Pointer Lock] Request sent successfully')
      } catch (error) {
        console.error('[Pointer Lock] Request failed with error:', error)
      }
      setShowLockPrompt(false) // Hide prompt after first click
    }
  }

  // Log when pointerLocked state changes
  useEffect(() => {
    console.log('[PlayingPhase] pointerLocked state changed:', pointerLocked)
  }, [pointerLocked])

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
      ref={containerRef}
      data-component="playing-phase"
      onClick={handleContainerClick}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '4',
        paddingTop: '20',
        paddingX: '4',
        paddingBottom: '4',
        maxWidth: '1200px',
        margin: '0 auto',
        position: 'relative',
      })}
    >
      {/* Pointer Lock Prompt Overlay */}
      {showLockPrompt && !pointerLocked && (
        <div
          data-element="pointer-lock-prompt"
          className={css({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            bg: isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.95)',
            color: isDark ? 'white' : 'gray.900',
            padding: '8',
            rounded: 'xl',
            border: '3px solid',
            borderColor: 'blue.500',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
            zIndex: 10000,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            _hover: {
              transform: 'translate(-50%, -50%) scale(1.05)',
              borderColor: 'blue.400',
            },
          })}
        >
          <div className={css({ fontSize: '4xl', marginBottom: '4' })}>🎯</div>
          <div className={css({ fontSize: 'xl', fontWeight: 'bold', marginBottom: '2' })}>
            Enable Precision Controls
          </div>
          <div className={css({ fontSize: 'sm', color: isDark ? 'gray.400' : 'gray.600' })}>
            Click anywhere to lock cursor and enable precise clicking on tiny regions
          </div>
        </div>
      )}
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
        pointerLocked={pointerLocked}
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
