'use client'

import { css } from '@styled/css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  DEFAULT_DIFFICULTY_CONFIG,
  getAssistanceLevel,
  getCountryFlagEmoji,
  USA_MAP,
  WORLD_MAP,
} from '../maps'
import { useKnowYourWorld } from '../Provider'
import type { MapData } from '../types'

// Animation duration in ms - must match MapRenderer
const GIVE_UP_ANIMATION_DURATION = 2000
// Duration for the "attention grab" phase of the name display (ms)
const NAME_ATTENTION_DURATION = 3000

interface GameInfoPanelProps {
  mapData: MapData
  currentRegionName: string | null
  currentRegionId: string | null
  selectedMap: 'world' | 'usa'
  foundCount: number
  totalRegions: number
  progress: number
  /** Callback when hints are unlocked (after name confirmation) */
  onHintsUnlock?: () => void
}

export function GameInfoPanel({
  mapData,
  currentRegionName,
  currentRegionId,
  selectedMap,
  foundCount,
  totalRegions,
  progress,
  onHintsUnlock,
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

  // Track if we're in the "attention grab" phase for the name display
  const [isAttentionPhase, setIsAttentionPhase] = useState(false)

  // Track name confirmation input
  const [nameInput, setNameInput] = useState('')
  const [nameConfirmed, setNameConfirmed] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Get assistance level config
  const assistanceConfig = useMemo(() => {
    return getAssistanceLevel(state.assistanceLevel)
  }, [state.assistanceLevel])

  // Check if name confirmation is required
  const requiresNameConfirmation = assistanceConfig.nameConfirmationLetters ?? 0

  // Reset name confirmation when region changes
  useEffect(() => {
    if (currentRegionId) {
      setNameInput('')
      setNameConfirmed(false)
      setIsAttentionPhase(true)

      // End attention phase after duration
      const timeout = setTimeout(() => {
        setIsAttentionPhase(false)
      }, NAME_ATTENTION_DURATION)

      // Focus the input after a short delay (let animation start first)
      if (requiresNameConfirmation > 0) {
        setTimeout(() => {
          nameInputRef.current?.focus()
        }, 500)
      }

      return () => clearTimeout(timeout)
    }
  }, [currentRegionId, requiresNameConfirmation])

  // Check if name input matches required letters
  useEffect(() => {
    if (requiresNameConfirmation > 0 && currentRegionName && nameInput.length > 0) {
      const requiredPart = currentRegionName.slice(0, requiresNameConfirmation).toLowerCase()
      const inputPart = nameInput.toLowerCase()
      if (inputPart === requiredPart && !nameConfirmed) {
        setNameConfirmed(true)
        onHintsUnlock?.()
      }
    }
  }, [nameInput, currentRegionName, requiresNameConfirmation, nameConfirmed, onHintsUnlock])

  // Determine if hints are available based on difficulty config
  const hintsAvailable = useMemo(() => {
    // If name confirmation is required but not done yet, hints are locked
    if (requiresNameConfirmation > 0 && !nameConfirmed) {
      return false
    }

    const hintsMode = currentDifficultyLevel?.hintsMode
    if (hintsMode === 'none') return false
    if (hintsMode === 'limited') {
      const limit = currentDifficultyLevel?.hintLimit ?? 0
      return (state.hintsUsed ?? 0) < limit
    }
    return hintsMode === 'onRequest'
  }, [currentDifficultyLevel, state.hintsUsed, requiresNameConfirmation, nameConfirmed])

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

  // Shared styles for floating panels
  const floatingPanelBase = {
    backdropFilter: 'blur(12px)',
    shadow: 'lg',
    zIndex: 50,
  } as const

  return (
    <>
      {/* Global keyframes for animations */}
      <style>{`
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 10px rgba(59, 130, 246, 0.3); }
          50% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.6), 0 0 30px rgba(59, 130, 246, 0.3); }
        }
        @keyframes attentionGrab {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          10% {
            transform: scale(1.25);
            opacity: 1;
            text-shadow: 0 0 20px rgba(59, 130, 246, 0.8), 0 0 40px rgba(59, 130, 246, 0.4);
          }
          60% {
            transform: scale(1.2);
            text-shadow: 0 0 15px rgba(59, 130, 246, 0.6), 0 0 30px rgba(59, 130, 246, 0.3);
          }
          100% {
            transform: scale(1);
            text-shadow: none;
          }
        }
        @keyframes nameShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        @keyframes confirmPop {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        @keyframes slideInFromTop {
          0% { transform: translateX(-50%) translateY(-100%); opacity: 0; }
          100% { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes slideInFromBottom {
          0% { transform: translateX(-50%) translateY(100%); opacity: 0; }
          100% { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `}</style>

      {/* TOP-CENTER: Prompt Display - positioned below game nav (~150px) */}
      <div
        data-element="floating-prompt"
        className={css({
          position: 'absolute',
          top: { base: '160px', sm: '166px' },
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: { base: '280px', sm: '350px', md: '400px' },
          padding: '3',
          bg: isDark ? 'blue.900/95' : 'blue.50/95',
          ...floatingPanelBase,
          border: '3px solid',
          borderColor: 'blue.500',
          rounded: '2xl',
          textAlign: 'center',
        })}
        style={{
          animation: 'glowPulse 2s ease-in-out infinite',
        }}
      >
        <div
          className={css({
            fontSize: 'xs',
            color: isDark ? 'blue.300' : 'blue.700',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: 'wide',
          })}
        >
          🎯 Find
        </div>
        <div
          key={currentRegionId || 'empty'} // Re-trigger animation on change
          data-element="region-name-display"
          className={css({
            fontSize: isAttentionPhase ? { base: '2xl', sm: '3xl' } : { base: 'xl', sm: '2xl' },
            fontWeight: 'bold',
            color: isDark ? 'white' : 'blue.900',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2',
            transition: 'font-size 0.5s ease-out',
          })}
          style={{
            animation: `attentionGrab ${NAME_ATTENTION_DURATION}ms ease-out`,
            textShadow: isDark ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
          }}
        >
          {flagEmoji && (
            <span
              className={css({
                fontSize: isAttentionPhase ? { base: '2xl', sm: '3xl' } : { base: 'xl', sm: '2xl' },
              })}
            >
              {flagEmoji}
            </span>
          )}
          <span>{currentRegionName || '...'}</span>
        </div>

        {/* Name confirmation input - only show if required and not yet confirmed */}
        {requiresNameConfirmation > 0 && !nameConfirmed && currentRegionName && (
          <div
            data-element="name-confirmation"
            className={css({
              display: 'flex',
              flexDirection: { base: 'column', sm: 'row' },
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2',
              marginTop: '2',
            })}
          >
            <input
              ref={nameInputRef}
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={`Type first ${requiresNameConfirmation} letters...`}
              maxLength={requiresNameConfirmation}
              className={css({
                padding: '2',
                fontSize: { base: 'md', sm: 'lg' },
                fontWeight: 'bold',
                textAlign: 'center',
                width: { base: '100%', sm: '120px' },
                bg: isDark ? 'gray.800' : 'white',
                color: isDark ? 'white' : 'gray.900',
                border: '2px solid',
                borderColor:
                  nameInput.length === requiresNameConfirmation
                    ? nameInput.toLowerCase() ===
                      currentRegionName.slice(0, requiresNameConfirmation).toLowerCase()
                      ? 'green.500'
                      : 'red.500'
                    : isDark
                      ? 'gray.600'
                      : 'gray.300',
                rounded: 'md',
                outline: 'none',
                _focus: {
                  borderColor: 'blue.500',
                  boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.3)',
                },
              })}
              style={{
                animation:
                  nameInput.length === requiresNameConfirmation &&
                  nameInput.toLowerCase() !==
                    currentRegionName.slice(0, requiresNameConfirmation).toLowerCase()
                    ? 'nameShake 0.4s ease-in-out'
                    : 'none',
              }}
            />
            <span
              className={css({
                fontSize: 'xs',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              🔒 Type to unlock hints
            </span>
          </div>
        )}

        {/* Show confirmed state briefly */}
        {requiresNameConfirmation > 0 && nameConfirmed && (
          <div
            data-element="name-confirmed"
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1',
              marginTop: '2',
              fontSize: 'sm',
              color: 'green.500',
              fontWeight: 'semibold',
            })}
            style={{
              animation: 'confirmPop 0.3s ease-out',
            }}
          >
            <span>✓</span>
            <span>Hints unlocked!</span>
          </div>
        )}
      </div>

      {/* TOP-LEFT: Progress Indicator - positioned below game nav (~150px) */}
      <div
        data-element="floating-progress"
        className={css({
          position: 'absolute',
          top: { base: '160px', sm: '166px' },
          left: { base: '2', sm: '4' },
          padding: '2 3',
          bg: isDark ? 'gray.800/90' : 'white/90',
          ...floatingPanelBase,
          rounded: 'xl',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1',
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
            fontSize: { base: 'lg', sm: 'xl' },
            fontWeight: 'bold',
            color: isDark ? 'green.400' : 'green.600',
          })}
        >
          {foundCount}/{totalRegions}
        </div>
        {/* Mini progress bar */}
        <div
          className={css({
            width: '60px',
            height: '4px',
            bg: isDark ? 'gray.700' : 'gray.200',
            rounded: 'full',
            overflow: 'hidden',
          })}
        >
          <div
            className={css({
              height: '100%',
              bg: 'green.500',
              transition: 'width 0.5s ease',
            })}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* BOTTOM-CENTER: Error Banner (toast-style) */}
      {lastError && (
        <div
          data-element="floating-error"
          className={css({
            position: 'absolute',
            bottom: { base: '2', sm: '4' },
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '2 4',
            bg: 'red.100/95',
            color: 'red.900',
            rounded: 'xl',
            border: '2px solid',
            borderColor: 'red.500',
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            fontSize: 'sm',
            ...floatingPanelBase,
            maxWidth: { base: 'calc(100% - 16px)', sm: '400px' },
          })}
          style={{
            animation: 'slideInFromBottom 0.3s ease-out',
          }}
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
              color: 'red.700',
              _hover: { color: 'red.900' },
            })}
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}
