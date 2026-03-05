import { useState, useRef, useCallback } from 'react'

interface UseQuadDragOptions {
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function useQuadDrag({ containerRef }: UseQuadDragOptions) {
  const quadRef = useRef<HTMLDivElement>(null)
  const quadDragRef = useRef<{
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)
  const [quadOffset, setQuadOffset] = useState({ x: 0, y: 0 })
  const [quadDragging, setQuadDragging] = useState(false)

  const handleQuadPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const el = e.currentTarget
      el.setPointerCapture(e.pointerId)
      quadDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: quadOffset.x,
        origY: quadOffset.y,
      }
      setQuadDragging(true)
    },
    [quadOffset]
  )

  const handleQuadPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = quadDragRef.current
    if (!drag) return
    e.preventDefault()
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    let newX = drag.origX + dx
    let newY = drag.origY + dy

    // Clamp so the quad stays within the canvas pane bounds.
    const container = containerRef.current
    const root = container?.parentElement // euclid-canvas root
    if (container && root) {
      const rootW = root.clientWidth
      const rootH = root.clientHeight
      const cw = container.clientWidth
      const ch = container.clientHeight
      const QUAD_SIZE = 76
      const MARGIN = 12

      const baseX = cw - MARGIN - QUAD_SIZE
      const baseY = ch - MARGIN - QUAD_SIZE
      const quadLeft = baseX + newX
      const quadTop = baseY + newY

      const clampedLeft = Math.max(0, Math.min(quadLeft, rootW - QUAD_SIZE))
      const clampedTop = Math.max(0, Math.min(quadTop, rootH - QUAD_SIZE))
      newX = clampedLeft - baseX
      newY = clampedTop - baseY
    }

    setQuadOffset({ x: newX, y: newY })
  }, [])

  const handleQuadPointerUp = useCallback((e: React.PointerEvent) => {
    if (!quadDragRef.current) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    quadDragRef.current = null
    setQuadDragging(false)
  }, [])

  return {
    quadRef,
    quadOffset,
    quadDragging,
    handleQuadPointerDown,
    handleQuadPointerMove,
    handleQuadPointerUp,
  }
}
