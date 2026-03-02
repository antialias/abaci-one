/**
 * Pure preview geometry functions for macro tool.
 *
 * These compute result-focused preview geometry from raw {x,y} positions — no
 * construction state, no fact store, no side effects. The goal is to show
 * the student what the macro WILL PRODUCE, not the internal proof steps.
 */

import type { GhostElement } from '../types'
import { BYRNE_CYCLE } from '../types'
import { computeEquilateralApex, computeDirectionVector } from './geometryHelpers'

export interface MacroPreviewResult {
  /** Supporting ghost elements (construction circles that explain the result) */
  ghostElements: GhostElement[]
  /** Output geometry (result segments, points) — rendered slightly more opaque */
  resultElements: GhostElement[]
}

type Pt = { x: number; y: number }

/**
 * Preview for I.1: Equilateral triangle on segment A→B.
 * Shows the two construction circles + the resulting triangle sides and apex.
 */
export function previewProp1(inputs: Pt[]): MacroPreviewResult | null {
  if (inputs.length < 2) return null
  const [pA, pB] = inputs

  const radius = Math.sqrt((pA.x - pB.x) ** 2 + (pA.y - pB.y) ** 2)
  if (radius < 1e-9) return null

  const apex = computeEquilateralApex(pA, pB)
  if (!apex) return null

  const ghostElements: GhostElement[] = [
    { kind: 'circle', cx: pA.x, cy: pA.y, r: radius, color: BYRNE_CYCLE[0] },
    { kind: 'circle', cx: pB.x, cy: pB.y, r: radius, color: BYRNE_CYCLE[1] },
  ]

  const resultElements: GhostElement[] = [
    { kind: 'point', x: apex.x, y: apex.y, label: '', color: BYRNE_CYCLE[2] },
    { kind: 'segment', x1: apex.x, y1: apex.y, x2: pA.x, y2: pA.y, color: BYRNE_CYCLE[0] },
    { kind: 'segment', x1: apex.x, y1: apex.y, x2: pB.x, y2: pB.y, color: BYRNE_CYCLE[1] },
  ]

  return { ghostElements, resultElements }
}

/**
 * Preview for I.2: Transfer distance to a given point.
 * Inputs: [target (A), segFrom (B), segTo (C)].
 *
 * Shows the signature I.2 construction elements so the student recognizes it:
 * - Equilateral triangle apex D on segment AB (the I.1 sub-construction)
 * - Segments DA and DB (triangle sides)
 * - Circle at B through C (source distance being measured)
 * - The result segment from A to the output point F
 *
 * The output point F lies on ray D→A extended past A, at a distance from D
 * equal to |DB| + |BC| (matching the full Euclid proof construction).
 */
export function previewProp2(inputs: Pt[]): MacroPreviewResult | null {
  if (inputs.length < 3) return null
  const [target, segFrom, segTo] = inputs

  const dist = Math.sqrt((segFrom.x - segTo.x) ** 2 + (segFrom.y - segTo.y) ** 2)
  if (dist < 1e-9) return null

  const abRadius = Math.sqrt((target.x - segFrom.x) ** 2 + (target.y - segFrom.y) ** 2)

  // Equilateral triangle apex D on segment target→segFrom
  const apexD = abRadius > 1e-9
    ? computeEquilateralApex(target, segFrom)
    : null

  if (!apexD) {
    // Degenerate: target = segFrom, just show a circle at target
    const dir = computeDirectionVector(target, segFrom)
    const outX = target.x + dist * dir.x
    const outY = target.y + dist * dir.y
    return {
      ghostElements: [
        { kind: 'circle', cx: target.x, cy: target.y, r: dist, color: BYRNE_CYCLE[1] },
      ],
      resultElements: [
        { kind: 'point', x: outX, y: outY, label: '', color: BYRNE_CYCLE[2] },
        { kind: 'segment', x1: target.x, y1: target.y, x2: outX, y2: outY, color: BYRNE_CYCLE[2] },
      ],
    }
  }

  // Direction D→B for "produce DB to E"
  const dbDir = computeDirectionVector(apexD, segFrom)
  // E = point on circle(B, |BC|) along ray D→B past B
  const ptE = { x: segFrom.x + dist * dbDir.x, y: segFrom.y + dist * dbDir.y }

  // Circle at D through E (radius |DE|)
  const deRadius = Math.sqrt((apexD.x - ptE.x) ** 2 + (apexD.y - ptE.y) ** 2)

  // Direction D→A for "produce DA to F"
  const daDir = computeDirectionVector(apexD, target)
  // F = point on circle(D, |DE|) along ray D→A past A
  const ptF = { x: apexD.x + deRadius * daDir.x, y: apexD.y + deRadius * daDir.y }

  // Ghost: equilateral triangle + construction circles + result-radius circle at target
  const ghostElements: GhostElement[] = [
    // Triangle sides DA, DB
    { kind: 'segment', x1: apexD.x, y1: apexD.y, x2: target.x, y2: target.y, color: BYRNE_CYCLE[0] },
    { kind: 'segment', x1: apexD.x, y1: apexD.y, x2: segFrom.x, y2: segFrom.y, color: BYRNE_CYCLE[1] },
    // Apex point D
    { kind: 'point', x: apexD.x, y: apexD.y, label: '', color: BYRNE_CYCLE[2] },
    // Circle at B through C (source distance)
    { kind: 'circle', cx: segFrom.x, cy: segFrom.y, r: dist, color: BYRNE_CYCLE[1] },
    // Big circle at D through E (transfer circle)
    { kind: 'circle', cx: apexD.x, cy: apexD.y, r: deRadius, color: BYRNE_CYCLE[0] },
    // Circle at target showing the result length — "this distance will appear here"
    { kind: 'circle', cx: target.x, cy: target.y, r: dist, color: BYRNE_CYCLE[2] },
  ]

  // Result: the transferred segment from A to F
  const resultElements: GhostElement[] = [
    { kind: 'point', x: ptF.x, y: ptF.y, label: '', color: BYRNE_CYCLE[2] },
    { kind: 'segment', x1: target.x, y1: target.y, x2: ptF.x, y2: ptF.y, color: BYRNE_CYCLE[2] },
  ]

  return { ghostElements, resultElements }
}

/**
 * Preview for I.3: Cut off from the greater a part equal to the less.
 * Inputs: [cutPoint, targetPoint, segFrom, segTo].
 *
 * I.3 internally uses I.2 to transfer |segFrom→segTo| to the cutPoint,
 * then draws a circle at cutPoint to find where to cut along the ray.
 * The preview shows the I.2 sub-construction (so the student recognizes it)
 * plus the cutting circle and result point.
 */
export function previewProp3(inputs: Pt[]): MacroPreviewResult | null {
  if (inputs.length < 4) return null
  const [cutPoint, targetPoint, segFrom, segTo] = inputs

  const radius = Math.sqrt((segFrom.x - segTo.x) ** 2 + (segFrom.y - segTo.y) ** 2)
  if (radius < 1e-9) return null

  const cutDir = computeDirectionVector(cutPoint, targetPoint)
  const resultX = cutPoint.x + radius * cutDir.x
  const resultY = cutPoint.y + radius * cutDir.y

  // I.2 sub-construction: transfer |segFrom→segTo| to cutPoint
  // I.3 handles the coincident case by swapping segFrom/segTo, mirroring the macro
  const cdx = cutPoint.x - segFrom.x
  const cdy = cutPoint.y - segFrom.y
  const coincident = Math.sqrt(cdx * cdx + cdy * cdy) < 1e-9
  const i2Inputs = coincident
    ? [cutPoint, segTo, segFrom]
    : [cutPoint, segFrom, segTo]
  const i2Preview = previewProp2(i2Inputs)

  const ghostElements: GhostElement[] = []

  // Include I.2's ghost elements (equilateral triangle, source circle, transfer circle, etc.)
  if (i2Preview) {
    ghostElements.push(...i2Preview.ghostElements)
    // I.2's result elements become ghost-level in I.3 (they're intermediate, not final)
    ghostElements.push(...i2Preview.resultElements)
  }

  // The cutting circle at cutPoint — where the ray intersects gives the result
  ghostElements.push({
    kind: 'circle',
    cx: cutPoint.x,
    cy: cutPoint.y,
    r: radius,
    color: BYRNE_CYCLE[2],
  })

  // Result: the cut point on the ray cutPoint→targetPoint
  const resultElements: GhostElement[] = [
    { kind: 'point', x: resultX, y: resultY, label: '', color: BYRNE_CYCLE[2] },
  ]

  return { ghostElements, resultElements }
}

/** Registry mapping propId → preview function */
export const MACRO_PREVIEW_REGISTRY: Record<number, (inputs: Pt[]) => MacroPreviewResult | null> = {
  1: previewProp1,
  2: previewProp2,
  3: previewProp3,
}
