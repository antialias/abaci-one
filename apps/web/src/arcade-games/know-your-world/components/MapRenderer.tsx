'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useSpring, animated, to } from '@react-spring/web'
import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'
import type { MapData, MapRegion } from '../types'
import {
  getRegionColor,
  getRegionStroke,
  getLabelTextColor,
  getLabelTextShadow,
} from '../mapColors'
import { forceSimulation, forceCollide, forceX, forceY, type SimulationNodeDatum } from 'd3-force'
import {
  WORLD_MAP,
  USA_MAP,
  ASSISTANCE_LEVELS,
  filterRegionsByContinent,
  parseViewBox,
  calculateFitCropViewBox,
  getCountryFlagEmoji,
} from '../maps'
import type { ContinentId } from '../continents'
import {
  calculateScreenPixelRatio,
  calculateMaxZoomAtThreshold,
  isAboveThreshold,
} from '../utils/screenPixelRatio'
import { findOptimalZoom, type BoundingBox as DebugBoundingBox } from '../utils/adaptiveZoomSearch'
import { useRegionDetection } from '../hooks/useRegionDetection'
import { usePointerLock } from '../hooks/usePointerLock'
import { useMagnifierZoom } from '../hooks/useMagnifierZoom'
import { useRegionHint, useHasRegionHint } from '../hooks/useRegionHint'
import { useSpeakHint } from '../hooks/useSpeakHint'
import { useHotColdFeedback } from '../hooks/useHotColdFeedback'
import type { FeedbackType } from '../utils/hotColdPhrases'
import { usePointerLockButton, usePointerLockButtonRegistry } from './usePointerLockButton'
import { DevCropTool } from './DevCropTool'
import type { HintMap } from '../messages'

// Debug flag: show technical info in magnifier (dev only)
const SHOW_MAGNIFIER_DEBUG_INFO = process.env.NODE_ENV === 'development'

// Debug flag: show bounding boxes with importance scores (dev only)
const SHOW_DEBUG_BOUNDING_BOXES = process.env.NODE_ENV === 'development'

// Precision mode threshold: screen pixel ratio that triggers pointer lock recommendation
const PRECISION_MODE_THRESHOLD = 20

// Label fade settings: labels fade near cursor to reduce clutter
const LABEL_FADE_RADIUS = 150 // pixels - labels within this radius fade
const LABEL_MIN_OPACITY = 0.08 // minimum opacity for faded labels

// Magnifier size ratios - responsive to container aspect ratio
const MAGNIFIER_SIZE_SMALL = 1 / 3 // Used for the constrained dimension
const MAGNIFIER_SIZE_LARGE = 1 / 2 // Used for the unconstrained dimension

/**
 * Calculate magnifier dimensions based on container aspect ratio.
 * - Landscape (wider): 1/3 width, 1/2 height (more vertical space available)
 * - Portrait (taller): 1/2 width, 1/3 height (more horizontal space available)
 */
function getMagnifierDimensions(containerWidth: number, containerHeight: number) {
  const isLandscape = containerWidth > containerHeight
  return {
    width: containerWidth * (isLandscape ? MAGNIFIER_SIZE_SMALL : MAGNIFIER_SIZE_LARGE),
    height: containerHeight * (isLandscape ? MAGNIFIER_SIZE_LARGE : MAGNIFIER_SIZE_SMALL),
  }
}

/**
 * Get emoji for hot/cold feedback type
 * Returns emoji that matches the temperature/status of the last feedback
 */
function getHotColdEmoji(feedbackType: FeedbackType | null): string {
  switch (feedbackType) {
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
      return '🌡️' // Default thermometer when no feedback yet
  }
}

/**
 * Calculate the actual rendered viewport within an SVG element.
 * SVG uses preserveAspectRatio="xMidYMid meet" by default, which:
 * - Scales uniformly to fit within the element while preserving aspect ratio
 * - Centers the content, creating letterboxing if aspect ratios don't match
 *
 * Returns the rendered dimensions, offset from SVG element origin, and scale factors.
 */
function getRenderedViewport(
  svgRect: DOMRect,
  viewBoxX: number,
  viewBoxY: number,
  viewBoxWidth: number,
  viewBoxHeight: number
) {
  const svgAspect = svgRect.width / svgRect.height
  const viewBoxAspect = viewBoxWidth / viewBoxHeight

  let renderedWidth: number
  let renderedHeight: number
  let letterboxX: number
  let letterboxY: number

  if (svgAspect > viewBoxAspect) {
    // SVG element is wider than viewBox - letterboxing on sides
    renderedHeight = svgRect.height
    renderedWidth = renderedHeight * viewBoxAspect
    letterboxX = (svgRect.width - renderedWidth) / 2
    letterboxY = 0
  } else {
    // SVG element is taller than viewBox - letterboxing on top/bottom
    renderedWidth = svgRect.width
    renderedHeight = renderedWidth / viewBoxAspect
    letterboxX = 0
    letterboxY = (svgRect.height - renderedHeight) / 2
  }

  // Scale factor is uniform (same for X and Y due to preserveAspectRatio)
  const scale = renderedWidth / viewBoxWidth

  return {
    renderedWidth,
    renderedHeight,
    letterboxX, // Offset from SVG element left edge to rendered content
    letterboxY, // Offset from SVG element top edge to rendered content
    scale, // Pixels per viewBox unit
    viewBoxX,
    viewBoxY,
  }
}

/**
 * Calculate label opacity based on distance from cursor and animation state.
 * Labels fade to low opacity when cursor is near to reduce visual clutter.
 * During give-up animation, all labels are hidden so the flashing region is visible.
 * Exception: If cursor is over a found region, that region's label stays visible.
 */
function calculateLabelOpacity(
  labelX: number,
  labelY: number,
  labelRegionId: string,
  cursorPosition: { x: number; y: number } | null,
  hoveredRegion: string | null,
  regionsFound: string[],
  isGiveUpAnimating: boolean
): number {
  // During give-up animation, hide all labels so the flashing region is clearly visible
  if (isGiveUpAnimating) return 0

  // No cursor position = full opacity
  if (!cursorPosition) return 1

  // If hovering over this label's region AND it's been found, show at full opacity
  if (hoveredRegion === labelRegionId && regionsFound.includes(labelRegionId)) {
    return 1
  }

  // Calculate distance from cursor to label
  const dx = labelX - cursorPosition.x
  const dy = labelY - cursorPosition.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  // Outside fade radius = full opacity
  if (distance >= LABEL_FADE_RADIUS) return 1

  // Inside fade radius = interpolate from min to full based on distance
  const t = distance / LABEL_FADE_RADIUS
  return LABEL_MIN_OPACITY + t * (1 - LABEL_MIN_OPACITY)
}

interface BoundingBox {
  minX: number
  maxX: number
  minY: number
  maxY: number
  width: number
  height: number
  area: number
}

interface MapRendererProps {
  mapData: MapData
  regionsFound: string[]
  currentPrompt: string | null
  assistanceLevel: 'learning' | 'guided' | 'helpful' | 'standard' | 'none' // Controls gameplay features (hints, hot/cold)
  selectedMap: 'world' | 'usa' // Map ID for calculating excluded regions
  selectedContinent: string // Continent ID for calculating excluded regions
  onRegionClick: (regionId: string, regionName: string) => void
  guessHistory: Array<{
    playerId: string
    regionId: string
    correct: boolean
  }>
  playerMetadata: Record<
    string,
    {
      id: string
      name: string
      emoji: string
      color: string
      userId?: string // Session ID that owns this player
    }
  >
  // Give up reveal animation
  giveUpReveal: {
    regionId: string
    regionName: string
    timestamp: number
  } | null
  // Hint highlight animation
  hintActive: {
    regionId: string
    timestamp: number
  } | null
  // Give up callback
  onGiveUp: () => void
  // Force simulation tuning parameters
  forceTuning?: {
    showArrows?: boolean
    centeringStrength?: number
    collisionPadding?: number
    simulationIterations?: number
    useObstacles?: boolean
    obstaclePadding?: number
  }
  // Debug flags
  showDebugBoundingBoxes?: boolean
  // Multiplayer cursor sharing
  gameMode?: 'cooperative' | 'race' | 'turn-based'
  currentPlayer?: string // The player whose turn it is (for turn-based mode)
  localPlayerId?: string // The local player's ID (to filter out our own cursor from others)
  otherPlayerCursors?: Record<
    string,
    {
      x: number
      y: number
      userId: string
      hoveredRegionId: string | null
    } | null
  >
  onCursorUpdate?: (
    cursorPosition: { x: number; y: number } | null,
    hoveredRegionId: string | null
  ) => void
  // Unanimous give-up voting (for cooperative multiplayer)
  giveUpVotes?: string[] // Session/viewer IDs (userIds) who have voted to give up
  activeUserIds?: string[] // All unique session IDs participating (to show "1/2 sessions voted")
  viewerId?: string // This viewer's userId (to check if local session has voted)
  // Member players mapping (userId -> players) for cursor emoji display
  memberPlayers?: Record<string, Array<{ id: string; name: string; emoji: string; color: string }>>
  /** When true, hints are locked (e.g., user hasn't typed required name confirmation yet) */
  hintsLocked?: boolean
}

/**
 * Calculate bounding box from SVG path string
 */
function calculateBoundingBox(pathString: string): BoundingBox {
  const numbers = pathString.match(/-?\d+\.?\d*/g)?.map(Number) || []

  if (numbers.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, area: 0 }
  }

  const xCoords: number[] = []
  const yCoords: number[] = []

  for (let i = 0; i < numbers.length; i += 2) {
    xCoords.push(numbers[i])
    if (i + 1 < numbers.length) {
      yCoords.push(numbers[i + 1])
    }
  }

  const minX = Math.min(...xCoords)
  const maxX = Math.max(...xCoords)
  const minY = Math.min(...yCoords)
  const maxY = Math.max(...yCoords)
  const width = maxX - minX
  const height = maxY - minY
  const area = width * height

  return { minX, maxX, minY, maxY, width, height, area }
}

interface RegionLabelPosition {
  regionId: string
  regionName: string
  x: number // pixel position
  y: number // pixel position
  players: string[]
}

export function MapRenderer({
  mapData,
  regionsFound,
  currentPrompt,
  assistanceLevel,
  selectedMap,
  selectedContinent,
  onRegionClick,
  guessHistory,
  playerMetadata,
  giveUpReveal,
  hintActive,
  onGiveUp,
  forceTuning = {},
  showDebugBoundingBoxes = SHOW_DEBUG_BOUNDING_BOXES,
  gameMode,
  currentPlayer,
  localPlayerId,
  otherPlayerCursors = {},
  onCursorUpdate,
  giveUpVotes = [],
  activeUserIds = [],
  viewerId,
  memberPlayers = {},
  hintsLocked = false,
}: MapRendererProps) {
  // Extract force tuning parameters with defaults
  const {
    showArrows = false,
    centeringStrength = 2.0,
    collisionPadding = 5,
    simulationIterations = 200,
    useObstacles = true,
    obstaclePadding = 10,
  } = forceTuning
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Calculate excluded regions (regions filtered out by size/continent)
  const excludedRegions = useMemo(() => {
    // Get full unfiltered map data
    const fullMapData = selectedMap === 'world' ? WORLD_MAP : USA_MAP
    let allRegions = fullMapData.regions

    // Apply continent filter if world map
    if (selectedMap === 'world' && selectedContinent !== 'all') {
      allRegions = filterRegionsByContinent(allRegions, selectedContinent as ContinentId)
    }

    // Find regions in full data that aren't in filtered data
    const includedRegionIds = new Set(mapData.regions.map((r) => r.id))
    const excluded = allRegions.filter((r) => !includedRegionIds.has(r.id))

    return excluded
  }, [mapData, selectedMap, selectedContinent])

  // Get current assistance level config
  const currentAssistanceLevel = useMemo(() => {
    return ASSISTANCE_LEVELS.find((level) => level.id === assistanceLevel) || ASSISTANCE_LEVELS[1] // Default to 'helpful'
  }, [assistanceLevel])

  // Whether hot/cold is allowed by the assistance level (not user preference)
  const assistanceAllowsHotCold = currentAssistanceLevel?.hotColdEnabled ?? false

  // Create a set of excluded region IDs for quick lookup
  const excludedRegionIds = useMemo(
    () => new Set(excludedRegions.map((r) => r.id)),
    [excludedRegions]
  )

  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Pre-computed largest piece sizes for multi-piece regions
  // Maps regionId -> {width, height} of the largest piece
  // Defined early because useRegionDetection needs it
  const largestPieceSizesRef = useRef<Map<string, { width: number; height: number }>>(new Map())

  // Region detection hook
  const { detectRegions, hoveredRegion, setHoveredRegion } = useRegionDetection({
    svgRef,
    containerRef,
    mapData,
    detectionBoxSize: 50,
    smallRegionThreshold: 15,
    smallRegionAreaThreshold: 200,
    largestPieceSizesCache: largestPieceSizesRef.current,
    regionsFound,
  })

  // State that needs to be available for hooks
  const cursorPositionRef = useRef<{ x: number; y: number } | null>(null)
  const initialCapturePositionRef = useRef<{ x: number; y: number } | null>(null)
  const [cursorSquish, setCursorSquish] = useState({ x: 1, y: 1 })
  const [isReleasingPointerLock, setIsReleasingPointerLock] = useState(false)

  // Memoize pointer lock callbacks to prevent render loop
  const handleLockAcquired = useCallback(() => {
    // Save initial cursor position
    if (cursorPositionRef.current) {
      initialCapturePositionRef.current = { ...cursorPositionRef.current }
      console.log(
        '[Pointer Lock] 📍 Saved initial capture position:',
        initialCapturePositionRef.current
      )
    }
    // Note: Zoom update now handled by useMagnifierZoom hook
  }, [])

  const handleLockReleased = useCallback(() => {
    console.log('[Pointer Lock] 🔓 RELEASED - Starting cleanup')

    // Reset cursor squish
    setCursorSquish({ x: 1, y: 1 })
    setIsReleasingPointerLock(false)
    // Note: Button hover states reset automatically via usePointerLockButton hook
    // Note: Zoom recalculation now handled by useMagnifierZoom hook
  }, [])

  // Pointer lock hook (needed by zoom hook)
  const { pointerLocked, requestPointerLock, exitPointerLock } = usePointerLock({
    containerRef,
    onLockAcquired: handleLockAcquired,
    onLockReleased: handleLockReleased,
  })

  // Magnifier zoom hook
  const { targetZoom, setTargetZoom, zoomSpring, getCurrentZoom, uncappedAdaptiveZoomRef } =
    useMagnifierZoom({
      containerRef,
      svgRef,
      viewBox: mapData.viewBox,
      threshold: PRECISION_MODE_THRESHOLD,
      pointerLocked,
      initialZoom: 10,
    })

  const [svgDimensions, setSvgDimensions] = useState({
    width: 1000,
    height: 500,
  })
  const [cursorPosition, setCursorPosition] = useState<{
    x: number
    y: number
  } | null>(null)
  const [showMagnifier, setShowMagnifier] = useState(false)
  const [targetOpacity, setTargetOpacity] = useState(0)
  const [targetTop, setTargetTop] = useState(20)
  const [targetLeft, setTargetLeft] = useState(20)
  const [smallestRegionSize, setSmallestRegionSize] = useState<number>(Infinity)
  const [shiftPressed, setShiftPressed] = useState(false)

  // Track whether current target region needs magnification
  const [targetNeedsMagnification, setTargetNeedsMagnification] = useState(false)

  // Mobile magnifier touch drag state
  const [isMagnifierDragging, setIsMagnifierDragging] = useState(false)
  const magnifierTouchStartRef = useRef<{ x: number; y: number } | null>(null)
  const magnifierDidMoveRef = useRef(false) // Track if user actually dragged (vs just tapped)
  const magnifierRef = useRef<HTMLDivElement>(null) // Ref to magnifier element for tap position calculation
  const magnifierTapPositionRef = useRef<{ x: number; y: number } | null>(null) // Where user tapped on magnifier

  // Give up reveal animation state
  const [giveUpFlashProgress, setGiveUpFlashProgress] = useState(0) // 0-1 pulsing value
  const [isGiveUpAnimating, setIsGiveUpAnimating] = useState(false) // Track if animation in progress

  // Hint animation state
  const [hintFlashProgress, setHintFlashProgress] = useState(0) // 0-1 pulsing value
  const [isHintAnimating, setIsHintAnimating] = useState(false) // Track if animation in progress
  // Saved button position to prevent jumping during zoom animation
  const [savedButtonPosition, setSavedButtonPosition] = useState<{
    top: number
    right: number
  } | null>(null)

  // Debug: Track bounding boxes for visualization
  const [debugBoundingBoxes, setDebugBoundingBoxes] = useState<DebugBoundingBox[]>([])
  // Debug: Track full zoom search result for detailed panel
  const [zoomSearchDebugInfo, setZoomSearchDebugInfo] = useState<ReturnType<
    typeof findOptimalZoom
  > | null>(null)

  // Hint feature state
  const [showHintBubble, setShowHintBubble] = useState(false)
  // Determine which hint map to use:
  // - For USA map, use 'usa'
  // - For World map with specific continent, use the continent name (e.g., 'europe', 'africa')
  // - For World map with 'all' continents, use 'world'
  const hintMapKey: HintMap =
    selectedMap === 'usa'
      ? 'usa'
      : selectedContinent !== 'all'
        ? (selectedContinent as HintMap)
        : 'world'
  // Get hint for current region (if available)
  const hintText = useRegionHint(hintMapKey, currentPrompt)
  const hasHint = useHasRegionHint(hintMapKey, currentPrompt)

  // Get the current region name for audio hints
  const currentRegionName = useMemo(() => {
    if (!currentPrompt) return null
    const region = mapData.regions.find((r) => r.id === currentPrompt)
    return region?.name ?? null
  }, [currentPrompt, mapData.regions])

  // Get flag emoji for cursor label (world map only)
  const currentFlagEmoji = useMemo(() => {
    if (selectedMap !== 'world' || !currentPrompt) return ''
    return getCountryFlagEmoji(currentPrompt)
  }, [selectedMap, currentPrompt])

  // Speech synthesis for reading hints aloud
  const {
    speakWithRegionName,
    stop: stopSpeaking,
    isSpeaking,
    isSupported: isSpeechSupported,
    hasAccentOption,
  } = useSpeakHint(hintMapKey, currentPrompt)

  // Auto-speak setting persisted in localStorage
  const [autoSpeak, setAutoSpeak] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('knowYourWorld.autoSpeakHint') === 'true'
  })

  // With accent setting persisted in localStorage (default false - use user's locale for consistent pronunciation)
  const [withAccent, setWithAccent] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem('knowYourWorld.withAccent')
    return stored === null ? false : stored === 'true'
  })

  // Auto-hint setting persisted in localStorage (auto-opens hint on region advance)
  const [autoHint, setAutoHint] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('knowYourWorld.autoHint') === 'true'
  })

  // Hot/cold audio feedback setting persisted in localStorage
  const [hotColdEnabled, setHotColdEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('knowYourWorld.hotColdAudio') === 'true'
  })

  // Detect if device has a fine pointer (mouse) - iPads with mice will return true
  // This is better than isTouchDevice because iPads with attached mice should show hot/cold
  const hasFinePointer =
    typeof window !== 'undefined' && window.matchMedia('(any-pointer: fine)').matches

  // Persist auto-speak setting
  const handleAutoSpeakChange = useCallback((enabled: boolean) => {
    setAutoSpeak(enabled)
    localStorage.setItem('knowYourWorld.autoSpeakHint', String(enabled))
  }, [])

  // Persist with-accent setting
  const handleWithAccentChange = useCallback((enabled: boolean) => {
    setWithAccent(enabled)
    localStorage.setItem('knowYourWorld.withAccent', String(enabled))
  }, [])

  // Persist auto-hint setting
  const handleAutoHintChange = useCallback((enabled: boolean) => {
    setAutoHint(enabled)
    localStorage.setItem('knowYourWorld.autoHint', String(enabled))
  }, [])

  // Persist hot/cold audio setting
  const handleHotColdChange = useCallback((enabled: boolean) => {
    setHotColdEnabled(enabled)
    localStorage.setItem('knowYourWorld.hotColdAudio', String(enabled))
  }, [])

  // Pointer lock button registry and hooks for Give Up and Hint buttons
  const buttonRegistry = usePointerLockButtonRegistry()

  // Give Up button pointer lock support
  const giveUpButton = usePointerLockButton({
    id: 'give-up',
    disabled: isGiveUpAnimating,
    active: true,
    pointerLocked,
    cursorPosition,
    containerRef,
    onClick: onGiveUp,
  })

  // Hint button pointer lock support
  const hintButton = usePointerLockButton({
    id: 'hint',
    disabled: false,
    active: hasHint,
    pointerLocked,
    cursorPosition,
    containerRef,
    onClick: () => setShowHintBubble((prev) => !prev),
  })

  // Speak hint button pointer lock support
  const handleSpeakClick = useCallback(() => {
    if (isSpeaking) {
      stopSpeaking()
    } else if (currentRegionName) {
      speakWithRegionName(currentRegionName, hintText, withAccent)
    }
  }, [isSpeaking, stopSpeaking, currentRegionName, hintText, speakWithRegionName, withAccent])

  const speakButton = usePointerLockButton({
    id: 'speak-hint',
    disabled: !hintText,
    active: showHintBubble && isSpeechSupported,
    pointerLocked,
    cursorPosition,
    containerRef,
    onClick: handleSpeakClick,
  })

  // Auto-speak checkbox pointer lock support
  const handleAutoSpeakToggle = useCallback(() => {
    handleAutoSpeakChange(!autoSpeak)
  }, [autoSpeak, handleAutoSpeakChange])

  const autoSpeakCheckbox = usePointerLockButton({
    id: 'auto-speak-checkbox',
    disabled: false,
    active: showHintBubble && isSpeechSupported,
    pointerLocked,
    cursorPosition,
    containerRef,
    onClick: handleAutoSpeakToggle,
  })

  // With accent checkbox pointer lock support
  const handleWithAccentToggle = useCallback(() => {
    handleWithAccentChange(!withAccent)
  }, [withAccent, handleWithAccentChange])

  const withAccentCheckbox = usePointerLockButton({
    id: 'with-accent-checkbox',
    disabled: false,
    active: showHintBubble && isSpeechSupported && hasAccentOption,
    pointerLocked,
    cursorPosition,
    containerRef,
    onClick: handleWithAccentToggle,
  })

  // Auto-hint checkbox pointer lock support
  const handleAutoHintToggle = useCallback(() => {
    handleAutoHintChange(!autoHint)
  }, [autoHint, handleAutoHintChange])

  const autoHintCheckbox = usePointerLockButton({
    id: 'auto-hint-checkbox',
    disabled: false,
    active: showHintBubble,
    pointerLocked,
    cursorPosition,
    containerRef,
    onClick: handleAutoHintToggle,
  })

  // Hot/cold audio button pointer lock support
  const handleHotColdToggle = useCallback(() => {
    handleHotColdChange(!hotColdEnabled)
  }, [hotColdEnabled, handleHotColdChange])

  const hotColdButton = usePointerLockButton({
    id: 'hot-cold-button',
    disabled: false,
    active: isSpeechSupported && hasFinePointer, // Show when speech is supported and device has mouse
    pointerLocked,
    cursorPosition,
    containerRef,
    onClick: handleHotColdToggle,
  })

  // Register buttons with the registry for centralized click handling
  useEffect(() => {
    buttonRegistry.register('give-up', giveUpButton.checkClick, onGiveUp)
    buttonRegistry.register('hint', hintButton.checkClick, () => setShowHintBubble((prev) => !prev))
    buttonRegistry.register('speak-hint', speakButton.checkClick, handleSpeakClick)
    buttonRegistry.register(
      'auto-speak-checkbox',
      autoSpeakCheckbox.checkClick,
      handleAutoSpeakToggle
    )
    buttonRegistry.register(
      'with-accent-checkbox',
      withAccentCheckbox.checkClick,
      handleWithAccentToggle
    )
    buttonRegistry.register('auto-hint-checkbox', autoHintCheckbox.checkClick, handleAutoHintToggle)
    buttonRegistry.register('hot-cold-button', hotColdButton.checkClick, handleHotColdToggle)
    return () => {
      buttonRegistry.unregister('give-up')
      buttonRegistry.unregister('hint')
      buttonRegistry.unregister('speak-hint')
      buttonRegistry.unregister('auto-speak-checkbox')
      buttonRegistry.unregister('with-accent-checkbox')
      buttonRegistry.unregister('auto-hint-checkbox')
      buttonRegistry.unregister('hot-cold-button')
    }
  }, [
    buttonRegistry,
    giveUpButton.checkClick,
    hintButton.checkClick,
    speakButton.checkClick,
    autoSpeakCheckbox.checkClick,
    withAccentCheckbox.checkClick,
    autoHintCheckbox.checkClick,
    hotColdButton.checkClick,
    onGiveUp,
    handleSpeakClick,
    handleAutoSpeakToggle,
    handleWithAccentToggle,
    handleAutoHintToggle,
    handleHotColdToggle,
  ])

  // Track previous showHintBubble state to detect when it opens
  const prevShowHintBubbleRef = useRef(false)

  // Auto-speak hint when bubble opens (if enabled)
  // Only triggers when bubble transitions from closed to open, not when hintText changes
  useEffect(() => {
    const justOpened = showHintBubble && !prevShowHintBubbleRef.current
    prevShowHintBubbleRef.current = showHintBubble

    if (justOpened && autoSpeak && currentRegionName && isSpeechSupported) {
      speakWithRegionName(currentRegionName, hintText, withAccent)
    }
  }, [
    showHintBubble,
    autoSpeak,
    currentRegionName,
    hintText,
    isSpeechSupported,
    speakWithRegionName,
    withAccent,
  ])

  // Track previous prompt to detect region changes
  const prevPromptRef = useRef<string | null>(null)
  // Store autoHint/autoSpeak in refs so we can read current values without triggering effect
  const autoHintRef = useRef(autoHint)
  const autoSpeakRef = useRef(autoSpeak)
  const withAccentRef = useRef(withAccent)
  // Hot/cold is only active when both: 1) assistance level allows it, 2) user has it enabled
  const effectiveHotColdEnabled = assistanceAllowsHotCold && hotColdEnabled
  const hotColdEnabledRef = useRef(effectiveHotColdEnabled)
  autoHintRef.current = autoHint
  autoSpeakRef.current = autoSpeak
  withAccentRef.current = withAccent
  hotColdEnabledRef.current = effectiveHotColdEnabled

  // Handle hint bubble and auto-speak when the prompt changes (new region to find)
  // Also re-runs when hintsLocked changes (e.g., user unlocked hints by typing name)
  useEffect(() => {
    const isNewRegion = prevPromptRef.current !== null && prevPromptRef.current !== currentPrompt
    prevPromptRef.current = currentPrompt

    // Don't auto-show hints when locked (e.g., waiting for name confirmation)
    if (autoHintRef.current && hasHint && !hintsLocked) {
      setShowHintBubble(true)
      // If region changed and both auto-hint and auto-speak are enabled, speak immediately
      // This handles the case where the bubble was already open
      if (isNewRegion && autoSpeakRef.current && currentRegionName && isSpeechSupported) {
        speakWithRegionName(currentRegionName, hintText, withAccentRef.current)
      }
    } else {
      setShowHintBubble(false)
    }
  }, [
    currentPrompt,
    hasHint,
    currentRegionName,
    hintText,
    isSpeechSupported,
    speakWithRegionName,
    hintsLocked,
  ])

  // Hot/cold audio feedback hook
  // Only enabled if: 1) assistance level allows it, 2) user toggle is on, 3) not touch device
  // Use continent name for language lookup if available, otherwise use selectedMap
  const hotColdMapName = selectedContinent || selectedMap
  const {
    checkPosition: checkHotCold,
    reset: resetHotCold,
    lastFeedbackType: hotColdFeedbackType,
  } = useHotColdFeedback({
    enabled: assistanceAllowsHotCold && hotColdEnabled && hasFinePointer,
    targetRegionId: currentPrompt,
    isSpeaking,
    mapName: hotColdMapName,
    regions: mapData.regions,
  })

  // Reset hot/cold feedback when prompt changes
  useEffect(() => {
    resetHotCold()
  }, [currentPrompt, resetHotCold])

  // Configuration
  const MAX_ZOOM = 1000 // Maximum zoom level (for Gibraltar at 0.08px!)
  const HIGH_ZOOM_THRESHOLD = 100 // Show gold border above this zoom level

  // Movement speed multiplier based on smallest region size
  // When pointer lock is active, apply this multiplier to movementX/movementY
  // For sub-pixel regions (< 1px): 3% speed (ultra precision)
  // For tiny regions (1-5px): 10% speed (high precision)
  // For small regions (5-15px): 25% speed (moderate precision)
  const getMovementMultiplier = (size: number): number => {
    if (size < 1) return 0.03 // Ultra precision for sub-pixel regions like Gibraltar (0.08px)
    if (size < 5) return 0.1 // High precision for regions like Jersey (0.82px)
    if (size < 15) return 0.25 // Moderate precision for regions like Rhode Island (11px)
    return 1.0 // Normal speed for larger regions
  }

  // Pre-compute largest piece sizes for multi-piece regions
  useEffect(() => {
    if (!svgRef.current) return

    const largestPieceSizes = new Map<string, { width: number; height: number }>()

    mapData.regions.forEach((region) => {
      const pathData = region.path
      // Split on z followed by m (Safari doesn't support lookbehind, so use replace + split)
      const withSeparator = pathData.replace(/z\s*m/gi, 'z|||m')
      const rawPieces = withSeparator.split('|||')

      if (rawPieces.length > 1) {
        // Multi-piece region: use the FIRST piece (mainland), not largest
        // The first piece is typically the mainland, with islands as subsequent pieces
        const svg = svgRef.current
        if (!svg) return

        // Just measure the first piece
        const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        tempPath.setAttribute('d', rawPieces[0]) // First piece already has 'm' command
        tempPath.style.visibility = 'hidden'
        svg.appendChild(tempPath)

        const bbox = tempPath.getBoundingClientRect()
        const firstPieceSize = { width: bbox.width, height: bbox.height }

        svg.removeChild(tempPath)

        largestPieceSizes.set(region.id, firstPieceSize)

        // Log multi-piece regions for debugging
        if (region.id === 'pt' || region.id === 'nl') {
          console.log(
            `[Pre-compute] ${region.id}: ${rawPieces.length} pieces, using first piece: ${firstPieceSize.width.toFixed(2)}px × ${firstPieceSize.height.toFixed(2)}px`
          )
        }
      }
    })

    largestPieceSizesRef.current = largestPieceSizes
  }, [mapData])

  // Check if pointer lock is supported (not available on touch devices like iPad)
  const isPointerLockSupported =
    typeof document !== 'undefined' && 'pointerLockElement' in document

  // Request pointer lock on first click
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Silently request pointer lock if not already locked (and supported)
    // This makes the first gameplay click also enable precision mode
    // On devices without pointer lock (iPad), skip this and process clicks normally
    if (!pointerLocked && isPointerLockSupported) {
      requestPointerLock()
      console.log('[Pointer Lock] 🔒 Silently requested (user clicked map)')
      return // Don't process region click on the first click that requests lock
    }

    // When pointer lock is active, browser doesn't deliver click events to SVG children
    // We need to manually detect which region is under the cursor
    if (pointerLocked && cursorPositionRef.current && containerRef.current && svgRef.current) {
      const { x: cursorX, y: cursorY } = cursorPositionRef.current

      console.log('[CLICK] Pointer lock click at cursor position:', {
        cursorX,
        cursorY,
      })

      // Check if clicking on any registered button (Give Up, Hint, etc.)
      if (buttonRegistry.handleClick(cursorX, cursorY)) {
        return
      }

      // Use the same detection logic as hover tracking (50px detection box)
      // This checks the main map SVG at the cursor position
      const { detectedRegions, regionUnderCursor } = detectRegions(cursorX, cursorY)

      console.log('[CLICK] Detection results:', {
        detectedRegions: detectedRegions.map((r) => r.id),
        regionUnderCursor,
        detectedCount: detectedRegions.length,
      })

      if (regionUnderCursor) {
        // Find the region data to get the name
        const region = mapData.regions.find((r) => r.id === regionUnderCursor)
        if (region) {
          console.log('[CLICK] Detected region under cursor:', {
            regionId: regionUnderCursor,
            regionName: region.name,
          })
          onRegionClick(regionUnderCursor, region.name)
        } else {
          console.log('[CLICK] Region ID found but not in mapData:', regionUnderCursor)
        }
      } else {
        // No region directly under cursor - don't count as a click
        // This prevents sea/ocean clicks from being counted as wrong guesses
        console.log('[CLICK] No region under cursor - click ignored (sea/empty area)')
      }
    }
  }

  // Animated spring values for smooth transitions
  // Note: Zoom animation is now handled by useMagnifierZoom hook
  // This spring only handles: opacity, position, and movement multiplier
  const [magnifierSpring, magnifierApi] = useSpring(
    () => ({
      opacity: targetOpacity,
      top: targetTop,
      left: targetLeft,
      movementMultiplier: getMovementMultiplier(smallestRegionSize),
      config: (key) => {
        if (key === 'opacity') {
          return targetOpacity === 1
            ? { duration: 100 } // Fade in: 0.1 seconds
            : { duration: 1000 } // Fade out: 1 second
        }
        if (key === 'movementMultiplier') {
          // Movement multiplier: slower transitions for smooth damping changes
          // Lower tension = slower animation, higher friction = less overshoot
          return { tension: 60, friction: 20 }
        }
        // Position: medium speed
        return { tension: 200, friction: 25 }
      },
    }),
    [targetOpacity, targetTop, targetLeft, smallestRegionSize]
  )

  // Calculate the display viewBox using fit-crop-with-fill strategy
  // This ensures the custom crop region is visible while filling the container
  const displayViewBox = useMemo(() => {
    // If no custom crop, use the regular viewBox (which may be a calculated bounding box)
    if (!mapData.customCrop) {
      return mapData.viewBox
    }

    // Need container dimensions to calculate aspect ratio
    if (svgDimensions.width <= 0 || svgDimensions.height <= 0) {
      return mapData.viewBox
    }

    const containerAspect = svgDimensions.width / svgDimensions.height
    const originalBounds = parseViewBox(mapData.originalViewBox)
    const cropRegion = parseViewBox(mapData.customCrop)

    const result = calculateFitCropViewBox(originalBounds, cropRegion, containerAspect)
    return result
  }, [mapData.customCrop, mapData.originalViewBox, mapData.viewBox, svgDimensions])

  // Parse the display viewBox for animation and calculations
  const defaultViewBoxParts = useMemo(() => {
    const parts = displayViewBox.split(' ').map(Number)
    return {
      x: parts[0] || 0,
      y: parts[1] || 0,
      width: parts[2] || 1000,
      height: parts[3] || 500,
    }
  }, [displayViewBox])

  // Compute which regions network cursors are hovering over
  // Returns a map of regionId -> { playerId, color } for regions with network hovers
  const networkHoveredRegions = useMemo(() => {
    const result: Record<string, { playerId: string; color: string }> = {}

    Object.entries(otherPlayerCursors).forEach(([playerId, position]) => {
      // Skip our own cursor and null positions
      if (playerId === localPlayerId || !position) return

      // In turn-based mode, only show hover when it's not our turn
      if (gameMode === 'turn-based' && currentPlayer === localPlayerId) return

      // Get player color
      const player = playerMetadata[playerId]
      if (!player) return

      // Use the transmitted hoveredRegionId directly (avoids hit-testing discrepancies
      // due to pixel scaling/rendering differences between clients)
      if (position.hoveredRegionId) {
        result[position.hoveredRegionId] = { playerId, color: player.color }
      }
    })

    return result
  }, [otherPlayerCursors, localPlayerId, gameMode, currentPlayer, playerMetadata])

  // State for give-up zoom animation target values
  const [giveUpZoomTarget, setGiveUpZoomTarget] = useState({
    scale: 1,
    translateX: 0,
    translateY: 0,
  })

  // Spring for main map zoom animation (used during give-up reveal)
  // Uses CSS transform for reliable animation instead of viewBox manipulation
  const mainMapSpring = useSpring({
    scale: giveUpZoomTarget.scale,
    translateX: giveUpZoomTarget.translateX,
    translateY: giveUpZoomTarget.translateY,
    config: { tension: 120, friction: 20 },
    onChange: (result) => {
      console.log('[GiveUp Zoom] Spring animating:', result.value)
    },
  })

  // Note: Zoom animation with pause/resume is now handled by useMagnifierZoom hook
  // This effect only updates the remaining spring properties: opacity, position, movement multiplier
  useEffect(() => {
    magnifierApi.start({
      opacity: targetOpacity,
      top: targetTop,
      left: targetLeft,
      movementMultiplier: getMovementMultiplier(smallestRegionSize),
    })
  }, [targetOpacity, targetTop, targetLeft, smallestRegionSize, magnifierApi])

  // Check if current target region needs magnification
  useEffect(() => {
    if (!currentPrompt || !svgRef.current || !containerRef.current) {
      setTargetNeedsMagnification(false)
      return
    }

    // Find the path element for the target region
    const svgElement = svgRef.current
    const path = svgElement.querySelector(`path[data-region-id="${currentPrompt}"]`)
    if (!path || !(path instanceof SVGGeometryElement)) {
      setTargetNeedsMagnification(false)
      return
    }

    // Get the bounding box size
    const bbox = path.getBoundingClientRect()
    const pixelWidth = bbox.width
    const pixelHeight = bbox.height
    const pixelArea = pixelWidth * pixelHeight

    // Use same thresholds as region detection
    const SMALL_REGION_THRESHOLD = 15 // pixels
    const SMALL_REGION_AREA_THRESHOLD = 200 // px²

    const isVerySmall =
      pixelWidth < SMALL_REGION_THRESHOLD ||
      pixelHeight < SMALL_REGION_THRESHOLD ||
      pixelArea < SMALL_REGION_AREA_THRESHOLD

    setTargetNeedsMagnification(isVerySmall)

    console.log('[MapRenderer] Target region magnification check:', {
      regionId: currentPrompt,
      pixelWidth: pixelWidth.toFixed(2),
      pixelHeight: pixelHeight.toFixed(2),
      pixelArea: pixelArea.toFixed(2),
      isVerySmall,
      needsMagnification: isVerySmall,
    })
  }, [currentPrompt, svgDimensions]) // Re-check when prompt or SVG size changes

  // Give up reveal animation effect
  useEffect(() => {
    if (!giveUpReveal) {
      setGiveUpFlashProgress(0)
      setIsGiveUpAnimating(false)
      setSavedButtonPosition(null)
      // Reset transform to default when animation clears
      setGiveUpZoomTarget({ scale: 1, translateX: 0, translateY: 0 })
      return
    }

    // Track if this effect has been cleaned up (prevents stale animations)
    let isCancelled = false
    let animationFrameId: number | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    // Start animation
    setIsGiveUpAnimating(true)
    console.log('[GiveUp Zoom] giveUpReveal triggered:', giveUpReveal)

    // Save current button position before zoom changes the layout
    if (svgRef.current && containerRef.current) {
      const svgRect = svgRef.current.getBoundingClientRect()
      const containerRect = containerRef.current.getBoundingClientRect()
      const svgOffsetX = svgRect.left - containerRect.left
      const svgOffsetY = svgRect.top - containerRect.top
      const buttonTop = svgOffsetY + 8
      const buttonRight = containerRect.width - (svgOffsetX + svgRect.width) + 8
      setSavedButtonPosition({ top: buttonTop, right: buttonRight })
    }

    // Calculate CSS transform to zoom and center on the revealed region
    if (svgRef.current && containerRef.current) {
      const path = svgRef.current.querySelector(`path[data-region-id="${giveUpReveal.regionId}"]`)
      console.log('[GiveUp Zoom] Found path:', path, 'for regionId:', giveUpReveal.regionId)
      if (path && path instanceof SVGGeometryElement) {
        const bbox = path.getBoundingClientRect()
        const svgRect = svgRef.current.getBoundingClientRect()

        // Calculate CSS transform for zoom animation
        // Region center relative to SVG element
        const regionCenterX = bbox.left + bbox.width / 2 - svgRect.left
        const regionCenterY = bbox.top + bbox.height / 2 - svgRect.top

        // SVG center
        const svgCenterX = svgRect.width / 2
        const svgCenterY = svgRect.height / 2

        // Calculate scale: zoom in so region is clearly visible
        // For tiny regions, zoom more; for larger ones, zoom less
        const regionSize = Math.max(bbox.width, bbox.height)
        const targetSize = Math.min(svgRect.width, svgRect.height) * 0.3 // Region should be ~30% of viewport
        const scale = Math.min(8, Math.max(2, targetSize / Math.max(regionSize, 1)))

        // Calculate translation to center the region
        // After scaling, we need to translate so the region center is at SVG center
        const translateX = (svgCenterX - regionCenterX) * scale
        const translateY = (svgCenterY - regionCenterY) * scale

        console.log('[GiveUp Zoom] Starting CSS transform animation:', {
          regionCenter: { x: regionCenterX, y: regionCenterY },
          svgCenter: { x: svgCenterX, y: svgCenterY },
          regionSize,
          scale,
          translate: { x: translateX, y: translateY },
        })

        // Start zoom-in animation using CSS transform
        console.log('[GiveUp Zoom] Setting zoom target:', {
          scale,
          translateX,
          translateY,
        })
        setGiveUpZoomTarget({ scale, translateX, translateY })
      }
    }

    // Animation: 3 pulses over 2 seconds
    const duration = 2000
    const pulses = 3
    const startTime = Date.now()

    const animate = () => {
      // Check if this animation has been cancelled (new give-up started)
      if (isCancelled) {
        console.log('[GiveUp Zoom] Animation cancelled - new give-up started')
        return
      }

      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Create pulsing effect: sin wave for smooth on/off
      const pulseProgress = Math.sin(progress * Math.PI * pulses * 2) * 0.5 + 0.5
      setGiveUpFlashProgress(pulseProgress)

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate)
      } else {
        // Animation complete - zoom back out to default
        console.log('[GiveUp Zoom] Zooming back out to default')
        setGiveUpZoomTarget({ scale: 1, translateX: 0, translateY: 0 })

        // Clear reveal state after a short delay to let zoom-out start
        timeoutId = setTimeout(() => {
          if (!isCancelled) {
            setGiveUpFlashProgress(0)
            setIsGiveUpAnimating(false)
            setSavedButtonPosition(null)
          }
        }, 100)
      }
    }

    animationFrameId = requestAnimationFrame(animate)

    // Cleanup: cancel animation if giveUpReveal changes before animation completes
    return () => {
      isCancelled = true
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
      console.log('[GiveUp Zoom] Cleanup - cancelling previous animation')
    }
  }, [giveUpReveal?.timestamp]) // Re-run when timestamp changes

  // Hint animation effect - brief pulse to highlight target region
  useEffect(() => {
    if (!hintActive) {
      setHintFlashProgress(0)
      setIsHintAnimating(false)
      return
    }

    // Track if this effect has been cleaned up
    let isCancelled = false
    let animationFrameId: number | null = null

    // Start animation
    setIsHintAnimating(true)

    // Animation: 2 pulses over 1.5 seconds (shorter than give-up)
    const duration = 1500
    const pulses = 2
    const startTime = Date.now()

    const animate = () => {
      if (isCancelled) return

      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Create pulsing effect: sin wave for smooth on/off
      const pulseProgress = Math.sin(progress * Math.PI * pulses * 2) * 0.5 + 0.5
      setHintFlashProgress(pulseProgress)

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate)
      } else {
        // Animation complete
        setHintFlashProgress(0)
        setIsHintAnimating(false)
      }
    }

    animationFrameId = requestAnimationFrame(animate)

    // Cleanup
    return () => {
      isCancelled = true
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [hintActive?.timestamp]) // Re-run when timestamp changes

  // Keyboard shortcuts - Shift for magnifier, H for hint
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.key === 'Shift' && !e.repeat) {
        setShiftPressed(true)
      }

      // 'H' key to toggle hint bubble
      if ((e.key === 'h' || e.key === 'H') && !e.repeat && hasHint) {
        setShowHintBubble((prev) => !prev)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setShiftPressed(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [hasHint])

  const [labelPositions, setLabelPositions] = useState<RegionLabelPosition[]>([])
  const [smallRegionLabelPositions, setSmallRegionLabelPositions] = useState<
    Array<{
      regionId: string
      regionName: string
      isFound: boolean
      labelX: number // pixel position for label
      labelY: number // pixel position for label
      lineStartX: number // pixel position for line start
      lineStartY: number // pixel position for line start
      lineEndX: number // pixel position for line end (region center)
      lineEndY: number // pixel position for line end
    }>
  >([])

  // Measure container element to get available space for viewBox calculation
  // IMPORTANT: We measure the container, not the SVG, to avoid circular dependency:
  // The SVG fills the container, and the viewBox is calculated based on container aspect ratio
  useEffect(() => {
    if (!containerRef.current) return

    const updateDimensions = () => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        setSvgDimensions({ width: rect.width, height: rect.height })
      }
    }

    // Use ResizeObserver to detect panel resizing (not just window resize)
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        updateDimensions()
      })
    })

    observer.observe(containerRef.current)

    // Initial measurement
    updateDimensions()

    return () => observer.disconnect()
  }, []) // No dependencies - container size doesn't depend on viewBox

  // Calculate label positions using ghost elements
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return

    const updateLabelPositions = () => {
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return

      const positions: RegionLabelPosition[] = []
      const smallPositions: typeof smallRegionLabelPositions = []

      // Parse viewBox for scale calculations
      const viewBoxParts = displayViewBox.split(' ').map(Number)
      const viewBoxX = viewBoxParts[0] || 0
      const viewBoxY = viewBoxParts[1] || 0
      const viewBoxWidth = viewBoxParts[2] || 1000
      const viewBoxHeight = viewBoxParts[3] || 1000

      const svgRect = svgRef.current?.getBoundingClientRect()
      if (!svgRect) return

      // Get the actual rendered viewport accounting for preserveAspectRatio letterboxing
      const viewport = getRenderedViewport(svgRect, viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight)
      const scaleX = viewport.scale
      const scaleY = viewport.scale // Same as scaleX due to uniform scaling

      // Calculate SVG offset within container (accounts for padding + letterboxing)
      const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
      const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY

      // Collect all regions with their info for force simulation
      interface LabelNode extends SimulationNodeDatum {
        id: string
        name: string
        x: number
        y: number
        targetX: number
        targetY: number
        width: number
        height: number
        isFound: boolean
        isSmall: boolean
        players?: string[]
      }

      const allLabelNodes: LabelNode[] = []

      // Process both included regions and excluded regions for labeling
      ;[...mapData.regions, ...excludedRegions].forEach((region) => {
        // Calculate centroid pixel position directly from SVG coordinates
        // Account for SVG offset within container (padding, etc.)
        const centroidPixelX = (region.center[0] - viewBoxX) * scaleX + svgOffsetX
        const centroidPixelY = (region.center[1] - viewBoxY) * scaleY + svgOffsetY

        const pixelX = centroidPixelX
        const pixelY = centroidPixelY

        // Get the actual region path element to measure its TRUE screen dimensions
        const regionPath = svgRef.current?.querySelector(`path[data-region-id="${region.id}"]`)
        if (!regionPath) return

        const pathRect = regionPath.getBoundingClientRect()
        const pixelWidth = pathRect.width
        const pixelHeight = pathRect.height
        const pixelArea = pathRect.width * pathRect.height

        // Check if this is a small region using ACTUAL screen pixels
        const isSmall = pixelWidth < 10 || pixelHeight < 10 || pixelArea < 100

        // Debug logging ONLY for Gibraltar and ultra-tiny regions (< 1px)
        if (region.id === 'gi' || pixelWidth < 1 || pixelHeight < 1) {
          console.log(
            `[MapRenderer] ${region.id === 'gi' ? '🎯 GIBRALTAR' : '🔍 TINY'}: ${region.name} - ` +
              `W:${pixelWidth.toFixed(2)}px H:${pixelHeight.toFixed(2)}px ` +
              `Area:${pixelArea.toFixed(2)}px²`
          )
        }

        // Collect label nodes for regions that need labels
        // Only show arrow labels for small regions if showArrows flag is enabled
        // Exception: Washington DC always gets arrow label (too small on USA map)
        const isDC = region.id === 'dc'
        const isExcluded = excludedRegionIds.has(region.id)
        // Show label if: region is found, OR it's small and arrows enabled
        // Note: Excluded regions do NOT get labels - they're just grayed out
        const shouldShowLabel =
          regionsFound.includes(region.id) || (isSmall && (showArrows || isDC))

        if (shouldShowLabel) {
          const players = regionsFound.includes(region.id)
            ? guessHistory
                .filter((guess) => guess.regionId === region.id && guess.correct)
                .map((guess) => guess.playerId)
                .filter((playerId, index, self) => self.indexOf(playerId) === index)
            : undefined

          const labelWidth = region.name.length * 7 + 15
          const labelHeight = isSmall ? 25 : 30

          // Regular found states (non-small) get positioned exactly at centroid
          // Only small regions go through force simulation
          if (isSmall) {
            allLabelNodes.push({
              id: region.id,
              name: region.name,
              x: pixelX, // Start directly on region - will spread out to avoid collisions
              y: pixelY,
              targetX: pixelX, // Anchor point to pull back toward
              targetY: pixelY,
              width: labelWidth,
              height: labelHeight,
              isFound: regionsFound.includes(region.id),
              isSmall,
              players,
            })
          } else {
            // Add directly to positions array - no force simulation
            positions.push({
              regionId: region.id,
              regionName: region.name,
              x: pixelX,
              y: pixelY,
              players: players || [],
            })
          }
        }
      })

      // Add region obstacles to repel labels away from the map itself
      interface ObstacleNode extends SimulationNodeDatum {
        id: string
        x: number
        y: number
        isObstacle: true
        radius: number
      }

      const obstacleNodes: ObstacleNode[] = []

      // Add all regions (including unlabeled ones) as obstacles (if enabled)
      if (useObstacles) {
        mapData.regions.forEach((region) => {
          const ghostElement = svgRef.current?.querySelector(`[data-ghost-region="${region.id}"]`)
          if (!ghostElement) return

          const ghostRect = ghostElement.getBoundingClientRect()
          const pixelX = ghostRect.left - containerRect.left + ghostRect.width / 2
          const pixelY = ghostRect.top - containerRect.top + ghostRect.height / 2

          const regionPath = svgRef.current?.querySelector(`path[data-region-id="${region.id}"]`)
          if (!regionPath) return

          const pathRect = regionPath.getBoundingClientRect()
          const regionRadius = Math.max(pathRect.width, pathRect.height) / 2

          obstacleNodes.push({
            id: `obstacle-${region.id}`,
            isObstacle: true,
            x: pixelX,
            y: pixelY,
            radius: regionRadius + obstaclePadding,
          })
        })
      }

      // Combine labels and obstacles for simulation
      const allNodes = [...allLabelNodes, ...obstacleNodes]

      // Run force simulation to position labels without overlaps
      if (allLabelNodes.length > 0) {
        const simulation = forceSimulation(allNodes)
          .force(
            'collide',
            forceCollide<LabelNode | ObstacleNode>().radius((d) => {
              if ('isObstacle' in d && d.isObstacle) {
                return (d as ObstacleNode).radius
              }
              const label = d as LabelNode
              return Math.max(label.width, label.height) / 2 + collisionPadding
            })
          )
          .force(
            'x',
            forceX<LabelNode | ObstacleNode>((d) => {
              if ('isObstacle' in d && d.isObstacle) return d.x
              return (d as LabelNode).targetX
            }).strength(centeringStrength)
          )
          .force(
            'y',
            forceY<LabelNode | ObstacleNode>((d) => {
              if ('isObstacle' in d && d.isObstacle) return d.y
              return (d as LabelNode).targetY
            }).strength(centeringStrength)
          )
          .stop()

        // Run simulation - labels start on regions and only move as needed
        for (let i = 0; i < simulationIterations; i++) {
          simulation.tick()
        }

        // Helper: Calculate arrow start point on label edge closest to region
        const getArrowStartPoint = (
          labelX: number,
          labelY: number,
          labelWidth: number,
          labelHeight: number,
          targetX: number,
          targetY: number
        ): { x: number; y: number } => {
          // Direction from label to region
          const dx = targetX - labelX
          const dy = targetY - labelY

          // Label edges
          const halfWidth = labelWidth / 2
          const halfHeight = labelHeight / 2

          // Calculate intersection with label box
          // Use parametric line equation: point = (labelX, labelY) + t * (dx, dy)
          // Find t where line intersects rectangle edges

          let bestT = 0
          const epsilon = 1e-10

          // Check each edge
          if (Math.abs(dx) > epsilon) {
            // Right edge: x = labelX + halfWidth
            const tRight = halfWidth / dx
            if (tRight > 0 && tRight <= 1) {
              const y = labelY + tRight * dy
              if (Math.abs(y - labelY) <= halfHeight) {
                bestT = tRight
              }
            }
            // Left edge: x = labelX - halfWidth
            const tLeft = -halfWidth / dx
            if (tLeft > 0 && tLeft <= 1) {
              const y = labelY + tLeft * dy
              if (Math.abs(y - labelY) <= halfHeight) {
                if (bestT === 0 || tLeft < bestT) bestT = tLeft
              }
            }
          }

          if (Math.abs(dy) > epsilon) {
            // Bottom edge: y = labelY + halfHeight
            const tBottom = halfHeight / dy
            if (tBottom > 0 && tBottom <= 1) {
              const x = labelX + tBottom * dx
              if (Math.abs(x - labelX) <= halfWidth) {
                if (bestT === 0 || tBottom < bestT) bestT = tBottom
              }
            }
            // Top edge: y = labelY - halfHeight
            const tTop = -halfHeight / dy
            if (tTop > 0 && tTop <= 1) {
              const x = labelX + tTop * dx
              if (Math.abs(x - labelX) <= halfWidth) {
                if (bestT === 0 || tTop < bestT) bestT = tTop
              }
            }
          }

          return {
            x: labelX + bestT * dx,
            y: labelY + bestT * dy,
          }
        }

        // Extract positions from simulation results (only small regions now)
        for (const node of allLabelNodes) {
          // Special handling for Washington DC - position off the map to avoid blocking other states
          if (node.id === 'dc') {
            // Position DC label to the right of the map, outside the main map area
            const containerWidth = containerRect.width
            const labelX = containerWidth - 80 // 80px from right edge
            const labelY = svgOffsetY + svgRect.height * 0.35 // Upper-middle area

            const arrowStart = getArrowStartPoint(
              labelX,
              labelY,
              node.width,
              node.height,
              node.targetX,
              node.targetY
            )

            smallPositions.push({
              regionId: node.id,
              regionName: node.name,
              isFound: node.isFound,
              labelX: labelX,
              labelY: labelY,
              lineStartX: arrowStart.x,
              lineStartY: arrowStart.y,
              lineEndX: node.targetX,
              lineEndY: node.targetY,
            })
            continue // Skip normal processing
          }

          // All remaining nodes are small regions (non-small are added directly to positions)
          const arrowStart = getArrowStartPoint(
            node.x!,
            node.y!,
            node.width,
            node.height,
            node.targetX,
            node.targetY
          )

          smallPositions.push({
            regionId: node.id,
            regionName: node.name,
            isFound: node.isFound,
            labelX: node.x!,
            labelY: node.y!,
            lineStartX: arrowStart.x,
            lineStartY: arrowStart.y,
            lineEndX: node.targetX,
            lineEndY: node.targetY,
          })
        }
      }

      setLabelPositions(positions)
      setSmallRegionLabelPositions(smallPositions)

      // Debug log removed to reduce spam
    }

    // Small delay to ensure ghost elements are rendered
    const timeoutId = setTimeout(updateLabelPositions, 0)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [
    mapData,
    regionsFound,
    guessHistory,
    svgDimensions,
    excludedRegions,
    excludedRegionIds,
    displayViewBox,
  ])

  // Calculate viewBox dimensions for label offset calculations and sea background
  const viewBoxParts = displayViewBox.split(' ').map(Number)
  const viewBoxX = viewBoxParts[0] || 0
  const viewBoxY = viewBoxParts[1] || 0
  const viewBoxWidth = viewBoxParts[2] || 1000
  const viewBoxHeight = viewBoxParts[3] || 1000

  const showOutline = (region: MapRegion): boolean => {
    // Learning/Guided/Helpful modes: always show outlines
    if (
      assistanceLevel === 'learning' ||
      assistanceLevel === 'guided' ||
      assistanceLevel === 'helpful'
    )
      return true

    // Standard/None modes: only show outline on hover or if found
    return hoveredRegion === region.id || regionsFound.includes(region.id)
  }

  // Helper: Get the player who found a specific region
  const getPlayerWhoFoundRegion = (regionId: string): string | null => {
    const guess = guessHistory.find((g) => g.regionId === regionId && g.correct)
    return guess?.playerId || null
  }

  // Handle mouse movement to track cursor and show magnifier when needed
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!svgRef.current || !containerRef.current) return

    // Don't process mouse movement during pointer lock release animation
    if (isReleasingPointerLock) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const svgRect = svgRef.current.getBoundingClientRect()

    // Get cursor position relative to container
    let cursorX: number
    let cursorY: number

    if (pointerLocked) {
      // When pointer is locked, use movement deltas with precision multiplier
      const lastX = cursorPositionRef.current?.x ?? containerRect.width / 2
      const lastY = cursorPositionRef.current?.y ?? containerRect.height / 2

      // Apply smoothly animated movement multiplier for gradual cursor dampening transitions
      // This prevents jarring changes when moving between regions of different sizes
      const currentMultiplier = magnifierSpring.movementMultiplier.get()

      // Boundary dampening and squish effect
      // As cursor approaches edge, dampen movement and visually squish the cursor
      // When squished enough, the cursor "escapes" through the boundary and releases pointer lock
      const dampenZone = 40 // Distance from edge where dampening starts (px)
      const squishZone = 20 // Distance from edge where squish becomes visible (px)
      const escapeThreshold = 2 // When within this distance, escape! (px)

      // Calculate SVG offset within container (SVG may be smaller due to aspect ratio)
      const svgOffsetX = svgRect.left - containerRect.left
      const svgOffsetY = svgRect.top - containerRect.top

      // First, calculate undampened position to check how close we are to edges
      const undampenedX = lastX + e.movementX * currentMultiplier
      const undampenedY = lastY + e.movementY * currentMultiplier

      // Calculate distance from SVG edges (not container edges!)
      // This is critical - the interactive area is the SVG, not the container
      const distLeft = undampenedX - svgOffsetX
      const distRight = svgOffsetX + svgRect.width - undampenedX
      const distTop = undampenedY - svgOffsetY
      const distBottom = svgOffsetY + svgRect.height - undampenedY

      // Find closest edge distance
      const minDist = Math.min(distLeft, distRight, distTop, distBottom)

      // Calculate dampening factor based on proximity to edge
      let dampenFactor = 1.0
      if (minDist < dampenZone) {
        // Quadratic easing for smooth dampening
        const t = minDist / dampenZone
        dampenFactor = t * t // Squared for stronger dampening near edge
      }

      // Apply dampening to movement - this is the actual cursor position we'll use
      const dampenedDeltaX = e.movementX * currentMultiplier * dampenFactor
      const dampenedDeltaY = e.movementY * currentMultiplier * dampenFactor
      cursorX = lastX + dampenedDeltaX
      cursorY = lastY + dampenedDeltaY

      // Now check escape threshold using the DAMPENED position (not undampened!)
      // This is critical - we need to check where the cursor actually is, not where it would be without dampening
      // And we must use SVG bounds, not container bounds!
      const dampenedDistLeft = cursorX - svgOffsetX
      const dampenedDistRight = svgOffsetX + svgRect.width - cursorX
      const dampenedDistTop = cursorY - svgOffsetY
      const dampenedDistBottom = svgOffsetY + svgRect.height - cursorY
      const dampenedMinDist = Math.min(
        dampenedDistLeft,
        dampenedDistRight,
        dampenedDistTop,
        dampenedDistBottom
      )

      // Debug logging for boundary proximity
      if (dampenedMinDist < squishZone) {
        console.log('[Squish Debug]', {
          cursorPos: { x: cursorX.toFixed(1), y: cursorY.toFixed(1) },
          containerSize: {
            width: containerRect.width.toFixed(1),
            height: containerRect.height.toFixed(1),
          },
          svgSize: {
            width: svgRect.width.toFixed(1),
            height: svgRect.height.toFixed(1),
          },
          svgOffset: { x: svgOffsetX.toFixed(1), y: svgOffsetY.toFixed(1) },
          distances: {
            left: dampenedDistLeft.toFixed(1),
            right: dampenedDistRight.toFixed(1),
            top: dampenedDistTop.toFixed(1),
            bottom: dampenedDistBottom.toFixed(1),
            min: dampenedMinDist.toFixed(1),
          },
          dampenFactor: dampenFactor.toFixed(3),
          thresholds: {
            squishZone,
            escapeThreshold,
          },
          willEscape: dampenedMinDist < escapeThreshold,
        })
      }

      // Check if cursor has squished through and should escape (using dampened position!)
      if (dampenedMinDist < escapeThreshold && !isReleasingPointerLock) {
        console.log('[Pointer Lock] 🔓 ESCAPING (squished through boundary):', {
          dampenedMinDist,
          escapeThreshold,
          cursorX,
          cursorY,
          whichEdge: {
            left: dampenedDistLeft === dampenedMinDist,
            right: dampenedDistRight === dampenedMinDist,
            top: dampenedDistTop === dampenedMinDist,
            bottom: dampenedDistBottom === dampenedMinDist,
          },
        })

        // Start animation back to initial capture position
        setIsReleasingPointerLock(true)

        // Animate cursor back to initial position before releasing
        if (initialCapturePositionRef.current) {
          const startPos = { x: cursorX, y: cursorY }
          const endPos = initialCapturePositionRef.current
          const duration = 200 // ms
          const startTime = performance.now()

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime
            const progress = Math.min(elapsed / duration, 1)

            // Ease out cubic for smooth deceleration
            const eased = 1 - (1 - progress) ** 3

            const interpolatedX = startPos.x + (endPos.x - startPos.x) * eased
            const interpolatedY = startPos.y + (endPos.y - startPos.y) * eased

            // Update cursor position
            cursorPositionRef.current = { x: interpolatedX, y: interpolatedY }
            setCursorPosition({ x: interpolatedX, y: interpolatedY })

            if (progress < 1) {
              requestAnimationFrame(animate)
            } else {
              // Animation complete - now release pointer lock
              console.log('[Pointer Lock] 🔓 Animation complete, releasing pointer lock')
              document.exitPointerLock()
            }
          }

          requestAnimationFrame(animate)
        } else {
          // No initial position saved, release immediately
          document.exitPointerLock()
        }

        // Don't update cursor position in this frame - animation will handle it
        return
      }

      // Calculate squish effect based on proximity to edges (using dampened position!)
      // Handle horizontal and vertical squishing independently to support corners
      let squishX = 1.0
      let squishY = 1.0

      // Horizontal squishing (left/right edges)
      if (dampenedDistLeft < squishZone) {
        // Squishing against left edge - compress horizontally
        const t = 1 - dampenedDistLeft / squishZone
        squishX = Math.min(squishX, 1.0 - t * 0.5) // Compress to 50% width
      } else if (dampenedDistRight < squishZone) {
        // Squishing against right edge - compress horizontally
        const t = 1 - dampenedDistRight / squishZone
        squishX = Math.min(squishX, 1.0 - t * 0.5)
      }

      // Vertical squishing (top/bottom edges)
      if (dampenedDistTop < squishZone) {
        // Squishing against top edge - compress vertically
        const t = 1 - dampenedDistTop / squishZone
        squishY = Math.min(squishY, 1.0 - t * 0.5)
      } else if (dampenedDistBottom < squishZone) {
        // Squishing against bottom edge - compress vertically
        const t = 1 - dampenedDistBottom / squishZone
        squishY = Math.min(squishY, 1.0 - t * 0.5)
      }

      // Update squish state
      setCursorSquish({ x: squishX, y: squishY })

      // Clamp to SVG bounds (not container bounds!)
      // Allow cursor to reach escape threshold at SVG edges
      cursorX = Math.max(svgOffsetX, Math.min(svgOffsetX + svgRect.width, cursorX))
      cursorY = Math.max(svgOffsetY, Math.min(svgOffsetY + svgRect.height, cursorY))
    } else {
      // Normal mode: use absolute position
      cursorX = e.clientX - containerRect.left
      cursorY = e.clientY - containerRect.top
    }

    // Check if cursor is over the SVG
    const isOverSvg =
      cursorX >= svgRect.left - containerRect.left &&
      cursorX <= svgRect.right - containerRect.left &&
      cursorY >= svgRect.top - containerRect.top &&
      cursorY <= svgRect.bottom - containerRect.top

    // Don't hide magnifier if mouse is still in container (just moved to padding/magnifier area)
    // Only update cursor position and check for regions if over SVG
    if (!isOverSvg) {
      // Keep magnifier visible but frozen at last position
      // It will be hidden by handleMouseLeave when mouse exits container
      return
    }

    // No velocity tracking needed - zoom adapts immediately to region size

    // Update cursor position ref for next frame
    cursorPositionRef.current = { x: cursorX, y: cursorY }
    setCursorPosition({ x: cursorX, y: cursorY })

    // Note: Button hover detection is handled by usePointerLockButton hooks

    // Use region detection hook to find regions near cursor
    const detectionResult = detectRegions(cursorX, cursorY)
    const {
      detectedRegions: detectedRegionObjects,
      regionUnderCursor,
      regionUnderCursorArea,
      regionsInBox,
      hasSmallRegion,
      detectedSmallestSize,
      totalRegionArea,
    } = detectionResult

    if (pointerLocked && detectedRegionObjects.length > 0) {
      const sortedSizes = detectedRegionObjects.map((r) => `${r.id}: ${r.screenSize.toFixed(2)}px`)
      console.log('[Zoom Search] Sorted regions (smallest first):', sortedSizes)
    }

    // Show magnifier when:
    // 1. Shift key is held down (manual override)
    // 2. Current target region needs magnification AND there's a small region nearby
    const shouldShow = shiftPressed || (targetNeedsMagnification && hasSmallRegion)

    // Update smallest region size for adaptive cursor dampening
    // Use hysteresis to prevent rapid flickering at boundaries
    if (shouldShow && detectedSmallestSize !== Infinity) {
      // Only update if the new size is significantly different (>20% change)
      // This prevents jitter when moving near region boundaries
      const currentSize = smallestRegionSize
      const sizeRatio = currentSize === Infinity ? 0 : detectedSmallestSize / currentSize
      const significantChange = currentSize === Infinity || sizeRatio < 0.8 || sizeRatio > 1.25
      if (significantChange) {
        setSmallestRegionSize(detectedSmallestSize)
      }
    } else if (smallestRegionSize !== Infinity) {
      // When leaving precision area, don't immediately jump to Infinity
      // Instead, set to a large value that will smoothly transition via spring
      setSmallestRegionSize(100) // Large enough that multiplier becomes 1.0
    }

    // Set hover highlighting based on cursor position
    // This ensures the crosshairs match what's highlighted
    if (regionUnderCursor !== hoveredRegion) {
      setHoveredRegion(regionUnderCursor)
    }

    // Hot/cold audio feedback
    // Only run if enabled, we have a target region, and device has a fine pointer (mouse)
    if (hotColdEnabledRef.current && currentPrompt && hasFinePointer) {
      // Find target region's SVG center
      const targetRegion = mapData.regions.find((r) => r.id === currentPrompt)
      if (targetRegion) {
        // Parse viewBox for coordinate conversion
        const viewBoxParts = displayViewBox.split(' ').map(Number)
        const viewBoxX = viewBoxParts[0] || 0
        const viewBoxY = viewBoxParts[1] || 0
        const viewBoxW = viewBoxParts[2] || 1000
        const viewBoxH = viewBoxParts[3] || 500
        // Convert SVG center to pixel coordinates
        const viewport = getRenderedViewport(svgRect, viewBoxX, viewBoxY, viewBoxW, viewBoxH)
        const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
        const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY
        const targetPixelX = (targetRegion.center[0] - viewBoxX) * viewport.scale + svgOffsetX
        const targetPixelY = (targetRegion.center[1] - viewBoxY) * viewport.scale + svgOffsetY

        // Calculate cursor position in SVG coordinates for finding closest region (for accent)
        const cursorSvgX = (cursorX - svgOffsetX) / viewport.scale + viewBoxX
        const cursorSvgY = (cursorY - svgOffsetY) / viewport.scale + viewBoxY

        checkHotCold({
          cursorPosition: { x: cursorX, y: cursorY },
          targetCenter: { x: targetPixelX, y: targetPixelY },
          hoveredRegionId: regionUnderCursor,
          cursorSvgPosition: { x: cursorSvgX, y: cursorSvgY },
        })
      }
    }

    // Send cursor position to other players (in SVG coordinates)
    // In turn-based mode, only broadcast when it's our turn
    // We do this AFTER detectRegions so we can include the exact hovered region
    const shouldBroadcastCursor =
      onCursorUpdate &&
      svgRef.current &&
      (gameMode !== 'turn-based' || currentPlayer === localPlayerId)

    if (shouldBroadcastCursor) {
      const viewBoxParts = displayViewBox.split(' ').map(Number)
      const viewBoxX = viewBoxParts[0] || 0
      const viewBoxY = viewBoxParts[1] || 0
      const viewBoxW = viewBoxParts[2] || 1000
      const viewBoxH = viewBoxParts[3] || 500
      // Account for preserveAspectRatio letterboxing when converting to SVG coords
      const viewport = getRenderedViewport(svgRect, viewBoxX, viewBoxY, viewBoxW, viewBoxH)
      const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
      const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY
      // Use inverse of viewport.scale to convert pixels to viewBox units
      const cursorSvgX = (cursorX - svgOffsetX) / viewport.scale + viewBoxX
      const cursorSvgY = (cursorY - svgOffsetY) / viewport.scale + viewBoxY
      // Pass the exact region under cursor (from local hit-testing) so other clients
      // don't need to re-do hit-testing which can yield different results due to scaling
      onCursorUpdate({ x: cursorSvgX, y: cursorSvgY }, regionUnderCursor)
    }

    if (shouldShow) {
      // Filter out found regions from zoom calculations
      // Found regions shouldn't influence how much we zoom in
      const unfoundRegionObjects = detectedRegionObjects.filter((r) => !regionsFound.includes(r.id))

      // Use adaptive zoom search utility to find optimal zoom
      const zoomSearchResult = findOptimalZoom({
        detectedRegions: unfoundRegionObjects,
        detectedSmallestSize,
        cursorX,
        cursorY,
        containerRect,
        svgRect,
        mapData,
        svgElement: svgRef.current!,
        largestPieceSizesCache: largestPieceSizesRef.current,
        maxZoom: MAX_ZOOM,
        minZoom: 1,
        pointerLocked,
      })

      let adaptiveZoom = zoomSearchResult.zoom
      const boundingBoxes = zoomSearchResult.boundingBoxes

      // Save bounding boxes for rendering
      setDebugBoundingBoxes(boundingBoxes)
      // Save full zoom search result for debug panel
      setZoomSearchDebugInfo(zoomSearchResult)

      // Calculate magnifier dimensions (responsive to aspect ratio)
      const { width: magnifierWidth, height: magnifierHeight } = getMagnifierDimensions(
        containerRect.width,
        containerRect.height
      )

      // Lazy magnifier positioning: only move if cursor would be obscured
      // Check if cursor is within current magnifier bounds (with padding)
      const padding = 10 // pixels of buffer around magnifier
      const currentMagLeft = targetLeft
      const currentMagTop = targetTop
      const currentMagRight = currentMagLeft + magnifierWidth
      const currentMagBottom = currentMagTop + magnifierHeight

      const cursorInMagnifier =
        cursorX >= currentMagLeft - padding &&
        cursorX <= currentMagRight + padding &&
        cursorY >= currentMagTop - padding &&
        cursorY <= currentMagBottom + padding

      // Only calculate new position if cursor would be obscured
      let newTop = targetTop
      let newLeft = targetLeft

      if (cursorInMagnifier) {
        // Move to opposite corner from cursor
        const isLeftHalf = cursorX < containerRect.width / 2
        const isTopHalf = cursorY < containerRect.height / 2

        // Default: opposite corner from cursor
        newTop = isTopHalf ? containerRect.height - magnifierHeight - 20 : 20
        newLeft = isLeftHalf ? containerRect.width - magnifierWidth - 20 : 20

        // When hint bubble is shown, blacklist the upper-right corner
        // If magnifier would go to top-right (cursor in bottom-left), go to bottom-right instead
        const wouldGoToTopRight = !isTopHalf && isLeftHalf
        if (showHintBubble && wouldGoToTopRight) {
          newTop = containerRect.height - magnifierHeight - 20 // Move to bottom
          // newLeft stays at right
        }
      }

      if (pointerLocked) {
        console.log(
          '[Magnifier] SHOWING with zoom:',
          adaptiveZoom,
          '| Setting opacity to 1, position:',
          { top: newTop, left: newLeft },
          cursorInMagnifier ? '(moved - cursor was in magnifier)' : '(staying put)'
        )
      }

      // Store uncapped adaptive zoom before potentially capping it
      uncappedAdaptiveZoomRef.current = adaptiveZoom

      // Cap zoom if not in pointer lock mode to prevent excessive screen pixel ratios
      if (!pointerLocked && containerRef.current && svgRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const svgRect = svgRef.current.getBoundingClientRect()
        const { width: magnifierWidth } = getMagnifierDimensions(
          containerRect.width,
          containerRect.height
        )
        const viewBoxParts = displayViewBox.split(' ').map(Number)
        const viewBoxWidth = viewBoxParts[2]

        if (viewBoxWidth && !Number.isNaN(viewBoxWidth)) {
          // Calculate what the screen pixel ratio would be at this zoom
          const screenPixelRatio = calculateScreenPixelRatio({
            magnifierWidth,
            viewBoxWidth,
            svgWidth: svgRect.width,
            zoom: adaptiveZoom,
          })

          // If it exceeds threshold, cap the zoom to stay at threshold
          if (isAboveThreshold(screenPixelRatio, PRECISION_MODE_THRESHOLD)) {
            const maxZoom = calculateMaxZoomAtThreshold(
              PRECISION_MODE_THRESHOLD,
              magnifierWidth,
              svgRect.width
            )
            adaptiveZoom = Math.min(adaptiveZoom, maxZoom)
            // Zoom cap log removed to reduce spam
          }
        }
      }

      setTargetZoom(adaptiveZoom)
      setShowMagnifier(true)
      setTargetOpacity(1)
      setTargetTop(newTop)
      setTargetLeft(newLeft)
    } else {
      if (pointerLocked) {
        console.log('[Magnifier] HIDING - not enough regions or too large | Setting opacity to 0')
      }
      setShowMagnifier(false)
      setTargetOpacity(0)
      setDebugBoundingBoxes([]) // Clear bounding boxes when hiding
    }
  }

  const handleMouseLeave = () => {
    // Don't hide magnifier when pointer is locked
    // The cursor is locked to the container, so mouse leave events are not meaningful
    if (pointerLocked) {
      console.log('[Mouse Leave] Ignoring - pointer is locked')
      return
    }

    setShowMagnifier(false)
    setTargetOpacity(0)
    setCursorPosition(null)
    setDebugBoundingBoxes([]) // Clear bounding boxes when leaving
    cursorPositionRef.current = null

    // Notify other players that cursor left
    // In turn-based mode, only broadcast when it's our turn
    if (onCursorUpdate && (gameMode !== 'turn-based' || currentPlayer === localPlayerId)) {
      onCursorUpdate(null, null)
    }
  }

  // Mobile magnifier touch handlers - allow panning by dragging on the magnifier
  const handleMagnifierTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return // Only handle single-finger touch

    const touch = e.touches[0]
    magnifierTouchStartRef.current = { x: touch.clientX, y: touch.clientY }
    magnifierDidMoveRef.current = false // Reset movement tracking

    // Record tap position relative to magnifier for tap-to-select
    if (magnifierRef.current) {
      const magnifierRect = magnifierRef.current.getBoundingClientRect()
      magnifierTapPositionRef.current = {
        x: touch.clientX - magnifierRect.left,
        y: touch.clientY - magnifierRect.top,
      }
    }

    setIsMagnifierDragging(true)
    e.preventDefault() // Prevent scrolling
  }, [])

  const handleMagnifierTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!isMagnifierDragging || e.touches.length !== 1) return
      if (!magnifierTouchStartRef.current || !cursorPositionRef.current) return
      if (!svgRef.current || !containerRef.current) return

      const touch = e.touches[0]
      const deltaX = touch.clientX - magnifierTouchStartRef.current.x
      const deltaY = touch.clientY - magnifierTouchStartRef.current.y

      // Track if user has moved significantly (more than 5px = definitely a drag, not a tap)
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        magnifierDidMoveRef.current = true
      }

      // Update start position for next move
      magnifierTouchStartRef.current = { x: touch.clientX, y: touch.clientY }

      // Scale touch delta by zoom level for 1:1 panning feel.
      //
      // The magnifier shows a zoomed view of the map. When zoomed 3x:
      // - Moving cursor by 1 pixel shifts the magnifier view by 3 pixels
      // - To get 1:1 feel (finger moves N pixels = content moves N pixels in magnifier),
      //   we divide finger movement by zoom level
      //
      // This makes dragging feel like moving the map under a fixed magnifying glass.
      const currentZoom = getCurrentZoom()
      const touchMultiplier = 1 / currentZoom

      // Invert the delta - dragging right on magnifier should show content to the right
      // (which means moving the cursor right in the map coordinate space)
      // Actually, dragging the "paper" under the magnifier means:
      // - Drag finger right = paper moves right = magnifier shows what was to the LEFT
      // - So we SUBTRACT the delta to move the cursor in the opposite direction
      const newCursorX = cursorPositionRef.current.x - deltaX * touchMultiplier
      const newCursorY = cursorPositionRef.current.y - deltaY * touchMultiplier

      // Clamp to SVG bounds
      const containerRect = containerRef.current.getBoundingClientRect()
      const svgRect = svgRef.current.getBoundingClientRect()
      const svgOffsetX = svgRect.left - containerRect.left
      const svgOffsetY = svgRect.top - containerRect.top

      const clampedX = Math.max(svgOffsetX, Math.min(svgOffsetX + svgRect.width, newCursorX))
      const clampedY = Math.max(svgOffsetY, Math.min(svgOffsetY + svgRect.height, newCursorY))

      // Update cursor position
      cursorPositionRef.current = { x: clampedX, y: clampedY }
      setCursorPosition({ x: clampedX, y: clampedY })

      // Run region detection to update hoveredRegionId (so user sees which region is under cursor)
      // We don't update zoom during drag to avoid disorienting zoom changes while panning
      const { regionUnderCursor } = detectRegions(clampedX, clampedY)

      // Broadcast cursor update to other players (if in multiplayer)
      if (
        onCursorUpdate &&
        (gameMode !== 'turn-based' || currentPlayer === localPlayerId) &&
        containerRef.current &&
        svgRef.current
      ) {
        const viewBoxParts = displayViewBox.split(' ').map(Number)
        const viewBoxX = viewBoxParts[0] || 0
        const viewBoxY = viewBoxParts[1] || 0
        const viewBoxW = viewBoxParts[2] || 1000
        const viewBoxH = viewBoxParts[3] || 500
        const viewport = getRenderedViewport(svgRect, viewBoxX, viewBoxY, viewBoxW, viewBoxH)
        const svgOffsetXWithLetterbox = svgRect.left - containerRect.left + viewport.letterboxX
        const svgOffsetYWithLetterbox = svgRect.top - containerRect.top + viewport.letterboxY
        const cursorSvgX = (clampedX - svgOffsetXWithLetterbox) / viewport.scale + viewBoxX
        const cursorSvgY = (clampedY - svgOffsetYWithLetterbox) / viewport.scale + viewBoxY
        onCursorUpdate({ x: cursorSvgX, y: cursorSvgY }, regionUnderCursor)
      }

      e.preventDefault() // Prevent scrolling
    },
    [
      isMagnifierDragging,
      detectRegions,
      onCursorUpdate,
      gameMode,
      currentPlayer,
      localPlayerId,
      displayViewBox,
      getCurrentZoom,
    ]
  )

  const handleMagnifierTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      // Check if this was a tap (no significant movement) vs a drag
      // If the user just tapped on the magnifier, select the region at the tap position
      const didMove = magnifierDidMoveRef.current
      const tapPosition = magnifierTapPositionRef.current
      setIsMagnifierDragging(false)
      magnifierTouchStartRef.current = null
      magnifierDidMoveRef.current = false
      magnifierTapPositionRef.current = null

      // If there was a changed touch that ended and it wasn't a drag, check for tap-to-select
      if (e.changedTouches.length === 1 && !didMove && tapPosition) {
        // Convert tap position on magnifier to SVG coordinates
        if (
          magnifierRef.current &&
          svgRef.current &&
          containerRef.current &&
          cursorPositionRef.current
        ) {
          const magnifierRect = magnifierRef.current.getBoundingClientRect()
          const containerRect = containerRef.current.getBoundingClientRect()
          const svgRect = svgRef.current.getBoundingClientRect()

          // Get the current zoom level
          const currentZoom = zoomSpring.get()

          // Parse the main map viewBox
          const viewBoxParts = displayViewBox.split(' ').map(Number)
          const viewBoxX = viewBoxParts[0] || 0
          const viewBoxY = viewBoxParts[1] || 0
          const viewBoxW = viewBoxParts[2] || 1000
          const viewBoxH = viewBoxParts[3] || 1000

          // Get viewport info for coordinate conversion
          const viewport = getRenderedViewport(svgRect, viewBoxX, viewBoxY, viewBoxW, viewBoxH)
          const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
          const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY

          // Current cursor position in SVG coordinates (center of magnifier view)
          const cursorSvgX = (cursorPositionRef.current.x - svgOffsetX) / viewport.scale + viewBoxX
          const cursorSvgY = (cursorPositionRef.current.y - svgOffsetY) / viewport.scale + viewBoxY

          // Magnifier viewBox dimensions
          const magnifiedWidth = viewBoxW / currentZoom
          const magnifiedHeight = viewBoxH / currentZoom

          // Convert tap position (relative to magnifier) to SVG coordinates
          // Tap at (0,0) is top-left of magnifier = cursorSvg - magnifiedSize/2
          // Tap at (magnifierWidth, magnifierHeight) is bottom-right = cursorSvg + magnifiedSize/2
          const tapSvgX =
            cursorSvgX - magnifiedWidth / 2 + (tapPosition.x / magnifierRect.width) * magnifiedWidth
          const tapSvgY =
            cursorSvgY -
            magnifiedHeight / 2 +
            (tapPosition.y / magnifierRect.height) * magnifiedHeight

          // Convert SVG coordinates back to container coordinates for region detection
          const tapContainerX = (tapSvgX - viewBoxX) * viewport.scale + svgOffsetX
          const tapContainerY = (tapSvgY - viewBoxY) * viewport.scale + svgOffsetY

          // Run region detection at the tap position
          const { regionUnderCursor } = detectRegions(tapContainerX, tapContainerY)

          if (regionUnderCursor) {
            const region = mapData.regions.find((r) => r.id === regionUnderCursor)
            if (region) {
              console.log('[Touch] Tapped on magnifier to select region:', regionUnderCursor)
              onRegionClick(regionUnderCursor, region.name)
            }
          }
        }
      }
    },
    [detectRegions, mapData.regions, onRegionClick, displayViewBox, zoomSpring]
  )

  return (
    <div
      ref={containerRef}
      data-component="map-renderer"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleContainerClick}
      className={css({
        position: 'relative',
        width: '100%',
        height: '100%',
        flex: 1, // Fill available space in parent flex container
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      })}
      style={{
        // Sea/ocean background with wavy CSS pattern at screen pixel scale
        backgroundColor: isDark ? '#1e3a5f' : '#a8d4f0',
        backgroundImage: isDark
          ? `repeating-linear-gradient(
              15deg,
              transparent,
              transparent 18px,
              rgba(45, 74, 111, 0.5) 18px,
              rgba(45, 74, 111, 0.5) 20px,
              transparent 20px,
              transparent 48px,
              rgba(45, 74, 111, 0.4) 48px,
              rgba(45, 74, 111, 0.4) 50px,
              transparent 50px,
              transparent 78px,
              rgba(45, 74, 111, 0.3) 78px,
              rgba(45, 74, 111, 0.3) 80px
            )`
          : `repeating-linear-gradient(
              15deg,
              transparent,
              transparent 18px,
              rgba(143, 196, 232, 0.5) 18px,
              rgba(143, 196, 232, 0.5) 20px,
              transparent 20px,
              transparent 48px,
              rgba(143, 196, 232, 0.4) 48px,
              rgba(143, 196, 232, 0.4) 50px,
              transparent 50px,
              transparent 78px,
              rgba(143, 196, 232, 0.3) 78px,
              rgba(143, 196, 232, 0.3) 80px
            )`,
        backgroundSize: '100px 100px',
      }}
    >
      <animated.svg
        ref={svgRef}
        viewBox={displayViewBox}
        className={css({
          // Fill the entire container - viewBox controls what portion of map is visible
          width: '100%',
          height: '100%',
          cursor: pointerLocked ? 'crosshair' : 'pointer',
          transformOrigin: 'center center',
        })}
        style={{
          // No aspectRatio - the SVG fills the container and viewBox is calculated
          // to match the container's aspect ratio via calculateFitCropViewBox
          // CSS transform for zoom animation during give-up reveal
          transform: to(
            [mainMapSpring.scale, mainMapSpring.translateX, mainMapSpring.translateY],
            (s, tx, ty) => `scale(${s}) translate(${tx / s}px, ${ty / s}px)`
          ),
        }}
      >
        {/* Render all regions (included + excluded) */}
        {[...mapData.regions, ...excludedRegions].map((region) => {
          const isExcluded = excludedRegionIds.has(region.id)
          const isFound = regionsFound.includes(region.id) || isExcluded // Treat excluded as pre-found
          const playerId = !isExcluded && isFound ? getPlayerWhoFoundRegion(region.id) : null
          const isBeingRevealed = giveUpReveal?.regionId === region.id
          const isBeingHinted = hintActive?.regionId === region.id

          // Special styling for excluded regions (grayed out, pre-labeled)
          // Bright gold flash for give up reveal with high contrast
          // Cyan flash for hint
          const fill = isBeingRevealed
            ? `rgba(255, 200, 0, ${0.6 + giveUpFlashProgress * 0.4})` // Brighter gold, higher base opacity
            : isExcluded
              ? isDark
                ? '#374151' // gray-700
                : '#d1d5db' // gray-300
              : isFound && playerId
                ? `url(#player-pattern-${playerId})`
                : getRegionColor(region.id, isFound, hoveredRegion === region.id, isDark)

          // During give-up animation, dim all non-revealed regions
          const dimmedOpacity = isGiveUpAnimating && !isBeingRevealed ? 0.25 : 1

          // Revealed region gets a prominent stroke
          // Unfound regions get thicker borders for better visibility against sea
          const stroke = isBeingRevealed
            ? `rgba(255, 140, 0, ${0.8 + giveUpFlashProgress * 0.2})` // Orange stroke for contrast
            : getRegionStroke(isFound, isDark)
          const strokeWidth = isBeingRevealed ? 3 : isFound ? 1 : 1.5

          // Check if a network cursor is hovering over this region
          const networkHover = networkHoveredRegions[region.id]

          return (
            <g key={region.id} style={{ opacity: dimmedOpacity }}>
              {/* Glow effect for network-hovered region (other player's cursor) */}
              {networkHover && !isBeingRevealed && (
                <path
                  d={region.path}
                  fill="none"
                  stroke={networkHover.color}
                  strokeWidth={6}
                  vectorEffect="non-scaling-stroke"
                  opacity={0.5}
                  style={{ filter: 'blur(3px)' }}
                  pointerEvents="none"
                />
              )}
              {/* Glow effect for revealed region */}
              {isBeingRevealed && (
                <path
                  d={region.path}
                  fill="none"
                  stroke={`rgba(255, 215, 0, ${0.3 + giveUpFlashProgress * 0.5})`}
                  strokeWidth={8}
                  vectorEffect="non-scaling-stroke"
                  style={{ filter: 'blur(4px)' }}
                />
              )}
              {/* Glow effect for hint - cyan pulsing outline */}
              {isBeingHinted && (
                <path
                  d={region.path}
                  fill={`rgba(0, 200, 255, ${0.1 + hintFlashProgress * 0.3})`}
                  stroke={`rgba(0, 200, 255, ${0.4 + hintFlashProgress * 0.6})`}
                  strokeWidth={6}
                  vectorEffect="non-scaling-stroke"
                  style={{ filter: 'blur(3px)' }}
                  pointerEvents="none"
                />
              )}
              {/* Network hover border (crisp outline in player color) */}
              {networkHover && !isBeingRevealed && (
                <path
                  d={region.path}
                  fill="none"
                  stroke={networkHover.color}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  opacity={0.8}
                  strokeDasharray="4,2"
                  pointerEvents="none"
                />
              )}
              {/* Region path */}
              <path
                data-region-id={region.id}
                d={region.path}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                vectorEffect="non-scaling-stroke"
                opacity={showOutline(region) ? 1 : 0.7} // Increased from 0.3 to 0.7 for better visibility
                // When pointer lock is active, hover is controlled by cursor position tracking
                // Otherwise, use native mouse events
                onMouseEnter={() => !isExcluded && !pointerLocked && setHoveredRegion(region.id)}
                onMouseLeave={() => !pointerLocked && setHoveredRegion(null)}
                onClick={() => {
                  console.log('[CLICK] Region clicked:', {
                    regionId: region.id,
                    regionName: region.name,
                    isExcluded,
                    willCall: !isExcluded,
                  })
                  if (!isExcluded) {
                    onRegionClick(region.id, region.name)
                  }
                }} // Disable clicks on excluded regions
                style={{
                  cursor: isExcluded ? 'default' : 'pointer',
                  transition: 'all 0.2s ease',
                  // Ensure entire path interior is clickable, not just visible fill
                  pointerEvents: isExcluded ? 'none' : 'all',
                }}
              />

              {/* Ghost element for region center position tracking */}
              <circle
                cx={region.center[0]}
                cy={region.center[1]}
                r={0.1}
                fill="none"
                pointerEvents="none"
                data-ghost-region={region.id}
              />
            </g>
          )
        })}

        {/* Debug: Render bounding boxes (only if enabled) */}
        {showDebugBoundingBoxes &&
          debugBoundingBoxes.map((bbox) => {
            // Color based on acceptance and importance
            // Green = accepted, Orange = high importance, Yellow = medium, Gray = low
            const importance = bbox.importance ?? 0
            let strokeColor = '#888888' // Default gray for low importance
            let fillColor = 'rgba(136, 136, 136, 0.1)'

            if (bbox.wasAccepted) {
              strokeColor = '#00ff00' // Green for accepted region
              fillColor = 'rgba(0, 255, 0, 0.15)'
            } else if (importance > 1.5) {
              strokeColor = '#ff6600' // Orange for high importance (2.0× boost + close)
              fillColor = 'rgba(255, 102, 0, 0.1)'
            } else if (importance > 0.5) {
              strokeColor = '#ffcc00' // Yellow for medium importance
              fillColor = 'rgba(255, 204, 0, 0.1)'
            }

            return (
              <g key={`bbox-${bbox.regionId}`}>
                <rect
                  x={bbox.x}
                  y={bbox.y}
                  width={bbox.width}
                  height={bbox.height}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={viewBoxWidth / 500}
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray="3,3"
                  pointerEvents="none"
                  opacity={0.9}
                />
              </g>
            )
          })}

        {/* Arrow marker definition */}
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill={isDark ? '#60a5fa' : '#3b82f6'} />
          </marker>
          <marker
            id="arrowhead-found"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#16a34a" />
          </marker>

          {/* Player emoji patterns for region backgrounds */}
          {Object.values(playerMetadata).map((player) => (
            <pattern
              key={`pattern-${player.id}`}
              id={`player-pattern-${player.id}`}
              width="60"
              height="60"
              patternUnits="userSpaceOnUse"
            >
              <rect width="60" height="60" fill={player.color} opacity="0.2" />
              <text
                x="30"
                y="30"
                fontSize="50"
                textAnchor="middle"
                dominantBaseline="middle"
                opacity="0.5"
              >
                {player.emoji}
              </text>
            </pattern>
          ))}
        </defs>

        {/* Magnifier region indicator on main map */}
        {showMagnifier && cursorPosition && svgRef.current && containerRef.current && (
          <animated.rect
            x={zoomSpring.to((zoom: number) => {
              const containerRect = containerRef.current!.getBoundingClientRect()
              const svgRect = svgRef.current!.getBoundingClientRect()
              const viewBoxParts = displayViewBox.split(' ').map(Number)
              const viewBoxX = viewBoxParts[0] || 0
              const viewBoxY = viewBoxParts[1] || 0
              const viewBoxWidth = viewBoxParts[2] || 1000
              const viewBoxHeight = viewBoxParts[3] || 1000
              // Account for preserveAspectRatio letterboxing
              const viewport = getRenderedViewport(
                svgRect,
                viewBoxX,
                viewBoxY,
                viewBoxWidth,
                viewBoxHeight
              )
              const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
              const cursorSvgX = (cursorPosition.x - svgOffsetX) / viewport.scale + viewBoxX
              const magnifiedWidth = viewBoxWidth / zoom
              return cursorSvgX - magnifiedWidth / 2
            })}
            y={zoomSpring.to((zoom: number) => {
              const containerRect = containerRef.current!.getBoundingClientRect()
              const svgRect = svgRef.current!.getBoundingClientRect()
              const viewBoxParts = displayViewBox.split(' ').map(Number)
              const viewBoxX = viewBoxParts[0] || 0
              const viewBoxY = viewBoxParts[1] || 0
              const viewBoxWidth = viewBoxParts[2] || 1000
              const viewBoxHeight = viewBoxParts[3] || 1000
              // Account for preserveAspectRatio letterboxing
              const viewport = getRenderedViewport(
                svgRect,
                viewBoxX,
                viewBoxY,
                viewBoxWidth,
                viewBoxHeight
              )
              const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY
              const cursorSvgY = (cursorPosition.y - svgOffsetY) / viewport.scale + viewBoxY
              const magnifiedHeight = viewBoxHeight / zoom
              return cursorSvgY - magnifiedHeight / 2
            })}
            width={zoomSpring.to((zoom: number) => {
              const viewBoxParts = displayViewBox.split(' ').map(Number)
              const viewBoxWidth = viewBoxParts[2] || 1000
              return viewBoxWidth / zoom
            })}
            height={zoomSpring.to((zoom: number) => {
              const viewBoxParts = displayViewBox.split(' ').map(Number)
              const viewBoxHeight = viewBoxParts[3] || 1000
              return viewBoxHeight / zoom
            })}
            fill="none"
            stroke={isDark ? '#60a5fa' : '#3b82f6'}
            strokeWidth={viewBoxWidth / 500}
            vectorEffect="non-scaling-stroke"
            strokeDasharray="5,5"
            pointerEvents="none"
            opacity={0.8}
          />
        )}
      </animated.svg>

      {/* HTML labels positioned absolutely over the SVG */}
      {labelPositions.map((label) => {
        const labelOpacity = calculateLabelOpacity(
          label.x,
          label.y,
          label.regionId,
          cursorPosition,
          hoveredRegion,
          regionsFound,
          isGiveUpAnimating
        )
        return (
          <div
            key={label.regionId}
            style={{
              position: 'absolute',
              left: `${label.x}px`,
              top: `${label.y}px`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 10,
              opacity: labelOpacity,
              transition: 'opacity 0.15s ease-out',
            }}
          >
            {/* Region name */}
            <div
              style={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: getLabelTextColor(isDark, true),
                textShadow: getLabelTextShadow(isDark, true),
                whiteSpace: 'nowrap',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              {label.regionName}
            </div>

            {/* Player avatars */}
            {label.players.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  gap: '2px',
                  marginTop: '2px',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                {label.players.map((playerId) => {
                  const player = playerMetadata[playerId]
                  if (!player) return null

                  return (
                    <div
                      key={playerId}
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: player.color || '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        opacity: 0.9,
                        pointerEvents: 'none',
                      }}
                    >
                      {player.emoji}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Small region labels with arrows positioned absolutely over the SVG */}
      {smallRegionLabelPositions.map((label) => {
        const labelOpacity = calculateLabelOpacity(
          label.labelX,
          label.labelY,
          label.regionId,
          cursorPosition,
          hoveredRegion,
          regionsFound,
          isGiveUpAnimating
        )
        return (
          <div
            key={`small-${label.regionId}`}
            style={{
              opacity: labelOpacity,
              transition: 'opacity 0.15s ease-out',
            }}
          >
            {/* Arrow line - use SVG positioned absolutely */}
            <svg
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                overflow: 'visible',
              }}
            >
              <line
                x1={label.lineStartX}
                y1={label.lineStartY}
                x2={label.lineEndX}
                y2={label.lineEndY}
                stroke={label.isFound ? '#16a34a' : isDark ? '#60a5fa' : '#3b82f6'}
                strokeWidth={1.5}
                markerEnd={label.isFound ? 'url(#arrowhead-found)' : 'url(#arrowhead)'}
              />
              {/* Debug: Show arrow endpoint (region centroid) */}
              <circle cx={label.lineEndX} cy={label.lineEndY} r={3} fill="red" opacity={0.8} />
            </svg>

            {/* Label box and text */}
            <div
              style={{
                position: 'absolute',
                left: `${label.labelX}px`,
                top: `${label.labelY}px`,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'all',
                cursor: 'pointer',
                zIndex: 20,
              }}
              onClick={() => onRegionClick(label.regionId, label.regionName)}
              onMouseEnter={() => setHoveredRegion(label.regionId)}
              onMouseLeave={() => setHoveredRegion(null)}
            >
              {/* Background box */}
              <div
                style={{
                  padding: '2px 5px',
                  backgroundColor: label.isFound
                    ? isDark
                      ? '#22c55e'
                      : '#86efac'
                    : isDark
                      ? '#1f2937'
                      : '#ffffff',
                  border: `1px solid ${label.isFound ? '#16a34a' : isDark ? '#60a5fa' : '#3b82f6'}`,
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: getLabelTextColor(isDark, label.isFound),
                  textShadow: label.isFound
                    ? getLabelTextShadow(isDark, true)
                    : '0 0 2px rgba(0,0,0,0.5)',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {label.regionName}
              </div>
            </div>
          </div>
        )
      })}

      {/* Debug: Bounding box labels as HTML overlays */}
      {showDebugBoundingBoxes &&
        containerRef.current &&
        svgRef.current &&
        debugBoundingBoxes.map((bbox) => {
          const importance = bbox.importance ?? 0
          let strokeColor = '#888888'

          if (bbox.wasAccepted) {
            strokeColor = '#00ff00'
          } else if (importance > 1.5) {
            strokeColor = '#ff6600'
          } else if (importance > 0.5) {
            strokeColor = '#ffcc00'
          }

          // Convert SVG coordinates to pixel coordinates (accounting for preserveAspectRatio)
          const containerRect = containerRef.current!.getBoundingClientRect()
          const svgRect = svgRef.current!.getBoundingClientRect()
          const viewBoxParts = displayViewBox.split(' ').map(Number)
          const viewBoxX = viewBoxParts[0] || 0
          const viewBoxY = viewBoxParts[1] || 0
          const viewBoxWidth = viewBoxParts[2] || 1000
          const viewBoxHeight = viewBoxParts[3] || 1000

          const viewport = getRenderedViewport(
            svgRect,
            viewBoxX,
            viewBoxY,
            viewBoxWidth,
            viewBoxHeight
          )
          const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
          const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY

          // Convert bbox center from SVG coords to pixels
          const centerX = (bbox.x + bbox.width / 2 - viewBoxX) * viewport.scale + svgOffsetX
          const centerY = (bbox.y + bbox.height / 2 - viewBoxY) * viewport.scale + svgOffsetY

          return (
            <div
              key={`bbox-label-${bbox.regionId}`}
              style={{
                position: 'absolute',
                left: `${centerX}px`,
                top: `${centerY}px`,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                zIndex: 15,
                fontSize: '10px',
                fontWeight: 'bold',
                color: strokeColor,
                textAlign: 'center',
                textShadow: '0 0 2px black, 0 0 2px black, 0 0 2px black',
                whiteSpace: 'nowrap',
              }}
            >
              <div>{bbox.regionId}</div>
              <div style={{ fontSize: '8px', fontWeight: 'normal' }}>{importance.toFixed(2)}</div>
            </div>
          )
        })}

      {/* Custom Cursor - Visible when pointer lock is active */}
      {(() => {
        // Debug logging removed - was flooding console
        return pointerLocked && cursorPosition ? (
          <>
            <div
              data-element="custom-cursor"
              style={{
                position: 'absolute',
                left: `${cursorPosition.x}px`,
                top: `${cursorPosition.y}px`,
                width: '20px',
                height: '20px',
                border: `2px solid ${isDark ? '#60a5fa' : '#3b82f6'}`,
                borderRadius: '50%',
                pointerEvents: 'none',
                zIndex: 200,
                transform: `translate(-50%, -50%) scale(${cursorSquish.x}, ${cursorSquish.y})`,
                backgroundColor: 'transparent',
                boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.3)',
                transition: 'transform 0.1s ease-out', // Smooth squish animation
              }}
            >
              {/* Crosshair - Vertical line */}
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '0',
                  width: '2px',
                  height: '100%',
                  backgroundColor: isDark ? '#60a5fa' : '#3b82f6',
                  transform: 'translateX(-50%)',
                }}
              />
              {/* Crosshair - Horizontal line */}
              <div
                style={{
                  position: 'absolute',
                  left: '0',
                  top: '50%',
                  width: '100%',
                  height: '2px',
                  backgroundColor: isDark ? '#60a5fa' : '#3b82f6',
                  transform: 'translateY(-50%)',
                }}
              />
            </div>
            {/* Cursor region name label - shows what to find under the cursor */}
            {currentRegionName && (
              <div
                data-element="cursor-region-label"
                style={{
                  position: 'absolute',
                  left: `${cursorPosition.x}px`,
                  top: `${cursorPosition.y + 18}px`,
                  transform: 'translateX(-50%)',
                  pointerEvents: 'none',
                  zIndex: 201,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  backgroundColor: isDark ? 'rgba(30, 58, 138, 0.95)' : 'rgba(219, 234, 254, 0.95)',
                  border: `2px solid ${isDark ? '#60a5fa' : '#3b82f6'}`,
                  borderRadius: '6px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 'bold',
                    color: isDark ? '#93c5fd' : '#1e40af',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Find
                </span>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 'bold',
                    color: isDark ? 'white' : '#1e3a8a',
                  }}
                >
                  {currentRegionName}
                </span>
                {currentFlagEmoji && <span style={{ fontSize: '14px' }}>{currentFlagEmoji}</span>}
              </div>
            )}
          </>
        ) : null
      })()}

      {/* Magnifier overlay - centers on cursor position */}
      {(() => {
        if (!cursorPosition || !svgRef.current || !containerRef.current) {
          return null
        }

        // Calculate magnifier size percentages based on container aspect ratio
        const containerRect = containerRef.current.getBoundingClientRect()
        const isLandscape = containerRect.width > containerRect.height
        const widthPercent = (isLandscape ? MAGNIFIER_SIZE_SMALL : MAGNIFIER_SIZE_LARGE) * 100
        const heightPercent = (isLandscape ? MAGNIFIER_SIZE_LARGE : MAGNIFIER_SIZE_SMALL) * 100

        return (
          <animated.div
            ref={magnifierRef}
            data-element="magnifier"
            onTouchStart={handleMagnifierTouchStart}
            onTouchMove={handleMagnifierTouchMove}
            onTouchEnd={handleMagnifierTouchEnd}
            onTouchCancel={handleMagnifierTouchEnd}
            style={{
              position: 'absolute',
              // Animated positioning - smoothly moves to opposite corner from cursor
              top: magnifierSpring.top,
              left: magnifierSpring.left,
              width: `${widthPercent}%`,
              height: `${heightPercent}%`,
              // High zoom (>60x) gets gold border, normal zoom gets blue border
              border: zoomSpring.to(
                (zoom: number) =>
                  zoom > HIGH_ZOOM_THRESHOLD
                    ? `4px solid ${isDark ? '#fbbf24' : '#f59e0b'}` // gold-400/gold-500
                    : `3px solid ${isDark ? '#60a5fa' : '#3b82f6'}` // blue-400/blue-600
              ),
              borderRadius: '12px',
              overflow: 'hidden',
              // Enable touch events on mobile for panning, but keep mouse events disabled
              // This allows touch-based panning while not interfering with mouse-based interactions
              pointerEvents: 'auto',
              touchAction: 'none', // Prevent browser handling of touch gestures
              zIndex: 100,
              boxShadow: zoomSpring.to((zoom: number) =>
                zoom > HIGH_ZOOM_THRESHOLD
                  ? '0 10px 40px rgba(251, 191, 36, 0.4), 0 0 20px rgba(251, 191, 36, 0.2)' // Gold glow
                  : '0 10px 40px rgba(0, 0, 0, 0.5)'
              ),
              background: isDark ? '#111827' : '#f3f4f6',
              opacity: magnifierSpring.opacity,
            }}
          >
            <animated.svg
              viewBox={zoomSpring.to((zoom: number) => {
                // Calculate magnified viewBox centered on cursor
                const containerRect = containerRef.current!.getBoundingClientRect()
                const svgRect = svgRef.current!.getBoundingClientRect()

                // Convert cursor position to SVG coordinates (accounting for preserveAspectRatio)
                const viewBoxParts = displayViewBox.split(' ').map(Number)
                const viewBoxX = viewBoxParts[0] || 0
                const viewBoxY = viewBoxParts[1] || 0
                const viewBoxWidth = viewBoxParts[2] || 1000
                const viewBoxHeight = viewBoxParts[3] || 1000

                const viewport = getRenderedViewport(
                  svgRect,
                  viewBoxX,
                  viewBoxY,
                  viewBoxWidth,
                  viewBoxHeight
                )

                // Center position relative to SVG (uses reveal center during give-up animation)
                const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
                const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY
                const cursorSvgX = (cursorPosition.x - svgOffsetX) / viewport.scale + viewBoxX
                const cursorSvgY = (cursorPosition.y - svgOffsetY) / viewport.scale + viewBoxY

                // Magnified view: adaptive zoom (using animated value)
                const magnifiedWidth = viewBoxWidth / zoom
                const magnifiedHeight = viewBoxHeight / zoom

                // Center the magnified viewBox on the cursor
                const magnifiedViewBoxX = cursorSvgX - magnifiedWidth / 2
                const magnifiedViewBoxY = cursorSvgY - magnifiedHeight / 2

                return `${magnifiedViewBoxX} ${magnifiedViewBoxY} ${magnifiedWidth} ${magnifiedHeight}`
              })}
              style={{
                width: '100%',
                height: '100%',
                filter: (() => {
                  // Apply "disabled" visual effect when at threshold but not in precision mode
                  if (pointerLocked) return 'none'

                  const containerRect = containerRef.current?.getBoundingClientRect()
                  const svgRect = svgRef.current?.getBoundingClientRect()
                  if (!containerRect || !svgRect) return 'none'

                  const { width: magnifierWidth } = getMagnifierDimensions(
                    containerRect.width,
                    containerRect.height
                  )
                  const viewBoxParts = displayViewBox.split(' ').map(Number)
                  const viewBoxWidth = viewBoxParts[2]
                  if (!viewBoxWidth || Number.isNaN(viewBoxWidth)) return 'none'

                  const currentZoom = getCurrentZoom()
                  const screenPixelRatio = calculateScreenPixelRatio({
                    magnifierWidth,
                    viewBoxWidth,
                    svgWidth: svgRect.width,
                    zoom: currentZoom,
                  })

                  // When at or above threshold (but not in precision mode), add disabled effect
                  if (isAboveThreshold(screenPixelRatio, PRECISION_MODE_THRESHOLD)) {
                    return 'brightness(0.6) saturate(0.5)'
                  }

                  return 'none'
                })(),
              }}
            >
              {/* Sea/ocean background for magnifier - solid color to match container */}
              {(() => {
                const viewBoxParts = displayViewBox.split(' ').map(Number)
                return (
                  <rect
                    x={viewBoxParts[0] || 0}
                    y={viewBoxParts[1] || 0}
                    width={viewBoxParts[2] || 1000}
                    height={viewBoxParts[3] || 1000}
                    fill={isDark ? '#1e3a5f' : '#a8d4f0'}
                  />
                )
              })()}

              {/* Render all regions in magnified view */}
              {mapData.regions.map((region) => {
                const isFound = regionsFound.includes(region.id)
                const playerId = isFound ? getPlayerWhoFoundRegion(region.id) : null
                const isBeingRevealed = giveUpReveal?.regionId === region.id

                // Bright gold flash for give up reveal in magnifier too
                const fill = isBeingRevealed
                  ? `rgba(255, 200, 0, ${0.6 + giveUpFlashProgress * 0.4})`
                  : isFound && playerId
                    ? `url(#player-pattern-${playerId})`
                    : getRegionColor(region.id, isFound, hoveredRegion === region.id, isDark)

                // During give-up animation, dim all non-revealed regions
                const dimmedOpacity = isGiveUpAnimating && !isBeingRevealed ? 0.25 : 1

                // Revealed region gets a prominent stroke
                // Unfound regions get thicker borders for better visibility against sea
                const stroke = isBeingRevealed
                  ? `rgba(255, 140, 0, ${0.8 + giveUpFlashProgress * 0.2})`
                  : getRegionStroke(isFound, isDark)
                const strokeWidth = isBeingRevealed ? 2 : isFound ? 0.5 : 1

                return (
                  <g key={`mag-${region.id}`} style={{ opacity: dimmedOpacity }}>
                    {/* Glow effect for revealed region in magnifier */}
                    {isBeingRevealed && (
                      <path
                        d={region.path}
                        fill="none"
                        stroke={`rgba(255, 215, 0, ${0.3 + giveUpFlashProgress * 0.5})`}
                        strokeWidth={5}
                        vectorEffect="non-scaling-stroke"
                        style={{ filter: 'blur(2px)' }}
                      />
                    )}
                    <path
                      d={region.path}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      vectorEffect="non-scaling-stroke"
                      opacity={showOutline(region) ? 1 : 0.3}
                    />
                  </g>
                )
              })}

              {/* Crosshair at center position (cursor or reveal center during animation) */}
              <g>
                {(() => {
                  const containerRect = containerRef.current!.getBoundingClientRect()
                  const svgRect = svgRef.current!.getBoundingClientRect()
                  const viewBoxParts = displayViewBox.split(' ').map(Number)
                  const viewBoxX = viewBoxParts[0] || 0
                  const viewBoxY = viewBoxParts[1] || 0
                  const viewBoxWidth = viewBoxParts[2] || 1000
                  const viewBoxHeight = viewBoxParts[3] || 1000
                  // Account for preserveAspectRatio letterboxing
                  const viewport = getRenderedViewport(
                    svgRect,
                    viewBoxX,
                    viewBoxY,
                    viewBoxWidth,
                    viewBoxHeight
                  )
                  const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
                  const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY
                  const cursorSvgX = (cursorPosition.x - svgOffsetX) / viewport.scale + viewBoxX
                  const cursorSvgY = (cursorPosition.y - svgOffsetY) / viewport.scale + viewBoxY

                  return (
                    <>
                      <circle
                        cx={cursorSvgX}
                        cy={cursorSvgY}
                        r={viewBoxWidth / 100}
                        fill="none"
                        stroke={isDark ? '#60a5fa' : '#3b82f6'}
                        strokeWidth={viewBoxWidth / 500}
                        vectorEffect="non-scaling-stroke"
                      />
                      <line
                        x1={cursorSvgX - viewBoxWidth / 50}
                        y1={cursorSvgY}
                        x2={cursorSvgX + viewBoxWidth / 50}
                        y2={cursorSvgY}
                        stroke={isDark ? '#60a5fa' : '#3b82f6'}
                        strokeWidth={viewBoxWidth / 1000}
                        vectorEffect="non-scaling-stroke"
                      />
                      <line
                        x1={cursorSvgX}
                        y1={cursorSvgY - viewBoxHeight / 50}
                        x2={cursorSvgX}
                        y2={cursorSvgY + viewBoxHeight / 50}
                        stroke={isDark ? '#60a5fa' : '#3b82f6'}
                        strokeWidth={viewBoxWidth / 1000}
                        vectorEffect="non-scaling-stroke"
                      />
                    </>
                  )
                })()}
              </g>

              {/* Pixel grid overlay - shows when approaching/at/above precision mode threshold */}
              {(() => {
                const containerRect = containerRef.current?.getBoundingClientRect()
                const svgRect = svgRef.current?.getBoundingClientRect()
                if (!containerRect || !svgRect) return null

                const { width: magnifierWidth } = getMagnifierDimensions(
                  containerRect.width,
                  containerRect.height
                )
                const viewBoxParts = displayViewBox.split(' ').map(Number)
                const viewBoxWidth = viewBoxParts[2]
                const viewBoxHeight = viewBoxParts[3]
                const viewBoxX = viewBoxParts[0] || 0
                const viewBoxY = viewBoxParts[1] || 0

                if (!viewBoxWidth || Number.isNaN(viewBoxWidth)) return null

                const currentZoom = getCurrentZoom()
                const screenPixelRatio = calculateScreenPixelRatio({
                  magnifierWidth,
                  viewBoxWidth,
                  svgWidth: svgRect.width,
                  zoom: currentZoom,
                })

                // Fade grid in/out within 30% range on both sides of threshold
                // Visible from 70% to 130% of threshold (14 to 26 px/px at threshold=20)
                const fadeStartRatio = PRECISION_MODE_THRESHOLD * 0.7
                const fadeEndRatio = PRECISION_MODE_THRESHOLD * 1.3

                if (screenPixelRatio < fadeStartRatio || screenPixelRatio > fadeEndRatio)
                  return null

                // Calculate opacity: 0 at edges (70% and 130%), 1 at threshold (100%)
                let gridOpacity: number
                if (screenPixelRatio <= PRECISION_MODE_THRESHOLD) {
                  // Fading in: 0 at 70%, 1 at 100%
                  gridOpacity =
                    (screenPixelRatio - fadeStartRatio) /
                    (PRECISION_MODE_THRESHOLD - fadeStartRatio)
                } else {
                  // Fading out: 1 at 100%, 0 at 130%
                  gridOpacity =
                    (fadeEndRatio - screenPixelRatio) / (fadeEndRatio - PRECISION_MODE_THRESHOLD)
                }

                // Account for preserveAspectRatio letterboxing
                const viewport = getRenderedViewport(
                  svgRect,
                  viewBoxX,
                  viewBoxY,
                  viewBoxWidth,
                  viewBoxHeight
                )

                // Calculate grid spacing in SVG units
                // Each grid cell represents one screen pixel of mouse movement on the main map
                const mainMapSvgUnitsPerScreenPixel = 1 / viewport.scale
                const gridSpacingSvgUnits = mainMapSvgUnitsPerScreenPixel

                // Calculate magnified viewport dimensions for grid bounds
                const magnifiedViewBoxWidth = viewBoxWidth / currentZoom

                // Get center position in SVG coordinates (uses reveal center during give-up animation)
                const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
                const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY
                const cursorSvgX = (cursorPosition.x - svgOffsetX) / viewport.scale + viewBoxX
                const cursorSvgY = (cursorPosition.y - svgOffsetY) / viewport.scale + viewBoxY

                // Calculate grid bounds (magnifier viewport)
                const magnifiedHeight = viewBoxHeight / currentZoom
                const gridLeft = cursorSvgX - magnifiedViewBoxWidth / 2
                const gridRight = cursorSvgX + magnifiedViewBoxWidth / 2
                const gridTop = cursorSvgY - magnifiedHeight / 2
                const gridBottom = cursorSvgY + magnifiedHeight / 2

                // Calculate grid line positions aligned with cursor (crosshair center)
                const lines: Array<{ type: 'h' | 'v'; pos: number }> = []

                // Vertical lines (aligned with cursor X)
                const firstVerticalLine =
                  Math.floor((gridLeft - cursorSvgX) / gridSpacingSvgUnits) * gridSpacingSvgUnits +
                  cursorSvgX
                for (let x = firstVerticalLine; x <= gridRight; x += gridSpacingSvgUnits) {
                  lines.push({ type: 'v', pos: x })
                }

                // Horizontal lines (aligned with cursor Y)
                const firstHorizontalLine =
                  Math.floor((gridTop - cursorSvgY) / gridSpacingSvgUnits) * gridSpacingSvgUnits +
                  cursorSvgY
                for (let y = firstHorizontalLine; y <= gridBottom; y += gridSpacingSvgUnits) {
                  lines.push({ type: 'h', pos: y })
                }

                // Apply opacity to grid color
                const baseOpacity = isDark ? 0.5 : 0.6
                const finalOpacity = baseOpacity * gridOpacity
                const gridColor = `rgba(251, 191, 36, ${finalOpacity})`

                return (
                  <g data-element="pixel-grid-overlay">
                    {lines.map((line, i) =>
                      line.type === 'v' ? (
                        <line
                          key={`vgrid-${i}`}
                          x1={line.pos}
                          y1={gridTop}
                          x2={line.pos}
                          y2={gridBottom}
                          stroke={gridColor}
                          strokeWidth={viewBoxWidth / 2000}
                          vectorEffect="non-scaling-stroke"
                        />
                      ) : (
                        <line
                          key={`hgrid-${i}`}
                          x1={gridLeft}
                          y1={line.pos}
                          x2={gridRight}
                          y2={line.pos}
                          stroke={gridColor}
                          strokeWidth={viewBoxWidth / 2000}
                          vectorEffect="non-scaling-stroke"
                        />
                      )
                    )}
                  </g>
                )
              })()}

              {/* Debug: Bounding boxes for detected regions in magnifier */}
              {SHOW_DEBUG_BOUNDING_BOXES &&
                debugBoundingBoxes.map((bbox) => {
                  const importance = bbox.importance ?? 0

                  // Color-code by importance
                  let strokeColor = '#888888' // Gray for low importance
                  if (bbox.wasAccepted) {
                    strokeColor = '#00ff00' // Green for accepted region
                  } else if (importance > 1.5) {
                    strokeColor = '#ff6600' // Orange for high importance
                  } else if (importance > 0.5) {
                    strokeColor = '#ffcc00' // Yellow for medium importance
                  }

                  return (
                    <rect
                      key={`mag-bbox-${bbox.regionId}`}
                      x={bbox.x}
                      y={bbox.y}
                      width={bbox.width}
                      height={bbox.height}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                  )
                })}
            </animated.svg>

            {/* Debug: Bounding box labels as HTML overlays - positioned using animated values */}
            {SHOW_DEBUG_BOUNDING_BOXES &&
              debugBoundingBoxes.map((bbox) => {
                const importance = bbox.importance ?? 0
                let strokeColor = '#888888'

                if (bbox.wasAccepted) {
                  strokeColor = '#00ff00'
                } else if (importance > 1.5) {
                  strokeColor = '#ff6600'
                } else if (importance > 0.5) {
                  strokeColor = '#ffcc00'
                }

                // Parse viewBox - these are stable values from mapData
                const viewBoxParts = displayViewBox.split(' ').map(Number)
                const viewBoxX = viewBoxParts[0] || 0
                const viewBoxY = viewBoxParts[1] || 0
                const viewBoxWidth = viewBoxParts[2] || 1000
                const viewBoxHeight = viewBoxParts[3] || 1000

                // Calculate bbox center in SVG coordinates
                const bboxCenterSvgX = bbox.x + bbox.width / 2
                const bboxCenterSvgY = bbox.y + bbox.height / 2

                // Use animated interpolation to sync with magnifier viewBox
                // ALL measurements must be taken inside the callback to stay in sync
                return (
                  <animated.div
                    key={`mag-bbox-label-${bbox.regionId}`}
                    style={{
                      position: 'absolute',
                      // Calculate position using the same spring that controls the magnifier viewBox
                      left: zoomSpring.to((zoom: number) => {
                        const containerRect = containerRef.current?.getBoundingClientRect()
                        const svgRect = svgRef.current?.getBoundingClientRect()
                        if (!containerRect || !svgRect || !cursorPosition) return '-9999px'

                        // Magnifier dimensions
                        const { width: magnifierWidth } = getMagnifierDimensions(
                          containerRect.width,
                          containerRect.height
                        )

                        // Convert cursor to SVG coordinates (accounting for preserveAspectRatio)
                        const viewport = getRenderedViewport(
                          svgRect,
                          viewBoxX,
                          viewBoxY,
                          viewBoxWidth,
                          viewBoxHeight
                        )
                        const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
                        const cursorSvgX =
                          (cursorPosition.x - svgOffsetX) / viewport.scale + viewBoxX

                        // Magnified viewport in SVG coordinates
                        const magnifiedWidth = viewBoxWidth / zoom
                        const magnifiedViewBoxX = cursorSvgX - magnifiedWidth / 2

                        // Position of bbox center relative to magnified viewport (0-1)
                        const relativeX = (bboxCenterSvgX - magnifiedViewBoxX) / magnifiedWidth
                        if (relativeX < 0 || relativeX > 1) return '-9999px'

                        return `${relativeX * magnifierWidth}px`
                      }),
                      top: zoomSpring.to((zoom: number) => {
                        const containerRect = containerRef.current?.getBoundingClientRect()
                        const svgRect = svgRef.current?.getBoundingClientRect()
                        if (!containerRect || !svgRect || !cursorPosition) return '-9999px'

                        // Magnifier dimensions (responsive to aspect ratio)
                        const { width: magnifierWidth, height: magnifierHeight } =
                          getMagnifierDimensions(containerRect.width, containerRect.height)

                        // Convert cursor to SVG coordinates (accounting for preserveAspectRatio)
                        const viewport = getRenderedViewport(
                          svgRect,
                          viewBoxX,
                          viewBoxY,
                          viewBoxWidth,
                          viewBoxHeight
                        )
                        const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY
                        const cursorSvgY =
                          (cursorPosition.y - svgOffsetY) / viewport.scale + viewBoxY

                        // Magnified viewport in SVG coordinates
                        const magnifiedHeight = viewBoxHeight / zoom
                        const magnifiedViewBoxY = cursorSvgY - magnifiedHeight / 2

                        // Position of bbox center relative to magnified viewport (0-1)
                        const relativeY = (bboxCenterSvgY - magnifiedViewBoxY) / magnifiedHeight
                        if (relativeY < 0 || relativeY > 1) return '-9999px'

                        return `${relativeY * magnifierHeight}px`
                      }),
                      transform: 'translate(-50%, -50%)',
                      pointerEvents: 'none',
                      zIndex: 15,
                      fontSize: '10px',
                      fontWeight: 'bold',
                      color: strokeColor,
                      textAlign: 'center',
                      textShadow: '0 0 2px black, 0 0 2px black, 0 0 2px black',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <div>{bbox.regionId}</div>
                    <div style={{ fontSize: '8px', fontWeight: 'normal' }}>
                      {importance.toFixed(2)}
                    </div>
                  </animated.div>
                )
              })}

            {/* Magnifier label */}
            <animated.div
              style={{
                position: 'absolute',
                top: '8px',
                left: '8px',
                padding: '4px 8px',
                background: isDark ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 'bold',
                color: isDark ? '#60a5fa' : '#3b82f6',
                pointerEvents: pointerLocked ? 'none' : 'auto',
                cursor: pointerLocked ? 'default' : 'pointer',
              }}
              onClick={(e) => {
                // Request pointer lock when user clicks on notice
                if (!pointerLocked && containerRef.current) {
                  e.stopPropagation() // Prevent click from bubbling to map
                  containerRef.current.requestPointerLock()
                }
              }}
              data-element="magnifier-label"
            >
              {zoomSpring.to((z: number) => {
                const multiplier = magnifierSpring.movementMultiplier.get()

                // When in pointer lock mode, show "Precision mode active" notice
                if (pointerLocked) {
                  return 'Precision mode active'
                }

                // When NOT in pointer lock, calculate screen pixel ratio
                const containerRect = containerRef.current?.getBoundingClientRect()
                const svgRect = svgRef.current?.getBoundingClientRect()
                if (!containerRect || !svgRect) {
                  return `${z.toFixed(1)}×`
                }

                const { width: magnifierWidth } = getMagnifierDimensions(
                  containerRect.width,
                  containerRect.height
                )
                const viewBoxParts = displayViewBox.split(' ').map(Number)
                const viewBoxWidth = viewBoxParts[2]

                if (!viewBoxWidth || Number.isNaN(viewBoxWidth)) {
                  return `${z.toFixed(1)}×`
                }

                const screenPixelRatio = calculateScreenPixelRatio({
                  magnifierWidth,
                  viewBoxWidth,
                  svgWidth: svgRect.width,
                  zoom: z,
                })

                // If at or above threshold, show notice about activating precision controls
                if (isAboveThreshold(screenPixelRatio, PRECISION_MODE_THRESHOLD)) {
                  return 'Click to activate precision mode'
                }

                // Below threshold - show debug info in dev, simple zoom in prod
                if (SHOW_MAGNIFIER_DEBUG_INFO) {
                  return `${z.toFixed(1)}× | ${screenPixelRatio.toFixed(1)} px/px`
                }

                return `${z.toFixed(1)}×`
              })}
            </animated.div>

            {/* Scrim overlay - shows when at threshold to indicate barrier */}
            {!pointerLocked &&
              (() => {
                const containerRect = containerRef.current?.getBoundingClientRect()
                const svgRect = svgRef.current?.getBoundingClientRect()
                if (!containerRect || !svgRect) return null

                const { width: magnifierWidth } = getMagnifierDimensions(
                  containerRect.width,
                  containerRect.height
                )
                const viewBoxParts = displayViewBox.split(' ').map(Number)
                const viewBoxWidth = viewBoxParts[2]
                if (!viewBoxWidth || Number.isNaN(viewBoxWidth)) return null

                const currentZoom = getCurrentZoom()
                const screenPixelRatio = calculateScreenPixelRatio({
                  magnifierWidth,
                  viewBoxWidth,
                  svgWidth: svgRect.width,
                  zoom: currentZoom,
                })

                // Only show scrim when at or above threshold
                if (!isAboveThreshold(screenPixelRatio, PRECISION_MODE_THRESHOLD)) return null

                return (
                  <div
                    data-element="precision-mode-scrim"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(251, 191, 36, 0.15)', // Gold scrim
                      pointerEvents: 'none',
                      borderRadius: '12px',
                    }}
                  />
                )
              })()}
          </animated.div>
        )
      })()}

      {/* Zoom lines connecting indicator to magnifier - creates "pop out" effect */}
      {(() => {
        if (!showMagnifier || !cursorPosition || !svgRef.current || !containerRef.current) {
          return null
        }

        const containerRect = containerRef.current.getBoundingClientRect()
        const svgRect = svgRef.current.getBoundingClientRect()

        // Get magnifier dimensions (responsive to aspect ratio)
        const { width: magnifierWidth, height: magnifierHeight } = getMagnifierDimensions(
          containerRect.width,
          containerRect.height
        )

        // Magnifier position (animated via spring, but we use target for calculation)
        const magTop = targetTop
        const magLeft = targetLeft

        // Calculate indicator box position in screen coordinates
        const viewBoxParts = displayViewBox.split(' ').map(Number)
        const viewBoxX = viewBoxParts[0] || 0
        const viewBoxY = viewBoxParts[1] || 0
        const viewBoxWidth = viewBoxParts[2] || 1000
        const viewBoxHeight = viewBoxParts[3] || 1000

        const currentZoom = getCurrentZoom()
        const indicatorWidth = viewBoxWidth / currentZoom
        const indicatorHeight = viewBoxHeight / currentZoom

        // Convert cursor to SVG coordinates (accounting for preserveAspectRatio)
        const viewport = getRenderedViewport(
          svgRect,
          viewBoxX,
          viewBoxY,
          viewBoxWidth,
          viewBoxHeight
        )
        const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
        const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY

        const cursorSvgX = (cursorPosition.x - svgOffsetX) / viewport.scale + viewBoxX
        const cursorSvgY = (cursorPosition.y - svgOffsetY) / viewport.scale + viewBoxY

        // Indicator box in SVG coordinates
        const indSvgLeft = cursorSvgX - indicatorWidth / 2
        const indSvgTop = cursorSvgY - indicatorHeight / 2
        const indSvgRight = indSvgLeft + indicatorWidth
        const indSvgBottom = indSvgTop + indicatorHeight

        // Convert indicator corners to screen coordinates
        const svgToScreen = (svgX: number, svgY: number) => ({
          x: (svgX - viewBoxX) * viewport.scale + svgOffsetX,
          y: (svgY - viewBoxY) * viewport.scale + svgOffsetY,
        })

        const indTL = svgToScreen(indSvgLeft, indSvgTop)
        const indTR = svgToScreen(indSvgRight, indSvgTop)
        const indBL = svgToScreen(indSvgLeft, indSvgBottom)
        const indBR = svgToScreen(indSvgRight, indSvgBottom)

        // Magnifier corners in screen coordinates
        const magTL = { x: magLeft, y: magTop }
        const magTR = { x: magLeft + magnifierWidth, y: magTop }
        const magBL = { x: magLeft, y: magTop + magnifierHeight }
        const magBR = {
          x: magLeft + magnifierWidth,
          y: magTop + magnifierHeight,
        }

        // Check if a line segment passes through a rectangle (excluding endpoints)
        const linePassesThroughRect = (
          from: { x: number; y: number },
          to: { x: number; y: number },
          rectLeft: number,
          rectTop: number,
          rectRight: number,
          rectBottom: number
        ) => {
          // Sample points along the line (excluding endpoints)
          for (let t = 0.1; t <= 0.9; t += 0.1) {
            const px = from.x + (to.x - from.x) * t
            const py = from.y + (to.y - from.y) * t
            if (px > rectLeft && px < rectRight && py > rectTop && py < rectBottom) {
              return true
            }
          }
          return false
        }

        // Create bezier paths with elegant curves
        const createBezierPath = (from: { x: number; y: number }, to: { x: number; y: number }) => {
          const dx = to.x - from.x
          const dy = to.y - from.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          // Perpendicular offset creates gentle outward bow
          const bowAmount = dist * 0.06
          const perpX = (-dy / dist) * bowAmount
          const perpY = (dx / dist) * bowAmount

          const midX = (from.x + to.x) / 2 + perpX
          const midY = (from.y + to.y) / 2 + perpY

          // Quadratic bezier for smooth curve
          return `M ${from.x} ${from.y} Q ${midX} ${midY}, ${to.x} ${to.y}`
        }

        // Define the corner pairs with identifiers
        const cornerPairs = [
          { from: indTL, to: magTL, corner: indTL },
          { from: indTR, to: magTR, corner: indTR },
          { from: indBL, to: magBL, corner: indBL },
          { from: indBR, to: magBR, corner: indBR },
        ]

        // Filter out lines that pass through either rectangle
        const visibleCornerPairs = cornerPairs.filter(({ from, to }) => {
          // Check if line passes through magnifier
          const passesThroughMag = linePassesThroughRect(
            from,
            to,
            magLeft,
            magTop,
            magLeft + magnifierWidth,
            magTop + magnifierHeight
          )
          // Check if line passes through indicator
          const passesThroughInd = linePassesThroughRect(
            from,
            to,
            indTL.x,
            indTL.y,
            indBR.x,
            indBR.y
          )
          return !passesThroughMag && !passesThroughInd
        })

        const paths = visibleCornerPairs.map(({ from, to }) => createBezierPath(from, to))
        const visibleCorners = visibleCornerPairs.map(({ corner }) => corner)

        // Color based on zoom level (matches magnifier border)
        const isHighZoom = currentZoom > HIGH_ZOOM_THRESHOLD
        const lineColor = isHighZoom
          ? isDark
            ? '#fbbf24'
            : '#f59e0b' // gold
          : isDark
            ? '#60a5fa'
            : '#3b82f6' // blue
        const glowColor = isHighZoom ? 'rgba(251, 191, 36, 0.6)' : 'rgba(96, 165, 250, 0.6)'

        return (
          <svg
            data-element="zoom-lines"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 99, // Just below magnifier (100)
              overflow: 'visible',
            }}
          >
            <defs>
              {/* Gradient for lines - fades toward magnifier */}
              <linearGradient id="zoom-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={lineColor} stopOpacity="0.8" />
                <stop offset="40%" stopColor={lineColor} stopOpacity="0.5" />
                <stop offset="100%" stopColor={lineColor} stopOpacity="0.2" />
              </linearGradient>

              {/* Glow filter for premium effect */}
              <filter id="zoom-line-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Animated dash pattern */}
              <pattern id="dash-pattern" patternUnits="userSpaceOnUse" width="12" height="1">
                <rect width="8" height="1" fill={lineColor} opacity="0.6" />
              </pattern>
            </defs>

            {/* Glow layer (underneath) */}
            <g filter="url(#zoom-line-glow)" opacity={0.4}>
              {paths.map((d, i) => (
                <path
                  key={`glow-${i}`}
                  d={d}
                  fill="none"
                  stroke={glowColor}
                  strokeWidth="6"
                  strokeLinecap="round"
                />
              ))}
            </g>

            {/* Main lines with gradient */}
            <g opacity={targetOpacity}>
              {paths.map((d, i) => (
                <path
                  key={`line-${i}`}
                  d={d}
                  fill="none"
                  stroke="url(#zoom-line-gradient)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{
                    // Subtle animation for the lines
                    strokeDasharray: '8 4',
                    strokeDashoffset: '0',
                    animation: 'zoom-line-flow 1s linear infinite',
                  }}
                />
              ))}
            </g>

            {/* Corner dots on indicator for visible lines only */}
            <g opacity={targetOpacity * 0.8}>
              {visibleCorners.map((corner, i) => (
                <circle
                  key={`corner-${i}`}
                  cx={corner.x}
                  cy={corner.y}
                  r="3"
                  fill={lineColor}
                  opacity="0.7"
                />
              ))}
            </g>

            <style>
              {`
                @keyframes zoom-line-flow {
                  from { stroke-dashoffset: 12; }
                  to { stroke-dashoffset: 0; }
                }
              `}
            </style>
          </svg>
        )
      })()}

      {/* Debug: Auto zoom detection visualization (dev only) */}
      {SHOW_MAGNIFIER_DEBUG_INFO && cursorPosition && containerRef.current && (
        <>
          {/* Detection box - 50px box around cursor */}
          <div
            style={{
              position: 'absolute',
              left: `${cursorPosition.x - 25}px`,
              top: `${cursorPosition.y - 25}px`,
              width: '50px',
              height: '50px',
              border: '2px dashed yellow',
              pointerEvents: 'none',
              zIndex: 150,
            }}
          />

          {/* Detection info overlay - opposite side from magnifier */}
          {(() => {
            const { detectedRegions, hasSmallRegion, detectedSmallestSize } = detectRegions(
              cursorPosition.x,
              cursorPosition.y
            )

            // Position on opposite side from magnifier
            const containerWidth = containerRef.current?.getBoundingClientRect().width ?? 0
            const magnifierOnLeft = targetLeft < containerWidth / 2

            return (
              <div
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: magnifierOnLeft ? undefined : '10px',
                  right: magnifierOnLeft ? '10px' : undefined,
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  color: 'white',
                  padding: '10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  pointerEvents: 'none',
                  zIndex: 150,
                  maxWidth: '300px',
                }}
              >
                <div>
                  <strong>Detection Box (50px)</strong>
                </div>
                <div>Regions detected: {detectedRegions.length}</div>
                <div>Has small region: {hasSmallRegion ? 'YES' : 'NO'}</div>
                <div>
                  Smallest size:{' '}
                  {detectedSmallestSize === Infinity ? '∞' : `${detectedSmallestSize.toFixed(1)}px`}
                </div>
                {/* Zoom Decision Details */}
                {zoomSearchDebugInfo && (
                  <>
                    <div
                      style={{
                        marginTop: '8px',
                        paddingTop: '8px',
                        borderTop: '1px solid #444',
                      }}
                    >
                      <strong>Zoom Decision:</strong>
                    </div>
                    <div style={{ fontSize: '10px', marginLeft: '8px' }}>
                      Final zoom: <strong>{zoomSearchDebugInfo.zoom.toFixed(1)}×</strong>
                      {!zoomSearchDebugInfo.foundGoodZoom && ' (fallback to min)'}
                    </div>
                    <div style={{ fontSize: '10px', marginLeft: '8px' }}>
                      Accepted: <strong>{zoomSearchDebugInfo.acceptedRegionId || 'none'}</strong>
                    </div>
                    <div style={{ fontSize: '10px', marginLeft: '8px' }}>
                      Thresholds: {(zoomSearchDebugInfo.acceptanceThresholds.min * 100).toFixed(0)}%
                      - {(zoomSearchDebugInfo.acceptanceThresholds.max * 100).toFixed(0)}% of
                      magnifier
                    </div>

                    <div style={{ marginTop: '8px' }}>
                      <strong>Region Analysis (top 3):</strong>
                    </div>
                    {Array.from(
                      new Map(
                        zoomSearchDebugInfo.regionDecisions.map((d) => [d.regionId, d])
                      ).values()
                    )
                      .sort((a, b) => b.importance - a.importance)
                      .slice(0, 3)
                      .map((decision) => {
                        const marker = decision.wasAccepted ? '✓' : '✗'
                        const color = decision.wasAccepted ? '#0f0' : '#888'
                        return (
                          <div
                            key={`decision-${decision.regionId}`}
                            style={{
                              fontSize: '9px',
                              marginLeft: '8px',
                              color,
                            }}
                          >
                            {marker} {decision.regionId}: {decision.currentSize.width.toFixed(0)}×
                            {decision.currentSize.height.toFixed(0)}px
                            {decision.rejectionReason && ` (${decision.rejectionReason})`}
                          </div>
                        )
                      })}
                  </>
                )}

                <div
                  style={{
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #444',
                  }}
                >
                  <strong>Detected Regions ({detectedRegions.length}):</strong>
                </div>
                {detectedRegions.map((region) => (
                  <div key={region.id} style={{ fontSize: '10px', marginLeft: '8px' }}>
                    • {region.id}: {region.pixelWidth.toFixed(1)}×{region.pixelHeight.toFixed(1)}px
                    {region.isVerySmall ? ' (SMALL)' : ''}
                  </div>
                ))}
                <div style={{ marginTop: '8px' }}>
                  <strong>Current Zoom:</strong> {getCurrentZoom().toFixed(1)}×
                </div>
                <div>
                  <strong>Target Zoom:</strong> {targetZoom.toFixed(1)}×
                </div>
              </div>
            )
          })()}
        </>
      )}

      {/* Other players' cursors - show in multiplayer when not exclusively our turn */}
      {svgRef.current &&
        containerRef.current &&
        Object.entries(otherPlayerCursors).map(([playerId, position]) => {
          // Skip our own cursor and null positions
          if (playerId === localPlayerId || !position) return null

          // In turn-based mode, only show other cursors when it's not our turn
          if (gameMode === 'turn-based' && currentPlayer === localPlayerId) return null

          // Get player metadata for emoji and color
          const player = playerMetadata[playerId]
          if (!player) return null

          // In collaborative mode, find all players from the same session and show all their emojis
          // Use memberPlayers (from roomData) which is the canonical source of player ownership
          const cursorUserId = position.userId
          const sessionPlayers =
            gameMode === 'cooperative' && cursorUserId && memberPlayers[cursorUserId]
              ? memberPlayers[cursorUserId]
              : [player]

          // Convert SVG coordinates to screen coordinates (accounting for preserveAspectRatio letterboxing)
          const svgRect = svgRef.current!.getBoundingClientRect()
          const containerRect = containerRef.current!.getBoundingClientRect()
          const viewBoxParts = displayViewBox.split(' ').map(Number)
          const viewBoxX = viewBoxParts[0] || 0
          const viewBoxY = viewBoxParts[1] || 0
          const viewBoxW = viewBoxParts[2] || 1000
          const viewBoxH = viewBoxParts[3] || 500
          const viewport = getRenderedViewport(svgRect, viewBoxX, viewBoxY, viewBoxW, viewBoxH)
          const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
          const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY
          const screenX = (position.x - viewBoxX) * viewport.scale + svgOffsetX
          const screenY = (position.y - viewBoxY) * viewport.scale + svgOffsetY

          // Check if cursor is within rendered viewport bounds
          if (
            screenX < svgOffsetX ||
            screenX > svgOffsetX + viewport.renderedWidth ||
            screenY < svgOffsetY ||
            screenY > svgOffsetY + viewport.renderedHeight
          ) {
            return null
          }

          return (
            <div
              key={`cursor-${playerId}`}
              data-element="other-player-cursor"
              data-player-id={playerId}
              style={{
                position: 'absolute',
                left: screenX,
                top: screenY,
                pointerEvents: 'none',
                zIndex: 100,
              }}
            >
              {/* Crosshair - centered on the cursor position */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                style={{
                  position: 'absolute',
                  left: -12, // Half of width to center
                  top: -12, // Half of height to center
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
                }}
              >
                {/* Outer ring */}
                <circle
                  cx="12"
                  cy="12"
                  r="8"
                  fill="none"
                  stroke={player.color}
                  strokeWidth="2"
                  opacity="0.8"
                />
                {/* Cross lines */}
                <line
                  x1="12"
                  y1="2"
                  x2="12"
                  y2="8"
                  stroke={player.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <line
                  x1="12"
                  y1="16"
                  x2="12"
                  y2="22"
                  stroke={player.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <line
                  x1="2"
                  y1="12"
                  x2="8"
                  y2="12"
                  stroke={player.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <line
                  x1="16"
                  y1="12"
                  x2="22"
                  y2="12"
                  stroke={player.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                {/* Center dot */}
                <circle cx="12" cy="12" r="2" fill={player.color} />
              </svg>
              {/* Player emoji label(s) - positioned below crosshair */}
              {/* In collaborative mode, show all emojis from the same session */}
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 14, // Below the crosshair (12px half-height + 2px gap)
                  transform: 'translateX(-50%)',
                  fontSize: '16px',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  whiteSpace: 'nowrap',
                }}
              >
                {sessionPlayers.map((p) => p.emoji).join('')}
              </div>
            </div>
          )
        })}

      {/* Give Up button overlay - positioned within SVG bounds for pointer lock accessibility */}
      {(() => {
        // Use svgDimensions to trigger re-render on resize, but get actual rect for positioning
        if (!svgRef.current || !containerRef.current || svgDimensions.width === 0) return null

        // During give-up animation, use saved position to prevent jumping due to SVG scale transform
        let buttonTop: number
        let buttonRight: number

        if (isGiveUpAnimating && savedButtonPosition) {
          // Use saved position during animation
          buttonTop = savedButtonPosition.top
          buttonRight = savedButtonPosition.right
        } else {
          // Calculate position normally
          const svgRect = svgRef.current.getBoundingClientRect()
          const containerRect = containerRef.current.getBoundingClientRect()
          // Position relative to SVG, not container (cursor is clamped to SVG bounds during pointer lock)
          const svgOffsetX = svgRect.left - containerRect.left
          const svgOffsetY = svgRect.top - containerRect.top
          // Position in top-right corner of SVG with some padding
          buttonTop = svgOffsetY + 8
          buttonRight = containerRect.width - (svgOffsetX + svgRect.width) + 8
        }

        return (
          <button
            ref={giveUpButton.refCallback}
            onClick={(e) => {
              e.stopPropagation() // Don't trigger map click
              if (!isGiveUpAnimating) {
                onGiveUp()
              }
            }}
            disabled={isGiveUpAnimating}
            data-action="give-up-overlay"
            title="Press 'G' to give up"
            style={{
              position: 'absolute',
              top: `${buttonTop}px`,
              right: `${buttonRight}px`,
              // Apply hover styles when fake cursor is over button (pointer lock mode)
              ...(giveUpButton.isHovered
                ? {
                    backgroundColor: isDark ? '#a16207' : '#fef08a', // yellow.700 / yellow.200
                    transform: 'scale(1.05)',
                  }
                : {}),
              // Apply disabled styles
              ...(isGiveUpAnimating
                ? {
                    opacity: 0.5,
                    cursor: 'not-allowed',
                    transform: 'none',
                  }
                : {}),
            }}
            className={css({
              padding: '2 3',
              fontSize: 'sm',
              cursor: 'pointer',
              bg: isDark ? 'yellow.800' : 'yellow.100',
              color: isDark ? 'yellow.200' : 'yellow.800',
              rounded: 'md',
              border: '2px solid',
              borderColor: isDark ? 'yellow.600' : 'yellow.400',
              fontWeight: 'bold',
              transition: 'all 0.2s',
              zIndex: 50,
              boxShadow: 'md',
              _hover: {
                bg: isDark ? 'yellow.700' : 'yellow.200',
                transform: 'scale(1.05)',
              },
              _disabled: {
                opacity: 0.5,
                cursor: 'not-allowed',
                transform: 'none',
              },
            })}
          >
            {(() => {
              // Determine button text based on game mode and voting state
              // Voting is per-session (userId), not per-player
              const isCooperativeMultiplayer =
                gameMode === 'cooperative' && activeUserIds.length > 1
              const hasLocalSessionVoted = viewerId && giveUpVotes.includes(viewerId)
              const voteCount = giveUpVotes.length
              const totalSessions = activeUserIds.length

              if (isCooperativeMultiplayer) {
                if (hasLocalSessionVoted) {
                  return (
                    <span>
                      ✓ Voted ({voteCount}/{totalSessions})
                    </span>
                  )
                }
                if (voteCount > 0) {
                  return (
                    <span>
                      Give Up ({voteCount}/{totalSessions}) (G)
                    </span>
                  )
                }
              }
              return 'Give Up (G)'
            })()}
          </button>
        )
      })()}

      {/* Show waiting message for give up voting (cooperative multiplayer with multiple sessions) */}
      {gameMode === 'cooperative' &&
        activeUserIds.length > 1 &&
        giveUpVotes.length > 0 &&
        giveUpVotes.length < activeUserIds.length &&
        viewerId &&
        giveUpVotes.includes(viewerId) &&
        (() => {
          if (!svgRef.current || !containerRef.current || svgDimensions.width === 0) return null

          const svgRect = svgRef.current.getBoundingClientRect()
          const containerRect = containerRef.current.getBoundingClientRect()
          const svgOffsetY = svgRect.top - containerRect.top
          const buttonRight =
            containerRect.width - (svgRect.left - containerRect.left + svgRect.width) + 8

          const remaining = activeUserIds.length - giveUpVotes.length

          return (
            <div
              data-element="give-up-voters"
              className={css({
                position: 'absolute',
                fontSize: 'xs',
                color: isDark ? 'yellow.300' : 'yellow.700',
                bg: isDark ? 'gray.800/90' : 'white/90',
                padding: '1 2',
                rounded: 'md',
                border: '1px solid',
                borderColor: isDark ? 'yellow.600' : 'yellow.400',
                zIndex: 49,
              })}
              style={{
                top: `${svgOffsetY + 44}px`, // Below the Give Up button
                right: `${buttonRight}px`,
              }}
            >
              Waiting for {remaining} other {remaining === 1 ? 'player' : 'players'}...
            </div>
          )
        })()}

      {/* Hint button - only show if hint exists for current region */}
      {hasHint &&
        (() => {
          if (!svgRef.current || !containerRef.current || svgDimensions.width === 0) return null

          // During give-up animation, use saved position to prevent jumping
          let buttonTop: number
          let buttonRight: number

          if (isGiveUpAnimating && savedButtonPosition) {
            buttonTop = savedButtonPosition.top
            // Position hint button to the left of give up button
            buttonRight = savedButtonPosition.right + 100 // Give Up button width + gap
          } else {
            const svgRect = svgRef.current.getBoundingClientRect()
            const containerRect = containerRef.current.getBoundingClientRect()
            const svgOffsetX = svgRect.left - containerRect.left
            const svgOffsetY = svgRect.top - containerRect.top
            buttonTop = svgOffsetY + 8
            // Position hint button to the left of give up button (give up is ~85px + 8 gap)
            buttonRight = containerRect.width - (svgOffsetX + svgRect.width) + 8 + 100
          }

          return (
            <>
              <button
                ref={hintButton.refCallback}
                onClick={(e) => {
                  e.stopPropagation()
                  setShowHintBubble((prev) => !prev)
                }}
                data-action="hint-button"
                title="Get a hint (H)"
                style={{
                  position: 'absolute',
                  top: `${buttonTop}px`,
                  right: `${buttonRight}px`,
                  // Apply hover styles when fake cursor is over button (pointer lock mode)
                  ...(hintButton.isHovered
                    ? {
                        backgroundColor: isDark ? '#1e40af' : '#bfdbfe', // blue.800 darker / blue.200
                        transform: 'scale(1.05)',
                      }
                    : {}),
                  ...(isGiveUpAnimating
                    ? {
                        opacity: 0.5,
                        cursor: 'not-allowed',
                      }
                    : {}),
                }}
                className={css({
                  padding: '2 3',
                  fontSize: 'sm',
                  cursor: 'pointer',
                  bg: isDark ? 'blue.800' : 'blue.100',
                  color: isDark ? 'blue.200' : 'blue.800',
                  rounded: 'md',
                  border: '2px solid',
                  borderColor: isDark ? 'blue.600' : 'blue.400',
                  fontWeight: 'bold',
                  transition: 'all 0.2s',
                  zIndex: 50,
                  boxShadow: 'md',
                  _hover: {
                    bg: isDark ? 'blue.700' : 'blue.200',
                    transform: 'scale(1.05)',
                  },
                })}
              >
                💡 Hint (H)
              </button>

              {/* Speech bubble for hint */}
              {showHintBubble && hintText && (
                <div
                  data-element="hint-bubble"
                  style={{
                    position: 'absolute',
                    top: `${buttonTop + 44}px`, // Below the hint button
                    right: `${buttonRight - 50}px`, // Centered relative to button
                    maxWidth: '280px',
                  }}
                  className={css({
                    bg: isDark ? 'gray.800' : 'white',
                    color: isDark ? 'gray.100' : 'gray.800',
                    padding: '3',
                    rounded: 'lg',
                    border: '2px solid',
                    borderColor: isDark ? 'blue.500' : 'blue.400',
                    boxShadow: 'lg',
                    fontSize: 'sm',
                    lineHeight: 'relaxed',
                    zIndex: 51,
                    position: 'relative',
                    // Speech bubble pointer (pointing up to button)
                    _before: {
                      content: '""',
                      position: 'absolute',
                      top: '-10px',
                      right: '70px',
                      borderWidth: '0 10px 10px 10px',
                      borderStyle: 'solid',
                      borderColor: isDark
                        ? 'transparent transparent token(colors.blue.500) transparent'
                        : 'transparent transparent token(colors.blue.400) transparent',
                    },
                    _after: {
                      content: '""',
                      position: 'absolute',
                      top: '-7px',
                      right: '72px',
                      borderWidth: '0 8px 8px 8px',
                      borderStyle: 'solid',
                      borderColor: isDark
                        ? 'transparent transparent token(colors.gray.800) transparent'
                        : 'transparent transparent white transparent',
                    },
                  })}
                >
                  {/* Hint text */}
                  <div className={css({ marginBottom: '3', lineHeight: '1.5' })}>{hintText}</div>

                  {/* Controls section */}
                  <div
                    className={css({
                      borderTop: '1px solid',
                      borderColor: isDark ? 'gray.700' : 'gray.200',
                      paddingTop: '3',
                    })}
                  >
                    {/* Speech row - speak button with accent option */}
                    {isSpeechSupported && (
                      <div
                        className={css({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2',
                          marginBottom: hasAccentOption ? '2' : '3',
                        })}
                      >
                        {/* Speak button */}
                        <button
                          ref={speakButton.refCallback}
                          data-action="speak-hint"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSpeakClick()
                          }}
                          className={css({
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '1.5',
                            paddingX: '3',
                            paddingY: '1.5',
                            rounded: 'md',
                            bg: isSpeaking
                              ? isDark
                                ? 'blue.600'
                                : 'blue.500'
                              : isDark
                                ? 'gray.700'
                                : 'gray.100',
                            color: isSpeaking ? 'white' : isDark ? 'gray.300' : 'gray.600',
                            border: '1px solid',
                            borderColor: isSpeaking
                              ? isDark
                                ? 'blue.500'
                                : 'blue.400'
                              : isDark
                                ? 'gray.600'
                                : 'gray.300',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            fontSize: 'xs',
                            fontWeight: 'medium',
                            _hover: {
                              bg: isSpeaking
                                ? isDark
                                  ? 'blue.500'
                                  : 'blue.600'
                                : isDark
                                  ? 'gray.600'
                                  : 'gray.200',
                            },
                          })}
                          style={{
                            ...(speakButton.isHovered
                              ? {
                                  backgroundColor: isSpeaking
                                    ? isDark
                                      ? '#3b82f6'
                                      : '#2563eb'
                                    : isDark
                                      ? '#4b5563'
                                      : '#e5e7eb',
                                }
                              : {}),
                          }}
                          title={isSpeaking ? 'Stop' : 'Read aloud'}
                        >
                          {isSpeaking ? '⏹' : '🔊'}
                          <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
                        </button>

                        {/* With accent checkbox - inline with speak button */}
                        {hasAccentOption && (
                          <label
                            ref={withAccentCheckbox.refCallback}
                            onClick={(e) => {
                              e.stopPropagation()
                            }}
                            className={css({
                              display: 'flex',
                              alignItems: 'center',
                              gap: '1.5',
                              cursor: 'pointer',
                              fontSize: 'xs',
                              color: isDark ? 'gray.400' : 'gray.500',
                              padding: '1',
                              rounded: 'sm',
                              transition: 'all 0.15s',
                              _hover: {
                                color: isDark ? 'gray.200' : 'gray.700',
                              },
                            })}
                            style={{
                              ...(withAccentCheckbox.isHovered
                                ? { color: isDark ? '#e5e7eb' : '#374151' }
                                : {}),
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={withAccent}
                              onChange={(e) => handleWithAccentChange(e.target.checked)}
                              className={css({
                                width: '12px',
                                height: '12px',
                                cursor: 'pointer',
                                accentColor: isDark ? '#3b82f6' : '#2563eb',
                              })}
                            />
                            With accent
                          </label>
                        )}
                      </div>
                    )}

                    {/* Auto options row - horizontal compact layout */}
                    <div
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3',
                        fontSize: 'xs',
                        color: isDark ? 'gray.400' : 'gray.500',
                      })}
                    >
                      <span className={css({ fontWeight: 'medium' })}>Auto:</span>

                      {/* Auto-hint checkbox */}
                      <label
                        ref={autoHintCheckbox.refCallback}
                        onClick={(e) => {
                          e.stopPropagation()
                        }}
                        className={css({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1',
                          cursor: 'pointer',
                          padding: '0.5',
                          rounded: 'sm',
                          transition: 'all 0.15s',
                          _hover: {
                            color: isDark ? 'gray.200' : 'gray.700',
                          },
                        })}
                        style={{
                          ...(autoHintCheckbox.isHovered
                            ? { color: isDark ? '#e5e7eb' : '#374151' }
                            : {}),
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={autoHint}
                          onChange={(e) => handleAutoHintChange(e.target.checked)}
                          className={css({
                            width: '12px',
                            height: '12px',
                            cursor: 'pointer',
                            accentColor: isDark ? '#3b82f6' : '#2563eb',
                          })}
                        />
                        Hint
                      </label>

                      {/* Auto-speak checkbox */}
                      {isSpeechSupported && (
                        <label
                          ref={autoSpeakCheckbox.refCallback}
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                          className={css({
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1',
                            cursor: 'pointer',
                            padding: '0.5',
                            rounded: 'sm',
                            transition: 'all 0.15s',
                            _hover: {
                              color: isDark ? 'gray.200' : 'gray.700',
                            },
                          })}
                          style={{
                            ...(autoSpeakCheckbox.isHovered
                              ? { color: isDark ? '#e5e7eb' : '#374151' }
                              : {}),
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={autoSpeak}
                            onChange={(e) => handleAutoSpeakChange(e.target.checked)}
                            className={css({
                              width: '12px',
                              height: '12px',
                              cursor: 'pointer',
                              accentColor: isDark ? '#3b82f6' : '#2563eb',
                            })}
                          />
                          Speak
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )
        })()}

      {/* Hot/Cold button - show when speech is supported, assistance level allows, and device has mouse */}
      {isSpeechSupported &&
        hasFinePointer &&
        assistanceAllowsHotCold &&
        (() => {
          if (!svgRef.current || !containerRef.current || svgDimensions.width === 0) return null

          // During give-up animation, use saved position to prevent jumping
          let buttonTop: number
          let buttonRight: number

          if (isGiveUpAnimating && savedButtonPosition) {
            buttonTop = savedButtonPosition.top
            // Position hot/cold button to the left of hint button (hint is ~100px left of give up)
            buttonRight = savedButtonPosition.right + 200 // Give Up + Hint + gap
          } else {
            const svgRect = svgRef.current.getBoundingClientRect()
            const containerRect = containerRef.current.getBoundingClientRect()
            const svgOffsetX = svgRect.left - containerRect.left
            const svgOffsetY = svgRect.top - containerRect.top
            buttonTop = svgOffsetY + 8
            // Position to the left of hint button
            // Give up is ~85px + 8 gap = 93px from right edge of SVG
            // Hint is 100px to the left of that = 193px
            // Hot/cold is 100px to the left of hint = 293px
            buttonRight = containerRect.width - (svgOffsetX + svgRect.width) + 8 + 200
          }

          return (
            <button
              ref={hotColdButton.refCallback}
              onClick={(e) => {
                e.stopPropagation()
                handleHotColdToggle()
              }}
              data-action="hot-cold-button"
              title={
                hotColdEnabled
                  ? 'Disable hot/cold audio feedback'
                  : 'Enable hot/cold audio feedback'
              }
              style={{
                position: 'absolute',
                top: `${buttonTop}px`,
                right: `${buttonRight}px`,
                // Apply hover styles when fake cursor is over button (pointer lock mode)
                ...(hotColdButton.isHovered
                  ? {
                      backgroundColor: isDark
                        ? hotColdEnabled
                          ? '#c2410c'
                          : '#374151'
                        : hotColdEnabled
                          ? '#fed7aa'
                          : '#e5e7eb',
                      transform: 'scale(1.05)',
                    }
                  : {}),
                ...(isGiveUpAnimating
                  ? {
                      opacity: 0.5,
                      cursor: 'not-allowed',
                    }
                  : {}),
              }}
              className={css({
                padding: '2 3',
                fontSize: 'sm',
                cursor: 'pointer',
                bg: hotColdEnabled
                  ? isDark
                    ? 'orange.800'
                    : 'orange.100'
                  : isDark
                    ? 'gray.700'
                    : 'gray.200',
                color: hotColdEnabled
                  ? isDark
                    ? 'orange.200'
                    : 'orange.800'
                  : isDark
                    ? 'gray.400'
                    : 'gray.600',
                rounded: 'md',
                border: '2px solid',
                borderColor: hotColdEnabled
                  ? isDark
                    ? 'orange.600'
                    : 'orange.400'
                  : isDark
                    ? 'gray.600'
                    : 'gray.400',
                fontWeight: 'bold',
                transition: 'all 0.2s',
                zIndex: 50,
                boxShadow: 'md',
                _hover: {
                  bg: hotColdEnabled
                    ? isDark
                      ? 'orange.700'
                      : 'orange.200'
                    : isDark
                      ? 'gray.600'
                      : 'gray.300',
                  transform: 'scale(1.05)',
                },
              })}
            >
              {getHotColdEmoji(hotColdFeedbackType)} Hot/Cold
            </button>
          )
        })()}

      {/* Dev-only crop tool for getting custom viewBox coordinates */}
      <DevCropTool
        svgRef={svgRef}
        containerRef={containerRef}
        viewBox={displayViewBox}
        mapId={selectedMap}
        continentId={selectedContinent}
      />
    </div>
  )
}
