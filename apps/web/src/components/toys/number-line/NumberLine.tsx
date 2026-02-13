'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useTheme } from '../../../contexts/ThemeContext'
import type { NumberLineState, TickThresholds, CollisionFadeMap, RenderConstant, PrimeTickInfo } from './types'
import { DEFAULT_TICK_THRESHOLDS } from './types'
import { renderNumberLine } from './renderNumberLine'
import type { RenderTarget } from './renderNumberLine'
import { useNumberLineTouch } from './useNumberLineTouch'
import { ToyDebugPanel, DebugSlider } from '../ToyDebugPanel'
import { computeProximity } from './findTheNumber/computeProximity'
import type { ProximityZone, ProximityResult } from './findTheNumber/computeProximity'
import { FindTheNumberBar } from './findTheNumber/FindTheNumberBar'
import type { FindTheNumberGameState } from './findTheNumber/FindTheNumberBar'
import { useFindTheNumberAudio } from './findTheNumber/useFindTheNumberAudio'
import { MATH_CONSTANTS } from './constants/constantsData'
import { computeAllConstantVisibilities } from './constants/computeConstantVisibility'
import { updateConstantMarkerDOM } from './constants/updateConstantMarkerDOM'
import { ConstantInfoCard } from './constants/ConstantInfoCard'
import { useConstantDemo, DEMO_AVAILABLE } from './constants/demos/useConstantDemo'
import { renderGoldenRatioOverlay, NUM_LEVELS, setStepTimingDecay, getStepTimingDecay, arcCountAtProgress, convergenceGapAtProgress } from './constants/demos/goldenRatioDemo'
import { renderPiOverlay } from './constants/demos/piDemo'
import { renderTauOverlay } from './constants/demos/tauDemo'
import { renderEOverlay } from './constants/demos/eDemo'
import { renderGammaOverlay } from './constants/demos/gammaDemo'
import { renderSqrt2Overlay } from './constants/demos/sqrt2Demo'
import { renderRamanujanOverlay } from './constants/demos/ramanujanDemo'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'
import { useConstantDemoNarration } from './constants/demos/useConstantDemoNarration'
import type { DemoNarrationConfig } from './constants/demos/useConstantDemoNarration'
import { E_DEMO_SEGMENTS, E_DEMO_TONE } from './constants/demos/eDemoNarration'
import { PI_DEMO_SEGMENTS, PI_DEMO_TONE } from './constants/demos/piDemoNarration'
import { TAU_DEMO_SEGMENTS, TAU_DEMO_TONE } from './constants/demos/tauDemoNarration'
import { PHI_DEMO_SEGMENTS, PHI_DEMO_TONE } from './constants/demos/phiDemoNarration'
import { GAMMA_DEMO_SEGMENTS, GAMMA_DEMO_TONE } from './constants/demos/gammaDemoNarration'
import { SQRT2_DEMO_SEGMENTS, SQRT2_DEMO_TONE } from './constants/demos/sqrt2DemoNarration'
import { RAMANUJAN_DEMO_SEGMENTS, RAMANUJAN_DEMO_TONE } from './constants/demos/ramanujanDemoNarration'
import { usePhiExploreImage } from './constants/demos/usePhiExploreImage'
import { renderPhiExploreImage } from './constants/demos/renderPhiExploreImage'
import { computePrimeInfos, smallestPrimeFactor } from './primes/sieve'
import { PrimeTooltip } from './primes/PrimeTooltip'
import { computePrimePairArcs, getSpecialPrimeLabels, LABEL_COLORS, PRIME_TYPE_DESCRIPTIONS } from './primes/specialPrimes'
import { computeInterestingPrimes } from './primes/interestingness'
import type { InterestingPrime } from './primes/interestingness'
import { usePrimeTour, getSieveSpeed, setSieveSpeed } from './primes/usePrimeTour'
import { PRIME_TOUR_STOPS } from './primes/primeTourStops'
import { renderTourSpotlight } from './primes/renderTourSpotlight'
import { renderSieveOverlay, computeSieveTickTransforms, SWEEP_MAX_N, getSieveTrackingRange, setSieveTrackingRange, getSieveFollowHops, setSieveFollowHops } from './primes/renderSieveOverlay'
import type { SieveTickTransform } from './primes/renderSieveOverlay'
import { PrimeTourOverlay } from './primes/PrimeTourOverlay'
import { computeTickMarks, numberToScreenX, screenXToNumber } from './numberLineTicks'
import { useRealtimeVoice } from './talkToNumber/useRealtimeVoice'
import type { CallState } from './talkToNumber/useRealtimeVoice'
import { PhoneCallOverlay, updateCallBoxPositions } from './talkToNumber/PhoneCallOverlay'
import { lerpViewport } from './viewportAnimation'
import type { Viewport } from './viewportAnimation'

// Logarithmic scrubber mapping — compresses early (tiny) levels on the left,
// gives more precision to later (dramatic) levels on the right.
let scrubberLogBase = 7
let scrubberLogDenom = Math.log(Math.max(1.01, scrubberLogBase))
function progressToScrubber(p: number): number {
  if (scrubberLogBase <= 1.01) return p // linear fallback
  return (Math.pow(scrubberLogBase, p) - 1) / (scrubberLogBase - 1)
}
function scrubberToProgress(s: number): number {
  if (scrubberLogBase <= 1.01) return s // linear fallback
  return Math.log(1 + s * (scrubberLogBase - 1)) / scrubberLogDenom
}
function setScrubberLogBase(base: number): void {
  scrubberLogBase = Math.max(1, base)
  scrubberLogDenom = Math.log(Math.max(1.01, scrubberLogBase))
}

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

// ── "Explore next" recommendation graph ──────────────────────────────
// Directed, strongly connected so every constant is reachable from any other.
// Each entry maps constantId → [recommended ids] (2-3 per constant).
const DEMO_RECOMMENDATIONS: Record<string, string[]> = {
  phi:       ['sqrt2', 'pi',       'e'],
  pi:        ['tau',   'phi',      'ramanujan'],
  tau:       ['pi',    'e',        'gamma'],
  e:         ['gamma', 'pi',       'phi'],
  gamma:     ['e',     'ramanujan', 'sqrt2'],
  sqrt2:     ['phi',   'gamma',    'tau'],
  ramanujan: ['pi',    'e',        'sqrt2'],
}

// Display metadata for recommendation cards
const DEMO_DISPLAY: Record<string, { symbol: string; name: string; value: number; visualDesc?: string }> = {
  phi:       { symbol: 'φ',    name: 'Golden Ratio',      value: 1.618033988749895,
    visualDesc: 'A compass arm draws a Fibonacci golden-rectangle spiral on the number line. It spins 90-degree arcs, adding progressively larger colored squares that build outward. The rectangle\'s aspect ratio visibly converges toward phi (~1.618). It does NOT show phi growing larger — it shows the SHAPE settling into the golden ratio.' },
  pi:        { symbol: 'π',    name: 'Pi',                value: Math.PI,
    visualDesc: 'A circle rolls along the number line. The distance it travels in one full rotation marks out pi (~3.14159). Then the view zooms into pi\'s position on the number line, revealing more and more decimal digits as we zoom deeper.' },
  tau:       { symbol: 'τ',    name: 'Tau',               value: 2 * Math.PI,
    visualDesc: 'Similar to the pi demo but showing tau (2π ≈ 6.283). A full turn of a circle traces out tau on the number line. The view zooms into tau\'s position, revealing its decimal expansion.' },
  e:         { symbol: 'e',    name: "Euler's Number",    value: Math.E,
    visualDesc: 'Shows compound interest growth on the number line. Starts with simple doubling, then splits into more and more compounding intervals. The result converges toward e (~2.718). The view zooms into e\'s position to reveal its decimal digits.' },
  gamma:     { symbol: 'γ',    name: 'Euler-Mascheroni',  value: 0.5772156649,
    visualDesc: 'Shows the gap between the harmonic series (1 + 1/2 + 1/3 + ...) and the natural logarithm. Bars represent harmonic terms stacking up on the number line. The gap between the staircase and the smooth curve converges to gamma (~0.577).' },
  sqrt2:     { symbol: '√2',   name: 'Root 2',            value: Math.SQRT2,
    visualDesc: 'Shows a unit square on the number line with its diagonal. The diagonal length is √2. The view zooms into √2\'s position (~1.41421), revealing more decimal digits and showing it never terminates or repeats — it\'s irrational.' },
  ramanujan: { symbol: '−1⁄12', name: 'Ramanujan',        value: -1 / 12,
    visualDesc: 'Shows the surprising Ramanujan summation: 1+2+3+4+... = −1/12. Partial sums grow on the number line (getting bigger and bigger), but the animation reveals how a special mathematical technique (analytic continuation) assigns the value −1/12 to the divergent series.' },
}

// Narration configs for all constant demos (must be module-level for ref stability)
const NARRATION_CONFIGS: Record<string, DemoNarrationConfig> = {
  e: { segments: E_DEMO_SEGMENTS, tone: E_DEMO_TONE },
  pi: { segments: PI_DEMO_SEGMENTS, tone: PI_DEMO_TONE },
  tau: { segments: TAU_DEMO_SEGMENTS, tone: TAU_DEMO_TONE },
  phi: { segments: PHI_DEMO_SEGMENTS, tone: PHI_DEMO_TONE },
  gamma: { segments: GAMMA_DEMO_SEGMENTS, tone: GAMMA_DEMO_TONE },
  sqrt2: { segments: SQRT2_DEMO_SEGMENTS, tone: SQRT2_DEMO_TONE },
  ramanujan: { segments: RAMANUJAN_DEMO_SEGMENTS, tone: RAMANUJAN_DEMO_TONE },
}

/** After finishing an exploration, suggest one of these related constants. */
const EXPLORATION_RECOMMENDATIONS: Record<string, { id: string; reason: string }[]> = {
  pi:        [{ id: 'tau',   reason: 'tau is 2π — the "full turn" version of pi' },
              { id: 'e',     reason: "Euler's number shows up in the famous equation e^(iπ)+1=0" },
              { id: 'phi',   reason: 'phi is another famous irrational number from geometry' }],
  tau:       [{ id: 'pi',    reason: 'pi is the more famous half of tau' },
              { id: 'sqrt2', reason: 'another irrational number hiding in simple geometry' }],
  e:         [{ id: 'pi',    reason: 'e and π are connected by the beautiful equation e^(iπ)+1=0' },
              { id: 'gamma', reason: 'the Euler-Mascheroni constant is e\'s mysterious little sibling' }],
  phi:       [{ id: 'sqrt2', reason: 'another irrational number you can find with just a square' },
              { id: 'pi',    reason: 'the two most famous numbers in geometry' }],
  gamma:     [{ id: 'e',     reason: 'gamma is deeply connected to Euler\'s number e' },
              { id: 'ramanujan', reason: 'both are surprising results that feel impossible at first' }],
  sqrt2:     [{ id: 'phi',   reason: 'both are irrational numbers discovered by the ancient Greeks' },
              { id: 'pi',    reason: 'another irrational number, but from circles instead of squares' }],
  ramanujan: [{ id: 'gamma', reason: 'another constant that makes you go "wait, really?"' },
              { id: 'e',     reason: 'Euler\'s number — Ramanujan loved working with it' }],
}

const INITIAL_STATE: NumberLineState = {
  center: 0,
  pixelsPerUnit: 100,
}

export function NumberLine() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stateRef = useRef<NumberLineState>({ ...INITIAL_STATE })
  const rafRef = useRef<number>(0)
  const { resolvedTheme } = useTheme()
  const audioManager = useAudioManagerInstance()
  const phiExploreRef = usePhiExploreImage(resolvedTheme)

  // Debug controls for tick thresholds
  const [anchorMax, setAnchorMax] = useState(DEFAULT_TICK_THRESHOLDS.anchorMax)
  const [mediumMax, setMediumMax] = useState(DEFAULT_TICK_THRESHOLDS.mediumMax)

  // Debug controls for golden ratio demo tuning
  const [debugDecay, setDebugDecay] = useState(getStepTimingDecay)
  const [debugLogBase, setDebugLogBase] = useState(scrubberLogBase)

  // Debug controls for sieve tuning
  const [debugTrackingRange, setDebugTrackingRange] = useState(getSieveTrackingRange)
  const [debugFollowHops, setDebugFollowHops] = useState(getSieveFollowHops)
  const [debugSieveSpeed, setDebugSieveSpeed] = useState(getSieveSpeed)
  // Readout: arc counts at scrubber 50% and 75% — recomputed when params change
  const arcReadout = useMemo(() => {
    const p50 = scrubberToProgress(0.5)
    const p75 = scrubberToProgress(0.75)
    return { at50: arcCountAtProgress(p50), at75: arcCountAtProgress(p75) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debugDecay, debugLogBase])
  const thresholdsRef = useRef<TickThresholds>({ anchorMax, mediumMax })
  thresholdsRef.current = { anchorMax, mediumMax }

  // Track CSS dimensions for rendering
  const cssWidthRef = useRef(0)
  const cssHeightRef = useRef(0)

  // Zoom velocity for background color wash effect
  // Raw values track the instantaneous state; display values are slew-rate-limited
  // so the visible wash can't change faster than a fixed rate per ms.
  const zoomVelocityRef = useRef(0)
  const zoomHueRef = useRef(0)
  const displayVelocityRef = useRef(0)
  const displayHueRef = useRef(0)
  const lastDisplayTimeRef = useRef(0)
  // Focal point as fraction of canvas width (0-1)
  const zoomFocalXRef = useRef(0.5)
  const decayRafRef = useRef<number>(0)
  // Direct DOM ref for the wrapper — updated outside React for 60fps bg color
  const wrapperRef = useRef<HTMLDivElement>(null)

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
  // Use a ref to break the circular dependency: demo needs draw(), but draw() is defined later
  const drawFnRef = useRef<() => void>(() => {})
  const demoRedraw = useCallback(() => drawFnRef.current(), [])
  const { demoState: demoStateRef, startDemo, restoreDemo, tickDemo, cancelDemo, setRevealProgress, markUserInteraction } = useConstantDemo(
    stateRef, cssWidthRef, cssHeightRef, demoRedraw
  )
  // --- Constant demo narration (all constants) ---
  const narration = useConstantDemoNarration(demoStateRef, setRevealProgress, NARRATION_CONFIGS)

  // --- Demo URL restore (runs once on first resize) ---
  const hasRestoredRef = useRef(false)
  const [restoredFromUrl, setRestoredFromUrl] = useState(false)

  // --- Demo scrubber state ---
  const scrubberTrackRef = useRef<HTMLDivElement>(null)
  const scrubberFillRef = useRef<HTMLDivElement>(null)
  const scrubberThumbRef = useRef<HTMLDivElement>(null)
  const scrubberThumbVisualRef = useRef<HTMLDivElement>(null)
  const scrubberGapRef = useRef<HTMLDivElement>(null)
  const playPauseBtnRef = useRef<HTMLButtonElement>(null)
  const timeDisplayRef = useRef<HTMLDivElement>(null)
  const segmentTicksRef = useRef<HTMLDivElement>(null)
  const segmentLabelRef = useRef<HTMLDivElement>(null)
  const lastTickConstantIdRef = useRef<string | null>(null)
  const [demoActive, setDemoActive] = useState(false)
  const isDraggingScrubberRef = useRef(false)
  const scrubberHoverProgressRef = useRef<number | null>(null)

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
  const handleVoiceExploration = useCallback((constantId: string) => {
    exploreFnRef.current(constantId)
  }, [])
  const handleVoicePause = useCallback(() => { pauseFnRef.current() }, [])
  const handleVoiceResume = useCallback(() => { resumeFnRef.current() }, [])
  const handleVoiceSeek = useCallback((segIdx: number) => { seekFnRef.current(segIdx) }, [])
  const handleVoiceLookAt = useCallback((center: number, range: number) => { lookAtFnRef.current(center, range) }, [])
  const { state: voiceState, error: voiceError, dial, hangUp, timeRemaining, isSpeaking, transferTarget, conferenceNumbers, currentSpeaker, removeFromCall, sendSystemMessage } = useRealtimeVoice({
    onTransfer: handleVoiceTransfer,
    onStartExploration: handleVoiceExploration,
    onPauseExploration: handleVoicePause,
    onResumeExploration: handleVoiceResume,
    onSeekExploration: handleVoiceSeek,
    onLookAt: handleVoiceLookAt,
    isExplorationActiveRef,
  })
  const callBoxContainerRef = useRef<HTMLDivElement>(null)
  const voiceStateRef = useRef<CallState>('idle')
  voiceStateRef.current = voiceState
  const conferenceNumbersRef = useRef<number[]>([])
  conferenceNumbersRef.current = conferenceNumbers
  const isSpeakingRef = useRef(false)
  isSpeakingRef.current = isSpeaking
  // Track when the voice agent last stopped speaking (for segment gate release)
  const agentLastSpokeRef = useRef(0)
  // Debug: log overlay render condition changes
  useEffect(() => {
    const shouldShow = callingNumber !== null && voiceState !== 'idle'
    console.log('[NumberLine] overlay condition — callingNumber:', callingNumber, 'voiceState:', voiceState, 'shouldShow:', shouldShow)
  }, [callingNumber, voiceState])
  // Clear callingNumber when call ends (e.g. model hangs up).
  // Only clear when voiceState *transitions* to idle (not on initial mount
  // or when callingNumber is set before dial() goes async).
  const prevVoiceStateRef = useRef<CallState>('idle')
  useEffect(() => {
    const prev = prevVoiceStateRef.current
    prevVoiceStateRef.current = voiceState
    // Only clear if we transitioned TO idle FROM a non-idle state
    if (voiceState === 'idle' && prev !== 'idle' && callingNumber !== null) {
      console.log('[NumberLine] clearing callingNumber because voiceState transitioned', prev, '→ idle')
      setCallingNumber(null)
    }
  }, [voiceState, callingNumber])
  // Mute TTS narration audio during voice calls — the sequencer still runs
  // (pacing the animation) but skips actual audio playback so the voice
  // agent can narrate instead.
  useEffect(() => {
    narration.mutedRef.current = voiceState === 'active'
    // If a call just connected and narration is already playing, stop the
    // current TTS clip (sequencer will continue muted from next segment)
    if (voiceState === 'active' && narration.isNarrating.current) {
      audioManager.stop()
    }
  }, [voiceState, narration, audioManager])

  // --- Find the Number game state ---
  const [gameState, setGameState] = useState<FindTheNumberGameState>('idle')
  const targetRef = useRef<{ value: number; emoji: string } | null>(null)
  const gameStateRef = useRef<FindTheNumberGameState>('idle')
  gameStateRef.current = gameState
  // Audio zone state — zone triggers React effects for transition detection
  const [audioZone, setAudioZone] = useState<ProximityZone | null>(null)
  const prevGameZoneRef = useRef<ProximityZone | null>(null)
  // Live proximity data for the audio hook (updated every frame in draw())
  const proximityRef = useRef<ProximityResult | null>(null)
  // Ref to hold the current render target (computed in draw, used by renderNumberLine)
  const renderTargetRef = useRef<RenderTarget | undefined>(undefined)
  // Animation frame for game loop (continuous redraws while game is active)
  const gameRafRef = useRef<number>(0)

  // Set a CSS custom property on the page-level container so the wash extends
  // seamlessly beyond the canvas (e.g. into iPhone safe areas).
  const pageRef = useRef<HTMLElement | null>(null)

  // Find the page container on mount (walks up to [data-component="number-line-page"])
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    pageRef.current = wrapper.closest('[data-component="number-line-page"]') as HTMLElement | null
  }, [])

  // Exponential moving average low-pass filter for display values.
  // TAU controls the time constant: 63% of a step change reached in TAU ms.
  // Crucially, oscillating inputs (rapid zoom direction changes) naturally
  // average toward zero, suppressing the flash.
  const WASH_TAU = 150 // ms
  const updateDisplayValues = useCallback(() => {
    const now = performance.now()
    const dt = Math.min(now - (lastDisplayTimeRef.current || now), 50)
    lastDisplayTimeRef.current = now
    if (dt <= 0) return

    const alpha = 1 - Math.exp(-dt / WASH_TAU)
    displayVelocityRef.current += (zoomVelocityRef.current - displayVelocityRef.current) * alpha
    displayHueRef.current += (zoomHueRef.current - displayHueRef.current) * alpha
  }, [])

  const updateWrapperBg = useCallback((velocity: number, hue: number) => {
    const page = pageRef.current
    if (!page) return
    if (Math.abs(velocity) < 0.001) {
      page.style.backgroundColor = ''
      return
    }
    const isDark = resolvedTheme === 'dark'
    // Blend the wash color with the page's base background
    const baseR = isDark ? 17 : 249 // #111827 / #f9fafb
    const baseG = isDark ? 24 : 250
    const baseB = isDark ? 39 : 251
    const edgeIntensity = Math.min(Math.abs(velocity) * 1.5, 0.18)
    const lum = isDark ? 30 : 70
    // Compute the wash color in RGB for proper blending with the base
    // Convert HSL → approximate RGB for the wash overlay
    const sat = 0.8
    const l = lum / 100
    const a = sat * Math.min(l, 1 - l)
    const f = (n: number) => {
      const k = (n + hue / 30) % 12
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    }
    const wR = f(0) * 255
    const wG = f(8) * 255
    const wB = f(4) * 255
    // Alpha-blend wash over base
    const r = Math.round(baseR * (1 - edgeIntensity) + wR * edgeIntensity)
    const g = Math.round(baseG * (1 - edgeIntensity) + wG * edgeIntensity)
    const b = Math.round(baseB * (1 - edgeIntensity) + wB * edgeIntensity)
    page.style.backgroundColor = `rgb(${r}, ${g}, ${b})`
  }, [resolvedTheme])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const cssWidth = cssWidthRef.current
    const cssHeight = cssHeightRef.current

    // Compute proximity for Find the Number game
    const target = targetRef.current
    let renderTarget: RenderTarget | undefined
    if (target && gameStateRef.current === 'active') {
      const prox = computeProximity(target.value, stateRef.current, cssWidth)
      renderTarget = { value: target.value, emoji: target.emoji, opacity: prox.opacity }

      // Update live proximity ref every frame for audio hints
      proximityRef.current = prox

      // Update audio zone state when zone changes (triggers React effects)
      if (prox.zone !== prevGameZoneRef.current) {
        prevGameZoneRef.current = prox.zone
        setAudioZone(prox.zone)
      }

      // Detect found
      if (prox.zone === 'found') {
        setGameState('found')
      }
    } else if (target && gameStateRef.current === 'found') {
      // Keep emoji visible at full opacity in found state
      const prox = computeProximity(target.value, stateRef.current, cssWidth)
      renderTarget = { value: target.value, emoji: target.emoji, opacity: Math.max(prox.opacity, 0.9) }
    }
    renderTargetRef.current = renderTarget

    // Compute constant visibilities
    let renderConstants: RenderConstant[] | undefined
    if (constantsEnabledRef.current) {
      renderConstants = computeAllConstantVisibilities(
        MATH_CONSTANTS, stateRef.current, cssWidth, discoveredIdsRef.current
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
      visiblePrimesSetRef.current = new Set(interestingPrimes.map(ip => ip.value))

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
      const primeValues = interestingPrimes.map(ip => ip.value)
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

    // Write demo state to URL params (debounced).
    // Skip until restore has been attempted — otherwise the first draw()
    // (which runs before restore) clears the params while demo is still idle.
    if (hasRestoredRef.current) {
      const ds = demoStateRef.current
      if (ds.phase !== 'idle' && ds.constantId) {
        updateDemoUrlParams(ds.constantId, ds.revealProgress)
      } else {
        updateDemoUrlParams(null, 0)
      }
    }

    // Track whether an exploration is active (used by call timer to freeze countdown)
    isExplorationActiveRef.current = demoStateRef.current.phase !== 'idle' && demoStateRef.current.phase !== 'fading'

    // Feed narration segment updates to voice agent during active call.
    // Uses the sequencer's actual segment index (not revealProgress) to gate
    // cues — prevents premature firing when animation finishes a segment
    // before the voice agent does.
    if (voiceStateRef.current === 'active') {
      const ds = demoStateRef.current
      if (ds.phase !== 'idle' && ds.constantId) {
        const cfg = NARRATION_CONFIGS[ds.constantId]
        if (cfg) {
          // Use the narration sequencer's real segment index
          const segIdx = narration.isNarrating.current
            ? narration.segmentIndexRef.current
            : -1
          // Send cue when the sequencer advances to a new segment
          if (segIdx >= 0 && segIdx !== voiceExplorationSegmentRef.current) {
            voiceExplorationSegmentRef.current = segIdx
            const seg = cfg.segments[segIdx]
            const label = seg.scrubberLabel || `Part ${segIdx + 1}`
            const isLast = segIdx === cfg.segments.length - 1
            sendSystemMessage(
              `[System: Segment ${segIdx + 1}/${cfg.segments.length} — "${label}" is now playing.\n` +
              `NARRATOR — say this now (in your own voice, keeping pace with the animation): ${seg.ttsText}\n` +
              `The animation is playing alongside you. When you finish speaking, pause briefly so the next segment can start.` +
              (conferenceNumbersRef.current.length > 1
                ? `\nOther participants: after the narrator finishes this part, you may add a brief reaction${isLast ? ' before the wrap-up' : ''}.`
                : '') +
              `]`,
              true
            )
          }
          // Notify when exploration completes
          if (ds.revealProgress >= 1 && voiceExplorationSegmentRef.current !== cfg.segments.length) {
            voiceExplorationSegmentRef.current = cfg.segments.length
            const display = DEMO_DISPLAY[ds.constantId]
            const recs = EXPLORATION_RECOMMENDATIONS[ds.constantId] ?? []
            const recText = recs.length > 0
              ? ` If the child seems into it, casually suggest one of these: ${recs.map(r => {
                  const d = DEMO_DISPLAY[r.id]
                  return `${d?.name ?? r.id} (${r.reason})`
                }).join('; ')}. Don't list them all — just pick whichever feels most natural for the conversation and mention it casually.`
              : ''
            sendSystemMessage(
              `[System: The ${display?.name ?? ds.constantId} exploration has finished! ` +
              `Everyone can discuss now — narrator, share why you love this constant. ` +
              `Others, ask questions or share what surprised you. ` +
              `Ask the child what they thought.${recText}]`,
              true
            )
          }

          // Auto-release the TTS gate when the voice agent stops speaking.
          // The muted sequencer holds at each segment boundary (ttsFinished=false)
          // so the animation waits for the agent. Once the agent is silent for ~1s
          // we advance to the next segment automatically.
          if (narration.mutedRef.current && narration.isNarrating.current) {
            const now = performance.now()
            if (isSpeakingRef.current) {
              agentLastSpokeRef.current = now
            } else if (agentLastSpokeRef.current > 0 && now - agentLastSpokeRef.current > 1000) {
              narration.releaseTtsGate()
              agentLastSpokeRef.current = 0 // reset so we don't re-release next frame
            }
          }
        }
      }
    }

    // Tick the prime tour state machine (updates viewport during flights)
    tickTour()

    // Effective hovered value: tour forced hover overrides user hover
    // Read directly from tourStateRef to avoid stale closure
    const tourForced = (() => {
      const ts = tourStateRef.current
      if (ts.phase === 'idle' || ts.phase === 'fading' || ts.stopIndex === null) return null
      return PRIME_TOUR_STOPS[ts.stopIndex]?.hoverValue ?? null
    })()
    const effectiveHovered = tourForced ?? hoveredValueRef.current

    // Compute tour spotlight highlight set (phase-aware)
    const tourTs = tourStateRef.current
    const tourStop = tourTs.stopIndex !== null ? PRIME_TOUR_STOPS[tourTs.stopIndex] : null
    const dimAmount = tourStop?.dimOthers ?? 0

    let highlightSet: Set<number> | undefined
    let highlightedArcSet: Set<string> | undefined

    if (tourStop?.highlightPhases && tourStop.highlightPhases.length > 0) {
      // Phase-based: accumulate values/arcs based on dwell elapsed time
      const dwellElapsed = tourTs.phase === 'dwelling'
        ? performance.now() - tourTs.dwellStartMs
        : tourTs.phase === 'fading' ? Infinity  // show all during fade-out
        : -1                                     // flying/idle: no phases yet

      const values: number[] = []
      const arcPairs: [number, number][] = []
      for (const phase of tourStop.highlightPhases) {
        if (phase.delayMs <= dwellElapsed) {
          values.push(...phase.values)
          if (phase.arcs) arcPairs.push(...phase.arcs)
        }
      }
      highlightSet = values.length > 0 ? new Set(values) : undefined
      if (arcPairs.length > 0) {
        highlightedArcSet = new Set(arcPairs.map(([a, b]) =>
          a < b ? `${a}-${b}` : `${b}-${a}`
        ))
      }
    } else if (tourStop?.highlightValues?.length) {
      // Legacy: all values at once, no arc filtering
      highlightSet = new Set(tourStop.highlightValues)
    }

    // Compute sieve tick transforms during ancient-trick tour stop
    let sieveTransforms: Map<number, SieveTickTransform> | undefined
    let sieveUniformity = 0
    if (tourTs.phase !== 'idle' && tourStop?.id === 'ancient-trick') {
      const sieveDwellElapsed = tourTs.phase === 'dwelling'
        ? tourTs.virtualDwellMs
        : tourTs.phase === 'fading' ? Infinity : 0
      const viewportRight = stateRef.current.center + cssWidth / (2 * stateRef.current.pixelsPerUnit)
      // Use max of SWEEP_MAX_N and viewport edge so composites beyond 120 are also hidden
      const sieveMaxN = Math.max(SWEEP_MAX_N, Math.ceil(viewportRight) + 5)
      sieveTransforms = computeSieveTickTransforms(sieveMaxN, sieveDwellElapsed, cssHeight, viewportRight)
      // Smoothly ramp tick uniformity over first 2s (ease-out quad)
      const rawT = Math.min(1, sieveDwellElapsed / 2000)
      sieveUniformity = rawT * (2 - rawT)
    }

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0) // reset any existing transform
    ctx.scale(dpr, dpr)
    const fadeAnimating = renderNumberLine(
      ctx, stateRef.current, cssWidth, cssHeight,
      resolvedTheme === 'dark', thresholdsRef.current,
      displayVelocityRef.current, displayHueRef.current, zoomFocalXRef.current,
      renderTarget, collisionFadeMapRef.current, renderConstants,
      primeInfos, effectiveHovered, interestingPrimes, primePairArcs,
      highlightSet, highlightedArcSet, sieveTransforms, sieveUniformity
    )

    // Render constant demo overlay (golden ratio, etc.)
    const ds = demoStateRef.current

    // Render phi explore image behind the spiral (fades in during final 25%)
    if (ds.phase !== 'idle' && ds.constantId === 'phi' && ds.revealProgress > 0.75) {
      const pe = phiExploreRef.current
      if (pe) {
        const t = (ds.revealProgress - 0.75) / 0.25 // 0→1 over final quarter
        const imageOpacity = t * t * (3 - 2 * t) * ds.opacity // smoothstep × demo opacity
        renderPhiExploreImage(
          ctx, stateRef.current, cssWidth, cssHeight,
          ds.revealProgress, imageOpacity, pe.image, pe.alignment
        )
      }
    }

    if (ds.phase !== 'idle' && ds.constantId === 'phi') {
      renderGoldenRatioOverlay(
        ctx, stateRef.current, cssWidth, cssHeight,
        resolvedTheme === 'dark', ds.revealProgress, ds.opacity
      )
    }
    if (ds.phase !== 'idle' && ds.constantId === 'pi') {
      renderPiOverlay(
        ctx, stateRef.current, cssWidth, cssHeight,
        resolvedTheme === 'dark', ds.revealProgress, ds.opacity
      )
    }
    if (ds.phase !== 'idle' && ds.constantId === 'tau') {
      renderTauOverlay(
        ctx, stateRef.current, cssWidth, cssHeight,
        resolvedTheme === 'dark', ds.revealProgress, ds.opacity
      )
    }
    if (ds.phase !== 'idle' && ds.constantId === 'e') {
      renderEOverlay(
        ctx, stateRef.current, cssWidth, cssHeight,
        resolvedTheme === 'dark', ds.revealProgress, ds.opacity
      )
    }
    if (ds.phase !== 'idle' && ds.constantId === 'gamma') {
      renderGammaOverlay(
        ctx, stateRef.current, cssWidth, cssHeight,
        resolvedTheme === 'dark', ds.revealProgress, ds.opacity
      )
    }
    if (ds.phase !== 'idle' && ds.constantId === 'sqrt2') {
      renderSqrt2Overlay(
        ctx, stateRef.current, cssWidth, cssHeight,
        resolvedTheme === 'dark', ds.revealProgress, ds.opacity
      )
    }
    if (ds.phase !== 'idle' && ds.constantId === 'ramanujan') {
      renderRamanujanOverlay(
        ctx, stateRef.current, cssWidth, cssHeight,
        resolvedTheme === 'dark', ds.revealProgress, ds.opacity
      )
    }

    // Render sieve animation during ancient-trick tour stop
    if (tourTs.phase !== 'idle' && tourStop?.id === 'ancient-trick') {
      const sieveDwellElapsed = tourTs.phase === 'dwelling'
        ? tourTs.virtualDwellMs
        : tourTs.phase === 'fading' ? Infinity
        : 0
      renderSieveOverlay(
        ctx, stateRef.current, cssWidth, cssHeight,
        resolvedTheme === 'dark', sieveDwellElapsed, tourTs.opacity
      )
    }

    // Render tour spotlight (dim overlay + pulse glow)
    if (tourTs.phase !== 'idle' && highlightSet && highlightSet.size > 0 && dimAmount > 0) {
      renderTourSpotlight(
        ctx, stateRef.current, cssWidth, cssHeight,
        resolvedTheme === 'dark', [...highlightSet], dimAmount, tourTs.opacity
      )
    }

    ctx.restore()

    // --- Sync demo scrubber DOM ---
    const isActive = ds.phase !== 'idle'
    const scrubberPct = progressToScrubber(ds.revealProgress) * 100
    if (scrubberTrackRef.current) {
      scrubberTrackRef.current.style.opacity = isActive ? String(ds.opacity) : '0'
      scrubberTrackRef.current.style.pointerEvents = isActive && ds.opacity > 0.1 ? 'auto' : 'none'
      // ARIA: update slider value
      scrubberTrackRef.current.setAttribute('aria-valuenow', String(Math.round(ds.revealProgress * 100)))
      scrubberTrackRef.current.setAttribute('aria-valuetext', `${Math.round(ds.revealProgress * 100)}% convergence progress`)
    }
    if (scrubberFillRef.current) {
      scrubberFillRef.current.style.width = `${scrubberPct}%`
    }
    if (scrubberThumbRef.current) {
      scrubberThumbRef.current.style.left = `${scrubberPct}%`
    }
    // Convergence gap indicator (phi only)
    if (scrubberGapRef.current) {
      if (ds.constantId === 'phi') {
        const gap = convergenceGapAtProgress(ds.revealProgress)
        const maxWidth = 60
        scrubberGapRef.current.style.width = `${gap * maxWidth}px`
        scrubberGapRef.current.style.left = `calc(${scrubberPct}% - ${(gap * maxWidth) / 2}px)`
        // Color: warm (red/amber) when large gap, cool (green) when converged
        const r = Math.round(220 * gap + 34 * (1 - gap))
        const g = Math.round(80 * gap + 197 * (1 - gap))
        const b = Math.round(40 * gap + 94 * (1 - gap))
        scrubberGapRef.current.style.backgroundColor = `rgb(${r}, ${g}, ${b})`
        scrubberGapRef.current.style.opacity = isActive && ds.opacity > 0.1 ? '1' : '0'
      } else {
        scrubberGapRef.current.style.opacity = '0'
      }
    }
    // Sync play/pause button DOM
    if (playPauseBtnRef.current) {
      playPauseBtnRef.current.style.opacity = isActive ? String(ds.opacity) : '0'
      playPauseBtnRef.current.style.pointerEvents = isActive && ds.opacity > 0.1 ? 'auto' : 'none'
      // Swap SVG path based on narrating state
      const svgPath = playPauseBtnRef.current.querySelector('path')
      if (svgPath) {
        svgPath.setAttribute('d', narration.isNarrating.current
          ? 'M6 4h4v16H6zm8 0h4v16h-4z'   // pause icon
          : 'M8 5v14l11-7z'                 // play icon
        )
      }
    }
    // Sync time display DOM
    if (timeDisplayRef.current) {
      timeDisplayRef.current.style.opacity = isActive ? String(ds.opacity) : '0'
      const cfg = ds.constantId ? NARRATION_CONFIGS[ds.constantId] : null
      if (cfg && cfg.segments.length > 0) {
        // Compute elapsed and total designed time from revealProgress
        let elapsedMs = 0
        let totalMs = 0
        for (const seg of cfg.segments) {
          const segSpan = seg.endProgress - seg.startProgress
          totalMs += seg.animationDurationMs
          if (ds.revealProgress >= seg.endProgress) {
            elapsedMs += seg.animationDurationMs
          } else if (ds.revealProgress > seg.startProgress) {
            const frac = segSpan > 0 ? (ds.revealProgress - seg.startProgress) / segSpan : 0
            elapsedMs += frac * seg.animationDurationMs
          }
        }
        const fmtTime = (ms: number) => {
          const s = Math.round(ms / 1000)
          const m = Math.floor(s / 60)
          const sec = s % 60
          return `${m}:${String(sec).padStart(2, '0')}`
        }
        timeDisplayRef.current.textContent = `${fmtTime(elapsedMs)} / ${fmtTime(totalMs)}`
      } else {
        timeDisplayRef.current.textContent = ''
      }
    }
    // Sync segment tick marks (rebuild only when constantId changes)
    if (segmentTicksRef.current) {
      const cid = ds.constantId
      if (cid !== lastTickConstantIdRef.current) {
        lastTickConstantIdRef.current = cid
        const cfg = cid ? NARRATION_CONFIGS[cid] : null
        if (cfg && cfg.segments.length > 0) {
          const boundaries = new Set<number>()
          for (const seg of cfg.segments) {
            if (seg.startProgress > 0.001 && seg.startProgress < 0.999) boundaries.add(seg.startProgress)
            if (seg.endProgress > 0.001 && seg.endProgress < 0.999) boundaries.add(seg.endProgress)
          }
          const isDark = resolvedTheme === 'dark'
          const tickColor = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)'
          let html = ''
          for (const bp of boundaries) {
            const pct = progressToScrubber(bp) * 100
            html += `<div data-element="segment-tick" style="position:absolute;left:${pct.toFixed(3)}%;top:50%;width:1.5px;height:12px;transform:translateX(-50%) translateY(-50%);background:${tickColor};border-radius:0.75px;pointer-events:none"></div>`
          }
          segmentTicksRef.current.innerHTML = html
        } else {
          segmentTicksRef.current.innerHTML = ''
        }
      }
    }
    // Sync floating segment label (visible while scrubbing or hovering)
    if (segmentLabelRef.current) {
      // Determine which progress value to use for label lookup:
      // dragging takes priority, then hover, otherwise hidden
      const labelProgress = isDraggingScrubberRef.current
        ? ds.revealProgress
        : scrubberHoverProgressRef.current
      if (labelProgress !== null && isActive && ds.constantId) {
        const cfg = NARRATION_CONFIGS[ds.constantId]
        const seg = cfg?.segments.find(
          s => labelProgress >= s.startProgress && labelProgress < s.endProgress
        ) ?? cfg?.segments[cfg.segments.length - 1] // fallback to last if at 1.0
        if (seg?.scrubberLabel) {
          const midProgress = (seg.startProgress + seg.endProgress) / 2
          const midPct = progressToScrubber(midProgress) * 100
          segmentLabelRef.current.style.opacity = '1'
          segmentLabelRef.current.style.left = `${midPct}%`
          segmentLabelRef.current.textContent = seg.scrubberLabel
        } else {
          segmentLabelRef.current.style.opacity = '0'
        }
      } else {
        segmentLabelRef.current.style.opacity = '0'
      }
    }
    // Sync React state for conditional rendering (batch with rAF)
    if (isActive && !demoActive) setDemoActive(true)
    else if (!isActive && demoActive) setDemoActive(false)

    // Sync MathML DOM overlays with canvas
    if (constantMarkersRef.current && renderConstants) {
      const maxTickHeight = Math.min(40, cssHeight * 0.3)
      updateConstantMarkerDOM(
        constantMarkersRef.current, renderConstants, MATH_CONSTANTS,
        cssHeight / 2, maxTickHeight, resolvedTheme === 'dark'
      )
    } else if (constantMarkersRef.current) {
      // Constants disabled — clear any remaining DOM elements
      updateConstantMarkerDOM(
        constantMarkersRef.current, [], MATH_CONSTANTS,
        cssHeight / 2, 0, resolvedTheme === 'dark'
      )
    }

    // Position call boxes at their number's screen-X
    if (callBoxContainerRef.current && voiceStateRef.current === 'active') {
      updateCallBoxPositions(
        callBoxContainerRef.current,
        stateRef.current.center,
        stateRef.current.pixelsPerUnit,
        cssWidth,
        cssHeight,
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

  // Keep the demo's redraw ref pointing at the latest draw function
  drawFnRef.current = draw

  const scheduleRedraw = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      draw()
    })
  }, [draw])

  // Decay loop for zoom velocity — keeps redrawing until the wash fades out
  const startDecay = useCallback(() => {
    if (decayRafRef.current) return
    const tick = () => {
      // Decay raw velocity
      zoomVelocityRef.current *= 0.88

      // Lerp raw hue toward direction target
      if (Math.abs(zoomVelocityRef.current) > 0.01) {
        const targetHue = zoomVelocityRef.current > 0 ? 220 : 25
        zoomHueRef.current += (targetHue - zoomHueRef.current) * 0.08
      }

      // Rate-limit display values and sync wrapper background
      updateDisplayValues()
      updateWrapperBg(displayVelocityRef.current, displayHueRef.current)

      // Keep looping until both raw and display values have settled
      if (Math.abs(zoomVelocityRef.current) < 0.001 && Math.abs(displayVelocityRef.current) < 0.001) {
        zoomVelocityRef.current = 0
        displayVelocityRef.current = 0
        decayRafRef.current = 0
        draw()
        return
      }
      draw()
      decayRafRef.current = requestAnimationFrame(tick)
    }
    decayRafRef.current = requestAnimationFrame(tick)
  }, [draw, updateWrapperBg, updateDisplayValues])

  const handleZoomVelocity = useCallback((velocity: number, focalX: number) => {
    // Accumulate raw velocity
    zoomVelocityRef.current = zoomVelocityRef.current * 0.6 + velocity * 8

    // Smoothly move focal point toward the new zoom point
    zoomFocalXRef.current += (focalX - zoomFocalXRef.current) * 0.3

    // Nudge raw hue toward direction
    const targetHue = zoomVelocityRef.current > 0 ? 220 : 25
    zoomHueRef.current += (targetHue - zoomHueRef.current) * 0.15

    startDecay()
  }, [startDecay])

  // --- Find the Number game loop ---
  // Continuous redraw while game is active (for glow pulsing and proximity updates)
  useEffect(() => {
    if (gameState !== 'active') {
      if (gameRafRef.current) {
        cancelAnimationFrame(gameRafRef.current)
        gameRafRef.current = 0
      }
      return
    }
    const tick = () => {
      draw()
      gameRafRef.current = requestAnimationFrame(tick)
    }
    gameRafRef.current = requestAnimationFrame(tick)
    return () => {
      if (gameRafRef.current) {
        cancelAnimationFrame(gameRafRef.current)
        gameRafRef.current = 0
      }
    }
  }, [gameState, draw])

  const handleGameStart = useCallback((target: number, emoji: string) => {
    targetRef.current = { value: target, emoji }
    prevGameZoneRef.current = null
    proximityRef.current = null
    setAudioZone(null)
    setGameState('active')
    draw()
  }, [draw])

  const handleGameGiveUp = useCallback(() => {
    targetRef.current = null
    prevGameZoneRef.current = null
    proximityRef.current = null
    renderTargetRef.current = undefined
    setAudioZone(null)
    setGameState('idle')
    draw()
  }, [draw])

  // Audio feedback for the game
  useFindTheNumberAudio(audioZone, proximityRef)

  // --- Hover handler for prime tooltips (primes only) ---
  const handleHover = useCallback((hoverScreenX: number, _hoverScreenY: number) => {
    // Suppress user hover during prime tour (forced hover handles it)
    if (tourStateRef.current.phase !== 'idle') return

    if (hoverScreenX < 0) {
      if (hoveredValueRef.current !== null) {
        setHoveredValue(null)
        scheduleRedraw()
      }
      return
    }
    if (!primesEnabledRef.current) {
      if (hoveredValueRef.current !== null) setHoveredValue(null)
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
      let closest: typeof renderedPrimes[number] | null = null
      let closestDist = Infinity
      for (const rp of renderedPrimes) {
        const d = Math.abs(hoverScreenX - rp.screenX)
        if (d < closestDist) { closest = rp; closestDist = d }
      }
      if (closest && closestDist < 20) {
        if (hoveredValueRef.current !== closest.value) {
          setHoveredValue(closest.value)
          scheduleRedraw()
        }
        return
      }
    }

    // No prime nearby
    if (hoveredValueRef.current !== null) {
      setHoveredValue(null)
      scheduleRedraw()
    }
  }, [scheduleRedraw])

  // --- Constants + non-prime integer tap handler ---
  const handleCanvasTap = useCallback((screenX: number, _screenY: number) => {
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
        setDiscoveredIds(prev => {
          const next = new Set(prev)
          next.add(closest!.id)
          try {
            localStorage.setItem('number-line-discovered-constants', JSON.stringify([...next]))
          } catch { /* ignore */ }
          return next
        })
        setTappedConstantId(closest.id)
        setTappedIntValue(null)
        draw()
        return
      }
    }

    // Check for non-prime integer tap (composites + 1)
    if (primesEnabledRef.current) {
      const cssWidth = cssWidthRef.current
      const state = stateRef.current
      const value = screenXToNumber(screenX, state.center, state.pixelsPerUnit, cssWidth)
      const nearest = Math.round(value)
      const nearestScreenX = numberToScreenX(nearest, state.center, state.pixelsPerUnit, cssWidth)
      const dist = Math.abs(screenX - nearestScreenX)

      if (dist < 20 && nearest >= 1) {
        const isPrime = nearest >= 2 && smallestPrimeFactor(nearest) === nearest
        if (!isPrime) {
          setTappedConstantId(null)
          setTappedIntValue(nearest)
          return
        }
      }
    }

    // Tap on empty space dismisses everything
    setTappedConstantId(null)
    setTappedIntValue(null)
  }, [draw])

  // --- Long-press handler for "Talk to a Number" ---
  const handleCanvasLongPress = useCallback((screenX: number, _screenY: number) => {
    console.log('[NumberLine] handleCanvasLongPress fired, screenX:', screenX, 'current callingNumber:', callingNumber, 'voiceState:', voiceStateRef.current)
    const cssWidth = cssWidthRef.current
    const state = stateRef.current
    const value = screenXToNumber(screenX, state.center, state.pixelsPerUnit, cssWidth)
    // Snap to nearest integer if close enough
    const nearest = Math.round(value)
    const nearestScreenX = numberToScreenX(nearest, state.center, state.pixelsPerUnit, cssWidth)
    const dist = Math.abs(screenX - nearestScreenX)
    const numberToCall = dist < 30 ? nearest : parseFloat(value.toPrecision(6))
    console.log('[NumberLine] calling setCallingNumber(%s) and dial(%s)', numberToCall, numberToCall)
    setCallingNumber(numberToCall)
    dial(numberToCall)
  }, [dial, callingNumber])

  // Touch/mouse/wheel handling
  const handleStateChange = useCallback(() => {
    setRestoredFromUrl(false)
    markUserInteraction()
    scheduleRedraw()
  }, [markUserInteraction, scheduleRedraw])

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
        const params = new URLSearchParams(window.location.search)
        const demoId = params.get('demo')
        const progressStr = params.get('p')
        if (demoId && DEMO_AVAILABLE.has(demoId)) {
          const progress = progressStr !== null ? parseFloat(progressStr) : 0
          if (!isNaN(progress)) {
            restoreDemo(demoId, progress)
            narration.markTriggered(demoId)
            setRestoredFromUrl(true)
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

  // Redraw when debug thresholds change
  useEffect(() => {
    draw()
  }, [anchorMax, mediumMax, draw])

  // Animate viewport to fit all conference call participants
  const callFlyRef = useRef<{ src: Viewport; tgt: Viewport; startMs: number; raf: number } | null>(null)
  useEffect(() => {
    if (conferenceNumbers.length === 0 || voiceState !== 'active') {
      // Cancel any in-progress fly animation
      if (callFlyRef.current) {
        cancelAnimationFrame(callFlyRef.current.raf)
        callFlyRef.current = null
      }
      return
    }

    const cssWidth = cssWidthRef.current
    if (cssWidth <= 0) return

    // Compute target viewport that fits all numbers with padding
    const lo = Math.min(...conferenceNumbers)
    const hi = Math.max(...conferenceNumbers)
    const span = hi - lo
    const center = (lo + hi) / 2

    let targetPpu: number
    if (span === 0) {
      // Single number — zoom to show ~10 units of context
      targetPpu = cssWidth / 10
    } else {
      // Fit the range with 30% padding on each side
      targetPpu = cssWidth * 0.4 / span
    }
    // Don't zoom in more than current level if we already fit
    const currentPpu = stateRef.current.pixelsPerUnit
    const screenLo = (center - lo) * currentPpu
    const screenHi = (hi - center) * currentPpu
    const alreadyFits = screenLo < cssWidth * 0.4 && screenHi < cssWidth * 0.4
      && Math.abs(stateRef.current.center - center) * currentPpu < cssWidth * 0.3
    if (alreadyFits && conferenceNumbers.length <= 1) {
      draw()
      return
    }

    // Clamp: don't zoom out excessively, don't zoom in past current level
    targetPpu = Math.min(targetPpu, Math.max(currentPpu, cssWidth / 10))

    const src: Viewport = { center: stateRef.current.center, pixelsPerUnit: stateRef.current.pixelsPerUnit }
    const tgt: Viewport = { center, pixelsPerUnit: targetPpu }
    const startMs = performance.now()
    const durationMs = 800

    // Cancel previous animation
    if (callFlyRef.current) cancelAnimationFrame(callFlyRef.current.raf)

    const fly = callFlyRef.current = { src, tgt, startMs, raf: 0 }

    const tick = () => {
      const elapsed = performance.now() - fly.startMs
      const t = lerpViewport(fly.src, fly.tgt, elapsed, durationMs, stateRef.current)
      draw()
      if (t < 1) {
        fly.raf = requestAnimationFrame(tick)
      } else {
        callFlyRef.current = null
      }
    }
    fly.raf = requestAnimationFrame(tick)

    return () => {
      if (callFlyRef.current) {
        cancelAnimationFrame(callFlyRef.current.raf)
        callFlyRef.current = null
      }
    }
  }, [conferenceNumbers, voiceState, draw])

  // Assign look_at implementation now that callFlyRef and stateRef are in scope
  lookAtFnRef.current = (center: number, range: number) => {
    const cssWidth = cssWidthRef.current
    if (cssWidth <= 0) return

    const targetPpu = cssWidth / Math.max(range, 0.01)

    const src: Viewport = { center: stateRef.current.center, pixelsPerUnit: stateRef.current.pixelsPerUnit }
    const tgt: Viewport = { center, pixelsPerUnit: targetPpu }
    const startMs = performance.now()
    const durationMs = 800

    if (callFlyRef.current) cancelAnimationFrame(callFlyRef.current.raf)

    const fly = callFlyRef.current = { src, tgt, startMs, raf: 0 }
    const tick = () => {
      const elapsed = performance.now() - fly.startMs
      const t = lerpViewport(fly.src, fly.tgt, elapsed, durationMs, stateRef.current)
      draw()
      if (t < 1) {
        fly.raf = requestAnimationFrame(tick)
      } else {
        callFlyRef.current = null
      }
    }
    fly.raf = requestAnimationFrame(tick)
  }

  // Find tapped constant data for info card
  const tappedConstant = useMemo(
    () => tappedConstantId ? MATH_CONSTANTS.find(c => c.id === tappedConstantId) ?? null : null,
    [tappedConstantId]
  )
  // Find screen position of tapped constant from last render
  const tappedScreenX = useMemo(() => {
    if (!tappedConstantId) return 0
    const rc = renderConstantsRef.current.find(c => c.id === tappedConstantId)
    return rc?.screenX ?? 0
  }, [tappedConstantId])

  const handleDismissInfoCard = useCallback(() => {
    console.log('[NumberLine] handleDismissInfoCard — calling audioManager.stop()')
    audioManager.stop()
    setTappedConstantId(null)
  }, [audioManager])

  const handleCallNumber = useCallback((n: number) => {
    setCallingNumber(n)
    setTappedConstantId(null)
    setTappedIntValue(null)
    dial(n)
  }, [dial])

  const handleExploreConstant = useCallback((constantId: string) => {
    console.log('[NumberLine] handleExploreConstant — calling audioManager.stop() then startDemo', constantId)
    audioManager.stop()
    exitTour()
    narration.reset()

    const onCall = voiceStateRef.current === 'active'

    if (onCall) {
      // Start paused at progress 0 — narrator introduces first, then calls resume
      restoreDemo(constantId, 0)
      narration.markTriggered(constantId) // suppress narration auto-start
    } else {
      startDemo(constantId)
    }

    // If on a voice call, send narration context and designate a narrator
    if (onCall) {
      const cfg = NARRATION_CONFIGS[constantId]
      const display = DEMO_DISPLAY[constantId]
      if (cfg && display) {
        // Build an outline of segment labels (no full text — text arrives per-segment)
        const outline = cfg.segments.map((seg, i) => {
          const label = seg.scrubberLabel || `Part ${i + 1}`
          return `${i + 1}. "${label}"`
        }).join('\n')

        // Pick the narrator: the number closest to the constant's value
        const nums = conferenceNumbersRef.current
        let narrator = nums[0] ?? callingNumber
        if (nums.length > 1) {
          let bestDist = Infinity
          for (const n of nums) {
            const d = Math.abs(n - display.value)
            if (d < bestDist) { bestDist = d; narrator = n }
          }
        }
        const others = nums.filter(n => n !== narrator)
        const othersDesc = others.length > 0
          ? `\n\nOTHER PARTICIPANTS (${others.join(', ')}): You are the audience. Make brief, in-character reactions between segments — ` +
            `ask a quick question, or relate it to yourselves. Keep interjections to one short sentence. ` +
            `Do NOT talk over the narrator mid-segment.`
          : ''

        const visualDesc = display.visualDesc
          ? `\n\nWHAT THE ANIMATION SHOWS (for YOUR reference only — do NOT describe this to the child): ${display.visualDesc}`
          : ''

        sendSystemMessage(
          `[System: An animated exploration of ${display.symbol} (${display.name}) is ready to play. ` +
          `The number line is showing the starting position. The animation is PAUSED — it will not play until you call resume_exploration.` +
          `${visualDesc}\n\n` +
          `${narrator} is the designated narrator!\n\n` +
          `NARRATOR (${narrator}): Give the child a brief, excited intro — why this constant is special to you personally. ` +
          `Do NOT describe or preview what the animation will show. The visuals should be a surprise that unfolds as you narrate. ` +
          `Something like "Oh, I've been wanting to show you this!" or "This is one of my favorite things about living near ${display.symbol}." ` +
          `Keep it to 1-2 sentences, then call resume_exploration when the moment feels right.\n\n` +
          `HOW THIS WORKS: Once playing, you will receive narration text ONE SEGMENT AT A TIME. ` +
          `Each segment arrives with a "[System: Segment N — ...]" message containing exactly what to say. ` +
          `Read that text in your own voice and character, keeping pace with the animation playing on screen. ` +
          `Do NOT read ahead or improvise the narration — wait for each segment's cue. ` +
          `When you finish a segment, PAUSE BRIEFLY (1-2 seconds of silence) so the system knows you're done ` +
          `and can advance to the next segment. The animation and your narration play together — ` +
          `whichever finishes first waits for the other before the next segment starts.\n\n` +
          `CHECK-INS: Every 2-3 segments, pause the animation and genuinely check in with the child. ` +
          `Don't just say "Pretty cool, right?" — ask something that tests whether they're following: ` +
          `"So what do you think happens next?", "Does that make sense — why it stops there?", ` +
          `"Any questions about that part?", "What did you notice?" ` +
          `If they ask a question, take the time to answer it in character before resuming. ` +
          `If they seem lost, back up and re-explain simply. If they seem disengaged, it's OK to wrap up early.\n\n` +
          `PLAYBACK CONTROLS: You can pause_exploration, resume_exploration, or seek_exploration to a segment number. ` +
          `Use your judgment — quick questions can be answered while the animation plays. ` +
          `But if the child seems confused or wants to linger, pause or seek.` +
          `${othersDesc}\n\n` +
          `SEGMENT OUTLINE (${cfg.segments.length} parts):\n${outline}]`,
          true // prompt a response so the narrator introduces the constant
        )
      }
      voiceExplorationSegmentRef.current = -1
    }
  }, [audioManager, startDemo, restoreDemo, exitTour, narration, sendSystemMessage])
  // Keep refs pointed at latest implementations for voice agent callbacks
  exploreFnRef.current = handleExploreConstant
  pauseFnRef.current = () => {
    if (narration.isNarrating.current) narration.stop()
  }
  resumeFnRef.current = () => {
    const ds = demoStateRef.current
    if (ds.constantId && ds.revealProgress < 1) {
      agentLastSpokeRef.current = 0 // reset so silence detection doesn't fire from stale data
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

  // Track which narration segment was last reported to the voice agent
  const voiceExplorationSegmentRef = useRef(-1)

  // --- Debug tuning handlers for golden ratio demo ---
  const handleDecayChange = useCallback((v: number) => {
    setDebugDecay(v)
    setStepTimingDecay(v)
    scheduleRedraw()
  }, [scheduleRedraw])

  const handleLogBaseChange = useCallback((v: number) => {
    setDebugLogBase(v)
    setScrubberLogBase(v)
    scheduleRedraw()
  }, [scheduleRedraw])

  // --- Debug tuning handlers for sieve animation ---
  const handleTrackingRangeChange = useCallback((v: number) => {
    setDebugTrackingRange(v)
    setSieveTrackingRange(v)
    scheduleRedraw()
  }, [scheduleRedraw])

  const handleFollowHopsChange = useCallback((v: number) => {
    setDebugFollowHops(v)
    setSieveFollowHops(v)
    scheduleRedraw()
  }, [scheduleRedraw])

  const handleSieveSpeedChange = useCallback((v: number) => {
    setDebugSieveSpeed(v)
    setSieveSpeed(v)
    scheduleRedraw()
  }, [scheduleRedraw])

  // --- Prime Tour handlers ---
  const handleStartTour = useCallback(() => {
    cancelDemo() // mutual exclusion: cancel demo when starting tour
    setTappedConstantId(null)
    setTappedIntValue(null)
    setHoveredValue(null)
    startTour()
  }, [startTour, cancelDemo])

  // --- Scrubber pointer handlers ---
  /** Snap progress to a segment boundary if within 20px on screen. */
  const snapToSegmentBoundary = useCallback((rawProgress: number, clientX: number): number => {
    const track = scrubberTrackRef.current
    const cid = demoStateRef.current.constantId
    if (!track || !cid) return rawProgress
    const cfg = NARRATION_CONFIGS[cid]
    if (!cfg) return rawProgress

    const rect = track.getBoundingClientRect()
    const boundaries: number[] = []
    for (const seg of cfg.segments) {
      boundaries.push(seg.startProgress, seg.endProgress)
    }
    // Deduplicate
    const unique = [...new Set(boundaries)]

    let bestProgress = rawProgress
    let bestDist = 20 // 20px snap threshold
    for (const bp of unique) {
      const screenX = rect.left + progressToScrubber(bp) * rect.width
      const dist = Math.abs(clientX - screenX)
      if (dist < bestDist) {
        bestDist = dist
        bestProgress = bp
      }
    }
    return bestProgress
  }, [demoStateRef])

  const scrubberProgressFromPointer = useCallback((clientX: number, snap = false) => {
    const track = scrubberTrackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    const linearPos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const progress = scrubberToProgress(linearPos)
    return snap ? snapToSegmentBoundary(progress, clientX) : progress
  }, [snapToSegmentBoundary])

  const handleScrubberPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setRestoredFromUrl(false)
    narration.stop() // stop TTS narration when user scrubs
    isDraggingScrubberRef.current = true
    const progress = scrubberProgressFromPointer(e.clientX, true)
    setRevealProgress(progress)
    // Capture on the track element for reliable drag tracking
    scrubberTrackRef.current?.setPointerCapture(e.pointerId)
    // Active-state feedback: scale up + glow
    if (scrubberThumbVisualRef.current) {
      scrubberThumbVisualRef.current.style.transform = 'scale(1.4)'
      const cid = demoStateRef.current.constantId
      const glowColor = cid === 'pi' ? 'rgba(96, 165, 250, 0.6)'
        : cid === 'tau' ? 'rgba(45, 212, 191, 0.6)'
        : 'rgba(168, 85, 247, 0.6)'
      scrubberThumbVisualRef.current.style.boxShadow = `0 0 12px ${glowColor}`
    }
  }, [scrubberProgressFromPointer, setRevealProgress, narration])

  const handleScrubberPointerMove = useCallback((e: React.PointerEvent) => {
    if (isDraggingScrubberRef.current) {
      e.preventDefault()
      const progress = scrubberProgressFromPointer(e.clientX, true)
      setRevealProgress(progress)
    } else {
      // Track hover position for segment label display
      scrubberHoverProgressRef.current = scrubberProgressFromPointer(e.clientX)
    }
  }, [scrubberProgressFromPointer, setRevealProgress])

  const handleScrubberPointerLeave = useCallback(() => {
    scrubberHoverProgressRef.current = null
  }, [])

  const handleScrubberPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDraggingScrubberRef.current) return
    isDraggingScrubberRef.current = false
    scrubberTrackRef.current?.releasePointerCapture(e.pointerId)
    // Reset active-state feedback
    if (scrubberThumbVisualRef.current) {
      scrubberThumbVisualRef.current.style.transform = 'scale(1)'
      scrubberThumbVisualRef.current.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)'
    }
    // Resume narration from the scrubbed position
    const ds = demoStateRef.current
    if (ds.constantId && ds.revealProgress < 1) {
      narration.resume(ds.constantId)
    }
  }, [demoStateRef, narration])

  const handleScrubberKeyDown = useCallback((e: React.KeyboardEvent) => {
    const ds = demoStateRef.current
    if (ds.phase === 'idle') return

    // Space/Enter: toggle play/pause
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (narration.isNarrating.current) {
        narration.stop()
      } else if (ds.constantId && ds.revealProgress < 1) {
        narration.resume(ds.constantId)
      }
      return
    }

    narration.stop() // stop TTS narration when user scrubs via keyboard
    let progress = ds.revealProgress
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault()
        progress = Math.min(1, progress + 0.02)
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault()
        progress = Math.max(0, progress - 0.02)
        break
      case 'Home':
        e.preventDefault()
        progress = 0
        break
      case 'End':
        e.preventDefault()
        progress = 1
        break
      default:
        return
    }
    setRevealProgress(progress)
  }, [demoStateRef, setRevealProgress, narration])

  const handlePlayPauseClick = useCallback(() => {
    setRestoredFromUrl(false)
    const ds = demoStateRef.current
    if (ds.phase === 'idle') return
    if (narration.isNarrating.current) {
      narration.stop()
    } else if (ds.constantId && ds.revealProgress < 1) {
      narration.resume(ds.constantId)
    }
  }, [demoStateRef, narration])

  const handleResumeFromUrl = useCallback(() => {
    setRestoredFromUrl(false)
    const ds = demoStateRef.current
    if (ds.constantId && ds.revealProgress < 1) {
      narration.resume(ds.constantId)
    }
  }, [demoStateRef, narration])

  // --- Share button ---
  const [shareFeedback, setShareFeedback] = useState(false)
  const [shareAtCurrentTime, setShareAtCurrentTime] = useState(false)
  const handleShare = useCallback(async () => {
    const ds = demoStateRef.current
    const url = new URL(window.location.href)
    if (ds.constantId && ds.phase !== 'idle') {
      url.searchParams.set('demo', ds.constantId)
      if (shareAtCurrentTime && ds.revealProgress > 0) {
        url.searchParams.set('p', ds.revealProgress.toFixed(3))
      } else {
        url.searchParams.delete('p')
      }
    }
    const shareUrl = url.href

    if (navigator.share) {
      try {
        await navigator.share({ url: shareUrl })
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(shareUrl)
      setShareFeedback(true)
      setTimeout(() => setShareFeedback(false), 2000)
    }
  }, [demoStateRef, shareAtCurrentTime])

  const handleScrubberFocus = useCallback(() => {
    if (scrubberTrackRef.current) {
      scrubberTrackRef.current.style.outline = '2px solid rgba(168, 85, 247, 0.7)'
      scrubberTrackRef.current.style.outlineOffset = '2px'
    }
  }, [])

  const handleScrubberBlur = useCallback(() => {
    if (scrubberTrackRef.current) {
      scrubberTrackRef.current.style.outline = 'none'
    }
  }, [])

  // Colors for scrubber (adapts to active demo)
  const activeDemoId = demoStateRef.current.constantId
  const scrubberTrackColor = activeDemoId === 'pi'
    ? (resolvedTheme === 'dark' ? 'rgba(96, 165, 250, 0.3)' : 'rgba(37, 99, 235, 0.3)')
    : activeDemoId === 'tau'
    ? (resolvedTheme === 'dark' ? 'rgba(45, 212, 191, 0.3)' : 'rgba(13, 148, 136, 0.3)')
    : (resolvedTheme === 'dark' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(109, 40, 217, 0.3)')
  const scrubberFillColor = activeDemoId === 'pi'
    ? (resolvedTheme === 'dark' ? '#60a5fa' : '#2563eb')
    : activeDemoId === 'tau'
    ? (resolvedTheme === 'dark' ? '#2dd4bf' : '#0d9488')
    : (resolvedTheme === 'dark' ? '#fbbf24' : '#a855f7')

  return (
    <div ref={wrapperRef} data-component="number-line-wrapper" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <FindTheNumberBar
        onStart={handleGameStart}
        onGiveUp={handleGameGiveUp}
        gameState={gameState}
        isDark={resolvedTheme === 'dark'}
      />
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
        {/* Prime Tour start button — shown when primes enabled and tour not active */}
        {primesEnabled && tourStateRef.current.phase === 'idle' && !demoActive && (
          <button
            data-action="start-prime-tour"
            onClick={handleStartTour}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              minHeight: 44,
              minWidth: 44,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: resolvedTheme === 'dark' ? '#e9d5ff' : '#6d28d9',
              backgroundColor: resolvedTheme === 'dark' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)',
              border: `1px solid ${resolvedTheme === 'dark' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.25)'}`,
              borderRadius: 10,
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              zIndex: 10,
              pointerEvents: 'auto',
            }}
          >
            Prime Tour
          </button>
        )}
        {tappedConstant && (
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
        {callingNumber !== null && voiceState !== 'idle' && (
          <PhoneCallOverlay
            number={callingNumber}
            state={voiceState}
            timeRemaining={timeRemaining}
            error={voiceError}
            transferTarget={transferTarget}
            conferenceNumbers={conferenceNumbers}
            currentSpeaker={currentSpeaker}
            isSpeaking={isSpeaking}
            onHangUp={() => { hangUp(); setCallingNumber(null) }}
            onRemoveFromCall={removeFromCall}
            onRetry={() => dial(callingNumber)}
            onDismiss={() => { hangUp(); setCallingNumber(null) }}
            containerWidth={cssWidthRef.current}
            containerHeight={cssHeightRef.current}
            isDark={resolvedTheme === 'dark'}
            callBoxContainerRef={callBoxContainerRef}
          />
        )}
        {demoActive && restoredFromUrl && (
          <button
            data-action="demo-resume-from-url"
            onClick={handleResumeFromUrl}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              minHeight: 56,
              minWidth: 56,
              padding: '14px 32px',
              fontSize: 16,
              fontWeight: 600,
              fontFamily: 'system-ui, sans-serif',
              color: '#fff',
              backgroundColor: scrubberFillColor,
              border: 'none',
              borderRadius: 28,
              cursor: 'pointer',
              boxShadow: `0 4px 20px ${scrubberFillColor}66`,
              zIndex: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
              <path d="M8 5v14l11-7z" />
            </svg>
            Resume
          </button>
        )}
        {demoActive && (
          <div
            data-element="demo-share-group"
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 4,
            }}
          >
            <button
              data-action="demo-share"
              aria-label={shareAtCurrentTime ? 'Share demo at current time' : 'Share demo from start'}
              onClick={handleShare}
              style={{
                minHeight: 44,
                minWidth: 44,
                padding: '10px 12px',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'system-ui, sans-serif',
                color: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)',
                backgroundColor: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                border: `1px solid ${resolvedTheme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                borderRadius: 10,
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'opacity 0.15s',
              }}
            >
              {shareFeedback ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                  Share
                </>
              )}
            </button>
            {demoStateRef.current.revealProgress > 0 && (
              <label
                data-element="demo-share-timestamp-toggle"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontFamily: 'system-ui, sans-serif',
                  color: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={shareAtCurrentTime}
                  onChange={e => setShareAtCurrentTime(e.target.checked)}
                  style={{ margin: 0, accentColor: scrubberFillColor }}
                />
                at current time
              </label>
            )}
          </div>
        )}
        {demoActive && demoStateRef.current.revealProgress >= 1 && demoStateRef.current.constantId && (
          <div
            data-element="demo-recommendations"
            style={{
              position: 'absolute',
              bottom: 'max(76px, calc(env(safe-area-inset-bottom, 0px) + 76px))',
              left: 0,
              right: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              pointerEvents: 'none',
            }}
          >
            <div
              data-element="demo-recommendations-label"
              style={{
                fontSize: 11,
                fontWeight: 500,
                fontFamily: 'system-ui, sans-serif',
                color: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Explore next
            </div>
            <div
              data-element="demo-recommendations-cards"
              style={{
                display: 'flex',
                gap: 10,
                pointerEvents: 'auto',
                width: '100%',
                padding: '0 12px',
                boxSizing: 'border-box',
              }}
            >
              {(DEMO_RECOMMENDATIONS[demoStateRef.current.constantId] ?? []).map(id => {
                const d = DEMO_DISPLAY[id]
                if (!d) return null
                const mc = MATH_CONSTANTS.find(c => c.id === id)
                const isDark = resolvedTheme === 'dark'
                const themeSuffix = isDark ? '-dark' : '-light'
                const imgSrc = mc?.metaphorImage?.replace('.png', `${themeSuffix}.png`)
                return (
                  <button
                    key={id}
                    data-action={`explore-${id}`}
                    onClick={() => handleExploreConstant(id)}
                    style={{
                      position: 'relative',
                      flex: 1,
                      height: 140,
                      padding: 0,
                      border: 'none',
                      borderRadius: 14,
                      cursor: 'pointer',
                      overflow: 'hidden',
                      background: isDark ? '#1a1a2e' : '#e8e8f0',
                    }}
                  >
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt=""
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    ) : (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 48,
                        opacity: 0.3,
                        fontFamily: 'system-ui, sans-serif',
                      }}>
                        {d.symbol}
                      </div>
                    )}
                    {/* Gradient scrim for text legibility */}
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: '70%',
                      background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 50%, transparent 100%)',
                      pointerEvents: 'none',
                    }} />
                    {/* Text overlay */}
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 2,
                    }}>
                      <span style={{
                        fontSize: 22,
                        fontWeight: 700,
                        fontFamily: 'system-ui, sans-serif',
                        color: '#fff',
                        lineHeight: 1,
                        textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                      }}>{d.symbol}</span>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 500,
                        fontFamily: 'system-ui, sans-serif',
                        color: 'rgba(255,255,255,0.8)',
                        textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                      }}>{d.name}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {demoActive && (
          <>
          <button
            ref={playPauseBtnRef}
            data-action="demo-play-pause"
            aria-label="Play or pause demo"
            onClick={handlePlayPauseClick}
            style={{
              position: 'absolute',
              bottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
              left: 16,
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              opacity: 0,
              pointerEvents: 'none',
              transition: 'opacity 0.15s',
              zIndex: 1,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill={scrubberFillColor}>
              <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
            </svg>
          </button>
          <div
            ref={timeDisplayRef}
            data-element="demo-time-display"
            aria-live="off"
            style={{
              position: 'absolute',
              bottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
              right: 12,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              fontSize: 11,
              fontVariantNumeric: 'tabular-nums',
              fontFamily: 'system-ui, sans-serif',
              color: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
              pointerEvents: 'none',
              opacity: 0,
              transition: 'opacity 0.15s',
              whiteSpace: 'nowrap',
              letterSpacing: '0.02em',
            }}
          />
          <div
            ref={scrubberTrackRef}
            data-element="demo-scrubber"
            role="slider"
            aria-label={demoStateRef.current.constantId === 'pi'
              ? 'Pi unrolling progress'
              : demoStateRef.current.constantId === 'tau'
              ? 'Tau unrolling progress'
              : 'Golden ratio convergence progress'}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={0}
            tabIndex={0}
            onPointerDown={handleScrubberPointerDown}
            onPointerMove={handleScrubberPointerMove}
            onPointerUp={handleScrubberPointerUp}
            onPointerCancel={handleScrubberPointerUp}
            onPointerLeave={handleScrubberPointerLeave}
            onKeyDown={handleScrubberKeyDown}
            onFocus={handleScrubberFocus}
            onBlur={handleScrubberBlur}
            style={{
              position: 'absolute',
              bottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
              left: 68,
              right: 80,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              touchAction: 'none',
              opacity: 0,
              pointerEvents: 'none',
              transition: 'opacity 0.15s',
              outline: 'none',
            }}
          >
            {/* Track background */}
            <div
              data-element="demo-scrubber-track-bg"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                height: 6,
                borderRadius: 3,
                backgroundColor: scrubberTrackColor,
              }}
            />
            {/* Segment boundary tick marks */}
            <div
              ref={segmentTicksRef}
              data-element="demo-scrubber-segment-ticks"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                height: '100%',
                pointerEvents: 'none',
              }}
            />
            {/* Floating segment label (visible during scrubbing) */}
            <div
              ref={segmentLabelRef}
              data-element="demo-scrubber-segment-label"
              style={{
                position: 'absolute',
                bottom: '100%',
                marginBottom: 6,
                transform: 'translateX(-50%)',
                fontSize: 11,
                fontWeight: 500,
                fontFamily: 'system-ui, sans-serif',
                color: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.7)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                opacity: 0,
                transition: 'opacity 0.12s',
                textShadow: resolvedTheme === 'dark'
                  ? '0 1px 4px rgba(0,0,0,0.8)'
                  : '0 1px 3px rgba(255,255,255,0.9)',
              }}
            />
            {/* Filled portion */}
            <div
              ref={scrubberFillRef}
              data-element="demo-scrubber-fill"
              style={{
                position: 'absolute',
                left: 0,
                height: 6,
                borderRadius: 3,
                backgroundColor: scrubberFillColor,
                width: '0%',
              }}
            />
            {/* Convergence gap indicator — colored bar above scrubber */}
            <div
              ref={scrubberGapRef}
              data-element="demo-scrubber-gap"
              style={{
                position: 'absolute',
                top: 0,
                height: 4,
                borderRadius: 2,
                opacity: 0,
                transition: 'width 0.1s, background-color 0.15s, opacity 0.15s',
                pointerEvents: 'none',
              }}
            />
            {/* Thumb: 44x44 invisible touch target wrapping a visible circle */}
            <div
              ref={scrubberThumbRef}
              data-element="demo-scrubber-thumb"
              style={{
                position: 'absolute',
                left: '0%',
                width: 44,
                height: 44,
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                ref={scrubberThumbVisualRef}
                data-element="demo-scrubber-thumb-visual"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  backgroundColor: scrubberFillColor,
                  border: '3px solid white',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>
          </>
        )}
        {(() => {
          const tooltipValue = forcedHoverValue ?? hoveredValue
          if (tooltipValue === null || !primesEnabled) return null
          const spf = tooltipValue >= 2 ? smallestPrimeFactor(tooltipValue) : 0
          const isPrime = tooltipValue >= 2 && spf === tooltipValue
          const ip = interestingPrimesRef.current.find(p => p.value === tooltipValue)
          return (
            <PrimeTooltip
              value={tooltipValue}
              primeInfo={{
                value: tooltipValue,
                smallestPrimeFactor: spf,
                isPrime,
                classification: tooltipValue === 1 ? 'one' : isPrime ? 'prime' : 'composite',
              }}
              screenX={numberToScreenX(tooltipValue, stateRef.current.center, stateRef.current.pixelsPerUnit, cssWidthRef.current)}
              tooltipY={cssHeightRef.current / 2 + Math.min(40, cssHeightRef.current * 0.3) + 30}
              containerWidth={cssWidthRef.current}
              isDark={resolvedTheme === 'dark'}
              landmarkNote={ip?.note}
            />
          )
        })()}
        {hoveredValue === null && forcedHoverValue === null && tappedIntValue !== null && primesEnabled && (() => {
          const v = tappedIntValue
          const spf = v >= 2 ? smallestPrimeFactor(v) : 0
          const info: PrimeTickInfo = v === 1
            ? { value: 1, smallestPrimeFactor: 0, isPrime: false, classification: 'one' }
            : { value: v, smallestPrimeFactor: spf, isPrime: false, classification: 'composite' }
          return (
            <PrimeTooltip
              value={v}
              primeInfo={info}
              screenX={numberToScreenX(v, stateRef.current.center, stateRef.current.pixelsPerUnit, cssWidthRef.current)}
              tooltipY={cssHeightRef.current / 2 + Math.min(40, cssHeightRef.current * 0.3) + 30}
              containerWidth={cssWidthRef.current}
              isDark={resolvedTheme === 'dark'}
            />
          )
        })()}
        {/* Prime Tour overlay card */}
        {tourCurrentStop !== null && tourStopIndex !== null && (
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
        <ToyDebugPanel title="Number Line">
          <DebugSlider label="Anchor max" value={anchorMax} min={1} max={20} step={1} onChange={setAnchorMax} />
          <DebugSlider label="Medium max" value={mediumMax} min={5} max={50} step={1} onChange={setMediumMax} />
          <label data-element="constants-toggle" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={constantsEnabled}
              onChange={e => setConstantsEnabled(e.target.checked)}
            />
            Math Constants
          </label>
          <label data-element="primes-toggle" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={primesEnabled}
              onChange={e => { setPrimesEnabled(e.target.checked); scheduleRedraw() }}
            />
            Primes (Sieve)
          </label>
          <div
            data-element="phi-tuning-section"
            style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8, marginTop: 2 }}
          >
            <div style={{ fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5, marginBottom: 6 }}>
              φ Scrubber Tuning
            </div>
            <DebugSlider
              label="Step decay"
              value={debugDecay}
              min={0.80}
              max={0.99}
              step={0.005}
              onChange={handleDecayChange}
              formatValue={v => v.toFixed(3)}
            />
            <DebugSlider
              label="Scrubber log base"
              value={debugLogBase}
              min={1}
              max={32}
              step={0.5}
              onChange={handleLogBaseChange}
              formatValue={v => v.toFixed(1)}
            />
            <div style={{ fontSize: 10, opacity: 0.6, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
              50% → {arcReadout.at50} arcs · 75% → {arcReadout.at75} arcs · total {NUM_LEVELS}
            </div>
          </div>
          <div
            data-element="sieve-tuning-section"
            style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8, marginTop: 2 }}
          >
            <div style={{ fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5, marginBottom: 6 }}>
              Sieve Tuning
            </div>
            <DebugSlider
              label="Tracking range"
              value={debugTrackingRange}
              min={5}
              max={60}
              step={1}
              onChange={handleTrackingRangeChange}
              formatValue={v => `${v} ints`}
            />
            <DebugSlider
              label="Follow hops"
              value={debugFollowHops}
              min={1}
              max={40}
              step={1}
              onChange={handleFollowHopsChange}
            />
            <DebugSlider
              label="Speed"
              value={debugSieveSpeed}
              min={0.25}
              max={4}
              step={0.25}
              onChange={handleSieveSpeedChange}
              formatValue={v => `${v}x`}
            />
          </div>
        </ToyDebugPanel>
        {(() => {
          const fv = forcedHoverValue ?? hoveredValue
          if (fv === null || !primesEnabled || fv < 2) return null
          const spf = smallestPrimeFactor(fv)
          if (spf !== fv) return null // not prime
          const labels = getSpecialPrimeLabels(fv)
          if (labels.length === 0) return null
          const isDark = resolvedTheme === 'dark'
          // Deduplicate types (a prime can have e.g. two twin pairs but one footnote)
          const seenTypes = new Set<string>()
          const uniqueLabels = labels.filter(l => {
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
              {uniqueLabels.map(label => (
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
      </div>
    </div>
  )
}
