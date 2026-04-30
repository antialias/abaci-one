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
import { mergeProofFacts } from '../engine/factStore'
import type { ProofFact } from '../engine/facts'
import type { IntersectionCandidate } from '../types'
import type { PostCompletionAction, ReplayResult } from '../engine/replayConstruction'
import { getAllPoints, getPoint } from '../engine/constructionState'
import { screenToWorld2D, worldToScreen2D } from '../../shared/coordinateConversions'
import { replayConstruction } from '../engine/replayConstruction'
import {
  solveInverseKinematics,
  solveInverse,
  createSolverState,
  type InverseSolverState,
  type ForwardFn,
} from '../engine/inverseSolver'
import { RECIPE_REGISTRY } from '../engine/recipe/definitions/registry'
import { evaluateRecipe } from '../engine/recipe/evaluate'
import {
  computeInfluence,
  constrainedDragStep,
  isSubJacobianRankDeficient,
  type InfluenceResult,
} from '../engine/jacobianInfluence'
import type {
  InfluenceHighlightState,
  MotionTrailState,
  BreakFreeFlash,
} from '../render/renderInfluenceHighlight'
import {
  recordTrailPosition,
  clearTrail,
  TENSION_START_RADIUS,
  BREAK_FREE_RADIUS,
  TENSION_DAMPEN,
} from '../render/renderInfluenceHighlight'
import type { Pt } from '../engine/recipe/types'

/** Hit radius for draggable points (screen pixels) */
const HIT_RADIUS_MOUSE = 30
const HIT_RADIUS_TOUCH = 44

interface UseDragGivenPointsOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  propositionRef: React.MutableRefObject<PropositionDef>
  constructionRef: React.MutableRefObject<ConstructionState>
  factStoreRef: React.MutableRefObject<FactStore>
  proofFactsRef: React.MutableRefObject<ProofFact[]>
  viewportRef: React.MutableRefObject<EuclidViewportState>
  isCompleteRef: React.MutableRefObject<boolean>
  activeToolRef: React.MutableRefObject<ActiveTool>
  needsDrawRef: React.MutableRefObject<boolean>
  pointerCapturedRef: React.MutableRefObject<boolean>
  candidatesRef: React.MutableRefObject<IntersectionCandidate[]>
  postCompletionActionsRef: React.MutableRefObject<PostCompletionAction[]>
  /** Per-step data (e.g. user-chosen extend distances) for replay */
  stepDataRef?: React.MutableRefObject<Map<number, Record<string, unknown>>>
  /** When true, drag interactions are suppressed (e.g. during correction animations) */
  interactionLockedRef?: React.MutableRefObject<boolean>
  /** Whether we're in free-form playground mode (no recipe) */
  playgroundModeRef?: React.MutableRefObject<boolean | undefined>
  /** Whether full solver mode is active (vs constrained single-point drag) */
  solverModeRef?: React.MutableRefObject<boolean>
  /** Ref updated with the hovered derived point ID (for influence highlight rendering) */
  hoveredDerivedPointIdRef?: React.MutableRefObject<string | null>
  /** Ref updated with the most influential given point ID (for influence highlight rendering) */
  influentialGivenPointIdRef?: React.MutableRefObject<string | null>
  /** Influence highlight state ref — used to set subJacobian for preview arrow */
  influenceHighlightStateRef?: React.MutableRefObject<InfluenceHighlightState>
  /** Motion trail state ref — used to record given point positions during constrained drag */
  motionTrailStateRef?: React.MutableRefObject<MotionTrailState>
  /** Break-free flash ref — set when constraint snaps during drag */
  breakFreeFlashRef?: React.MutableRefObject<BreakFreeFlash | null>
  /** Called when construction state is replaced during drag */
  onReplayResult: (result: ReplayResult) => void
  /** Called once when a drag gesture starts on a given point */
  onDragStart?: (pointId: string) => void
  /** Ref updated with the currently dragged point ID (null when not dragging) */
  dragPointIdRef?: React.MutableRefObject<string | null>
  /** Called when a drag gesture ends */
  onDragEnd?: () => void
}

/**
 * Post-completion drag interaction for all construction points.
 *
 * - Given/free/extend points: direct position update (existing behavior)
 * - Derived points (intersections, produced, macro outputs): inverse solver
 *   finds given point positions that place the dragged point at the cursor.
 *
 * The inverse solver uses Levenberg-Marquardt with the recipe evaluator as
 * its forward model, warm-started across frames for real-time performance.
 */
export function useDragGivenPoints({
  canvasRef,
  propositionRef,
  constructionRef,
  factStoreRef,
  proofFactsRef,
  viewportRef,
  isCompleteRef,
  activeToolRef,
  needsDrawRef,
  pointerCapturedRef,
  candidatesRef,
  postCompletionActionsRef,
  stepDataRef,
  interactionLockedRef,
  playgroundModeRef,
  solverModeRef,
  hoveredDerivedPointIdRef,
  influentialGivenPointIdRef,
  influenceHighlightStateRef,
  motionTrailStateRef,
  breakFreeFlashRef,
  onReplayResult,
  onDragStart,
  dragPointIdRef,
  onDragEnd,
}: UseDragGivenPointsOptions): void {
  const getCanvasRect = useCallback(() => {
    return canvasRef.current?.getBoundingClientRect()
  }, [canvasRef])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let dragPointId: string | null = null
    let dragPointOrigin: ConstructionPoint['origin'] | null = null
    let hoveredDraggableId: string | null = null
    /** Solver state persisted across frames within a single drag gesture */
    let solverState: InverseSolverState | null = null
    /** Influence result locked at drag start for constrained drag */
    let dragInfluence: InfluenceResult | null = null
    /** Previous world position for computing drag deltas in constrained mode */
    let prevDragWorld: { x: number; y: number } | null = null
    /** Frame counter for periodic sub-Jacobian refresh during constrained drag */
    let constrainedDragFrameCount = 0
    /** RAF handle for snap-to-cursor animation at drag start */
    let snapAnimId: number | null = null
    /** Click-time cursor world position locked in by the snap-to-cursor anim;
     *  used to seed prevDragWorld when the user cancels the snap by moving. */
    let snapTargetWorld: { x: number; y: number } | null = null
    /** Whether the constraint has broken free during this drag gesture (sticky) */
    let breakFree = false
    /** Eased transition from constrained pose → solver pose at the moment of break-free.
     *  While active, the dispatcher routes nothing — the RAF loop owns construction state. */
    let breakFreeTransition: {
      kind: 'recipe' | 'playground'
      /** Input positions at the moment of break-free (ordered to match toPositions). */
      fromPositions: Pt[]
      /** Solver-target input positions, computed once at break-free. */
      toPositions: Pt[]
      /** For playground mode, the point IDs corresponding to each position slot. */
      pointIds?: string[]
      startTime: number
      durationMs: number
    } | null = null
    let breakFreeTransitionId: number | null = null
    /** Last cursor world position seen by solver path — used to detect "stuck" */
    let prevCursorWorldSolver: { x: number; y: number } | null = null
    /** Consecutive frames where solver didn't move target despite cursor movement */
    let solverStuckCount = 0
    /** Consecutive frames where solveInverse exhausted its iterations without
     *  progress (post-call lambda saturated near the per-call cap). Logged in
     *  the per-frame diagnostic only — useful for verifying that the
     *  one-sided-diff + backtracking fixes keep this counter low. */
    let solverSaturatedCount = 0

    // ── Diagnostic logging (filter console by "[stuck-debug]") ──
    // Per-frame logs are throttled to one every 250ms; discrete events
    // (drag-start, guard-fired, break-free, solver-revert, etc.) always fire.
    let lastFrameLogMs = 0
    function logFrame(data: object): void {
      const now = performance.now()
      if (now - lastFrameLogMs < 250) return
      lastFrameLogMs = now
      console.log('[stuck-debug] frame', data)
    }
    function logEvent(name: string, data?: object): void {
      console.log(`[stuck-debug] ${name}`, data ?? '')
    }

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

    /**
     * Hit-test ALL construction points — given, free, extend, AND derived.
     * Returns the closest point within the hit radius, with priority:
     * given/free/extend points win ties over derived points (so direct
     * dragging is preferred when a given point overlaps a derived one).
     */
    function hitTestAllPoints(
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
      const recipe = RECIPE_REGISTRY[prop.id]

      let best: ConstructionPoint | null = null
      let bestDist = Infinity
      let bestIsDirect = false // true if best is a given/free/extend point

      const isPlayground = !!playgroundModeRef?.current

      for (const pt of getAllPoints(state)) {
        const isDirect = draggableSet.has(pt.id) || pt.origin === 'free' || pt.origin === 'extend'
        const isDerived = !isDirect && (recipe != null || isPlayground)

        if (!isDirect && !isDerived) continue

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

        if (dist >= threshold) continue

        // Direct points take priority over derived points at equal distance
        if (dist < bestDist || (dist === bestDist && isDirect && !bestIsDirect)) {
          best = pt
          bestDist = dist
          bestIsDirect = isDirect
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

    /**
     * Collect current input positions ordered by recipe input slots.
     * Returns null if the recipe or any input point is missing.
     */
    function collectRecipeInputPositions(): Pt[] | null {
      const prop = propositionRef.current
      const recipe = RECIPE_REGISTRY[prop.id]
      if (!recipe) return null

      const positions: Pt[] = []
      for (const slot of recipe.inputSlots) {
        const ptId = `pt-${slot.ref}`
        const pt = getPoint(constructionRef.current, ptId)
        if (!pt) return null
        positions.push({ x: pt.x, y: pt.y })
      }
      return positions
    }

    /**
     * Convert a construction point ID ('pt-C') to a recipe ref ('C').
     */
    function pointIdToRef(pointId: string): string {
      return pointId.startsWith('pt-') ? pointId.slice(3) : pointId
    }

    /**
     * Build a forward function and collect input positions for influence
     * computation. Works for both recipe and playground modes.
     * Returns null if the construction can't be analyzed.
     */
    function buildInfluenceContext(targetPointId: string): {
      forward: ForwardFn
      inputPositions: Pt[]
      pointIds: string[]
    } | null {
      const prop = propositionRef.current
      const recipe = RECIPE_REGISTRY[prop.id]
      const isPlayground = !!playgroundModeRef?.current

      if (isPlayground || !recipe) {
        // Playground: inputs are given + free points
        const inputs = collectPlaygroundInputPositions()
        if (!inputs) return null
        const forward = buildPlaygroundForward(targetPointId, inputs.pointIds)
        return { forward, inputPositions: inputs.positions, pointIds: inputs.pointIds }
      }

      // Recipe mode
      const inputPositions = collectRecipeInputPositions()
      if (!inputPositions) return null
      const targetRef = pointIdToRef(targetPointId)
      const pointIds = recipe.inputSlots.map((s) => `pt-${s.ref}`)

      // Check if this is a recipe point or post-completion point
      const isRecipePoint =
        recipe.inputSlots.some((s) => s.ref === targetRef) ||
        recipe.ops.some((op) => {
          if (op.kind === 'intersection') return op.output === targetRef
          if (op.kind === 'produce') return op.output === targetRef
          if (op.kind === 'apply') return Object.values(op.outputs).includes(targetRef)
          return false
        })

      if (isRecipePoint) {
        const forward: ForwardFn = (positions) => {
          const trace = evaluateRecipe(recipe, positions, RECIPE_REGISTRY)
          return trace?.pointMap.get(targetRef) ?? null
        }
        return { forward, inputPositions, pointIds }
      }

      // Post-completion point: use replay forward
      const forward = buildReplayForward(targetPointId)
      return { forward, inputPositions, pointIds }
    }

    /**
     * Compute influence info for a derived point. Returns null if the point
     * has no valid (non-rank-deficient) controlling given.
     */
    function tryComputeInfluence(derivedPointId: string): {
      bestPointId: string
      subJacobian: [number, number, number, number]
    } | null {
      const ctx = buildInfluenceContext(derivedPointId)
      if (!ctx) return null
      const influence = computeInfluence(ctx.forward, ctx.inputPositions, ctx.pointIds)
      if (!influence || !influence.bestPointId) return null
      if (isSubJacobianRankDeficient(influence.subJacobian)) return null
      return { bestPointId: influence.bestPointId, subJacobian: influence.subJacobian }
    }

    /**
     * Compute influence for a derived point and update the hover highlight
     * refs (drives the ring + preview arrow + dashed line on hover).
     */
    function updateInfluenceHighlight(derivedPointId: string | null): void {
      const clear = () => {
        if (hoveredDerivedPointIdRef) hoveredDerivedPointIdRef.current = null
        if (influentialGivenPointIdRef) influentialGivenPointIdRef.current = null
        if (influenceHighlightStateRef) influenceHighlightStateRef.current.subJacobian = null
      }
      if (!derivedPointId) {
        clear()
        return
      }
      const inf = tryComputeInfluence(derivedPointId)
      if (!inf) {
        clear()
        return
      }
      if (hoveredDerivedPointIdRef) hoveredDerivedPointIdRef.current = derivedPointId
      if (influentialGivenPointIdRef) influentialGivenPointIdRef.current = inf.bestPointId
      if (influenceHighlightStateRef) {
        influenceHighlightStateRef.current.subJacobian = inf.subJacobian
      }
      needsDrawRef.current = true
    }

    /**
     * Track the nearest derived-with-valid-influence point to the cursor
     * (regardless of hit-test). Drives the background constraint-response
     * field: as the cursor approaches a point, the field fades in via
     * proximity falloff; as it moves away, the field fades out. Decoupling
     * from hover hit-test removes the hard threshold the user observed.
     *
     * Caches influence results per derived point so we don't recompute on
     * every pointer move. Cache is cleared when the construction changes
     * (handled at handlePointerDown / handleDragEnd via clearFieldCache).
     */
    const fieldInfluenceCache = new Map<
      string,
      { bestPointId: string; subJacobian: [number, number, number, number] } | null
    >()
    function clearFieldCache(): void {
      fieldInfluenceCache.clear()
    }
    function getCachedInfluence(
      derivedPointId: string
    ): { bestPointId: string; subJacobian: [number, number, number, number] } | null {
      if (fieldInfluenceCache.has(derivedPointId)) {
        return fieldInfluenceCache.get(derivedPointId) ?? null
      }
      const inf = tryComputeInfluence(derivedPointId)
      fieldInfluenceCache.set(derivedPointId, inf)
      return inf
    }
    function updateFieldTarget(screenX: number, screenY: number): void {
      if (!influenceHighlightStateRef) return
      const state = constructionRef.current
      const viewport = viewportRef.current
      const { w, h } = getCSSSize()
      const recipe = RECIPE_REGISTRY[propositionRef.current.id]
      const isPlayground = !!playgroundModeRef?.current

      // Find all derived points with valid (non-rank-deficient) influence,
      // compute screen-space distance to cursor. We render the closest few
      // simultaneously, each with its own proximity factor, so as the cursor
      // moves between two derived points their fields naturally crossfade —
      // no hard switch.
      const PROX_EPSILON = 0.05
      // pre-filter radius: prox = R²/(R²+d²) > eps  ⇔  d < R·√(1/eps − 1).
      // R = 220 px (must match PROXIMITY_HALF_RADIUS_PX in the renderer).
      const maxD = 220 * Math.sqrt(1 / PROX_EPSILON - 1)
      const maxD2 = maxD * maxD

      type Candidate = {
        pt: ReturnType<typeof getAllPoints>[number]
        d2: number
        inf: { bestPointId: string; subJacobian: [number, number, number, number] }
      }
      const candidates: Candidate[] = []
      for (const pt of getAllPoints(state)) {
        if (!isDerivedOrigin(pt.origin)) continue
        if (!recipe && !isPlayground) continue
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
        const d2 = dx * dx + dy * dy
        if (d2 > maxD2) continue
        const inf = getCachedInfluence(pt.id)
        if (!inf) continue
        candidates.push({ pt, d2, inf })
      }

      // Sort by ascending distance, keep at most MAX_TARGETS to bound LIC
      // cost. 3 is plenty for Voronoi junctions where multiple points are
      // near-equidistant; further targets contribute negligibly anyway.
      const MAX_TARGETS = 3
      candidates.sort((a, b) => a.d2 - b.d2)
      const top = candidates.slice(0, MAX_TARGETS)

      const hl = influenceHighlightStateRef.current
      const next = top.map((c) => ({
        derivedPointId: c.pt.id,
        givenPointId: c.inf.bestPointId,
        subJacobian: c.inf.subJacobian,
      }))

      let changed = next.length !== hl.fieldTargets.length
      if (!changed) {
        for (let i = 0; i < next.length; i++) {
          const a = hl.fieldTargets[i]
          const b = next[i]
          if (
            a.derivedPointId !== b.derivedPointId ||
            a.givenPointId !== b.givenPointId ||
            a.subJacobian !== b.subJacobian
          ) {
            changed = true
            break
          }
        }
      }
      if (changed) {
        hl.fieldTargets = next
        needsDrawRef.current = true
      }
    }

    /**
     * Apply solved input positions to the construction via replay.
     */
    function applyInverseSolution(solvedPositions: Pt[]): void {
      const prop = propositionRef.current
      const recipe = RECIPE_REGISTRY[prop.id]
      if (!recipe) return

      // Build positions map from solved input positions
      const positions = new Map<string, { x: number; y: number }>()
      for (let i = 0; i < recipe.inputSlots.length; i++) {
        const ptId = `pt-${recipe.inputSlots[i].ref}`
        positions.set(ptId, solvedPositions[i])
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

      // Replay the full construction
      const actions = postCompletionActionsRef.current
      const result = replayConstruction(
        givenElements,
        prop.steps,
        prop,
        actions,
        stepDataRef?.current
      )
      constructionRef.current = result.state
      factStoreRef.current = result.factStore
      mergeProofFacts(factStoreRef.current, proofFactsRef.current)
      candidatesRef.current = result.candidates
      onReplayResult(result)
      needsDrawRef.current = true
    }

    /**
     * Smoothly animate the derived point toward the cursor at the start
     * of a constrained drag. Uses eased constrained drag steps over ~200ms
     * so the point "magnetically" snaps to the cursor position.
     */
    function startSnapAnimation(pointId: string, targetWorld: { x: number; y: number }): void {
      if (snapAnimId != null) {
        cancelAnimationFrame(snapAnimId)
        snapAnimId = null
      }
      snapTargetWorld = targetWorld

      const SNAP_DURATION_MS = 200
      const SNAP_STEPS = 12
      const startTime = performance.now()
      let step = 0

      function snapFrame() {
        snapAnimId = null
        // Bail if drag ended, point changed, or break-free has fired (the
        // solver path now owns the construction state — don't fight it).
        if (dragPointId !== pointId || !dragInfluence || breakFree) {
          snapTargetWorld = null
          return
        }

        const elapsed = performance.now() - startTime
        const t = Math.min(1, elapsed / SNAP_DURATION_MS)
        step++

        // Get current derived point position
        const derivedPt = getPoint(constructionRef.current, pointId)
        if (!derivedPt) return

        // Vector from current derived position to cursor target
        const dxWorld = targetWorld.x - derivedPt.x
        const dyWorld = targetWorld.y - derivedPt.y
        const dist = Math.sqrt(dxWorld * dxWorld + dyWorld * dyWorld)

        // Close enough or done — stop
        if (dist < 0.001 || step >= SNAP_STEPS) {
          // Set prevDragWorld so subsequent pointer moves work correctly
          prevDragWorld = targetWorld
          snapTargetWorld = null
          return
        }

        // Ease-out fraction: move a larger proportion each frame
        const fraction = 1 - (1 - t) ** 2
        const stepDx = dxWorld * fraction
        const stepDy = dyWorld * fraction

        // Refresh sub-Jacobian periodically
        if (step % 4 === 0) {
          const ctx = buildInfluenceContext(pointId)
          if (ctx) {
            const fresh = computeInfluence(ctx.forward, ctx.inputPositions, ctx.pointIds)
            if (fresh && fresh.bestInputIndex === dragInfluence!.bestInputIndex) {
              dragInfluence!.subJacobian = fresh.subJacobian
            }
          }
        }

        const givenPointId = dragInfluence!.bestPointId
        if (!givenPointId) return
        const givenPt = getPoint(constructionRef.current, givenPointId)
        if (!givenPt) return

        const newGivenPos = constrainedDragStep(
          { x: givenPt.x, y: givenPt.y },
          { x: stepDx, y: stepDy },
          dragInfluence!.subJacobian
        )
        // Treat any near-singular result as degenerate. constrainedDragStep
        // only returns null when |det| < 1e-12, but for rank-1 sub-Jacobians
        // (e.g. line-line intersection driven by one corner) det can be
        // ~1e-9 with finite-difference noise — small enough that 1/det
        // still makes the corner fly to ~1e9 units. Reject by screen-px
        // displacement of the given, which is what the user actually sees.
        const SNAP_MAX_GIVEN_MOVE_PX = 200
        const vpForCheck = viewportRef.current
        const givenMoveDistPx = newGivenPos
          ? Math.sqrt(
              ((newGivenPos.x - givenPt.x) * vpForCheck.pixelsPerUnit) ** 2 +
                ((newGivenPos.y - givenPt.y) * vpForCheck.pixelsPerUnit) ** 2
            )
          : Infinity
        if (!newGivenPos || givenMoveDistPx > SNAP_MAX_GIVEN_MOVE_PX) {
          logEvent('snap-degenerate-breakfree', {
            givenMoveDistPx: givenMoveDistPx.toFixed(1),
          })
          const { w: sw, h: sh } = getCSSSize()
          const vp = viewportRef.current
          const dPt = getPoint(constructionRef.current, pointId)
          if (dPt) {
            const dScreen = worldToScreen2D(
              dPt.x,
              dPt.y,
              vp.center.x,
              vp.center.y,
              vp.pixelsPerUnit,
              vp.pixelsPerUnit,
              sw,
              sh
            )
            triggerBreakFree(targetWorld, dScreen, vp, sw, sh)
          } else {
            breakFree = true
            handleDerivedPointDragSolver(targetWorld)
          }
          prevDragWorld = targetWorld
          snapTargetWorld = null
          return
        }

        // Apply the movement
        const prop = propositionRef.current
        const prevActions = postCompletionActionsRef.current
        if (givenPt.origin === 'free') {
          postCompletionActionsRef.current = postCompletionActionsRef.current.map((a) =>
            a.type === 'free-point' && a.id === givenPointId
              ? { ...a, x: newGivenPos.x, y: newGivenPos.y }
              : a
          )
        }

        const positions = collectCurrentPositions()
        if (givenPt.origin === 'given') {
          positions.set(givenPointId, newGivenPos)
        }

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

        const actions = postCompletionActionsRef.current
        const result = replayConstruction(
          givenElements,
          prop.steps,
          prop,
          actions,
          stepDataRef?.current
        )

        // Guard: if this snap step would destroy the dragged point, break
        // free to solver — retrying on the next snap frame would just fail
        // the same way (see handleDerivedPointDragConstrained).
        if (!getPoint(result.state, pointId)) {
          postCompletionActionsRef.current = prevActions
          const dPt = getPoint(constructionRef.current, pointId)
          if (dPt) {
            const { w: sw, h: sh } = getCSSSize()
            const vp = viewportRef.current
            const dScreen = worldToScreen2D(
              dPt.x,
              dPt.y,
              vp.center.x,
              vp.center.y,
              vp.pixelsPerUnit,
              vp.pixelsPerUnit,
              sw,
              sh
            )
            triggerBreakFree(targetWorld, dScreen, vp, sw, sh)
          } else {
            breakFree = true
            handleDerivedPointDragSolver(targetWorld)
          }
          prevDragWorld = targetWorld
          snapTargetWorld = null
          return
        }

        constructionRef.current = result.state
        factStoreRef.current = result.factStore
        mergeProofFacts(factStoreRef.current, proofFactsRef.current)
        candidatesRef.current = result.candidates
        onReplayResult(result)
        needsDrawRef.current = true

        // Record trail during snap
        if (motionTrailStateRef) {
          const updatedGivenPt = getPoint(result.state, givenPointId)
          if (updatedGivenPt) {
            const { w, h } = getCSSSize()
            const v = viewportRef.current
            const screen = worldToScreen2D(
              updatedGivenPt.x,
              updatedGivenPt.y,
              v.center.x,
              v.center.y,
              v.pixelsPerUnit,
              v.pixelsPerUnit,
              w,
              h
            )
            recordTrailPosition(motionTrailStateRef.current, givenPointId, screen.x, screen.y)
          }
        }

        if (t < 1) {
          snapAnimId = requestAnimationFrame(snapFrame)
        } else {
          prevDragWorld = targetWorld
          snapTargetWorld = null
        }
      }

      snapAnimId = requestAnimationFrame(snapFrame)
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

      const hit = hitTestAllPoints(sx, sy, isTouch)
      if (hit) {
        e.stopPropagation()
        e.preventDefault()
        dragPointId = hit.id
        dragPointOrigin = hit.origin
        if (dragPointIdRef) dragPointIdRef.current = hit.id
        pointerCapturedRef.current = true
        canvas!.style.cursor = 'grabbing'
        needsDrawRef.current = true

        // Initialize drag state for derived point drags
        if (isDerivedOrigin(hit.origin)) {
          solverState = createSolverState()

          // Compute influence for constrained drag mode
          const infCtx = buildInfluenceContext(hit.id)
          if (infCtx) {
            dragInfluence = computeInfluence(infCtx.forward, infCtx.inputPositions, infCtx.pointIds)
          }
          constrainedDragFrameCount = 0

          // If the most-influential given's sub-Jacobian can only move the
          // derived along a 1-D locus (canonical case: target is the
          // intersection of two lines, perturbing one corner just slides
          // the intersection along the other line), constrained drag will
          // either jam or fly to infinity. Flip break-free immediately so
          // the rest of the gesture goes straight to the LM solver — which
          // can deploy all input DOFs together.
          if (dragInfluence && isSubJacobianRankDeficient(dragInfluence.subJacobian)) {
            breakFree = true
          }

          logEvent('drag-start', {
            id: hit.id,
            origin: hit.origin,
            bestPointId: dragInfluence?.bestPointId,
            subJ: dragInfluence?.subJacobian.map((n) => n.toFixed(3)).join(','),
            breakFreeAtStart: breakFree,
          })

          // Start snap-to-cursor animation in constrained mode
          const useSolver = solverModeRef?.current ?? false
          if (!useSolver && !breakFree && dragInfluence) {
            const { w, h } = getCSSSize()
            const clickWorld = toWorld(sx, sy, w, h)
            startSnapAnimation(hit.id, clickWorld)
          }

          // Keep the influence highlight (ring on the given, dashed line,
          // rubber-band cue) visible during constrained drag so the user can
          // see the tension build as they pull the cursor away. In solver or
          // break-free modes there is no single "controlling" given, so clear.
          if (!useSolver && !breakFree && dragInfluence && dragInfluence.bestPointId) {
            if (hoveredDerivedPointIdRef) hoveredDerivedPointIdRef.current = hit.id
            if (influentialGivenPointIdRef)
              influentialGivenPointIdRef.current = dragInfluence.bestPointId
          } else {
            if (hoveredDerivedPointIdRef) hoveredDerivedPointIdRef.current = null
            if (influentialGivenPointIdRef) influentialGivenPointIdRef.current = null
          }
        } else {
          solverState = null
          dragInfluence = null
          // Direct drag of a given/free/extend point — no influence highlight.
          if (hoveredDerivedPointIdRef) hoveredDerivedPointIdRef.current = null
          if (influentialGivenPointIdRef) influentialGivenPointIdRef.current = null
        }
        prevDragWorld = null

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

        // If the drag-start snap-to-cursor animation is still running, the
        // user has taken control. Cancel the snap and seed prevDragWorld
        // with its click target so the first constrained-drag delta is
        // (cursor − click), matching what the user perceives as their drag.
        if (snapAnimId != null) {
          cancelAnimationFrame(snapAnimId)
          snapAnimId = null
          if (snapTargetWorld) prevDragWorld = snapTargetWorld
          snapTargetWorld = null
        }

        // Route to the appropriate drag handler based on point origin
        if (dragPointOrigin && isDerivedOrigin(dragPointOrigin)) {
          // ── Inverse solver path: derived point ──
          handleDerivedPointDrag(world)
        } else {
          // ── Direct path: given/free/extend point ──
          handleDirectPointDrag(world, prop)
        }
      } else {
        // Not dragging — update cursor and influence highlight based on hover
        const hit = hitTestAllPoints(sx, sy, isTouch)
        const newHoveredId = hit?.id ?? null

        if (newHoveredId !== hoveredDraggableId) {
          hoveredDraggableId = newHoveredId
          if (hoveredDraggableId) {
            canvas!.style.cursor = 'grab'
          } else {
            canvas!.style.cursor = ''
          }

          // Update influence highlight for derived points
          if (hit && isDerivedOrigin(hit.origin)) {
            updateInfluenceHighlight(hit.id)
          } else {
            updateInfluenceHighlight(null)
          }
        }

        // Track nearest-derived for the field background regardless of
        // hit-test, so the field fades smoothly with cursor proximity rather
        // than popping in at the hit-test boundary.
        updateFieldTarget(sx, sy)
      }
    }

    /**
     * Build a replay-based forward function for post-completion points.
     * This replays the full construction (recipe steps + post-completion actions)
     * and looks up the target point in the resulting state.
     */
    function buildReplayForward(targetPointId: string): ForwardFn {
      const prop = propositionRef.current
      const recipe = RECIPE_REGISTRY[prop.id]
      if (!recipe) return () => null

      return (inputPositions: Pt[]) => {
        // Map solved input positions to given element positions
        const positions = new Map<string, { x: number; y: number }>()
        for (let i = 0; i < recipe.inputSlots.length; i++) {
          positions.set(`pt-${recipe.inputSlots[i].ref}`, inputPositions[i])
        }

        // Compute given elements
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

        // Replay with post-completion actions
        const result = replayConstruction(
          givenElements,
          prop.steps,
          prop,
          postCompletionActionsRef.current,
          stepDataRef?.current
        )

        // Find the target point in the replayed state
        const pt = getPoint(result.state, targetPointId)
        return pt ? { x: pt.x, y: pt.y } : null
      }
    }

    /**
     * Collect all given + free point positions as solver inputs for playground mode.
     * Returns { positions, pointIds } where pointIds tracks which point each position maps to.
     */
    function collectPlaygroundInputPositions(): { positions: Pt[]; pointIds: string[] } | null {
      const positions: Pt[] = []
      const pointIds: string[] = []

      // Given points
      for (const el of constructionRef.current.elements) {
        if (el.kind === 'point' && el.origin === 'given') {
          positions.push({ x: el.x, y: el.y })
          pointIds.push(el.id)
        }
      }

      // Free points (from post-completion actions)
      for (const action of postCompletionActionsRef.current) {
        if (action.type === 'free-point') {
          positions.push({ x: action.x, y: action.y })
          pointIds.push(action.id)
        }
      }

      return positions.length > 0 ? { positions, pointIds } : null
    }

    /**
     * Build a replay-based forward function for playground mode.
     * Maps given + free point positions through a full replay to find the target.
     */
    function buildPlaygroundForward(targetPointId: string, pointIds: string[]): ForwardFn {
      const prop = propositionRef.current

      return (inputPositions: Pt[]) => {
        // Build given elements with updated positions
        const givenPositions = new Map<string, { x: number; y: number }>()
        const freePositions = new Map<string, { x: number; y: number }>()

        for (let i = 0; i < pointIds.length; i++) {
          const pt = getPoint(constructionRef.current, pointIds[i])
          if (pt?.origin === 'given') {
            givenPositions.set(pointIds[i], inputPositions[i])
          } else {
            freePositions.set(pointIds[i], inputPositions[i])
          }
        }

        const givenElements = prop.givenElements.map((el) => {
          if (el.kind === 'point' && givenPositions.has(el.id)) {
            const pos = givenPositions.get(el.id)!
            return { ...el, x: pos.x, y: pos.y }
          }
          return el
        })

        // Update free-point actions with solved positions
        const actions = postCompletionActionsRef.current.map((a) => {
          if (a.type === 'free-point' && freePositions.has(a.id)) {
            const pos = freePositions.get(a.id)!
            return { ...a, x: pos.x, y: pos.y }
          }
          return a
        })

        const result = replayConstruction(
          givenElements,
          prop.steps,
          prop,
          actions,
          stepDataRef?.current
        )

        const pt = getPoint(result.state, targetPointId)
        return pt ? { x: pt.x, y: pt.y } : null
      }
    }

    /**
     * Apply solved input positions in playground mode (given + free points).
     */
    function applyPlaygroundSolution(solvedPositions: Pt[], pointIds: string[]): void {
      const prop = propositionRef.current

      // Build given element positions
      const positions = new Map<string, { x: number; y: number }>()
      for (let i = 0; i < pointIds.length; i++) {
        const pt = getPoint(constructionRef.current, pointIds[i])
        if (pt?.origin === 'given') {
          positions.set(pointIds[i], solvedPositions[i])
        }
      }

      // Update free-point actions
      const actions = postCompletionActionsRef.current.map((a) => {
        if (a.type === 'free-point') {
          const idx = pointIds.indexOf(a.id)
          if (idx >= 0) return { ...a, x: solvedPositions[idx].x, y: solvedPositions[idx].y }
        }
        return a
      })
      postCompletionActionsRef.current = actions

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

      const result = replayConstruction(
        givenElements,
        prop.steps,
        prop,
        actions,
        stepDataRef?.current
      )
      constructionRef.current = result.state
      factStoreRef.current = result.factStore
      mergeProofFacts(factStoreRef.current, proofFactsRef.current)
      candidatesRef.current = result.candidates
      onReplayResult(result)
      needsDrawRef.current = true
    }

    /**
     * Handle drag of a derived point using FULL SOLVER mode.
     * The derived point tracks the cursor exactly.
     */
    function handleDerivedPointDragSolver(world: { x: number; y: number }): void {
      if (!dragPointId || !solverState) return

      const prop = propositionRef.current
      const recipe = RECIPE_REGISTRY[prop.id]
      const isPlayground = !!playgroundModeRef?.current

      // Cap warm-started lambda. solveInverse adapts lambda within its
      // 5-iteration call (growing 4× on null forward, 2× on residual not
      // decreasing, 0.5× on improvement). Warm-starting across frames is
      // useful in the converged regime (lambda settles around 1e-8). But
      // when the cursor enters a topologically unreachable region, every
      // iteration fails and lambda grows by ~1024× per frame. A few stuck
      // frames take it to 1e+30+, after which any future step is too
      // damped to recover even when the cursor returns to reachable space.
      // Capping keeps the converged regime fast (1e-3 is a small step from
      // 1e-8) while preventing the runaway.
      solverState.lambda = Math.min(solverState.lambda, 1e-3)

      // Snapshot current state so we can revert if the solver destroys the target point
      const prevState = constructionRef.current
      const prevFactStore = factStoreRef.current
      const prevCandidates = candidatesRef.current
      const prevActions = postCompletionActionsRef.current

      const prevDerivedPt = getPoint(prevState, dragPointId)

      if (isPlayground || !recipe) {
        const inputs = collectPlaygroundInputPositions()
        if (!inputs) return
        const forward = buildPlaygroundForward(dragPointId, inputs.pointIds)
        const solveResult = solveInverse(forward, inputs.positions, world, solverState)
        applyPlaygroundSolution(solveResult.inputPositions, inputs.pointIds)
      } else {
        const currentInputPositions = collectRecipeInputPositions()
        if (!currentInputPositions) return
        const targetRef = pointIdToRef(dragPointId)

        const isRecipePoint =
          recipe.inputSlots.some((s) => s.ref === targetRef) ||
          recipe.ops.some((op) => {
            if (op.kind === 'intersection') return op.output === targetRef
            if (op.kind === 'produce') return op.output === targetRef
            if (op.kind === 'apply') return Object.values(op.outputs).includes(targetRef)
            return false
          })

        let solveResult
        if (isRecipePoint) {
          solveResult = solveInverseKinematics(
            recipe,
            currentInputPositions,
            targetRef,
            world,
            RECIPE_REGISTRY,
            solverState
          )
        } else {
          const forward = buildReplayForward(dragPointId)
          solveResult = solveInverse(forward, currentInputPositions, world, solverState)
        }
        applyInverseSolution(solveResult.inputPositions)
      }

      // Track whether this solveInverse call exhausted its iteration budget
      // without making progress (lambda saturated near its per-call ceiling
      // of 1e-3 × 4^5 ≈ 1). Logged for diagnostics; behavior is "block":
      // when saturated, solveInverse returns its starting params unchanged
      // (bestParams = iter 0 params if no candidate ever improved residual),
      // so the apply call is a no-op and the construction stays where it is.
      if (solverState.lambda > 0.5) solverSaturatedCount++
      else solverSaturatedCount = 0

      // ── Guard: if the solver produced a degenerate result, revert ──
      const targetPt = getPoint(constructionRef.current, dragPointId)
      if (!targetPt) {
        logEvent('solver-revert-no-target', {
          cursorWorld: { x: world.x.toFixed(3), y: world.y.toFixed(3) },
          prevDerived: prevDerivedPt
            ? { x: prevDerivedPt.x.toFixed(3), y: prevDerivedPt.y.toFixed(3) }
            : null,
        })
        constructionRef.current = prevState
        factStoreRef.current = prevFactStore
        candidatesRef.current = prevCandidates
        postCompletionActionsRef.current = prevActions
        needsDrawRef.current = true
      } else {
        const v2 = viewportRef.current
        const errFromCursorPx = Math.sqrt(
          ((targetPt.x - world.x) * v2.pixelsPerUnit) ** 2 +
            ((targetPt.y - world.y) * v2.pixelsPerUnit) ** 2
        )
        const targetMovePx = prevDerivedPt
          ? Math.sqrt(
              ((targetPt.x - prevDerivedPt.x) * v2.pixelsPerUnit) ** 2 +
                ((targetPt.y - prevDerivedPt.y) * v2.pixelsPerUnit) ** 2
            )
          : 0
        // Track cursor velocity for stuck detection (logging only — the
        // warm-start cap above is what actually prevents the lambda trap).
        const cursorMovePx = prevCursorWorldSolver
          ? Math.sqrt(
              ((world.x - prevCursorWorldSolver.x) * v2.pixelsPerUnit) ** 2 +
                ((world.y - prevCursorWorldSolver.y) * v2.pixelsPerUnit) ** 2
            )
          : 0
        prevCursorWorldSolver = world
        const isStuck = targetMovePx < 1 && cursorMovePx > 3 && errFromCursorPx > 5
        if (isStuck) solverStuckCount++
        else if (targetMovePx >= 1) solverStuckCount = 0
        logFrame({
          mode: 'solver',
          targetMovePx: targetMovePx.toFixed(1),
          cursorMovePx: cursorMovePx.toFixed(0),
          errFromCursorPx: errFromCursorPx.toFixed(0),
          lambda: solverState?.lambda.toExponential(1),
          satCount: solverSaturatedCount,
        })
        // Check if any given/free point moved excessively far
        const MAX_POINT_MOVE_PX = 500
        const v = viewportRef.current
        let degenerate = false
        for (const el of constructionRef.current.elements) {
          if (el.kind !== 'point') continue
          if (el.origin !== 'given' && el.origin !== 'free') continue
          const prevPt = getPoint(prevState, el.id)
          if (!prevPt) continue
          const movePx = Math.sqrt(
            ((el.x - prevPt.x) * v.pixelsPerUnit) ** 2 + ((el.y - prevPt.y) * v.pixelsPerUnit) ** 2
          )
          if (movePx > MAX_POINT_MOVE_PX) {
            logEvent('solver-revert-excessive-move', {
              pointId: el.id,
              movePx: movePx.toFixed(0),
            })
            degenerate = true
            break
          }
        }
        if (degenerate) {
          constructionRef.current = prevState
          factStoreRef.current = prevFactStore
          candidatesRef.current = prevCandidates
          postCompletionActionsRef.current = prevActions
          needsDrawRef.current = true
        }
      }
    }

    /**
     * Handle drag of a derived point using CONSTRAINED mode.
     * Only moves a single given point — the derived point follows
     * deterministically but doesn't perfectly track the cursor,
     * revealing the construction's geometric constraints.
     */
    /**
     * One frame of the break-free → solver-pose transition.
     * Lerps input positions with easeOutCubic and replays the construction.
     * Continues to RAF until t reaches 1, then clears the transition so the
     * dispatcher resumes normal solver-mode handling on the next pointer move.
     */
    function stepBreakFreeTransition(): void {
      breakFreeTransitionId = null
      if (!breakFreeTransition || !dragPointId) {
        breakFreeTransition = null
        return
      }

      const elapsed = performance.now() - breakFreeTransition.startTime
      const t = Math.min(1, elapsed / breakFreeTransition.durationMs)
      const eased = 1 - (1 - t) ** 3 // easeOutCubic

      const lerped: Pt[] = breakFreeTransition.fromPositions.map((from, i) => {
        const to = breakFreeTransition!.toPositions[i]
        return {
          x: from.x + (to.x - from.x) * eased,
          y: from.y + (to.y - from.y) * eased,
        }
      })

      if (breakFreeTransition.kind === 'recipe') {
        applyInverseSolution(lerped)
      } else {
        applyPlaygroundSolution(lerped, breakFreeTransition.pointIds!)
      }
      needsDrawRef.current = true

      if (t < 1) {
        breakFreeTransitionId = requestAnimationFrame(stepBreakFreeTransition)
      } else {
        breakFreeTransition = null
      }
    }

    /**
     * Trigger break-free: set sticky flag, fire visual flash, clear tension,
     * and start an eased transition from the constrained pose to the solver
     * pose. The transition runs as its own RAF loop and the drag dispatcher
     * is gated until it completes — otherwise the user would see a hard snap
     * (the construction can rearrange dramatically when freed).
     */
    function triggerBreakFree(
      world: { x: number; y: number },
      derivedScreen: { x: number; y: number },
      v: EuclidViewportState,
      w: number,
      h: number
    ): void {
      logEvent('break-free-triggered', { frame: constrainedDragFrameCount })
      breakFree = true

      // Cancel any in-flight snap-to-cursor animation. Its remaining frames
      // would otherwise apply constrained-drag steps using a stale sub-Jacobian
      // on top of the solver's output — visible as flicker / undone work.
      if (snapAnimId != null) {
        cancelAnimationFrame(snapAnimId)
        snapAnimId = null
      }
      snapTargetWorld = null

      // Fire the break-free flash
      if (breakFreeFlashRef && dragInfluence) {
        const gId = dragInfluence.bestPointId
        if (gId) {
          const gPt = getPoint(constructionRef.current, gId)
          if (gPt) {
            const gScreen = worldToScreen2D(
              gPt.x,
              gPt.y,
              v.center.x,
              v.center.y,
              v.pixelsPerUnit,
              v.pixelsPerUnit,
              w,
              h
            )
            breakFreeFlashRef.current = {
              startTime: performance.now(),
              givenScreen: { x: gScreen.x, y: gScreen.y },
              derivedScreen: { x: derivedScreen.x, y: derivedScreen.y },
            }
          }
        }
      }

      // Clear tension visuals + fade out the influence highlight — once the
      // constraint snaps the rubber-band cue no longer applies.
      if (influenceHighlightStateRef) {
        influenceHighlightStateRef.current.tension = 0
        influenceHighlightStateRef.current.cursorScreen = null
      }
      if (hoveredDerivedPointIdRef) hoveredDerivedPointIdRef.current = null
      if (influentialGivenPointIdRef) influentialGivenPointIdRef.current = null

      // ── Compute the solver-pose target ONCE, then ease toward it. ──
      // Re-aiming the solver each frame during transition would let cursor
      // jitter wobble the in-flight target; locking it produces a clean
      // settle. Subsequent pointer moves resume normal solver tracking.
      if (!dragPointId || !solverState) {
        needsDrawRef.current = true
        return
      }
      const prop = propositionRef.current
      const recipe = RECIPE_REGISTRY[prop.id]
      const isPlayground = !!playgroundModeRef?.current

      if (isPlayground || !recipe) {
        const inputs = collectPlaygroundInputPositions()
        if (!inputs) {
          handleDerivedPointDragSolver(world)
          needsDrawRef.current = true
          return
        }
        const fromPositions = inputs.positions.map((p) => ({ x: p.x, y: p.y }))
        const forward = buildPlaygroundForward(dragPointId, inputs.pointIds)
        const solveResult = solveInverse(forward, inputs.positions, world, solverState)
        breakFreeTransition = {
          kind: 'playground',
          fromPositions,
          toPositions: solveResult.inputPositions,
          pointIds: inputs.pointIds,
          startTime: performance.now(),
          durationMs: 280,
        }
      } else {
        const currentInputs = collectRecipeInputPositions()
        if (!currentInputs) {
          handleDerivedPointDragSolver(world)
          needsDrawRef.current = true
          return
        }
        const fromPositions = currentInputs.map((p) => ({ x: p.x, y: p.y }))
        const targetRef = pointIdToRef(dragPointId)
        const isRecipePoint =
          recipe.inputSlots.some((s) => s.ref === targetRef) ||
          recipe.ops.some((op) => {
            if (op.kind === 'intersection') return op.output === targetRef
            if (op.kind === 'produce') return op.output === targetRef
            if (op.kind === 'apply') return Object.values(op.outputs).includes(targetRef)
            return false
          })
        const solveResult = isRecipePoint
          ? solveInverseKinematics(
              recipe,
              currentInputs,
              targetRef,
              world,
              RECIPE_REGISTRY,
              solverState
            )
          : solveInverse(buildReplayForward(dragPointId), currentInputs, world, solverState)
        breakFreeTransition = {
          kind: 'recipe',
          fromPositions,
          toPositions: solveResult.inputPositions,
          startTime: performance.now(),
          durationMs: 280,
        }
      }

      breakFreeTransitionId = requestAnimationFrame(stepBreakFreeTransition)
      needsDrawRef.current = true
    }

    function handleDerivedPointDragConstrained(world: { x: number; y: number }): void {
      if (!dragPointId || !dragInfluence) return

      // First frame: just record position, no movement yet
      if (!prevDragWorld) {
        prevDragWorld = world
        return
      }
      prevDragWorld = world // kept for snap-cancel seeding; not used for delta

      // Periodically refresh the sub-Jacobian to stay accurate
      constrainedDragFrameCount++
      if (constrainedDragFrameCount % 8 === 0) {
        const infCtx = buildInfluenceContext(dragPointId)
        if (infCtx) {
          const fresh = computeInfluence(infCtx.forward, infCtx.inputPositions, infCtx.pointIds)
          if (fresh && fresh.bestInputIndex === dragInfluence.bestInputIndex) {
            dragInfluence.subJacobian = fresh.subJacobian
          }
        }
      }

      // Update subJacobian on the highlight state during drag too
      if (influenceHighlightStateRef) {
        influenceHighlightStateRef.current.subJacobian = dragInfluence.subJacobian
      }

      // ── Compute tension: screen distance between cursor and derived point ──
      const { w, h } = getCSSSize()
      const v = viewportRef.current
      const derivedPt = getPoint(constructionRef.current, dragPointId)
      if (!derivedPt) return
      const derivedScreen = worldToScreen2D(
        derivedPt.x,
        derivedPt.y,
        v.center.x,
        v.center.y,
        v.pixelsPerUnit,
        v.pixelsPerUnit,
        w,
        h
      )
      const cursorScreen = worldToScreen2D(
        world.x,
        world.y,
        v.center.x,
        v.center.y,
        v.pixelsPerUnit,
        v.pixelsPerUnit,
        w,
        h
      )
      const screenDx = cursorScreen.x - derivedScreen.x
      const screenDy = cursorScreen.y - derivedScreen.y
      const screenDist = Math.sqrt(screenDx * screenDx + screenDy * screenDy)

      // Compute tension factor (0..1)
      const tension =
        screenDist <= TENSION_START_RADIUS
          ? 0
          : screenDist >= BREAK_FREE_RADIUS
            ? 1
            : (screenDist - TENSION_START_RADIUS) / (BREAK_FREE_RADIUS - TENSION_START_RADIUS)

      // Update tension on highlight state for visual rendering
      if (influenceHighlightStateRef) {
        influenceHighlightStateRef.current.tension = tension
        influenceHighlightStateRef.current.cursorScreen = { x: cursorScreen.x, y: cursorScreen.y }
      }

      // ── Check for break-free (cursor distance threshold) ──
      if (screenDist >= BREAK_FREE_RADIUS) {
        triggerBreakFree(world, derivedScreen, v, w, h)
        return
      }

      // ── Positional targeting (Newton step) instead of velocity integration ──
      // The derived point chases the cursor each frame: we measure the actual
      // residual error between where the derived IS and where it should be,
      // then apply a single inverse-Jacobian step to close the gap. Errors
      // get *corrected* per frame instead of *accumulated*, so closed cursor
      // paths produce closed derived paths — no spiral drift on circular or
      // repetitive motion.
      //
      // Tension dampens by limiting how far toward the cursor we aim each
      // frame, not by scaling the velocity. Same elastic feel, no drift.
      const dampen = 1 - tension * TENSION_DAMPEN
      const dx = dampen * (world.x - derivedPt.x)
      const dy = dampen * (world.y - derivedPt.y)

      if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) return

      // Get the current position of the influential given point
      const givenPointId = dragInfluence.bestPointId
      if (!givenPointId) return
      const givenPt = getPoint(constructionRef.current, givenPointId)
      if (!givenPt) return

      // Use sub-Jacobian to compute how to move the given point
      const newGivenPos = constrainedDragStep(
        { x: givenPt.x, y: givenPt.y },
        { x: dx, y: dy },
        dragInfluence.subJacobian
      )
      if (!newGivenPos) {
        logEvent('degenerate-jacobian-breakfree')
        triggerBreakFree(world, derivedScreen, v, w, h)
        return
      }

      // ── Safety check: if the given point would fly off screen, break free ──
      // This catches degenerate Jacobians (e.g. line-line intersections at shallow angles)
      const givenMoveX = (newGivenPos.x - givenPt.x) * v.pixelsPerUnit
      const givenMoveY = (newGivenPos.y - givenPt.y) * v.pixelsPerUnit
      const givenMoveDist = Math.sqrt(givenMoveX * givenMoveX + givenMoveY * givenMoveY)
      const MAX_GIVEN_MOVE_PX = 200 // screen px per frame — anything larger is degenerate

      if (givenMoveDist > MAX_GIVEN_MOVE_PX) {
        logEvent('excessive-given-move-breakfree', { givenMovePx: givenMoveDist.toFixed(1) })
        triggerBreakFree(world, derivedScreen, v, w, h)
        return
      }

      // Apply as a direct drag of the given point
      const prop = propositionRef.current

      // Snapshot the pre-mutation actions so we can revert the free-point
      // mutation below if the proposed move would destroy the dragged point.
      const prevActions = postCompletionActionsRef.current

      if (givenPt.origin === 'free') {
        // Update the free-point action
        postCompletionActionsRef.current = postCompletionActionsRef.current.map((a) =>
          a.type === 'free-point' && a.id === givenPointId
            ? { ...a, x: newGivenPos.x, y: newGivenPos.y }
            : a
        )
      }

      const positions = collectCurrentPositions()
      if (givenPt.origin === 'given') {
        positions.set(givenPointId, newGivenPos)
      }

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

      const actions = postCompletionActionsRef.current
      const result = replayConstruction(
        givenElements,
        prop.steps,
        prop,
        actions,
        stepDataRef?.current
      )

      // Guard: if the proposed frame would destroy the dragged point, escape
      // to the full solver. The canonical case is dragging an intersection
      // up to a tangency boundary — the sub-Jacobian becomes singular and
      // the constrained step (which only tweaks one given) can no longer
      // recover. Just rejecting the frame leaves the point stuck on the
      // boundary; handing off to break-free → LM solver lets it work in the
      // full input-position space and find a configuration where the point
      // lands at the cursor.
      const replayedDerived = getPoint(result.state, dragPointId)
      if (!replayedDerived) {
        logEvent('guard-fired-breakfree', {
          dragPointId,
          cursorWorld: { x: world.x.toFixed(3), y: world.y.toFixed(3) },
        })
        postCompletionActionsRef.current = prevActions
        triggerBreakFree(world, derivedScreen, v, w, h)
        return
      }

      const derivedMoveX = (replayedDerived.x - derivedPt.x) * v.pixelsPerUnit
      const derivedMoveY = (replayedDerived.y - derivedPt.y) * v.pixelsPerUnit
      const derivedMovePx = Math.sqrt(derivedMoveX * derivedMoveX + derivedMoveY * derivedMoveY)
      const replayedScreen = worldToScreen2D(
        replayedDerived.x,
        replayedDerived.y,
        v.center.x,
        v.center.y,
        v.pixelsPerUnit,
        v.pixelsPerUnit,
        w,
        h
      )
      const newCursorErrPx = Math.sqrt(
        (cursorScreen.x - replayedScreen.x) ** 2 + (cursorScreen.y - replayedScreen.y) ** 2
      )
      logFrame({
        mode: 'constrained',
        tension: tension.toFixed(2),
        cursorErrPx: screenDist.toFixed(0),
        newCursorErrPx: newCursorErrPx.toFixed(0),
        derivedMovePx: derivedMovePx.toFixed(1),
        givenMovePx: givenMoveDist.toFixed(1),
        subJ: dragInfluence.subJacobian.map((n) => n.toFixed(3)).join(','),
      })

      constructionRef.current = result.state
      factStoreRef.current = result.factStore
      mergeProofFacts(factStoreRef.current, proofFactsRef.current)
      candidatesRef.current = result.candidates
      onReplayResult(result)
      needsDrawRef.current = true

      // Record the given point's new screen position for the motion trail
      if (motionTrailStateRef) {
        const updatedGivenPt = getPoint(result.state, givenPointId)
        if (updatedGivenPt) {
          const screen = worldToScreen2D(
            updatedGivenPt.x,
            updatedGivenPt.y,
            v.center.x,
            v.center.y,
            v.pixelsPerUnit,
            v.pixelsPerUnit,
            w,
            h
          )
          recordTrailPosition(motionTrailStateRef.current, givenPointId, screen.x, screen.y)
        }
      }
    }

    /**
     * Handle drag of a derived (non-given, non-free, non-extend) point.
     * Routes to constrained or solver mode based on solverModeRef.
     * Once breakFree is set, stays in solver mode for the rest of the gesture.
     */
    function handleDerivedPointDrag(world: { x: number; y: number }): void {
      // Break-free transition owns the construction state until it completes.
      // Pointer moves during this window are intentionally ignored — the
      // user sees the construction settle into its solver pose, and the
      // next move (after t = 1) drives normal cursor tracking.
      if (breakFreeTransition) return

      const useSolver = solverModeRef?.current ?? false

      if (useSolver || breakFree || !dragInfluence) {
        // Clear tension visuals + influence target — solver/break-free has no
        // single "controlling" given, so the rubber-band cue does not apply.
        if (influenceHighlightStateRef) {
          influenceHighlightStateRef.current.tension = 0
          influenceHighlightStateRef.current.cursorScreen = null
        }
        if (hoveredDerivedPointIdRef) hoveredDerivedPointIdRef.current = null
        if (influentialGivenPointIdRef) influentialGivenPointIdRef.current = null
        handleDerivedPointDragSolver(world)
      } else {
        // Keep the influence highlight pointing at the drag pair so the
        // rubber band, ring vibration, and color shift are driven each frame.
        if (dragPointId && dragInfluence.bestPointId) {
          if (hoveredDerivedPointIdRef) hoveredDerivedPointIdRef.current = dragPointId
          if (influentialGivenPointIdRef)
            influentialGivenPointIdRef.current = dragInfluence.bestPointId
        }
        handleDerivedPointDragConstrained(world)
      }
    }

    /**
     * Handle direct drag of a given/free/extend point (existing behavior).
     */
    function handleDirectPointDrag(world: { x: number; y: number }, prop: PropositionDef): void {
      const draggedPt = getAllPoints(constructionRef.current).find((pt) => pt.id === dragPointId)
      let actions = postCompletionActionsRef.current

      if (draggedPt?.origin === 'free') {
        // Update the free-point action coordinates in place
        actions = actions.map((a) =>
          a.type === 'free-point' && a.id === dragPointId ? { ...a, x: world.x, y: world.y } : a
        )
        postCompletionActionsRef.current = actions
      } else if (draggedPt?.origin === 'extend') {
        // Ray-constrained drag: project cursor onto the ray and update distance
        const extendAction = actions.find((a) => a.type === 'extend' && a.pointId === dragPointId)
        if (extendAction && extendAction.type === 'extend') {
          const basePt = getPoint(constructionRef.current, extendAction.baseId)
          const throughPt = getPoint(constructionRef.current, extendAction.throughId)
          if (basePt && throughPt) {
            const dx = throughPt.x - basePt.x
            const dy = throughPt.y - basePt.y
            const len = Math.sqrt(dx * dx + dy * dy)
            if (len > 0.001) {
              const dirX = dx / len
              const dirY = dy / len
              // Project cursor onto ray beyond throughPt
              const toX = world.x - throughPt.x
              const toY = world.y - throughPt.y
              const proj = toX * dirX + toY * dirY
              const clampedDist = Math.max(0.1, proj)
              // Update distance in the action
              actions = actions.map((a) =>
                a.type === 'extend' && a.pointId === dragPointId
                  ? { ...a, distance: clampedDist }
                  : a
              )
              postCompletionActionsRef.current = actions
            }
          }
        }
      }

      // Collect current given point positions (unchanged for free/extend point drag)
      const positions = collectCurrentPositions()
      if (draggedPt?.origin !== 'free' && draggedPt?.origin !== 'extend') {
        positions.set(dragPointId!, world)
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
      const result = replayConstruction(
        givenElements,
        prop.steps,
        prop,
        actions,
        stepDataRef?.current
      )
      constructionRef.current = result.state
      factStoreRef.current = result.factStore
      mergeProofFacts(factStoreRef.current, proofFactsRef.current)
      candidatesRef.current = result.candidates
      onReplayResult(result)
      needsDrawRef.current = true
    }

    function cleanupDragState() {
      dragPointId = null
      dragPointOrigin = null
      solverState = null
      dragInfluence = null
      prevDragWorld = null
      prevCursorWorldSolver = null
      solverStuckCount = 0
      solverSaturatedCount = 0
      constrainedDragFrameCount = 0
      breakFree = false
      if (snapAnimId != null) {
        cancelAnimationFrame(snapAnimId)
        snapAnimId = null
      }
      snapTargetWorld = null
      if (breakFreeTransitionId != null) {
        cancelAnimationFrame(breakFreeTransitionId)
        breakFreeTransitionId = null
      }
      breakFreeTransition = null
      if (dragPointIdRef) dragPointIdRef.current = null
      pointerCapturedRef.current = false
      if (motionTrailStateRef) clearTrail(motionTrailStateRef.current)
      // Clear tension visuals + influence target on drag end so the highlight
      // fades out (it will reappear if the user re-hovers a derived point).
      if (influenceHighlightStateRef) {
        influenceHighlightStateRef.current.tension = 0
        influenceHighlightStateRef.current.cursorScreen = null
      }
      if (hoveredDerivedPointIdRef) hoveredDerivedPointIdRef.current = null
      if (influentialGivenPointIdRef) influentialGivenPointIdRef.current = null
    }

    function handlePointerUp(e: PointerEvent) {
      if (!dragPointId) return
      e.stopPropagation()
      cleanupDragState()
      canvas!.style.cursor = hoveredDraggableId ? 'grab' : ''
      // Construction state may have changed during drag — invalidate the
      // per-derived-point influence cache so the field re-derives next move.
      clearFieldCache()
      needsDrawRef.current = true
      onDragEnd?.()
    }

    function handlePointerCancel() {
      if (!dragPointId) return
      cleanupDragState()
      hoveredDraggableId = null
      canvas!.style.cursor = ''
      clearFieldCache()
      needsDrawRef.current = true
    }

    // ── Shift key: temporary solver mode override ──
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Shift' && solverModeRef) {
        solverModeRef.current = true
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === 'Shift' && solverModeRef) {
        solverModeRef.current = false
      }
    }

    // Register with capture: true to intercept before tool interaction and pan/zoom
    canvas.addEventListener('pointerdown', handlePointerDown, { capture: true })
    canvas.addEventListener('pointermove', handlePointerMove, { capture: true })
    canvas.addEventListener('pointerup', handlePointerUp, { capture: true })
    canvas.addEventListener('pointercancel', handlePointerCancel, { capture: true })
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown, { capture: true })
      canvas.removeEventListener('pointermove', handlePointerMove, { capture: true })
      canvas.removeEventListener('pointerup', handlePointerUp, { capture: true })
      canvas.removeEventListener('pointercancel', handlePointerCancel, { capture: true })
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
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
    dragPointIdRef,
    getCanvasRect,
    onDragEnd,
  ])
}

/**
 * Whether a point origin represents a derived (solver-eligible) point.
 * Given, free, and extend points are handled by direct drag.
 */
function isDerivedOrigin(origin: ConstructionPoint['origin']): boolean {
  return origin !== 'given' && origin !== 'free' && origin !== 'extend'
}
