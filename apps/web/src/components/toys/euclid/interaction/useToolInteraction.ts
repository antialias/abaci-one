import { useEffect, useCallback } from 'react'
import type {
  ConstructionState,
  EuclidViewportState,
  CompassPhase,
  StraightedgePhase,
  ExtendPhase,
  MacroPhase,
  ActiveTool,
  IntersectionCandidate,
  ConstructionElement,
  ExpectedAction,
} from '../types'
import { getPoint } from '../engine/constructionState'
import { screenToWorld2D, worldToScreen2D } from '../../shared/coordinateConversions'
import { hitTestPoints, hitTestIntersectionCandidates, hitTestAlongRulerEdge } from './hitTesting'

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
  /** Called whenever macroPhaseRef.current changes, so React state can stay in sync. */
  onMacroPhaseChange?: (phase: MacroPhase) => void
  /** Called when the 'point' tool places a free point at a world coordinate. */
  onPlaceFreePoint?: (worldX: number, worldY: number) => void
  /** When true, all tool gestures are disabled (e.g. during given-setup mode in editor) */
  disabledRef?: React.MutableRefObject<boolean>
  /** When true, blocks construction tool gestures (but not intersection taps).
   *  Used in editor authoring mode when no citation is selected. */
  requiresCitationRef?: React.MutableRefObject<boolean>
  /** Called when a tool gesture is blocked because requiresCitationRef is true. */
  onToolBlocked?: () => void
  /** Extend tool phase ref — caller creates, hook modifies on pointer events. */
  extendPhaseRef?: React.MutableRefObject<ExtendPhase>
  /** Extend tool preview position — updated on pointermove in 'extending' phase. */
  extendPreviewRef?: React.MutableRefObject<{ x: number; y: number } | null>
  /** Called when the extend tool commits (3rd click). */
  onCommitExtend?: (baseId: string, throughId: string, projX: number, projY: number) => void
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
  onMacroPhaseChange,
  onPlaceFreePoint,
  disabledRef,
  requiresCitationRef,
  onToolBlocked,
  extendPhaseRef,
  extendPreviewRef,
  onCommitExtend,
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

    function requestDraw() {
      needsDrawRef.current = true
    }

    // ── Pointer event handlers ──

    function handlePointerDown(e: PointerEvent) {
      // Disable all tool gestures when disabled (e.g. given-setup mode)
      if (disabledRef?.current) return
      // Disable tool gestures when Move tool is active (its own handler takes over)
      if (activeToolRef.current === 'move') return

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
          sx,
          sy,
          candidatesRef.current,
          viewport,
          w,
          h,
          isTouch
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

      // Block construction tool gestures when citation is required (editor authoring mode)
      if (requiresCitationRef?.current) {
        onToolBlocked?.()
        return
      }

      // ── Point tool: place a free point at cursor position ──
      if (tool === 'point') {
        if (!hitPt) {
          e.stopPropagation()
          onPlaceFreePoint?.(world.x, world.y)
          requestDraw()
        }
        return
      }

      // ── Extend tool: three-click interaction ──
      if (tool === 'extend' && extendPhaseRef && extendPreviewRef) {
        const extPhase = extendPhaseRef.current

        if (extPhase.tag === 'idle') {
          if (hitPt) {
            e.stopPropagation()
            extendPhaseRef.current = { tag: 'base-set', baseId: hitPt.id }
            requestDraw()
          }
          return
        }

        if (extPhase.tag === 'base-set') {
          if (hitPt && hitPt.id !== extPhase.baseId) {
            e.stopPropagation()
            extendPhaseRef.current = { tag: 'extending', baseId: extPhase.baseId, throughId: hitPt.id }
            requestDraw()
          }
          return
        }

        if (extPhase.tag === 'extending') {
          e.stopPropagation()
          const preview = extendPreviewRef.current
          if (preview) {
            onCommitExtend?.(extPhase.baseId, extPhase.throughId, preview.x, preview.y)
          }
          extendPhaseRef.current = { tag: 'idle' }
          extendPreviewRef.current = null
          requestDraw()
          return
        }
        return
      }

      // ── Tool gestures ──
      console.log(
        '[macro-debug] pointerdown tool=%s hitPt=%s macroPhase=%o',
        tool,
        hitPt?.id ?? 'none',
        macroPhaseRef.current
      )
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
        console.log('[macro-debug] macro branch: tag=%s', macro.tag)
        if (macro.tag === 'selecting') {
          e.stopPropagation()

          const newSelected = [...macro.selectedPointIds, hitPt.id]
          console.log(
            '[macro-debug] selecting: newSelected=%o inputLabels=%o',
            newSelected,
            macro.inputLabels
          )
          if (newSelected.length >= macro.inputLabels.length) {
            // All inputs collected — commit
            console.log(
              '[macro-debug] committing macro propId=%d inputs=%o',
              macro.propId,
              newSelected
            )
            const idlePhase: MacroPhase = { tag: 'idle' }
            macroPhaseRef.current = idlePhase
            onMacroPhaseChange?.(idlePhase)
            pointerCapturedRef.current = false
            onCommitMacro(macro.propId, newSelected)
          } else {
            const nextPhase: MacroPhase = { ...macro, selectedPointIds: newSelected }
            macroPhaseRef.current = nextPhase
            onMacroPhaseChange?.(nextPhase)
          }
          requestDraw()
          return
        }
      }
    }

    function handlePointerMove(e: PointerEvent) {
      if (disabledRef?.current) return
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

      // ── Straightedge: from-set → snap to point closest to ruler edge ──
      if (straightedgePhaseRef.current.tag === 'from-set') {
        const from = getPoint(state, straightedgePhaseRef.current.fromId)
        if (from) {
          const sf = worldToScreen2D(
            from.x,
            from.y,
            viewport.center.x,
            viewport.center.y,
            viewport.pixelsPerUnit,
            viewport.pixelsPerUnit,
            w,
            h
          )
          const edgeHit = hitTestAlongRulerEdge(
            sf.x,
            sf.y,
            sx,
            sy,
            straightedgePhaseRef.current.fromId,
            state,
            viewport,
            w,
            h,
            isTouch
          )
          snappedPointIdRef.current = edgeHit?.id ?? null
        }
        requestDraw()
        return
      }

      // ── Extend: project cursor onto ray in 'extending' phase ──
      if (activeToolRef.current === 'extend' && extendPhaseRef && extendPreviewRef) {
        const extPhase = extendPhaseRef.current
        if (extPhase.tag === 'extending') {
          const basePt = getPoint(state, extPhase.baseId)
          const throughPt = getPoint(state, extPhase.throughId)
          if (basePt && throughPt) {
            const dx = throughPt.x - basePt.x
            const dy = throughPt.y - basePt.y
            const len = Math.sqrt(dx * dx + dy * dy)
            if (len > 0.001) {
              const dirX = dx / len
              const dirY = dy / len
              const cx = world.x - throughPt.x
              const cy = world.y - throughPt.y
              const t = Math.max(0, cx * dirX + cy * dirY)
              extendPreviewRef.current = {
                x: throughPt.x + dirX * t,
                y: throughPt.y + dirY * t,
              }
            }
          }
        }
        requestDraw()
        return
      }

      requestDraw()
    }

    function handlePointerUp(e: PointerEvent) {
      if (disabledRef?.current) return
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

      // ── Straightedge: commit to point closest to ruler edge ──
      if (straightedge.tag === 'from-set') {
        const from = getPoint(state, straightedge.fromId)
        if (from) {
          const sf = worldToScreen2D(
            from.x,
            from.y,
            viewport.center.x,
            viewport.center.y,
            viewport.pixelsPerUnit,
            viewport.pixelsPerUnit,
            w,
            h
          )
          const edgeHit = hitTestAlongRulerEdge(
            sf.x,
            sf.y,
            sx,
            sy,
            straightedge.fromId,
            state,
            viewport,
            w,
            h,
            isTouch
          )
          if (edgeHit) {
            onCommitSegment(straightedge.fromId, edgeHit.id)
          }
        }
        straightedgePhaseRef.current = { tag: 'idle' }
        pointerCapturedRef.current = false
        requestDraw()
        return
      }

      pointerCapturedRef.current = false
      // Only clear pointer on touch — mouse keeps position for idle tool overlay
      if (e.pointerType === 'touch') {
        pointerWorldRef.current = null
      }
      snappedPointIdRef.current = null
      requestDraw()
    }

    function handlePointerCancel() {
      compassPhaseRef.current = { tag: 'idle' }
      straightedgePhaseRef.current = { tag: 'idle' }
      if (extendPhaseRef) extendPhaseRef.current = { tag: 'idle' }
      if (extendPreviewRef) extendPreviewRef.current = null
      const idlePhase: MacroPhase = { tag: 'idle' }
      macroPhaseRef.current = idlePhase
      onMacroPhaseChange?.(idlePhase)
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
    onMacroPhaseChange,
    onPlaceFreePoint,
    getCanvasRect,
    onToolBlocked,
    extendPhaseRef,
    extendPreviewRef,
    onCommitExtend,
  ])
}
