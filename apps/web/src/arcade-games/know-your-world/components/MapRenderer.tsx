'use client'

import { animated, to, useSpring } from '@react-spring/web'
import { css } from '@styled/css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useVisualDebugSafe } from '@/contexts/VisualDebugContext'
import type { ContinentId } from '../continents'
import { useCelebrationAnimation } from '../features/celebration'
import { useCrosshairRotation } from '../features/crosshair'
import { CustomCursor, HeatCrosshair } from '../features/cursor'
import { AutoZoomDebugOverlay, HotColdDebugPanel, SafeZoneDebugOverlay } from '../features/debug'
import { type MapGameContextValue, MapGameProvider } from '../features/game'
import { useHintAnimation } from '../features/hint'
import {
  calculatePointerLockMovement,
  checkDragThreshold,
  useInteractionStateMachine,
} from '../features/interaction'
import { getRenderedViewport, LabelLayer, useD3ForceLabels } from '../features/labels'
import {
  applyPanDelta,
  calculateTouchMultiplier,
  clampToSvgBounds,
  getAdjustedMagnifiedDimensions,
  getMagnifierDimensions,
  type MagnifierContextValue,
  MagnifierCrosshair,
  MagnifierOverlayWithHandlers,
  MagnifierPixelGrid,
  MagnifierProvider,
  MagnifierRegions,
  parseViewBoxDimensions,
  type UseMagnifierTouchHandlersOptions,
  useMagnifierState,
  useMagnifierStyle,
  ZoomLinesOverlay,
} from '../features/magnifier'
import { NetworkCursors } from '../features/multiplayer'
import { usePrecisionCalculations } from '../features/precision'
import { useGiveUpReveal } from '../features/reveal'
import { useGameSettings } from '../features/settings'
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
import { getRegionColor, getRegionStroke } from '../mapColors'
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
import { CELEBRATION_TIMING, classifyCelebration } from '../utils/celebration'
import {
  calculateMaxZoomAtThreshold,
  calculateScreenPixelRatio,
  isAboveThreshold,
} from '../utils/screenPixelRatio'
import { CelebrationOverlay } from './CelebrationOverlay'
import { DevCropTool } from './DevCropTool'
import { RegionPath } from './RegionPath'
import { RegionRenderProvider } from './RegionRenderContext'

// Debug flag: show technical info in magnifier (gated by isVisualDebugEnabled at runtime)
const SHOW_MAGNIFIER_DEBUG_INFO = true

// Debug flag: show bounding boxes with importance scores (gated by isVisualDebugEnabled at runtime)
const SHOW_DEBUG_BOUNDING_BOXES = true

// Debug flag: show safe zone rectangles (gated by isVisualDebugEnabled at runtime)
const SHOW_SAFE_ZONE_DEBUG = true

// Precision mode threshold: screen pixel ratio that triggers pointer lock recommendation
const PRECISION_MODE_THRESHOLD = 20

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
  // Keyed by userId (session ID) to support multiple devices in coop mode
  otherPlayerCursors?: Record<
    string,
    {
      x: number
      y: number
      playerId: string
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
    puzzlePieceTarget,
    setPuzzlePieceTarget,
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

  // Visual debug mode from global context (enabled when user toggles it on, in dev or with ?debug=1)
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
  // Note: hoveredRegion and setHoveredRegion are no longer used from this hook
  // State machine (interaction.hoveredRegionId) is now authoritative for hovered region
  const { detectRegions } = useRegionDetection({
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

  // Device capability hooks for adaptive UI
  const isTouchDevice = useIsTouchDevice() // For touch-specific UI (magnifier expansion)
  const canUsePrecisionMode = useCanUsePrecisionMode() // For precision mode UI/behavior
  const hasAnyFinePointer = useHasAnyFinePointer() // For hot/cold feedback visibility

  // Interaction state machine - replaces scattered boolean flags with explicit states
  const interaction = useInteractionStateMachine({
    initialMode: isTouchDevice ? 'mobile' : 'desktop',
  })

  // Sync state machine mode with isTouchDevice after hydration
  // isTouchDevice returns false during SSR, then changes to true after hydration on touch devices
  useEffect(() => {
    const targetMode = isTouchDevice ? 'mobile' : 'desktop'
    if (interaction.state.mode !== targetMode) {
      interaction.setMode(targetMode)
    }
  }, [isTouchDevice, interaction])

  // Derive boolean flags from state machine for compatibility with existing code
  // State machine is the SINGLE SOURCE OF TRUTH for interaction state
  const isReleasingPointerLock = interaction.isReleasingPointerLock
  const isDesktopMapDragging = interaction.isDesktopDragging
  const isMobileMapDragging = interaction.isMapPanning
  const mobileMapDragTriggeredMagnifier = interaction.magnifierTriggeredByDrag
  // NOTE: isPinching and isMagnifierDragging should come from state machine,
  // but currently still duplicated in useMagnifierState. Using state machine values here.
  const isPinchingFromMachine = interaction.isPinching
  const isMagnifierDraggingFromMachine = interaction.isMagnifierDragging
  // Cursor position from state machine - authoritative source for render
  // (cursorPositionRef is still used for synchronous access in event handlers)
  const cursorPositionFromMachine = interaction.cursorPosition
  // Shadow the old cursorPosition variable - state machine is now authoritative for render
  const cursorPosition = cursorPositionFromMachine
  // Hovered region from state machine - authoritative source for render
  const hoveredRegionFromMachine = interaction.hoveredRegionId
  // Shadow the old hoveredRegion variable - state machine is now authoritative
  const hoveredRegion = hoveredRegionFromMachine

  // Setter for hoveredRegion - dispatches to state machine
  // Used by RegionPath mouse handlers and MagnifierRegions onHover
  const setHoveredRegion = useCallback(
    (regionId: string | null) => {
      // Dispatch MOUSE_MOVE with just regionId (no position change)
      // This updates hoveredRegion/touchedRegion in the state machine
      // The state machine handles mobile vs desktop mode internally
      if (isTouchDevice) {
        interaction.dispatch({
          type: 'TOUCH_MOVE',
          position: cursorPositionRef.current ?? { x: 0, y: 0 },
          touchCount: 1,
          regionId,
        })
      } else {
        interaction.dispatch({
          type: 'MOUSE_MOVE',
          position: cursorPositionRef.current ?? { x: 0, y: 0 },
          regionId,
        })
      }
    },
    [interaction, isTouchDevice]
  )

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
    // Note: isReleasingPointerLock now managed by interaction state machine
    // The POINTER_LOCK_RELEASED event is dispatched via useEffect sync
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

  // Precision mode calculations (no circular dependency - receives state as inputs)
  const precisionCalcs = usePrecisionCalculations({
    containerRef,
    svgRef,
    viewBox: mapData.viewBox,
    currentZoom: targetZoom,
    pointerLocked,
  })

  // Sync pointer lock state to interaction state machine
  // This dispatches events when the native pointer lock state changes
  const prevPointerLockedRef = useRef(pointerLocked)
  useEffect(() => {
    if (pointerLocked !== prevPointerLockedRef.current) {
      if (pointerLocked) {
        interaction.dispatch({ type: 'POINTER_LOCK_ACQUIRED' })
      } else if (prevPointerLockedRef.current) {
        // Only dispatch if we were previously locked (not on initial mount)
        interaction.dispatch({ type: 'POINTER_LOCK_RELEASED' })
      }
      prevPointerLockedRef.current = pointerLocked
    }
  }, [pointerLocked, interaction])

  const [svgDimensions, setSvgDimensions] = useState({
    width: 1000,
    height: 500,
  })
  // cursorPosition now comes from state machine (cursorPositionFromMachine defined below)
  // The useState was removed as part of state machine migration

  // Magnifier state (consolidated hook)
  const magnifierState = useMagnifierState()
  // showMagnifier is now computed below based on device type:
  // - Mobile: derived from interaction.isMagnifierActive (state machine is authoritative)
  // - Desktop: computed from multiple sources (shift, drag, detection)
  // Legacy setShowMagnifier wrapper for compatibility during migration
  const setShowMagnifier = useCallback(
    (show: boolean) => {
      if (show) magnifierState.show()
      else magnifierState.hide()
    },
    [magnifierState]
  )
  // Destructure remaining magnifier state from hook
  // Note: isDragging/setDragging and isPinching/setPinching removed - state machine is authoritative
  const {
    targetOpacity,
    setTargetOpacity,
    isExpanded: isMagnifierExpanded,
    setExpanded: setIsMagnifierExpanded,
    touchStartRef: magnifierTouchStartRef,
    didMoveRef: magnifierDidMoveRef,
    pinchStartDistanceRef,
    pinchStartZoomRef,
  } = magnifierState

  // Compute showMagnifier based on device type:
  // - Mobile: state machine is authoritative (isMagnifierActive)
  // - Desktop: use magnifierState.isVisible (set by event handlers based on shouldShow logic)
  const showMagnifier = isTouchDevice ? interaction.isMagnifierActive : magnifierState.isVisible

  // Ref to magnifier element for tap position calculation
  const magnifierRef = useRef<HTMLDivElement>(null)
  // Where user tapped on magnifier
  const magnifierTapPositionRef = useRef<{ x: number; y: number } | null>(null)

  // Initialize magnifier position within the safe zone (below nav/floating UI)
  const [targetTop, setTargetTop] = useState(SAFE_ZONE_MARGINS.top)
  const [targetLeft, setTargetLeft] = useState(SAFE_ZONE_MARGINS.left + 20)
  const [smallestRegionSize, setSmallestRegionSize] = useState<number>(Infinity)
  // shiftPressed now comes from state machine (interaction.isShiftPressed)

  // Desktop click-and-drag magnifier state
  // Note: isDesktopMapDragging is derived from interaction state machine above
  const desktopDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const desktopDragDidMoveRef = useRef(false)
  // Track last drag position - magnifier stays visible until cursor moves threshold away
  const lastDragPositionRef = useRef<{ x: number; y: number } | null>(null)
  const DRAG_START_THRESHOLD = 5 // Pixels to move before counting as drag (not click)
  const MAGNIFIER_DISMISS_THRESHOLD = 50 // Pixels to move away from last drag pos to dismiss

  // Track whether current target region needs magnification
  const [targetNeedsMagnification, setTargetNeedsMagnification] = useState(false)

  // Mobile map drag state - now derived from state machine (interaction.isMapPanning)
  // Note: isMobileMapDragging and mobileMapDragTriggeredMagnifier are defined at line ~344 from state machine
  const mapTouchStartRef = useRef<{ x: number; y: number } | null>(null)
  const MOBILE_DRAG_THRESHOLD = 10 // pixels before we consider it a drag
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

  // Give up reveal animation (extracted hook)
  const { giveUpFlashProgress, isGiveUpAnimating, giveUpZoomTarget } = useGiveUpReveal({
    giveUpReveal,
    svgRef,
    containerRef,
    fillContainer,
  })

  // Hint animation (extracted hook)
  const { hintFlashProgress, isHintAnimating } = useHintAnimation({ hintActive })

  // Celebration animation (extracted hook)
  const { celebrationFlashProgress } = useCelebrationAnimation({ celebration })
  const pendingCelebrationClick = useRef<{ regionId: string; regionName: string } | null>(null)

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
  // Get hint for current region (if available) - with cycling support
  const {
    currentHint: hintText,
    hintIndex,
    totalHints,
    nextHint,
    hasMoreHints,
  } = useRegionHint(hintMapKey, currentPrompt)
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
    speak,
    speakWithRegionName,
    stop: stopSpeaking,
    isSpeaking,
    isSupported: isSpeechSupported,
    hasAccentOption,
  } = useSpeakHint(hintMapKey, currentPrompt)

  // Game settings (localStorage persisted)
  const {
    autoSpeak,
    withAccent,
    autoHint,
    hotColdEnabled,
    effectiveHotColdEnabled,
    setAutoSpeak: handleAutoSpeakChange,
    setWithAccent: handleWithAccentChange,
    setAutoHint: handleAutoHintChange,
    setHotColdEnabled: handleHotColdChange,
    toggleAutoSpeak: handleAutoSpeakToggle,
    toggleWithAccent: handleWithAccentToggle,
    toggleAutoHint: handleAutoHintToggle,
    toggleHotCold: handleHotColdToggle,
    autoHintRef,
    autoSpeakRef,
    withAccentRef,
    hotColdEnabledRef,
  } = useGameSettings({
    assistanceLevel,
    assistanceAllowsHotCold,
  })

  // Whether hot/cold button should be shown at all
  // Shows on all devices - mobile uses magnifier for hot/cold feedback
  const showHotCold = isSpeechSupported && assistanceAllowsHotCold

  // Speak hint callback
  const handleSpeakClick = useCallback(() => {
    if (isSpeaking) {
      stopSpeaking()
    } else if (currentRegionName) {
      speakWithRegionName(currentRegionName, hintText, withAccent)
    }
  }, [isSpeaking, stopSpeaking, currentRegionName, hintText, speakWithRegionName, withAccent])

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
  // Note: autoHintRef, autoSpeakRef, withAccentRef, hotColdEnabledRef are provided by useGameSettings
  // Note: effectiveHotColdEnabled is also provided by useGameSettings

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

  // Part 1: Announce region name when a new prompt appears (takeover)
  // This speaks just the region name when the prompt changes, before hints unlock
  // Adds a delay after "You found" to give a breather before the next region
  const prevPromptForAnnouncementRef = useRef<string | null>(null)
  const lastFoundAnnouncementTimeRef = useRef<number>(0)
  const announcementTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    // Clear any pending announcement when prompt changes
    if (announcementTimeoutRef.current) {
      clearTimeout(announcementTimeoutRef.current)
      announcementTimeoutRef.current = null
    }

    // Only announce if:
    // 1. We have speech support
    // 2. We have a new prompt (different from previous)
    // 3. We have a region name
    if (!isSpeechSupported || !currentPrompt || !currentRegionName) {
      prevPromptForAnnouncementRef.current = currentPrompt
      return
    }

    // Check if this is a new prompt (not just re-render)
    if (currentPrompt === prevPromptForAnnouncementRef.current) {
      return
    }

    prevPromptForAnnouncementRef.current = currentPrompt

    // Calculate delay: give a breather after "You found" announcement
    // Wait at least 2 seconds after the last "You found" before announcing next region
    const MIN_DELAY_AFTER_FOUND = 2000
    const timeSinceLastFound = Date.now() - lastFoundAnnouncementTimeRef.current
    const delay = Math.max(0, MIN_DELAY_AFTER_FOUND - timeSinceLastFound)

    if (delay > 0) {
      // Schedule delayed announcement
      announcementTimeoutRef.current = setTimeout(() => {
        speakWithRegionName(currentRegionName, hintText, false)
        announcementTimeoutRef.current = null
      }, delay)
    } else {
      // No recent "You found", announce immediately
      speakWithRegionName(currentRegionName, hintText, false)
    }
  }, [currentPrompt, currentRegionName, hintText, isSpeechSupported, speakWithRegionName])

  // Part 2: Announce "You found {region}" at the START of part 2
  // - In learning mode: Triggered when puzzlePieceTarget is set (takeover fades back in)
  // - In other modes: Triggered when celebration is set (immediately after finding)
  // Uses just regionId as key to prevent double announcement (puzzle -> celebration transition)
  const prevFoundAnnouncementRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isSpeechSupported) return

    // Determine what to announce (prioritize puzzlePieceTarget for learning mode)
    const regionId = puzzlePieceTarget?.regionId ?? celebration?.regionId
    const regionName = puzzlePieceTarget?.regionName ?? celebration?.regionName

    if (regionId && regionName) {
      // Use just regionId as key - prevents double announcement when
      // puzzlePieceTarget transitions to celebration for the same region
      if (regionId !== prevFoundAnnouncementRef.current) {
        prevFoundAnnouncementRef.current = regionId
        speak(`You found ${regionName}`, false)
      }
    } else {
      // Reset when neither is active
      prevFoundAnnouncementRef.current = null
    }
  }, [puzzlePieceTarget, celebration, isSpeechSupported, speak])

  // Track when BOTH celebration starts AND "You found" speech finishes
  // The breather should only begin after both are complete
  const celebrationActiveRef = useRef(false)
  const waitingForSpeechToFinishRef = useRef(false)
  const prevIsSpeakingRef = useRef(false)

  // Track celebration state
  useEffect(() => {
    if (celebration) {
      celebrationActiveRef.current = true
      // If speech is currently happening, wait for it to finish
      if (isSpeaking) {
        waitingForSpeechToFinishRef.current = true
      } else {
        // Speech already done (or not speaking), record time now
        lastFoundAnnouncementTimeRef.current = Date.now()
      }
    } else {
      celebrationActiveRef.current = false
      waitingForSpeechToFinishRef.current = false
    }
  }, [celebration, isSpeaking])

  // Track when speech finishes - if we were waiting, record the time
  useEffect(() => {
    const speechJustFinished = prevIsSpeakingRef.current && !isSpeaking
    prevIsSpeakingRef.current = isSpeaking

    if (speechJustFinished && waitingForSpeechToFinishRef.current) {
      // Speech just finished and we were waiting for it
      lastFoundAnnouncementTimeRef.current = Date.now()
      waitingForSpeechToFinishRef.current = false
    }
  }, [isSpeaking])

  // Hot/cold audio feedback hook
  // Enabled if: 1) assistance level allows it, 2) user toggle is on
  // 3) either has fine pointer (desktop) OR magnifier/drag is active (mobile)
  // Use continent name for language lookup if available, otherwise use selectedMap
  const hotColdMapName = selectedContinent || selectedMap
  const {
    checkPosition: checkHotCold,
    reset: resetHotCold,
    lastFeedbackType: hotColdFeedbackType,
    getSearchMetrics,
  } = useHotColdFeedback({
    // In turn-based mode, only enable hot/cold for the player whose turn it is
    // Desktop: hasAnyFinePointer enables mouse-based hot/cold
    // Mobile: showMagnifier OR isMobileMapDragging enables touch-based hot/cold
    enabled:
      assistanceAllowsHotCold &&
      hotColdEnabled &&
      (hasAnyFinePointer || showMagnifier || isMobileMapDragging) &&
      (gameMode !== 'turn-based' || currentPlayer === localPlayerId),
    targetRegionId: currentPrompt,
    isSpeaking,
    mapName: hotColdMapName,
    regions: mapData.regions,
  })

  // Reset hot/cold feedback when prompt changes
  useEffect(() => {
    resetHotCold()
  }, [currentPrompt, resetHotCold])

  // Struggle detection: Give additional hints when user is having trouble
  // Thresholds for triggering next hint (must have more hints available)
  const STRUGGLE_TIME_THRESHOLD = 30000 // 30 seconds per hint level
  const STRUGGLE_CHECK_INTERVAL = 5000 // Check every 5 seconds
  const lastHintLevelRef = useRef(0) // Track which hint level triggered last hint

  useEffect(() => {
    // Only run if hot/cold is enabled (means we're tracking search metrics)
    if (!effectiveHotColdEnabled || !hasMoreHints || !currentPrompt) return

    const checkStruggle = () => {
      const metrics = getSearchMetrics(promptStartTime.current)

      // Calculate which hint level we should be at based on time
      // Level 0 = first 30 seconds, Level 1 = 30-60 seconds, etc.
      const expectedHintLevel = Math.floor(metrics.timeToFind / STRUGGLE_TIME_THRESHOLD)

      // If we should be at a higher hint level than last triggered, give next hint
      if (expectedHintLevel > lastHintLevelRef.current && hasMoreHints) {
        lastHintLevelRef.current = expectedHintLevel
        nextHint()
      }
    }

    const intervalId = setInterval(checkStruggle, STRUGGLE_CHECK_INTERVAL)

    return () => clearInterval(intervalId)
  }, [
    effectiveHotColdEnabled,
    hasMoreHints,
    currentPrompt,
    getSearchMetrics,
    nextHint,
    promptStartTime,
  ])

  // Reset hint level tracking when prompt changes
  useEffect(() => {
    lastHintLevelRef.current = 0
  }, [currentPrompt])

  // Speak new hint when it changes (due to cycling)
  const prevHintIndexRef = useRef(hintIndex)
  useEffect(() => {
    // Only speak if hint index actually changed (not initial render)
    if (
      hintIndex > prevHintIndexRef.current &&
      hintText &&
      isSpeechSupported &&
      currentRegionName
    ) {
      prevHintIndexRef.current = hintIndex
      // Speak just the hint (user already knows the region name)
      speak(hintText, false)
    } else if (hintIndex !== prevHintIndexRef.current) {
      prevHintIndexRef.current = hintIndex
    }
  }, [hintIndex, hintText, isSpeechSupported, currentRegionName, speak])

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
    console.log('[handleContainerClick] Called', {
      suppressNextClick: suppressNextClickRef.current,
      pointerLocked,
      isPointerLockSupported,
      target: (e.target as Element)?.tagName,
      currentTarget: (e.currentTarget as Element)?.tagName,
    })

    // If we just finished a drag, suppress this click (user was dragging, not clicking)
    if (suppressNextClickRef.current) {
      console.log('[handleContainerClick] Suppressed - drag just finished')
      suppressNextClickRef.current = false
      return
    }

    // Silently request pointer lock if not already locked (and supported)
    // This makes the first gameplay click also enable precision mode
    // On devices without pointer lock (iPad), skip this and process clicks normally
    if (!pointerLocked && isPointerLockSupported) {
      console.log('[handleContainerClick] Requesting pointer lock')
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

  // Parse the display viewBox once - used throughout for animation and calculations
  // This eliminates 24 redundant .split(' ').map(Number) calls per render
  const parsedViewBox = useMemo(() => {
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

    // Cursors are keyed by userId (session ID), playerId is in the position data
    Object.entries(otherPlayerCursors).forEach(([cursorUserId, position]) => {
      // Skip our own cursor (by viewerId) and null positions
      if (cursorUserId === viewerId || !position) return

      // In turn-based mode, only show hover when it's not our turn
      if (gameMode === 'turn-based' && currentPlayer === localPlayerId) return

      // Get player color from the playerId in the cursor data
      // First check playerMetadata, then fall back to memberPlayers (for remote players)
      let player = playerMetadata[position.playerId]
      if (!player) {
        // Player not in local playerMetadata - look through memberPlayers
        for (const players of Object.values(memberPlayers)) {
          const found = players.find((p) => p.id === position.playerId)
          if (found) {
            player = found
            break
          }
        }
      }
      if (!player) return

      // Use the transmitted hoveredRegionId directly (avoids hit-testing discrepancies
      // due to pixel scaling/rendering differences between clients)
      if (position.hoveredRegionId) {
        result[position.hoveredRegionId] = { playerId: position.playerId, color: player.color }
      }
    })

    return result
  }, [
    otherPlayerCursors,
    viewerId,
    gameMode,
    currentPlayer,
    localPlayerId,
    playerMetadata,
    memberPlayers,
  ])

  // giveUpZoomTarget now comes from useGiveUpReveal hook

  // Spring for main map zoom animation (used during give-up reveal)
  // Uses CSS transform for reliable animation instead of viewBox manipulation
  const mainMapSpring = useSpring({
    scale: giveUpZoomTarget.scale,
    translateX: giveUpZoomTarget.translateX,
    translateY: giveUpZoomTarget.translateY,
    config: { tension: 120, friction: 20 },
  })

  // Get crosshair heat styling from the REAL hot/cold feedback system (memoized)
  const {
    crosshairStyle: crosshairHeatStyle,
    borderStyle: magnifierBorderStyle,
    rotationSpeedDegPerSec: targetSpeedDegPerSec,
  } = useMagnifierStyle({
    feedbackType: hotColdFeedbackType,
    isDark,
    hotColdEnabled: effectiveHotColdEnabled,
  })

  // Crosshair rotation animation (spring-for-speed, manual-integration-for-angle pattern)
  const { rotationAngle } = useCrosshairRotation({
    targetSpeedDegPerSec,
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

  // Give up reveal animation is now handled by useGiveUpReveal hook
  // Hint animation is now handled by useHintAnimation hook
  // Celebration animation is now handled by useCelebrationAnimation hook

  // Handle celebration completion - call the actual click after animation
  const handleCelebrationComplete = useCallback(() => {
    console.log('[handleCelebrationComplete] Called', {
      pending: pendingCelebrationClick.current,
    })
    const pending = pendingCelebrationClick.current
    if (pending) {
      console.log('[handleCelebrationComplete] Clearing celebration and calling onRegionClick')
      // Clear celebration state (hook will reset flash progress automatically)
      setCelebration(null)
      // Then fire the actual click
      onRegionClick(pending.regionId, pending.regionName)
      pendingCelebrationClick.current = null
    } else {
      console.log('[handleCelebrationComplete] No pending click - nothing to do')
    }
  }, [setCelebration, onRegionClick])

  // Wrapper function to intercept clicks and trigger celebration for correct regions
  const handleRegionClickWithCelebration = useCallback(
    (regionId: string, regionName: string) => {
      console.log('[handleRegionClickWithCelebration] Called with:', {
        regionId,
        regionName,
        currentPrompt,
        celebration: celebration
          ? { regionId: celebration.regionId, type: celebration.type }
          : null,
        puzzlePieceTarget: puzzlePieceTarget ? { regionId: puzzlePieceTarget.regionId } : null,
      })
      // If we're already celebrating or puzzle piece animating, ignore clicks
      if (celebration || puzzlePieceTarget) {
        console.log('[handleRegionClickWithCelebration] Blocked - already celebrating or animating')
        return
      }

      // Check if this is the correct region
      if (regionId === currentPrompt) {
        // Correct! Calculate celebration type
        const metrics = getSearchMetrics(promptStartTime.current)
        const celebrationType = classifyCelebration(metrics)

        // Store pending click for after celebration
        pendingCelebrationClick.current = { regionId, regionName }

        // In Learning mode, show puzzle piece animation first
        if (assistanceLevel === 'learning' && svgRef.current) {
          // Query the actual DOM element to get its bounding boxes
          const pathElement = svgRef.current.querySelector(`path[data-region-id="${regionId}"]`)
          if (pathElement && pathElement instanceof SVGGraphicsElement) {
            // Get the actual screen bounding rect of the rendered path
            const pathRect = pathElement.getBoundingClientRect()
            // Get the SVG coordinate bounding box (for viewBox)
            const svgBBox = pathElement.getBBox()

            console.log('[PuzzlePiece] Direct DOM measurement:', {
              regionId,
              screenRect: {
                left: pathRect.left,
                top: pathRect.top,
                width: pathRect.width,
                height: pathRect.height,
              },
              svgBBox: {
                x: svgBBox.x,
                y: svgBBox.y,
                width: svgBBox.width,
                height: svgBBox.height,
              },
            })

            setPuzzlePieceTarget({
              regionId,
              regionName,
              celebrationType,
              // Target is the actual screen rect of the region on the map
              x: pathRect.left,
              y: pathRect.top,
              width: pathRect.width,
              height: pathRect.height,
              // SVG coordinate bounding box for correct viewBox
              svgBBox: {
                x: svgBBox.x,
                y: svgBBox.y,
                width: svgBBox.width,
                height: svgBBox.height,
              },
            })
          } else {
            // Fallback: start celebration immediately if path not found
            setCelebration({
              regionId,
              regionName,
              type: celebrationType,
              startTime: Date.now(),
            })
          }
        } else if (assistanceLevel === 'learning') {
          // Learning mode but refs not ready - start celebration immediately
          setCelebration({
            regionId,
            regionName,
            type: celebrationType,
            startTime: Date.now(),
          })
        } else {
          // Other modes: Start celebration immediately
          setCelebration({
            regionId,
            regionName,
            type: celebrationType,
            startTime: Date.now(),
          })
        }
      } else {
        // Wrong region - handle immediately
        onRegionClick(regionId, regionName)
      }
    },
    [
      celebration,
      puzzlePieceTarget,
      currentPrompt,
      getSearchMetrics,
      promptStartTime,
      setCelebration,
      setPuzzlePieceTarget,
      onRegionClick,
      assistanceLevel,
    ]
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
    const { x: viewBoxX, y: viewBoxY, width: viewBoxW, height: viewBoxH } = parsedViewBox
    const viewport = getRenderedViewport(svgRect, viewBoxX, viewBoxY, viewBoxW, viewBoxH)
    const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
    const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY

    // Get absolute screen position
    const screenX = containerRect.left + (region.center[0] - viewBoxX) * viewport.scale + svgOffsetX
    const screenY = containerRect.top + (region.center[1] - viewBoxY) * viewport.scale + svgOffsetY

    return { x: screenX, y: screenY }
  }, [celebration, mapData.regions, parsedViewBox])

  // Keyboard shortcuts - Shift for magnifier, H for hint
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.key === 'Shift' && !e.repeat) {
        interaction.dispatch({ type: 'SHIFT_KEY_DOWN' })
      }

      // 'H' key to toggle hint bubble
      if ((e.key === 'h' || e.key === 'H') && !e.repeat && hasHint) {
        setShowHintBubble((prev) => !prev)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        interaction.dispatch({ type: 'SHIFT_KEY_UP' })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [hasHint, interaction])

  // Use the labels feature module for D3 force-based label positioning
  const { labelPositions, smallRegionLabelPositions } = useD3ForceLabels({
    mapData,
    excludedRegions,
    excludedRegionIds,
    regionsFound,
    guessHistory,
    displayViewBox,
    svgDimensions,
    svgRef,
    containerRef,
    forceTuning,
  })

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

  // Use memoized viewBox dimensions for label offset calculations and sea background
  const { x: viewBoxX, y: viewBoxY, width: viewBoxWidth, height: viewBoxHeight } = parsedViewBox

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

    // Dispatch mouse down to state machine
    interaction.dispatch({ type: 'MOUSE_DOWN', position: { x: cursorX, y: cursorY } })

    desktopDragStartRef.current = { x: cursorX, y: cursorY }
    desktopDragDidMoveRef.current = false
  }

  // Track if we should suppress the next click (because user was dragging)
  const suppressNextClickRef = useRef(false)

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    // Dispatch mouse up to state machine
    interaction.dispatch({ type: 'MOUSE_UP' })

    // If user was dragging, save the last position for threshold-based dismissal
    // and suppress the click event that will follow
    if (isDesktopMapDragging && cursorPositionRef.current) {
      lastDragPositionRef.current = { ...cursorPositionRef.current }
      suppressNextClickRef.current = true
    }

    // Reset drag state (hasDragged reset handled by state machine via MOUSE_UP)
    desktopDragStartRef.current = null
    desktopDragDidMoveRef.current = false
  }

  // Handle mouse movement to track cursor and show magnifier when needed
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!svgRef.current || !containerRef.current) return

    // Don't process mouse movement during pointer lock release animation
    if (isReleasingPointerLock) return

    // Dispatch MOUSE_ENTER when cursor first enters (was null, now has position)
    if (!cursorPositionRef.current && interaction.state.mode === 'desktop') {
      interaction.dispatch({ type: 'MOUSE_ENTER' })
    }

    const containerRect = containerRef.current.getBoundingClientRect()
    const svgRect = svgRef.current.getBoundingClientRect()

    // Get cursor position relative to container
    let cursorX: number
    let cursorY: number

    if (pointerLocked) {
      // When pointer is locked, use movement deltas with precision multiplier
      const lastX = cursorPositionRef.current?.x ?? containerRect.width / 2
      const lastY = cursorPositionRef.current?.y ?? containerRect.height / 2
      const currentMultiplier = magnifierSpring.movementMultiplier.get()

      // Calculate SVG offset within container (SVG may be smaller due to aspect ratio)
      const svgOffsetX = svgRect.left - containerRect.left
      const svgOffsetY = svgRect.top - containerRect.top

      // Use utility to calculate dampened movement, squish, and escape
      const movement = calculatePointerLockMovement({
        lastX,
        lastY,
        movementX: e.movementX,
        movementY: e.movementY,
        currentMultiplier,
        bounds: {
          svgOffsetX,
          svgOffsetY,
          svgWidth: svgRect.width,
          svgHeight: svgRect.height,
        },
      })

      cursorX = movement.cursorX
      cursorY = movement.cursorY

      // Check if cursor should escape through boundary
      if (movement.shouldEscape && !isReleasingPointerLock) {
        // Start animation back to initial capture position
        interaction.dispatch({ type: 'EDGE_ESCAPE' })

        // Animate cursor back to initial position before releasing
        if (initialCapturePositionRef.current) {
          const startPos = { x: cursorX, y: cursorY }
          const endPos = initialCapturePositionRef.current
          const duration = 200 // ms
          const startTime = performance.now()

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - (1 - progress) ** 3 // Ease out cubic

            const interpolatedX = startPos.x + (endPos.x - startPos.x) * eased
            const interpolatedY = startPos.y + (endPos.y - startPos.y) * eased

            cursorPositionRef.current = { x: interpolatedX, y: interpolatedY }
            interaction.dispatch({
              type: 'MOUSE_MOVE',
              position: { x: interpolatedX, y: interpolatedY },
              regionId: null,
            })

            if (progress < 1) {
              requestAnimationFrame(animate)
            } else {
              document.exitPointerLock()
            }
          }
          requestAnimationFrame(animate)
        } else {
          document.exitPointerLock()
        }
        return
      }

      // Update squish state for visual effect
      setCursorSquish({ x: movement.squishX, y: movement.squishY })

      // Desktop drag detection in pointer lock mode
      if (desktopDragStartRef.current && !isDesktopMapDragging) {
        if (
          checkDragThreshold(
            cursorX,
            cursorY,
            desktopDragStartRef.current.x,
            desktopDragStartRef.current.y,
            DRAG_START_THRESHOLD
          )
        ) {
          desktopDragDidMoveRef.current = true
          interaction.dispatch({ type: 'DRAG_THRESHOLD_EXCEEDED' })
          lastDragPositionRef.current = null
        }
      }

      // Check if cursor has moved far enough from last drag position to dismiss magnifier
      if (lastDragPositionRef.current && !isDesktopMapDragging && !interaction.isShiftPressed) {
        if (
          checkDragThreshold(
            cursorX,
            cursorY,
            lastDragPositionRef.current.x,
            lastDragPositionRef.current.y,
            MAGNIFIER_DISMISS_THRESHOLD
          )
        ) {
          lastDragPositionRef.current = null
        }
      }
    } else {
      // Normal mode: use absolute position
      cursorX = e.clientX - containerRect.left
      cursorY = e.clientY - containerRect.top

      // Desktop drag detection: check if user has moved enough from drag start point
      if (desktopDragStartRef.current && !isDesktopMapDragging) {
        if (
          checkDragThreshold(
            cursorX,
            cursorY,
            desktopDragStartRef.current.x,
            desktopDragStartRef.current.y,
            DRAG_START_THRESHOLD
          )
        ) {
          desktopDragDidMoveRef.current = true
          interaction.dispatch({ type: 'DRAG_THRESHOLD_EXCEEDED' })
          lastDragPositionRef.current = null
        }
      }

      // Check if cursor has moved far enough from last drag position to dismiss magnifier
      if (lastDragPositionRef.current && !isDesktopMapDragging && !interaction.isShiftPressed) {
        if (
          checkDragThreshold(
            cursorX,
            cursorY,
            lastDragPositionRef.current.x,
            lastDragPositionRef.current.y,
            MAGNIFIER_DISMISS_THRESHOLD
          )
        ) {
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

    // Update cursor position ref for next frame (synchronous access for handlers)
    cursorPositionRef.current = { x: cursorX, y: cursorY }

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
      interaction.isShiftPressed ||
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

    // Dispatch MOUSE_MOVE to state machine with position and region
    // This updates both cursor position and hovered region in a single dispatch
    interaction.dispatch({
      type: 'MOUSE_MOVE',
      position: { x: cursorX, y: cursorY },
      regionId: regionUnderCursor,
    })

    // hoveredRegion is now derived from state machine (interaction.hoveredRegionId)
    // MOUSE_MOVE dispatch above already updated it with regionId

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
        const { x: viewBoxX, y: viewBoxY, width: viewBoxW, height: viewBoxH } = parsedViewBox
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
      const { x: viewBoxX, y: viewBoxY, width: viewBoxW, height: viewBoxH } = parsedViewBox
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
        const viewBoxWidth = parsedViewBox.width

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

    // Dispatch mouse leave to state machine (handles hasDragged reset)
    // State machine sets cursor to null on MOUSE_LEAVE
    interaction.dispatch({ type: 'MOUSE_LEAVE' })

    // Reset desktop drag state when mouse leaves
    desktopDragStartRef.current = null
    desktopDragDidMoveRef.current = false
    lastDragPositionRef.current = null

    setShowMagnifier(false)
    setTargetOpacity(0)
    setDebugBoundingBoxes([]) // Clear bounding boxes when leaving
    cursorPositionRef.current = null

    // Notify other players that cursor left
    // In turn-based mode, only broadcast when it's our turn
    if (onCursorUpdate && (gameMode !== 'turn-based' || currentPlayer === localPlayerId)) {
      onCursorUpdate(null, null)
    }
  }

  // Mobile map touch handlers - detect drag gestures to show magnifier
  const handleMapTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      // Only handle single-finger touch
      if (e.touches.length !== 1) return

      const touch = e.touches[0]
      mapTouchStartRef.current = { x: touch.clientX, y: touch.clientY }

      // Dispatch state machine event
      interaction.dispatch({
        type: 'TOUCH_START',
        position: { x: touch.clientX, y: touch.clientY },
        touchCount: e.touches.length,
        regionId: null, // Will be determined during move/tap
      })
    },
    [interaction]
  )

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
        // Note: touchAction: 'none' CSS prevents browser gestures without needing preventDefault()

        // Update cursor position based on touch location
        const containerRect = containerRef.current.getBoundingClientRect()
        const cursorX = touch.clientX - containerRect.left
        const cursorY = touch.clientY - containerRect.top

        cursorPositionRef.current = { x: cursorX, y: cursorY }

        // Detect region under cursor BEFORE dispatching to state machine
        const detectionResult = detectRegions(cursorX, cursorY)
        const {
          detectedRegions: detectedRegionObjects,
          detectedSmallestSize,
          regionUnderCursor,
        } = detectionResult

        // Dispatch state machine events for touch move (includes regionId for hover state)
        interaction.dispatch({
          type: 'TOUCH_MOVE',
          position: { x: touch.clientX, y: touch.clientY },
          touchCount: e.touches.length,
          regionId: regionUnderCursor,
        })
        if (!isMobileMapDragging) {
          interaction.dispatch({ type: 'PAN_THRESHOLD_EXCEEDED' })
        }

        // Set up magnifier opacity for mobile drag
        // Note: showMagnifier for mobile now derives from interaction.isMagnifierActive,
        // so we just need to set the opacity for the fade animation
        setTargetOpacity(1)

        // hoveredRegion is now derived from state machine (interaction.hoveredRegionId)
        // TOUCH_MOVE dispatch above already updated it with regionId

        // Hot/cold feedback for mobile magnifier
        if (hotColdEnabledRef.current && currentPrompt && !isGiveUpAnimating && !isInTakeover) {
          const targetRegion = mapData.regions.find((r) => r.id === currentPrompt)
          if (targetRegion) {
            const svgRect = svgRef.current.getBoundingClientRect()
            const { x: viewBoxX, y: viewBoxY, width: viewBoxW, height: viewBoxH } = parsedViewBox
            const viewport = getRenderedViewport(svgRect, viewBoxX, viewBoxY, viewBoxW, viewBoxH)
            const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
            const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY
            const targetPixelX = (targetRegion.center[0] - viewBoxX) * viewport.scale + svgOffsetX
            const targetPixelY = (targetRegion.center[1] - viewBoxY) * viewport.scale + svgOffsetY
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

        // Filter out found regions from zoom calculations (same as desktop)
        const unfoundRegionObjects = detectedRegionObjects.filter(
          (r) => !regionsFound.includes(r.id)
        )

        // Use adaptive zoom search utility to find optimal zoom (same algorithm as desktop)
        const svgRect = svgRef.current.getBoundingClientRect()

        // Broadcast cursor position to other players (in SVG coordinates)
        // In turn-based mode, only broadcast when it's our turn
        const shouldBroadcastCursor =
          onCursorUpdate && (gameMode !== 'turn-based' || currentPlayer === localPlayerId)

        if (shouldBroadcastCursor) {
          const { x: viewBoxX, y: viewBoxY, width: viewBoxW, height: viewBoxH } = parsedViewBox
          const viewport = getRenderedViewport(svgRect, viewBoxX, viewBoxY, viewBoxW, viewBoxH)
          const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
          const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY
          const cursorSvgX = (cursorX - svgOffsetX) / viewport.scale + viewBoxX
          const cursorSvgY = (cursorY - svgOffsetY) / viewport.scale + viewBoxY
          onCursorUpdate({ x: cursorSvgX, y: cursorSvgY }, regionUnderCursor)
        }
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
      currentPrompt,
      isGiveUpAnimating,
      isInTakeover,
      displayViewBox,
      checkHotCold,
      onCursorUpdate,
      gameMode,
      currentPlayer,
      localPlayerId,
      interaction,
    ]
  )

  // Helper to dismiss the magnifier (used by tap-to-dismiss and after selection)
  const dismissMagnifier = useCallback(() => {
    // For desktop: setShowMagnifier(false) hides via magnifierState.isVisible
    // For mobile: MAGNIFIER_DEACTIVATED event sets isMagnifierActive = false
    setShowMagnifier(false)
    setTargetOpacity(0)
    cursorPositionRef.current = null
    setIsMagnifierExpanded(false) // Reset expanded state on dismiss

    // Dispatch state machine event for magnifier deactivation (mobile)
    // This transitions mobile phase to idle and sets touchCenter to null
    interaction.dispatch({ type: 'MAGNIFIER_DEACTIVATED' })

    // Notify other players that cursor is no longer active
    // In turn-based mode, only broadcast when it's our turn
    if (onCursorUpdate && (gameMode !== 'turn-based' || currentPlayer === localPlayerId)) {
      onCursorUpdate(null, null)
    }
  }, [onCursorUpdate, gameMode, currentPlayer, localPlayerId, interaction])

  const handleMapTouchEnd = useCallback(() => {
    const wasDraggingMap = isMobileMapDragging
    const wasDraggingMagnifier = interaction.isMagnifierDragging
    const wasPinching = interaction.isPinching
    const phaseBefore = interaction.state.mode === 'mobile' ? interaction.state.phase : 'N/A'
    console.log('[handleMapTouchEnd] Called', {
      wasDraggingMap,
      wasDraggingMagnifier,
      wasPinching,
      showMagnifier,
      phaseBefore,
      hasCursor: !!cursorPositionRef.current,
    })
    mapTouchStartRef.current = null

    // Dispatch state machine event for touch end
    interaction.dispatch({ type: 'TOUCH_END', touchCount: 0 })

    // Check if we were interacting with map or magnifier (drag/pinch)
    // If interacting with magnifier, the touch end event shouldn't have come here
    // (magnifier should capture it) but if it does, we should NOT dismiss the magnifier
    if (wasDraggingMap || wasDraggingMagnifier || wasPinching) {
      // State machine handles the transition:
      // - mapPanning → magnifierActive (sets magnifierTriggeredByDrag: true)
      // - magnifierPanning → magnifierActive
      // - magnifierPinching → magnifierActive
      // Keep magnifier visible - user can tap "Select" button or tap elsewhere to dismiss
      console.log('[handleMapTouchEnd] Was dragging/pinching - keeping magnifier')
    } else if (showMagnifier && cursorPositionRef.current) {
      // User tapped on map (not a drag) while magnifier is visible - dismiss the magnifier
      console.log('[handleMapTouchEnd] Dismissing magnifier (tap on map while visible)')
      dismissMagnifier()
    }
  }, [isMobileMapDragging, showMagnifier, dismissMagnifier, interaction])

  // Touch handler options - passed to MagnifierOverlayWithHandlers
  // which calls useMagnifierTouchHandlers inside the context providers
  const touchHandlerOptions = useMemo<UseMagnifierTouchHandlersOptions>(
    () => ({
      onCursorUpdate,
      gameMode,
      currentPlayer,
      localPlayerId,
      checkHotCold,
      isInTakeover,
      displayViewBox,
      regionsFound,
      hotColdEnabledRef,
      largestPieceSizesRef,
      detectRegions,
    }),
    [
      onCursorUpdate,
      gameMode,
      currentPlayer,
      localPlayerId,
      checkHotCold,
      isInTakeover,
      displayViewBox,
      regionsFound,
      hotColdEnabledRef,
      largestPieceSizesRef,
      detectRegions,
    ]
  )

  // NOTE: handleMagnifierTouchStart, handleMagnifierTouchMove, handleMagnifierTouchEnd
  // have been moved to useMagnifierTouchHandlers hook in features/magnifier/
  // The hook is called by MagnifierOverlayWithHandlers inside the context providers

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

  // ============================================================================
  // Context Values
  // ============================================================================

  // Magnifier context value - provides magnifier-specific state to child components
  const magnifierContextValue = useMemo<MagnifierContextValue>(
    () => ({
      // Refs
      containerRef,
      svgRef,
      magnifierRef,
      cursorPositionRef,
      // Position & Animation (cursorPosition comes from state machine)
      cursorPosition,
      zoomSpring,
      magnifierSpring,
      parsedViewBox,
      safeZoneMargins: SAFE_ZONE_MARGINS,
      // Magnifier State
      showMagnifier,
      setShowMagnifier,
      isMagnifierExpanded,
      setIsMagnifierExpanded,
      targetOpacity,
      setTargetOpacity,
      targetZoom,
      setTargetZoom,
      // Interaction State Machine
      interaction,
      // Derived Interaction State
      mobileMapDragTriggeredMagnifier,
      isMobileMapDragging,
      isMagnifierDragging: isMagnifierDraggingFromMachine,
      pointerLocked,
      // Device & Theme
      isDark,
      isTouchDevice,
      canUsePrecisionMode,
      // Precision Mode
      precisionModeThreshold: PRECISION_MODE_THRESHOLD,
      precisionCalcs,
      // Zoom Controls
      getCurrentZoom,
      highZoomThreshold: HIGH_ZOOM_THRESHOLD,
    }),
    [
      containerRef,
      svgRef,
      magnifierRef,
      cursorPositionRef,
      cursorPosition,
      zoomSpring,
      magnifierSpring,
      parsedViewBox,
      showMagnifier,
      setShowMagnifier,
      isMagnifierExpanded,
      setIsMagnifierExpanded,
      targetOpacity,
      setTargetOpacity,
      targetZoom,
      setTargetZoom,
      interaction,
      mobileMapDragTriggeredMagnifier,
      isMobileMapDragging,
      isMagnifierDraggingFromMachine,
      pointerLocked,
      isDark,
      isTouchDevice,
      canUsePrecisionMode,
      precisionCalcs,
      getCurrentZoom,
    ]
  )

  // Map game context value - provides game-specific state to child components
  const mapGameContextValue = useMemo<MapGameContextValue>(
    () => ({
      // Map Data
      mapData,
      displayViewBox,
      // Game Progress
      regionsFound,
      hoveredRegion,
      setHoveredRegion,
      currentPrompt,
      // Animations
      celebration,
      giveUpReveal,
      isGiveUpAnimating,
      celebrationFlashProgress,
      giveUpFlashProgress,
      // Hot/Cold
      effectiveHotColdEnabled,
      hotColdFeedbackType,
      magnifierBorderStyle,
      crosshairHeatStyle,
      // Debug
      effectiveShowDebugBoundingBoxes,
      effectiveShowMagnifierDebugInfo,
      debugBoundingBoxes,
      // Multiplayer
      gameMode,
      currentPlayer,
      localPlayerId,
      // Callbacks
      getPlayerWhoFoundRegion,
      showOutline,
      handleRegionClickWithCelebration,
      selectRegionAtCrosshairs,
      requestPointerLock,
    }),
    [
      mapData,
      displayViewBox,
      regionsFound,
      hoveredRegion,
      setHoveredRegion,
      currentPrompt,
      celebration,
      giveUpReveal,
      isGiveUpAnimating,
      celebrationFlashProgress,
      giveUpFlashProgress,
      effectiveHotColdEnabled,
      hotColdFeedbackType,
      magnifierBorderStyle,
      crosshairHeatStyle,
      effectiveShowDebugBoundingBoxes,
      effectiveShowMagnifierDebugInfo,
      debugBoundingBoxes,
      gameMode,
      currentPlayer,
      localPlayerId,
      getPlayerWhoFoundRegion,
      showOutline,
      handleRegionClickWithCelebration,
      selectRegionAtCrosshairs,
      requestPointerLock,
    ]
  )

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
          // Hide native cursor on desktop since we show custom crosshair
          cursor: hasAnyFinePointer ? 'none' : 'pointer',
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
        <RegionRenderProvider
          isDark={isDark}
          pointerLocked={pointerLocked}
          hasAnyFinePointer={hasAnyFinePointer}
          giveUpFlashProgress={giveUpFlashProgress}
          hintFlashProgress={hintFlashProgress}
          celebrationFlashProgress={celebrationFlashProgress}
          isGiveUpAnimating={isGiveUpAnimating}
          celebrationActive={!!celebration}
        >
          {[...mapData.regions, ...excludedRegions].map((region) => {
            const isExcluded = excludedRegionIds.has(region.id)
            const isFound = regionsFound.includes(region.id) || isExcluded
            const playerId = !isExcluded && isFound ? getPlayerWhoFoundRegion(region.id) : null

            return (
              <RegionPath
                key={region.id}
                region={region}
                isExcluded={isExcluded}
                isFound={isFound}
                playerId={playerId}
                isBeingRevealed={giveUpReveal?.regionId === region.id}
                isBeingHinted={hintActive?.regionId === region.id}
                isCelebrating={celebration?.regionId === region.id}
                isHovered={hoveredRegion === region.id}
                networkHover={networkHoveredRegions[region.id]}
                showOutline={showOutline(region)}
                onMouseEnter={() => setHoveredRegion(region.id)}
                onMouseLeave={() => setHoveredRegion(null)}
                onClick={() => handleRegionClickWithCelebration(region.id, region.name)}
              />
            )
          })}
        </RegionRenderProvider>

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
              const {
                x: viewBoxX,
                y: viewBoxY,
                width: viewBoxWidth,
                height: viewBoxHeight,
              } = parsedViewBox
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
              const {
                x: viewBoxX,
                y: viewBoxY,
                width: viewBoxWidth,
                height: viewBoxHeight,
              } = parsedViewBox
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
              const { width: viewBoxWidth, height: viewBoxHeight } = parsedViewBox
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
              const { width: viewBoxWidth, height: viewBoxHeight } = parsedViewBox
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

      {/* Labels for found regions - rendered via LabelLayer component */}
      <LabelLayer
        labelPositions={labelPositions}
        smallRegionLabelPositions={smallRegionLabelPositions}
        cursorPosition={cursorPosition}
        hoveredRegion={hoveredRegion}
        regionsFound={regionsFound}
        isGiveUpAnimating={isGiveUpAnimating}
        isDark={isDark}
        playerMetadata={playerMetadata}
        hasAnyFinePointer={hasAnyFinePointer}
        celebration={celebration}
        onRegionClick={handleRegionClickWithCelebration}
        onHover={setHoveredRegion}
      />

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
          const {
            x: viewBoxX,
            y: viewBoxY,
            width: viewBoxWidth,
            height: viewBoxHeight,
          } = parsedViewBox

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

      {/* Custom Cursor - Visible on desktop when cursor is on the map */}
      {cursorPosition && hasAnyFinePointer && (
        <CustomCursor
          position={cursorPosition}
          squish={cursorSquish}
          rotationAngle={rotationAngle}
          heatStyle={crosshairHeatStyle}
          isDark={isDark}
          regionName={currentRegionName}
          flagEmoji={currentFlagEmoji}
        />
      )}

      {/* Heat crosshair overlay on main map - shows when hot/cold enabled (desktop non-pointer-lock) */}
      {effectiveHotColdEnabled && cursorPosition && !pointerLocked && hasAnyFinePointer && (
        <div
          data-element="main-map-heat-crosshair"
          style={{
            position: 'absolute',
            left: `${cursorPosition.x}px`,
            top: `${cursorPosition.y}px`,
            pointerEvents: 'none',
            zIndex: 150,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <HeatCrosshair
            size={40}
            rotationAngle={rotationAngle}
            heatStyle={crosshairHeatStyle}
            shadowIntensity={0.6}
          />
        </div>
      )}

      {/* Magnifier overlay - centers on cursor position */}
      {/* Wrapped in providers to enable context-based state access */}
      {cursorPosition && (
        <MagnifierProvider value={magnifierContextValue}>
          <MapGameProvider value={mapGameContextValue}>
            {/* MagnifierOverlayWithHandlers calls useMagnifierTouchHandlers inside context */}
            <MagnifierOverlayWithHandlers
              rotationAngle={rotationAngle}
              touchHandlerOptions={touchHandlerOptions}
            />

            {/* Zoom lines connecting indicator to magnifier - creates "pop out" effect */}
            {showMagnifier && (
              <ZoomLinesOverlay
                svgRef={svgRef}
                containerRef={containerRef}
                cursorPosition={cursorPosition}
                parsedViewBox={parsedViewBox}
                safeZoneMargins={SAFE_ZONE_MARGINS}
                targetTop={targetTop}
                targetLeft={targetLeft}
                targetOpacity={targetOpacity}
                currentZoom={getCurrentZoom()}
                highZoomThreshold={HIGH_ZOOM_THRESHOLD}
                isDark={isDark}
              />
            )}
          </MapGameProvider>
        </MagnifierProvider>
      )}

      {/* Debug: Auto zoom detection visualization (dev only) */}
      {effectiveShowMagnifierDebugInfo && cursorPosition && containerRef.current && (
        <AutoZoomDebugOverlay
          cursorPosition={cursorPosition}
          containerRef={containerRef}
          detectRegions={detectRegions}
          zoomSearchDebugInfo={zoomSearchDebugInfo}
          targetLeft={targetLeft}
          getCurrentZoom={getCurrentZoom}
          targetZoom={targetZoom}
        />
      )}

      {/* Hot/Cold Debug Panel - shows enable conditions and current state */}
      {isVisualDebugEnabled && (
        <HotColdDebugPanel
          assistanceAllowsHotCold={assistanceAllowsHotCold}
          assistanceLevel={assistanceLevel}
          hotColdEnabled={hotColdEnabled}
          hasAnyFinePointer={hasAnyFinePointer}
          showMagnifier={showMagnifier}
          isMobileMapDragging={isMobileMapDragging}
          gameMode={gameMode}
          currentPlayer={currentPlayer}
          localPlayerId={localPlayerId}
          hotColdFeedbackType={hotColdFeedbackType}
          currentPrompt={currentPrompt}
        />
      )}

      {/* Other players' cursors - show in multiplayer when not exclusively our turn */}
      <NetworkCursors
        svgRef={svgRef}
        containerRef={containerRef}
        parsedViewBox={parsedViewBox}
        otherPlayerCursors={otherPlayerCursors}
        viewerId={viewerId}
        gameMode={gameMode}
        currentPlayer={currentPlayer}
        localPlayerId={localPlayerId}
        playerMetadata={playerMetadata}
        memberPlayers={memberPlayers}
      />

      {/* Dev-only crop tool for getting custom viewBox coordinates */}
      <DevCropTool
        svgRef={svgRef}
        containerRef={containerRef}
        viewBox={displayViewBox}
        mapId={selectedMap}
        continentId={selectedContinent}
      />

      {/* Debug overlay showing safe zone rectangles */}
      {effectiveShowSafeZoneDebug && fillContainer && (
        <SafeZoneDebugOverlay
          svgDimensions={svgDimensions}
          safeZoneMargins={SAFE_ZONE_MARGINS}
          displayViewBox={displayViewBox}
          mapData={mapData}
        />
      )}

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
