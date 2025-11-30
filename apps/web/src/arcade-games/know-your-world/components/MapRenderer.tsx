'use client'

import { animated, to, useSpring } from '@react-spring/web'
import { css } from '@styled/css'
import { forceCollide, forceSimulation, forceX, forceY, type SimulationNodeDatum } from 'd3-force'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useVisualDebugSafe } from '@/contexts/VisualDebugContext'
import type { ContinentId } from '../continents'
import {
  useCanUsePrecisionMode,
  useHasAnyFinePointer,
  useIsTouchDevice,
} from '../hooks/useDeviceCapabilities'
import { useHotColdFeedback } from '../hooks/useHotColdFeedback'
import { useMagnifierZoom } from '../hooks/useMagnifierZoom'
import { usePointerLock } from '../hooks/usePointerLock'
import { useRegionDetection } from '../hooks/useRegionDetection'
import { useHasRegionHint, useRegionHint } from '../hooks/useRegionHint'
import { useSpeakHint } from '../hooks/useSpeakHint'
import {
  getLabelTextColor,
  getLabelTextShadow,
  getRegionColor,
  getRegionStroke,
} from '../mapColors'
import {
  ASSISTANCE_LEVELS,
  calculateFitCropViewBox,
  calculateSafeZoneViewBox,
  filterRegionsByContinent,
  getCountryFlagEmoji,
  parseViewBox,
  type SafeZoneMargins,
  USA_MAP,
  WORLD_MAP,
} from '../maps'
import type { HintMap } from '../messages'
import { useKnowYourWorld } from '../Provider'
import type { MapData, MapRegion } from '../types'
import { type BoundingBox as DebugBoundingBox, findOptimalZoom } from '../utils/adaptiveZoomSearch'
import type { FeedbackType } from '../utils/hotColdPhrases'
import {
  getAdjustedMagnifiedDimensions,
  getMagnifierDimensions,
} from '../utils/magnifierDimensions'
import {
  calculateMaxZoomAtThreshold,
  calculateScreenPixelRatio,
  isAboveThreshold,
} from '../utils/screenPixelRatio'
import { classifyCelebration, CELEBRATION_TIMING } from '../utils/celebration'
import { CelebrationOverlay } from './CelebrationOverlay'
import { DevCropTool } from './DevCropTool'

// Debug flag: show technical info in magnifier (dev only)
const SHOW_MAGNIFIER_DEBUG_INFO = process.env.NODE_ENV === 'development'

// Debug flag: show bounding boxes with importance scores (dev only)
const SHOW_DEBUG_BOUNDING_BOXES = process.env.NODE_ENV === 'development'

// Debug flag: show safe zone rectangles (leftover area and crop region) - dev only
const SHOW_SAFE_ZONE_DEBUG = process.env.NODE_ENV === 'development'

// Precision mode threshold: screen pixel ratio that triggers pointer lock recommendation
const PRECISION_MODE_THRESHOLD = 20

// Label fade settings: labels fade near cursor to reduce clutter
const LABEL_FADE_RADIUS = 150 // pixels - labels within this radius fade
const LABEL_MIN_OPACITY = 0.08 // minimum opacity for faded labels

// Game nav height offset - buttons should appear below the nav when in full-viewport mode
const NAV_HEIGHT_OFFSET = 150

// Safe zone margins - areas reserved for floating UI elements (in pixels)
// These define where the crop region should NOT appear, ensuring findable regions
// are visible and not obscured by UI controls
const SAFE_ZONE_MARGINS: SafeZoneMargins = {
  top: 290, // Space for nav (~150px) + floating prompt (~140px with name input + controls row)
  right: 0, // Controls now in floating prompt, no right margin needed
  bottom: 0, // Error banner can overlap map
  left: 0, // Progress at top-left is small, doesn't need full-height margin
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
  /** When true, fill the parent container with position: absolute */
  fillContainer?: boolean
  /** Current difficulty level for display (deprecated - use assistanceLevel) */
  difficulty?: string
  /** Map display name */
  mapName?: string
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
  fillContainer = false,
  difficulty,
  mapName,
}: MapRendererProps) {
  // Get context for sharing state with GameInfoPanel
  const {
    setControlsState,
    sharedContainerRef,
    isInTakeover,
    celebration,
    setCelebration,
    promptStartTime,
  } = useKnowYourWorld()
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

  // Visual debug mode from global context (only enabled in dev AND when user toggles it on)
  const { isVisualDebugEnabled } = useVisualDebugSafe()

  // Effective debug flags - combine prop with context
  // Props allow component-level override, context allows global toggle
  const effectiveShowDebugBoundingBoxes = showDebugBoundingBoxes && isVisualDebugEnabled
  const effectiveShowMagnifierDebugInfo = SHOW_MAGNIFIER_DEBUG_INFO && isVisualDebugEnabled
  const effectiveShowSafeZoneDebug = SHOW_SAFE_ZONE_DEBUG && isVisualDebugEnabled

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

  // Device capability hooks for adaptive UI
  const isTouchDevice = useIsTouchDevice() // For touch-specific UI (magnifier expansion)
  const canUsePrecisionMode = useCanUsePrecisionMode() // For precision mode UI/behavior
  const hasAnyFinePointer = useHasAnyFinePointer() // For hot/cold feedback visibility

  // Memoize pointer lock callbacks to prevent render loop
  const handleLockAcquired = useCallback(() => {
    // Save initial cursor position
    if (cursorPositionRef.current) {
      initialCapturePositionRef.current = { ...cursorPositionRef.current }
    }
    // Note: Zoom update now handled by useMagnifierZoom hook
  }, [])

  const handleLockReleased = useCallback(() => {
    // Reset cursor squish
    setCursorSquish({ x: 1, y: 1 })
    setIsReleasingPointerLock(false)
    // Note: Zoom recalculation now handled by useMagnifierZoom hook
  }, [])

  // Pointer lock hook (needed by zoom hook)
  // Pass canUsePrecisionMode to prevent pointer lock on unsupported devices
  const { pointerLocked, requestPointerLock, exitPointerLock } = usePointerLock({
    containerRef,
    canUsePrecisionMode,
    onLockAcquired: handleLockAcquired,
    onLockReleased: handleLockReleased,
  })

  // Magnifier zoom hook
  // Disable threshold capping when precision mode isn't available (touch-only devices)
  const { targetZoom, setTargetZoom, zoomSpring, getCurrentZoom, uncappedAdaptiveZoomRef } =
    useMagnifierZoom({
      containerRef,
      svgRef,
      viewBox: mapData.viewBox,
      threshold: PRECISION_MODE_THRESHOLD,
      pointerLocked,
      initialZoom: 10,
      disableThresholdCapping: !canUsePrecisionMode,
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
  // Initialize magnifier position within the safe zone (below nav/floating UI)
  const [targetTop, setTargetTop] = useState(SAFE_ZONE_MARGINS.top)
  const [targetLeft, setTargetLeft] = useState(SAFE_ZONE_MARGINS.left + 20)
  const [smallestRegionSize, setSmallestRegionSize] = useState<number>(Infinity)
  const [shiftPressed, setShiftPressed] = useState(false)

  // Desktop click-and-drag magnifier state
  const [isDesktopMapDragging, setIsDesktopMapDragging] = useState(false)
  const desktopDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const desktopDragDidMoveRef = useRef(false)
  // Track last drag position - magnifier stays visible until cursor moves threshold away
  const lastDragPositionRef = useRef<{ x: number; y: number } | null>(null)
  const DRAG_START_THRESHOLD = 5 // Pixels to move before counting as drag (not click)
  const MAGNIFIER_DISMISS_THRESHOLD = 50 // Pixels to move away from last drag pos to dismiss

  // Track whether current target region needs magnification
  const [targetNeedsMagnification, setTargetNeedsMagnification] = useState(false)

  // Mobile magnifier touch drag state
  const [isMagnifierDragging, setIsMagnifierDragging] = useState(false)
  const magnifierTouchStartRef = useRef<{ x: number; y: number } | null>(null)
  const magnifierDidMoveRef = useRef(false) // Track if user actually dragged (vs just tapped)
  const magnifierRef = useRef<HTMLDivElement>(null) // Ref to magnifier element for tap position calculation
  const magnifierTapPositionRef = useRef<{ x: number; y: number } | null>(null) // Where user tapped on magnifier

  // Pinch-to-zoom state for magnifier
  const [isPinching, setIsPinching] = useState(false)
  const pinchStartDistanceRef = useRef<number | null>(null) // Initial distance between two fingers
  const pinchStartZoomRef = useRef<number | null>(null) // Zoom level when pinch started
  const [isMagnifierExpanded, setIsMagnifierExpanded] = useState(false) // Magnifier fills leftover area during pinch

  // Mobile map drag state - detect touch drags on the map to show magnifier
  const [isMobileMapDragging, setIsMobileMapDragging] = useState(false)
  const mapTouchStartRef = useRef<{ x: number; y: number } | null>(null)
  const MOBILE_DRAG_THRESHOLD = 10 // pixels before we consider it a drag
  // Track if magnifier was triggered by mobile map drag (for showing Select button)
  const [mobileMapDragTriggeredMagnifier, setMobileMapDragTriggeredMagnifier] = useState(false)
  const AUTO_EXIT_ZOOM_THRESHOLD = 1.5 // Exit expanded mode when zoom drops below this

  // Auto-exit expanded magnifier mode when zoom approaches 1x
  useEffect(() => {
    if (isMagnifierExpanded && targetZoom < AUTO_EXIT_ZOOM_THRESHOLD) {
      console.log(
        '[MapRenderer] Auto-exiting expanded magnifier mode - zoom dropped below threshold:',
        targetZoom
      )
      setIsMagnifierExpanded(false)
    }
  }, [isMagnifierExpanded, targetZoom])

  // Give up reveal animation state
  const [giveUpFlashProgress, setGiveUpFlashProgress] = useState(0) // 0-1 pulsing value
  const [isGiveUpAnimating, setIsGiveUpAnimating] = useState(false) // Track if animation in progress

  // Hint animation state
  const [hintFlashProgress, setHintFlashProgress] = useState(0) // 0-1 pulsing value
  const [isHintAnimating, setIsHintAnimating] = useState(false) // Track if animation in progress

  // Celebration animation state
  const [celebrationFlashProgress, setCelebrationFlashProgress] = useState(0) // 0-1 pulsing value
  const pendingCelebrationClick = useRef<{ regionId: string; regionName: string } | null>(null)
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

  // Whether hot/cold button should be shown at all
  // Uses hasAnyFinePointer because iPads with attached mice should show hot/cold
  const showHotCold = isSpeechSupported && hasAnyFinePointer && assistanceAllowsHotCold

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

  // Speak hint callback
  const handleSpeakClick = useCallback(() => {
    if (isSpeaking) {
      stopSpeaking()
    } else if (currentRegionName) {
      speakWithRegionName(currentRegionName, hintText, withAccent)
    }
  }, [isSpeaking, stopSpeaking, currentRegionName, hintText, speakWithRegionName, withAccent])

  // Auto-speak toggle callback
  const handleAutoSpeakToggle = useCallback(() => {
    handleAutoSpeakChange(!autoSpeak)
  }, [autoSpeak, handleAutoSpeakChange])

  // With accent toggle callback
  const handleWithAccentToggle = useCallback(() => {
    handleWithAccentChange(!withAccent)
  }, [withAccent, handleWithAccentChange])

  // Auto-hint toggle callback
  const handleAutoHintToggle = useCallback(() => {
    handleAutoHintChange(!autoHint)
  }, [autoHint, handleAutoHintChange])

  // Hot/cold toggle callback
  const handleHotColdToggle = useCallback(() => {
    handleHotColdChange(!hotColdEnabled)
  }, [hotColdEnabled, handleHotColdChange])

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
    getSearchMetrics,
  } = useHotColdFeedback({
    enabled: assistanceAllowsHotCold && hotColdEnabled && hasAnyFinePointer,
    targetRegionId: currentPrompt,
    isSpeaking,
    mapName: hotColdMapName,
    regions: mapData.regions,
  })

  // Reset hot/cold feedback when prompt changes
  useEffect(() => {
    resetHotCold()
  }, [currentPrompt, resetHotCold])

  // Update context with controls state for GameInfoPanel
  useEffect(() => {
    setControlsState({
      isPointerLocked: pointerLocked,
      fakeCursorPosition: cursorPosition,
      showHotCold,
      hotColdEnabled,
      hotColdFeedbackType,
      onHotColdToggle: handleHotColdToggle,
      hasHint,
      currentHint: hintText,
      isGiveUpAnimating,
      // Speech/audio state
      isSpeechSupported,
      hasAccentOption,
      isSpeaking,
      onSpeak: handleSpeakClick,
      onStopSpeaking: stopSpeaking,
      // Auto settings
      autoSpeak,
      onAutoSpeakToggle: handleAutoSpeakToggle,
      withAccent,
      onWithAccentToggle: handleWithAccentToggle,
      autoHint,
      onAutoHintToggle: handleAutoHintToggle,
    })
  }, [
    pointerLocked,
    cursorPosition,
    showHotCold,
    hotColdEnabled,
    hotColdFeedbackType,
    handleHotColdToggle,
    hasHint,
    hintText,
    isGiveUpAnimating,
    setControlsState,
    // Speech/audio deps
    isSpeechSupported,
    hasAccentOption,
    isSpeaking,
    handleSpeakClick,
    stopSpeaking,
    // Auto settings deps
    autoSpeak,
    handleAutoSpeakToggle,
    withAccent,
    handleWithAccentToggle,
    autoHint,
    handleAutoHintToggle,
  ])

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
      }
    })

    largestPieceSizesRef.current = largestPieceSizes
  }, [mapData])

  // Check if pointer lock is supported (not available on touch devices like iPad)
  const isPointerLockSupported = typeof document !== 'undefined' && 'pointerLockElement' in document

  // Request pointer lock on first click
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If we just finished a drag, suppress this click (user was dragging, not clicking)
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false
      return
    }

    // Silently request pointer lock if not already locked (and supported)
    // This makes the first gameplay click also enable precision mode
    // On devices without pointer lock (iPad), skip this and process clicks normally
    if (!pointerLocked && isPointerLockSupported) {
      requestPointerLock()
      return // Don't process region click on the first click that requests lock
    }

    // When pointer lock is active, browser doesn't deliver click events to SVG children
    // We need to manually detect which region is under the cursor
    if (pointerLocked && cursorPositionRef.current && containerRef.current && svgRef.current) {
      const { x: cursorX, y: cursorY } = cursorPositionRef.current

      // Use the same detection logic as hover tracking (50px detection box)
      const { detectedRegions, regionUnderCursor } = detectRegions(cursorX, cursorY)

      if (regionUnderCursor && !celebration) {
        // Find the region data to get the name
        const region = mapData.regions.find((r) => r.id === regionUnderCursor)
        if (region) {
          handleRegionClickWithCelebration(regionUnderCursor, region.name)
        }
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
  // When fillContainer is true (playing phase), we use safe zone margins to ensure
  // the crop region doesn't appear under floating UI elements
  const displayViewBox = useMemo(() => {
    // Need container dimensions to calculate aspect ratio
    if (svgDimensions.width <= 0 || svgDimensions.height <= 0) {
      return mapData.viewBox
    }

    const originalBounds = parseViewBox(mapData.originalViewBox)

    // Use custom crop if defined, otherwise use the full original map bounds
    // This ensures the map always fits within the leftover area (not under UI elements)
    const cropRegion = mapData.customCrop ? parseViewBox(mapData.customCrop) : originalBounds

    // In full-viewport mode (fillContainer), use safe zone calculation to ensure
    // the crop region fits within the area not covered by floating UI elements
    if (fillContainer) {
      const result = calculateSafeZoneViewBox(
        svgDimensions.width,
        svgDimensions.height,
        SAFE_ZONE_MARGINS,
        cropRegion,
        originalBounds
      )
      return result
    }

    // If not fillContainer and no custom crop, just use regular viewBox
    if (!mapData.customCrop) {
      return mapData.viewBox
    }

    // Otherwise use standard fit-crop calculation (for setup phase, etc.)
    const containerAspect = svgDimensions.width / svgDimensions.height
    const result = calculateFitCropViewBox(originalBounds, cropRegion, containerAspect)
    return result
  }, [mapData.customCrop, mapData.originalViewBox, mapData.viewBox, svgDimensions, fillContainer])

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

    // Save current button position before zoom changes the layout
    if (svgRef.current && containerRef.current) {
      const svgRect = svgRef.current.getBoundingClientRect()
      const containerRect = containerRef.current.getBoundingClientRect()
      const svgOffsetX = svgRect.left - containerRect.left
      const svgOffsetY = svgRect.top - containerRect.top
      // Add nav offset when in full-viewport mode
      const buttonTop = svgOffsetY + 8 + (fillContainer ? NAV_HEIGHT_OFFSET : 0)
      const buttonRight = containerRect.width - (svgOffsetX + svgRect.width) + 8
      setSavedButtonPosition({ top: buttonTop, right: buttonRight })
    }

    // Calculate CSS transform to zoom and center on the revealed region
    if (svgRef.current && containerRef.current) {
      const path = svgRef.current.querySelector(`path[data-region-id="${giveUpReveal.regionId}"]`)
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

        // Start zoom-in animation using CSS transform
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

  // Celebration animation effect - gold flash and confetti when region found
  useEffect(() => {
    if (!celebration) {
      setCelebrationFlashProgress(0)
      return
    }

    // Track if this effect has been cleaned up
    let isCancelled = false
    let animationFrameId: number | null = null

    // Animation: pulsing gold flash during celebration
    const timing = CELEBRATION_TIMING[celebration.type]
    const duration = timing.totalDuration
    const pulses = celebration.type === 'lightning' ? 2 : celebration.type === 'standard' ? 3 : 4
    const startTime = Date.now()

    const animate = () => {
      if (isCancelled) return

      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Create pulsing effect: sin wave for smooth on/off
      const pulseProgress = Math.sin(progress * Math.PI * pulses * 2) * 0.5 + 0.5
      setCelebrationFlashProgress(pulseProgress)

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate)
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
  }, [celebration?.startTime]) // Re-run when celebration starts

  // Handle celebration completion - call the actual click after animation
  const handleCelebrationComplete = useCallback(() => {
    const pending = pendingCelebrationClick.current
    if (pending) {
      // Clear celebration state first
      setCelebration(null)
      setCelebrationFlashProgress(0)
      // Then fire the actual click
      onRegionClick(pending.regionId, pending.regionName)
      pendingCelebrationClick.current = null
    }
  }, [setCelebration, onRegionClick])

  // Wrapper function to intercept clicks and trigger celebration for correct regions
  const handleRegionClickWithCelebration = useCallback(
    (regionId: string, regionName: string) => {
      // If we're already celebrating, ignore clicks
      if (celebration) return

      // Check if this is the correct region
      if (regionId === currentPrompt) {
        // Correct! Start celebration
        const metrics = getSearchMetrics(promptStartTime.current)
        const celebrationType = classifyCelebration(metrics)

        // Store pending click for after celebration
        pendingCelebrationClick.current = { regionId, regionName }

        // Start celebration
        setCelebration({
          regionId,
          regionName,
          type: celebrationType,
          startTime: Date.now(),
        })
      } else {
        // Wrong region - handle immediately
        onRegionClick(regionId, regionName)
      }
    },
    [celebration, currentPrompt, getSearchMetrics, promptStartTime, setCelebration, onRegionClick]
  )

  // Get center of celebrating region for confetti origin
  const getCelebrationRegionCenter = useCallback((): { x: number; y: number } => {
    if (!celebration || !svgRef.current || !containerRef.current) {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    }

    const region = mapData.regions.find((r) => r.id === celebration.regionId)
    if (!region) {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    }

    // Convert SVG coordinates to screen coordinates
    const svgRect = svgRef.current.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()
    const viewBoxParts = displayViewBox.split(' ').map(Number)
    const viewBoxX = viewBoxParts[0] || 0
    const viewBoxY = viewBoxParts[1] || 0
    const viewBoxW = viewBoxParts[2] || 1000
    const viewBoxH = viewBoxParts[3] || 500
    const viewport = getRenderedViewport(svgRect, viewBoxX, viewBoxY, viewBoxW, viewBoxH)
    const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
    const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY

    // Get absolute screen position
    const screenX = containerRect.left + (region.center[0] - viewBoxX) * viewport.scale + svgOffsetX
    const screenY = containerRect.top + (region.center[1] - viewBoxY) * viewport.scale + svgOffsetY

    return { x: screenX, y: screenY }
  }, [celebration, mapData.regions, displayViewBox])

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

        // Debug logging ONLY for Gibraltar (commented out - too spammy)
        // if (region.id === 'gi' || pixelWidth < 1 || pixelHeight < 1) {
        //   console.log(
        //     `[MapRenderer] ${region.id === 'gi' ? '🎯 GIBRALTAR' : '🔍 TINY'}: ${region.name} - ` +
        //       `W:${pixelWidth.toFixed(2)}px H:${pixelHeight.toFixed(2)}px ` +
        //       `Area:${pixelArea.toFixed(2)}px²`
        //   )
        // }

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

  // Desktop click-and-drag handlers for magnifier
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle left click, and not on touch devices
    if (e.button !== 0 || isTouchDevice) return

    let cursorX: number
    let cursorY: number

    if (pointerLocked && cursorPositionRef.current) {
      // When pointer is locked, use the tracked cursor position
      cursorX = cursorPositionRef.current.x
      cursorY = cursorPositionRef.current.y
    } else {
      // Normal mode: use click position
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return

      cursorX = e.clientX - containerRect.left
      cursorY = e.clientY - containerRect.top
    }

    desktopDragStartRef.current = { x: cursorX, y: cursorY }
    desktopDragDidMoveRef.current = false
  }

  // Track if we should suppress the next click (because user was dragging)
  const suppressNextClickRef = useRef(false)

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    // If user was dragging, save the last position for threshold-based dismissal
    // and suppress the click event that will follow
    if (isDesktopMapDragging && cursorPositionRef.current) {
      lastDragPositionRef.current = { ...cursorPositionRef.current }
      suppressNextClickRef.current = true
    }

    // Reset drag state
    desktopDragStartRef.current = null
    setIsDesktopMapDragging(false)
    desktopDragDidMoveRef.current = false
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

      // Check if cursor has squished through and should escape (using dampened position!)
      if (dampenedMinDist < escapeThreshold && !isReleasingPointerLock) {
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

      // Desktop drag detection in pointer lock mode
      // Check if user has moved enough from drag start point
      if (desktopDragStartRef.current && !isDesktopMapDragging) {
        const deltaX = cursorX - desktopDragStartRef.current.x
        const deltaY = cursorY - desktopDragStartRef.current.y
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

        if (distance >= DRAG_START_THRESHOLD) {
          desktopDragDidMoveRef.current = true
          setIsDesktopMapDragging(true)
          lastDragPositionRef.current = null
        }
      }

      // Check if cursor has moved far enough from last drag position to dismiss magnifier
      if (lastDragPositionRef.current && !isDesktopMapDragging && !shiftPressed) {
        const deltaX = cursorX - lastDragPositionRef.current.x
        const deltaY = cursorY - lastDragPositionRef.current.y
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

        if (distance >= MAGNIFIER_DISMISS_THRESHOLD) {
          lastDragPositionRef.current = null
        }
      }
    } else {
      // Normal mode: use absolute position
      cursorX = e.clientX - containerRect.left
      cursorY = e.clientY - containerRect.top

      // Desktop drag detection: check if user has moved enough from drag start point
      if (desktopDragStartRef.current && !isDesktopMapDragging) {
        const deltaX = cursorX - desktopDragStartRef.current.x
        const deltaY = cursorY - desktopDragStartRef.current.y
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

        if (distance >= DRAG_START_THRESHOLD) {
          desktopDragDidMoveRef.current = true
          setIsDesktopMapDragging(true)
          // Clear the last drag position since we're starting a new drag
          lastDragPositionRef.current = null
        }
      }

      // Check if cursor has moved far enough from last drag position to dismiss magnifier
      // This allows the user to complete a drag and then click without the magnifier disappearing
      if (lastDragPositionRef.current && !isDesktopMapDragging && !shiftPressed) {
        const deltaX = cursorX - lastDragPositionRef.current.x
        const deltaY = cursorY - lastDragPositionRef.current.y
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

        if (distance >= MAGNIFIER_DISMISS_THRESHOLD) {
          lastDragPositionRef.current = null
        }
      }
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

    // Show magnifier when:
    // 1. Shift key is held down (manual override on desktop)
    // 2. Current target region needs magnification AND there's a small region nearby
    // 3. User is dragging on the map on mobile (always show magnifier for mobile drag)
    // 4. User is click-dragging on the map on desktop
    // 5. User recently finished a drag and cursor is still near the drag end position
    const isNearLastDragPosition = lastDragPositionRef.current !== null
    const shouldShow =
      shiftPressed ||
      isMobileMapDragging ||
      isDesktopMapDragging ||
      isNearLastDragPosition ||
      (targetNeedsMagnification && hasSmallRegion)

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
    // Only run if enabled, we have a target region, device has a fine pointer (mouse),
    // and user can actually see/interact with the map (not during animations or takeover)
    if (
      hotColdEnabledRef.current &&
      currentPrompt &&
      hasAnyFinePointer &&
      !isGiveUpAnimating &&
      !isInTakeover
    ) {
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

      // Calculate leftover rectangle dimensions (area not covered by UI elements)
      const leftoverWidth = containerRect.width - SAFE_ZONE_MARGINS.left - SAFE_ZONE_MARGINS.right
      const leftoverHeight = containerRect.height - SAFE_ZONE_MARGINS.top - SAFE_ZONE_MARGINS.bottom

      // Calculate magnifier dimensions based on leftover rectangle (responsive to its aspect ratio)
      const { width: magnifierWidth, height: magnifierHeight } = getMagnifierDimensions(
        leftoverWidth,
        leftoverHeight
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
        // Calculate leftover rectangle bounds (where magnifier can safely be positioned)
        const leftoverTop = SAFE_ZONE_MARGINS.top
        const leftoverBottom =
          containerRect.height - SAFE_ZONE_MARGINS.bottom - magnifierHeight - 20
        const leftoverLeft = SAFE_ZONE_MARGINS.left + 20
        const leftoverRight = containerRect.width - SAFE_ZONE_MARGINS.right - magnifierWidth - 20

        // Calculate the center of the leftover rectangle for positioning decisions
        const leftoverCenterX = (leftoverLeft + leftoverRight + magnifierWidth) / 2
        const leftoverCenterY = (leftoverTop + leftoverBottom + magnifierHeight) / 2

        // Move to opposite corner from cursor (relative to leftover rectangle center)
        const isLeftHalf = cursorX < leftoverCenterX
        const isTopHalf = cursorY < leftoverCenterY

        // Default: opposite corner from cursor, within leftover bounds
        newTop = isTopHalf ? leftoverBottom : leftoverTop
        newLeft = isLeftHalf ? leftoverRight : leftoverLeft

        // When hint bubble is shown, blacklist the upper-right corner
        // If magnifier would go to top-right (cursor in bottom-left), go to bottom-right instead
        const wouldGoToTopRight = !isTopHalf && isLeftHalf
        if (showHintBubble && wouldGoToTopRight) {
          newTop = leftoverBottom // Move to bottom
          // newLeft stays at right
        }
      }

      // Store uncapped adaptive zoom before potentially capping it
      uncappedAdaptiveZoomRef.current = adaptiveZoom

      // Cap zoom if not in pointer lock mode to prevent excessive screen pixel ratios
      if (!pointerLocked && containerRef.current && svgRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const svgRect = svgRef.current.getBoundingClientRect()
        // Calculate leftover rectangle dimensions for magnifier sizing
        const leftoverWidthForCap =
          containerRect.width - SAFE_ZONE_MARGINS.left - SAFE_ZONE_MARGINS.right
        const leftoverHeightForCap =
          containerRect.height - SAFE_ZONE_MARGINS.top - SAFE_ZONE_MARGINS.bottom
        const { width: magnifierWidth } = getMagnifierDimensions(
          leftoverWidthForCap,
          leftoverHeightForCap
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
      setShowMagnifier(false)
      setTargetOpacity(0)
      setDebugBoundingBoxes([]) // Clear bounding boxes when hiding
    }
  }

  const handleMouseLeave = () => {
    // Don't hide magnifier when pointer is locked
    // The cursor is locked to the container, so mouse leave events are not meaningful
    if (pointerLocked) {
      return
    }

    // Reset desktop drag state when mouse leaves
    desktopDragStartRef.current = null
    setIsDesktopMapDragging(false)
    desktopDragDidMoveRef.current = false
    lastDragPositionRef.current = null

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

  // Mobile map touch handlers - detect drag gestures to show magnifier
  const handleMapTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    // Only handle single-finger touch
    if (e.touches.length !== 1) return

    const touch = e.touches[0]
    mapTouchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const handleMapTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!mapTouchStartRef.current || !svgRef.current || !containerRef.current) return
      if (e.touches.length !== 1) return

      const touch = e.touches[0]
      const dx = touch.clientX - mapTouchStartRef.current.x
      const dy = touch.clientY - mapTouchStartRef.current.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      // Once we detect a drag (moved past threshold), show magnifier and update cursor
      if (distance >= MOBILE_DRAG_THRESHOLD) {
        // Prevent default to stop text selection and other browser gestures
        e.preventDefault()

        if (!isMobileMapDragging) {
          setIsMobileMapDragging(true)
        }

        // Update cursor position based on touch location
        const containerRect = containerRef.current.getBoundingClientRect()
        const cursorX = touch.clientX - containerRect.left
        const cursorY = touch.clientY - containerRect.top

        cursorPositionRef.current = { x: cursorX, y: cursorY }
        setCursorPosition({ x: cursorX, y: cursorY })

        // Show magnifier and set it up for mobile drag
        setShowMagnifier(true)
        setTargetOpacity(1)

        // Use adaptive zoom from region detection if available
        const detectionResult = detectRegions(cursorX, cursorY)
        const { detectedRegions: detectedRegionObjects, detectedSmallestSize } = detectionResult

        // Filter out found regions from zoom calculations (same as desktop)
        const unfoundRegionObjects = detectedRegionObjects.filter(
          (r) => !regionsFound.includes(r.id)
        )

        // Use adaptive zoom search utility to find optimal zoom (same algorithm as desktop)
        const svgRect = svgRef.current.getBoundingClientRect()
        const zoomSearchResult = findOptimalZoom({
          detectedRegions: unfoundRegionObjects,
          detectedSmallestSize,
          cursorX,
          cursorY,
          containerRect,
          svgRect,
          mapData,
          svgElement: svgRef.current,
          largestPieceSizesCache: largestPieceSizesRef.current,
          maxZoom: MAX_ZOOM,
          minZoom: 1,
          pointerLocked: false, // Mobile never uses pointer lock
        })

        setTargetZoom(zoomSearchResult.zoom)

        // Calculate leftover rectangle dimensions (area not covered by UI elements)
        const leftoverWidth = containerRect.width - SAFE_ZONE_MARGINS.left - SAFE_ZONE_MARGINS.right
        const leftoverHeight =
          containerRect.height - SAFE_ZONE_MARGINS.top - SAFE_ZONE_MARGINS.bottom

        // Get magnifier dimensions based on leftover rectangle (responsive to its aspect ratio)
        const { width: magnifierWidth, height: magnifierHeight } = getMagnifierDimensions(
          leftoverWidth,
          leftoverHeight
        )

        // Lazy positioning like desktop - only move magnifier when cursor would be obscured
        // Exception: always position on first show (when drag just started)
        const isFirstShow = !isMobileMapDragging // State hasn't updated yet on first frame

        // Check if cursor would be obscured by magnifier
        const padding = 30 // Extra padding around magnifier to trigger movement early
        const currentMagLeft = targetLeft
        const currentMagTop = targetTop
        const currentMagRight = currentMagLeft + magnifierWidth
        const currentMagBottom = currentMagTop + magnifierHeight

        const cursorInMagnifier =
          cursorX >= currentMagLeft - padding &&
          cursorX <= currentMagRight + padding &&
          cursorY >= currentMagTop - padding &&
          cursorY <= currentMagBottom + padding

        // Only calculate new position if first show OR cursor would be obscured
        if (isFirstShow || cursorInMagnifier) {
          // Calculate leftover rectangle bounds (where magnifier can safely be positioned)
          const leftoverTop = SAFE_ZONE_MARGINS.top
          const leftoverBottom =
            containerRect.height - SAFE_ZONE_MARGINS.bottom - magnifierHeight - 20
          const leftoverLeft = SAFE_ZONE_MARGINS.left + 20
          const leftoverRight = containerRect.width - SAFE_ZONE_MARGINS.right - magnifierWidth - 20

          // Calculate the center of the leftover rectangle for positioning decisions
          const leftoverCenterX = (leftoverLeft + leftoverRight + magnifierWidth) / 2
          const leftoverCenterY = (leftoverTop + leftoverBottom + magnifierHeight) / 2

          // Position magnifier away from touch point (relative to leftover rectangle center)
          const isLeftHalf = cursorX < leftoverCenterX
          const isTopHalf = cursorY < leftoverCenterY

          // Place magnifier in opposite corner from where user is touching, within leftover bounds
          const newTop = isTopHalf ? leftoverBottom : leftoverTop
          const newLeft = isLeftHalf ? leftoverRight : leftoverLeft

          setTargetTop(newTop)
          setTargetLeft(newLeft)
        }
      }
    },
    [
      isMobileMapDragging,
      MOBILE_DRAG_THRESHOLD,
      detectRegions,
      MAX_ZOOM,
      getMagnifierDimensions,
      regionsFound,
      mapData,
      targetLeft,
      targetTop,
    ]
  )

  // Helper to dismiss the magnifier (used by tap-to-dismiss and after selection)
  const dismissMagnifier = useCallback(() => {
    setShowMagnifier(false)
    setTargetOpacity(0)
    setCursorPosition(null)
    cursorPositionRef.current = null
    setIsMagnifierExpanded(false) // Reset expanded state on dismiss
    setMobileMapDragTriggeredMagnifier(false) // Reset mobile drag trigger state
  }, [])

  const handleMapTouchEnd = useCallback(() => {
    const wasDragging = isMobileMapDragging
    mapTouchStartRef.current = null

    if (wasDragging) {
      setIsMobileMapDragging(false)
      // Mark that magnifier was triggered by mobile drag (shows Select button)
      setMobileMapDragTriggeredMagnifier(true)
      // Keep magnifier visible after drag ends - user can tap "Select" button or tap elsewhere to dismiss
      // Don't hide magnifier or clear cursor - leave them in place for selection
    } else if (showMagnifier && cursorPositionRef.current) {
      // User tapped on map (not a drag) while magnifier is visible - dismiss the magnifier
      dismissMagnifier()
    }
  }, [isMobileMapDragging, showMagnifier, dismissMagnifier])

  // Helper to calculate distance between two touch points
  const getTouchDistance = useCallback((touches: React.TouchList): number => {
    if (touches.length < 2) return 0
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }, [])

  // Mobile magnifier touch handlers - allow panning by dragging on the magnifier
  const handleMagnifierTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      // Stop propagation to prevent map container from receiving this touch
      e.stopPropagation()

      // Handle two-finger touch (pinch start)
      if (e.touches.length === 2) {
        const distance = getTouchDistance(e.touches)
        pinchStartDistanceRef.current = distance
        pinchStartZoomRef.current = getCurrentZoom()
        setIsPinching(true)
        setIsMagnifierExpanded(true) // Expand magnifier to fill leftover area during pinch
        setIsMagnifierDragging(false) // Cancel any single-finger drag
        magnifierTouchStartRef.current = null
        e.preventDefault()
        return
      }

      // Handle single-finger touch (pan/tap)
      if (e.touches.length === 1) {
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
      }
    },
    [getTouchDistance, getCurrentZoom]
  )

  const handleMagnifierTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      // Stop propagation to prevent map container from receiving this touch
      e.stopPropagation()

      // Handle two-finger pinch gesture
      if (e.touches.length === 2 && isPinching) {
        const currentDistance = getTouchDistance(e.touches)
        const startDistance = pinchStartDistanceRef.current
        const startZoom = pinchStartZoomRef.current

        if (startDistance && startZoom && currentDistance > 0) {
          // Calculate new zoom based on pinch scale
          const scale = currentDistance / startDistance
          const newZoom = Math.max(1, Math.min(MAX_ZOOM, startZoom * scale))
          setTargetZoom(newZoom)
        }

        e.preventDefault()
        return
      }

      // Handle single-finger panning
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

      // Get container and SVG measurements first (needed for 1:1 calculation)
      const containerRect = containerRef.current.getBoundingClientRect()
      const svgRect = svgRef.current.getBoundingClientRect()

      // Calculate viewport scale and magnifier dimensions for true 1:1 panning
      //
      // For 1:1 panning, we need to account for:
      // 1. How the SVG is scaled to fit the container (viewport.scale)
      // 2. How the magnifier zooms the content (currentZoom)
      // 3. The actual magnifier dimensions
      //
      // The magnifier shows (viewBoxW / currentZoom) SVG units across magnifierWidth pixels.
      // The SVG in the container renders at viewport.scale (container px per SVG unit).
      //
      // For finger moving N screen pixels to move content N pixels in magnifier:
      // - Content movement in SVG units = N / (magnifierWidth * currentZoom / viewBoxW)
      // - Cursor movement in container = (N / magnifierScale) * viewport.scale
      // - touchMultiplier = viewport.scale * viewBoxW / (magnifierWidth * currentZoom)
      const viewBoxParts = displayViewBox.split(' ').map(Number)
      const viewBoxW = viewBoxParts[2] || 1000
      const viewBoxH = viewBoxParts[3] || 500

      // Calculate the viewport scale (how the SVG is scaled to fit the SVG element)
      // This is the same calculation as getRenderedViewport but we just need the scale
      const svgAspect = viewBoxW / viewBoxH
      const containerAspect = svgRect.width / svgRect.height
      const viewportScale =
        containerAspect > svgAspect
          ? svgRect.height / viewBoxH // Height-constrained
          : svgRect.width / viewBoxW // Width-constrained

      // Get current magnifier dimensions
      const leftoverWidth = containerRect.width - SAFE_ZONE_MARGINS.left - SAFE_ZONE_MARGINS.right
      const leftoverHeight = containerRect.height - SAFE_ZONE_MARGINS.top - SAFE_ZONE_MARGINS.bottom
      const { width: magnifierWidth, height: magnifierHeight } = getMagnifierDimensions(
        leftoverWidth,
        leftoverHeight
      )
      const actualMagnifierWidth = isMagnifierExpanded ? leftoverWidth : magnifierWidth
      const actualMagnifierHeight = isMagnifierExpanded ? leftoverHeight : magnifierHeight

      const currentZoom = getCurrentZoom()

      // Calculate the true 1:1 touch multiplier
      // When finger moves N pixels, content in magnifier should move N pixels visually
      // Use the smaller dimension to ensure consistency (magnifier may not be square)
      const magnifierScaleX = (actualMagnifierWidth * currentZoom) / viewBoxW
      const magnifierScaleY = (actualMagnifierHeight * currentZoom) / viewBoxH
      // Use the smaller scale factor to ensure 1:1 feel in the constrained direction
      const magnifierScale = Math.min(magnifierScaleX, magnifierScaleY)
      const touchMultiplier = viewportScale / magnifierScale

      // Invert the delta - dragging the "paper" under the magnifier means:
      // - Drag finger right = paper moves right = magnifier shows what was to the LEFT
      // - So we SUBTRACT the delta to move the cursor in the opposite direction
      const newCursorX = cursorPositionRef.current.x - deltaX * touchMultiplier
      const newCursorY = cursorPositionRef.current.y - deltaY * touchMultiplier

      // Clamp to SVG bounds
      const svgOffsetX = svgRect.left - containerRect.left
      const svgOffsetY = svgRect.top - containerRect.top

      const clampedX = Math.max(svgOffsetX, Math.min(svgOffsetX + svgRect.width, newCursorX))
      const clampedY = Math.max(svgOffsetY, Math.min(svgOffsetY + svgRect.height, newCursorY))

      // Update cursor position
      cursorPositionRef.current = { x: clampedX, y: clampedY }
      setCursorPosition({ x: clampedX, y: clampedY })

      // Run region detection to update hoveredRegionId and get regions for adaptive zoom
      const {
        regionUnderCursor,
        detectedRegions: detectedRegionObjects,
        detectedSmallestSize,
      } = detectRegions(clampedX, clampedY)

      // Auto-zoom based on regions at cursor position (same as map drag behavior)
      // Filter out found regions from zoom calculations
      const unfoundRegionObjects = detectedRegionObjects.filter(
        (r) => !regionsFound.includes(r.id)
      )

      // Calculate optimal zoom for the new cursor position
      const zoomSearchResult = findOptimalZoom({
        detectedRegions: unfoundRegionObjects,
        detectedSmallestSize,
        cursorX: clampedX,
        cursorY: clampedY,
        containerRect,
        svgRect,
        mapData,
        svgElement: svgRef.current,
        largestPieceSizesCache: largestPieceSizesRef.current,
        maxZoom: MAX_ZOOM,
        minZoom: 1,
        pointerLocked: false, // Mobile never uses pointer lock
      })

      setTargetZoom(zoomSearchResult.zoom)

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
      isPinching,
      isMagnifierExpanded,
      getTouchDistance,
      MAX_ZOOM,
      setTargetZoom,
      detectRegions,
      onCursorUpdate,
      gameMode,
      currentPlayer,
      localPlayerId,
      displayViewBox,
      getCurrentZoom,
      regionsFound,
      mapData,
    ]
  )

  const handleMagnifierTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      // Always stop propagation to prevent map container from receiving touch end
      // (which would trigger dismissMagnifier via handleMapTouchEnd)
      e.stopPropagation()

      // Reset pinch state
      if (isPinching) {
        setIsPinching(false)
        pinchStartDistanceRef.current = null
        pinchStartZoomRef.current = null
        // If still have one finger down, don't reset drag state - they might continue panning
        if (e.touches.length === 1) {
          // User lifted one finger but still has one down - start panning
          const touch = e.touches[0]
          magnifierTouchStartRef.current = { x: touch.clientX, y: touch.clientY }
          setIsMagnifierDragging(true)
        }
        return
      }

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

          if (regionUnderCursor && !celebration) {
            const region = mapData.regions.find((r) => r.id === regionUnderCursor)
            if (region) {
              handleRegionClickWithCelebration(regionUnderCursor, region.name)
            }
          }
        }
      }
    },
    [
      isPinching,
      detectRegions,
      mapData.regions,
      handleRegionClickWithCelebration,
      celebration,
      displayViewBox,
      zoomSpring,
    ]
  )

  // Helper to select the region at the crosshairs (center of magnifier view)
  const selectRegionAtCrosshairs = useCallback(() => {
    if (!cursorPositionRef.current || !svgRef.current || !containerRef.current) return

    // Run region detection at the current cursor position (center of magnifier)
    const { regionUnderCursor } = detectRegions(
      cursorPositionRef.current.x,
      cursorPositionRef.current.y
    )

    if (regionUnderCursor && !celebration) {
      const region = mapData.regions.find((r) => r.id === regionUnderCursor)
      if (region) {
        handleRegionClickWithCelebration(regionUnderCursor, region.name)
      }
    }

    // Dismiss magnifier after selection attempt
    dismissMagnifier()
  }, [
    detectRegions,
    mapData.regions,
    handleRegionClickWithCelebration,
    celebration,
    dismissMagnifier,
  ])

  return (
    <div
      ref={containerRef}
      data-component="map-renderer"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleContainerClick}
      onTouchStart={handleMapTouchStart}
      onTouchMove={handleMapTouchMove}
      onTouchEnd={handleMapTouchEnd}
      className={css({
        position: fillContainer ? 'absolute' : 'relative',
        top: fillContainer ? 0 : undefined,
        left: fillContainer ? 0 : undefined,
        right: fillContainer ? 0 : undefined,
        bottom: fillContainer ? 0 : undefined,
        width: '100%',
        height: '100%',
        flex: fillContainer ? undefined : 1, // Fill available space in parent flex container
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Prevent text selection during drag operations
        userSelect: 'none',
        // Disable all default touch gestures - we handle touch events ourselves
        touchAction: 'none',
        // Prevent pull-to-refresh on mobile
        overscrollBehavior: 'none',
      })}
      style={{
        // Vendor-prefixed properties for text selection prevention (not supported in Panda CSS)
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
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
          const isCelebrating = celebration?.regionId === region.id

          // Special styling for excluded regions (grayed out, pre-labeled)
          // Bright gold flash for give up reveal, celebration, and hint
          const fill = isCelebrating
            ? `rgba(255, 215, 0, ${0.7 + celebrationFlashProgress * 0.3})` // Bright gold celebration flash
            : isBeingRevealed
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

          // Revealed/celebrating region gets a prominent stroke
          // Unfound regions get thicker borders for better visibility against sea
          const stroke = isCelebrating
            ? `rgba(255, 180, 0, ${0.8 + celebrationFlashProgress * 0.2})` // Gold stroke for celebration
            : isBeingRevealed
              ? `rgba(255, 140, 0, ${0.8 + giveUpFlashProgress * 0.2})` // Orange stroke for contrast
              : getRegionStroke(isFound, isDark)
          const strokeWidth = isCelebrating ? 4 : isBeingRevealed ? 3 : isFound ? 1 : 1.5

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
              {/* Glow effect for celebration - bright gold pulsing */}
              {isCelebrating && (
                <path
                  d={region.path}
                  fill={`rgba(255, 215, 0, ${0.2 + celebrationFlashProgress * 0.4})`}
                  stroke={`rgba(255, 215, 0, ${0.4 + celebrationFlashProgress * 0.6})`}
                  strokeWidth={10}
                  vectorEffect="non-scaling-stroke"
                  style={{ filter: 'blur(6px)' }}
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
                  if (!isExcluded && !celebration) {
                    handleRegionClickWithCelebration(region.id, region.name)
                  }
                }} // Disable clicks on excluded regions and during celebration
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
        {effectiveShowDebugBoundingBoxes &&
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
              // Calculate leftover dimensions for magnifier sizing
              const leftoverW =
                containerRect.width - SAFE_ZONE_MARGINS.left - SAFE_ZONE_MARGINS.right
              const leftoverH =
                containerRect.height - SAFE_ZONE_MARGINS.top - SAFE_ZONE_MARGINS.bottom
              const { width: magnifiedWidth } = getAdjustedMagnifiedDimensions(
                viewBoxWidth,
                viewBoxHeight,
                zoom,
                leftoverW,
                leftoverH
              )
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
              // Calculate leftover dimensions for magnifier sizing
              const leftoverW =
                containerRect.width - SAFE_ZONE_MARGINS.left - SAFE_ZONE_MARGINS.right
              const leftoverH =
                containerRect.height - SAFE_ZONE_MARGINS.top - SAFE_ZONE_MARGINS.bottom
              const { height: magnifiedHeight } = getAdjustedMagnifiedDimensions(
                viewBoxWidth,
                viewBoxHeight,
                zoom,
                leftoverW,
                leftoverH
              )
              return cursorSvgY - magnifiedHeight / 2
            })}
            width={zoomSpring.to((zoom: number) => {
              const containerRect = containerRef.current!.getBoundingClientRect()
              const viewBoxParts = displayViewBox.split(' ').map(Number)
              const viewBoxWidth = viewBoxParts[2] || 1000
              const viewBoxHeight = viewBoxParts[3] || 1000
              // Calculate leftover dimensions for magnifier sizing
              const leftoverW =
                containerRect.width - SAFE_ZONE_MARGINS.left - SAFE_ZONE_MARGINS.right
              const leftoverH =
                containerRect.height - SAFE_ZONE_MARGINS.top - SAFE_ZONE_MARGINS.bottom
              const { width } = getAdjustedMagnifiedDimensions(
                viewBoxWidth,
                viewBoxHeight,
                zoom,
                leftoverW,
                leftoverH
              )
              return width
            })}
            height={zoomSpring.to((zoom: number) => {
              const containerRect = containerRef.current!.getBoundingClientRect()
              const viewBoxParts = displayViewBox.split(' ').map(Number)
              const viewBoxWidth = viewBoxParts[2] || 1000
              const viewBoxHeight = viewBoxParts[3] || 1000
              // Calculate leftover dimensions for magnifier sizing
              const leftoverW =
                containerRect.width - SAFE_ZONE_MARGINS.left - SAFE_ZONE_MARGINS.right
              const leftoverH =
                containerRect.height - SAFE_ZONE_MARGINS.top - SAFE_ZONE_MARGINS.bottom
              const { height } = getAdjustedMagnifiedDimensions(
                viewBoxWidth,
                viewBoxHeight,
                zoom,
                leftoverW,
                leftoverH
              )
              return height
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
              onClick={() =>
                !celebration && handleRegionClickWithCelebration(label.regionId, label.regionName)
              }
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
      {effectiveShowDebugBoundingBoxes &&
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
      {pointerLocked && cursorPosition && (
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
              {/* Hot/cold feedback emoji - shows temperature when enabled */}
              {effectiveHotColdEnabled && hotColdFeedbackType && (
                <span
                  style={{
                    fontSize: '14px',
                    marginRight: '2px',
                  }}
                  title={`Hot/cold: ${hotColdFeedbackType}`}
                >
                  {getHotColdEmoji(hotColdFeedbackType)}
                </span>
              )}
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
      )}

      {/* Magnifier overlay - centers on cursor position */}
      {(() => {
        if (!cursorPosition || !svgRef.current || !containerRef.current) {
          return null
        }

        // Calculate magnifier size based on leftover rectangle (area not covered by UI)
        const containerRect = containerRef.current.getBoundingClientRect()
        const leftoverWidth = containerRect.width - SAFE_ZONE_MARGINS.left - SAFE_ZONE_MARGINS.right
        const leftoverHeight =
          containerRect.height - SAFE_ZONE_MARGINS.top - SAFE_ZONE_MARGINS.bottom

        // When expanded (during/after pinch-to-zoom), use full leftover area
        // Otherwise use the normal calculated dimensions
        const { width: normalWidth, height: normalHeight } = getMagnifierDimensions(
          leftoverWidth,
          leftoverHeight
        )
        const magnifierWidthPx = isMagnifierExpanded ? leftoverWidth : normalWidth
        const magnifierHeightPx = isMagnifierExpanded ? leftoverHeight : normalHeight

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
              // When expanded, position at top-left of leftover area; otherwise use animated positioning
              top: isMagnifierExpanded ? SAFE_ZONE_MARGINS.top : magnifierSpring.top,
              left: isMagnifierExpanded ? SAFE_ZONE_MARGINS.left : magnifierSpring.left,
              width: magnifierWidthPx,
              height: magnifierHeightPx,
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

                // Magnified view: adjust dimensions to match magnifier container aspect ratio
                // This eliminates letterboxing and ensures outline matches what's visible
                // Use leftover dimensions for magnifier sizing
                const leftoverW =
                  containerRect.width - SAFE_ZONE_MARGINS.left - SAFE_ZONE_MARGINS.right
                const leftoverH =
                  containerRect.height - SAFE_ZONE_MARGINS.top - SAFE_ZONE_MARGINS.bottom
                const { width: magnifiedWidth, height: magnifiedHeight } =
                  getAdjustedMagnifiedDimensions(
                    viewBoxWidth,
                    viewBoxHeight,
                    zoom,
                    leftoverW,
                    leftoverH
                  )

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

                  // Calculate leftover rectangle dimensions
                  const leftoverWidth =
                    containerRect.width - SAFE_ZONE_MARGINS.left - SAFE_ZONE_MARGINS.right
                  const leftoverHeight =
                    containerRect.height - SAFE_ZONE_MARGINS.top - SAFE_ZONE_MARGINS.bottom

                  const { width: magnifierWidth } = getMagnifierDimensions(
                    leftoverWidth,
                    leftoverHeight
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
                  // Only show disabled effect when precision mode is available but not active
                  if (
                    canUsePrecisionMode &&
                    isAboveThreshold(screenPixelRatio, PRECISION_MODE_THRESHOLD)
                  ) {
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
                const isCelebrating = celebration?.regionId === region.id

                // Bright gold flash for celebration and give up reveal in magnifier too
                const fill = isCelebrating
                  ? `rgba(255, 215, 0, ${0.7 + celebrationFlashProgress * 0.3})`
                  : isBeingRevealed
                    ? `rgba(255, 200, 0, ${0.6 + giveUpFlashProgress * 0.4})`
                    : isFound && playerId
                      ? `url(#player-pattern-${playerId})`
                      : getRegionColor(region.id, isFound, hoveredRegion === region.id, isDark)

                // During give-up animation, dim all non-revealed regions
                const dimmedOpacity = isGiveUpAnimating && !isBeingRevealed ? 0.25 : 1

                // Revealed/celebrating region gets a prominent stroke
                // Unfound regions get thicker borders for better visibility against sea
                const stroke = isCelebrating
                  ? `rgba(255, 180, 0, ${0.8 + celebrationFlashProgress * 0.2})`
                  : isBeingRevealed
                    ? `rgba(255, 140, 0, ${0.8 + giveUpFlashProgress * 0.2})`
                    : getRegionStroke(isFound, isDark)
                const strokeWidth = isCelebrating ? 3 : isBeingRevealed ? 2 : isFound ? 0.5 : 1

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
                    {/* Glow effect for celebrating region in magnifier */}
                    {isCelebrating && (
                      <path
                        d={region.path}
                        fill={`rgba(255, 215, 0, ${0.2 + celebrationFlashProgress * 0.4})`}
                        stroke={`rgba(255, 215, 0, ${0.4 + celebrationFlashProgress * 0.6})`}
                        strokeWidth={8}
                        vectorEffect="non-scaling-stroke"
                        style={{ filter: 'blur(4px)' }}
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

                // Calculate leftover rectangle dimensions
                const leftoverWidth =
                  containerRect.width - SAFE_ZONE_MARGINS.left - SAFE_ZONE_MARGINS.right
                const leftoverHeight =
                  containerRect.height - SAFE_ZONE_MARGINS.top - SAFE_ZONE_MARGINS.bottom

                const { width: magnifierWidth } = getMagnifierDimensions(
                  leftoverWidth,
                  leftoverHeight
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
              {effectiveShowDebugBoundingBoxes &&
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
            {effectiveShowDebugBoundingBoxes &&
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

                        // Calculate leftover rectangle dimensions
                        const leftoverWidth =
                          containerRect.width - SAFE_ZONE_MARGINS.left - SAFE_ZONE_MARGINS.right
                        const leftoverHeight =
                          containerRect.height - SAFE_ZONE_MARGINS.top - SAFE_ZONE_MARGINS.bottom

                        // Magnifier dimensions based on leftover rectangle
                        const { width: magnifierWidth } = getMagnifierDimensions(
                          leftoverWidth,
                          leftoverHeight
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

                        // Calculate leftover rectangle dimensions
                        const leftoverWidth =
                          containerRect.width - SAFE_ZONE_MARGINS.left - SAFE_ZONE_MARGINS.right
                        const leftoverHeight =
                          containerRect.height - SAFE_ZONE_MARGINS.top - SAFE_ZONE_MARGINS.bottom

                        // Magnifier dimensions based on leftover rectangle
                        const { width: magnifierWidth, height: magnifierHeight } =
                          getMagnifierDimensions(leftoverWidth, leftoverHeight)

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

                // Calculate leftover rectangle dimensions
                const leftoverWidth =
                  containerRect.width - SAFE_ZONE_MARGINS.left - SAFE_ZONE_MARGINS.right
                const leftoverHeight =
                  containerRect.height - SAFE_ZONE_MARGINS.top - SAFE_ZONE_MARGINS.bottom

                const { width: magnifierWidth } = getMagnifierDimensions(
                  leftoverWidth,
                  leftoverHeight
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
                // Only show precision mode message when precision mode is available
                if (
                  canUsePrecisionMode &&
                  isAboveThreshold(screenPixelRatio, PRECISION_MODE_THRESHOLD)
                ) {
                  return 'Click to activate precision mode'
                }

                // Below threshold - show debug info in dev, simple zoom in prod
                if (effectiveShowMagnifierDebugInfo) {
                  return `${z.toFixed(1)}× | ${screenPixelRatio.toFixed(1)} px/px`
                }

                return `${z.toFixed(1)}×`
              })}
            </animated.div>

            {/* Scrim overlay - shows when at threshold to indicate barrier */}
            {/* Only show scrim when precision mode is available */}
            {!pointerLocked &&
              canUsePrecisionMode &&
              (() => {
                const containerRect = containerRef.current?.getBoundingClientRect()
                const svgRect = svgRef.current?.getBoundingClientRect()
                if (!containerRect || !svgRect) return null

                // Calculate leftover rectangle dimensions
                const leftoverWidth =
                  containerRect.width - SAFE_ZONE_MARGINS.left - SAFE_ZONE_MARGINS.right
                const leftoverHeight =
                  containerRect.height - SAFE_ZONE_MARGINS.top - SAFE_ZONE_MARGINS.bottom

                const { width: magnifierWidth } = getMagnifierDimensions(
                  leftoverWidth,
                  leftoverHeight
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

            {/* Expand to fullscreen button - top-right corner (mobile only, when not expanded) */}
            {!pointerLocked && isTouchDevice && !isMagnifierExpanded && (
              <button
                type="button"
                data-action="toggle-magnifier-fullscreen"
                onTouchStart={(e) => {
                  // Stop touch events from bubbling to magnifier handlers
                  e.stopPropagation()
                }}
                onTouchEnd={(e) => {
                  // Stop touch events and handle the action
                  e.stopPropagation()
                  e.preventDefault() // Prevent click event from also firing
                  setIsMagnifierExpanded(true)
                }}
                onClick={(e) => {
                  // Fallback for non-touch interactions
                  e.stopPropagation()
                  setIsMagnifierExpanded(true)
                }}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isDark ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: isDark ? '#60a5fa' : '#3b82f6',
                  fontSize: '14px',
                  padding: 0,
                }}
                title="Expand to fullscreen"
              >
                {/* Expand icon (arrows pointing outward) */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
            )}

            {/* Mobile Select button - inside magnifier, bottom-right corner (touch devices only) */}
            {isTouchDevice &&
              mobileMapDragTriggeredMagnifier &&
              !isMobileMapDragging &&
              !isMagnifierDragging &&
              (() => {
                // Button is disabled if no region under crosshairs or region already found
                const isSelectDisabled = !hoveredRegion || regionsFound.includes(hoveredRegion)

                return (
                  <button
                    type="button"
                    data-action="mobile-select-region"
                    disabled={isSelectDisabled}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      if (!isSelectDisabled) selectRegionAtCrosshairs()
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!isSelectDisabled) selectRegionAtCrosshairs()
                    }}
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      padding: '10px 20px',
                      background: isSelectDisabled
                        ? 'linear-gradient(135deg, #9ca3af, #6b7280)'
                        : 'linear-gradient(135deg, #22c55e, #16a34a)',
                      border: 'none',
                      borderTopLeftRadius: '12px',
                      borderBottomRightRadius: '10px', // Match magnifier border radius minus border
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      cursor: isSelectDisabled ? 'not-allowed' : 'pointer',
                      touchAction: 'none',
                      boxShadow: isSelectDisabled
                        ? 'inset 0 1px 0 rgba(255,255,255,0.2)'
                        : 'inset 0 1px 0 rgba(255,255,255,0.3)',
                      opacity: isSelectDisabled ? 0.7 : 1,
                    }}
                  >
                    Select
                  </button>
                )
              })()}

            {/* Full Map button - inside magnifier, bottom-left corner (touch devices only, when expanded) */}
            {isTouchDevice && isMagnifierExpanded && mobileMapDragTriggeredMagnifier && (
              <button
                type="button"
                data-action="exit-magnifier-fullscreen"
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  setIsMagnifierExpanded(false)
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setIsMagnifierExpanded(false)
                }}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #6b7280, #4b5563)',
                  border: 'none',
                  borderTopRightRadius: '12px',
                  borderBottomLeftRadius: '10px', // Match magnifier border radius minus border
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  touchAction: 'none',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
                }}
              >
                Full Map
              </button>
            )}
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

        // Calculate leftover rectangle dimensions (area not covered by UI elements)
        const leftoverWidth = containerRect.width - SAFE_ZONE_MARGINS.left - SAFE_ZONE_MARGINS.right
        const leftoverHeight =
          containerRect.height - SAFE_ZONE_MARGINS.top - SAFE_ZONE_MARGINS.bottom

        // Get magnifier dimensions based on leftover rectangle (responsive to its aspect ratio)
        const { width: magnifierWidth, height: magnifierHeight } = getMagnifierDimensions(
          leftoverWidth,
          leftoverHeight
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
        // Use adjusted dimensions to match magnifier aspect ratio
        const { width: indicatorWidth, height: indicatorHeight } = getAdjustedMagnifiedDimensions(
          viewBoxWidth,
          viewBoxHeight,
          currentZoom,
          leftoverWidth,
          leftoverHeight
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
      {effectiveShowMagnifierDebugInfo && cursorPosition && containerRef.current && (
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

      {/* Dev-only crop tool for getting custom viewBox coordinates */}
      <DevCropTool
        svgRef={svgRef}
        containerRef={containerRef}
        viewBox={displayViewBox}
        mapId={selectedMap}
        continentId={selectedContinent}
      />

      {/* Debug overlay showing safe zone rectangles */}
      {effectiveShowSafeZoneDebug &&
        fillContainer &&
        (() => {
          // Calculate the leftover rectangle (viewport minus margins)
          const leftoverRect = {
            left: SAFE_ZONE_MARGINS.left,
            top: SAFE_ZONE_MARGINS.top,
            width: svgDimensions.width - SAFE_ZONE_MARGINS.left - SAFE_ZONE_MARGINS.right,
            height: svgDimensions.height - SAFE_ZONE_MARGINS.top - SAFE_ZONE_MARGINS.bottom,
          }

          // Calculate where the crop region appears in viewport pixels
          // Using the display viewBox to map SVG coords to pixels
          const viewBox = parseViewBox(displayViewBox)

          // Use custom crop if defined, otherwise use the full original map bounds (same as displayViewBox logic)
          const originalBounds = parseViewBox(mapData.originalViewBox)
          const cropRegion = mapData.customCrop ? parseViewBox(mapData.customCrop) : originalBounds
          const isCustomCrop = !!mapData.customCrop

          // With preserveAspectRatio="xMidYMid meet", the SVG is letterboxed
          // Calculate the actual scale and offset
          const scaleX = svgDimensions.width / viewBox.width
          const scaleY = svgDimensions.height / viewBox.height
          const actualScale = Math.min(scaleX, scaleY) // "meet" uses the smaller scale

          // Calculate letterbox offsets (the SVG content is centered)
          const renderedWidth = viewBox.width * actualScale
          const renderedHeight = viewBox.height * actualScale
          const offsetX = (svgDimensions.width - renderedWidth) / 2
          const offsetY = (svgDimensions.height - renderedHeight) / 2

          // SVG point (x, y) -> pixel, accounting for letterboxing
          const svgToPixelX = (x: number) => offsetX + (x - viewBox.x) * actualScale
          const svgToPixelY = (y: number) => offsetY + (y - viewBox.y) * actualScale

          const cropPixelRect = {
            left: svgToPixelX(cropRegion.x),
            top: svgToPixelY(cropRegion.y),
            width: cropRegion.width * actualScale,
            height: cropRegion.height * actualScale,
          }

          return (
            <>
              {/* Leftover rectangle (safe zone where crop should fit) - GREEN */}
              <div
                data-element="debug-leftover-rect"
                style={{
                  position: 'absolute',
                  left: leftoverRect.left,
                  top: leftoverRect.top,
                  width: leftoverRect.width,
                  height: leftoverRect.height,
                  border: '3px dashed rgba(0, 255, 0, 0.8)',
                  backgroundColor: 'rgba(0, 255, 0, 0.05)',
                  pointerEvents: 'none',
                  zIndex: 9999,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    left: 4,
                    background: 'rgba(0, 255, 0, 0.9)',
                    color: 'black',
                    padding: '2px 6px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    borderRadius: '3px',
                  }}
                >
                  LEFTOVER ({Math.round(leftoverRect.width)}×{Math.round(leftoverRect.height)})
                </span>
              </div>

              {/* Crop region mapped to pixels - RED for custom, ORANGE for full map */}
              <div
                data-element="debug-crop-rect"
                style={{
                  position: 'absolute',
                  left: cropPixelRect.left,
                  top: cropPixelRect.top,
                  width: cropPixelRect.width,
                  height: cropPixelRect.height,
                  border: `3px ${isCustomCrop ? 'solid' : 'dashed'} ${isCustomCrop ? 'rgba(255, 0, 0, 0.8)' : 'rgba(255, 165, 0, 0.8)'}`,
                  backgroundColor: isCustomCrop
                    ? 'rgba(255, 0, 0, 0.05)'
                    : 'rgba(255, 165, 0, 0.05)',
                  pointerEvents: 'none',
                  zIndex: 9998,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    right: 4,
                    background: isCustomCrop ? 'rgba(255, 0, 0, 0.9)' : 'rgba(255, 165, 0, 0.9)',
                    color: isCustomCrop ? 'white' : 'black',
                    padding: '2px 6px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    borderRadius: '3px',
                  }}
                >
                  {isCustomCrop ? 'CROP' : 'FULL MAP'} ({Math.round(cropPixelRect.width)}×
                  {Math.round(cropPixelRect.height)})
                </span>
              </div>

              {/* Info panel showing calculations */}
              <div
                data-element="debug-safe-zone-info"
                style={{
                  position: 'absolute',
                  bottom: 10,
                  left: 10,
                  background: 'rgba(0, 0, 0, 0.85)',
                  color: 'white',
                  padding: '8px 12px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  borderRadius: '6px',
                  pointerEvents: 'none',
                  zIndex: 9999,
                  lineHeight: 1.4,
                }}
              >
                <div>
                  <strong>Safe Zone Debug</strong>
                </div>
                <div>
                  Viewport: {Math.round(svgDimensions.width)}×{Math.round(svgDimensions.height)}
                </div>
                <div>
                  Margins: T={SAFE_ZONE_MARGINS.top} R={SAFE_ZONE_MARGINS.right} B=
                  {SAFE_ZONE_MARGINS.bottom} L={SAFE_ZONE_MARGINS.left}
                </div>
                <div style={{ color: '#0f0' }}>
                  Leftover: {Math.round(leftoverRect.width)}×{Math.round(leftoverRect.height)}
                </div>
                <div style={{ color: isCustomCrop ? '#f00' : '#ffa500' }}>
                  {isCustomCrop ? 'Crop' : 'Full Map'} (px): {Math.round(cropPixelRect.width)}×
                  {Math.round(cropPixelRect.height)}
                </div>
                <div>ViewBox: {displayViewBox}</div>
              </div>
            </>
          )
        })()}

      {/* Celebration overlay - shows confetti and sound when region is found */}
      {celebration && (
        <CelebrationOverlay
          celebration={celebration}
          regionCenter={getCelebrationRegionCenter()}
          onComplete={handleCelebrationComplete}
          reducedMotion={false}
        />
      )}
    </div>
  )
}
