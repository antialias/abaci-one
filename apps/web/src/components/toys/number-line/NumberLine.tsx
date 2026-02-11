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
import { renderGoldenRatioOverlay } from './constants/demos/goldenRatioDemo'
import { computePrimeInfos, smallestPrimeFactor } from './primes/sieve'
import { PrimeTooltip } from './primes/PrimeTooltip'
import { computePrimePairArcs, getSpecialPrimeLabels, LABEL_COLORS, PRIME_TYPE_DESCRIPTIONS } from './primes/specialPrimes'
import { computeInterestingPrimes } from './primes/interestingness'
import type { InterestingPrime } from './primes/interestingness'
import { computeTickMarks, numberToScreenX, screenXToNumber } from './numberLineTicks'

const INITIAL_STATE: NumberLineState = {
  center: 0,
  pixelsPerUnit: 100,
}

export function NumberLine() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const stateRef = useRef<NumberLineState>({ ...INITIAL_STATE })
  const rafRef = useRef<number>(0)
  const { resolvedTheme } = useTheme()

  // Debug controls for tick thresholds
  const [anchorMax, setAnchorMax] = useState(DEFAULT_TICK_THRESHOLDS.anchorMax)
  const [mediumMax, setMediumMax] = useState(DEFAULT_TICK_THRESHOLDS.mediumMax)
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
  // --- Demo scrubber state ---
  const scrubberTrackRef = useRef<HTMLDivElement>(null)
  const scrubberFillRef = useRef<HTMLDivElement>(null)
  const scrubberThumbRef = useRef<HTMLDivElement>(null)
  const [demoActive, setDemoActive] = useState(false)
  const isDraggingScrubberRef = useRef(false)

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

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0) // reset any existing transform
    ctx.scale(dpr, dpr)
    const fadeAnimating = renderNumberLine(
      ctx, stateRef.current, cssWidth, cssHeight,
      resolvedTheme === 'dark', thresholdsRef.current,
      displayVelocityRef.current, displayHueRef.current, zoomFocalXRef.current,
      renderTarget, collisionFadeMapRef.current, renderConstants,
      primeInfos, hoveredValueRef.current, interestingPrimes, primePairArcs
    )

    // Render constant demo overlay (golden ratio, etc.)
    const ds = demoStateRef.current
    if (ds.phase !== 'idle' && ds.constantId === 'phi') {
      renderGoldenRatioOverlay(
        ctx, stateRef.current, cssWidth, cssHeight,
        resolvedTheme === 'dark', ds.revealProgress, ds.opacity
      )
    }

    ctx.restore()

    // --- Sync demo scrubber DOM ---
    const isActive = ds.phase !== 'idle'
    if (scrubberTrackRef.current) {
      scrubberTrackRef.current.style.opacity = isActive ? String(ds.opacity) : '0'
      scrubberTrackRef.current.style.pointerEvents = isActive && ds.opacity > 0.1 ? 'auto' : 'none'
    }
    if (scrubberFillRef.current) {
      scrubberFillRef.current.style.width = `${ds.revealProgress * 100}%`
    }
    if (scrubberThumbRef.current) {
      scrubberThumbRef.current.style.left = `${ds.revealProgress * 100}%`
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
    startDemo(constantId)
  }, [startDemo])

  // --- Scrubber pointer handlers ---
  const scrubberProgressFromPointer = useCallback((clientX: number) => {
    const track = scrubberTrackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }, [])

  const handleScrubberPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isDraggingScrubberRef.current = true
    const progress = scrubberProgressFromPointer(e.clientX)
    setRevealProgress(progress)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
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
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }, [])

  // Colors for scrubber (match golden ratio demo palette)
  const scrubberTrackColor = resolvedTheme === 'dark' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(109, 40, 217, 0.3)'
  const scrubberFillColor = resolvedTheme === 'dark' ? '#fbbf24' : '#a855f7'

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
            onPointerDown={handleScrubberPointerDown}
            onPointerMove={handleScrubberPointerMove}
            onPointerUp={handleScrubberPointerUp}
            onPointerCancel={handleScrubberPointerUp}
            style={{
              position: 'absolute',
              bottom: 24,
              left: 40,
              right: 40,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              touchAction: 'none',
              opacity: 0,
              pointerEvents: 'none',
              transition: 'opacity 0.15s',
            }}
          >
            {/* Track background */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                height: 3,
                borderRadius: 1.5,
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
                height: 3,
                borderRadius: 1.5,
                backgroundColor: scrubberFillColor,
                width: '0%',
              }}
            />
            {/* Thumb */}
            <div
              ref={scrubberThumbRef}
              data-element="demo-scrubber-thumb"
              style={{
                position: 'absolute',
                left: '0%',
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: scrubberFillColor,
                border: '2px solid white',
                transform: 'translateX(-50%)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            />
          </div>
        )}
        {hoveredValue !== null && primesEnabled && (() => {
          const ip = interestingPrimesRef.current.find(p => p.value === hoveredValue)
          return (
            <PrimeTooltip
              value={hoveredValue}
              primeInfo={{ value: hoveredValue, smallestPrimeFactor: hoveredValue, isPrime: true, classification: 'prime' }}
              screenX={numberToScreenX(hoveredValue, stateRef.current.center, stateRef.current.pixelsPerUnit, cssWidthRef.current)}
              tooltipY={cssHeightRef.current / 2 + Math.min(40, cssHeightRef.current * 0.3) + 30}
              containerWidth={cssWidthRef.current}
              isDark={resolvedTheme === 'dark'}
              landmarkNote={ip?.note}
            />
          )
        })()}
        {hoveredValue === null && tappedIntValue !== null && primesEnabled && (() => {
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
        </ToyDebugPanel>
        {hoveredValue !== null && primesEnabled && hoveredValue >= 2 && (() => {
          const spf = smallestPrimeFactor(hoveredValue)
          if (spf !== hoveredValue) return null // not prime
          const labels = getSpecialPrimeLabels(hoveredValue)
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
                bottom: 8,
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
