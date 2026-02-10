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
  const decayRafRef = useRef<number>(0)

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
    renderNumberLine(ctx, stateRef.current, cssWidth, cssHeight, resolvedTheme === 'dark', thresholdsRef.current, zoomVelocityRef.current)
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
      zoomVelocityRef.current *= 0.92
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
  }, [draw])

  const handleZoomVelocity = useCallback((velocity: number) => {
    // Accumulate with some blending so rapid events build up
    zoomVelocityRef.current = zoomVelocityRef.current * 0.6 + velocity * 8
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
    <div data-component="number-line-wrapper" style={{ position: 'relative', width: '100%', height: '100%' }}>
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
