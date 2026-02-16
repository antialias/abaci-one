import { useEffect, useRef, useCallback } from 'react'
import type { CoordinatePlaneState, ZoomMode } from './types'
import { screenToWorld2D } from '../shared/coordinateConversions'

interface UseCoordinatePlaneTouchOptions {
  stateRef: React.MutableRefObject<CoordinatePlaneState>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  zoomModeRef: React.MutableRefObject<ZoomMode>
  /** When true, another element (e.g. ruler) has captured the pointer — skip pan/zoom */
  pointerCapturedRef?: React.MutableRefObject<boolean>
  onStateChange: () => void
  onZoomVelocity?: (velocity: number, focalX: number, focalY: number) => void
}

// Zoom limits (same as number line)
const MIN_PPU = 0.001
const MAX_PPU = 1e14

function clampPPU(ppu: number): number {
  return Math.max(MIN_PPU, Math.min(MAX_PPU, ppu))
}

/**
 * Hook that attaches touch, mouse, and wheel handlers to a canvas element
 * for panning and zooming a 2D coordinate plane.
 *
 * All math uses absolute anchor-based computations (not deltas) to prevent drift.
 */
export function useCoordinatePlaneTouch({
  stateRef,
  canvasRef,
  zoomModeRef,
  pointerCapturedRef,
  onStateChange,
  onZoomVelocity,
}: UseCoordinatePlaneTouchOptions) {
  // Anchor state for single-finger drag
  const dragAnchorRef = useRef<{ wx: number; wy: number } | null>(null)

  // Anchor state for two-finger pinch
  const pinchAnchorsRef = useRef<{
    w1: { x: number; y: number }
    w2: { x: number; y: number }
    id1: number
    id2: number
  } | null>(null)

  const getCanvasRect = useCallback(() => {
    return canvasRef.current?.getBoundingClientRect()
  }, [canvasRef])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function toWorld(sx: number, sy: number, cw: number, ch: number) {
      const s = stateRef.current
      return screenToWorld2D(sx, sy, s.center.x, s.center.y, s.pixelsPerUnit.x, s.pixelsPerUnit.y, cw, ch)
    }

    // --- Touch handlers ---

    function handleTouchStart(e: TouchEvent) {
      if (pointerCapturedRef?.current) return
      e.preventDefault()
      const rect = getCanvasRect()
      if (!rect) return
      const cw = rect.width
      const ch = rect.height

      if (e.touches.length === 1) {
        const sx = e.touches[0].clientX - rect.left
        const sy = e.touches[0].clientY - rect.top
        const w = toWorld(sx, sy, cw, ch)
        dragAnchorRef.current = { wx: w.x, wy: w.y }
        pinchAnchorsRef.current = null
      } else if (e.touches.length === 2) {
        const sx1 = e.touches[0].clientX - rect.left
        const sy1 = e.touches[0].clientY - rect.top
        const sx2 = e.touches[1].clientX - rect.left
        const sy2 = e.touches[1].clientY - rect.top
        const w1 = toWorld(sx1, sy1, cw, ch)
        const w2 = toWorld(sx2, sy2, cw, ch)
        pinchAnchorsRef.current = {
          w1: { x: w1.x, y: w1.y },
          w2: { x: w2.x, y: w2.y },
          id1: e.touches[0].identifier,
          id2: e.touches[1].identifier,
        }
        dragAnchorRef.current = null
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (pointerCapturedRef?.current) return
      e.preventDefault()
      const rect = getCanvasRect()
      if (!rect) return
      const cw = rect.width
      const ch = rect.height
      const state = stateRef.current
      const mode = zoomModeRef.current

      if (e.touches.length === 2 && pinchAnchorsRef.current) {
        const { w1, w2, id1, id2 } = pinchAnchorsRef.current

        let touch1: Touch | null = null
        let touch2: Touch | null = null
        for (let i = 0; i < e.touches.length; i++) {
          if (e.touches[i].identifier === id1) touch1 = e.touches[i]
          if (e.touches[i].identifier === id2) touch2 = e.touches[i]
        }
        if (!touch1 || !touch2) return

        const s1x = touch1.clientX - rect.left
        const s1y = touch1.clientY - rect.top
        const s2x = touch2.clientX - rect.left
        const s2y = touch2.clientY - rect.top

        const oldPpuX = state.pixelsPerUnit.x
        const oldPpuY = state.pixelsPerUnit.y

        if (mode === 'uniform') {
          // Use euclidean distance ratio for uniform zoom
          const worldDist = Math.sqrt((w1.x - w2.x) ** 2 + (w1.y - w2.y) ** 2)
          const screenDist = Math.sqrt((s1x - s2x) ** 2 + (s1y - s2y) ** 2)

          if (worldDist < 1e-12) {
            // Anchors too close, just pan
            const midSx = (s1x + s2x) / 2
            const midSy = (s1y + s2y) / 2
            const midWx = (w1.x + w2.x) / 2
            const midWy = (w1.y + w2.y) / 2
            state.center.x = midWx - (midSx - cw / 2) / state.pixelsPerUnit.x
            state.center.y = midWy + (midSy - ch / 2) / state.pixelsPerUnit.y
          } else {
            const newPpu = clampPPU(screenDist / worldDist)
            state.pixelsPerUnit.x = newPpu
            state.pixelsPerUnit.y = newPpu
            // Re-center so w1 stays under touch1
            state.center.x = w1.x - (s1x - cw / 2) / newPpu
            state.center.y = w1.y + (s1y - ch / 2) / newPpu
          }
        } else {
          // Independent mode: solve each axis independently
          const wdx = w1.x - w2.x
          const wdy = w1.y - w2.y

          if (Math.abs(wdx) > 1e-12) {
            const newPpuX = clampPPU((s1x - s2x) / wdx)
            state.pixelsPerUnit.x = newPpuX
            state.center.x = w1.x - (s1x - cw / 2) / newPpuX
          }
          if (Math.abs(wdy) > 1e-12) {
            // Y inversion: screen delta is -(world delta * ppu)
            const newPpuY = clampPPU(-(s1y - s2y) / wdy)
            state.pixelsPerUnit.y = newPpuY
            state.center.y = w1.y + (s1y - ch / 2) / newPpuY
          }
        }

        onStateChange()

        // Report zoom velocity
        const ppuAvgOld = (oldPpuX + oldPpuY) / 2
        const ppuAvgNew = (state.pixelsPerUnit.x + state.pixelsPerUnit.y) / 2
        if (ppuAvgNew !== ppuAvgOld) {
          const midX = (s1x + s2x) / 2
          const midY = (s1y + s2y) / 2
          onZoomVelocity?.(Math.log(ppuAvgNew / ppuAvgOld), midX / cw, midY / ch)
        }
      } else if (e.touches.length === 1 && dragAnchorRef.current) {
        const sx = e.touches[0].clientX - rect.left
        const sy = e.touches[0].clientY - rect.top
        const anchor = dragAnchorRef.current
        state.center.x = anchor.wx - (sx - cw / 2) / state.pixelsPerUnit.x
        state.center.y = anchor.wy + (sy - ch / 2) / state.pixelsPerUnit.y
        onStateChange()
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      e.preventDefault()
      const rect = getCanvasRect()
      if (!rect) return
      const cw = rect.width
      const ch = rect.height

      if (e.touches.length === 1 && pinchAnchorsRef.current) {
        // Transition 2 -> 1 finger: re-anchor
        const t = e.touches[0]
        const sx = t.clientX - rect.left
        const sy = t.clientY - rect.top
        const w = toWorld(sx, sy, cw, ch)
        dragAnchorRef.current = { wx: w.x, wy: w.y }
        pinchAnchorsRef.current = null
      } else if (e.touches.length === 0) {
        dragAnchorRef.current = null
        pinchAnchorsRef.current = null
      }
    }

    // --- Mouse handlers ---

    let mouseAnchor: { wx: number; wy: number } | null = null

    function handleMouseDown(e: MouseEvent) {
      if (pointerCapturedRef?.current) return
      if (e.button !== 0) return
      const rect = getCanvasRect()
      if (!rect) return
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const w = toWorld(sx, sy, rect.width, rect.height)
      mouseAnchor = { wx: w.x, wy: w.y }
      canvas!.style.cursor = 'grabbing'
    }

    function handleMouseMove(e: MouseEvent) {
      if (!mouseAnchor) return
      const rect = getCanvasRect()
      if (!rect) return
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const state = stateRef.current
      state.center.x = mouseAnchor.wx - (sx - rect.width / 2) / state.pixelsPerUnit.x
      state.center.y = mouseAnchor.wy + (sy - rect.height / 2) / state.pixelsPerUnit.y
      onStateChange()
    }

    function handleMouseUp() {
      mouseAnchor = null
      if (canvas) canvas.style.cursor = 'grab'
    }

    // --- Wheel handler ---

    function handleWheel(e: WheelEvent) {
      if (pointerCapturedRef?.current) return
      e.preventDefault()
      const rect = getCanvasRect()
      if (!rect) return
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const cw = rect.width
      const ch = rect.height
      const state = stateRef.current
      const mode = zoomModeRef.current

      // Anchor the world point under the cursor
      const anchor = toWorld(sx, sy, cw, ch)

      const zoomFactor = Math.pow(1.001, -e.deltaY)
      const oldPpuX = state.pixelsPerUnit.x
      const oldPpuY = state.pixelsPerUnit.y

      if (mode === 'uniform') {
        // Shift+wheel = X-only, Alt+wheel = Y-only (no-ops in uniform mode)
        const newPpu = clampPPU(state.pixelsPerUnit.x * zoomFactor)
        state.pixelsPerUnit.x = newPpu
        state.pixelsPerUnit.y = newPpu
        state.center.x = anchor.x - (sx - cw / 2) / newPpu
        state.center.y = anchor.y + (sy - ch / 2) / newPpu
      } else {
        // Independent mode
        const zoomX = !e.altKey // Alt = Y-only
        const zoomY = !e.shiftKey // Shift = X-only

        if (zoomX) {
          const newPpuX = clampPPU(state.pixelsPerUnit.x * zoomFactor)
          state.pixelsPerUnit.x = newPpuX
          state.center.x = anchor.x - (sx - cw / 2) / newPpuX
        }
        if (zoomY) {
          const newPpuY = clampPPU(state.pixelsPerUnit.y * zoomFactor)
          state.pixelsPerUnit.y = newPpuY
          state.center.y = anchor.y + (sy - ch / 2) / newPpuY
        }
      }

      onStateChange()

      const ppuAvgOld = (oldPpuX + oldPpuY) / 2
      const ppuAvgNew = (state.pixelsPerUnit.x + state.pixelsPerUnit.y) / 2
      onZoomVelocity?.(Math.log(ppuAvgNew / ppuAvgOld), sx / cw, sy / ch)
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
  }, [canvasRef, stateRef, zoomModeRef, pointerCapturedRef, onStateChange, onZoomVelocity, getCanvasRect])
}
