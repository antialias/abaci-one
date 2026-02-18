import type {
  ConstructionElement,
  PropositionStep,
  PropositionDef,
  ConstructionState,
  IntersectionCandidate,
} from '../types'
import { needsExtendedSegments } from '../types'
import { initializeGiven, addSegment, addCircle, addPoint, skipPointLabel } from './constructionState'
import { createFactStore, addFact } from './factStore'
import type { FactStore } from './factStore'
import type { EqualityFact } from './facts'
import { distancePair } from './facts'
import { findNewIntersections } from './intersections'
import { deriveDef15Facts } from './factDerivation'
import { resolveSelector } from './selectors'
import { isCandidateBeyondPoint } from './intersections'
import { MACRO_REGISTRY } from './macros'
import { PROP_CONCLUSIONS } from '../propositions/prop2Facts'

/**
 * A user action recorded after proposition completion.
 * These are replayed on top of the base construction during drag.
 */
export type PostCompletionAction =
  | { type: 'circle'; centerId: string; radiusPointId: string }
  | { type: 'segment'; fromId: string; toId: string }
  | { type: 'intersection'; ofA: string; ofB: string; which: number }

export interface ReplayResult {
  state: ConstructionState
  factStore: FactStore
  proofFacts: EqualityFact[]
  candidates: IntersectionCandidate[]
}

/**
 * Replay an entire construction from scratch given fresh given elements.
 * Executes all proposition steps in order, derives facts, runs conclusion
 * functions, then replays any post-completion user actions.
 *
 * Used by the drag interaction to recompute the full construction state
 * when given points are moved.
 */
export function replayConstruction(
  givenElements: ConstructionElement[],
  steps: PropositionStep[],
  propDef: PropositionDef,
  extraActions?: PostCompletionAction[],
): ReplayResult {
  let state = initializeGiven(givenElements)
  const factStore = createFactStore()
  let candidates: IntersectionCandidate[] = []
  const proofFacts: EqualityFact[] = []
  const extendSegments = needsExtendedSegments(propDef)

  // Pre-load given facts
  if (propDef.givenFacts) {
    for (const gf of propDef.givenFacts) {
      const left = distancePair(gf.left.a, gf.left.b)
      const right = distancePair(gf.right.a, gf.right.b)
      const newFacts = addFact(
        factStore, left, right,
        { type: 'given' },
        gf.statement,
        'Given',
        -1,
      )
      proofFacts.push(...newFacts)
    }
  }

  // Execute each proposition step
  for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
    const step = steps[stepIdx]
    const expected = step.expected

    if (expected.type === 'straightedge') {
      const result = addSegment(state, expected.fromId, expected.toId)
      state = result.state
      const newCands = findNewIntersections(state, result.segment, candidates, extendSegments)
      candidates = [...candidates, ...newCands]
    } else if (expected.type === 'compass') {
      const result = addCircle(state, expected.centerId, expected.radiusPointId)
      state = result.state
      const newCands = findNewIntersections(state, result.circle, candidates, extendSegments)
      candidates = [...candidates, ...newCands]
    } else if (expected.type === 'intersection') {
      // Find the matching candidate
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
          // When no beyondId, pick highest-Y candidate (matches convention)
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
        const newFacts = deriveDef15Facts(matchingCandidate, result.point.id, state, factStore, stepIdx)
        proofFacts.push(...newFacts)
      } else {
        // Advance label/color indices so subsequent point labels stay stable
        state = skipPointLabel(state, expected.label)
      }
    } else if (expected.type === 'macro') {
      const macroDef = MACRO_REGISTRY[expected.propId]
      if (macroDef) {
        const result = macroDef.execute(
          state,
          expected.inputPointIds,
          candidates,
          factStore,
          stepIdx,
          extendSegments,
          expected.outputLabels,
        )
        state = result.state
        candidates = result.candidates
        proofFacts.push(...result.newFacts)
      }
    }
  }

  // Run conclusion function
  const conclusionFn = PROP_CONCLUSIONS[propDef.id]
  if (conclusionFn) {
    const conclusionFacts = conclusionFn(factStore, state, steps.length)
    proofFacts.push(...conclusionFacts)
  }

  // Replay post-completion user actions
  if (extraActions) {
    for (const action of extraActions) {
      if (action.type === 'circle') {
        const result = addCircle(state, action.centerId, action.radiusPointId)
        state = result.state
        const newCands = findNewIntersections(state, result.circle, candidates, extendSegments)
        candidates = [...candidates, ...newCands]
      } else if (action.type === 'segment') {
        const result = addSegment(state, action.fromId, action.toId)
        state = result.state
        const newCands = findNewIntersections(state, result.segment, candidates, extendSegments)
        candidates = [...candidates, ...newCands]
      } else if (action.type === 'intersection') {
        // Find matching candidate by parent elements and which-index
        const matching = candidates.find(c =>
          ((c.ofA === action.ofA && c.ofB === action.ofB) ||
           (c.ofA === action.ofB && c.ofB === action.ofA)) &&
          c.which === action.which,
        )
        if (matching) {
          const result = addPoint(state, matching.x, matching.y, 'intersection')
          state = result.state
          candidates = candidates.filter(
            c => !(Math.abs(c.x - matching.x) < 0.001 && Math.abs(c.y - matching.y) < 0.001),
          )
          // Derive Def.15 facts for the new intersection point
          const newFacts = deriveDef15Facts(matching, result.point.id, state, factStore, steps.length)
          proofFacts.push(...newFacts)
        } else {
          // Advance label/color indices so subsequent point labels stay stable
          state = skipPointLabel(state)
        }
      }
    }
  }

  return { state, factStore, proofFacts, candidates }
}
