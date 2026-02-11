'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { useTheme } from '../../../contexts/ThemeContext'
import type { NumberLineState, TickThresholds, CollisionFadeMap } from './types'
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
  const zoomVelocityRef = useRef(0)
  // Smoothed hue (lerps toward target to avoid hard color jumps)
  const zoomHueRef = useRef(0) // 0 = neutral, will lerp toward 220 or 25
  // Committed hue target — only changes when velocity is decisively in one direction
  const committedHueRef = useRef(0)
  // Focal point as fraction of canvas width (0-1)
  const zoomFocalXRef = useRef(0.5)
  const decayRafRef = useRef<number>(0)
  // Direct DOM ref for the wrapper — updated outside React for 60fps bg color
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Persistent collision fade state for smooth label show/hide transitions
  const collisionFadeMapRef = useRef<CollisionFadeMap>(new Map())
  const collisionRafRef = useRef<number>(0)

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

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0) // reset any existing transform
    ctx.scale(dpr, dpr)
    const fadeAnimating = renderNumberLine(
      ctx, stateRef.current, cssWidth, cssHeight,
      resolvedTheme === 'dark', thresholdsRef.current,
      zoomVelocityRef.current, zoomHueRef.current, zoomFocalXRef.current,
      renderTarget, collisionFadeMapRef.current
    )
    ctx.restore()

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
      // Decay velocity
      zoomVelocityRef.current *= 0.88

      // Lerp hue toward committed target — only update committed direction
      // when velocity is decisively in one direction (avoids flashing on rapid alternation)
      if (Math.abs(zoomVelocityRef.current) > 0.05) {
        committedHueRef.current = zoomVelocityRef.current > 0 ? 220 : 25
      }
      if (Math.abs(zoomVelocityRef.current) > 0.01) {
        zoomHueRef.current += (committedHueRef.current - zoomHueRef.current) * 0.04
      }

      // Sync wrapper background with decay
      updateWrapperBg(zoomVelocityRef.current, zoomHueRef.current)

      if (Math.abs(zoomVelocityRef.current) < 0.001) {
        zoomVelocityRef.current = 0
        decayRafRef.current = 0
        draw()
        return
      }
      draw()
      decayRafRef.current = requestAnimationFrame(tick)
    }
    decayRafRef.current = requestAnimationFrame(tick)
  }, [draw, updateWrapperBg])

  const handleZoomVelocity = useCallback((velocity: number, focalX: number) => {
    // Accumulate with heavy smoothing to avoid flashing
    zoomVelocityRef.current = zoomVelocityRef.current * 0.8 + velocity * 4

    // Smoothly move focal point toward the new zoom point
    zoomFocalXRef.current += (focalX - zoomFocalXRef.current) * 0.3

    // Only commit to a new hue direction when velocity is strong enough
    if (Math.abs(zoomVelocityRef.current) > 0.05) {
      committedHueRef.current = zoomVelocityRef.current > 0 ? 220 : 25
    }
    zoomHueRef.current += (committedHueRef.current - zoomHueRef.current) * 0.06

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

  // Touch/mouse/wheel handling
  useNumberLineTouch({
    stateRef,
    canvasRef,
    onStateChange: scheduleRedraw,
    onZoomVelocity: handleZoomVelocity,
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
        <ToyDebugPanel title="Number Line">
          <DebugSlider label="Anchor max" value={anchorMax} min={1} max={20} step={1} onChange={setAnchorMax} />
          <DebugSlider label="Medium max" value={mediumMax} min={5} max={50} step={1} onChange={setMediumMax} />
        </ToyDebugPanel>
      </div>
    </div>
  )
}
