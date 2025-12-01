'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { css } from '@styled/css'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSpring, animated } from '@react-spring/web'
import { useViewerId } from '@/lib/arcade/game-sdk'
import { useTheme } from '@/contexts/ThemeContext'
import {
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
import { MusicControlModal, useMusic } from '../music'
import simplify from 'simplify-js'
import { useVisualDebugSafe } from '@/contexts/VisualDebugContext'

// Animation duration in ms - must match MapRenderer
const GIVE_UP_ANIMATION_DURATION = 2000
// Duration for the "attention grab" phase of the name display (ms)
const NAME_ATTENTION_DURATION = 3000
// React-spring config for smooth takeover transitions
const TAKEOVER_ANIMATION_CONFIG = { tension: 170, friction: 20 }

/**
 * Get Unicode code points for a string (for debugging)
 */
function getCodePoints(str: string): string {
  return [...str]
    .map((c) => `U+${c.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}`)
    .join(' ')
}

/**
 * Normalize accented characters to their base ASCII letters.
 * e.g., 'é' → 'e', 'ñ' → 'n', 'ü' → 'u', 'ç' → 'c'
 * Uses Unicode NFD normalization to decompose characters, then strips diacritical marks.
 */
function normalizeToBaseLetter(char: string): string {
  const nfd = char.normalize('NFD')
  const stripped = nfd.replace(/[\u0300-\u036f]/g, '')
  const result = stripped.toLowerCase()
  // Debug logging for accent normalization
  if (char !== result) {
    console.log('[Client] normalizeToBaseLetter:', {
      input: char,
      inputCodePoints: getCodePoints(char),
      afterNFD: nfd,
      nfdCodePoints: getCodePoints(nfd),
      afterStrip: stripped,
      result,
    })
  }
  return result
}

/**
 * Convert {x, y} points array to SVG path string.
 */
function pointsToSvgPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  let path = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`
  }
  path += ' Z'
  return path
}

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
  const { isVisualDebugEnabled } = useVisualDebugSafe()
  const {
    state,
    lastError,
    clearError,
    giveUp,
    confirmLetter,
    controlsState,
    setIsInTakeover,
    puzzlePieceTarget,
    setPuzzlePieceTarget,
    setCelebration,
  } = useKnowYourWorld()

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
  const {
    giveUpVotes = [],
    activeUserIds = [],
    gameMode,
    currentPlayer,
    playerMetadata = {},
  } = state

  // Get viewer ID for vote checking
  const { data: viewerId } = useViewerId()

  // Touch device detection for virtual keyboard
  const isTouchDevice = useIsTouchDevice()

  // Track "not your turn" notification
  const [showNotYourTurn, setShowNotYourTurn] = useState(false)

  // Check if it's the local viewer's turn (for turn-based mode)
  const isMyTurn = useMemo(() => {
    if (gameMode !== 'turn-based') return true // Always "your turn" in non-turn-based modes
    if (!currentPlayer || !viewerId) return false
    const currentPlayerMeta = playerMetadata[currentPlayer]
    return currentPlayerMeta?.userId === viewerId
  }, [gameMode, currentPlayer, viewerId, playerMetadata])

  // Get current player's emoji for display
  const currentPlayerEmoji = useMemo(() => {
    if (!currentPlayer) return null
    return playerMetadata[currentPlayer]?.emoji || null
  }, [currentPlayer, playerMetadata])

  // Music context and modal state
  const music = useMusic()
  const [isMusicModalOpen, setIsMusicModalOpen] = useState(false)

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
  const displayRegionPath = useMemo(() => {
    if (!displayRegionId) return null
    const region = mapData.regions.find((r) => r.id === displayRegionId)
    return region?.path ?? null
  }, [displayRegionId, mapData.regions])

  // Ref to hidden path element for accurate getBBox measurement
  const hiddenPathRef = useRef<SVGPathElement>(null)

  // Accurate bounding box from getBBox() - updated when region changes
  const [accurateBBox, setAccurateBBox] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)

  // Simplified path for tracer animation - calculated using browser's native path methods
  const [simplifiedTracerPaths, setSimplifiedTracerPaths] = useState<string[] | null>(null)

  // Measure accurate bounding box AND generate simplified tracer path using hidden SVG
  // This ensures part 1 and part 2 use identical positioning
  useEffect(() => {
    if (hiddenPathRef.current && displayRegionPath) {
      // Use requestAnimationFrame to ensure path is rendered
      requestAnimationFrame(() => {
        if (hiddenPathRef.current) {
          const pathEl = hiddenPathRef.current
          const bbox = pathEl.getBBox()
          setAccurateBBox({
            x: bbox.x,
            y: bbox.y,
            width: bbox.width,
            height: bbox.height,
          })

          // Sample points along the path using browser's native getPointAtLength()
          // This correctly handles all SVG path commands
          const totalLength = pathEl.getTotalLength()
          const numSamples = 500 // Sample more points for better detection of jumps
          const allPoints: Array<{ x: number; y: number }> = []

          for (let i = 0; i <= numSamples; i++) {
            const distance = (i / numSamples) * totalLength
            const point = pathEl.getPointAtLength(distance)
            allPoints.push({ x: point.x, y: point.y })
          }

          // Detect jumps between sub-paths and split into separate segments
          // A jump is when consecutive points are much farther apart than average
          const segments: Array<Array<{ x: number; y: number }>> = []
          let currentSegment: Array<{ x: number; y: number }> = [allPoints[0]]

          // Calculate average distance between consecutive points
          let totalDist = 0
          for (let i = 1; i < allPoints.length; i++) {
            const dx = allPoints[i].x - allPoints[i - 1].x
            const dy = allPoints[i].y - allPoints[i - 1].y
            totalDist += Math.sqrt(dx * dx + dy * dy)
          }
          const avgDist = totalDist / (allPoints.length - 1)
          const jumpThreshold = avgDist * 5 // A jump is 5x the average distance

          for (let i = 1; i < allPoints.length; i++) {
            const dx = allPoints[i].x - allPoints[i - 1].x
            const dy = allPoints[i].y - allPoints[i - 1].y
            const dist = Math.sqrt(dx * dx + dy * dy)

            if (dist > jumpThreshold) {
              // This is a jump - save current segment and start new one
              if (currentSegment.length > 2) {
                segments.push(currentSegment)
              }
              currentSegment = [allPoints[i]]
            } else {
              currentSegment.push(allPoints[i])
            }
          }
          // Don't forget the last segment
          if (currentSegment.length > 2) {
            segments.push(currentSegment)
          }

          // Simplify each segment - keep separate for simultaneous animations on each island
          const tolerance = Math.max(bbox.width, bbox.height) * 0.02 // 2% tolerance (less aggressive)
          const simplifiedSegments = segments.map((seg) => simplify(seg, tolerance, true))

          // Convert each segment to a separate SVG path string
          const pathStrings: string[] = []
          let totalSimplifiedPoints = 0
          for (const simplified of simplifiedSegments) {
            if (simplified.length > 2) {
              let pathStr = `M ${simplified[0].x} ${simplified[0].y}`
              for (let i = 1; i < simplified.length; i++) {
                pathStr += ` L ${simplified[i].x} ${simplified[i].y}`
              }
              pathStr += ' Z'
              pathStrings.push(pathStr)
              totalSimplifiedPoints += simplified.length
            }
          }
          setSimplifiedTracerPaths(pathStrings)

          console.log('[PathSimplify]', {
            regionId: displayRegionId,
            totalLength,
            sampledPoints: allPoints.length,
            segments: segments.length,
            simplifiedPoints: totalSimplifiedPoints,
            reduction: `${Math.round((1 - totalSimplifiedPoints / allPoints.length) * 100)}%`,
          })
        }
      })
    } else {
      setAccurateBBox(null)
      setSimplifiedTracerPaths(null)
    }
  }, [displayRegionPath, displayRegionId])

  // Get the region's SVG path for puzzle piece animation
  // Uses the exact SVG bounding box from getBBox() passed in the target
  const puzzlePieceShape = useMemo(() => {
    if (!puzzlePieceTarget) return null
    const region = mapData.regions.find((r) => r.id === puzzlePieceTarget.regionId)
    if (!region?.path) return null

    // Use the exact SVG bounding box from getBBox() - this is pixel-perfect
    const { x, y, width, height } = puzzlePieceTarget.svgBBox
    const viewBox = `${x} ${y} ${width} ${height}`

    return {
      path: region.path,
      viewBox,
    }
  }, [puzzlePieceTarget, mapData.regions])

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

  // Ref to the takeover region shape SVG for capturing source position
  const takeoverRegionShapeRef = useRef<SVGSVGElement>(null)

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

  // Puzzle piece animation spring - animates from takeover position to map position
  const puzzlePieceSpring = useSpring({
    // Only animate when we have both target and source (sourceRect)
    to: puzzlePieceTarget?.sourceRect
      ? {
          // Target: actual screen position of region on map (top-left coords)
          x: puzzlePieceTarget.x,
          y: puzzlePieceTarget.y,
          width: puzzlePieceTarget.width,
          height: puzzlePieceTarget.height,
          opacity: 1, // Keep visible during animation
        }
      : {
          // Default: centered on screen (fallback)
          x: typeof window !== 'undefined' ? (window.innerWidth - 400) / 2 : 200,
          y: typeof window !== 'undefined' ? (window.innerHeight - 400) / 2 : 100,
          width: 400,
          height: 400,
          opacity: 1,
        },
    from: puzzlePieceTarget?.sourceRect
      ? {
          // Start: actual position from takeover screen
          x: puzzlePieceTarget.sourceRect.x,
          y: puzzlePieceTarget.sourceRect.y,
          width: puzzlePieceTarget.sourceRect.width,
          height: puzzlePieceTarget.sourceRect.height,
          opacity: 1,
        }
      : undefined,
    reset: !!puzzlePieceTarget?.sourceRect,
    config: { tension: 120, friction: 18 },
    onRest: () => {
      if (puzzlePieceTarget) {
        // Animation complete - start celebration
        setCelebration({
          regionId: puzzlePieceTarget.regionId,
          regionName: puzzlePieceTarget.regionName,
          type: puzzlePieceTarget.celebrationType,
          startTime: Date.now(),
        })
        setPuzzlePieceTarget(null)
      }
    },
  })

  // Tracer intensity spring - controls speed, size, opacity, and focus based on letter progress
  // 0 letters = slow/big/faint, all letters = fast/laser-focused/bright
  // All values smoothly animated via react-spring
  const tracerIntensity =
    requiresNameConfirmation > 0 ? confirmedLetterCount / requiresNameConfirmation : 0

  // Exponential curve for more dramatic pickup (x^3 gives steep curve at the end)
  const exponentialIntensity = Math.pow(tracerIntensity, 2.5)

  const tracerSpring = useSpring({
    // Size multiplier: 1.5 (big) → 0.3 (laser-focused)
    sizeScale: 1.5 - exponentialIntensity * 1.2,
    // Glow multiplier: 1.5 (soft/large) → 0.4 (concentrated)
    glowScale: 1.5 - exponentialIntensity * 1.1,
    // Ember size multiplier
    emberScale: 1.0 - exponentialIntensity * 0.6,
    // Overall opacity: 25% at 0 letters → 100% at all letters (smoothly animated)
    overallOpacity: 0.25 + tracerIntensity * 0.75,
    // Speed multiplier for duration calculation: 1 (slow) → 200 (blazing fast)
    // Using exponential curve: 1 → 5 → 40 → 200
    speedMultiplier: 1 + exponentialIntensity * 199,
    config: { tension: 180, friction: 18 },
  })

  // Duration for tracer animation - computed from exponential intensity
  // Base duration 15s divided by speed: 15s → 3s → 0.375s → 0.075s (200x faster at max!)
  const tracerDuration = 15 / (1 + exponentialIntensity * 199)

  // Exponential sparkle counts - dramatic growth but capped for performance
  // Embers: 1 → 3 → 8 → 16 (filtered glow, keep lower)
  // Flying sparks: 2 → 8 → 24 → 48 (no filter, can have more)
  const emberCount =
    requiresNameConfirmation > 0 ? [1, 3, 8, 16][Math.min(confirmedLetterCount, 3)] : 1
  const sparkCount =
    requiresNameConfirmation > 0 ? [2, 8, 24, 48][Math.min(confirmedLetterCount, 3)] : 2

  // Whether we're in puzzle piece animation mode (has sourceRect means animation is active)
  const isPuzzlePieceAnimating =
    puzzlePieceTarget !== null && puzzlePieceTarget.sourceRect !== undefined

  // Whether we're in the "fade back in" phase (target set, waiting for sourceRect capture)
  const isFadingBackIn = puzzlePieceTarget !== null && puzzlePieceTarget.sourceRect === undefined

  // Track if we're showing the laser effect (brief delay after all letters entered)
  const [showingLaserEffect, setShowingLaserEffect] = useState(false)

  // Memoize whether we're in active takeover mode
  // Takeover visible: during typing OR showing laser effect OR fading back in OR during animation
  const isInTakeoverLocal =
    isLearningMode &&
    (takeoverProgress < 1 || showingLaserEffect || isFadingBackIn || isPuzzlePieceAnimating)
  const showPulseAnimation = isLearningMode && takeoverProgress < 0.5

  // Sync takeover state to context (so MapRenderer can suppress hot/cold feedback)
  // Also consider puzzle piece animation as a takeover state
  useEffect(() => {
    setIsInTakeover(isInTakeoverLocal || isPuzzlePieceAnimating)
  }, [isInTakeoverLocal, isPuzzlePieceAnimating, setIsInTakeover])

  // Reset local UI state when region changes
  // Note: nameConfirmationProgress is reset on the server when prompt changes
  useEffect(() => {
    if (currentRegionId) {
      setNameConfirmed(false)
      setShowingLaserEffect(false)
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
      // Start showing laser effect
      setShowingLaserEffect(true)
      onHintsUnlock?.()

      // After 750ms, hide the laser effect and mark as confirmed
      const timeout = setTimeout(() => {
        setShowingLaserEffect(false)
        setNameConfirmed(true)
      }, 750)

      return () => clearTimeout(timeout)
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

  // Capture source rect from takeover region shape when puzzlePieceTarget is set
  // This provides the starting position for the fly-to-map animation
  // Add a delay so the takeover is visible before the animation starts
  useEffect(() => {
    // Only capture if target is set but doesn't have sourceRect yet
    if (puzzlePieceTarget && !puzzlePieceTarget.sourceRect) {
      // Brief delay to let the takeover fade back in and be visible
      const timeoutId = setTimeout(() => {
        if (takeoverRegionShapeRef.current) {
          const sourceRect = takeoverRegionShapeRef.current.getBoundingClientRect()
          // Update the target with the source rect
          setPuzzlePieceTarget((prev) =>
            prev && !prev.sourceRect
              ? {
                  ...prev,
                  sourceRect: {
                    x: sourceRect.left,
                    y: sourceRect.top,
                    width: sourceRect.width,
                    height: sourceRect.height,
                  },
                }
              : prev
          )
        }
      }, 400) // 400ms delay to show takeover before animation

      return () => clearTimeout(timeoutId)
    }
  }, [puzzlePieceTarget, setPuzzlePieceTarget])

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

      // Only accept single character keys (letters only)
      const pressedLetter = e.key.toLowerCase()
      if (pressedLetter.length !== 1 || !/[a-z]/i.test(pressedLetter)) {
        return
      }

      // In turn-based mode, only allow the current player to type
      if (gameMode === 'turn-based' && !isMyTurn) {
        setShowNotYourTurn(true)
        // Auto-hide the notice after 2 seconds
        setTimeout(() => setShowNotYourTurn(false), 2000)
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

      // Normalize accented letters to base ASCII (e.g., 'é' → 'e', 'ñ' → 'n')
      // so users can type region names like "Côte d'Ivoire" or "São Tomé" with a regular keyboard
      const expectedLetter = normalizeToBaseLetter(letterInfo.char)

      console.log('[LetterConfirm] Keyboard input:', {
        pressedLetter,
        letterInfo,
        expectedLetter,
        match: pressedLetter === expectedLetter,
        regionName: currentRegionName,
        letterIndex: nextLetterIndex,
      })

      if (pressedLetter === expectedLetter) {
        // Optimistically advance count before server responds
        optimisticLetterCountRef.current = nextLetterIndex + 1
        // Dispatch to shared state - server validates and broadcasts to all sessions
        confirmLetter(pressedLetter, nextLetterIndex)
      }
      // Ignore wrong characters silently (no feedback, no backspace needed)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    requiresNameConfirmation,
    nameConfirmed,
    currentRegionName,
    confirmLetter,
    gameMode,
    isMyTurn,
  ])

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
      {/* Hidden SVG for accurate getBBox measurement - ensures consistent positioning */}
      {displayRegionPath && (
        <svg
          data-element="hidden-bbox-measure"
          style={{
            position: 'absolute',
            left: '-9999px',
            top: '-9999px',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          <path ref={hiddenPathRef} d={displayRegionPath} />
        </svg>
      )}

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
      {/* Also shows during puzzle piece animation (silhouette only) */}
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
          opacity: isInTakeoverLocal || isPuzzlePieceAnimating ? 1 : 0,
        }}
      >
        {/* Backdrop scrim with blur - fade out during puzzle piece animation */}
        <div
          data-element="takeover-scrim"
          className={css({
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            transition: 'opacity 0.3s ease-out',
          })}
          style={{
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            // Fade out scrim during puzzle piece animation
            opacity: isPuzzlePieceAnimating ? 0 : 1,
          }}
        />

        {/* Region shape silhouette - shown during takeover, until animation starts */}
        {/* Uses accurateBBox from getBBox() for consistent positioning between parts 1 and 2 */}
        {displayRegionPath &&
          accurateBBox &&
          isInTakeoverLocal &&
          !isPuzzlePieceAnimating &&
          (() => {
            // Use puzzlePieceTarget.svgBBox if available (part 2), otherwise use accurateBBox (part 1)
            // Both come from getBBox() so positioning should be identical
            const bbox = puzzlePieceTarget?.svgBBox ?? accurateBBox
            const viewBox = `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`
            const aspectRatio = bbox.width / bbox.height

            // Calculate container size that fits within 60% of viewport while preserving aspect ratio
            const maxSize =
              typeof window !== 'undefined'
                ? Math.min(window.innerWidth, window.innerHeight) * 0.6
                : 400

            let width: number
            let height: number
            if (aspectRatio > 1) {
              // Wider than tall
              width = maxSize
              height = maxSize / aspectRatio
            } else {
              // Taller than wide
              height = maxSize
              width = maxSize * aspectRatio
            }

            // Center on screen
            const x = typeof window !== 'undefined' ? (window.innerWidth - width) / 2 : 200
            const y = typeof window !== 'undefined' ? (window.innerHeight - height) / 2 : 100

            // Calculate a reasonable tracer size based on the viewBox dimensions
            const tracerSize = Math.max(bbox.width, bbox.height) * 0.03

            // Use pre-calculated simplified paths from state (calculated using browser's getPointAtLength)
            // Each element is a separate island/segment - we animate all simultaneously
            // Fall back to original path if simplified not ready yet
            const tracerPaths =
              simplifiedTracerPaths && simplifiedTracerPaths.length > 0
                ? simplifiedTracerPaths
                : [displayRegionPath]

            return (
              <svg
                ref={takeoverRegionShapeRef}
                data-element="takeover-region-shape"
                viewBox={viewBox}
                preserveAspectRatio="xMidYMid meet"
                style={{
                  position: 'fixed',
                  left: `${x}px`,
                  top: `${y}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                  zIndex: 151,
                  pointerEvents: 'none',
                  overflow: 'visible',
                }}
              >
                {/* Definitions for glow effects */}
                <defs>
                  {/* Simplified paths for smooth animation - one per island/segment */}
                  {tracerPaths.map((path, idx) => (
                    <path key={`motion-path-${idx}`} id={`tracer-motion-path-${idx}`} d={path} />
                  ))}
                </defs>

                {/* DEBUG: Render simplified paths visibly (only when visual debug enabled) */}
                {isVisualDebugEnabled &&
                  tracerPaths.map((path, idx) => (
                    <path
                      key={`debug-path-${idx}`}
                      d={path}
                      fill="none"
                      stroke="red"
                      strokeWidth={3}
                      strokeDasharray="10,5"
                      vectorEffect="non-scaling-stroke"
                      opacity={0.8}
                    />
                  ))}

                <defs>
                  {/* Glow filter for the main flame */}
                  <filter id="flame-glow" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation={tracerSize * 1.2} result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="blur" />
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  {/* Smaller glow for sparks */}
                  <filter id="spark-glow" x="-200%" y="-200%" width="500%" height="500%">
                    <feGaussianBlur stdDeviation={tracerSize * 0.5} result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  {/* Fire gradient - hot core to cooler edges */}
                  <radialGradient id="flame-gradient">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                    <stop offset="20%" stopColor="#fffde7" stopOpacity="1" />
                    <stop offset="40%" stopColor="#ffd54f" stopOpacity="0.95" />
                    <stop offset="60%" stopColor="#ff9800" stopOpacity="0.85" />
                    <stop offset="80%" stopColor="#f44336" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#d32f2f" stopOpacity="0" />
                  </radialGradient>
                  {/* Ember gradient for trailing sparks */}
                  <radialGradient id="ember-gradient">
                    <stop offset="0%" stopColor="#ffeb3b" stopOpacity="1" />
                    <stop offset="50%" stopColor="#ff9800" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#ff5722" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Region fill and stroke */}
                <path
                  id="region-outline-path"
                  d={displayRegionPath}
                  fill={isDark ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.35)'}
                  stroke={isDark ? '#3b82f6' : '#2563eb'}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />

                {/* Tracer animation groups - one for each island/segment, all animate simultaneously */}
                {tracerPaths.map((_, pathIdx) => (
                  <animated.g
                    key={`tracer-${confirmedLetterCount}-${pathIdx}`}
                    opacity={tracerSpring.overallOpacity}
                  >
                    {/* Outer fire glow - size scales with intensity */}
                    <animated.circle
                      r={tracerSpring.sizeScale.to((s) => tracerSize * 1.5 * s)}
                      fill="url(#flame-gradient)"
                      filter="url(#flame-glow)"
                      opacity={tracerSpring.glowScale.to((g) => 0.5 + g * 0.2)}
                    >
                      <animateMotion dur={`${tracerDuration}s`} repeatCount="indefinite">
                        <mpath href={`#tracer-motion-path-${pathIdx}`} />
                      </animateMotion>
                    </animated.circle>

                    {/* Main flame body */}
                    <animated.circle
                      r={tracerSpring.sizeScale.to((s) => tracerSize * s)}
                      fill="url(#flame-gradient)"
                      filter="url(#flame-glow)"
                    >
                      <animateMotion dur={`${tracerDuration}s`} repeatCount="indefinite">
                        <mpath href={`#tracer-motion-path-${pathIdx}`} />
                      </animateMotion>
                    </animated.circle>

                    {/* Hot white core - gets more intense/bright as letters progress */}
                    <animated.circle
                      r={tracerSpring.sizeScale.to((s) => tracerSize * 0.35 * (2 - s))}
                      fill="white"
                    >
                      <animateMotion dur={`${tracerDuration}s`} repeatCount="indefinite">
                        <mpath href={`#tracer-motion-path-${pathIdx}`} />
                      </animateMotion>
                      <animate
                        attributeName="opacity"
                        values="1;0.85;1;0.9;1"
                        dur="0.15s"
                        repeatCount="indefinite"
                      />
                    </animated.circle>

                    {/* Trailing embers - exponentially increasing count (no filter for performance) */}
                    {Array.from({ length: emberCount }, (_, i) => {
                      const offset = (i + 1) / (emberCount + 1) // Spread evenly behind the main flame
                      return (
                        <animated.circle
                          key={`ember-${pathIdx}-${i}`}
                          r={tracerSpring.emberScale.to(
                            (e) => tracerSize * (0.6 - (i / emberCount) * 0.35) * e
                          )}
                          fill="url(#ember-gradient)"
                        >
                          <animateMotion
                            dur={`${tracerDuration}s`}
                            repeatCount="indefinite"
                            begin={`-${offset * tracerDuration * 0.4}s`}
                          >
                            <mpath href={`#tracer-motion-path-${pathIdx}`} />
                          </animateMotion>
                          <animate
                            attributeName="opacity"
                            values="0.9;0.6;0.3;0.1"
                            dur="0.4s"
                            repeatCount="indefinite"
                          />
                        </animated.circle>
                      )
                    })}

                    {/* Flying sparks - exponentially increasing count (no filter for performance) */}
                    {Array.from({ length: sparkCount }, (_, i) => {
                      const startOffset = i / sparkCount // Distribute evenly around the path
                      return (
                        <circle
                          key={`spark-${pathIdx}-${i}`}
                          r={tracerSize * 0.15}
                          fill="#ffeb3b"
                        >
                          <animateMotion
                            dur={`${tracerDuration}s`}
                            repeatCount="indefinite"
                            begin={`${startOffset * tracerDuration}s`}
                          >
                            <mpath href={`#tracer-motion-path-${pathIdx}`} />
                          </animateMotion>
                          <animate
                            attributeName="opacity"
                            values="1;0.8;0.3;0"
                            dur="0.5s"
                            repeatCount="indefinite"
                            begin={`${startOffset * tracerDuration}s`}
                          />
                        </circle>
                      )
                    })}
                  </animated.g>
                ))}
              </svg>
            )
          })()}

        {/* Animated puzzle piece silhouette - flies from center to map position */}
        {puzzlePieceShape && isPuzzlePieceAnimating && (
          <animated.svg
            data-element="puzzle-piece-silhouette"
            viewBox={puzzlePieceShape.viewBox}
            preserveAspectRatio="none"
            style={{
              position: 'fixed',
              left: puzzlePieceSpring.x.to((x) => `${x}px`),
              top: puzzlePieceSpring.y.to((y) => `${y}px`),
              width: puzzlePieceSpring.width.to((w) => `${w}px`),
              height: puzzlePieceSpring.height.to((h) => `${h}px`),
              opacity: puzzlePieceSpring.opacity,
              zIndex: 9000,
              pointerEvents: 'none',
            }}
          >
            <path
              d={puzzlePieceShape.path}
              fill={isDark ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.6)'}
              stroke={isDark ? '#3b82f6' : '#2563eb'}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </animated.svg>
        )}

        {/* Takeover text - CSS centered, only scale is animated */}
        {/* Hidden during puzzle piece animation */}
        {!isPuzzlePieceAnimating && (
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
                {/* In turn-based mode, show current player's emoji to indicate whose turn it is */}
                {gameMode === 'turn-based' && currentPlayerEmoji ? (
                  <span>{currentPlayerEmoji}</span>
                ) : (
                  <span>⌨️</span>
                )}
                <span>
                  {gameMode === 'turn-based' && !isMyTurn
                    ? `Waiting for ${playerMetadata[currentPlayer]?.name || 'player'} to type...`
                    : `Type the underlined letter${requiresNameConfirmation > 1 ? 's' : ''}`}
                </span>
              </div>
            )}

            {/* "Not your turn" notice */}
            {showNotYourTurn && (
              <div
                data-element="not-your-turn-notice"
                className={css({
                  marginTop: '3',
                  padding: '2 4',
                  bg: isDark ? 'red.900/80' : 'red.100',
                  color: isDark ? 'red.200' : 'red.800',
                  rounded: 'lg',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  textAlign: 'center',
                })}
              >
                ⏳ Not your turn! Wait for{' '}
                {playerMetadata[currentPlayer]?.name || 'the other player'}.
              </div>
            )}
          </animated.div>
        )}

        {/* On-screen keyboard for mobile/touch devices - OUTSIDE animated container so it doesn't scale */}
        {!isGiveUpAnimating &&
          !isPuzzlePieceAnimating &&
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
                  // In turn-based mode, only allow the current player to type
                  if (gameMode === 'turn-based' && !isMyTurn) {
                    setShowNotYourTurn(true)
                    setTimeout(() => setShowNotYourTurn(false), 2000)
                    return
                  }

                  const nextLetterIndex = optimisticLetterCountRef.current
                  if (nextLetterIndex >= requiresNameConfirmation) return

                  // Get the nth non-space letter (skipping spaces)
                  const letterInfo = getNthNonSpaceLetter(currentRegionName, nextLetterIndex)
                  if (!letterInfo) return

                  // Normalize accented letters to base ASCII (e.g., 'é' → 'e', 'ñ' → 'n')
                  const expectedLetter = normalizeToBaseLetter(letterInfo.char)
                  const pressedLetter = letter.toLowerCase()

                  console.log('[LetterConfirm] Virtual keyboard:', {
                    pressedLetter,
                    letterInfo,
                    expectedLetter,
                    match: pressedLetter === expectedLetter,
                    regionName: currentRegionName,
                    letterIndex: nextLetterIndex,
                  })

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

                    {/* Music settings - always available */}
                    <DropdownMenu.Separator
                      className={css({
                        height: '1px',
                        bg: isDark ? 'gray.700' : 'gray.200',
                        margin: '1 0',
                      })}
                    />
                    <DropdownMenu.Item
                      data-action="open-music-settings"
                      onSelect={() => setIsMusicModalOpen(true)}
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2',
                        padding: '2',
                        fontSize: 'xs',
                        cursor: 'pointer',
                        rounded: 'md',
                        color: isDark ? 'gray.200' : 'gray.700',
                        outline: 'none',
                        _hover: {
                          bg: isDark ? 'gray.700' : 'gray.100',
                        },
                        _focus: {
                          bg: isDark ? 'gray.700' : 'gray.100',
                        },
                      })}
                    >
                      <span>{music.isPlaying ? '🎵' : '🔇'}</span>
                      <span>Music Settings</span>
                    </DropdownMenu.Item>
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
              {/* In turn-based mode, show current player's emoji to indicate whose turn it is */}
              {gameMode === 'turn-based' && currentPlayerEmoji ? (
                <span>{currentPlayerEmoji}</span>
              ) : (
                <span>⌨️</span>
              )}
              <span>
                {gameMode === 'turn-based' && !isMyTurn
                  ? `Waiting for ${playerMetadata[currentPlayer]?.name || 'player'} to type...`
                  : `Type the underlined letter${requiresNameConfirmation > 1 ? 's' : ''}`}
              </span>
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

      {/* Music Control Modal */}
      <MusicControlModal open={isMusicModalOpen} onOpenChange={setIsMusicModalOpen} />
    </>
  )
}
