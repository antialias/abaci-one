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
import { computeInfluence } from '../engine/jacobianInfluence'
import type { InfluenceHighlightState } from '../render/renderInfluenceHighlight'
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
  /** Ref updated with the hovered derived point ID (for influence highlight rendering) */
  hoveredDerivedPointIdRef?: React.MutableRefObject<string | null>
  /** Ref updated with the most influential given point ID (for influence highlight rendering) */
  influentialGivenPointIdRef?: React.MutableRefObject<string | null>
  /** Influence highlight state ref — used to set subJacobian for the preview arrow */
  influenceHighlightStateRef?: React.MutableRefObject<InfluenceHighlightState>
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
  hoveredDerivedPointIdRef,
  influentialGivenPointIdRef,
  influenceHighlightStateRef,
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
        const isDirect =
          draggableSet.has(pt.id) || pt.origin === 'free' || pt.origin === 'extend'
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

      // Recipe-defined output vs post-completion point — pick the cheaper forward.
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
     * Compute which given point most influences the hovered derived point
     * and write the result to the highlight refs. Pass null to clear.
     */
    function updateInfluenceHighlight(derivedPointId: string | null): void {
      if (!derivedPointId) {
        if (hoveredDerivedPointIdRef) hoveredDerivedPointIdRef.current = null
        if (influentialGivenPointIdRef) influentialGivenPointIdRef.current = null
        if (influenceHighlightStateRef) influenceHighlightStateRef.current.subJacobian = null
        return
      }

      const ctx = buildInfluenceContext(derivedPointId)
      if (!ctx) {
        if (hoveredDerivedPointIdRef) hoveredDerivedPointIdRef.current = null
        if (influentialGivenPointIdRef) influentialGivenPointIdRef.current = null
        if (influenceHighlightStateRef) influenceHighlightStateRef.current.subJacobian = null
        return
      }

      const influence = computeInfluence(ctx.forward, ctx.inputPositions, ctx.pointIds)
      if (!influence || !influence.bestPointId) {
        if (hoveredDerivedPointIdRef) hoveredDerivedPointIdRef.current = null
        if (influentialGivenPointIdRef) influentialGivenPointIdRef.current = null
        if (influenceHighlightStateRef) influenceHighlightStateRef.current.subJacobian = null
        return
      }

      if (hoveredDerivedPointIdRef) hoveredDerivedPointIdRef.current = derivedPointId
      if (influentialGivenPointIdRef) influentialGivenPointIdRef.current = influence.bestPointId
      if (influenceHighlightStateRef) {
        influenceHighlightStateRef.current.subJacobian = influence.subJacobian
      }
      needsDrawRef.current = true
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

        // Initialize solver state for derived point drags
        if (isDerivedOrigin(hit.origin)) {
          solverState = createSolverState()
        } else {
          solverState = null
        }

        // Clear influence highlight while a drag is in progress.
        if (hoveredDerivedPointIdRef) hoveredDerivedPointIdRef.current = null
        if (influentialGivenPointIdRef) influentialGivenPointIdRef.current = null

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

          // Update influence highlight only for derived points; clear otherwise.
          if (hit && isDerivedOrigin(hit.origin)) {
            updateInfluenceHighlight(hit.id)
          } else {
            updateInfluenceHighlight(null)
          }
        }
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
      let actions = postCompletionActionsRef.current.map((a) => {
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
     * Handle drag of a derived (non-given, non-free, non-extend) point
     * using the inverse kinematics solver.
     */
    function handleDerivedPointDrag(world: { x: number; y: number }): void {
      if (!dragPointId || !solverState) return

      const prop = propositionRef.current
      const recipe = RECIPE_REGISTRY[prop.id]
      const isPlayground = !!playgroundModeRef?.current

      // Snapshot construction state so we can revert if the solver places
      // givens such that the dragged target disappears or a given flies
      // wildly across the viewport (degenerate Jacobian, no real solution).
      const prevState = constructionRef.current
      const prevFactStore = factStoreRef.current
      const prevCandidates = candidatesRef.current
      const prevActions = postCompletionActionsRef.current

      if (isPlayground || !recipe) {
        // Playground / no-recipe path: solve over given + free points
        const inputs = collectPlaygroundInputPositions()
        if (!inputs) return

        const forward = buildPlaygroundForward(dragPointId, inputs.pointIds)
        const result = solveInverse(
          forward,
          inputs.positions,
          { x: world.x, y: world.y },
          solverState
        )
        applyPlaygroundSolution(result.inputPositions, inputs.pointIds)
      } else {
        // Recipe path
        const currentInputPositions = collectRecipeInputPositions()
        if (!currentInputPositions) return

        const targetRef = pointIdToRef(dragPointId)

        // Check if this is a recipe-defined point or a post-completion point
        const isRecipePoint =
          recipe.inputSlots.some((s) => s.ref === targetRef) ||
          recipe.ops.some((op) => {
            if (op.kind === 'intersection') return op.output === targetRef
            if (op.kind === 'produce') return op.output === targetRef
            if (op.kind === 'apply') return Object.values(op.outputs).includes(targetRef)
            return false
          })

        let result
        if (isRecipePoint) {
          // Fast path: recipe evaluator as forward model
          result = solveInverseKinematics(
            recipe,
            currentInputPositions,
            targetRef,
            { x: world.x, y: world.y },
            RECIPE_REGISTRY,
            solverState
          )
        } else {
          // Slow path: full replay as forward model (for post-completion points)
          const forward = buildReplayForward(dragPointId)
          result = solveInverse(
            forward,
            currentInputPositions,
            { x: world.x, y: world.y },
            solverState
          )
        }

        applyInverseSolution(result.inputPositions)
      }

      // ── Guard: revert if the solver produced a degenerate result ──
      const targetPt = getPoint(constructionRef.current, dragPointId)
      if (!targetPt) {
        // Solver placed givens such that the target point no longer exists
        // (e.g. circles no longer intersect). Roll back.
        constructionRef.current = prevState
        factStoreRef.current = prevFactStore
        candidatesRef.current = prevCandidates
        postCompletionActionsRef.current = prevActions
        needsDrawRef.current = true
        return
      }

      // Catch the case where the Jacobian was near-singular and a given
      // teleported far across the viewport in a single frame.
      const MAX_POINT_MOVE_PX = 500
      const v = viewportRef.current
      for (const el of constructionRef.current.elements) {
        if (el.kind !== 'point') continue
        if (el.origin !== 'given' && el.origin !== 'free') continue
        const prevPt = getPoint(prevState, el.id)
        if (!prevPt) continue
        const movePx = Math.sqrt(
          ((el.x - prevPt.x) * v.pixelsPerUnit) ** 2 +
            ((el.y - prevPt.y) * v.pixelsPerUnit) ** 2
        )
        if (movePx > MAX_POINT_MOVE_PX) {
          constructionRef.current = prevState
          factStoreRef.current = prevFactStore
          candidatesRef.current = prevCandidates
          postCompletionActionsRef.current = prevActions
          needsDrawRef.current = true
          return
        }
      }
    }

    /**
     * Handle direct drag of a given/free/extend point (existing behavior).
     */
    function handleDirectPointDrag(
      world: { x: number; y: number },
      prop: PropositionDef
    ): void {
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

    function handlePointerUp(e: PointerEvent) {
      if (!dragPointId) return
      e.stopPropagation()
      dragPointId = null
      dragPointOrigin = null
      solverState = null
      if (dragPointIdRef) dragPointIdRef.current = null
      pointerCapturedRef.current = false
      canvas!.style.cursor = hoveredDraggableId ? 'grab' : ''
      needsDrawRef.current = true
      onDragEnd?.()
    }

    function handlePointerCancel() {
      if (!dragPointId) return
      dragPointId = null
      dragPointOrigin = null
      solverState = null
      if (dragPointIdRef) dragPointIdRef.current = null
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
