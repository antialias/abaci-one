/**
 * useSuperpositionInteraction — Pointer event handler for the interactive
 * superposition (triangle drag/flip/snap) proof step.
 *
 * Follows the useDragGivenPoints pattern: standalone hook registering
 * capture-phase pointer events on the canvas. Calls stopPropagation()
 * during active phases to block tool interaction and pan/zoom.
 */
import { useEffect } from 'react'
import type { MutableRefObject, RefObject } from 'react'
import type { ConstructionState, EuclidViewportState, SuperpositionPhase, Vec2 } from '../types'
import { getPoint } from '../engine/constructionState'
import { screenToWorld2D, worldToScreen2D } from '../../shared/coordinateConversions'
import {
  triangleCentroid,
  circumradius,
  triangleOrientation,
  computeAutoRotation,
  rotateVerticesAround,
  pointInTriangle,
} from '../engine/superpositionMath'

export interface UseSuperpositionOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>
  constructionRef: MutableRefObject<ConstructionState>
  viewportRef: MutableRefObject<EuclidViewportState>
  superpositionPhaseRef: MutableRefObject<SuperpositionPhase>
  needsDrawRef: MutableRefObject<boolean>
  isMobileRef: MutableRefObject<boolean>
}

/** Snap zone: centroid distance < this fraction of circumradius */
const SNAP_THRESHOLD = 0.5

export function useSuperpositionInteraction({
  canvasRef,
  constructionRef,
  viewportRef,
  superpositionPhaseRef,
  needsDrawRef,
  isMobileRef,
}: UseSuperpositionOptions): void {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    /** Track whether the user has an active pointer down (required before processing moves) */
    let activePointerId: number | null = null

    function getCSSSize() {
      const dpr = window.devicePixelRatio || 1
      return { w: canvas!.width / dpr, h: canvas!.height / dpr }
    }

    function toWorld(sx: number, sy: number): Vec2 {
      const v = viewportRef.current
      const { w, h } = getCSSSize()
      const pt = screenToWorld2D(
        sx,
        sy,
        v.center.x,
        v.center.y,
        v.pixelsPerUnit,
        v.pixelsPerUnit,
        w,
        h
      )
      return pt
    }

    function toScreen(wx: number, wy: number): Vec2 {
      const v = viewportRef.current
      const { w, h } = getCSSSize()
      return worldToScreen2D(wx, wy, v.center.x, v.center.y, v.pixelsPerUnit, v.pixelsPerUnit, w, h)
    }

    /** Get world-space positions of a triangle's vertices from construction state */
    function getTriVertices(ids: [string, string, string]): [Vec2, Vec2, Vec2] | null {
      const state = constructionRef.current
      const pts = ids.map((id) => getPoint(state, id))
      if (pts.some((p) => !p)) return null
      return pts.map((p) => ({ x: p!.x, y: p!.y })) as [Vec2, Vec2, Vec2]
    }

    function handlePointerDown(e: PointerEvent) {
      const phase = superpositionPhaseRef.current
      if (phase.tag === 'idle' || phase.tag === 'settled' || phase.tag === 'lifting') return

      const rect = canvas!.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top

      if (phase.tag === 'dragging') {
        // Start/continue drag — record anchor and capture pointer
        e.stopPropagation()
        e.preventDefault()
        activePointerId = e.pointerId
        const worldPos = toWorld(sx, sy)
        superpositionPhaseRef.current = {
          ...phase,
          dragAnchor: worldPos,
        }
      } else if (phase.tag === 'mismatched') {
        // Tap on cutout → flip
        e.stopPropagation()
        e.preventDefault()
        // Hit-test tap in screen coords
        const cutoutScreen = phase.cutoutVertices.map((v) => toScreen(v.x, v.y)) as [
          Vec2,
          Vec2,
          Vec2,
        ]
        const tapPoint: Vec2 = { x: sx, y: sy }
        if (pointInTriangle(tapPoint, cutoutScreen[0], cutoutScreen[1], cutoutScreen[2])) {
          // Compute flip axis from the first two mapped vertex pairs
          const tgtVerts = getTriVertices(phase.tgtTriIds)
          if (tgtVerts) {
            // Axis: line connecting first two target vertices (after mapping)
            const axisPoint = tgtVerts[0]
            const axLen = Math.hypot(tgtVerts[1].x - tgtVerts[0].x, tgtVerts[1].y - tgtVerts[0].y)
            const axisDir: Vec2 =
              axLen > 1e-10
                ? {
                    x: (tgtVerts[1].x - tgtVerts[0].x) / axLen,
                    y: (tgtVerts[1].y - tgtVerts[0].y) / axLen,
                  }
                : { x: 1, y: 0 }

            superpositionPhaseRef.current = {
              tag: 'flipping',
              startTime: performance.now(),
              axisPoint,
              axisDir,
              preFlipVertices: phase.cutoutVertices,
              postFlipVertices: tgtVerts,
              srcTriIds: phase.srcTriIds,
              tgtTriIds: phase.tgtTriIds,
              mapping: phase.mapping,
            }
            needsDrawRef.current = true
          }
        }
      }
    }

    function handlePointerMove(e: PointerEvent) {
      const phase = superpositionPhaseRef.current
      if (phase.tag !== 'dragging') return
      // Only process moves when user has an active pointer down
      if (activePointerId === null || e.pointerId !== activePointerId) return

      e.stopPropagation()
      e.preventDefault()

      const rect = canvas!.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const worldPos = toWorld(sx, sy)

      // Translate cutout by pointer delta from initial centroid + anchor offset
      const dx = worldPos.x - phase.dragAnchor.x
      const dy = worldPos.y - phase.dragAnchor.y
      let newVerts = phase.cutoutVertices.map((v) => ({
        x: v.x + dx,
        y: v.y + dy,
      })) as [Vec2, Vec2, Vec2]

      // Get target triangle vertices
      const tgtVerts = getTriVertices(phase.tgtTriIds)
      if (tgtVerts) {
        const cutCentroid = triangleCentroid(newVerts[0], newVerts[1], newVerts[2])
        const tgtCentroid = triangleCentroid(tgtVerts[0], tgtVerts[1], tgtVerts[2])
        const circumR = circumradius(tgtVerts[0], tgtVerts[1], tgtVerts[2])

        // Auto-rotation
        const autoAngle = computeAutoRotation(cutCentroid, tgtCentroid, newVerts, tgtVerts, circumR)
        if (Math.abs(autoAngle) > 1e-6) {
          newVerts = rotateVerticesAround(newVerts, cutCentroid, autoAngle)
        }

        // Check snap zone
        const dist = Math.hypot(cutCentroid.x - tgtCentroid.x, cutCentroid.y - tgtCentroid.y)
        if (dist < SNAP_THRESHOLD * circumR) {
          // Orientation check
          const cutOrientation = triangleOrientation(newVerts[0], newVerts[1], newVerts[2])
          const tgtOrientation = triangleOrientation(tgtVerts[0], tgtVerts[1], tgtVerts[2])

          if (cutOrientation === tgtOrientation) {
            // Same orientation → snap
            superpositionPhaseRef.current = {
              tag: 'snapping',
              startTime: performance.now(),
              fromVertices: newVerts,
              toVertices: tgtVerts,
              srcTriIds: phase.srcTriIds,
              tgtTriIds: phase.tgtTriIds,
              mapping: phase.mapping,
            }
          } else {
            // Opposite orientation → mismatch
            superpositionPhaseRef.current = {
              tag: 'mismatched',
              cutoutVertices: newVerts,
              srcTriIds: phase.srcTriIds,
              tgtTriIds: phase.tgtTriIds,
              mapping: phase.mapping,
              settleTime: performance.now(),
            }
          }
          needsDrawRef.current = true
          return
        }
      }

      // Update dragging phase with new vertices and anchor
      superpositionPhaseRef.current = {
        ...phase,
        cutoutVertices: newVerts,
        dragAnchor: worldPos,
      }
      needsDrawRef.current = true
    }

    function handlePointerUp(e: PointerEvent) {
      const phase = superpositionPhaseRef.current
      if (phase.tag === 'dragging') {
        // Release — cutout stays where it is
        e.stopPropagation()
        if (e.pointerId === activePointerId) {
          activePointerId = null
        }
      }
    }

    // Block all pointer events during active superposition phases
    function handleCapture(e: PointerEvent) {
      const phase = superpositionPhaseRef.current
      if (
        phase.tag === 'lifting' ||
        phase.tag === 'flipping' ||
        phase.tag === 'snapping' ||
        phase.tag === 'settled'
      ) {
        e.stopPropagation()
        e.preventDefault()
      }
    }

    canvas.addEventListener('pointerdown', handlePointerDown, { capture: true })
    canvas.addEventListener('pointermove', handlePointerMove, { capture: true })
    canvas.addEventListener('pointerup', handlePointerUp, { capture: true })
    canvas.addEventListener('pointerdown', handleCapture, { capture: true })

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown, { capture: true })
      canvas.removeEventListener('pointermove', handlePointerMove, { capture: true })
      canvas.removeEventListener('pointerup', handlePointerUp, { capture: true })
      canvas.removeEventListener('pointerdown', handleCapture, { capture: true })
    }
  }, [canvasRef, constructionRef, viewportRef, superpositionPhaseRef, needsDrawRef, isMobileRef])
}
