'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { css } from '@styled/css'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSpring, animated } from '@react-spring/web'
import { useViewerId } from '@/lib/arcade/game-sdk'
import { useMyAbacus } from '@/contexts/MyAbacusContext'
import { useTheme } from '@/contexts/ThemeContext'
import {
  calculateBoundingBox,
  DEFAULT_DIFFICULTY_CONFIG,
  getAssistanceLevel,
  getCountryFlagEmoji,
  USA_MAP,
  WORLD_MAP,
} from '../maps'
import { useKnowYourWorld } from '../Provider'
import { getNthNonSpaceLetter } from '../Validator'
import type { MapData } from '../types'
import type { FeedbackType } from '../utils/hotColdPhrases'
import {
  shouldShowGuidanceDropdown,
  shouldShowAutoHintToggle,
  shouldShowAutoSpeakToggle,
} from '../utils/guidanceVisibility'
import { SimpleLetterKeyboard, useIsTouchDevice } from './SimpleLetterKeyboard'

// Animation duration in ms - must match MapRenderer
const GIVE_UP_ANIMATION_DURATION = 2000
// Duration for the "attention grab" phase of the name display (ms)
const NAME_ATTENTION_DURATION = 3000
// React-spring config for smooth takeover transitions
const TAKEOVER_ANIMATION_CONFIG = { tension: 170, friction: 20 }

// Helper to get hot/cold feedback emoji (matches MapRenderer's getHotColdEmoji)
function getHotColdEmoji(type: FeedbackType | null | undefined): string {
  if (!type) return '🔥'
  switch (type) {
    case 'found_it':
      return '🎯'
    case 'on_fire':
      return '🔥'
    case 'hot':
      return '🥵'
    case 'warmer':
      return '☀️'
    case 'colder':
      return '🌧️'
    case 'cold':
      return '🥶'
    case 'freezing':
      return '❄️'
    case 'overshot':
      return '↩️'
    case 'stuck':
      return '🤔'
    default:
      return '🔥'
  }
}

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
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { state, lastError, clearError, giveUp, confirmLetter, controlsState, setIsInTakeover } =
    useKnowYourWorld()

  // Destructure controls state from context
  const {
    showHotCold,
    hotColdEnabled,
    onHotColdToggle,
    currentHint,
    isGiveUpAnimating,
    // Speech/audio state
    isSpeechSupported,
    isSpeaking,
    onSpeak,
    onStopSpeaking,
    // Auto settings
    autoSpeak,
    onAutoSpeakToggle,
    autoHint,
    onAutoHintToggle,
  } = controlsState

  // Get game state values
  const { giveUpVotes = [], activeUserIds = [], gameMode } = state

  // Get viewer ID for vote checking
  const { data: viewerId } = useViewerId()

  // Touch device detection for virtual keyboard
  const isTouchDevice = useIsTouchDevice()

  // Get MyAbacus context to hide it when virtual keyboard is shown
  const { setIsHidden: setAbacusHidden } = useMyAbacus()

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

  // During give-up animation, show the given-up region's name instead of the next region
  const displayRegionName = isGiveUpAnimating
    ? (state.giveUpReveal?.regionName ?? currentRegionName)
    : currentRegionName
  const displayRegionId = isGiveUpAnimating
    ? (state.giveUpReveal?.regionId ?? currentRegionId)
    : currentRegionId

  // Get flag emoji for the displayed region (not necessarily the current prompt)
  const displayFlagEmoji =
    selectedMap === 'world' && displayRegionId ? getCountryFlagEmoji(displayRegionId) : ''

  // Get the region's SVG path for the takeover shape display
  const displayRegionShape = useMemo(() => {
    if (!displayRegionId) return null
    const region = mapData.regions.find((r) => r.id === displayRegionId)
    if (!region?.path) return null

    // Calculate bounding box with padding for the viewBox
    const bbox = calculateBoundingBox([region.path])
    const padding = Math.max(bbox.width, bbox.height) * 0.1 // 10% padding
    const viewBox = `${bbox.minX - padding} ${bbox.minY - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`

    return {
      path: region.path,
      viewBox,
    }
  }, [displayRegionId, mapData.regions])

  // Track if animation is in progress (local state based on timestamp)
  const [isAnimating, setIsAnimating] = useState(false)

  // Track if we're in the "attention grab" phase for the name display
  const [isAttentionPhase, setIsAttentionPhase] = useState(false)

  // Name confirmation progress from shared state (synced across sessions)
  const confirmedLetterCount = state.nameConfirmationProgress ?? 0
  const [nameConfirmed, setNameConfirmed] = useState(false)

  // Optimistic letter count ref - prevents race conditions when typing fast
  // This is updated immediately on keypress, before server responds
  const optimisticLetterCountRef = useRef(confirmedLetterCount)

  // Get assistance level config
  const assistanceConfig = useMemo(() => {
    return getAssistanceLevel(state.assistanceLevel)
  }, [state.assistanceLevel])

  // Check if name confirmation is required (learning mode)
  const requiresNameConfirmation = assistanceConfig.nameConfirmationLetters ?? 0
  const isLearningMode = state.assistanceLevel === 'learning'

  // Ref to measure the takeover container (region name + instructions)
  const takeoverContainerRef = useRef<HTMLDivElement>(null)

  // Calculate the safe scale factor based on viewport size
  const [safeScale, setSafeScale] = useState(2.5)

  // Measure container and calculate safe scale when region changes or window resizes
  useLayoutEffect(() => {
    if (!currentRegionName || !isLearningMode) return

    const measureAndUpdate = () => {
      if (takeoverContainerRef.current) {
        const rect = takeoverContainerRef.current.getBoundingClientRect()

        // Calculate max scale that keeps element within viewport bounds
        // Leave 40px padding on each side
        const maxWidthScale = rect.width > 0 ? (window.innerWidth - 80) / rect.width : 2.5
        const maxHeightScale = rect.height > 0 ? (window.innerHeight - 80) / rect.height : 2.5
        // Use the smaller of width/height constraints, clamped between 1.5 and 3.5
        const calculatedScale = Math.min(maxWidthScale, maxHeightScale)
        setSafeScale(Math.max(1.5, Math.min(3.5, calculatedScale)))
      }
    }

    // Use requestAnimationFrame to ensure text has rendered
    const rafId = requestAnimationFrame(measureAndUpdate)

    // Also update on resize
    window.addEventListener('resize', measureAndUpdate)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', measureAndUpdate)
    }
  }, [currentRegionName, isLearningMode])

  // Calculate takeover progress based on letters typed (0 = full takeover, 1 = complete)
  // Suppress takeover during give up animation to avoid visual conflict
  const takeoverProgress = useMemo(() => {
    // During give up animation, suppress takeover (progress = 1 means no takeover)
    if (isGiveUpAnimating) return 1
    if (!isLearningMode || requiresNameConfirmation === 0) return 1
    const progress = Math.min(1, confirmedLetterCount / requiresNameConfirmation)
    console.log('[GameInfoPanel] takeoverProgress:', {
      confirmedLetterCount,
      requiresNameConfirmation,
      progress,
      stateProgress: state.nameConfirmationProgress,
    })
    return progress
  }, [
    isLearningMode,
    requiresNameConfirmation,
    confirmedLetterCount,
    isGiveUpAnimating,
    state.nameConfirmationProgress,
  ])

  // Spring animation for scale only - position is handled by CSS centering
  const takeoverSpring = useSpring({
    scale: safeScale - (safeScale - 1) * takeoverProgress,
    config: TAKEOVER_ANIMATION_CONFIG,
  })

  // Memoize whether we're in active takeover mode
  const isInTakeoverLocal = isLearningMode && takeoverProgress < 1
  const showPulseAnimation = isLearningMode && takeoverProgress < 0.5

  // Sync takeover state to context (so MapRenderer can suppress hot/cold feedback)
  useEffect(() => {
    setIsInTakeover(isInTakeoverLocal)
  }, [isInTakeoverLocal, setIsInTakeover])

  // Hide the MyAbacus when virtual keyboard is shown (touch devices only)
  // This prevents the floating abacus button from overlapping with the keyboard
  const shouldShowVirtualKeyboard =
    isTouchDevice &&
    !isGiveUpAnimating &&
    requiresNameConfirmation > 0 &&
    !nameConfirmed &&
    !!currentRegionName

  useEffect(() => {
    setAbacusHidden(shouldShowVirtualKeyboard)
    // Cleanup: ensure we unhide when component unmounts
    return () => setAbacusHidden(false)
  }, [shouldShowVirtualKeyboard, setAbacusHidden])

  // Reset local UI state when region changes
  // Note: nameConfirmationProgress is reset on the server when prompt changes
  useEffect(() => {
    if (currentRegionId) {
      setNameConfirmed(false)
      setIsAttentionPhase(true)

      // End attention phase after duration
      const timeout = setTimeout(() => {
        setIsAttentionPhase(false)
      }, NAME_ATTENTION_DURATION)

      return () => clearTimeout(timeout)
    }
  }, [currentRegionId])

  // Check if all required letters have been confirmed
  useEffect(() => {
    if (
      requiresNameConfirmation > 0 &&
      confirmedLetterCount >= requiresNameConfirmation &&
      !nameConfirmed
    ) {
      setNameConfirmed(true)
      onHintsUnlock?.()
    }
  }, [confirmedLetterCount, requiresNameConfirmation, nameConfirmed, onHintsUnlock])

  // Sync optimistic ref with server state when it arrives
  // This ensures we stay in sync if server rejects a move
  useEffect(() => {
    optimisticLetterCountRef.current = confirmedLetterCount
  }, [confirmedLetterCount])

  // Reset optimistic ref when region changes
  useEffect(() => {
    optimisticLetterCountRef.current = 0
  }, [currentRegionName])

  // Listen for keypresses to confirm letters (only when name confirmation is required)
  // Dispatches to shared state so all multiplayer sessions see the same progress
  useEffect(() => {
    if (requiresNameConfirmation === 0 || nameConfirmed || !currentRegionName) {
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Use optimistic count to prevent race conditions when typing fast
      const nextLetterIndex = optimisticLetterCountRef.current
      if (nextLetterIndex >= requiresNameConfirmation) {
        return // Already confirmed all required letters
      }

      // Get the nth non-space letter (skipping spaces in the name)
      // e.g., "US Virgin Islands" → letter 0='U', 1='S', 2='V' (skips the space)
      const letterInfo = getNthNonSpaceLetter(currentRegionName, nextLetterIndex)
      if (!letterInfo) {
        return // No more letters to confirm
      }

      const expectedLetter = letterInfo.char.toLowerCase()
      const pressedLetter = e.key.toLowerCase()

      // Only accept single character keys (letters only, no space needed since we skip spaces)
      if (pressedLetter.length === 1 && /[a-z]/i.test(pressedLetter)) {
        if (pressedLetter === expectedLetter) {
          // Optimistically advance count before server responds
          optimisticLetterCountRef.current = nextLetterIndex + 1
          // Dispatch to shared state - server validates and broadcasts to all sessions
          confirmLetter(pressedLetter, nextLetterIndex)
        }
        // Ignore wrong characters silently (no feedback, no backspace needed)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [requiresNameConfirmation, nameConfirmed, currentRegionName, confirmLetter])

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
        // Don't trigger if we're waiting for name confirmation letters
        if (requiresNameConfirmation > 0 && !nameConfirmed) {
          return
        }
        handleGiveUp()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleGiveUp, requiresNameConfirmation, nameConfirmed])

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
        @keyframes takeoverPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
      `}</style>

      {/* Takeover overlay - contains scrim backdrop, region shape, and takeover text */}
      {/* All children share the same stacking context */}
      <div
        data-element="takeover-overlay"
        className={css({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 150,
          pointerEvents: 'none',
          // Smooth transition for the whole overlay
          transition: 'opacity 0.3s ease-out',
        })}
        style={{
          opacity: isInTakeoverLocal ? 1 : 0,
        }}
      >
        {/* Backdrop scrim with blur */}
        <div
          data-element="takeover-scrim"
          className={css({
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          })}
          style={{
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        />

        {/* Region shape silhouette */}
        {displayRegionShape && (
          <svg
            data-element="takeover-region-shape"
            viewBox={displayRegionShape.viewBox}
            preserveAspectRatio="xMidYMid meet"
            className={css({
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            })}
          >
            <path
              d={displayRegionShape.path}
              fill={isDark ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.35)'}
            />
          </svg>
        )}

        {/* Takeover text - CSS centered, only scale is animated */}
        <animated.div
          data-element="takeover-content"
          className={css({
            position: 'absolute',
            // CSS centering
            top: '50%',
            left: '50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transformOrigin: 'center center',
          })}
          style={{
            // Combine centering translation with animated scale
            transform: takeoverSpring.scale.to((s) => `translate(-50%, -50%) scale(${s})`),
            animation: showPulseAnimation ? 'takeoverPulse 0.8s ease-in-out infinite' : 'none',
          }}
        >
          {/* Region name display */}
          <div
            data-element="takeover-region-name"
            className={css({
              fontSize: { base: 'lg', sm: 'xl', md: '2xl' },
              fontWeight: 'bold',
              color: isDark ? 'white' : 'blue.900',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: { base: '1', sm: '2' },
            })}
            style={{
              textShadow: isDark ? '0 2px 4px rgba(0,0,0,0.5)' : '0 2px 4px rgba(0,0,0,0.2)',
            }}
          >
            {displayFlagEmoji && (
              <span className={css({ fontSize: { base: 'lg', sm: 'xl', md: '2xl' } })}>
                {displayFlagEmoji}
              </span>
            )}
            <span>
              {displayRegionName
                ? (() => {
                    // Track non-space letter index as we iterate
                    let nonSpaceIndex = 0
                    return displayRegionName.split('').map((char, index) => {
                      const isSpace = char === ' '
                      const currentNonSpaceIndex = isSpace ? -1 : nonSpaceIndex

                      // Increment non-space counter AFTER getting current index
                      if (!isSpace) {
                        nonSpaceIndex++
                      }

                      // Spaces are always shown as confirmed (not underlined, full opacity)
                      if (isSpace) {
                        return (
                          <span key={index} className={css({ transition: 'all 0.15s ease-out' })}>
                            {char}
                          </span>
                        )
                      }

                      // For letters, check confirmation status using non-space index
                      const needsConfirmation =
                        !isGiveUpAnimating &&
                        requiresNameConfirmation > 0 &&
                        !nameConfirmed &&
                        currentNonSpaceIndex < requiresNameConfirmation
                      const isConfirmed = currentNonSpaceIndex < confirmedLetterCount
                      const isNextToConfirm =
                        currentNonSpaceIndex === confirmedLetterCount && needsConfirmation

                      return (
                        <span
                          key={index}
                          className={css({ transition: 'all 0.15s ease-out' })}
                          style={{
                            opacity: needsConfirmation && !isConfirmed ? 0.4 : 1,
                            textDecoration: isNextToConfirm ? 'underline' : 'none',
                            textDecorationColor: isNextToConfirm
                              ? isDark
                                ? '#60a5fa'
                                : '#3b82f6'
                              : undefined,
                            textUnderlineOffset: isNextToConfirm ? '4px' : undefined,
                          }}
                        >
                          {char}
                        </span>
                      )
                    })
                  })()
                : '...'}
            </span>
          </div>

          {/* Type-to-unlock instruction */}
          {!isGiveUpAnimating && requiresNameConfirmation > 0 && !nameConfirmed && (
            <div
              data-element="takeover-type-instruction"
              className={css({
                marginTop: '2',
                fontSize: { base: 'sm', sm: 'md' },
                color: isDark ? 'amber.300' : 'amber.700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1.5',
              })}
            >
              <span>⌨️</span>
              <span>Type the underlined letter{requiresNameConfirmation > 1 ? 's' : ''}</span>
            </div>
          )}
        </animated.div>

        {/* On-screen keyboard for mobile/touch devices - OUTSIDE animated container so it doesn't scale */}
        {!isGiveUpAnimating &&
          requiresNameConfirmation > 0 &&
          !nameConfirmed &&
          currentRegionName && (
            <div
              data-element="mobile-keyboard-container"
              className={css({
                position: 'fixed',
                bottom: '0',
                left: '50%',
                transform: 'translateX(-50%)',
                pointerEvents: 'auto',
                zIndex: 160,
                paddingBottom: '2',
                width: '100%',
                maxWidth: '500px',
                px: '2',
              })}
            >
              <SimpleLetterKeyboard
                uppercase={(() => {
                  // Check if the next expected letter is uppercase (skipping spaces)
                  const letterInfo = getNthNonSpaceLetter(currentRegionName, confirmedLetterCount)
                  if (!letterInfo) return false
                  return letterInfo.char.toUpperCase() === letterInfo.char
                })()}
                isDark={isDark}
                onKeyPress={(letter) => {
                  const nextLetterIndex = optimisticLetterCountRef.current
                  if (nextLetterIndex >= requiresNameConfirmation) return

                  // Get the nth non-space letter (skipping spaces)
                  const letterInfo = getNthNonSpaceLetter(currentRegionName, nextLetterIndex)
                  if (!letterInfo) return

                  const expectedLetter = letterInfo.char.toLowerCase()
                  const pressedLetter = letter.toLowerCase()

                  if (pressedLetter === expectedLetter) {
                    // Optimistically advance count before server responds
                    optimisticLetterCountRef.current = nextLetterIndex + 1
                    // Dispatch to shared state
                    confirmLetter(pressedLetter, nextLetterIndex)
                  }
                }}
              />
            </div>
          )}
      </div>

      {/* TOP-CENTER: Prompt Display - positioned below game nav (~150px) */}
      {/* Background fills left-to-right as progress increases */}
      <div
        data-element="floating-prompt"
        className={css({
          position: 'absolute',
          top: { base: '130px', sm: '150px' },
          left: '50%',
          transform: 'translateX(-50%)',
          width: { base: '92vw', sm: '420px', md: '500px', lg: '560px' },
          padding: { base: '2', sm: '3' },
          ...floatingPanelBase,
          border: { base: '2px solid', sm: '3px solid' },
          borderColor: 'blue.500',
          rounded: { base: 'xl', sm: '2xl' },
          textAlign: 'center',
          // Overflow handled in inline style to avoid css() recalculation
        })}
        style={{
          animation: 'glowPulse 2s ease-in-out infinite',
          overflow: isInTakeoverLocal ? 'visible' : 'hidden',
          // Prompt pane stays behind scrim; only takeover-container elevates above
          background: isDark
            ? `linear-gradient(to right, rgba(22, 78, 99, 0.3) ${progress}%, rgba(30, 58, 138, 0.25) ${progress}%)`
            : `linear-gradient(to right, rgba(34, 197, 94, 0.25) ${progress}%, rgba(59, 130, 246, 0.2) ${progress}%)`,
        }}
      >
        {/* Remaining count - centered at top */}
        <div
          data-element="remaining-count"
          className={css({
            fontSize: { base: 'xs', sm: 'sm' },
            fontWeight: 'bold',
            color: isDark ? 'cyan.300' : 'cyan.700',
            marginBottom: '1',
          })}
        >
          {totalRegions - foundCount} left
        </div>
        {/* Header row with Find label and controls */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1',
          })}
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
          {/* Right side controls: Give Up button and Guidance dropdown */}
          <div className={css({ display: 'flex', alignItems: 'center', gap: '1.5' })}>
            {/* Give Up button - subtle design */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (!isGiveUpAnimating) {
                  giveUp()
                }
              }}
              disabled={isGiveUpAnimating}
              data-action="give-up"
              title={
                requiresNameConfirmation > 0 && !nameConfirmed
                  ? 'Type letters first'
                  : "Press 'G' to give up"
              }
              style={{
                ...(isGiveUpAnimating
                  ? { opacity: 0.4, cursor: 'not-allowed', transform: 'none' }
                  : {}),
              }}
              className={css({
                padding: '1 2.5',
                fontSize: 'xs',
                cursor: isGiveUpAnimating ? 'not-allowed' : 'pointer',
                bg: 'transparent',
                color: isDark ? 'blue.400' : 'blue.600',
                rounded: 'md',
                border: '1px solid',
                borderColor: isDark ? 'blue.700' : 'blue.300',
                fontWeight: 'medium',
                transition: 'all 0.15s',
                opacity: 0.7,
                _hover: {
                  opacity: 1,
                  borderColor: isDark ? 'blue.500' : 'blue.400',
                },
                _disabled: {
                  opacity: 0.4,
                  cursor: 'not-allowed',
                },
              })}
            >
              {(() => {
                const isCooperativeMultiplayer =
                  gameMode === 'cooperative' && activeUserIds.length > 1
                const hasLocalSessionVoted = viewerId && giveUpVotes.includes(viewerId)
                const voteCount = giveUpVotes.length
                const totalSessions = activeUserIds.length
                // Show (G) shortcut hint only when not waiting for name confirmation
                const showShortcut = !(requiresNameConfirmation > 0 && !nameConfirmed)

                if (isCooperativeMultiplayer) {
                  if (hasLocalSessionVoted) {
                    return `✓ ${voteCount}/${totalSessions}`
                  }
                  if (voteCount > 0) {
                    return `Give Up ${voteCount}/${totalSessions}`
                  }
                }
                return showShortcut ? 'Give Up (G)' : 'Give Up'
              })()}
            </button>

            {/* Guidance dropdown - only show if there are options to configure */}
            {shouldShowGuidanceDropdown(assistanceConfig) && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    data-action="guidance-dropdown"
                    title="Guidance settings"
                    className={css({
                      padding: '1 2',
                      fontSize: 'xs',
                      cursor: 'pointer',
                      bg: 'transparent',
                      color: isDark ? 'blue.400' : 'blue.600',
                      rounded: 'md',
                      border: '1px solid',
                      borderColor: isDark ? 'blue.700' : 'blue.300',
                      fontWeight: 'medium',
                      transition: 'all 0.15s',
                      opacity: 0.7,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1',
                      _hover: {
                        opacity: 1,
                        borderColor: isDark ? 'blue.500' : 'blue.400',
                      },
                    })}
                  >
                    <span>⚙️</span>
                    <svg
                      className={css({ w: '3', h: '3' })}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    data-element="guidance-dropdown-content"
                    className={css({
                      bg: isDark ? 'gray.800' : 'white',
                      border: '1px solid',
                      borderColor: isDark ? 'gray.700' : 'gray.200',
                      rounded: 'lg',
                      shadow: 'lg',
                      padding: '2',
                      minWidth: '160px',
                      zIndex: 1000,
                    })}
                    sideOffset={5}
                    align="end"
                  >
                    {/* Auto-Show Hints toggle - only if hints are available */}
                    {shouldShowAutoHintToggle(assistanceConfig) &&
                      (() => {
                        const isLocked = requiresNameConfirmation > 0 && !nameConfirmed
                        return (
                          <DropdownMenu.CheckboxItem
                            data-setting="auto-hint"
                            checked={autoHint}
                            disabled={isLocked}
                            onCheckedChange={() => !isLocked && onAutoHintToggle()}
                            className={css({
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2',
                              padding: '2',
                              fontSize: 'xs',
                              cursor: isLocked ? 'not-allowed' : 'pointer',
                              rounded: 'md',
                              color: isLocked
                                ? isDark
                                  ? 'gray.500'
                                  : 'gray.400'
                                : isDark
                                  ? 'gray.200'
                                  : 'gray.700',
                              outline: 'none',
                              opacity: isLocked ? 0.6 : 1,
                              _hover: isLocked
                                ? {}
                                : {
                                    bg: isDark ? 'gray.700' : 'gray.100',
                                  },
                              _focus: isLocked
                                ? {}
                                : {
                                    bg: isDark ? 'gray.700' : 'gray.100',
                                  },
                            })}
                          >
                            {isLocked ? (
                              <span>🔒</span>
                            ) : (
                              <DropdownMenu.ItemIndicator>
                                <span>✓</span>
                              </DropdownMenu.ItemIndicator>
                            )}
                            <span className={css({ marginLeft: isLocked || autoHint ? '0' : '4' })}>
                              💡 Auto-Show Hints
                            </span>
                          </DropdownMenu.CheckboxItem>
                        )
                      })()}

                    {/* Auto-speak toggle - only if speech supported AND hints available */}
                    {isSpeechSupported &&
                      shouldShowAutoSpeakToggle(assistanceConfig) &&
                      (() => {
                        const isLocked = requiresNameConfirmation > 0 && !nameConfirmed
                        return (
                          <DropdownMenu.CheckboxItem
                            data-setting="auto-speak"
                            checked={autoSpeak}
                            disabled={isLocked}
                            onCheckedChange={() => !isLocked && onAutoSpeakToggle()}
                            className={css({
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2',
                              padding: '2',
                              fontSize: 'xs',
                              cursor: isLocked ? 'not-allowed' : 'pointer',
                              rounded: 'md',
                              color: isLocked
                                ? isDark
                                  ? 'gray.500'
                                  : 'gray.400'
                                : isDark
                                  ? 'gray.200'
                                  : 'gray.700',
                              outline: 'none',
                              opacity: isLocked ? 0.6 : 1,
                              _hover: isLocked
                                ? {}
                                : {
                                    bg: isDark ? 'gray.700' : 'gray.100',
                                  },
                              _focus: isLocked
                                ? {}
                                : {
                                    bg: isDark ? 'gray.700' : 'gray.100',
                                  },
                            })}
                          >
                            {isLocked ? (
                              <span>🔒</span>
                            ) : (
                              <DropdownMenu.ItemIndicator>
                                <span>✓</span>
                              </DropdownMenu.ItemIndicator>
                            )}
                            <span
                              className={css({ marginLeft: isLocked || autoSpeak ? '0' : '4' })}
                            >
                              🔈 Auto Speak
                            </span>
                          </DropdownMenu.CheckboxItem>
                        )
                      })()}

                    {/* Hot/Cold toggle - only if available */}
                    {showHotCold &&
                      (() => {
                        const isLocked = requiresNameConfirmation > 0 && !nameConfirmed
                        return (
                          <>
                            <DropdownMenu.Separator
                              className={css({
                                height: '1px',
                                bg: isDark ? 'gray.700' : 'gray.200',
                                margin: '1 0',
                              })}
                            />
                            <DropdownMenu.CheckboxItem
                              data-setting="hot-cold"
                              checked={hotColdEnabled}
                              disabled={isLocked}
                              onCheckedChange={() => !isLocked && onHotColdToggle?.()}
                              className={css({
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2',
                                padding: '2',
                                fontSize: 'xs',
                                cursor: isLocked ? 'not-allowed' : 'pointer',
                                rounded: 'md',
                                color: isLocked
                                  ? isDark
                                    ? 'gray.500'
                                    : 'gray.400'
                                  : isDark
                                    ? 'gray.200'
                                    : 'gray.700',
                                outline: 'none',
                                opacity: isLocked ? 0.6 : 1,
                                _hover: isLocked
                                  ? {}
                                  : {
                                      bg: isDark ? 'gray.700' : 'gray.100',
                                    },
                                _focus: isLocked
                                  ? {}
                                  : {
                                      bg: isDark ? 'gray.700' : 'gray.100',
                                    },
                              })}
                            >
                              {isLocked ? (
                                <span>🔒</span>
                              ) : (
                                <DropdownMenu.ItemIndicator>
                                  <span>✓</span>
                                </DropdownMenu.ItemIndicator>
                              )}
                              <span
                                className={css({
                                  marginLeft: isLocked || hotColdEnabled ? '0' : '4',
                                })}
                              >
                                {hotColdEnabled ? '🔥' : '❄️'} Hot/Cold
                              </span>
                            </DropdownMenu.CheckboxItem>
                          </>
                        )
                      })()}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
          </div>
        </div>
        {/* Region name container - ref used for measuring position for takeover */}
        {/* Content hidden during takeover (shown in overlay instead) */}
        <div
          ref={takeoverContainerRef}
          data-element="region-name-container"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
          })}
          style={{
            // Hide during takeover since it's shown in the overlay
            visibility: isInTakeoverLocal ? 'hidden' : 'visible',
          }}
        >
          {/* Region name display */}
          <div
            data-element="region-name-display"
            className={css({
              fontSize: { base: 'lg', sm: 'xl', md: '2xl' },
              fontWeight: 'bold',
              color: isDark ? 'white' : 'blue.900',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: { base: '1', sm: '2' },
            })}
            style={{
              textShadow: isDark ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
            }}
          >
            {displayFlagEmoji && (
              <span className={css({ fontSize: { base: 'lg', sm: 'xl', md: '2xl' } })}>
                {displayFlagEmoji}
              </span>
            )}
            <span>
              {displayRegionName
                ? (() => {
                    // Track non-space letter index as we iterate
                    let nonSpaceIndex = 0
                    return displayRegionName.split('').map((char, index) => {
                      const isSpace = char === ' '
                      const currentNonSpaceIndex = isSpace ? -1 : nonSpaceIndex

                      // Increment non-space counter AFTER getting current index
                      if (!isSpace) {
                        nonSpaceIndex++
                      }

                      // Spaces are always shown as confirmed (not underlined, full opacity)
                      if (isSpace) {
                        return (
                          <span key={index} className={css({ transition: 'all 0.15s ease-out' })}>
                            {char}
                          </span>
                        )
                      }

                      // For letters, check confirmation status using non-space index
                      const needsConfirmation =
                        !isGiveUpAnimating &&
                        requiresNameConfirmation > 0 &&
                        !nameConfirmed &&
                        currentNonSpaceIndex < requiresNameConfirmation
                      const isConfirmed = currentNonSpaceIndex < confirmedLetterCount
                      const isNextToConfirm =
                        currentNonSpaceIndex === confirmedLetterCount && needsConfirmation

                      return (
                        <span
                          key={index}
                          className={css({ transition: 'all 0.15s ease-out' })}
                          style={{
                            opacity: needsConfirmation && !isConfirmed ? 0.4 : 1,
                            textDecoration: isNextToConfirm ? 'underline' : 'none',
                            textDecorationColor: isNextToConfirm
                              ? isDark
                                ? '#60a5fa'
                                : '#3b82f6'
                              : undefined,
                            textUnderlineOffset: isNextToConfirm ? '4px' : undefined,
                          }}
                        >
                          {char}
                        </span>
                      )
                    })
                  })()
                : '...'}
            </span>
          </div>

          {/* Type-to-unlock instruction */}
          {!isGiveUpAnimating && requiresNameConfirmation > 0 && !nameConfirmed && (
            <div
              data-element="type-to-unlock"
              className={css({
                marginTop: '2',
                fontSize: { base: 'sm', sm: 'md' },
                color: isDark ? 'amber.300' : 'amber.700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1.5',
              })}
            >
              <span>⌨️</span>
              <span>Type the underlined letter{requiresNameConfirmation > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Inline hint - shown after name is confirmed (or always in non-learning modes) */}
        {currentHint && (requiresNameConfirmation === 0 || nameConfirmed) && (
          <div
            data-element="inline-hint"
            className={css({
              marginTop: '2',
              fontSize: 'md',
              color: isDark ? 'blue.300' : 'blue.700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1.5',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              maxWidth: '100%',
            })}
          >
            {/* Speaker button - subtle styling */}
            {isSpeechSupported ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (isSpeaking) {
                    onStopSpeaking()
                  } else {
                    onSpeak()
                  }
                }}
                data-action="speak-hint"
                title={isSpeaking ? 'Stop speaking' : 'Read hint aloud'}
                className={css({
                  background: 'transparent',
                  border: 'none',
                  padding: '0',
                  cursor: 'pointer',
                  fontSize: 'inherit',
                  lineHeight: 'inherit',
                  color: 'inherit',
                  opacity: isSpeaking ? 1 : 0.7,
                  transition: 'opacity 0.2s',
                  _hover: { opacity: 1 },
                  flexShrink: 0,
                })}
              >
                {isSpeaking ? '⏹️' : '🔈'}
              </button>
            ) : (
              <span className={css({ opacity: 0.7 })}>💡</span>
            )}
            <span
              className={css({
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              })}
            >
              {currentHint}
            </span>
          </div>
        )}

        {/* Voting status for cooperative mode */}
        {gameMode === 'cooperative' &&
          activeUserIds.length > 1 &&
          giveUpVotes.length > 0 &&
          giveUpVotes.length < activeUserIds.length &&
          viewerId &&
          giveUpVotes.includes(viewerId) && (
            <div
              data-element="give-up-voters"
              className={css({
                marginTop: '2',
                fontSize: 'xs',
                color: isDark ? 'yellow.300' : 'yellow.700',
                textAlign: 'center',
              })}
            >
              Waiting for {activeUserIds.length - giveUpVotes.length} other{' '}
              {activeUserIds.length - giveUpVotes.length === 1 ? 'player' : 'players'}...
            </div>
          )}
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
