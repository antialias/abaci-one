import { useEffect, useRef, useCallback } from 'react'
import type { NumberLineState } from './types'
import { screenXToNumber } from './numberLineTicks'

interface UseNumberLineTouchOptions {
  stateRef: React.MutableRefObject<NumberLineState>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  onStateChange: () => void
  /** Called with the instantaneous zoom velocity (log-ratio of PPU change). Positive = zoom in. */
  onZoomVelocity?: (velocity: number) => void
}

// Zoom limits — 1e14 allows viewing down to ~femto-scale (power -15)
// while staying well within float64's ~15 significant digits
const MIN_PIXELS_PER_UNIT = 0.001
const MAX_PIXELS_PER_UNIT = 1e14

function clampPixelsPerUnit(ppu: number): number {
  return Math.max(MIN_PIXELS_PER_UNIT, Math.min(MAX_PIXELS_PER_UNIT, ppu))
}

/**
 * Hook that attaches touch, mouse, and wheel handlers to a canvas element
 * for panning and zooming a number line.
 *
 * All math uses absolute anchor-based computations (not deltas) to prevent drift.
 */
export function useNumberLineTouch({ stateRef, canvasRef, onStateChange, onZoomVelocity }: UseNumberLineTouchOptions) {
  // Anchor state for single-finger drag / mouse drag
  const dragAnchorRef = useRef<number | null>(null)

  // Anchor state for two-finger pinch
  const pinchAnchorsRef = useRef<{ n1: number; n2: number; id1: number; id2: number } | null>(null)

  const getCanvasWidth = useCallback(() => {
    return canvasRef.current?.getBoundingClientRect().width ?? 0
  }, [canvasRef])

  const getCanvasRect = useCallback(() => {
    return canvasRef.current?.getBoundingClientRect()
  }, [canvasRef])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // --- Touch handlers ---

    function handleTouchStart(e: TouchEvent) {
      e.preventDefault()
      const rect = getCanvasRect()
      if (!rect) return
      const canvasWidth = rect.width
      const state = stateRef.current

      if (e.touches.length === 1) {
        // Single finger: anchor the number under the touch
        const x = e.touches[0].clientX - rect.left
        const anchorNumber = screenXToNumber(x, state.center, state.pixelsPerUnit, canvasWidth)
        dragAnchorRef.current = anchorNumber
        pinchAnchorsRef.current = null
      } else if (e.touches.length === 2) {
        // Two fingers: anchor both numbers
        const x1 = e.touches[0].clientX - rect.left
        const x2 = e.touches[1].clientX - rect.left
        const n1 = screenXToNumber(x1, state.center, state.pixelsPerUnit, canvasWidth)
        const n2 = screenXToNumber(x2, state.center, state.pixelsPerUnit, canvasWidth)
        pinchAnchorsRef.current = {
          n1,
          n2,
          id1: e.touches[0].identifier,
          id2: e.touches[1].identifier,
        }
        dragAnchorRef.current = null
      }
    }

    function handleTouchMove(e: TouchEvent) {
      e.preventDefault()
      const rect = getCanvasRect()
      if (!rect) return
      const canvasWidth = rect.width
      const state = stateRef.current

      if (e.touches.length === 2 && pinchAnchorsRef.current) {
        // Two-finger pinch + drag
        const { n1, n2, id1, id2 } = pinchAnchorsRef.current

        // Find touches by identifier
        let touch1: Touch | null = null
        let touch2: Touch | null = null
        for (let i = 0; i < e.touches.length; i++) {
          if (e.touches[i].identifier === id1) touch1 = e.touches[i]
          if (e.touches[i].identifier === id2) touch2 = e.touches[i]
        }
        if (!touch1 || !touch2) return

        const screen1 = touch1.clientX - rect.left
        const screen2 = touch2.clientX - rect.left

        const oldPPU = state.pixelsPerUnit

        // Edge case: anchors too close together
        if (Math.abs(n1 - n2) < 1e-12) {
          // Treat as single-finger drag using midpoint
          const midScreen = (screen1 + screen2) / 2
          const midAnchor = (n1 + n2) / 2
          state.center = midAnchor - (midScreen - canvasWidth / 2) / state.pixelsPerUnit
        } else {
          // Solve two equations for pixelsPerUnit and center
          const newPPU = clampPixelsPerUnit((screen1 - screen2) / (n1 - n2))
          state.pixelsPerUnit = newPPU
          state.center = n1 - (screen1 - canvasWidth / 2) / newPPU
        }

        stateRef.current = state
        onStateChange()

        // Report zoom velocity for pinch
        if (state.pixelsPerUnit !== oldPPU) {
          onZoomVelocity?.(Math.log(state.pixelsPerUnit / oldPPU))
        }
      } else if (e.touches.length === 1 && dragAnchorRef.current !== null) {
        // Single finger drag
        const x = e.touches[0].clientX - rect.left
        const anchor = dragAnchorRef.current
        state.center = anchor - (x - canvasWidth / 2) / state.pixelsPerUnit
        stateRef.current = state
        onStateChange()
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      e.preventDefault()
      const rect = getCanvasRect()
      if (!rect) return
      const canvasWidth = rect.width
      const state = stateRef.current

      if (e.touches.length === 1 && pinchAnchorsRef.current) {
        // Transition 2 -> 1 finger: re-anchor remaining finger
        const remainingTouch = e.touches[0]
        const x = remainingTouch.clientX - rect.left
        const anchorNumber = screenXToNumber(x, state.center, state.pixelsPerUnit, canvasWidth)
        dragAnchorRef.current = anchorNumber
        pinchAnchorsRef.current = null
      } else if (e.touches.length === 0) {
        dragAnchorRef.current = null
        pinchAnchorsRef.current = null
      }
    }

    // --- Mouse handlers ---

    let mouseAnchor: number | null = null

    function handleMouseDown(e: MouseEvent) {
      if (e.button !== 0) return // left button only
      const rect = getCanvasRect()
      if (!rect) return
      const canvasWidth = rect.width
      const x = e.clientX - rect.left
      const state = stateRef.current
      mouseAnchor = screenXToNumber(x, state.center, state.pixelsPerUnit, canvasWidth)
      canvas!.style.cursor = 'grabbing'
    }

    function handleMouseMove(e: MouseEvent) {
      if (mouseAnchor === null) return
      const rect = getCanvasRect()
      if (!rect) return
      const canvasWidth = rect.width
      const x = e.clientX - rect.left
      const state = stateRef.current
      state.center = mouseAnchor - (x - canvasWidth / 2) / state.pixelsPerUnit
      stateRef.current = state
      onStateChange()
    }

    function handleMouseUp() {
      mouseAnchor = null
      if (canvas) canvas.style.cursor = 'grab'
    }

    // --- Wheel handler ---

    function handleWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = getCanvasRect()
      if (!rect) return
      const canvasWidth = rect.width
      const x = e.clientX - rect.left
      const state = stateRef.current

      // Anchor the number under the cursor
      const anchorNumber = screenXToNumber(x, state.center, state.pixelsPerUnit, canvasWidth)

      // Zoom factor: positive deltaY = scroll down = zoom out
      const oldPPU = state.pixelsPerUnit
      const zoomFactor = Math.pow(1.001, -e.deltaY)
      const newPPU = clampPixelsPerUnit(oldPPU * zoomFactor)
      state.pixelsPerUnit = newPPU

      // Re-center so anchorNumber stays under the cursor
      state.center = anchorNumber - (x - canvasWidth / 2) / newPPU
      stateRef.current = state
      onStateChange()

      // Report zoom velocity as log-ratio (positive = zooming in)
      onZoomVelocity?.(Math.log(newPPU / oldPPU))
    }

    // Attach listeners
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false })
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false })
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false })
    canvas.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    // Set initial cursor
    canvas.style.cursor = 'grab'

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchmove', handleTouchMove)
      canvas.removeEventListener('touchend', handleTouchEnd)
      canvas.removeEventListener('touchcancel', handleTouchEnd)
      canvas.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [canvasRef, stateRef, onStateChange, onZoomVelocity, getCanvasWidth, getCanvasRect])
}
