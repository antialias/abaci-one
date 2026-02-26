import type {
  ConstructionElement,
  PropositionStep,
  PropositionDef,
  ConstructionState,
  IntersectionCandidate,
  GhostLayer,
} from '../types'
import { needsExtendedSegments } from '../types'
import {
  initializeGiven,
  addSegment,
  addCircle,
  addPoint,
  skipPointLabel,
} from './constructionState'
import { createFactStore, addFact, addAngleFact } from './factStore'
import type { FactStore } from './factStore'
import type { ProofFact } from './facts'
import { distancePair, angleMeasure } from './facts'
import { findNewIntersections } from './intersections'
import { deriveDef15Facts } from './factDerivation'
import { resolveSelector } from './selectors'
import { isCandidateBeyondPoint } from './intersections'
import { MACRO_REGISTRY } from './macros'

/**
 * A user action recorded after proposition completion.
 * These are replayed on top of the base construction during drag.
 */
export type PostCompletionAction =
  | { type: 'circle'; centerId: string; radiusPointId: string }
  | { type: 'segment'; fromId: string; toId: string }
  | { type: 'intersection'; ofA: string; ofB: string; which: number }
  | { type: 'macro'; propId: number; inputPointIds: string[]; atStep: number }

export interface ReplayResult {
  state: ConstructionState
  factStore: FactStore
  proofFacts: ProofFact[]
  candidates: IntersectionCandidate[]
  ghostLayers: GhostLayer[]
  /** Number of proposition steps that were successfully replayed.
   *  When less than the total step count, the construction broke down
   *  (e.g. an intersection no longer exists). */
  stepsCompleted: number
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
  extraActions?: PostCompletionAction[]
): ReplayResult {
  let state = initializeGiven(givenElements)
  const factStore = createFactStore()
  let candidates: IntersectionCandidate[] = []
  const proofFacts: ProofFact[] = []
  const ghostLayers: GhostLayer[] = []
  const extendSegments = needsExtendedSegments(propDef)

  // Pre-load given facts
  if (propDef.givenFacts) {
    for (const gf of propDef.givenFacts) {
      const left = distancePair(gf.left.a, gf.left.b)
      const right = distancePair(gf.right.a, gf.right.b)
      const newFacts = addFact(factStore, left, right, { type: 'given' }, gf.statement, 'Given', -1)
      proofFacts.push(...newFacts)
    }
  }

  // Pre-load given angle facts
  if (propDef.givenAngleFacts) {
    for (const gaf of propDef.givenAngleFacts) {
      const left = angleMeasure(gaf.left.vertex, gaf.left.ray1, gaf.left.ray2)
      const right = angleMeasure(gaf.right.vertex, gaf.right.ray1, gaf.right.ray2)
      const newFacts = addAngleFact(
        factStore,
        left,
        right,
        { type: 'given' },
        gaf.statement,
        'Given',
        -1
      )
      proofFacts.push(...newFacts)
    }
  }

  // Execute each proposition step
  let stepsCompleted = 0
  for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
    const step = steps[stepIdx]
    const expected = step.expected

    let stepSucceeded = false

    if (expected.type === 'straightedge') {
      const result = addSegment(state, expected.fromId, expected.toId)
      state = result.state
      const newCands = findNewIntersections(state, result.segment, candidates, extendSegments)
      candidates = [...candidates, ...newCands]
      stepSucceeded = true
    } else if (expected.type === 'compass') {
      const result = addCircle(state, expected.centerId, expected.radiusPointId)
      state = result.state
      const newCands = findNewIntersections(state, result.circle, candidates, extendSegments)
      candidates = [...candidates, ...newCands]
      stepSucceeded = true
    } else if (expected.type === 'intersection') {
      // Find the matching candidate
      const resolvedA = expected.ofA != null ? resolveSelector(expected.ofA, state) : null
      const resolvedB = expected.ofB != null ? resolveSelector(expected.ofB, state) : null

      let matchingCandidate: IntersectionCandidate | undefined
      if (resolvedA && resolvedB) {
        const matching = candidates.filter(
          (c) =>
            (c.ofA === resolvedA && c.ofB === resolvedB) ||
            (c.ofA === resolvedB && c.ofB === resolvedA)
        )
        if (matching.length > 0) {
          if (expected.beyondId) {
            matchingCandidate = matching.find((c) =>
              isCandidateBeyondPoint(c, expected.beyondId!, c.ofA, c.ofB, state)
            )
          } else if (expected.label === 'C') {
            const pA = state.elements.find(
              (e) => e.kind === 'point' && e.id === 'pt-A'
            ) as { x: number; y: number } | undefined
            const pB = state.elements.find(
              (e) => e.kind === 'point' && e.id === 'pt-B'
            ) as { x: number; y: number } | undefined
            if (pA && pB) {
              const abx = pB.x - pA.x
              const aby = pB.y - pA.y
              const preferUpper = matching.filter(
                (c) => abx * (c.y - pA.y) - aby * (c.x - pA.x) > 0
              )
              matchingCandidate =
                preferUpper.length > 0 ? preferUpper[0] : matching[0]
            }
          }
          if (!matchingCandidate) {
            // When no beyondId, pick highest-Y candidate for stability.
            matchingCandidate = matching.reduce((best, c) => (c.y > best.y ? c : best), matching[0])
          }
        }
      } else if (expected.ofA == null && expected.ofB == null && candidates.length > 0) {
        // Wildcard intersection (no ofA/ofB specified)
        if (expected.label === 'C') {
          const pA = state.elements.find(
            (e) => e.kind === 'point' && e.id === 'pt-A'
          ) as { x: number; y: number } | undefined
          const pB = state.elements.find(
            (e) => e.kind === 'point' && e.id === 'pt-B'
          ) as { x: number; y: number } | undefined
          if (pA && pB) {
            const abx = pB.x - pA.x
            const aby = pB.y - pA.y
            const preferUpper = candidates.filter(
              (c) => abx * (c.y - pA.y) - aby * (c.x - pA.x) > 0
            )
            matchingCandidate = preferUpper.length > 0 ? preferUpper[0] : candidates[0]
          }
        }
        if (!matchingCandidate) {
          // Fallback: pick highest-Y candidate
          matchingCandidate = candidates.reduce((best, c) => (c.y > best.y ? c : best), candidates[0])
        }
      }

      if (matchingCandidate) {
        const result = addPoint(
          state,
          matchingCandidate.x,
          matchingCandidate.y,
          'intersection',
          expected.label
        )
        state = result.state
        candidates = candidates.filter(
          (c) =>
            !(
              Math.abs(c.x - matchingCandidate!.x) < 0.001 &&
              Math.abs(c.y - matchingCandidate!.y) < 0.001
            )
        )
        const newFacts = deriveDef15Facts(
          matchingCandidate,
          result.point.id,
          state,
          factStore,
          stepIdx
        )
        proofFacts.push(...newFacts)
        stepSucceeded = true
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
          expected.outputLabels
        )
        state = result.state
        candidates = result.candidates
        proofFacts.push(...result.newFacts)
        // Collect ghost layers produced by the macro itself
        for (const gl of result.ghostLayers) {
          ghostLayers.push({ ...gl, atStep: stepIdx })
        }
        stepSucceeded = true
      }
    }

    if (stepSucceeded) stepsCompleted = stepIdx + 1
  }

  // Run conclusion function
  const conclusionFn = propDef.deriveConclusion
  if (conclusionFn) {
    const conclusionFacts = conclusionFn(factStore, state, steps.length)
    proofFacts.push(...conclusionFacts)
  }

  // Replay post-completion user actions (always extend segments in freeform mode)
  if (extraActions) {
    // Recompute candidates with extension enabled for post-completion play
    if (!extendSegments) {
      for (const el of state.elements) {
        if (el.kind === 'point') continue
        const additional = findNewIntersections(state, el, candidates, true)
        candidates = [...candidates, ...additional]
      }
    }

    for (const action of extraActions) {
      if (action.type === 'circle') {
        const result = addCircle(state, action.centerId, action.radiusPointId)
        state = result.state
        const newCands = findNewIntersections(state, result.circle, candidates, true)
        candidates = [...candidates, ...newCands]
      } else if (action.type === 'segment') {
        const result = addSegment(state, action.fromId, action.toId)
        state = result.state
        const newCands = findNewIntersections(state, result.segment, candidates, true)
        candidates = [...candidates, ...newCands]
      } else if (action.type === 'intersection') {
        // Find matching candidate by parent elements and which-index
        const matching = candidates.find(
          (c) =>
            ((c.ofA === action.ofA && c.ofB === action.ofB) ||
              (c.ofA === action.ofB && c.ofB === action.ofA)) &&
            c.which === action.which
        )
        if (matching) {
          const result = addPoint(state, matching.x, matching.y, 'intersection')
          state = result.state
          candidates = candidates.filter(
            (c) => !(Math.abs(c.x - matching.x) < 0.001 && Math.abs(c.y - matching.y) < 0.001)
          )
          // Derive Def.15 facts for the new intersection point
          const newFacts = deriveDef15Facts(
            matching,
            result.point.id,
            state,
            factStore,
            steps.length
          )
          proofFacts.push(...newFacts)
        } else {
          // Advance label/color indices so subsequent point labels stay stable
          state = skipPointLabel(state)
        }
      } else if (action.type === 'macro') {
        const macroDef = MACRO_REGISTRY[action.propId]
        if (macroDef) {
          const macroResult = macroDef.execute(
            state,
            action.inputPointIds,
            candidates,
            factStore,
            action.atStep,
            true // extendSegments: always true for post-completion free-form
          )
          state = macroResult.state
          candidates = macroResult.candidates
          proofFacts.push(...macroResult.newFacts)
          for (const gl of macroResult.ghostLayers) {
            ghostLayers.push({ ...gl, atStep: action.atStep })
          }
        }
      }
    }
  }

  return { state, factStore, proofFacts, candidates, ghostLayers, stepsCompleted }
}
