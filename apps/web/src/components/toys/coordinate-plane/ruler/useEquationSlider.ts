'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import type { RulerState, EquationProbeState, Fraction } from './types'
import type { CoordinatePlaneState } from '../types'
import { rulerToScreen } from './renderRuler'
import { equationFromPoints, solveForY, solveForX } from './fractionMath'
import { decayingSin } from '../../shared/animationMath'

/** How close (in world units) the probe must be to an integer grid line to snap */
const GRID_SNAP_THRESHOLD = 0.15

interface UseEquationSliderOptions {
  rulerRef: React.MutableRefObject<RulerState>
  stateRef: React.MutableRefObject<CoordinatePlaneState>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  probeRef: React.MutableRefObject<EquationProbeState>
  requestDraw: () => void
  pointerCapturedRef: React.MutableRefObject<boolean>
}

interface UseEquationSliderResult {
  sliderT: number
  isDragging: boolean
  isSpringAnimating: boolean
  handlePointerDown: (e: React.PointerEvent) => void
  probeWorld: { x: number; y: number }
  nearX: number | null
  nearY: number | null
  solvedAtNearX: { x: number; yFrac: Fraction } | null
  solvedAtNearY: { y: number; xFrac: Fraction } | null
}

export function useEquationSlider({
  rulerRef,
  stateRef,
  canvasRef,
  probeRef,
  requestDraw,
  pointerCapturedRef,
}: UseEquationSliderOptions): UseEquationSliderResult {
  const [sliderT, setSliderT] = useState(0.5)
  const [isDragging, setIsDragging] = useState(false)
  const [isSpringAnimating, setIsSpringAnimating] = useState(false)

  // Probe solving state
  const [nearX, setNearX] = useState<number | null>(null)
  const [nearY, setNearY] = useState<number | null>(null)
  const [solvedAtNearX, setSolvedAtNearX] = useState<{ x: number; yFrac: Fraction } | null>(null)
  const [solvedAtNearY, setSolvedAtNearY] = useState<{ y: number; xFrac: Fraction } | null>(null)
  const [probeWorld, setProbeWorld] = useState({ x: 0, y: 0 })

  // Internal refs for drag
  const dragStartScreenRef = useRef({ x: 0, y: 0 })
  const dragStartTRef = useRef(0.5)
  const rulerDirScreenRef = useRef({ x: 1, y: 0, lengthPx: 1 })
  const springRafRef = useRef(0)

  const updateProbe = useCallback((t: number) => {
    const ruler = rulerRef.current
    // World position at t along the ruler line (unclamped — extends into laser)
    const wx = ruler.ax + (ruler.bx - ruler.ax) * t
    const wy = ruler.ay + (ruler.by - ruler.ay) * t

    // Grid proximity detection
    const equation = equationFromPoints(ruler.ax, ruler.ay, ruler.bx, ruler.by)

    let nX: number | null = null
    let nY: number | null = null
    let solvX: { x: number; yFrac: Fraction } | null = null
    let solvY: { y: number; xFrac: Fraction } | null = null

    const roundedX = Math.round(wx)
    const roundedY = Math.round(wy)
    const distX = Math.abs(wx - roundedX)
    const distY = Math.abs(wy - roundedY)

    if (equation.kind === 'general') {
      if (distX < GRID_SNAP_THRESHOLD) {
        nX = roundedX
        solvX = { x: roundedX, yFrac: solveForY(equation.slope, equation.intercept, roundedX) }
      }
      if (distY < GRID_SNAP_THRESHOLD) {
        nY = roundedY
        solvY = { y: roundedY, xFrac: solveForX(equation.slope, equation.intercept, roundedY) }
      }
    } else if (equation.kind === 'horizontal') {
      // y is always the constant — solve for x at integer x
      if (distX < GRID_SNAP_THRESHOLD) {
        nX = roundedX
        // y is always equation.y (integer)
        solvX = { x: roundedX, yFrac: { num: equation.y, den: 1 } }
      }
    } else if (equation.kind === 'vertical') {
      // x is always the constant — solve for y at integer y
      if (distY < GRID_SNAP_THRESHOLD) {
        nY = roundedY
        solvY = { y: roundedY, xFrac: { num: equation.x, den: 1 } }
      }
    }
    // 'point' kind: no solving needed

    setNearX(nX)
    setNearY(nY)
    setSolvedAtNearX(solvX)
    setSolvedAtNearY(solvY)
    setProbeWorld({ x: wx, y: wy })

    // Update ref for canvas to read
    probeRef.current = {
      active: true,
      t,
      worldX: wx,
      worldY: wy,
      nearX: nX,
      nearY: nY,
      solvedAtNearX: solvX,
      solvedAtNearY: solvY,
    }

    requestDraw()
  }, [rulerRef, probeRef, requestDraw])

  const clearProbe = useCallback(() => {
    setNearX(null)
    setNearY(null)
    setSolvedAtNearX(null)
    setSolvedAtNearY(null)
    probeRef.current = {
      ...probeRef.current,
      active: false,
      t: 0.5,
      nearX: null,
      nearY: null,
      solvedAtNearX: null,
      solvedAtNearY: null,
    }
    requestDraw()
  }, [probeRef, requestDraw])

  // Spring snap-back animation
  const startSpring = useCallback((fromT: number) => {
    const amplitude = fromT - 0.5
    if (Math.abs(amplitude) < 0.001) {
      setSliderT(0.5)
      clearProbe()
      return
    }

    setIsSpringAnimating(true)
    const startTime = performance.now()

    function animate() {
      const elapsed = (performance.now() - startTime) / 1000 // seconds
      const offset = amplitude * decayingSin(elapsed, 3, 6)

      if (Math.abs(offset) < 0.001 || elapsed > 1) {
        // Settled
        setSliderT(0.5)
        setIsSpringAnimating(false)
        clearProbe()
        cancelAnimationFrame(springRafRef.current)
        return
      }

      const t = 0.5 + offset
      setSliderT(t)
      updateProbe(t)
      springRafRef.current = requestAnimationFrame(animate)
    }

    springRafRef.current = requestAnimationFrame(animate)
  }, [clearProbe, updateProbe])

  // Cleanup spring RAF on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(springRafRef.current)
  }, [])

  // Pointer event handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()

    // Cancel any running spring
    cancelAnimationFrame(springRafRef.current)
    setIsSpringAnimating(false)

    setIsDragging(true)
    pointerCapturedRef.current = true

    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const cssWidth = canvas.width / dpr
    const cssHeight = canvas.height / dpr

    // Compute ruler direction in screen space
    const ruler = rulerRef.current
    const info = rulerToScreen(ruler, stateRef.current, cssWidth, cssHeight)
    const dirX = info.bx - info.ax
    const dirY = info.by - info.ay
    const lengthPx = Math.sqrt(dirX * dirX + dirY * dirY)

    rulerDirScreenRef.current = {
      x: lengthPx > 0 ? dirX / lengthPx : 1,
      y: lengthPx > 0 ? dirY / lengthPx : 0,
      lengthPx,
    }

    dragStartScreenRef.current = { x: e.clientX, y: e.clientY }
    dragStartTRef.current = sliderT

    // Set up window-level listeners for move and up
    const onPointerMove = (ev: PointerEvent) => {
      const deltaScreenX = ev.clientX - dragStartScreenRef.current.x
      const deltaScreenY = ev.clientY - dragStartScreenRef.current.y
      const dir = rulerDirScreenRef.current

      // Project screen delta onto ruler direction
      const projectedPx = deltaScreenX * dir.x + deltaScreenY * dir.y
      const deltaT = dir.lengthPx > 0 ? projectedPx / dir.lengthPx : 0

      const newT = dragStartTRef.current + deltaT
      setSliderT(newT)
      updateProbe(newT)
    }

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      setIsDragging(false)
      pointerCapturedRef.current = false

      // Get current sliderT from the ref-based approach
      // We need to read the latest value — use a trick: read from the state updater
      setSliderT(currentT => {
        startSpring(currentT)
        return currentT
      })
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }, [canvasRef, rulerRef, stateRef, sliderT, pointerCapturedRef, updateProbe, startSpring])

  return {
    sliderT,
    isDragging,
    isSpringAnimating,
    handlePointerDown,
    probeWorld,
    nearX,
    nearY,
    solvedAtNearX,
    solvedAtNearY,
  }
}
