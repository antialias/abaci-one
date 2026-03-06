'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useTheme } from '../../../contexts/ThemeContext'
import type {
  NumberLineState,
  TickThresholds,
  CollisionFadeMap,
  RenderConstant,
  PrimeTickInfo,
} from './types'
import { DEFAULT_TICK_THRESHOLDS } from './types'
import { renderNumberLine } from './renderNumberLine'
import { useNumberLineTouch } from './useNumberLineTouch'
import { NumberLineDebugPanel } from './NumberLineDebugPanel'
import { VoiceDebugPanels } from './VoiceDebugPanels'
import { DemoRecommendations } from './DemoRecommendations'
import { KeyboardShortcutsOverlay } from './KeyboardShortcutsOverlay'
import { useDemoKeyboardShortcuts } from './useDemoKeyboardShortcuts'
import { DemoScrubberControls } from './DemoScrubberControls'
import { useFindTheNumberGame } from './useFindTheNumberGame'
import { createHandleExploreConstant } from './createHandleExploreConstant'
import { MATH_CONSTANTS } from './constants/constantsData'
import { computeAllConstantVisibilities } from './constants/computeConstantVisibility'
import { updateConstantMarkerDOM } from './constants/updateConstantMarkerDOM'
import { ConstantInfoCard } from './constants/ConstantInfoCard'
import { useConstantDemo } from './constants/demos/useConstantDemo'
import { CONSTANT_IDS, DEMO_RECOMMENDATIONS } from './talkToNumber/explorationRegistry'
import { GAME_MAP } from './talkToNumber/gameRegistry'
import { renderGoldenRatioOverlay, computeSweepTransform } from './constants/demos/goldenRatioDemo'
import { DEMO_OVERLAY_RENDERERS } from './constants/demos/demoOverlayRegistry'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'
import { useConstantDemoNarration } from './constants/demos/useConstantDemoNarration'
import { NARRATION_CONFIGS } from './constants/demos/narrationConfigs'
import { usePhiExploreImage } from './constants/demos/usePhiExploreImage'
import { renderPhiExploreImage } from './constants/demos/renderPhiExploreImage'
import { usePhiCenteringMode } from './constants/demos/usePhiCenteringMode'
import { computePrimeInfos, smallestPrimeFactor } from './primes/sieve'
import { PrimeTooltip } from './primes/PrimeTooltip'
import {
  computePrimePairArcs,
  getSpecialPrimeLabels,
  LABEL_COLORS,
  PRIME_TYPE_DESCRIPTIONS,
} from './primes/specialPrimes'
import { computeInterestingPrimes } from './primes/interestingness'
import type { InterestingPrime } from './primes/interestingness'
import { usePrimeTour } from './primes/usePrimeTour'
import { renderTourSpotlight } from './primes/renderTourSpotlight'
import { renderSieveOverlay } from './primes/renderSieveOverlay'
import { PrimeTourOverlay } from './primes/PrimeTourOverlay'
import { computeTickMarks, numberToScreenX, screenXToNumber } from './numberLineTicks'
import { useRealtimeVoice } from './talkToNumber/useRealtimeVoice'
import type { CallState } from './talkToNumber/useRealtimeVoice'
import { PhoneCallOverlay, updateCallBoxPositions } from './talkToNumber/PhoneCallOverlay'
import { useZoomWash } from './useZoomWash'
import { syncDemoScrubberDOM } from './syncDemoScrubberDOM'
import {
  computeTourHighlights,
  computeSieveState,
  computeIndicatorFade,
  computeEffectiveHovered,
} from './drawComputations'
import { useViewportFly } from './useViewportFly'
import { syncVoiceNarration } from './syncVoiceNarration'
import {
  renderLcmHopperOverlay,
  setActiveCombo,
  getActiveCombo,
  setGuess,
  clearGuess,
  getGuessPosition,
  getGuessResult,
  EARLY_HOP_END,
  GUESS_END,
} from './lcmHopper/renderLcmHopperOverlay'
import { LcmHopperOverlay } from './lcmHopper/LcmHopperOverlay'
import { useLcmHopperParty } from './lcmHopper/useLcmHopperParty'
import { HoppingPartyBar } from './lcmHopper/HoppingPartyBar'
import { evaluateGuess } from './lcmHopper/lcmHopperState'
import { useUserPlayers } from '@/hooks/useUserPlayers'
import { useVisualDebugSafe } from '@/contexts/VisualDebugContext'

// ── URL param persistence for demo playback state ────────────────────
let lastUrlUpdateMs = 0
const URL_UPDATE_INTERVAL_MS = 1000

function updateDemoUrlParams(constantId: string | null, progress: number) {
  const now = performance.now()
  // Debounce writes, but always allow immediate clears
  if (constantId !== null && now - lastUrlUpdateMs < URL_UPDATE_INTERVAL_MS) return
  lastUrlUpdateMs = now
  const url = new URL(window.location.href)
  if (constantId) {
    url.searchParams.set('demo', constantId)
    url.searchParams.set('p', progress.toFixed(3))
  } else {
    url.searchParams.delete('demo')
    url.searchParams.delete('p')
  }
  if (url.href !== window.location.href) {
    window.history.replaceState(window.history.state, '', url.href)
  }
}

const INITIAL_STATE: NumberLineState = {
  center: 0,
  pixelsPerUnit: 100,
}

/** Determine decimal precision of a target number (for hint phrasing). */
export type NumberLineMode = 'standalone' | 'exploration-break'

interface NumberLineProps {
  playerId?: string
  onPlayerIdentified?: (playerId: string) => void
  onCallStateChange?: (state: CallState) => void
  /** When 'exploration-break', suppresses voice/game/debug UI and auto-plays a demo */
  mode?: NumberLineMode
  /** Constant ID to auto-play on mount (e.g. 'pi', 'phi'). Only used in exploration-break mode. */
  autoPlayDemo?: string
  /** Fires when the auto-played demo's narration completes (revealProgress >= 1) */
  onDemoComplete?: (constantId: string) => void
}

export function NumberLine({
  playerId,
  onPlayerIdentified,
  onCallStateChange,
  mode = 'standalone',
  autoPlayDemo,
  onDemoComplete,
}: NumberLineProps = {}) {
  const isBreakMode = mode === 'exploration-break'
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stateRef = useRef<NumberLineState>({ ...INITIAL_STATE })
  const rafRef = useRef<number>(0)
  const { resolvedTheme } = useTheme()
  const { isVisualDebugEnabled, isDevelopment } = useVisualDebugSafe()
  const audioManager = useAudioManagerInstance()
  const phiExploreRef = usePhiExploreImage(resolvedTheme)
  const centering = usePhiCenteringMode(resolvedTheme)
  // Ref so the memoized draw callback can always read latest centering state
  const centeringRef = useRef(centering)
  centeringRef.current = centering

  // Tick thresholds — owned by NumberLineDebugPanel, synced via ref
  const thresholdsRef = useRef<TickThresholds>({ ...DEFAULT_TICK_THRESHOLDS })

  // Track CSS dimensions for rendering
  const cssWidthRef = useRef(0)
  const cssHeightRef = useRef(0)

  // Forward ref to break circular dependency: hooks need draw(), but draw() is defined later
  const drawFnRef = useRef<() => void>(() => {})

  // Zoom velocity + background color wash (extracted hook)
  const {
    displayVelocityRef,
    displayHueRef,
    zoomFocalXRef,
    decayRafRef,
    wrapperRef,
    pageRef,
    handleZoomVelocity,
    updateDisplayValues,
  } = useZoomWash({ resolvedTheme, drawRef: drawFnRef })

  // Persistent collision fade state for smooth label show/hide transitions
  const collisionFadeMapRef = useRef<CollisionFadeMap>(new Map())
  const collisionRafRef = useRef<number>(0)

  // --- Mathematical constants (Number Safari) state ---
  const [constantsEnabled, setConstantsEnabled] = useState(true)
  const constantsEnabledRef = useRef(true)
  constantsEnabledRef.current = constantsEnabled
  const [tappedConstantId, setTappedConstantId] = useState<string | null>(null)
  // Persist discovered constants in localStorage
  const [discoveredIds, setDiscoveredIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem('number-line-discovered-constants')
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set()
    } catch {
      return new Set()
    }
  })
  const discoveredIdsRef = useRef(discoveredIds)
  discoveredIdsRef.current = discoveredIds
  // Last computed render constants (for hit-testing taps)
  const renderConstantsRef = useRef<RenderConstant[]>([])
  // Container for DOM-rendered MathML constant symbols
  const constantMarkersRef = useRef<HTMLDivElement>(null)

  // --- Constant demo state ---
  const demoRedraw = useCallback(() => drawFnRef.current(), [])
  const {
    demoState: demoStateRef,
    startDemo,
    restoreDemo,
    tickDemo,
    cancelDemo,
    setRevealProgress,
    markUserInteraction,
  } = useConstantDemo(stateRef, cssWidthRef, cssHeightRef, demoRedraw)
  // --- Constant demo narration (all constants) ---
  const narration = useConstantDemoNarration(demoStateRef, setRevealProgress, NARRATION_CONFIGS)

  // --- Demo URL restore (runs once on first resize) ---
  const hasRestoredRef = useRef(false)
  const [restoredFromUrl, setRestoredFromUrl] = useState(false)
  // Track whether onDemoComplete has been fired (fire once per demo)
  const demoCompleteFireRef = useRef(false)

  // --- Demo scrubber state ---
  const scrubberTrackRef = useRef<HTMLDivElement>(null)
  const scrubberFillRef = useRef<HTMLDivElement>(null)
  const scrubberThumbRef = useRef<HTMLDivElement>(null)
  const scrubberGapRef = useRef<HTMLDivElement>(null)
  const playPauseBtnRef = useRef<HTMLButtonElement>(null)
  const timeDisplayRef = useRef<HTMLDivElement>(null)
  const segmentTicksRef = useRef<HTMLDivElement>(null)
  const segmentLabelRef = useRef<HTMLDivElement>(null)
  const lastTickConstantIdRef = useRef<string | null>(null)
  const [demoActive, setDemoActive] = useState(false)
  const isDraggingScrubberRef = useRef(false)
  const scrubberHoverProgressRef = useRef<number | null>(null)

  // --- Demo Refine mode state (dev-only) ---
  // Initialize from sessionStorage so an active task survives HMR (dev only)
  const isDev = process.env.NODE_ENV === 'development'
  const [refineMode, setRefineMode] = useState(() => {
    if (!isDev) return false
    try {
      return sessionStorage.getItem('refine-active-task') !== null
    } catch {
      return false
    }
  })
  const [refineRange, setRefineRange] = useState<{ start: number; end: number } | null>(null)
  const refineStartRef = useRef<number | null>(null)
  const [refineTaskActive, setRefineTaskActive] = useState(() => {
    if (!isDev) return false
    try {
      return sessionStorage.getItem('refine-active-task') !== null
    } catch {
      return false
    }
  })

  // --- Prime Tour state ---
  // Uses the same drawFnRef/demoRedraw pattern as useConstantDemo
  const {
    tourState: tourStateRef,
    currentStopIndex: tourStopIndex,
    totalStops: tourTotalStops,
    currentStop: tourCurrentStop,
    startTour,
    nextStop: tourNextStop,
    prevStop: tourPrevStop,
    exitTour,
    tickTour,
    forcedHoverValue,
  } = usePrimeTour(stateRef, cssWidthRef, cssHeightRef, demoRedraw)

  // --- Primes (Sieve of Eratosthenes) state ---
  const [primesEnabled, setPrimesEnabled] = useState(true)
  const primesEnabledRef = useRef(true)
  primesEnabledRef.current = primesEnabled
  const [hoveredValue, setHoveredValue] = useState<number | null>(null)
  const hoveredValueRef = useRef<number | null>(null)
  hoveredValueRef.current = hoveredValue
  // When true, the mouse is over the PrimeTooltip — don't clear hoveredValue
  const tooltipHoveredRef = useRef(false)
  // Tapped non-prime integer (click to show factorization)
  const [tappedIntValue, setTappedIntValue] = useState<number | null>(null)
  // Last computed prime infos (for tooltip data lookup)
  const primeInfosRef = useRef<Map<number, PrimeTickInfo>>(new Map())
  // Visible primes set for fast lookup in hover handler
  const visiblePrimesSetRef = useRef<Set<number>>(new Set())
  // Rendered interesting prime positions for hit-testing at low zoom
  const renderedPrimePositionsRef = useRef<{ value: number; screenX: number; note?: string }[]>([])
  // Current interesting primes for the visible range
  const interestingPrimesRef = useRef<InterestingPrime[]>([])

  // --- LCM Hopper / Hopping Party ---
  const dismissTooltip = useCallback(() => {
    setTappedIntValue(null)
    setHoveredValue(null)
    tooltipHoveredRef.current = false
  }, [])
  const {
    partyInvitees,
    setPartyInvitees,
    startLcmHopperDemo,
    handleToggleInvite,
    startHoppingParty,
    handleDismissPartyDemo,
    getPartyState,
  } = useLcmHopperParty({
    demoStateRef,
    narration,
    startDemo,
    cancelDemo,
    onDismissTooltip: dismissTooltip,
  })

  // --- Talk to a Number state ---
  const [callingNumber, setCallingNumber] = useState<number | null>(null)
  const handleVoiceTransfer = useCallback((targetNumber: number) => {
    setCallingNumber(targetNumber)
  }, [])
  // Tracks whether a demo exploration is active (for call timer freeze)
  const isExplorationActiveRef = useRef(false)

  // Ref-based forward declarations so useRealtimeVoice can control exploration
  const exploreFnRef = useRef<(constantId: string) => void>(() => {})
  const pauseFnRef = useRef<() => void>(() => {})
  const resumeFnRef = useRef<() => void>(() => {})
  const seekFnRef = useRef<(segmentIndex: number) => void>(() => {})
  const lookAtFnRef = useRef<(center: number, range: number) => void>(() => {})
  const indicateFnRef = useRef<
    (
      numbers: number[],
      range?: { from: number; to: number },
      durationSeconds?: number,
      persistent?: boolean
    ) => void
  >(() => {})
  const startFindNumberFnRef = useRef<(target: number) => void>(() => {})
  const stopFindNumberFnRef = useRef<() => void>(() => {})
  // When true, indicate's auto-zoom is suppressed (game controls the viewport)
  const suppressIndicateZoomRef = useRef(false)
  const handleVoiceGameStart = useCallback(
    (gameId: string, params: Record<string, unknown>) => {
      setActiveGameId(gameId)
      if (gameId === 'find_number') {
        const target = Number(params.target)
        if (isFinite(target)) startFindNumberFnRef.current(target)
      }
      if (gameId === 'guess_my_number') {
        // Lock viewport to full game range so the child sees the indicate band shrink
        const min = params.min !== undefined ? Number(params.min) : 1
        const max = params.max !== undefined ? Number(params.max) : 100
        const center = (min + max) / 2
        const range = (max - min) * 1.15 // 15% margin
        lookAtFnRef.current(center, range)
        suppressIndicateZoomRef.current = true
      }
      if (gameId === 'nim') {
        const stones =
          typeof params.stones === 'number' && isFinite(params.stones as number)
            ? (params.stones as number)
            : 15
        const center = (1 + stones) / 2
        const range = stones * 1.15 // 15% margin
        lookAtFnRef.current(center, range)
        suppressIndicateZoomRef.current = true
        // Boost label visibility — wide zoom makes individual numbers nearly invisible
        labelScaleRef.current = 1.8
        labelMinOpacityRef.current = 0.9
      }
      if (gameId === 'lcm_hopper') {
        startLcmHopperDemo()
      }
    },
    [startLcmHopperDemo]
  )
  const handleVoiceGameEnd = useCallback((gameId: string) => {
    setActiveGameId(null)
    suppressIndicateZoomRef.current = false
    if (gameId === 'find_number') {
      stopFindNumberFnRef.current()
    }
  }, [])
  const handleVoiceExploration = useCallback((constantId: string) => {
    exploreFnRef.current(constantId)
  }, [])
  const handleVoicePause = useCallback(() => {
    pauseFnRef.current()
  }, [])
  const handleVoiceResume = useCallback(() => {
    resumeFnRef.current()
  }, [])
  const handleVoiceSeek = useCallback((segIdx: number) => {
    seekFnRef.current(segIdx)
  }, [])
  const handleVoiceEndExploration = useCallback(() => {
    cancelDemo()
    narration.stop()
  }, [cancelDemo, narration])
  const handleVoiceLookAt = useCallback((center: number, range: number) => {
    lookAtFnRef.current(center, range)
  }, [])
  const handleVoiceIndicate = useCallback(
    (
      numbers: number[],
      range?: { from: number; to: number },
      durationSeconds?: number,
      persistent?: boolean
    ) => {
      indicateFnRef.current(numbers, range, durationSeconds, persistent)
    },
    []
  )
  const handleVoiceSetLabelStyle = useCallback((scale: number, minOpacity: number) => {
    labelScaleRef.current = scale
    labelMinOpacityRef.current = minOpacity
  }, [])
  // Fetch players for mid-call identification
  const { data: allPlayers } = useUserPlayers()
  const availablePlayerSummaries = useMemo(() => {
    if (!allPlayers) return []
    return allPlayers
      .filter((p) => p.isActive && !p.isArchived)
      .map((p) => ({ id: p.id, name: p.name, emoji: p.emoji || '👤' }))
  }, [allPlayers])

  const {
    state: voiceState,
    error: voiceError,
    errorCode: voiceErrorCode,
    dial,
    hangUp,
    timeRemaining,
    isSpeaking,
    transferTarget,
    conferenceNumbers,
    currentSpeaker,
    removeFromCall,
    sendSystemMessage,
    setNarrationPlaying,
    profileFailed,
    currentInstructions,
    modeDebug,
  } = useRealtimeVoice({
    onTransfer: handleVoiceTransfer,
    onStartExploration: handleVoiceExploration,
    onPauseExploration: handleVoicePause,
    onResumeExploration: handleVoiceResume,
    onSeekExploration: handleVoiceSeek,
    onEndExploration: handleVoiceEndExploration,
    onLookAt: handleVoiceLookAt,
    onIndicate: handleVoiceIndicate,
    onGameStart: handleVoiceGameStart,
    onGameEnd: handleVoiceGameEnd,
    onSetLabelStyle: handleVoiceSetLabelStyle,
    isExplorationActiveRef,
    onPlayerIdentified,
    getViewportSnapshot: () => ({
      center: stateRef.current.center,
      pixelsPerUnit: stateRef.current.pixelsPerUnit,
    }),
  })
  const callBoxContainerRef = useRef<HTMLDivElement>(null)
  const voiceStateRef = useRef<CallState>('idle')
  voiceStateRef.current = voiceState
  // Notify parent of call state changes
  useEffect(() => {
    onCallStateChange?.(voiceState)
  }, [voiceState, onCallStateChange])
  // Pending tour — queued during a call, launched after hangup
  const pendingTourRef = useRef<string | null>(null)
  const conferenceNumbersRef = useRef<number[]>([])
  conferenceNumbersRef.current = conferenceNumbers
  // Debug: log overlay render condition changes
  useEffect(() => {
    const shouldShow = callingNumber !== null && voiceState !== 'idle'
    console.log(
      '[NumberLine] overlay condition — callingNumber:',
      callingNumber,
      'voiceState:',
      voiceState,
      'shouldShow:',
      shouldShow
    )
  }, [callingNumber, voiceState])
  // Clear callingNumber when call ends (e.g. model hangs up).
  // Only clear when voiceState *transitions* to idle (not on initial mount
  // or when callingNumber is set before dial() goes async).
  const prevVoiceStateRef = useRef<CallState>('idle')
  useEffect(() => {
    const prev = prevVoiceStateRef.current
    prevVoiceStateRef.current = voiceState
    // Only clear if we transitioned TO idle FROM a non-idle state
    if (voiceState === 'idle' && prev !== 'idle') {
      if (callingNumber !== null) {
        console.log(
          '[NumberLine] clearing callingNumber because voiceState transitioned',
          prev,
          '→ idle'
        )
        setCallingNumber(null)
      }
      // Clear any active game when the call ends
      setActiveGameId(null)
      suppressIndicateZoomRef.current = false
      // Reset label style overrides
      labelScaleRef.current = 1
      labelMinOpacityRef.current = 0
      // Clear any lingering indicator
      indicatorRef.current = null
      // Launch pending tour after hangup
      const tourId = pendingTourRef.current
      if (tourId) {
        pendingTourRef.current = null
        console.log('[NumberLine] launching pending tour after hangup:', tourId)
        // Small delay so the call UI clears first
        setTimeout(() => {
          cancelDemo()
          setTappedConstantId(null)
          setTappedIntValue(null)
          setHoveredValue(null)
          startTour()
        }, 500)
      }
    }
  }, [voiceState, callingNumber, cancelDemo, startTour])
  // TTS narration plays during voice calls — the pre-recorded narrator handles
  // content while the voice agent acts as a silent companion.

  // --- Game session state (generic, across all games) ---
  const [activeGameId, setActiveGameId] = useState<string | null>(null)

  // --- Find the Number game ---
  const drawRef = useRef<() => void>(() => {})
  const {
    gameState,
    renderTargetRef,
    proximityRef,
    handleGameStart,
    handleGameGiveUp,
    computeGameProximity,
    gameStartedByModel,
    labelScaleRef,
    labelMinOpacityRef,
    gameRafRef,
  } = useFindTheNumberGame({
    stateRef,
    cssWidthRef,
    drawRef,
    voiceState,
    sendSystemMessage,
    setActiveGameId,
    startFindNumberFnRef,
    stopFindNumberFnRef,
  })

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const cssWidth = cssWidthRef.current
    const cssHeight = cssHeightRef.current

    // Compute proximity for Find the Number game
    computeGameProximity()

    // Compute constant visibilities
    let renderConstants: RenderConstant[] | undefined
    if (constantsEnabledRef.current) {
      renderConstants = computeAllConstantVisibilities(
        MATH_CONSTANTS,
        stateRef.current,
        cssWidth,
        discoveredIdsRef.current
      )
      renderConstantsRef.current = renderConstants
    } else {
      renderConstantsRef.current = []
    }

    // Compute prime infos, interesting primes, and pair arcs
    let primeInfos: Map<number, PrimeTickInfo> | undefined
    let interestingPrimes: InterestingPrime[] | undefined
    let primePairArcs: ReturnType<typeof computePrimePairArcs> | undefined
    if (primesEnabledRef.current) {
      const ticks = computeTickMarks(stateRef.current, cssWidth, thresholdsRef.current)
      primeInfos = computePrimeInfos(ticks)
      primeInfosRef.current = primeInfos

      // Compute interesting primes for axis-level markers (works at any zoom)
      const halfWidth = cssWidth / 2
      const ppu = stateRef.current.pixelsPerUnit
      const leftValue = stateRef.current.center - halfWidth / ppu
      const rightValue = stateRef.current.center + halfWidth / ppu
      interestingPrimes = computeInterestingPrimes(leftValue, rightValue, cssWidth)
      interestingPrimesRef.current = interestingPrimes
      visiblePrimesSetRef.current = new Set(interestingPrimes.map((ip) => ip.value))

      // Store rendered positions for hover hit-testing at low zoom
      const positions: { value: number; screenX: number; note?: string }[] = []
      for (const ip of interestingPrimes) {
        // Skip if already visible as a tick-based dot
        if (primeInfos.has(ip.value)) continue
        const sx = numberToScreenX(ip.value, stateRef.current.center, ppu, cssWidth)
        if (sx >= -5 && sx <= cssWidth + 5) {
          positions.push({ value: ip.value, screenX: sx, note: ip.note })
        }
      }
      renderedPrimePositionsRef.current = positions

      // Compute pair arcs from the raw prime values
      const primeValues = interestingPrimes.map((ip) => ip.value)
      primePairArcs = computePrimePairArcs(primeValues)
    } else {
      primeInfosRef.current = new Map()
      visiblePrimesSetRef.current = new Set()
      interestingPrimesRef.current = []
      renderedPrimePositionsRef.current = []
    }

    // Rate-limit display values before rendering
    updateDisplayValues()

    // Tick the constant demo state machine (updates viewport during animation)
    tickDemo()

    // Auto-start narration when viewport fly-in is ~60% done (revealProgress > 0)
    {
      const ds = demoStateRef.current
      if (ds.phase === 'animating' && ds.revealProgress > 0) {
        narration.startIfNeeded(ds.constantId)
      }
    }

    // Fire onDemoComplete when narration finishes (once per demo)
    {
      const ds = demoStateRef.current
      if (
        onDemoComplete &&
        !demoCompleteFireRef.current &&
        ds.phase === 'presenting' &&
        ds.revealProgress >= 1 &&
        ds.constantId
      ) {
        demoCompleteFireRef.current = true
        onDemoComplete(ds.constantId)
      }
      // Reset the flag when demo returns to idle (so next demo can fire again)
      if (ds.phase === 'idle') {
        demoCompleteFireRef.current = false
      }
    }

    // Write demo state to URL params (debounced).
    // Skip until restore has been attempted — otherwise the first draw()
    // (which runs before restore) clears the params while demo is still idle.
    // Also skip in break mode — no URL persistence for embedded explorations.
    if (hasRestoredRef.current && !isBreakMode) {
      const ds = demoStateRef.current
      if (ds.phase !== 'idle' && ds.constantId) {
        updateDemoUrlParams(ds.constantId, ds.revealProgress)
      } else {
        updateDemoUrlParams(null, 0)
      }
    }

    // Track whether an exploration is active (used by call timer to freeze countdown)
    isExplorationActiveRef.current =
      demoStateRef.current.phase !== 'idle' && demoStateRef.current.phase !== 'fading'

    // Feed narration segment updates to voice agent during active call
    {
      const ds = demoStateRef.current
      syncVoiceNarration(
        {
          voiceState: voiceStateRef.current,
          demoPhase: ds.phase,
          constantId: ds.constantId,
          revealProgress: ds.revealProgress,
          isNarrating: !!narration.isNarrating.current,
          segmentIndex: narration.segmentIndexRef.current,
          lastReportedSegment: voiceExplorationSegmentRef.current,
        },
        {
          sendSystemMessage,
          setNarrationPlaying,
          updateLastReportedSegment: (idx) => {
            voiceExplorationSegmentRef.current = idx
          },
        },
        ds.constantId ? NARRATION_CONFIGS[ds.constantId] : undefined
      )
    }

    // Tick the prime tour state machine (updates viewport during flights)
    tickTour()

    // Effective hovered value: tour forced hover overrides user hover
    const effectiveHovered = computeEffectiveHovered(tourStateRef.current, hoveredValueRef.current)

    // Compute tour spotlight highlight set (phase-aware)
    const tourTs = tourStateRef.current
    const { highlightSet, highlightedArcSet, dimAmount } = computeTourHighlights(tourTs)

    // Compute sieve tick transforms during ancient-trick tour stop
    const { sieveTransforms, sieveUniformity, sieveDwellElapsed } = computeSieveState(
      tourTs,
      stateRef.current,
      cssWidth,
      cssHeight
    )

    // Compute indicator fade lifecycle
    const { renderIndicator, expired: indicatorExpired } = computeIndicatorFade(
      indicatorRef.current
    )
    if (indicatorExpired) indicatorRef.current = null

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0) // reset any existing transform
    ctx.scale(dpr, dpr)
    const fadeAnimating = renderNumberLine(
      ctx,
      stateRef.current,
      cssWidth,
      cssHeight,
      resolvedTheme === 'dark',
      thresholdsRef.current,
      displayVelocityRef.current,
      displayHueRef.current,
      zoomFocalXRef.current,
      renderTargetRef.current,
      collisionFadeMapRef.current,
      renderConstants,
      primeInfos,
      effectiveHovered,
      interestingPrimes,
      primePairArcs,
      highlightSet,
      highlightedArcSet,
      sieveTransforms,
      sieveUniformity,
      renderIndicator
    )

    // Render constant demo overlay (golden ratio, etc.)
    const ds = demoStateRef.current

    // Render phi explore image behind the spiral (fades in during final 25%)
    // When centering mode is active, override with centering data and force full opacity
    const ct = centeringRef.current
    if (ct.enabled && ct.image) {
      renderPhiExploreImage(
        ctx,
        stateRef.current,
        cssWidth,
        cssHeight,
        1.0,
        1.0,
        ct.image,
        ct.alignment
      )
    } else if (ds.phase !== 'idle' && ds.constantId === 'phi' && ds.revealProgress > 0.75) {
      const pe = phiExploreRef.current
      if (pe) {
        const t = (ds.revealProgress - 0.75) / 0.25 // 0→1 over final quarter
        const imageOpacity = t * t * (3 - 2 * t) * ds.opacity // smoothstep × demo opacity
        renderPhiExploreImage(
          ctx,
          stateRef.current,
          cssWidth,
          cssHeight,
          ds.revealProgress,
          imageOpacity,
          pe.image,
          pe.alignment
        )
      }
    }

    // Render golden spiral overlay — always at full reveal when centering
    if (ct.enabled) {
      renderGoldenRatioOverlay(
        ctx,
        stateRef.current,
        cssWidth,
        cssHeight,
        resolvedTheme === 'dark',
        1.0,
        1.0
      )
    } else if (ds.phase !== 'idle' && ds.constantId === 'phi') {
      renderGoldenRatioOverlay(
        ctx,
        stateRef.current,
        cssWidth,
        cssHeight,
        resolvedTheme === 'dark',
        ds.revealProgress,
        ds.opacity
      )
    }
    // Render standard demo overlays (pi, tau, e, gamma, sqrt2, sqrt3, ln2, ramanujan, feigenbaum)
    if (ds.phase !== 'idle' && ds.constantId) {
      const renderer = DEMO_OVERLAY_RENDERERS[ds.constantId]
      if (renderer) {
        renderer(
          ctx,
          stateRef.current,
          cssWidth,
          cssHeight,
          resolvedTheme === 'dark',
          ds.revealProgress,
          ds.opacity
        )
      }
    }

    // Render sieve animation during ancient-trick tour stop
    if (sieveTransforms) {
      renderSieveOverlay(
        ctx,
        stateRef.current,
        cssWidth,
        cssHeight,
        resolvedTheme === 'dark',
        sieveDwellElapsed,
        tourTs.opacity
      )
    }

    // Render tour spotlight (dim overlay + pulse glow)
    if (tourTs.phase !== 'idle' && highlightSet && highlightSet.size > 0 && dimAmount > 0) {
      renderTourSpotlight(
        ctx,
        stateRef.current,
        cssWidth,
        cssHeight,
        resolvedTheme === 'dark',
        [...highlightSet],
        dimAmount,
        tourTs.opacity
      )
    }

    // Render LCM Hopper overlay (emojis, arcs, landing marks, celebration)
    if (ds.constantId === 'lcm_hopper' && ds.phase !== 'idle') {
      renderLcmHopperOverlay(
        ctx,
        stateRef.current,
        cssWidth,
        cssHeight,
        resolvedTheme === 'dark',
        ds.revealProgress,
        ds.opacity
      )
    }

    ctx.restore()

    // --- Sync demo scrubber DOM ---
    syncDemoScrubberDOM(
      {
        scrubberTrackRef,
        scrubberFillRef,
        scrubberThumbRef,
        scrubberGapRef,
        playPauseBtnRef,
        timeDisplayRef,
        segmentTicksRef,
        segmentLabelRef,
        lastTickConstantIdRef,
        isDraggingScrubberRef,
        scrubberHoverProgressRef,
      },
      ds,
      !!narration.isNarrating.current,
      resolvedTheme
    )
    // Sync React state for conditional rendering (batch with rAF)
    const isActive = ds.phase !== 'idle'
    if (isActive && !demoActive) setDemoActive(true)
    else if (!isActive && demoActive) setDemoActive(false)

    // Sync MathML DOM overlays with canvas
    if (constantMarkersRef.current && renderConstants) {
      const maxTickHeight = Math.min(40, cssHeight * 0.3)
      updateConstantMarkerDOM(
        constantMarkersRef.current,
        renderConstants,
        MATH_CONSTANTS,
        cssHeight / 2,
        maxTickHeight,
        resolvedTheme === 'dark'
      )
    } else if (constantMarkersRef.current) {
      // Constants disabled — clear any remaining DOM elements
      updateConstantMarkerDOM(
        constantMarkersRef.current,
        [],
        MATH_CONSTANTS,
        cssHeight / 2,
        0,
        resolvedTheme === 'dark'
      )
    }

    // Position call boxes at their number's screen-X
    if (callBoxContainerRef.current && voiceStateRef.current === 'active') {
      updateCallBoxPositions(
        callBoxContainerRef.current,
        stateRef.current.center,
        stateRef.current.pixelsPerUnit,
        cssWidth,
        cssHeight
      )
    }

    // Keep redrawing while collision fades are in progress
    if (fadeAnimating && !collisionRafRef.current) {
      collisionRafRef.current = requestAnimationFrame(() => {
        collisionRafRef.current = 0
        draw()
      })
    }
  }, [resolvedTheme])

  // Keep draw refs pointing at the latest draw function
  drawFnRef.current = draw
  drawRef.current = draw

  const scheduleRedraw = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      draw()
    })
  }, [draw])

  // Redraw when centering mode state changes
  useEffect(() => {
    if (centering.enabled) scheduleRedraw()
  }, [
    centering.enabled,
    centering.image,
    centering.alignment,
    centering.subjectId,
    centering.theme,
    scheduleRedraw,
  ])

  // --- Hover handler for prime tooltips (primes only) ---
  const handleHover = useCallback(
    (hoverScreenX: number, _hoverScreenY: number) => {
      // Suppress user hover during prime tour (forced hover handles it)
      if (tourStateRef.current.phase !== 'idle') return

      if (hoverScreenX < 0) {
        if (hoveredValueRef.current !== null && !tooltipHoveredRef.current) {
          setHoveredValue(null)
          scheduleRedraw()
        }
        return
      }
      if (!primesEnabledRef.current) {
        if (hoveredValueRef.current !== null && !tooltipHoveredRef.current) setHoveredValue(null)
        return
      }

      const cssWidth = cssWidthRef.current
      const state = stateRef.current
      const value = screenXToNumber(hoverScreenX, state.center, state.pixelsPerUnit, cssWidth)
      const nearest = Math.round(value)

      // Check if cursor is within ~20px of the nearest integer's screen position
      const nearestScreenX = numberToScreenX(nearest, state.center, state.pixelsPerUnit, cssWidth)
      const dist = Math.abs(hoverScreenX - nearestScreenX)

      // Standard approach: snap to nearest integer prime
      if (dist < 20 && nearest >= 2 && smallestPrimeFactor(nearest) === nearest) {
        if (hoveredValueRef.current !== nearest) {
          setHoveredValue(nearest)
          scheduleRedraw()
        }
        return
      }

      // At low zoom, snap to nearest rendered interesting prime dot instead
      const renderedPrimes = renderedPrimePositionsRef.current
      if (renderedPrimes.length > 0 && renderedPrimes.length < 5000) {
        let closest: (typeof renderedPrimes)[number] | null = null
        let closestDist = Infinity
        for (const rp of renderedPrimes) {
          const d = Math.abs(hoverScreenX - rp.screenX)
          if (d < closestDist) {
            closest = rp
            closestDist = d
          }
        }
        if (closest && closestDist < 20) {
          if (hoveredValueRef.current !== closest.value) {
            setHoveredValue(closest.value)
            scheduleRedraw()
          }
          return
        }
      }

      // No prime nearby — but keep tooltip alive if mouse is over it
      if (hoveredValueRef.current !== null && !tooltipHoveredRef.current) {
        setHoveredValue(null)
        scheduleRedraw()
      }
    },
    [scheduleRedraw]
  )

  // --- Constants + non-prime integer tap handler ---
  const handleCanvasTap = useCallback(
    (screenX: number, _screenY: number) => {
      // LCM Hopper guess interception — active during guess phase of the demo
      {
        const ds = demoStateRef.current
        if (
          ds.constantId === 'lcm_hopper' &&
          ds.phase !== 'idle' &&
          ds.revealProgress >= EARLY_HOP_END &&
          ds.revealProgress < GUESS_END
        ) {
          const combo = getActiveCombo()
          if (combo) {
            const value = screenXToNumber(
              screenX,
              stateRef.current.center,
              stateRef.current.pixelsPerUnit,
              cssWidthRef.current
            )
            const snapped = Math.round(value)
            const result = evaluateGuess(snapped, combo.lcm)
            setGuess(snapped, result)
            return
          }
        }
      }

      // Check constants first
      if (constantsEnabledRef.current) {
        const HIT_RADIUS = 30
        const constants = renderConstantsRef.current
        let closest: RenderConstant | null = null
        let closestDist = Infinity

        for (const c of constants) {
          if (c.opacity < 0.3) continue
          const dist = Math.abs(c.screenX - screenX)
          if (dist < HIT_RADIUS && dist < closestDist) {
            closest = c
            closestDist = dist
          }
        }

        if (closest) {
          setDiscoveredIds((prev) => {
            const next = new Set(prev)
            next.add(closest!.id)
            try {
              localStorage.setItem('number-line-discovered-constants', JSON.stringify([...next]))
            } catch {
              /* ignore */
            }
            return next
          })
          setTappedConstantId(closest.id)
          setTappedIntValue(null)
          draw()
          return
        }
      }

      // Check for integer tap (all integers ≥ 2 — primes and composites)
      if (primesEnabledRef.current) {
        const cssWidth = cssWidthRef.current
        const state = stateRef.current
        const value = screenXToNumber(screenX, state.center, state.pixelsPerUnit, cssWidth)
        const nearest = Math.round(value)
        const nearestScreenX = numberToScreenX(nearest, state.center, state.pixelsPerUnit, cssWidth)
        const dist = Math.abs(screenX - nearestScreenX)

        if (dist < 20 && nearest >= 2) {
          setTappedConstantId(null)
          setTappedIntValue(nearest)
          return
        }
      }

      // Tap on empty space dismisses everything
      setTappedConstantId(null)
      setTappedIntValue(null)
    },
    [draw]
  )

  // Helper: get currently visible exploration recommendations (if any)
  const getVisibleRecommendations = useCallback((): string[] | undefined => {
    const ds = demoStateRef.current
    if (ds.revealProgress >= 1 && ds.constantId) {
      return DEMO_RECOMMENDATIONS[ds.constantId]
    }
    return undefined
  }, [demoStateRef])

  // --- Long-press handler for "Talk to a Number" ---
  const handleCanvasLongPress = useCallback(
    (screenX: number, _screenY: number) => {
      console.log(
        '[NumberLine] handleCanvasLongPress fired, screenX:',
        screenX,
        'current callingNumber:',
        callingNumber,
        'voiceState:',
        voiceStateRef.current
      )
      const cssWidth = cssWidthRef.current
      const state = stateRef.current
      const value = screenXToNumber(screenX, state.center, state.pixelsPerUnit, cssWidth)
      // Snap to the nearest visible tick mark — that's the number the user sees
      const ticks = computeTickMarks(state, cssWidth, thresholdsRef.current)
      let numberToCall = value
      let bestDist = Infinity
      for (const tick of ticks) {
        const d = Math.abs(value - tick.value)
        if (d < bestDist) {
          bestDist = d
          numberToCall = tick.value
        }
      }
      // Clean floating point noise (e.g. 399 * 0.01 = 3.9900000000000002 → 3.99)
      numberToCall = parseFloat(numberToCall.toPrecision(12))
      console.log(
        '[NumberLine] calling setCallingNumber(%s) and dial(%s)',
        numberToCall,
        numberToCall
      )
      setCallingNumber(numberToCall)
      dial(numberToCall, {
        recommendedExplorations: getVisibleRecommendations(),
        playerId,
        availablePlayers: !playerId ? availablePlayerSummaries : undefined,
      })
    },
    [dial, callingNumber, getVisibleRecommendations, playerId, availablePlayerSummaries]
  )

  // Touch/mouse/wheel handling
  const handleStateChange = useCallback(() => {
    setRestoredFromUrl(false)
    markUserInteraction()
    scheduleRedraw()
  }, [markUserInteraction, scheduleRedraw])

  // Capture current canvas at CSS resolution (1x, not DPR-scaled) for screenshot annotation
  const captureScreenshot = useCallback((): string | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const cssW = cssWidthRef.current
    const cssH = cssHeightRef.current
    if (!cssW || !cssH) return null
    const offscreen = document.createElement('canvas')
    offscreen.width = cssW
    offscreen.height = cssH
    const ctx = offscreen.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(canvas, 0, 0, cssW, cssH)
    return offscreen.toDataURL('image/png')
  }, [])

  useNumberLineTouch({
    stateRef,
    canvasRef,
    onStateChange: handleStateChange,
    onZoomVelocity: handleZoomVelocity,
    onTap: handleCanvasTap,
    onHover: handleHover,
    onLongPress: handleCanvasLongPress,
  })

  // ResizeObserver for responsive canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      cssWidthRef.current = rect.width
      cssHeightRef.current = rect.height
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      draw()

      // Restore demo from URL params on first resize (canvas dimensions now set)
      if (!hasRestoredRef.current) {
        hasRestoredRef.current = true
        if (isBreakMode && autoPlayDemo) {
          // In exploration-break mode, auto-start the specified demo
          startDemo(autoPlayDemo)
        } else {
          const params = new URLSearchParams(window.location.search)
          const demoId = params.get('demo')
          const progressStr = params.get('p')
          if (demoId && CONSTANT_IDS.has(demoId)) {
            const progress = progressStr !== null ? parseFloat(progressStr) : 0
            if (!isNaN(progress)) {
              restoreDemo(demoId, progress)
              narration.markTriggered(demoId)
              setRestoredFromUrl(true)
            }
          }
        }
      }
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    // Initial size
    resize()

    return () => {
      observer.disconnect()
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
      if (decayRafRef.current) {
        cancelAnimationFrame(decayRafRef.current)
      }
      if (gameRafRef.current) {
        cancelAnimationFrame(gameRafRef.current)
      }
      if (collisionRafRef.current) {
        cancelAnimationFrame(collisionRafRef.current)
      }
      // Restore page background on unmount
      if (pageRef.current) {
        pageRef.current.style.backgroundColor = ''
      }
    }
  }, [draw])

  // Redraw when theme changes
  useEffect(() => {
    draw()
  }, [draw])

  // Viewport fly animations (conference calls, look_at, indicate)
  const {
    lookAt: viewportLookAt,
    indicate: viewportIndicate,
    indicatorRef,
  } = useViewportFly({
    stateRef,
    cssWidthRef,
    draw,
    conferenceNumbers,
    voiceState,
    suppressIndicateZoomRef,
  })
  // Wire up forward refs so voice agent callbacks use the hook's implementations
  lookAtFnRef.current = viewportLookAt
  indicateFnRef.current = viewportIndicate

  // Find tapped constant data for info card
  const tappedConstant = useMemo(
    () =>
      tappedConstantId ? (MATH_CONSTANTS.find((c) => c.id === tappedConstantId) ?? null) : null,
    [tappedConstantId]
  )
  // Find screen position of tapped constant from last render
  const tappedScreenX = useMemo(() => {
    if (!tappedConstantId) return 0
    const rc = renderConstantsRef.current.find((c) => c.id === tappedConstantId)
    return rc?.screenX ?? 0
  }, [tappedConstantId])

  const handleDismissInfoCard = useCallback(() => {
    console.log('[NumberLine] handleDismissInfoCard — calling audioManager.stop()')
    audioManager.stop()
    setTappedConstantId(null)
  }, [audioManager])

  const handleCallNumber = useCallback(
    (n: number) => {
      setCallingNumber(n)
      setTappedConstantId(null)
      setTappedIntValue(null)
      dial(n, {
        recommendedExplorations: getVisibleRecommendations(),
        playerId,
        availablePlayers: !playerId ? availablePlayerSummaries : undefined,
      })
    },
    [dial, getVisibleRecommendations, playerId, availablePlayerSummaries]
  )

  // Track which narration segment was last reported to the voice agent
  const voiceExplorationSegmentRef = useRef(-1)
  // Ref for speed reset — assigned after keyboard hook provides setDisplaySpeed/setShowSpeedBadge
  const speedResetRef = useRef(() => {})

  const handleExploreConstant = useCallback(
    createHandleExploreConstant({
      audioManager,
      voiceStateRef,
      pendingTourRef,
      voiceExplorationSegmentRef,
      narration,
      cancelDemo,
      exitTour,
      startTour,
      startDemo,
      restoreDemo,
      sendSystemMessage,
      onSpeedReset: () => speedResetRef.current(),
      setTappedConstantId,
      setTappedIntValue,
      setHoveredValue,
      tooltipHoveredRef,
    }),
    [
      audioManager,
      startDemo,
      restoreDemo,
      exitTour,
      startTour,
      cancelDemo,
      narration,
      sendSystemMessage,
    ]
  )
  // Keep refs pointed at latest implementations for voice agent callbacks
  exploreFnRef.current = handleExploreConstant
  pauseFnRef.current = () => {
    if (narration.isNarrating.current) narration.stop()
  }
  resumeFnRef.current = () => {
    const ds = demoStateRef.current
    console.log(
      '[exploration] resumeFnRef called — constantId:',
      ds.constantId,
      'revealProgress:',
      ds.revealProgress
    )
    if (ds.constantId && ds.revealProgress < 1) {
      console.log('[exploration] narration.resume() — TTS narration starts NOW')
      narration.resume(ds.constantId)
    }
  }
  seekFnRef.current = (segmentIndex: number) => {
    const ds = demoStateRef.current
    if (!ds.constantId) return
    const cfg = NARRATION_CONFIGS[ds.constantId]
    if (!cfg || segmentIndex < 0 || segmentIndex >= cfg.segments.length) return
    // Stop current narration, seek to segment start, leave paused
    if (narration.isNarrating.current) narration.stop()
    setRevealProgress(cfg.segments[segmentIndex].startProgress)
    // Update the voice agent's segment tracker so the segment cue re-fires on resume
    voiceExplorationSegmentRef.current = segmentIndex - 1
  }

  // --- Phi centering drag/scroll handlers ---
  const centeringDragRef = useRef<{
    startX: number
    startY: number
    startAlignment: { offsetX: number; offsetY: number; rotation: number }
    shift: boolean
  } | null>(null)
  const phiFinalEffScale = useMemo(() => computeSweepTransform(1.0).effScale, [])

  const handleCenteringMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const al = centeringRef.current.alignment
    centeringDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startAlignment: { offsetX: al.offsetX, offsetY: al.offsetY, rotation: al.rotation },
      shift: e.shiftKey,
    }
  }, [])

  const handleCenteringMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const drag = centeringDragRef.current
      if (!drag) return
      e.preventDefault()
      e.stopPropagation()
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      const boxH = phiFinalEffScale * stateRef.current.pixelsPerUnit
      if (boxH < 1) return

      if (drag.shift) {
        // Shift+drag: rotate. Horizontal movement → degrees.
        // Renderer negates rotation, so subtract to make visual match drag direction.
        const degreeDelta = dx * 0.5
        centering.updateAlignment({ rotation: drag.startAlignment.rotation - degreeDelta })
      } else {
        // Normal drag: offset. Renderer negates offsetY, so subtract dy.
        const offsetDeltaX = dx / boxH
        const offsetDeltaY = -dy / boxH
        centering.updateAlignment({
          offsetX: drag.startAlignment.offsetX + offsetDeltaX,
          offsetY: drag.startAlignment.offsetY + offsetDeltaY,
        })
      }
    },
    [centering, phiFinalEffScale]
  )

  const handleCenteringMouseUp = useCallback(() => {
    centeringDragRef.current = null
  }, [])

  const handleCenteringWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const delta = -e.deltaY
      const factor = 1.01 ** delta
      const al = centeringRef.current.alignment
      centering.updateAlignment({ scale: al.scale * factor })
    },
    [centering]
  )

  // --- Prime Tour handlers ---
  const handleStartTour = useCallback(() => {
    cancelDemo() // mutual exclusion: cancel demo when starting tour
    setTappedConstantId(null)
    setTappedIntValue(null)
    setHoveredValue(null)
    tooltipHoveredRef.current = false
    startTour()
  }, [startTour, cancelDemo])

  // --- Scrubber pointer handlers ---
  /** Snap progress to a segment boundary if within 20px on screen. */
  const handlePlayPauseClick = useCallback(() => {
    setRestoredFromUrl(false)
    const ds = demoStateRef.current
    if (ds.phase === 'idle') return
    if (narration.isNarrating.current) {
      narration.stop()
    } else if (ds.constantId && ds.revealProgress >= 1) {
      // Replay from the beginning
      narration.reset()
      speedResetRef.current()
      startDemo(ds.constantId)
    } else if (ds.constantId && ds.revealProgress < 1) {
      narration.resume(ds.constantId)
    }
  }, [demoStateRef, narration, startDemo])

  // --- Keyboard shortcuts + speed display (extracted hook) ---
  const {
    showShortcuts,
    setShowShortcuts,
    displaySpeed,
    setDisplaySpeed,
    showSpeedBadge,
    setShowSpeedBadge,
    speedFadeTimerRef,
  } = useDemoKeyboardShortcuts({
    demoStateRef,
    narration,
    setRevealProgress,
    handlePlayPauseClick,
    audioManager,
    refineMode,
    refineTaskActive,
    setRefineMode,
    setRefineRange,
    refineStartRef,
    isVisualDebugEnabled,
    isDevelopment,
  })
  speedResetRef.current = () => {
    setDisplaySpeed(1)
    setShowSpeedBadge(false)
  }

  return (
    <div
      ref={wrapperRef}
      data-component="number-line-wrapper"
      style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}
    >
      {/* FindTheNumberBar hidden — the voice agent starts find_number via start_game tool */}
      <div data-element="canvas-wrapper" style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          data-component="number-line"
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            touchAction: 'none',
          }}
        />
        {!isBreakMode && centering.enabled && (
          <div
            data-element="centering-overlay"
            onMouseDown={handleCenteringMouseDown}
            onMouseMove={handleCenteringMouseMove}
            onMouseUp={handleCenteringMouseUp}
            onMouseLeave={handleCenteringMouseUp}
            onWheel={handleCenteringWheel}
            style={{
              position: 'absolute',
              inset: 0,
              cursor: centeringDragRef.current ? 'grabbing' : 'grab',
              zIndex: 5,
            }}
          />
        )}
        {!isBreakMode && (
          <div
            ref={constantMarkersRef}
            data-element="constant-markers"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              overflow: 'hidden',
            }}
          />
        )}
        {/* Prime Tour button removed — tour is now offered contextually via PrimeTooltip */}
        {!isBreakMode && tappedConstant && (
          <ConstantInfoCard
            constant={tappedConstant}
            screenX={tappedScreenX}
            containerWidth={cssWidthRef.current}
            containerHeight={cssHeightRef.current}
            centerY={cssHeightRef.current / 2}
            isDark={resolvedTheme === 'dark'}
            onDismiss={handleDismissInfoCard}
            onExplore={handleExploreConstant}
            onCallNumber={handleCallNumber}
          />
        )}
        {!isBreakMode &&
          activeGameId &&
          voiceState === 'active' &&
          (() => {
            const game = GAME_MAP.get(activeGameId)
            return (
              <div
                data-component="game-session-banner"
                style={{
                  position: 'absolute',
                  top: 56,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 16px',
                  borderRadius: 20,
                  background:
                    resolvedTheme === 'dark'
                      ? 'rgba(99, 102, 241, 0.25)'
                      : 'rgba(99, 102, 241, 0.15)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: `1px solid ${resolvedTheme === 'dark' ? 'rgba(129, 140, 248, 0.3)' : 'rgba(99, 102, 241, 0.25)'}`,
                  color: resolvedTheme === 'dark' ? '#c7d2fe' : '#4338ca',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontSize: '0.9rem' }}>{'🎮'}</span>
                {game?.name ?? activeGameId}
              </div>
            )
          })()}
        {!isBreakMode && callingNumber !== null && voiceState !== 'idle' && (
          <PhoneCallOverlay
            number={callingNumber}
            state={voiceState}
            timeRemaining={timeRemaining}
            error={voiceError}
            errorCode={voiceErrorCode}
            transferTarget={transferTarget}
            conferenceNumbers={conferenceNumbers}
            currentSpeaker={currentSpeaker}
            isSpeaking={isSpeaking}
            onHangUp={() => {
              hangUp()
              setCallingNumber(null)
            }}
            onRemoveFromCall={removeFromCall}
            onRetry={() => dial(callingNumber)}
            onDismiss={() => {
              hangUp()
              setCallingNumber(null)
            }}
            containerWidth={cssWidthRef.current}
            containerHeight={cssHeightRef.current}
            isDark={resolvedTheme === 'dark'}
            callBoxContainerRef={callBoxContainerRef}
          />
        )}
        {/* LCM Hopper overlay (guess prompt + celebration card) */}
        {!isBreakMode &&
          demoStateRef.current.constantId === 'lcm_hopper' &&
          demoStateRef.current.phase !== 'idle' && (
            <LcmHopperOverlay
              progress={demoStateRef.current.revealProgress}
              combo={getActiveCombo()}
              guessResult={getGuessResult()}
              guessPosition={getGuessPosition()}
              isDark={resolvedTheme === 'dark'}
              onDismiss={handleDismissPartyDemo}
            />
          )}
        {/* Hopping Party bar — shown when invitees selected and demo idle */}
        {!isBreakMode &&
          partyInvitees.length > 0 &&
          demoStateRef.current.phase === 'idle' &&
          tourStateRef.current.phase === 'idle' && (
            <HoppingPartyBar
              partyInvitees={partyInvitees}
              isDark={resolvedTheme === 'dark'}
              onToggleInvite={handleToggleInvite}
              onStartParty={startHoppingParty}
              onClearParty={() => setPartyInvitees([])}
            />
          )}
        {!isBreakMode &&
          demoActive &&
          demoStateRef.current.revealProgress >= 1 &&
          demoStateRef.current.constantId && (
            <DemoRecommendations
              constantId={demoStateRef.current.constantId}
              isDark={resolvedTheme === 'dark'}
              onExplore={handleExploreConstant}
            />
          )}
        {demoActive && (
          <DemoScrubberControls
            demoStateRef={demoStateRef}
            narration={narration}
            setRevealProgress={setRevealProgress}
            startDemo={startDemo}
            resolvedTheme={resolvedTheme}
            restoredFromUrl={restoredFromUrl}
            setRestoredFromUrl={setRestoredFromUrl}
            isDevelopment={isDev}
            onCaptureScreenshot={captureScreenshot}
            scrubberTrackRef={scrubberTrackRef}
            scrubberFillRef={scrubberFillRef}
            scrubberThumbRef={scrubberThumbRef}
            scrubberGapRef={scrubberGapRef}
            playPauseBtnRef={playPauseBtnRef}
            timeDisplayRef={timeDisplayRef}
            segmentTicksRef={segmentTicksRef}
            segmentLabelRef={segmentLabelRef}
            isDraggingScrubberRef={isDraggingScrubberRef}
            scrubberHoverProgressRef={scrubberHoverProgressRef}
            refineMode={refineMode}
            refineRange={refineRange}
            setRefineRange={setRefineRange}
            refineStartRef={refineStartRef}
            refineTaskActive={refineTaskActive}
            setRefineTaskActive={setRefineTaskActive}
            setRefineMode={setRefineMode}
            displaySpeed={displaySpeed}
            setDisplaySpeed={setDisplaySpeed}
            showSpeedBadge={showSpeedBadge}
            setShowSpeedBadge={setShowSpeedBadge}
            handlePlayPauseClick={handlePlayPauseClick}
          />
        )}
        {!isBreakMode &&
          (() => {
            const tooltipValue = forcedHoverValue ?? hoveredValue
            if (tooltipValue === null || !primesEnabled) return null
            const spf = tooltipValue >= 2 ? smallestPrimeFactor(tooltipValue) : 0
            const isPrime = tooltipValue >= 2 && spf === tooltipValue
            const ip = interestingPrimesRef.current.find((p) => p.value === tooltipValue)
            const tourAvailable = tourStateRef.current.phase === 'idle' && !demoActive
            const hoverPartyState = getPartyState(tooltipValue)
            return (
              <PrimeTooltip
                value={tooltipValue}
                primeInfo={{
                  value: tooltipValue,
                  smallestPrimeFactor: spf,
                  isPrime,
                  classification: tooltipValue === 1 ? 'one' : isPrime ? 'prime' : 'composite',
                }}
                screenX={numberToScreenX(
                  tooltipValue,
                  stateRef.current.center,
                  stateRef.current.pixelsPerUnit,
                  cssWidthRef.current
                )}
                tooltipY={cssHeightRef.current / 2 + Math.min(40, cssHeightRef.current * 0.3) + 30}
                containerWidth={cssWidthRef.current}
                isDark={resolvedTheme === 'dark'}
                landmarkNote={ip?.note}
                onStartTour={tourAvailable ? handleStartTour : undefined}
                partyState={hoverPartyState}
                onToggleInvite={hoverPartyState ? handleToggleInvite : undefined}
                onMouseEnter={() => {
                  tooltipHoveredRef.current = true
                }}
                onMouseLeave={() => {
                  tooltipHoveredRef.current = false
                }}
              />
            )
          })()}
        {!isBreakMode &&
          hoveredValue === null &&
          forcedHoverValue === null &&
          tappedIntValue !== null &&
          primesEnabled &&
          (() => {
            const v = tappedIntValue
            const spf = v >= 2 ? smallestPrimeFactor(v) : 0
            const isPrime = v >= 2 && spf === v
            const info: PrimeTickInfo =
              v === 1
                ? { value: 1, smallestPrimeFactor: 0, isPrime: false, classification: 'one' }
                : {
                    value: v,
                    smallestPrimeFactor: spf,
                    isPrime,
                    classification: isPrime ? 'prime' : 'composite',
                  }
            const tappedPartyState = getPartyState(v)
            return (
              <PrimeTooltip
                value={v}
                primeInfo={info}
                screenX={numberToScreenX(
                  v,
                  stateRef.current.center,
                  stateRef.current.pixelsPerUnit,
                  cssWidthRef.current
                )}
                tooltipY={cssHeightRef.current / 2 + Math.min(40, cssHeightRef.current * 0.3) + 30}
                containerWidth={cssWidthRef.current}
                isDark={resolvedTheme === 'dark'}
                partyState={tappedPartyState}
                onToggleInvite={tappedPartyState ? handleToggleInvite : undefined}
                onMouseEnter={() => {
                  tooltipHoveredRef.current = true
                }}
                onMouseLeave={() => {
                  tooltipHoveredRef.current = false
                }}
              />
            )
          })()}
        {/* Prime Tour overlay card */}
        {!isBreakMode && tourCurrentStop !== null && tourStopIndex !== null && (
          <PrimeTourOverlay
            stop={tourCurrentStop}
            stopIndex={tourStopIndex}
            totalStops={tourTotalStops}
            isDark={resolvedTheme === 'dark'}
            onNext={tourNextStop}
            onPrev={tourPrevStop}
            onClose={exitTour}
          />
        )}
        {!isBreakMode && !refineMode && (
          <NumberLineDebugPanel
            thresholdsRef={thresholdsRef}
            scheduleRedraw={scheduleRedraw}
            constantsEnabled={constantsEnabled}
            setConstantsEnabled={setConstantsEnabled}
            primesEnabled={primesEnabled}
            setPrimesEnabled={setPrimesEnabled}
            centering={centering}
            resolvedTheme={resolvedTheme}
          />
        )}
        {!isBreakMode && !refineMode && isVisualDebugEnabled && (
          <VoiceDebugPanels
            voiceState={voiceState}
            modeDebug={modeDebug}
            activeGameId={activeGameId}
            currentInstructions={currentInstructions}
            isDark={resolvedTheme === 'dark'}
          />
        )}
        {!isBreakMode &&
          (() => {
            const fv = forcedHoverValue ?? hoveredValue
            if (fv === null || !primesEnabled || fv < 2) return null
            const spf = smallestPrimeFactor(fv)
            if (spf !== fv) return null // not prime
            const labels = getSpecialPrimeLabels(fv)
            if (labels.length === 0) return null
            const isDark = resolvedTheme === 'dark'
            // Deduplicate types (a prime can have e.g. two twin pairs but one footnote)
            const seenTypes = new Set<string>()
            const uniqueLabels = labels.filter((l) => {
              if (seenTypes.has(l.type)) return false
              seenTypes.add(l.type)
              return true
            })
            return (
              <div
                data-element="prime-footnotes"
                style={{
                  position: 'absolute',
                  bottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
                  left: 12,
                  right: 12,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px 14px',
                  pointerEvents: 'none',
                }}
              >
                {uniqueLabels.map((label) => (
                  <span
                    key={label.type}
                    data-element="prime-footnote"
                    style={{
                      fontSize: 10,
                      lineHeight: 1.4,
                      color: LABEL_COLORS[label.type][isDark ? 'dark' : 'light'],
                      opacity: 0.85,
                    }}
                  >
                    {PRIME_TYPE_DESCRIPTIONS[label.type]}
                  </span>
                ))}
              </div>
            )
          })()}

        {/* Keyboard shortcuts overlay */}
        {!isBreakMode && showShortcuts && demoStateRef.current.phase !== 'idle' && (
          <KeyboardShortcutsOverlay
            isDark={resolvedTheme === 'dark'}
            showRefineMode={isVisualDebugEnabled}
            onClose={() => setShowShortcuts(false)}
          />
        )}
      </div>
    </div>
  )
}
