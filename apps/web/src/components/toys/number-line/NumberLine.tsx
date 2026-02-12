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
import { useConstantDemo } from './constants/demos/useConstantDemo'
import { renderGoldenRatioOverlay, NUM_LEVELS, setStepTimingDecay, getStepTimingDecay, arcCountAtProgress, convergenceGapAtProgress } from './constants/demos/goldenRatioDemo'
import { renderPiOverlay } from './constants/demos/piDemo'
import { renderTauOverlay } from './constants/demos/tauDemo'
import { renderEOverlay } from './constants/demos/eDemo'
import { useEDemoNarration } from './constants/demos/useEDemoNarration'
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

const INITIAL_STATE: NumberLineState = {
  center: 0,
  pixelsPerUnit: 100,
}

export function NumberLine() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stateRef = useRef<NumberLineState>({ ...INITIAL_STATE })
  const rafRef = useRef<number>(0)
  const { resolvedTheme } = useTheme()
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
  const { demoState: demoStateRef, startDemo, tickDemo, cancelDemo, setRevealProgress } = useConstantDemo(
    stateRef, cssWidthRef, cssHeightRef, demoRedraw
  )
  // --- e Demo narration ---
  const { startNarration: startENarration, stopNarration: stopENarration, isNarratingRef: isENarratingRef } =
    useEDemoNarration(demoStateRef, setRevealProgress)
  // Track whether narration has been triggered for this demo session
  const eNarrationTriggeredRef = useRef(false)

  // --- Demo scrubber state ---
  const scrubberTrackRef = useRef<HTMLDivElement>(null)
  const scrubberFillRef = useRef<HTMLDivElement>(null)
  const scrubberThumbRef = useRef<HTMLDivElement>(null)
  const scrubberThumbVisualRef = useRef<HTMLDivElement>(null)
  const scrubberGapRef = useRef<HTMLDivElement>(null)
  const [demoActive, setDemoActive] = useState(false)
  const isDraggingScrubberRef = useRef(false)

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

    // Auto-start e demo narration once viewport fly-in is ~60% done (revealProgress > 0)
    {
      const ds = demoStateRef.current
      if (
        ds.constantId === 'e' &&
        ds.phase === 'animating' &&
        ds.revealProgress > 0 &&
        !eNarrationTriggeredRef.current &&
        !isENarratingRef.current
      ) {
        eNarrationTriggeredRef.current = true
        startENarration()
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
      sieveTransforms = computeSieveTickTransforms(SWEEP_MAX_N, sieveDwellElapsed, cssHeight, viewportRight)
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

  // Touch/mouse/wheel handling
  useNumberLineTouch({
    stateRef,
    canvasRef,
    onStateChange: scheduleRedraw,
    onZoomVelocity: handleZoomVelocity,
    onTap: handleCanvasTap,
    onHover: handleHover,
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
    setTappedConstantId(null)
  }, [])

  const handleExploreConstant = useCallback((constantId: string) => {
    exitTour() // mutual exclusion: cancel tour when starting demo
    startDemo(constantId)
  }, [startDemo, exitTour])

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
  const scrubberProgressFromPointer = useCallback((clientX: number) => {
    const track = scrubberTrackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    const linearPos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return scrubberToProgress(linearPos)
  }, [])

  const handleScrubberPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    stopENarration() // stop TTS narration when user scrubs
    isDraggingScrubberRef.current = true
    const progress = scrubberProgressFromPointer(e.clientX)
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
  }, [scrubberProgressFromPointer, setRevealProgress])

  const handleScrubberPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingScrubberRef.current) return
    e.preventDefault()
    const progress = scrubberProgressFromPointer(e.clientX)
    setRevealProgress(progress)
  }, [scrubberProgressFromPointer, setRevealProgress])

  const handleScrubberPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDraggingScrubberRef.current) return
    isDraggingScrubberRef.current = false
    scrubberTrackRef.current?.releasePointerCapture(e.pointerId)
    // Reset active-state feedback
    if (scrubberThumbVisualRef.current) {
      scrubberThumbVisualRef.current.style.transform = 'scale(1)'
      scrubberThumbVisualRef.current.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)'
    }
  }, [])

  const handleScrubberKeyDown = useCallback((e: React.KeyboardEvent) => {
    const ds = demoStateRef.current
    if (ds.phase === 'idle') return
    stopENarration() // stop TTS narration when user scrubs via keyboard
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
  }, [demoStateRef, setRevealProgress])

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
          />
        )}
        {demoActive && (
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
            onKeyDown={handleScrubberKeyDown}
            onFocus={handleScrubberFocus}
            onBlur={handleScrubberBlur}
            style={{
              position: 'absolute',
              bottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
              left: 24,
              right: 24,
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
