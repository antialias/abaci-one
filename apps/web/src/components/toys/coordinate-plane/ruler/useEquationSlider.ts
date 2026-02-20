'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import type { RulerState, EquationProbeState, Fraction } from './types'
import type { CoordinatePlaneState } from '../types'
import { rulerToScreen } from './renderRuler'
import { equationFromPoints, solveForY, solveForX } from './fractionMath'
import { decayingSin } from '../../shared/animationMath'

/** How close (in world units) the probe must be to an integer grid line to snap */
const GRID_SNAP_THRESHOLD = 0.15

/** Movement threshold (px) to distinguish click from drag */
const CLICK_THRESHOLD = 5

interface UseEquationSliderOptions {
  rulerRef: React.MutableRefObject<RulerState>
  stateRef: React.MutableRefObject<CoordinatePlaneState>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  probeRef: React.MutableRefObject<EquationProbeState>
  requestDraw: () => void
  pointerCapturedRef: React.MutableRefObject<boolean>
  /** Incremented when ruler position changes — triggers spring snap-back */
  rulerVersion: number
  /** Called on click (pointer down + up with < 5px movement) */
  onClickLabel?: () => void
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
  rulerVersion,
  onClickLabel,
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
  const didMoveRef = useRef(false)

  const updateProbe = useCallback(
    (t: number, solve = true): number => {
      const ruler = rulerRef.current
      const dxRuler = ruler.bx - ruler.ax
      const dyRuler = ruler.by - ruler.ay

      // World position at t along the ruler line (unclamped — extends into laser)
      let wx = ruler.ax + dxRuler * t
      let wy = ruler.ay + dyRuler * t
      let effectiveT = t

      let nX: number | null = null
      let nY: number | null = null
      let solvX: { x: number; yFrac: Fraction } | null = null
      let solvY: { y: number; xFrac: Fraction } | null = null

      // Grid proximity detection + snap — only during manual drag, not spring
      if (solve) {
        const equation = equationFromPoints(ruler.ax, ruler.ay, ruler.bx, ruler.by)

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
          if (distX < GRID_SNAP_THRESHOLD) {
            nX = roundedX
            solvX = { x: roundedX, yFrac: { num: equation.y, den: 1 } }
          }
        } else if (equation.kind === 'vertical') {
          if (distY < GRID_SNAP_THRESHOLD) {
            nY = roundedY
            solvY = { y: roundedY, xFrac: { num: equation.x, den: 1 } }
          }
        }

        // Snap t to the nearest detected grid line
        if (nX !== null || nY !== null) {
          if (nX !== null && nY !== null) {
            // Both in range — snap to whichever is closer
            if (distX <= distY && Math.abs(dxRuler) > 0.001) {
              effectiveT = (roundedX - ruler.ax) / dxRuler
            } else if (Math.abs(dyRuler) > 0.001) {
              effectiveT = (roundedY - ruler.ay) / dyRuler
            }
          } else if (nX !== null && Math.abs(dxRuler) > 0.001) {
            effectiveT = (roundedX - ruler.ax) / dxRuler
          } else if (nY !== null && Math.abs(dyRuler) > 0.001) {
            effectiveT = (roundedY - ruler.ay) / dyRuler
          }

          // Recompute world position from snapped t
          wx = ruler.ax + dxRuler * effectiveT
          wy = ruler.ay + dyRuler * effectiveT
        }
      }

      setNearX(nX)
      setNearY(nY)
      setSolvedAtNearX(solvX)
      setSolvedAtNearY(solvY)
      setProbeWorld({ x: wx, y: wy })

      // Update ref for canvas to read
      probeRef.current = {
        active: true,
        t: effectiveT,
        worldX: wx,
        worldY: wy,
        nearX: nX,
        nearY: nY,
        solvedAtNearX: solvX,
        solvedAtNearY: solvY,
      }

      requestDraw()
      return effectiveT
    },
    [rulerRef, probeRef, requestDraw]
  )

  const clearProbe = useCallback(() => {
    setNearX(null)
    setNearY(null)
    setSolvedAtNearX(null)
    setSolvedAtNearY(null)
    probeRef.current = {
      ...probeRef.current,
      active: false,
      // Don't touch t — preserve label position; callers reset t explicitly
      nearX: null,
      nearY: null,
      solvedAtNearX: null,
      solvedAtNearY: null,
    }
    requestDraw()
  }, [probeRef, requestDraw])

  // Track whether a spring-back has already been triggered for the current displacement.
  // Prevents re-triggering on every rulerVersion tick during a continuous ruler drag.
  const springTriggeredRef = useRef(false)

  // Spring snap-back animation
  const startSpring = useCallback(
    (fromT: number) => {
      // Cancel any existing spring before starting a new one
      cancelAnimationFrame(springRafRef.current)

      const amplitude = fromT - 0.5
      if (Math.abs(amplitude) < 0.001) {
        setSliderT(0.5)
        probeRef.current.t = 0.5
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
          probeRef.current.t = 0.5
          setIsSpringAnimating(false)
          clearProbe()
          cancelAnimationFrame(springRafRef.current)
          return
        }

        const t = 0.5 + offset
        setSliderT(t)
        updateProbe(t, false)
        springRafRef.current = requestAnimationFrame(animate)
      }

      springRafRef.current = requestAnimationFrame(animate)
    },
    [clearProbe, updateProbe, probeRef]
  )

  // Cleanup spring RAF on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(springRafRef.current)
  }, [])

  // Spring back to midpoint when ruler position changes (skip initial mount).
  // Only triggers once per displacement — springTriggeredRef prevents re-firing
  // on every rulerVersion tick during a continuous ruler drag.
  const prevRulerVersionRef = useRef(rulerVersion)
  useEffect(() => {
    if (prevRulerVersionRef.current === rulerVersion) return
    prevRulerVersionRef.current = rulerVersion

    if (springTriggeredRef.current) return // already springing back

    // Read current t via state updater to avoid stale closure
    setSliderT((currentT) => {
      if (Math.abs(currentT - 0.5) > 0.001) {
        springTriggeredRef.current = true
        startSpring(currentT)
      }
      return currentT
    })
  }, [rulerVersion, startSpring])

  // Pointer event handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      e.preventDefault()

      // Cancel any running spring
      cancelAnimationFrame(springRafRef.current)
      setIsSpringAnimating(false)
      springTriggeredRef.current = false

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
      didMoveRef.current = false

      // Set up window-level listeners for move and up
      const onPointerMove = (ev: PointerEvent) => {
        const deltaScreenX = ev.clientX - dragStartScreenRef.current.x
        const deltaScreenY = ev.clientY - dragStartScreenRef.current.y

        // Check if movement exceeds click threshold
        if (!didMoveRef.current) {
          const dist = Math.sqrt(deltaScreenX * deltaScreenX + deltaScreenY * deltaScreenY)
          if (dist >= CLICK_THRESHOLD) {
            didMoveRef.current = true
          } else {
            return // Don't start dragging until threshold exceeded
          }
        }

        const dir = rulerDirScreenRef.current

        // Project screen delta onto ruler direction
        const projectedPx = deltaScreenX * dir.x + deltaScreenY * dir.y
        const deltaT = dir.lengthPx > 0 ? projectedPx / dir.lengthPx : 0

        const newT = dragStartTRef.current + deltaT
        const effectiveT = updateProbe(newT)
        setSliderT(effectiveT)
      }

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        setIsDragging(false)
        pointerCapturedRef.current = false

        // Click (no significant movement) → toggle equation form
        if (!didMoveRef.current) {
          onClickLabel?.()
          return
        }

        // If at a solve point, keep the probe active with indicators visible.
        // Otherwise just clear solve state but keep position.
        const probe = probeRef.current
        if (probe.nearX == null && probe.nearY == null) {
          clearProbe()
        }
      }

      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
    },
    [
      canvasRef,
      rulerRef,
      stateRef,
      sliderT,
      pointerCapturedRef,
      updateProbe,
      clearProbe,
      onClickLabel,
    ]
  )

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
