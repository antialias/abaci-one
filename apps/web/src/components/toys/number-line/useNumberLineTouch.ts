import { useEffect, useRef, useCallback } from 'react'
import type { NumberLineState } from './types'
import { screenXToNumber } from './numberLineTicks'

interface UseNumberLineTouchOptions {
  stateRef: React.MutableRefObject<NumberLineState>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  onStateChange: () => void
  /** Called with instantaneous zoom velocity and focal point (0-1 fraction of canvas width). */
  onZoomVelocity?: (velocity: number, focalX: number) => void
  /** Called when a tap (short press, no movement) is detected. Coordinates are CSS px relative to canvas. */
  onTap?: (screenX: number, screenY: number) => void
  /** Called on mousemove (when not dragging) with CSS px coordinates. (-1, -1) signals mouse left. */
  onHover?: (screenX: number, screenY: number) => void
  /** Called when a long-press (≥500ms hold, <10px movement) is detected. Coordinates are CSS px relative to canvas. */
  onLongPress?: (screenX: number, screenY: number) => void
}

const TAP_MAX_DURATION_MS = 300
const TAP_MAX_DISTANCE_PX = 10
const LONG_PRESS_MS = 500

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
export function useNumberLineTouch({ stateRef, canvasRef, onStateChange, onZoomVelocity, onTap, onHover, onLongPress }: UseNumberLineTouchOptions) {
  // Anchor state for single-finger drag / mouse drag
  const dragAnchorRef = useRef<number | null>(null)

  // Anchor state for two-finger pinch
  const pinchAnchorsRef = useRef<{ n1: number; n2: number; id1: number; id2: number } | null>(null)

  // Tap detection state
  const tapStartRef = useRef<{ time: number; x: number; y: number; cancelled: boolean } | null>(null)

  // Long-press timer
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        const y = e.touches[0].clientY - rect.top
        const anchorNumber = screenXToNumber(x, state.center, state.pixelsPerUnit, canvasWidth)
        dragAnchorRef.current = anchorNumber
        pinchAnchorsRef.current = null
        // Start tap detection
        tapStartRef.current = { time: performance.now(), x, y, cancelled: false }
        // Start long-press timer
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = setTimeout(() => {
          const tap = tapStartRef.current
          if (tap && !tap.cancelled) {
            tap.cancelled = true // prevent tap from also firing
            onLongPress?.(tap.x, tap.y)
          }
          longPressTimerRef.current = null
        }, LONG_PRESS_MS)
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
        // Cancel tap and long-press on second finger
        if (tapStartRef.current) tapStartRef.current.cancelled = true
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current)
          longPressTimerRef.current = null
        }
      }
    }

    function handleTouchMove(e: TouchEvent) {
      e.preventDefault()
      const rect = getCanvasRect()
      if (!rect) return
      const canvasWidth = rect.width
      const state = stateRef.current

      // Cancel tap and long-press if finger moved too far
      if (tapStartRef.current && !tapStartRef.current.cancelled && e.touches.length === 1) {
        const tx = e.touches[0].clientX - rect.left
        const ty = e.touches[0].clientY - rect.top
        const dx = tx - tapStartRef.current.x
        const dy = ty - tapStartRef.current.y
        if (Math.sqrt(dx * dx + dy * dy) > TAP_MAX_DISTANCE_PX) {
          tapStartRef.current.cancelled = true
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current)
            longPressTimerRef.current = null
          }
        }
      }

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

        // Report zoom velocity for pinch (focal point = midpoint of two fingers)
        if (state.pixelsPerUnit !== oldPPU) {
          const midX = (screen1 + screen2) / 2
          onZoomVelocity?.(Math.log(state.pixelsPerUnit / oldPPU), midX / canvasWidth)
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
        // Clear long-press timer
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current)
          longPressTimerRef.current = null
        }
        // Fire tap if conditions met
        const tap = tapStartRef.current
        if (tap && !tap.cancelled) {
          const elapsed = performance.now() - tap.time
          if (elapsed < TAP_MAX_DURATION_MS) {
            onTap?.(tap.x, tap.y)
          }
        }
        tapStartRef.current = null
        dragAnchorRef.current = null
        pinchAnchorsRef.current = null
      }
    }

    // --- Mouse handlers ---

    let mouseAnchor: number | null = null
    let mouseDownInfo: { time: number; x: number; y: number; cancelled: boolean } | null = null
    let mouseLongPressTimer: ReturnType<typeof setTimeout> | null = null

    function handleMouseDown(e: MouseEvent) {
      if (e.button !== 0) return // left button only
      const rect = getCanvasRect()
      if (!rect) return
      const canvasWidth = rect.width
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const state = stateRef.current
      mouseAnchor = screenXToNumber(x, state.center, state.pixelsPerUnit, canvasWidth)
      mouseDownInfo = { time: performance.now(), x, y, cancelled: false }
      canvas!.style.cursor = 'grabbing'
      // Start long-press timer for mouse
      if (mouseLongPressTimer) clearTimeout(mouseLongPressTimer)
      mouseLongPressTimer = setTimeout(() => {
        if (mouseDownInfo && !mouseDownInfo.cancelled) {
          mouseDownInfo.cancelled = true
          onLongPress?.(mouseDownInfo.x, mouseDownInfo.y)
        }
        mouseLongPressTimer = null
      }, LONG_PRESS_MS)
    }

    function handleMouseMove(e: MouseEvent) {
      if (mouseAnchor === null) return
      const rect = getCanvasRect()
      if (!rect) return
      const canvasWidth = rect.width
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const state = stateRef.current
      state.center = mouseAnchor - (x - canvasWidth / 2) / state.pixelsPerUnit
      stateRef.current = state
      onStateChange()

      // Cancel mouse tap and long-press if moved too far
      if (mouseDownInfo && !mouseDownInfo.cancelled) {
        const dx = x - mouseDownInfo.x
        const dy = y - mouseDownInfo.y
        if (Math.sqrt(dx * dx + dy * dy) > TAP_MAX_DISTANCE_PX) {
          mouseDownInfo.cancelled = true
          if (mouseLongPressTimer) {
            clearTimeout(mouseLongPressTimer)
            mouseLongPressTimer = null
          }
        }
      }
    }

    function handleMouseUp(e: MouseEvent) {
      // Clear long-press timer
      if (mouseLongPressTimer) {
        clearTimeout(mouseLongPressTimer)
        mouseLongPressTimer = null
      }
      // Fire tap if conditions met
      if (mouseDownInfo && !mouseDownInfo.cancelled) {
        const elapsed = performance.now() - mouseDownInfo.time
        if (elapsed < TAP_MAX_DURATION_MS) {
          const rect = getCanvasRect()
          if (rect) {
            const x = e.clientX - rect.left
            const y = e.clientY - rect.top
            onTap?.(x, y)
          }
        }
      }
      mouseDownInfo = null
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

      // Report zoom velocity and focal point
      onZoomVelocity?.(Math.log(newPPU / oldPPU), x / canvasWidth)
    }

    // --- Hover handler (independent of drag) ---
    function handleCanvasMouseMove(e: MouseEvent) {
      // Only fire hover when not dragging
      if (mouseAnchor !== null) return
      const rect = getCanvasRect()
      if (!rect) return
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      onHover?.(x, y)
    }

    function handleCanvasMouseLeave() {
      onHover?.(-1, -1)
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
    canvas.addEventListener('mousemove', handleCanvasMouseMove)
    canvas.addEventListener('mouseleave', handleCanvasMouseLeave)

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
      canvas.removeEventListener('mousemove', handleCanvasMouseMove)
      canvas.removeEventListener('mouseleave', handleCanvasMouseLeave)
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
      if (mouseLongPressTimer) clearTimeout(mouseLongPressTimer)
    }
  }, [canvasRef, stateRef, onStateChange, onZoomVelocity, onTap, onHover, onLongPress, getCanvasWidth, getCanvasRect])
}
