/**
 * Pure evaluator for ConstructionRecipe.
 *
 * Given a recipe and concrete input positions, produces a ConstructionTrace
 * containing every resolved point, circle, segment, and per-op geometry.
 * No side effects, no construction state mutation.
 */

import type {
  ConstructionRecipe,
  ConstructionTrace,
  IntersectionSource,
  OpTrace,
  Pt,
  RecipeOp,
  Ref,
  ResolvedCircle,
  ResolvedSegment,
  RecipeRegistry,
} from './types'
import {
  computeEquilateralApex,
  computeDirectionVector,
  intersectionBeyond,
} from '../geometryHelpers'
import { circleCircleIntersections, circleLineIntersections } from '../intersections'

/**
 * Evaluate a recipe with concrete input positions.
 * Returns null if the construction is impossible (missing points, degenerate geometry).
 */
export function evaluateRecipe(
  recipe: ConstructionRecipe,
  inputPositions: Pt[],
  registry: RecipeRegistry
): ConstructionTrace | null {
  if (inputPositions.length < recipe.inputSlots.length) return null

  const pointMap = new Map<Ref, Pt>()
  const circleMap = new Map<string, ResolvedCircle>()
  const segmentMap = new Map<string, ResolvedSegment>()
  const opTraces: OpTrace[] = []

  // Bind input refs to positions
  for (let i = 0; i < recipe.inputSlots.length; i++) {
    pointMap.set(recipe.inputSlots[i].ref, inputPositions[i])
  }

  // Check degenerate conditions
  let activeOps = recipe.ops
  let degenerate = false
  let activeCeremony = recipe.ceremony

  if (recipe.degenerateCases) {
    for (const dc of recipe.degenerateCases) {
      const [refA, refB] = dc.condition.coincident
      const pA = pointMap.get(refA)
      const pB = pointMap.get(refB)
      if (pA && pB) {
        const dx = pA.x - pB.x
        const dy = pA.y - pB.y
        if (Math.sqrt(dx * dx + dy * dy) < 1e-9) {
          activeOps = dc.ops
          degenerate = true
          if (dc.ceremony) activeCeremony = dc.ceremony
          break
        }
      }
    }
  }

  // Walk ops in order
  for (const op of activeOps) {
    const trace = evaluateOp(op, pointMap, circleMap, segmentMap, registry)
    if (!trace) return null
    opTraces.push(trace)
  }

  return {
    recipe,
    inputPositions,
    pointMap,
    circleMap,
    segmentMap,
    opTraces,
    degenerate,
  }
}

function evaluateOp(
  op: RecipeOp,
  pointMap: Map<Ref, Pt>,
  circleMap: Map<string, ResolvedCircle>,
  segmentMap: Map<string, ResolvedSegment>,
  registry: RecipeRegistry
): OpTrace | null {
  switch (op.kind) {
    case 'segment': {
      const from = pointMap.get(op.from)
      const to = pointMap.get(op.to)
      if (!from || !to) return null
      segmentMap.set(op.id, { opId: op.id, from, to })
      return { kind: 'segment', opId: op.id, from, to, fromRef: op.from, toRef: op.to }
    }

    case 'circle': {
      const center = pointMap.get(op.center)
      const radiusPt = pointMap.get(op.radiusPoint)
      if (!center || !radiusPt) return null
      const radius = Math.sqrt((center.x - radiusPt.x) ** 2 + (center.y - radiusPt.y) ** 2)
      circleMap.set(op.id, { opId: op.id, center, radius })
      return {
        kind: 'circle',
        opId: op.id,
        center,
        radius,
        centerRef: op.center,
        radiusPointRef: op.radiusPoint,
      }
    }

    case 'intersection': {
      const point = resolveIntersection(op.of, op.prefer, circleMap, segmentMap, pointMap)
      if (!point) return null
      pointMap.set(op.output, point)
      return { kind: 'intersection', opId: op.id, point, outputRef: op.output }
    }

    case 'produce': {
      const from = pointMap.get(op.from)
      const through = pointMap.get(op.through)
      const circle = circleMap.get(op.until)
      if (!from || !through || !circle) return null

      // Zero-radius circle: the only "intersection" is the center point
      let point: Pt | null
      if (circle.radius < 1e-9) {
        point = { x: circle.center.x, y: circle.center.y }
      } else {
        point = intersectionBeyond(from, through, circle.center.x, circle.center.y, circle.radius)
      }
      if (!point) return null
      pointMap.set(op.output, point)
      return {
        kind: 'produce',
        opId: op.id,
        point,
        outputRef: op.output,
        fromRef: op.from,
        throughRef: op.through,
      }
    }

    case 'apply': {
      const subRecipe = registry[op.recipeId]
      if (!subRecipe) return null

      const subInputs: Pt[] = op.inputs.map((ref) => pointMap.get(ref)!).filter(Boolean)
      if (subInputs.length < op.inputs.length) return null

      const subTrace = evaluateRecipe(subRecipe, subInputs, registry)
      if (!subTrace) return null

      // Map sub-recipe exports back to local refs
      const outputMappings: Record<Ref, Ref> = {}
      for (const [subRef, localRef] of Object.entries(op.outputs)) {
        const pt = subTrace.pointMap.get(subRef)
        if (pt) {
          pointMap.set(localRef, pt)
          outputMappings[subRef] = localRef
        }
      }

      return { kind: 'apply', opId: op.id, subTrace, outputMappings }
    }
  }
}

/**
 * Resolve an IntersectionSource to either a circle or segment.
 * Handles string op IDs (looked up in circleMap/segmentMap) and inline segment refs.
 */
function resolveSource(
  source: IntersectionSource,
  circleMap: Map<string, ResolvedCircle>,
  segmentMap: Map<string, ResolvedSegment>,
  pointMap: Map<Ref, Pt>
): ResolvedCircle | ResolvedSegment | null {
  if (typeof source === 'string') {
    return circleMap.get(source) ?? segmentMap.get(source) ?? null
  }
  // Inline segment refs — create a virtual segment from the pointMap
  const from = pointMap.get(source.segmentRefs[0])
  const to = pointMap.get(source.segmentRefs[1])
  if (!from || !to) return null
  return { opId: `inline-${source.segmentRefs[0]}-${source.segmentRefs[1]}`, from, to }
}

function isCircle(el: ResolvedCircle | ResolvedSegment): el is ResolvedCircle {
  return 'radius' in el
}

/**
 * Resolve an intersection between two elements.
 * Handles circle-circle and circle-segment/line intersections.
 */
function resolveIntersection(
  sources: [IntersectionSource, IntersectionSource],
  prefer: 'upper' | 'lower',
  circleMap: Map<string, ResolvedCircle>,
  segmentMap: Map<string, ResolvedSegment>,
  pointMap: Map<Ref, Pt>
): Pt | null {
  const elA = resolveSource(sources[0], circleMap, segmentMap, pointMap)
  const elB = resolveSource(sources[1], circleMap, segmentMap, pointMap)
  if (!elA || !elB) return null

  const cirA = isCircle(elA) ? elA : null
  const cirB = isCircle(elB) ? elB : null
  const segA = !isCircle(elA) ? elA : null
  const segB = !isCircle(elB) ? elB : null

  if (cirA && cirB) {
    // Circle-circle intersection
    // Use computeEquilateralApex if the radii are equal (common case for I.1)
    if (Math.abs(cirA.radius - cirB.radius) < 1e-9) {
      const apex = computeEquilateralApex(cirA.center, cirB.center)
      if (!apex) return null

      // computeEquilateralApex already prefers upper/left, which matches 'upper'
      if (prefer === 'lower') {
        // Get the other intersection
        const pts = circleCircleIntersections(
          cirA.center.x,
          cirA.center.y,
          cirA.radius,
          cirB.center.x,
          cirB.center.y,
          cirB.radius
        )
        if (pts.length < 2) return apex
        // Return the one that's NOT the apex
        const other = pts.find(
          (p) => Math.abs(p.x - apex.x) > 0.01 || Math.abs(p.y - apex.y) > 0.01
        )
        return other ?? pts[1]
      }
      return apex
    }

    // Different radii — general circle-circle
    const pts = circleCircleIntersections(
      cirA.center.x,
      cirA.center.y,
      cirA.radius,
      cirB.center.x,
      cirB.center.y,
      cirB.radius
    )
    if (pts.length === 0) return null
    if (pts.length === 1) return pts[0]

    // Use A→B direction for chirality preference
    const abx = cirB.center.x - cirA.center.x
    const aby = cirB.center.y - cirA.center.y
    const upper = pts.filter((p) => abx * (p.y - cirA.center.y) - aby * (p.x - cirA.center.x) > 0)
    if (prefer === 'upper') {
      return upper.length > 0 ? upper[0] : pts[0]
    } else {
      const lower = pts.filter(
        (p) => abx * (p.y - cirA.center.y) - aby * (p.x - cirA.center.x) <= 0
      )
      return lower.length > 0 ? lower[0] : pts[0]
    }
  }

  if ((cirA && segB) || (segA && cirB)) {
    const circle = cirA ?? cirB!
    const segment = (segA ?? segB)!
    const pts = circleLineIntersections(
      circle.center.x,
      circle.center.y,
      circle.radius,
      segment.from.x,
      segment.from.y,
      segment.to.x,
      segment.to.y
    )
    if (pts.length === 0) return null
    if (pts.length === 1) return pts[0]

    // Pick based on parametric position along the segment direction (from→to).
    // 'upper' = further in the from→to direction (higher t), 'lower' = earlier.
    const dx = segment.to.x - segment.from.x
    const dy = segment.to.y - segment.from.y
    const t0 = (pts[0].x - segment.from.x) * dx + (pts[0].y - segment.from.y) * dy
    const t1 = (pts[1].x - segment.from.x) * dx + (pts[1].y - segment.from.y) * dy
    if (prefer === 'upper') {
      return t0 >= t1 ? pts[0] : pts[1]
    } else {
      return t0 <= t1 ? pts[0] : pts[1]
    }
  }

  return null
}
