import { useEffect, useCallback } from 'react'
import type { RulerState, RulerHitZone } from './types'
import type { CoordinatePlaneState } from '../types'
import { worldToScreen2D, screenToWorld2D } from '../../shared/coordinateConversions'
import { HANDLE_HIT_RADIUS, BODY_HALF_WIDTH } from './renderRuler'

interface UseRulerInteractionOptions {
  rulerRef: React.MutableRefObject<RulerState>
  stateRef: React.MutableRefObject<CoordinatePlaneState>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  pointerCapturedRef: React.MutableRefObject<boolean>
  onRulerChange: () => void
  /** Called with the active drag zone (for rendering highlights) or null */
  onActiveHandleChange: (zone: 'handleA' | 'handleB' | 'body' | null) => void
  /** When false, ruler interaction is disabled (no hit testing or dragging) */
  enabled?: boolean
}

/** Distance from a point to the segment AB, clamped to segment */
function distToSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-8) {
    // Degenerate segment
    return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2)
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2)
}

function hitTest(
  screenX: number,
  screenY: number,
  ruler: RulerState,
  planeState: CoordinatePlaneState,
  cssWidth: number,
  cssHeight: number,
): RulerHitZone {
  const s = planeState
  const a = worldToScreen2D(
    ruler.ax, ruler.ay,
    s.center.x, s.center.y,
    s.pixelsPerUnit.x, s.pixelsPerUnit.y,
    cssWidth, cssHeight,
  )
  const b = worldToScreen2D(
    ruler.bx, ruler.by,
    s.center.x, s.center.y,
    s.pixelsPerUnit.x, s.pixelsPerUnit.y,
    cssWidth, cssHeight,
  )

  const dA = Math.sqrt((screenX - a.x) ** 2 + (screenY - a.y) ** 2)
  const dB = Math.sqrt((screenX - b.x) ** 2 + (screenY - b.y) ** 2)

  if (dA < HANDLE_HIT_RADIUS) return 'handleA'
  if (dB < HANDLE_HIT_RADIUS) return 'handleB'

  const bodyHit = BODY_HALF_WIDTH + 12 // generous body hit area
  const dist = distToSegment(screenX, screenY, a.x, a.y, b.x, b.y)
  if (dist < bodyHit) return 'body'

  return 'miss'
}

export function useRulerInteraction({
  rulerRef,
  stateRef,
  canvasRef,
  pointerCapturedRef,
  onRulerChange,
  onActiveHandleChange,
  enabled = true,
}: UseRulerInteractionOptions) {
  const getCanvasRect = useCallback(() => {
    return canvasRef.current?.getBoundingClientRect()
  }, [canvasRef])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !enabled) return

    // Current drag state
    let dragZone: RulerHitZone = 'miss'
    // For body drag: world coords of both handles at drag start
    let bodyDragAnchorA = { x: 0, y: 0 }
    let bodyDragAnchorB = { x: 0, y: 0 }
    let bodyDragStartWorld = { x: 0, y: 0 }

    function snapToInt(v: number): number {
      return Math.round(v)
    }

    function handlePointerDown(sx: number, sy: number): boolean {
      const rect = getCanvasRect()
      if (!rect) return false
      const cssW = rect.width
      const cssH = rect.height

      const zone = hitTest(sx, sy, rulerRef.current, stateRef.current, cssW, cssH)
      if (zone === 'miss') return false

      dragZone = zone
      pointerCapturedRef.current = true
      onActiveHandleChange(zone)

      if (zone === 'body') {
        const ruler = rulerRef.current
        bodyDragAnchorA = { x: ruler.ax, y: ruler.ay }
        bodyDragAnchorB = { x: ruler.bx, y: ruler.by }
        const s = stateRef.current
        const w = screenToWorld2D(sx, sy, s.center.x, s.center.y, s.pixelsPerUnit.x, s.pixelsPerUnit.y, cssW, cssH)
        bodyDragStartWorld = { x: w.x, y: w.y }
      }

      return true
    }

    function handlePointerMove(sx: number, sy: number) {
      if (dragZone === 'miss') return
      const rect = getCanvasRect()
      if (!rect) return
      const cssW = rect.width
      const cssH = rect.height
      const s = stateRef.current
      const ruler = rulerRef.current

      if (dragZone === 'handleA' || dragZone === 'handleB') {
        const w = screenToWorld2D(sx, sy, s.center.x, s.center.y, s.pixelsPerUnit.x, s.pixelsPerUnit.y, cssW, cssH)
        const snappedX = snapToInt(w.x)
        const snappedY = snapToInt(w.y)

        if (dragZone === 'handleA') {
          ruler.ax = snappedX
          ruler.ay = snappedY
        } else {
          ruler.bx = snappedX
          ruler.by = snappedY
        }
        onRulerChange()
      } else if (dragZone === 'body') {
        const w = screenToWorld2D(sx, sy, s.center.x, s.center.y, s.pixelsPerUnit.x, s.pixelsPerUnit.y, cssW, cssH)
        const rawDx = w.x - bodyDragStartWorld.x
        const rawDy = w.y - bodyDragStartWorld.y
        const intDx = Math.round(rawDx)
        const intDy = Math.round(rawDy)

        ruler.ax = bodyDragAnchorA.x + intDx
        ruler.ay = bodyDragAnchorA.y + intDy
        ruler.bx = bodyDragAnchorB.x + intDx
        ruler.by = bodyDragAnchorB.y + intDy
        onRulerChange()
      }
    }

    function handlePointerUp() {
      dragZone = 'miss'
      pointerCapturedRef.current = false
      onActiveHandleChange(null)
    }

    // ── Mouse handlers ─────────────────────────────────────────

    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return
      const rect = getCanvasRect()
      if (!rect) return
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top

      if (handlePointerDown(sx, sy)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    function onMouseMove(e: MouseEvent) {
      if (dragZone === 'miss') return
      const rect = getCanvasRect()
      if (!rect) return
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      handlePointerMove(sx, sy)
    }

    function onMouseUp() {
      if (dragZone !== 'miss') {
        handlePointerUp()
      }
    }

    // ── Touch handlers ─────────────────────────────────────────

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return
      const rect = getCanvasRect()
      if (!rect) return
      const t = e.touches[0]
      const sx = t.clientX - rect.left
      const sy = t.clientY - rect.top

      if (handlePointerDown(sx, sy)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (dragZone === 'miss') return
      if (e.touches.length !== 1) {
        handlePointerUp()
        return
      }
      const rect = getCanvasRect()
      if (!rect) return
      const t = e.touches[0]
      const sx = t.clientX - rect.left
      const sy = t.clientY - rect.top
      handlePointerMove(sx, sy)
      e.preventDefault()
    }

    function onTouchEnd(e: TouchEvent) {
      if (dragZone !== 'miss') {
        handlePointerUp()
        if (e.touches.length === 0) {
          e.preventDefault()
        }
      }
    }

    // Ruler handlers go on canvas with capture to intercept before pan/zoom
    canvas.addEventListener('mousedown', onMouseDown, { capture: true })
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('touchstart', onTouchStart, { capture: true, passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { capture: true, passive: false })
    canvas.addEventListener('touchend', onTouchEnd, { capture: true })
    canvas.addEventListener('touchcancel', onTouchEnd, { capture: true })

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown, { capture: true })
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('touchstart', onTouchStart, { capture: true })
      canvas.removeEventListener('touchmove', onTouchMove, { capture: true })
      canvas.removeEventListener('touchend', onTouchEnd, { capture: true })
      canvas.removeEventListener('touchcancel', onTouchEnd, { capture: true })
    }
  }, [canvasRef, rulerRef, stateRef, pointerCapturedRef, onRulerChange, onActiveHandleChange, getCanvasRect, enabled])
}
