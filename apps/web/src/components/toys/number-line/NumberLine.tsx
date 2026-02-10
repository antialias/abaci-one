'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { useTheme } from '../../../contexts/ThemeContext'
import type { NumberLineState, TickThresholds } from './types'
import { DEFAULT_TICK_THRESHOLDS } from './types'
import { renderNumberLine } from './renderNumberLine'
import { useNumberLineTouch } from './useNumberLineTouch'
import { ToyDebugPanel, DebugSlider } from '../ToyDebugPanel'

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
  // Focal point as fraction of canvas width (0-1)
  const zoomFocalXRef = useRef(0.5)
  const decayRafRef = useRef<number>(0)
  // Direct DOM ref for the wrapper — updated outside React for 60fps bg color
  const wrapperRef = useRef<HTMLDivElement>(null)

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

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0) // reset any existing transform
    ctx.scale(dpr, dpr)
    renderNumberLine(
      ctx, stateRef.current, cssWidth, cssHeight,
      resolvedTheme === 'dark', thresholdsRef.current,
      zoomVelocityRef.current, zoomHueRef.current, zoomFocalXRef.current
    )
    ctx.restore()
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
      zoomVelocityRef.current *= 0.92

      // Lerp hue toward target (220 for zoom-in, 25 for zoom-out)
      // When velocity is near zero, hue stays where it was and just fades with intensity
      if (Math.abs(zoomVelocityRef.current) > 0.01) {
        const targetHue = zoomVelocityRef.current > 0 ? 220 : 25
        zoomHueRef.current += (targetHue - zoomHueRef.current) * 0.08
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
    // Accumulate with some blending so rapid events build up
    zoomVelocityRef.current = zoomVelocityRef.current * 0.6 + velocity * 8

    // Smoothly move focal point toward the new zoom point
    zoomFocalXRef.current += (focalX - zoomFocalXRef.current) * 0.3

    // Nudge hue toward target direction immediately (but smoothly via lerp)
    const targetHue = velocity > 0 ? 220 : 25
    zoomHueRef.current += (targetHue - zoomHueRef.current) * 0.15

    startDecay()
  }, [startDecay])

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
    <div ref={wrapperRef} data-component="number-line-wrapper" style={{ position: 'relative', width: '100%', height: '100%' }}>
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
  )
}
