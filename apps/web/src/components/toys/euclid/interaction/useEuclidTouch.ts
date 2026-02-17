import { useEffect, useRef, useCallback } from 'react'
import type { EuclidViewportState } from '../types'
import { screenToWorld2D } from '../../shared/coordinateConversions'

interface UseEuclidTouchOptions {
  viewportRef: React.MutableRefObject<EuclidViewportState>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** When true, a tool has captured the pointer — skip pan/zoom */
  pointerCapturedRef: React.MutableRefObject<boolean>
  onViewportChange: () => void
}

const MIN_PPU = 1
const MAX_PPU = 1000

function clampPPU(ppu: number): number {
  return Math.max(MIN_PPU, Math.min(MAX_PPU, ppu))
}

/**
 * Pan/zoom hook for the Euclid canvas.
 * Uniform zoom only (single pixelsPerUnit).
 * Adapted from useCoordinatePlaneTouch.ts with simplifications.
 */
export function useEuclidTouch({
  viewportRef,
  canvasRef,
  pointerCapturedRef,
  onViewportChange,
}: UseEuclidTouchOptions) {
  const dragAnchorRef = useRef<{ wx: number; wy: number } | null>(null)
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
      const v = viewportRef.current
      return screenToWorld2D(
        sx, sy,
        v.center.x, v.center.y,
        v.pixelsPerUnit, v.pixelsPerUnit,
        cw, ch,
      )
    }

    // --- Touch handlers ---

    function handleTouchStart(e: TouchEvent) {
      if (pointerCapturedRef.current) return
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
      if (pointerCapturedRef.current) return
      e.preventDefault()
      const rect = getCanvasRect()
      if (!rect) return
      const cw = rect.width
      const ch = rect.height
      const v = viewportRef.current

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

        // Euclidean distance ratio for uniform zoom
        const worldDist = Math.sqrt((w1.x - w2.x) ** 2 + (w1.y - w2.y) ** 2)
        const screenDist = Math.sqrt((s1x - s2x) ** 2 + (s1y - s2y) ** 2)

        if (worldDist < 1e-12) {
          const midSx = (s1x + s2x) / 2
          const midSy = (s1y + s2y) / 2
          const midWx = (w1.x + w2.x) / 2
          const midWy = (w1.y + w2.y) / 2
          v.center.x = midWx - (midSx - cw / 2) / v.pixelsPerUnit
          v.center.y = midWy + (midSy - ch / 2) / v.pixelsPerUnit
        } else {
          const newPpu = clampPPU(screenDist / worldDist)
          v.pixelsPerUnit = newPpu
          v.center.x = w1.x - (s1x - cw / 2) / newPpu
          v.center.y = w1.y + (s1y - ch / 2) / newPpu
        }

        onViewportChange()
      } else if (e.touches.length === 1 && dragAnchorRef.current) {
        const sx = e.touches[0].clientX - rect.left
        const sy = e.touches[0].clientY - rect.top
        const anchor = dragAnchorRef.current
        v.center.x = anchor.wx - (sx - cw / 2) / v.pixelsPerUnit
        v.center.y = anchor.wy + (sy - ch / 2) / v.pixelsPerUnit
        onViewportChange()
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      e.preventDefault()
      const rect = getCanvasRect()
      if (!rect) return
      const cw = rect.width
      const ch = rect.height

      if (e.touches.length === 1 && pinchAnchorsRef.current) {
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
      if (pointerCapturedRef.current) return
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
      const v = viewportRef.current
      v.center.x = mouseAnchor.wx - (sx - rect.width / 2) / v.pixelsPerUnit
      v.center.y = mouseAnchor.wy + (sy - rect.height / 2) / v.pixelsPerUnit
      onViewportChange()
    }

    function handleMouseUp() {
      mouseAnchor = null
      if (canvas) canvas.style.cursor = 'grab'
    }

    // --- Wheel handler ---

    function handleWheel(e: WheelEvent) {
      if (pointerCapturedRef.current) return
      e.preventDefault()
      const rect = getCanvasRect()
      if (!rect) return
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const cw = rect.width
      const ch = rect.height
      const v = viewportRef.current

      const anchor = toWorld(sx, sy, cw, ch)
      const zoomFactor = Math.pow(1.001, -e.deltaY)
      const newPpu = clampPPU(v.pixelsPerUnit * zoomFactor)
      v.pixelsPerUnit = newPpu
      v.center.x = anchor.x - (sx - cw / 2) / newPpu
      v.center.y = anchor.y + (sy - ch / 2) / newPpu

      onViewportChange()
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
  }, [canvasRef, viewportRef, pointerCapturedRef, onViewportChange, getCanvasRect])
}
