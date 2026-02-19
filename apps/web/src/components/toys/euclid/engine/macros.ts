import type {
  ConstructionState,
  ConstructionElement,
  IntersectionCandidate,
  GhostElement,
  GhostLayer,
} from '../types'
import { BYRNE_CYCLE } from '../types'
import type { FactStore } from './factStore'
import type { EqualityFact } from './facts'
import { distancePair } from './facts'
import { addSegment, addPoint, getPoint } from './constructionState'
import { findNewIntersections, circleCircleIntersections, circleLineIntersections } from './intersections'
import { addFact, createFactStore } from './factStore'

export interface MacroDef {
  propId: number
  label: string
  inputCount: number
  inputLabels: string[]
  /** Maps macro inputs to the source proposition's given point IDs. */
  inputToGivenIds: string[]
  execute: (
    state: ConstructionState,
    inputPointIds: string[],
    candidates: IntersectionCandidate[],
    factStore: FactStore,
    atStep: number,
    extendSegments?: boolean,
    outputLabels?: Record<string, string>,
  ) => MacroResult
}

export interface MacroResult {
  state: ConstructionState
  candidates: IntersectionCandidate[]
  addedElements: ConstructionElement[]
  newFacts: EqualityFact[]
  ghostLayers: GhostLayer[]
}

/**
 * Find the intersection of a circle with a line (defined by two points)
 * that lies "beyond" lineThrough — i.e., on the extension past lineThrough
 * in the direction lineFrom→lineThrough.
 */
function intersectionBeyond(
  lineFrom: { x: number; y: number },
  lineThrough: { x: number; y: number },
  cx: number, cy: number, cr: number,
): { x: number; y: number } | null {
  const pts = circleLineIntersections(cx, cy, cr, lineFrom.x, lineFrom.y, lineThrough.x, lineThrough.y)
  const dx = lineThrough.x - lineFrom.x
  const dy = lineThrough.y - lineFrom.y
  for (const p of pts) {
    const dot = (p.x - lineThrough.x) * dx + (p.y - lineThrough.y) * dy
    if (dot > 0) return p
  }
  return null
}

/**
 * Macro for Proposition I.1: Construct equilateral triangle on two points.
 *
 * The construction circles are internal to the proof of I.1 and are NOT
 * rendered — this is a proven tool, so only the result (apex point + two
 * segments) is shown. Ghost geometry (the two circles) is included in
 * the returned ghostLayers.
 *
 * Steps:
 * 1. Compute circle-circle intersection directly (no circles in state)
 * 2. addPoint for apex
 * 3. Derive Def.15 facts directly (DA = AB, DB = BA)
 * 4. addSegment(apex, ptA) + findNewIntersections
 * 5. addSegment(apex, ptB) + findNewIntersections
 */
const MACRO_PROP_1: MacroDef = {
  propId: 1,
  label: 'Equilateral triangle (I.1)',
  inputCount: 2,
  inputLabels: ['First endpoint', 'Second endpoint'],
  inputToGivenIds: ['pt-A', 'pt-B'],
  execute(
    state: ConstructionState,
    inputPointIds: string[],
    candidates: IntersectionCandidate[],
    factStore: FactStore,
    atStep: number,
    extendSegments: boolean = false,
    outputLabels?: Record<string, string>,
  ): MacroResult {
    const [ptA, ptB] = inputPointIds
    const addedElements: ConstructionElement[] = []
    let currentState = state
    let currentCandidates = [...candidates]
    // factStore is mutated in place by addFact
    const allNewFacts: EqualityFact[] = []

    // 1. Compute apex as intersection of two circles:
    //    circle(centerA, radiusAB) ∩ circle(centerB, radiusBA)
    //    No circles are added to state — I.1 is a proven tool.
    const pA = getPoint(currentState, ptA)
    const pB = getPoint(currentState, ptB)
    if (!pA || !pB) {
      return { state: currentState, candidates: currentCandidates, addedElements, newFacts: allNewFacts, ghostLayers: [] }
    }
    const radius = Math.sqrt((pA.x - pB.x) ** 2 + (pA.y - pB.y) ** 2)
    const intersections = circleCircleIntersections(
      pA.x, pA.y, radius,
      pB.x, pB.y, radius,
    )
    // Pick highest-Y intersection (above the line AB)
    const apex = intersections.reduce(
      (best, p) => (p.y > best.y ? p : best),
      intersections[0],
    )
    if (!apex) {
      return { state: currentState, candidates: currentCandidates, addedElements, newFacts: allNewFacts, ghostLayers: [] }
    }

    // 2. Add the apex point (use explicit label if provided)
    const ptResult = addPoint(currentState, apex.x, apex.y, 'intersection', outputLabels?.apex)
    currentState = ptResult.state
    addedElements.push(ptResult.point)

    // 3. Derive Def.15 facts directly — no circles needed in state.
    //    DA = AB (D on circle centered at A through B)
    //    DB = BA (D on circle centered at B through A)
    const apexId = ptResult.point.id
    const apexLabel = ptResult.point.label
    const aLabel = pA.label
    const bLabel = pB.label

    {
      const left = distancePair(ptA, apexId)
      const right = distancePair(ptA, ptB)
      allNewFacts.push(...addFact(
        factStore, left, right,
        { type: 'def15', circleId: `internal-cir-${ptA}` },
        `${aLabel}${apexLabel} = ${aLabel}${bLabel}`,
        `Def.15: ${apexLabel} lies on circle centered at ${aLabel} through ${bLabel}`,
        atStep,
      ))
    }
    {
      const left = distancePair(ptB, apexId)
      const right = distancePair(ptB, ptA)
      allNewFacts.push(...addFact(
        factStore, left, right,
        { type: 'def15', circleId: `internal-cir-${ptB}` },
        `${bLabel}${apexLabel} = ${bLabel}${aLabel}`,
        `Def.15: ${apexLabel} lies on circle centered at ${bLabel} through ${aLabel}`,
        atStep,
      ))
    }

    // 4. Segment apex → A
    const seg1 = addSegment(currentState, apexId, ptA)
    currentState = seg1.state
    addedElements.push(seg1.segment)
    const newCands1 = findNewIntersections(currentState, seg1.segment, currentCandidates, extendSegments)
    currentCandidates = [...currentCandidates, ...newCands1]

    // 5. Segment apex → B
    const seg2 = addSegment(currentState, apexId, ptB)
    currentState = seg2.state
    addedElements.push(seg2.segment)
    const newCands2 = findNewIntersections(currentState, seg2.segment, currentCandidates, extendSegments)
    currentCandidates = [...currentCandidates, ...newCands2]

    // Ghost: the two construction circles hidden by the macro
    const ghostLayers: GhostLayer[] = []
    if (radius > 1e-9) {
      ghostLayers.push({
        propId: 1,
        depth: 1,
        atStep: 0, // relative; caller stamps actual step
        elements: [
          { kind: 'circle', cx: pA.x, cy: pA.y, r: radius, color: BYRNE_CYCLE[0] },
          { kind: 'circle', cx: pB.x, cy: pB.y, r: radius, color: BYRNE_CYCLE[1] },
        ],
      })
    }

    return {
      state: currentState,
      candidates: currentCandidates,
      addedElements,
      newFacts: allNewFacts,
      ghostLayers,
    }
  },
}

/**
 * Macro for Proposition I.2: Place at a given point a line equal to a given line.
 *
 * Inputs: [targetPointId, segFromId, segToId]
 *   - targetPointId: where to place the equal segment
 *   - segFromId, segToId: endpoints of the segment to copy
 *
 * Output: 1 point + 1 segment + 1 fact
 *   - Point at distance |segFrom-segTo| from target, in direction target→segFrom
 *   - Segment from target to output point
 *   - Fact: dist(target, output) = dist(segFrom, segTo) with citation { type: 'prop', propId: 2 }
 *
 * Ghost geometry shows the full I.2 construction: equilateral triangle,
 * circles, and intersection points used in the proof.
 */
const MACRO_PROP_2: MacroDef = {
  propId: 2,
  label: 'Transfer distance (I.2)',
  inputCount: 3,
  inputLabels: ['Target point', 'Segment start', 'Segment end'],
  inputToGivenIds: ['pt-A', 'pt-B', 'pt-C'],
  execute(
    state: ConstructionState,
    inputPointIds: string[],
    candidates: IntersectionCandidate[],
    factStore: FactStore,
    atStep: number,
    extendSegments: boolean = false,
    outputLabels?: Record<string, string>,
  ): MacroResult {
    const [targetId, segFromId, segToId] = inputPointIds
    const addedElements: ConstructionElement[] = []
    let currentState = state
    let currentCandidates = [...candidates]
    const allNewFacts: EqualityFact[] = []

    const target = getPoint(currentState, targetId)
    const segFrom = getPoint(currentState, segFromId)
    const segTo = getPoint(currentState, segToId)
    if (!target || !segFrom || !segTo) {
      return { state: currentState, candidates: currentCandidates, addedElements, newFacts: allNewFacts, ghostLayers: [] }
    }

    // 1. Compute distance to copy
    const dist = Math.sqrt((segFrom.x - segTo.x) ** 2 + (segFrom.y - segTo.y) ** 2)

    // 2. Compute direction: target → segFrom (fallback to (0, 1) if coincident)
    let dx = segFrom.x - target.x
    let dy = segFrom.y - target.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 1e-9) {
      dx = 0
      dy = 1
    } else {
      dx /= len
      dy /= len
    }

    // 3. Place output point at target + dist * direction
    const outX = target.x + dist * dx
    const outY = target.y + dist * dy

    const ptResult = addPoint(currentState, outX, outY, 'intersection', outputLabels?.result)
    currentState = ptResult.state
    addedElements.push(ptResult.point)

    // 4. Add segment from target to output + find intersections
    const seg = addSegment(currentState, targetId, ptResult.point.id)
    currentState = seg.state
    addedElements.push(seg.segment)
    const newCands = findNewIntersections(currentState, seg.segment, currentCandidates, extendSegments)
    currentCandidates = [...currentCandidates, ...newCands]

    // 5. Add fact: dist(target, output) = dist(segFrom, segTo)
    const outputId = ptResult.point.id
    const outputLabel = ptResult.point.label
    const targetLabel = target.label
    const segFromLabel = segFrom.label
    const segToLabel = segTo.label

    const left = distancePair(targetId, outputId)
    const right = distancePair(segFromId, segToId)
    allNewFacts.push(...addFact(
      factStore, left, right,
      { type: 'prop', propId: 2 },
      `${targetLabel}${outputLabel} = ${segFromLabel}${segToLabel}`,
      `I.2: placed at ${targetLabel} a line equal to ${segFromLabel}${segToLabel}`,
      atStep,
    ))

    // ── Ghost geometry: full I.2 construction replay ──
    const ghostElements: GhostElement[] = []
    const childGhostLayers: GhostLayer[] = []
    let colorIndex = 0

    // Step 1: Straightedge A→B
    ghostElements.push({
      kind: 'segment',
      x1: target.x, y1: target.y,
      x2: segFrom.x, y2: segFrom.y,
      color: BYRNE_CYCLE[colorIndex++ % 3],
    })

    // Step 2: Equilateral triangle on A,B (I.1 internal construction)
    const abRadius = Math.sqrt((target.x - segFrom.x) ** 2 + (target.y - segFrom.y) ** 2)

    if (abRadius > 1e-9) {
      // Non-degenerate: full I.2 construction ghost with equilateral triangle,
      // circles, intersection points, and production segments.
      const apexCandidates = circleCircleIntersections(
        target.x, target.y, abRadius,
        segFrom.x, segFrom.y, abRadius,
      )
      const apexD = apexCandidates.reduce(
        (best, p) => (p.y > best.y ? p : best),
        apexCandidates[0],
      ) ?? { x: target.x, y: target.y + abRadius * Math.sqrt(3) / 2 }

      // Ghost point D + segments DA, DB
      ghostElements.push(
        { kind: 'point', x: apexD.x, y: apexD.y, label: 'D', color: BYRNE_CYCLE[colorIndex++ % 3] },
      )
      const segDA_color = BYRNE_CYCLE[colorIndex % 3]
      ghostElements.push(
        { kind: 'segment', x1: apexD.x, y1: apexD.y, x2: target.x, y2: target.y, color: BYRNE_CYCLE[colorIndex++ % 3] },
      )
      const segDB_color = BYRNE_CYCLE[colorIndex % 3]
      ghostElements.push(
        { kind: 'segment', x1: apexD.x, y1: apexD.y, x2: segFrom.x, y2: segFrom.y, color: BYRNE_CYCLE[colorIndex++ % 3] },
      )

      // I.1's ghost layers (two construction circles) at depth+1
      childGhostLayers.push({
        propId: 1,
        depth: 2, // I.2 is depth 1, I.1 inside it is depth 2
        atStep: 0,
        elements: [
          { kind: 'circle', cx: target.x, cy: target.y, r: abRadius, color: BYRNE_CYCLE[0] },
          { kind: 'circle', cx: segFrom.x, cy: segFrom.y, r: abRadius, color: BYRNE_CYCLE[1] },
        ],
      })

      // Step 3: Circle at B through C
      const bcRadius = dist
      ghostElements.push({
        kind: 'circle',
        cx: segFrom.x, cy: segFrom.y,
        r: bcRadius,
        color: BYRNE_CYCLE[colorIndex++ % 3],
      })

      // Direction D→B (for "produce DB to E")
      let dbDirX = segFrom.x - apexD.x
      let dbDirY = segFrom.y - apexD.y
      const dbLen = Math.sqrt(dbDirX * dbDirX + dbDirY * dbDirY)
      if (dbLen < 1e-9) { dbDirX = 0; dbDirY = 1 }
      else { dbDirX /= dbLen; dbDirY /= dbLen }

      // Step 4: E = point on circle(B, |BC|) along ray D→B past B
      const ptE = { x: segFrom.x + bcRadius * dbDirX, y: segFrom.y + bcRadius * dbDirY }
      ghostElements.push(
        { kind: 'point', x: ptE.x, y: ptE.y, label: 'E', color: BYRNE_CYCLE[colorIndex++ % 3] },
      )
      ghostElements.push({
        kind: 'segment',
        x1: segFrom.x, y1: segFrom.y,
        x2: ptE.x, y2: ptE.y,
        color: segDB_color,
        isProduction: true,
      })

      // Step 5: Circle at D through E
      const deRadius = Math.sqrt((apexD.x - ptE.x) ** 2 + (apexD.y - ptE.y) ** 2)
      ghostElements.push({
        kind: 'circle',
        cx: apexD.x, cy: apexD.y,
        r: deRadius,
        color: BYRNE_CYCLE[colorIndex++ % 3],
      })

      // Direction D→A (for "produce DA to F")
      let daDirX = target.x - apexD.x
      let daDirY = target.y - apexD.y
      const daLen = Math.sqrt(daDirX * daDirX + daDirY * daDirY)
      if (daLen < 1e-9) { daDirX = 0; daDirY = 1 }
      else { daDirX /= daLen; daDirY /= daLen }

      // Step 6: F = point on circle(D, |DE|) along ray D→A past A
      const ptF = { x: apexD.x + deRadius * daDirX, y: apexD.y + deRadius * daDirY }
      ghostElements.push(
        { kind: 'point', x: ptF.x, y: ptF.y, label: 'F', color: BYRNE_CYCLE[colorIndex++ % 3] },
      )
      ghostElements.push({
        kind: 'segment',
        x1: target.x, y1: target.y,
        x2: ptF.x, y2: ptF.y,
        color: segDA_color,
        isProduction: true,
      })
    } else {
      // Degenerate: target = segFrom (I.2 trivially satisfied).
      // The distance is already at the target point, so there's no meaningful
      // I.2 construction to show. Just ghost the circle at B through C.
      ghostElements.push({
        kind: 'circle',
        cx: segFrom.x, cy: segFrom.y,
        r: dist,
        color: BYRNE_CYCLE[colorIndex++ % 3],
      })
    }

    const ghostLayers: GhostLayer[] = []
    if (ghostElements.length > 0) {
      ghostLayers.push({ propId: 2, depth: 1, atStep: 0, elements: ghostElements })
    }
    ghostLayers.push(...childGhostLayers)

    return {
      state: currentState,
      candidates: currentCandidates,
      addedElements,
      newFacts: allNewFacts,
      ghostLayers,
    }
  },
}

/**
 * Macro for Proposition I.3: Cut off from the greater a part equal to the less.
 *
 * Inputs: [cutPointId, targetPointId, segFromId, segToId]
 *   - cutPointId: start of the greater segment (where to cut)
 *   - targetPointId: end of the greater segment (direction to cut along)
 *   - segFromId, segToId: endpoints of the lesser segment (length to copy)
 *
 * Output: 1 point + 1 fact
 *   - Point on ray cutPoint→targetPoint at distance |segFrom-segTo| from cutPoint
 *   - Fact: dist(cutPoint, result) = dist(segFrom, segTo) with citation { type: 'prop', propId: 3 }
 *
 * When cutPoint coincides with segFrom, the I.2 transfer is skipped for state
 * modification (optimization), but I.2 is still called for ghost layer computation
 * so the full dependency chain is visible even in degenerate cases.
 */
const MACRO_PROP_3: MacroDef = {
  propId: 3,
  label: 'Cut off equal (I.3)',
  inputCount: 4,
  inputLabels: ['Start of greater', 'End of greater', 'Start of less', 'End of less'],
  inputToGivenIds: ['pt-A', 'pt-B', 'pt-C', 'pt-D'],
  execute(
    state: ConstructionState,
    inputPointIds: string[],
    candidates: IntersectionCandidate[],
    factStore: FactStore,
    atStep: number,
    extendSegments: boolean = false,
    outputLabels?: Record<string, string>,
  ): MacroResult {
    const [cutId, targetId, segFromId, segToId] = inputPointIds
    const addedElements: ConstructionElement[] = []
    let currentState = state
    let currentCandidates = [...candidates]
    const allNewFacts: EqualityFact[] = []

    const cutPoint = getPoint(currentState, cutId)
    const targetPoint = getPoint(currentState, targetId)
    const segFrom = getPoint(currentState, segFromId)
    const segTo = getPoint(currentState, segToId)
    if (!cutPoint || !targetPoint || !segFrom || !segTo) {
      return { state: currentState, candidates: currentCandidates, addedElements, newFacts: allNewFacts, ghostLayers: [] }
    }

    // Optimization: skip I.2 state modification if cutPoint coincides with segFrom
    const cdx = cutPoint.x - segFrom.x
    const cdy = cutPoint.y - segFrom.y
    const coincident = Math.sqrt(cdx * cdx + cdy * cdy) < 1e-9

    // Always call I.2 to get ghost layers (even in coincident/degenerate case).
    // When coincident, use a throwaway factStore so we don't pollute the real one.
    const i2Result = MACRO_PROP_2.execute(
      currentState, [cutId, segFromId, segToId],
      currentCandidates, coincident ? createFactStore() : factStore,
      atStep, extendSegments,
    )
    const i2GhostLayers = i2Result.ghostLayers
    const i2AddedElements = i2Result.addedElements

    if (!coincident) {
      // Use I.2's state modifications for the actual construction
      currentState = i2Result.state
      currentCandidates = i2Result.candidates
      addedElements.push(...i2Result.addedElements)
      allNewFacts.push(...i2Result.newFacts)
    }

    // Compute result position: point on ray cutPoint→targetPoint at distance |segFrom-segTo|
    const radius = Math.sqrt((segFrom.x - segTo.x) ** 2 + (segFrom.y - segTo.y) ** 2)
    let dirX = targetPoint.x - cutPoint.x
    let dirY = targetPoint.y - cutPoint.y
    const dirLen = Math.sqrt(dirX * dirX + dirY * dirY)
    if (dirLen < 1e-9) {
      dirX = 0
      dirY = 1
    } else {
      dirX /= dirLen
      dirY /= dirLen
    }

    const resultX = cutPoint.x + radius * dirX
    const resultY = cutPoint.y + radius * dirY

    // Add result point
    const ptResult = addPoint(currentState, resultX, resultY, 'intersection', outputLabels?.result)
    currentState = ptResult.state
    addedElements.push(ptResult.point)

    // Add fact: dist(cutPoint, result) = dist(segFrom, segTo)
    const resultId = ptResult.point.id
    const resultLabel = ptResult.point.label
    const cutLabel = cutPoint.label
    const segFromLabel = segFrom.label
    const segToLabel = segTo.label

    const left = distancePair(cutId, resultId)
    const right = distancePair(segFromId, segToId)
    allNewFacts.push(...addFact(
      factStore, left, right,
      { type: 'prop', propId: 3 },
      `${cutLabel}${resultLabel} = ${segFromLabel}${segToLabel}`,
      `I.3: cut off from ${cutLabel}${targetPoint.label} a part equal to ${segFromLabel}${segToLabel}`,
      atStep,
    ))

    // ── Ghost geometry ──
    const ghostElements: GhostElement[] = []
    const childGhostLayers: GhostLayer[] = []
    let ghostColorIndex = 0

    // I.2's output elements → ghost at depth 1 (showing the transferred segment)
    // Use i2Result.state to resolve endpoints (has I.2's added elements even in coincident case)
    for (const el of i2AddedElements) {
      const color = BYRNE_CYCLE[ghostColorIndex++ % 3]
      if (el.kind === 'point') {
        ghostElements.push({ kind: 'point', x: el.x, y: el.y, label: el.label, color })
      } else if (el.kind === 'segment') {
        const from = getPoint(i2Result.state, el.fromId)
        const to = getPoint(i2Result.state, el.toId)
        if (from && to) {
          ghostElements.push({ kind: 'segment', x1: from.x, y1: from.y, x2: to.x, y2: to.y, color })
        }
      }
    }

    // I.2's internal ghost layers → depth incremented by 1
    for (const gl of i2GhostLayers) {
      childGhostLayers.push({ ...gl, depth: gl.depth + 1 })
    }

    // Ghost circle at cutPoint with radius = |segFrom-segTo|
    ghostElements.push({
      kind: 'circle',
      cx: cutPoint.x, cy: cutPoint.y,
      r: radius,
      color: BYRNE_CYCLE[ghostColorIndex++ % 3],
    })

    // Ghost result point (intersection of circle with ray cutPoint→targetPoint)
    ghostElements.push({
      kind: 'point',
      x: resultX, y: resultY,
      label: ptResult.point.label,
      color: BYRNE_CYCLE[ghostColorIndex++ % 3],
    })

    const ghostLayers: GhostLayer[] = []
    if (ghostElements.length > 0) {
      ghostLayers.push({ propId: 3, depth: 1, atStep: 0, elements: ghostElements })
    }
    ghostLayers.push(...childGhostLayers)

    return {
      state: currentState,
      candidates: currentCandidates,
      addedElements,
      newFacts: allNewFacts,
      ghostLayers,
    }
  },
}

export const MACRO_REGISTRY: Record<number, MacroDef> = {
  1: MACRO_PROP_1,
  2: MACRO_PROP_2,
  3: MACRO_PROP_3,
}
