/**
 * Generic ghost geometry computation via proposition step replay.
 *
 * Instead of hand-writing ghost geometry per macro, this module replays
 * the source proposition's steps in a lightweight mini-construction and
 * converts all created elements to GhostElements. For nested macro steps,
 * it recurses at depth+1 — automatically showing the full dependency chain.
 */
import type {
  ConstructionState,
  IntersectionCandidate,
  GhostElement,
  GhostLayer,
} from '../types'
import { needsExtendedSegments } from '../types'
import { initializeGiven, addSegment, addCircle, addPoint, getPoint, skipPointLabel } from './constructionState'
import { findNewIntersections, isCandidateBeyondPoint } from './intersections'
import { resolveSelector } from './selectors'
import { MACRO_REGISTRY } from './macros'
import { createFactStore } from './factStore'
import { PROP_REGISTRY } from '../propositions/registry'

/**
 * Compute ghost geometry for a macro invocation by replaying the source
 * proposition's steps.
 *
 * @param propId       Which proposition this macro implements
 * @param inputPointIds Actual point IDs from the parent construction
 * @param parentState  Parent construction state (to look up input point positions)
 * @param atStep       Step index in the parent construction (for GhostLayer.atStep)
 * @param depth        Ghost depth level (1 = direct dependency, 2 = dependency's dependency)
 * @returns GhostLayer[] — one layer at `depth` plus any recursive layers at depth+1, etc.
 */
export function computeMacroGhost(
  propId: number,
  inputPointIds: string[],
  parentState: ConstructionState,
  atStep: number,
  depth: number = 1,
): GhostLayer[] {
  const propDef = PROP_REGISTRY[propId]
  const macroDef = MACRO_REGISTRY[propId]
  if (!propDef || !macroDef) return []

  // ── Map input point positions to the prop's given point IDs ──
  // macroDef.inputToGivenIds[i] is the given point ID that inputPointIds[i] maps to
  const positionMap = new Map<string, { x: number; y: number }>()
  for (let i = 0; i < inputPointIds.length; i++) {
    const givenId = macroDef.inputToGivenIds[i]
    if (!givenId) continue
    const actualPoint = getPoint(parentState, inputPointIds[i])
    if (actualPoint) {
      positionMap.set(givenId, { x: actualPoint.x, y: actualPoint.y })
    }
  }

  // Rebuild given elements with mapped positions
  const givenElements = propDef.givenElements.map(el => {
    if (el.kind === 'point' && positionMap.has(el.id)) {
      const pos = positionMap.get(el.id)!
      return { ...el, x: pos.x, y: pos.y }
    }
    return el
  })

  // ── Mini-replay of the prop's steps (geometry only, no fact derivation) ──
  let state = initializeGiven(givenElements)
  let candidates: IntersectionCandidate[] = []
  const factStore = createFactStore()
  const ghostElements: GhostElement[] = []
  const childGhostLayers: GhostLayer[] = []
  const extendSegments = needsExtendedSegments(propDef)

  for (const step of propDef.steps) {
    const expected = step.expected

    if (expected.type === 'straightedge') {
      const result = addSegment(state, expected.fromId, expected.toId)
      state = result.state
      const newCands = findNewIntersections(state, result.segment, candidates, extendSegments)
      candidates = [...candidates, ...newCands]

      // Convert to ghost segment
      const from = getPoint(state, expected.fromId)
      const to = getPoint(state, expected.toId)
      if (from && to) {
        ghostElements.push({
          kind: 'segment',
          x1: from.x, y1: from.y,
          x2: to.x, y2: to.y,
          color: result.segment.color,
        })
      }
    } else if (expected.type === 'compass') {
      const result = addCircle(state, expected.centerId, expected.radiusPointId)
      state = result.state
      const newCands = findNewIntersections(state, result.circle, candidates, extendSegments)
      candidates = [...candidates, ...newCands]

      // Convert to ghost circle
      const center = getPoint(state, expected.centerId)
      const radiusPt = getPoint(state, expected.radiusPointId)
      if (center && radiusPt) {
        const r = Math.sqrt((center.x - radiusPt.x) ** 2 + (center.y - radiusPt.y) ** 2)
        ghostElements.push({
          kind: 'circle',
          cx: center.x, cy: center.y,
          r,
          color: result.circle.color,
        })
      }
    } else if (expected.type === 'intersection') {
      // Resolve element selectors to IDs
      const resolvedA = expected.ofA != null ? resolveSelector(expected.ofA, state) : null
      const resolvedB = expected.ofB != null ? resolveSelector(expected.ofB, state) : null

      let matchingCandidate: IntersectionCandidate | undefined
      if (resolvedA && resolvedB) {
        matchingCandidate = candidates.find(c => {
          const matches =
            (c.ofA === resolvedA && c.ofB === resolvedB) ||
            (c.ofA === resolvedB && c.ofB === resolvedA)
          if (!matches) return false
          if (expected.beyondId) {
            return isCandidateBeyondPoint(c, expected.beyondId, c.ofA, c.ofB, state)
          }
          // When no beyondId, pick highest-Y candidate
          const hasHigher = candidates.some(other =>
            other !== c &&
            ((other.ofA === resolvedA && other.ofB === resolvedB) ||
             (other.ofA === resolvedB && other.ofB === resolvedA)) &&
            other.y > c.y,
          )
          return !hasHigher
        })
      }

      if (matchingCandidate) {
        const result = addPoint(state, matchingCandidate.x, matchingCandidate.y, 'intersection', expected.label)
        state = result.state
        candidates = candidates.filter(
          c => !(Math.abs(c.x - matchingCandidate!.x) < 0.001 && Math.abs(c.y - matchingCandidate!.y) < 0.001),
        )

        ghostElements.push({
          kind: 'point',
          x: matchingCandidate.x,
          y: matchingCandidate.y,
          label: result.point.label,
          color: result.point.color,
        })

        // Synthesize a production segment for Post.2 extensions (beyondId)
        if (expected.beyondId) {
          const beyondPt = getPoint(state, expected.beyondId)
          if (beyondPt) {
            // Find the parent segment's color
            let segColor = '#888'
            for (const id of [resolvedA, resolvedB]) {
              if (id) {
                const el = state.elements.find(e => e.id === id)
                if (el && el.kind === 'segment') {
                  segColor = el.color
                  break
                }
              }
            }
            ghostElements.push({
              kind: 'segment',
              x1: beyondPt.x, y1: beyondPt.y,
              x2: matchingCandidate.x, y2: matchingCandidate.y,
              color: segColor,
              isProduction: true,
            })
          }
        }
      } else {
        // Keep label indices stable even if intersection not found
        state = skipPointLabel(state, expected.label)
      }
    } else if (expected.type === 'macro') {
      // Execute the macro to update state (needed for subsequent steps)
      const innerMacro = MACRO_REGISTRY[expected.propId]
      if (innerMacro) {
        const result = innerMacro.execute(
          state,
          expected.inputPointIds,
          candidates,
          factStore,
          atStep,
          extendSegments,
          expected.outputLabels,
        )
        state = result.state
        candidates = result.candidates

        // Convert macro's output elements to ghost at current depth
        for (const el of result.addedElements) {
          if (el.kind === 'point') {
            ghostElements.push({ kind: 'point', x: el.x, y: el.y, label: el.label, color: el.color })
          } else if (el.kind === 'segment') {
            const from = getPoint(state, el.fromId)
            const to = getPoint(state, el.toId)
            if (from && to) {
              ghostElements.push({
                kind: 'segment',
                x1: from.x, y1: from.y,
                x2: to.x, y2: to.y,
                color: el.color,
              })
            }
          }
        }

        // Recursively compute ghost for the inner macro at depth+1
        const innerGhosts = computeMacroGhost(
          expected.propId,
          expected.inputPointIds,
          state,
          atStep,
          depth + 1,
        )
        childGhostLayers.push(...innerGhosts)
      }
    }
  }

  // Build ghost layers: this prop's elements at current depth, plus children
  const layers: GhostLayer[] = []
  if (ghostElements.length > 0) {
    layers.push({ propId, depth, atStep, elements: ghostElements })
  }
  layers.push(...childGhostLayers)

  return layers
}
