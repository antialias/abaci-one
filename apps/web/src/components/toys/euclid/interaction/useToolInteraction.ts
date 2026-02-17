import { useEffect, useCallback } from 'react'
import type {
  ConstructionState,
  EuclidViewportState,
  CompassPhase,
  StraightedgePhase,
  MacroPhase,
  ActiveTool,
  IntersectionCandidate,
  ConstructionElement,
  ExpectedAction,
} from '../types'
import { getPoint } from '../engine/constructionState'
import { screenToWorld2D } from '../../shared/coordinateConversions'
import { hitTestPoints, hitTestIntersectionCandidates } from './hitTesting'

/** Sweep threshold: ~350 degrees → commit circle */
const SWEEP_THRESHOLD = 2 * Math.PI - 0.26

interface UseToolInteractionOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  viewportRef: React.MutableRefObject<EuclidViewportState>
  constructionRef: React.MutableRefObject<ConstructionState>
  compassPhaseRef: React.MutableRefObject<CompassPhase>
  straightedgePhaseRef: React.MutableRefObject<StraightedgePhase>
  pointerWorldRef: React.MutableRefObject<{ x: number; y: number } | null>
  snappedPointIdRef: React.MutableRefObject<string | null>
  candidatesRef: React.MutableRefObject<IntersectionCandidate[]>
  pointerCapturedRef: React.MutableRefObject<boolean>
  activeToolRef: React.MutableRefObject<ActiveTool>
  needsDrawRef: React.MutableRefObject<boolean>
  onCommitCircle: (centerId: string, radiusPointId: string) => void
  onCommitSegment: (fromId: string, toId: string) => void
  onMarkIntersection: (candidate: IntersectionCandidate) => void
  /** In guided mode, the current step's expected action. Used to constrain
   *  which points the compass/straightedge snaps to during drag. */
  expectedActionRef: React.MutableRefObject<ExpectedAction | null>
  macroPhaseRef: React.MutableRefObject<MacroPhase>
  onCommitMacro: (propId: number, inputPointIds: string[]) => void
}

function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI
  while (angle <= -Math.PI) angle += 2 * Math.PI
  return angle
}

/**
 * Single hook handling compass, straightedge, and intersection marking.
 * Registers on canvas with { capture: true } to intercept before pan/zoom.
 */
export function useToolInteraction({
  canvasRef,
  viewportRef,
  constructionRef,
  compassPhaseRef,
  straightedgePhaseRef,
  pointerWorldRef,
  snappedPointIdRef,
  candidatesRef,
  pointerCapturedRef,
  activeToolRef,
  needsDrawRef,
  onCommitCircle,
  onCommitSegment,
  onMarkIntersection,
  expectedActionRef,
  macroPhaseRef,
  onCommitMacro,
}: UseToolInteractionOptions) {
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

    function getCSSSize() {
      const dpr = window.devicePixelRatio || 1
      return {
        w: canvas!.width / dpr,
        h: canvas!.height / dpr,
      }
    }

    function requestDraw() {
      needsDrawRef.current = true
    }

    // ── Pointer event handlers ──

    function handlePointerDown(e: PointerEvent) {
      const rect = getCanvasRect()
      if (!rect) return
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const { w, h } = getCSSSize()
      const world = toWorld(sx, sy, w, h)
      const isTouch = e.pointerType === 'touch'
      const state = constructionRef.current
      const viewport = viewportRef.current
      const tool = activeToolRef.current

      // Update pointer position
      pointerWorldRef.current = world

      // Hit test points
      const hitPt = hitTestPoints(sx, sy, state, viewport, w, h, isTouch)
      snappedPointIdRef.current = hitPt?.id ?? null

      // ── Intersection marking: tap near a candidate ──
      // In guided mode, only allow candidate taps during intersection steps.
      // Otherwise, accidental taps during compass/straightedge steps create
      // unwanted points from leftover candidates.
      const compass = compassPhaseRef.current
      const straightedge = straightedgePhaseRef.current
      const expected = expectedActionRef.current
      const allowCandidateTap = !expected || expected.type === 'intersection'
      if (allowCandidateTap && compass.tag === 'idle' && straightedge.tag === 'idle') {
        const hitCandidate = hitTestIntersectionCandidates(
          sx, sy, candidatesRef.current, viewport, w, h, isTouch,
        )
        if (hitCandidate) {
          e.stopPropagation()
          pointerCapturedRef.current = true
          onMarkIntersection(hitCandidate)
          requestDraw()
          // Release capture immediately — it's a tap
          pointerCapturedRef.current = false
          return
        }
      }

      // ── Tool gestures ──
      if (!hitPt) {
        requestDraw()
        return
      }

      if (tool === 'compass') {
        if (compass.tag === 'idle') {
          // Set center
          e.stopPropagation()
          pointerCapturedRef.current = true
          compassPhaseRef.current = { tag: 'center-set', centerId: hitPt.id }
          requestDraw()
          return
        }
      }

      if (tool === 'straightedge') {
        if (straightedge.tag === 'idle') {
          // Set from point
          e.stopPropagation()
          pointerCapturedRef.current = true
          straightedgePhaseRef.current = { tag: 'from-set', fromId: hitPt.id }
          requestDraw()
          return
        }
      }

      if (tool === 'macro') {
        const macro = macroPhaseRef.current
        if (macro.tag === 'selecting') {
          e.stopPropagation()

          // In guided mode, validate against expected input points
          const expected = expectedActionRef.current
          if (expected?.type === 'macro') {
            const nextIdx = macro.selectedPointIds.length
            if (nextIdx < expected.inputPointIds.length) {
              if (hitPt.id !== expected.inputPointIds[nextIdx]) {
                // Wrong point — ignore
                requestDraw()
                return
              }
            }
          }

          const newSelected = [...macro.selectedPointIds, hitPt.id]
          if (newSelected.length >= macro.inputLabels.length) {
            // All inputs collected — commit
            macroPhaseRef.current = { tag: 'idle' }
            pointerCapturedRef.current = false
            onCommitMacro(macro.propId, newSelected)
          } else {
            macroPhaseRef.current = {
              ...macro,
              selectedPointIds: newSelected,
            }
          }
          requestDraw()
          return
        }
      }
    }

    function handlePointerMove(e: PointerEvent) {
      const rect = getCanvasRect()
      if (!rect) return
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const { w, h } = getCSSSize()
      const world = toWorld(sx, sy, w, h)
      const isTouch = e.pointerType === 'touch'
      const state = constructionRef.current
      const viewport = viewportRef.current

      pointerWorldRef.current = world

      // Always update snap
      const hitPt = hitTestPoints(sx, sy, state, viewport, w, h, isTouch)
      snappedPointIdRef.current = hitPt?.id ?? null

      const compass = compassPhaseRef.current

      // ── Compass: center-set → check if we've reached another point (snap to radius) ──
      if (compass.tag === 'center-set') {
        if (hitPt && hitPt.id !== compass.centerId) {
          // In guided mode, only snap to the expected radius point
          const expected = expectedActionRef.current
          if (
            expected?.type === 'compass' &&
            expected.centerId === compass.centerId &&
            hitPt.id !== expected.radiusPointId
          ) {
            // Skip — not the expected radius point, user is dragging through
            requestDraw()
            return
          }

          // Snap to this point as radius point
          const center = getPoint(state, compass.centerId)
          if (center) {
            const dx = hitPt.x - center.x
            const dy = hitPt.y - center.y
            const radius = Math.sqrt(dx * dx + dy * dy)
            compassPhaseRef.current = {
              tag: 'radius-set',
              centerId: compass.centerId,
              radiusPointId: hitPt.id,
              radius,
              enterTime: performance.now(),
            }
          }
        }
        requestDraw()
        return
      }

      // ── Compass: radius-set → re-snap or transition to sweeping ──
      if (compass.tag === 'radius-set') {
        // If near a different point (not center), re-snap to it
        if (hitPt && hitPt.id !== compass.centerId) {
          if (hitPt.id !== compass.radiusPointId) {
            // In guided mode, only re-snap to the expected radius point
            const expected = expectedActionRef.current
            if (
              expected?.type === 'compass' &&
              expected.centerId === compass.centerId &&
              hitPt.id !== expected.radiusPointId
            ) {
              // Skip — not the expected radius point
              requestDraw()
              return
            }

            const center = getPoint(state, compass.centerId)
            if (center) {
              const dx = hitPt.x - center.x
              const dy = hitPt.y - center.y
              compassPhaseRef.current = {
                tag: 'radius-set',
                centerId: compass.centerId,
                radiusPointId: hitPt.id,
                radius: Math.sqrt(dx * dx + dy * dy),
                enterTime: performance.now(),
              }
            }
          }
          // Still on a point — don't start sweeping yet
          requestDraw()
          return
        }

        // Pointer left all points. If the user was just passing through
        // (< 150ms dwell), go back to center-set so they can keep dragging.
        const dwellTime = performance.now() - compass.enterTime
        if (dwellTime < 150) {
          compassPhaseRef.current = { tag: 'center-set', centerId: compass.centerId }
          requestDraw()
          return
        }

        // Dwelled long enough — the user settled on this point. Start sweeping.
        const center = getPoint(state, compass.centerId)
        const radiusPt = getPoint(state, compass.radiusPointId)
        if (center && radiusPt) {
          const startAngle = Math.atan2(radiusPt.y - center.y, radiusPt.x - center.x)
          const currentAngle = Math.atan2(world.y - center.y, world.x - center.x)
          compassPhaseRef.current = {
            tag: 'sweeping',
            centerId: compass.centerId,
            radiusPointId: compass.radiusPointId,
            radius: compass.radius,
            startAngle,
            prevAngle: currentAngle,
            cumulativeSweep: 0,
          }
        }
        requestDraw()
        return
      }

      // ── Compass: sweeping → accumulate angle ──
      if (compass.tag === 'sweeping') {
        const center = getPoint(state, compass.centerId)
        if (center) {
          const newAngle = Math.atan2(world.y - center.y, world.x - center.x)
          const delta = normalizeAngle(newAngle - compass.prevAngle)
          const newSweep = compass.cumulativeSweep + delta

          compassPhaseRef.current = {
            ...compass,
            prevAngle: newAngle,
            cumulativeSweep: newSweep,
          }

          // Check for completion
          if (Math.abs(newSweep) >= SWEEP_THRESHOLD) {
            onCommitCircle(compass.centerId, compass.radiusPointId)
            compassPhaseRef.current = { tag: 'idle' }
            pointerCapturedRef.current = false
          }
        }
        requestDraw()
        return
      }

      // ── Straightedge: from-set → just show preview ──
      if (straightedgePhaseRef.current.tag === 'from-set') {
        requestDraw()
        return
      }

      requestDraw()
    }

    function handlePointerUp(e: PointerEvent) {
      const rect = getCanvasRect()
      if (!rect) return
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const { w, h } = getCSSSize()
      const isTouch = e.pointerType === 'touch'
      const state = constructionRef.current
      const viewport = viewportRef.current

      const compass = compassPhaseRef.current
      const straightedge = straightedgePhaseRef.current

      // ── Compass: cancel on pointer up if not completed ──
      if (compass.tag !== 'idle') {
        compassPhaseRef.current = { tag: 'idle' }
        pointerCapturedRef.current = false
        requestDraw()
        return
      }

      // ── Straightedge: commit if pointer up near another point ──
      if (straightedge.tag === 'from-set') {
        const hitPt = hitTestPoints(sx, sy, state, viewport, w, h, isTouch)
        if (hitPt && hitPt.id !== straightedge.fromId) {
          onCommitSegment(straightedge.fromId, hitPt.id)
        }
        straightedgePhaseRef.current = { tag: 'idle' }
        pointerCapturedRef.current = false
        requestDraw()
        return
      }

      pointerCapturedRef.current = false
      pointerWorldRef.current = null
      snappedPointIdRef.current = null
      requestDraw()
    }

    function handlePointerCancel() {
      compassPhaseRef.current = { tag: 'idle' }
      straightedgePhaseRef.current = { tag: 'idle' }
      macroPhaseRef.current = { tag: 'idle' }
      pointerCapturedRef.current = false
      pointerWorldRef.current = null
      snappedPointIdRef.current = null
      requestDraw()
    }

    // Register with capture: true to intercept before pan/zoom
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
    viewportRef,
    constructionRef,
    compassPhaseRef,
    straightedgePhaseRef,
    pointerWorldRef,
    snappedPointIdRef,
    candidatesRef,
    pointerCapturedRef,
    activeToolRef,
    needsDrawRef,
    onCommitCircle,
    onCommitSegment,
    onMarkIntersection,
    expectedActionRef,
    macroPhaseRef,
    onCommitMacro,
    getCanvasRect,
  ])
}
