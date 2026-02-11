'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useTheme } from '../../../contexts/ThemeContext'
import type { NumberLineState, TickThresholds, CollisionFadeMap, RenderConstant } from './types'
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

    // Rate-limit display values before rendering
    updateDisplayValues()

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0) // reset any existing transform
    ctx.scale(dpr, dpr)
    const fadeAnimating = renderNumberLine(
      ctx, stateRef.current, cssWidth, cssHeight,
      resolvedTheme === 'dark', thresholdsRef.current,
      displayVelocityRef.current, displayHueRef.current, zoomFocalXRef.current,
      renderTarget, collisionFadeMapRef.current, renderConstants
    )
    ctx.restore()

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

  // --- Constants tap handler ---
  const handleCanvasTap = useCallback((screenX: number, _screenY: number) => {
    if (!constantsEnabledRef.current) return

    const HIT_RADIUS = 30
    const constants = renderConstantsRef.current
    let closest: RenderConstant | null = null
    let closestDist = Infinity

    for (const c of constants) {
      if (c.opacity < 0.3) continue // don't allow tapping barely-visible constants
      const dist = Math.abs(c.screenX - screenX)
      if (dist < HIT_RADIUS && dist < closestDist) {
        closest = c
        closestDist = dist
      }
    }

    if (closest) {
      // Mark as discovered
      setDiscoveredIds(prev => {
        const next = new Set(prev)
        next.add(closest!.id)
        try {
          localStorage.setItem('number-line-discovered-constants', JSON.stringify([...next]))
        } catch { /* ignore */ }
        return next
      })
      setTappedConstantId(closest.id)
      draw()
    } else {
      // Tap on empty space dismisses info card
      setTappedConstantId(null)
    }
  }, [draw])

  // Touch/mouse/wheel handling
  useNumberLineTouch({
    stateRef,
    canvasRef,
    onStateChange: scheduleRedraw,
    onZoomVelocity: handleZoomVelocity,
    onTap: handleCanvasTap,
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
        </ToyDebugPanel>
      </div>
    </div>
  )
}
