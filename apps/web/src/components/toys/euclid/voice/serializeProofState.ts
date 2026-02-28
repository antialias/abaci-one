/**
 * Serialize construction state and proof facts into text for voice context.
 */

import type {
  ConstructionState,
  ConstructionPoint,
  ConstructionCircle,
  ConstructionSegment,
  ActiveTool,
  CompassPhase,
  StraightedgePhase,
  ExtendPhase,
  MacroPhase,
  PropositionStep,
} from '../types'
import type { ProofFact } from '../engine/facts'
import { isAngleFact } from '../engine/facts'
import {
  getPoint,
  getRadius,
  getAllPoints,
  getAllCircles,
  getAllSegments,
} from '../engine/constructionState'
import {
  circleCircleIntersections,
  circleSegmentIntersections,
  segmentSegmentIntersection,
} from '../engine/intersections'

/**
 * Convert proof facts to a numbered list suitable for voice/text injection.
 *
 * Example output:
 *   1. CA = AB — Def.15: C on circle centered A through B
 *   2. CB = AB — Def.15: C on circle centered B through A
 */
export function serializeProofFacts(facts: ProofFact[]): string {
  if (facts.length === 0) return 'No facts proven yet.'

  return facts
    .map((fact, i) => {
      const num = i + 1
      return `${num}. ${fact.statement} — ${fact.justification}`
    })
    .join('\n')
}

/**
 * Convert construction state to a concise summary.
 *
 * Example output:
 *   Points: A (given), B (given), C (intersection)
 *   Segments: AB
 *   Circles: 2 (centered at A, B)
 */
export function serializeConstructionState(state: ConstructionState): string {
  const points: string[] = []
  const segments: string[] = []
  const circles: string[] = []

  for (const el of state.elements) {
    switch (el.kind) {
      case 'point':
        points.push(`${el.label} (${el.origin})`)
        break
      case 'segment':
        segments.push(`${el.fromId.replace('pt-', '')}${el.toId.replace('pt-', '')}`)
        break
      case 'circle': {
        const center = el.centerId.replace('pt-', '')
        circles.push(`centered at ${center}`)
        break
      }
    }
  }

  const lines: string[] = []
  if (points.length > 0) lines.push(`Points: ${points.join(', ')}`)
  if (segments.length > 0) lines.push(`Segments: ${segments.join(', ')}`)
  if (circles.length > 0) lines.push(`Circles: ${circles.length} (${circles.join('; ')})`)

  return lines.length > 0 ? lines.join('\n') : 'Empty construction.'
}

/**
 * Build a complete proof state summary combining construction + facts.
 */
export function serializeFullProofState(
  state: ConstructionState,
  facts: ProofFact[]
): string {
  const construction = serializeConstructionState(state)
  const provenFacts = serializeProofFacts(facts)

  return `=== Current Construction ===\n${construction}\n\n=== Proven Facts ===\n${provenFacts}`
}

// ── Rich construction graph serializer ────────────────────────────

/** Looser tolerance for intersection inference (vs 0.001 for exact computation) */
const MATCH_TOLERANCE = 0.01

/** Human-readable element description for intersection inference */
function describeElement(
  state: ConstructionState,
  id: string
): string {
  const circles = getAllCircles(state)
  const segments = getAllSegments(state)

  const circle = circles.find((c) => c.id === id)
  if (circle) {
    const center = getPoint(state, circle.centerId)
    const rp = getPoint(state, circle.radiusPointId)
    const cLabel = center?.label ?? circle.centerId
    const rpLabel = rp?.label ?? circle.radiusPointId
    return `circle(${cLabel}, r=${cLabel}${rpLabel})`
  }

  const segment = segments.find((s) => s.id === id)
  if (segment) {
    const from = getPoint(state, segment.fromId)
    const to = getPoint(state, segment.toId)
    return `seg ${from?.label ?? segment.fromId}—${to?.label ?? segment.toId}`
  }

  return id
}

/**
 * For a point with origin 'intersection', infer which elements produced it
 * by testing its coordinates against all circle-circle, circle-segment,
 * and segment-segment intersection pairs.
 */
function inferIntersectionParents(
  state: ConstructionState,
  pt: ConstructionPoint
): string | null {
  const circles = getAllCircles(state)
  const segments = getAllSegments(state)
  const matches: string[] = []

  // Circle-circle
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      const c1 = circles[i]
      const c2 = circles[j]
      const ctr1 = getPoint(state, c1.centerId)
      const ctr2 = getPoint(state, c2.centerId)
      const r1 = getRadius(state, c1.id)
      const r2 = getRadius(state, c2.id)
      if (!ctr1 || !ctr2 || r1 <= 0 || r2 <= 0) continue
      const pts = circleCircleIntersections(ctr1.x, ctr1.y, r1, ctr2.x, ctr2.y, r2)
      if (pts.some((p) => Math.abs(p.x - pt.x) < MATCH_TOLERANCE && Math.abs(p.y - pt.y) < MATCH_TOLERANCE)) {
        matches.push(`${describeElement(state, c1.id)} ∩ ${describeElement(state, c2.id)}`)
      }
    }
  }

  // Circle-segment
  for (const c of circles) {
    const ctr = getPoint(state, c.centerId)
    const r = getRadius(state, c.id)
    if (!ctr || r <= 0) continue
    for (const s of segments) {
      const from = getPoint(state, s.fromId)
      const to = getPoint(state, s.toId)
      if (!from || !to) continue
      const pts = circleSegmentIntersections(ctr.x, ctr.y, r, from.x, from.y, to.x, to.y)
      if (pts.some((p) => Math.abs(p.x - pt.x) < MATCH_TOLERANCE && Math.abs(p.y - pt.y) < MATCH_TOLERANCE)) {
        matches.push(`${describeElement(state, c.id)} ∩ ${describeElement(state, s.id)}`)
      }
    }
  }

  // Segment-segment
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const s1 = segments[i]
      const s2 = segments[j]
      const f1 = getPoint(state, s1.fromId)
      const t1 = getPoint(state, s1.toId)
      const f2 = getPoint(state, s2.fromId)
      const t2 = getPoint(state, s2.toId)
      if (!f1 || !t1 || !f2 || !t2) continue
      const pts = segmentSegmentIntersection(f1.x, f1.y, t1.x, t1.y, f2.x, f2.y, t2.x, t2.y)
      if (pts.some((p) => Math.abs(p.x - pt.x) < MATCH_TOLERANCE && Math.abs(p.y - pt.y) < MATCH_TOLERANCE)) {
        matches.push(`${describeElement(state, s1.id)} ∩ ${describeElement(state, s2.id)}`)
      }
    }
  }

  return matches.length > 0 ? matches.join(' OR ') : null
}

/**
 * Produce a rich text representation of the construction graph.
 *
 * Unlike `serializeConstructionState()` (used for initial mode instructions),
 * this includes full coordinates, colors, and intersection provenance —
 * designed for live mid-call context updates.
 */
export function serializeConstructionGraph(state: ConstructionState): string {
  const points = getAllPoints(state)
  const segments = getAllSegments(state)
  const circles = getAllCircles(state)

  const lines: string[] = ['=== CONSTRUCTION GRAPH ===']

  // Points
  lines.push(`POINTS (${points.length}):`)
  for (const pt of points) {
    let line = `  ${pt.label} (${pt.origin}) at (${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}) [color: ${pt.color}]`
    if (pt.origin === 'intersection') {
      const parents = inferIntersectionParents(state, pt)
      if (parents) {
        line += `\n    → intersection of: ${parents}`
      }
    }
    lines.push(line)
  }

  // Segments
  lines.push(`\nSEGMENTS (${segments.length}):`)
  for (const seg of segments) {
    const from = getPoint(state, seg.fromId)
    const to = getPoint(state, seg.toId)
    const fromLabel = from?.label ?? seg.fromId
    const toLabel = to?.label ?? seg.toId
    lines.push(`  ${seg.id}: ${fromLabel}—${toLabel} [${seg.origin}, color: ${seg.color}]`)
  }

  // Circles
  lines.push(`\nCIRCLES (${circles.length}):`)
  for (const circ of circles) {
    const center = getPoint(state, circ.centerId)
    const rp = getPoint(state, circ.radiusPointId)
    const r = getRadius(state, circ.id)
    const centerLabel = center?.label ?? circ.centerId
    const rpLabel = rp?.label ?? circ.radiusPointId
    lines.push(`  ${circ.id}: center=${centerLabel}, radius-point=${rpLabel}, r=${r.toFixed(2)} [color: ${circ.color}]`)
  }

  return lines.join('\n')
}

// ── Tool state serializer ─────────────────────────────────────────

/** Resolve a point ID like "pt-A" to label "A" using construction state */
function pointLabel(state: ConstructionState, id: string): string {
  const pt = getPoint(state, id)
  return pt?.label ?? id.replace('pt-', '')
}

export interface ToolStateInfo {
  activeTool: ActiveTool
  compassPhase: CompassPhase
  straightedgePhase: StraightedgePhase
  extendPhase: ExtendPhase
  macroPhase: MacroPhase
  /** Point being dragged in move tool (null if not dragging) */
  dragPointId: string | null
}

/**
 * Serialize the current tool state into human-readable text for the voice agent.
 *
 * Covers every interaction phase so Euclid knows exactly what the student
 * is doing at any moment — which tool is selected, what sub-step of the
 * gesture they're in, and which construction elements are involved.
 */
export function serializeToolState(
  info: ToolStateInfo,
  state: ConstructionState,
  currentStep: number,
  steps: PropositionStep[],
  isComplete: boolean,
): string {
  const lines: string[] = ['=== TOOL STATE ===']

  // Current step context
  if (!isComplete && currentStep < steps.length) {
    const step = steps[currentStep]
    lines.push(`Current step (${currentStep + 1}/${steps.length}): "${step.instruction}"`)
    if (step.citation) lines.push(`  Citation: ${step.citation}`)
  } else if (isComplete) {
    lines.push('Construction is COMPLETE — student is in exploration mode.')
  }

  lines.push(`Active tool: ${info.activeTool}`)

  switch (info.activeTool) {
    case 'compass': {
      const cp = info.compassPhase
      switch (cp.tag) {
        case 'idle':
          lines.push('  Compass: idle — no center selected yet')
          break
        case 'center-set':
          lines.push(`  Compass: center selected at ${pointLabel(state, cp.centerId)} — reaching for the radius-defining point`)
          break
        case 'radius-set':
          lines.push(`  Compass: center=${pointLabel(state, cp.centerId)}, radius-point=${pointLabel(state, cp.radiusPointId)}, r=${cp.radius.toFixed(2)} — ready to sweep`)
          break
        case 'sweeping':
          lines.push(`  Compass: SWEEPING circle center=${pointLabel(state, cp.centerId)}, radius-point=${pointLabel(state, cp.radiusPointId)}, r=${cp.radius.toFixed(2)}, swept=${(Math.abs(cp.cumulativeSweep) * 180 / Math.PI).toFixed(0)}°`)
          break
      }
      break
    }
    case 'straightedge': {
      const sp = info.straightedgePhase
      switch (sp.tag) {
        case 'idle':
          lines.push('  Straightedge: idle — no endpoint selected yet')
          break
        case 'from-set':
          lines.push(`  Straightedge: first endpoint=${pointLabel(state, sp.fromId)} — reaching for the second endpoint`)
          break
      }
      break
    }
    case 'extend': {
      const ep = info.extendPhase
      switch (ep.tag) {
        case 'idle':
          lines.push('  Extend: idle — no base segment selected yet')
          break
        case 'base-set':
          lines.push(`  Extend: base endpoint=${pointLabel(state, ep.baseId)} — selecting the through-point to define direction`)
          break
        case 'extending':
          lines.push(`  Extend: extending segment from ${pointLabel(state, ep.baseId)} through ${pointLabel(state, ep.throughId)}`)
          break
      }
      break
    }
    case 'macro': {
      const mp = info.macroPhase
      switch (mp.tag) {
        case 'idle':
          lines.push('  Proposition tool: idle')
          break
        case 'choosing':
          lines.push('  Proposition tool: picker is open — student is choosing which prior proposition to apply')
          break
        case 'selecting': {
          const needed = mp.inputLabels.length
          const selected = mp.selectedPointIds.length
          const selectedLabels = mp.selectedPointIds.map((id) => pointLabel(state, id)).join(', ')
          const remainingLabels = mp.inputLabels.slice(selected).join(', ')
          lines.push(`  Proposition tool: applying Prop I.${mp.propId}`)
          lines.push(`    Input points needed: ${mp.inputLabels.join(', ')}`)
          lines.push(`    Selected so far (${selected}/${needed}): ${selectedLabels || '(none)'}`)
          if (selected < needed) {
            lines.push(`    Waiting for: ${remainingLabels}`)
          }
          break
        }
      }
      break
    }
    case 'move': {
      if (info.dragPointId) {
        const label = pointLabel(state, info.dragPointId)
        // Describe the point's significance
        const pt = getPoint(state, info.dragPointId)
        const origin = pt?.origin ?? 'unknown'
        lines.push(`  Move: DRAGGING point ${label} (${origin})`)
        // Look for this point in step descriptions for significance
        const mentioningSteps = steps.filter((s) =>
          s.instruction.includes(label)
        )
        if (mentioningSteps.length > 0) {
          lines.push(`    Significance: appears in steps — ${mentioningSteps.map((s) => `"${s.instruction}"`).join(', ')}`)
        }
      } else {
        lines.push('  Move: idle — student can drag given points to explore')
      }
      break
    }
    case 'point':
      lines.push('  Point tool: student is placing a free point')
      break
  }

  return lines.join('\n')
}

/**
 * Create a compact fingerprint of the current tool state for change detection.
 */
export function toolStateFingerprint(info: ToolStateInfo): string {
  const parts: string[] = [info.activeTool]

  switch (info.activeTool) {
    case 'compass': {
      const cp = info.compassPhase
      parts.push(cp.tag)
      if (cp.tag === 'center-set') parts.push(cp.centerId)
      if (cp.tag === 'radius-set') parts.push(cp.centerId, cp.radiusPointId)
      if (cp.tag === 'sweeping') parts.push(cp.centerId, cp.radiusPointId, String(Math.round(cp.cumulativeSweep * 10)))
      break
    }
    case 'straightedge': {
      const sp = info.straightedgePhase
      parts.push(sp.tag)
      if (sp.tag === 'from-set') parts.push(sp.fromId)
      break
    }
    case 'extend': {
      const ep = info.extendPhase
      parts.push(ep.tag)
      if (ep.tag === 'base-set') parts.push(ep.baseId)
      if (ep.tag === 'extending') parts.push(ep.baseId, ep.throughId)
      break
    }
    case 'macro': {
      const mp = info.macroPhase
      parts.push(mp.tag)
      if (mp.tag === 'selecting') parts.push(String(mp.propId), ...mp.selectedPointIds)
      break
    }
    case 'move':
      parts.push(info.dragPointId ?? 'idle')
      break
  }

  return parts.join(':')
}
