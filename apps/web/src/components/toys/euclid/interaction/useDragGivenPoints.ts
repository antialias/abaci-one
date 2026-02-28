import { useEffect, useCallback } from 'react'
import type {
  ConstructionState,
  ConstructionElement,
  EuclidViewportState,
  PropositionDef,
  ConstructionPoint,
  ActiveTool,
} from '../types'
import type { FactStore } from '../engine/factStore'
import type { IntersectionCandidate } from '../types'
import type { PostCompletionAction, ReplayResult } from '../engine/replayConstruction'
import { getAllPoints } from '../engine/constructionState'
import { screenToWorld2D, worldToScreen2D } from '../../shared/coordinateConversions'
import { replayConstruction } from '../engine/replayConstruction'

/** Hit radius for draggable points (screen pixels) */
const HIT_RADIUS_MOUSE = 30
const HIT_RADIUS_TOUCH = 44

interface UseDragGivenPointsOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  propositionRef: React.MutableRefObject<PropositionDef>
  constructionRef: React.MutableRefObject<ConstructionState>
  factStoreRef: React.MutableRefObject<FactStore>
  viewportRef: React.MutableRefObject<EuclidViewportState>
  isCompleteRef: React.MutableRefObject<boolean>
  activeToolRef: React.MutableRefObject<ActiveTool>
  needsDrawRef: React.MutableRefObject<boolean>
  pointerCapturedRef: React.MutableRefObject<boolean>
  candidatesRef: React.MutableRefObject<IntersectionCandidate[]>
  postCompletionActionsRef: React.MutableRefObject<PostCompletionAction[]>
  /** When true, drag interactions are suppressed (e.g. during correction animations) */
  interactionLockedRef?: React.MutableRefObject<boolean>
  /** Called when construction state is replaced during drag */
  onReplayResult: (result: ReplayResult) => void
  /** Called once when a drag gesture starts on a given point */
  onDragStart?: (pointId: string) => void
}

/**
 * Post-completion drag interaction for given points.
 * When the proposition is complete and has `draggablePointIds`, the user can
 * grab a given point and move it. The entire construction replays from scratch
 * on each frame with the updated positions.
 */
export function useDragGivenPoints({
  canvasRef,
  propositionRef,
  constructionRef,
  factStoreRef,
  viewportRef,
  isCompleteRef,
  activeToolRef,
  needsDrawRef,
  pointerCapturedRef,
  candidatesRef,
  postCompletionActionsRef,
  interactionLockedRef,
  onReplayResult,
  onDragStart,
}: UseDragGivenPointsOptions): void {
  const getCanvasRect = useCallback(() => {
    return canvasRef.current?.getBoundingClientRect()
  }, [canvasRef])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let dragPointId: string | null = null
    let hoveredDraggableId: string | null = null

    function toWorld(sx: number, sy: number, cw: number, ch: number) {
      const v = viewportRef.current
      return screenToWorld2D(
        sx,
        sy,
        v.center.x,
        v.center.y,
        v.pixelsPerUnit,
        v.pixelsPerUnit,
        cw,
        ch
      )
    }

    function getCSSSize() {
      const dpr = window.devicePixelRatio || 1
      return {
        w: canvas!.width / dpr,
        h: canvas!.height / dpr,
      }
    }

    function hitTestDraggablePoints(
      screenX: number,
      screenY: number,
      isTouch: boolean
    ): ConstructionPoint | null {
      const prop = propositionRef.current
      const threshold = isTouch ? HIT_RADIUS_TOUCH : HIT_RADIUS_MOUSE
      const state = constructionRef.current
      const viewport = viewportRef.current
      const { w, h } = getCSSSize()
      const draggableSet = new Set(prop.draggablePointIds ?? [])

      let best: ConstructionPoint | null = null
      let bestDist = Infinity

      for (const pt of getAllPoints(state)) {
        // Include given draggable points and user-placed free points
        if (!draggableSet.has(pt.id) && pt.origin !== 'free') continue
        const s = worldToScreen2D(
          pt.x,
          pt.y,
          viewport.center.x,
          viewport.center.y,
          viewport.pixelsPerUnit,
          viewport.pixelsPerUnit,
          w,
          h
        )
        const dx = screenX - s.x
        const dy = screenY - s.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < threshold && dist < bestDist) {
          best = pt
          bestDist = dist
        }
      }

      return best
    }

    function collectCurrentPositions(): Map<string, { x: number; y: number }> {
      const positions = new Map<string, { x: number; y: number }>()
      for (const el of constructionRef.current.elements) {
        if (el.kind === 'point' && el.origin === 'given') {
          positions.set(el.id, { x: el.x, y: el.y })
        }
      }
      return positions
    }

    function handlePointerDown(e: PointerEvent) {
      if (!isCompleteRef.current || activeToolRef.current !== 'move') return
      if (pointerCapturedRef.current) return
      if (interactionLockedRef?.current) return

      const rect = getCanvasRect()
      if (!rect) return
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const isTouch = e.pointerType === 'touch'

      const hit = hitTestDraggablePoints(sx, sy, isTouch)
      if (hit) {
        e.stopPropagation()
        e.preventDefault()
        dragPointId = hit.id
        pointerCapturedRef.current = true
        canvas!.style.cursor = 'grabbing'
        needsDrawRef.current = true
        onDragStart?.(hit.id)
      }
    }

    function handlePointerMove(e: PointerEvent) {
      if (!isCompleteRef.current || activeToolRef.current !== 'move') return

      const prop = propositionRef.current

      const rect = getCanvasRect()
      if (!rect) return
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const { w, h } = getCSSSize()
      const isTouch = e.pointerType === 'touch'

      if (dragPointId) {
        // Dragging — update position and replay construction
        e.stopPropagation()
        e.preventDefault()
        const world = toWorld(sx, sy, w, h)

        // Check if the dragged point is a user-placed free point
        const draggedPt = getAllPoints(constructionRef.current).find((pt) => pt.id === dragPointId)
        let actions = postCompletionActionsRef.current

        if (draggedPt?.origin === 'free') {
          // Update the free-point action coordinates in place
          actions = actions.map((a) =>
            a.type === 'free-point' && a.id === dragPointId ? { ...a, x: world.x, y: world.y } : a
          )
          postCompletionActionsRef.current = actions
        }

        // Collect current given point positions (unchanged for free point drag)
        const positions = collectCurrentPositions()
        if (draggedPt?.origin !== 'free') {
          positions.set(dragPointId, world)
        }

        // Compute fresh given elements
        const computeFn = prop.computeGivenElements
        let givenElements: ConstructionElement[]
        if (computeFn) {
          givenElements = computeFn(positions)
        } else {
          givenElements = prop.givenElements.map((el) => {
            if (el.kind === 'point' && positions.has(el.id)) {
              const pos = positions.get(el.id)!
              return { ...el, x: pos.x, y: pos.y }
            }
            return el
          })
        }

        // Replay the full construction + any post-completion user actions
        const result = replayConstruction(givenElements, prop.steps, prop, actions)
        constructionRef.current = result.state
        factStoreRef.current = result.factStore
        candidatesRef.current = result.candidates
        onReplayResult(result)
        needsDrawRef.current = true
      } else {
        // Not dragging — update cursor based on hover
        const hit = hitTestDraggablePoints(sx, sy, isTouch)
        const newHoveredId = hit?.id ?? null

        if (newHoveredId !== hoveredDraggableId) {
          hoveredDraggableId = newHoveredId
          if (hoveredDraggableId) {
            canvas!.style.cursor = 'grab'
          } else {
            canvas!.style.cursor = ''
          }
        }
      }
    }

    function handlePointerUp(e: PointerEvent) {
      if (!dragPointId) return
      e.stopPropagation()
      dragPointId = null
      pointerCapturedRef.current = false
      canvas!.style.cursor = hoveredDraggableId ? 'grab' : ''
      needsDrawRef.current = true
    }

    function handlePointerCancel() {
      if (!dragPointId) return
      dragPointId = null
      pointerCapturedRef.current = false
      hoveredDraggableId = null
      canvas!.style.cursor = ''
      needsDrawRef.current = true
    }

    // Register with capture: true to intercept before tool interaction and pan/zoom
    canvas.addEventListener('pointerdown', handlePointerDown, { capture: true })
    canvas.addEventListener('pointermove', handlePointerMove, { capture: true })
    canvas.addEventListener('pointerup', handlePointerUp, { capture: true })
    canvas.addEventListener('pointercancel', handlePointerCancel, { capture: true })

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown, { capture: true })
      canvas.removeEventListener('pointermove', handlePointerMove, { capture: true })
      canvas.removeEventListener('pointerup', handlePointerUp, { capture: true })
      canvas.removeEventListener('pointercancel', handlePointerCancel, { capture: true })
    }
  }, [
    canvasRef,
    propositionRef,
    constructionRef,
    factStoreRef,
    viewportRef,
    isCompleteRef,
    activeToolRef,
    needsDrawRef,
    pointerCapturedRef,
    candidatesRef,
    postCompletionActionsRef,
    onReplayResult,
    onDragStart,
    getCanvasRect,
  ])
}
