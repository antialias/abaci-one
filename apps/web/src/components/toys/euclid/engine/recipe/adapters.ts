/**
 * Adapter functions bridging ConstructionRecipe to existing MacroDef,
 * MacroPreviewResult, and GhostLayer interfaces.
 */

import type {
  ConstructionRecipe,
  ConstructionTrace,
  Pt,
  Ref,
  RecipeFact,
  RecipeRegistry,
} from './types'
import { refToPointId } from './types'
import { evaluateRecipe } from './evaluate'
import type { MacroDef, MacroResult, MacroInput } from '../macros'
import type {
  ConstructionState,
  IntersectionCandidate,
  GhostElement,
  GhostLayer,
} from '../../types'
import { BYRNE_CYCLE } from '../../types'
import type { FactStore } from '../factStore'
import { addFact } from '../factStore'
import type { EqualityFact } from '../facts'
import { distancePair } from '../facts'
import { addPoint, addSegment, getPoint } from '../constructionState'
import { findNewIntersections } from '../intersections'
import type { MacroPreviewResult } from '../macroPreview'

// ── recipeToMacroDef ───────────────────────────────────────────────

/**
 * Generate a MacroDef from a ConstructionRecipe.
 * The returned MacroDef has the same interface as the handwritten ones.
 */
export function recipeToMacroDef(recipe: ConstructionRecipe, registry: RecipeRegistry): MacroDef {
  const inputs: MacroInput[] = recipe.inputSlots.map((slot) => ({
    role: slot.role,
    label: slot.label,
    givenId: slot.givenId,
  }))

  return {
    propId: recipe.propId,
    label: recipe.label,
    inputs,
    distinctInputPairs: recipe.distinctInputPairs,
    execute(
      state: ConstructionState,
      inputPointIds: string[],
      candidates: IntersectionCandidate[],
      factStore: FactStore,
      atStep: number,
      extendSegments: boolean = false,
      outputLabels?: Record<string, string>
    ): MacroResult {
      const addedElements: import('../../types').ConstructionElement[] = []
      let currentState = state
      let currentCandidates = [...candidates]
      const allNewFacts: EqualityFact[] = []

      // Resolve input positions
      const inputPositions: Pt[] = []
      for (const pid of inputPointIds) {
        const pt = getPoint(currentState, pid)
        if (!pt) {
          return {
            state: currentState,
            candidates: currentCandidates,
            addedElements,
            newFacts: allNewFacts,
            ghostLayers: [],
          }
        }
        inputPositions.push({ x: pt.x, y: pt.y })
      }

      // Build a ref→pointId mapping from inputs
      const refToId = new Map<Ref, string>()
      for (let i = 0; i < recipe.inputSlots.length; i++) {
        refToId.set(recipe.inputSlots[i].ref, inputPointIds[i])
      }

      // Evaluate recipe
      const trace = evaluateRecipe(recipe, inputPositions, registry)
      if (!trace) {
        return {
          state: currentState,
          candidates: currentCandidates,
          addedElements,
          newFacts: allNewFacts,
          ghostLayers: [],
        }
      }

      // Apply exports to construction state
      const result = applyTraceExports(
        trace,
        recipe,
        currentState,
        currentCandidates,
        refToId,
        inputPointIds,
        extendSegments,
        outputLabels
      )
      currentState = result.state
      currentCandidates = result.candidates
      addedElements.push(...result.addedElements)

      // Apply facts (conclusion-only mode for macro usage)
      const newFacts = applyTraceFacts(recipe, factStore, atStep, refToId, true)
      allNewFacts.push(...newFacts)

      // Build ghost layers
      const ghostLayers = traceToGhostLayers(
        trace,
        recipe,
        1,
        refToId,
        currentState,
        inputPointIds,
        outputLabels
      )

      return {
        state: currentState,
        candidates: currentCandidates,
        addedElements,
        newFacts: allNewFacts,
        ghostLayers,
      }
    },
  }
}

// ── applyTraceExports ──────────────────────────────────────────────

function applyTraceExports(
  trace: ConstructionTrace,
  recipe: ConstructionRecipe,
  state: ConstructionState,
  candidates: IntersectionCandidate[],
  refToId: Map<Ref, string>,
  inputPointIds: string[],
  extendSegments: boolean,
  outputLabels?: Record<string, string>
): {
  state: ConstructionState
  candidates: IntersectionCandidate[]
  addedElements: import('../../types').ConstructionElement[]
} {
  const addedElements: import('../../types').ConstructionElement[] = []
  let currentState = state
  let currentCandidates = [...candidates]

  for (const exp of recipe.exports) {
    if (exp.kind === 'point') {
      const pt = trace.pointMap.get(exp.ref)
      if (!pt) continue
      const label =
        exp.outputLabelKey && outputLabels?.[exp.outputLabelKey]
          ? outputLabels[exp.outputLabelKey]
          : undefined
      const result = addPoint(currentState, pt.x, pt.y, 'intersection', label)
      currentState = result.state
      addedElements.push(result.point)
      refToId.set(exp.ref, result.point.id)
    } else if (exp.kind === 'segment') {
      // Find the segment op to get from/to refs
      const segOp =
        recipe.ops.find((op) => op.kind === 'segment' && op.id === exp.ref) ??
        recipe.degenerateCases
          ?.flatMap((dc) => dc.ops)
          .find((op) => op.kind === 'segment' && op.id === exp.ref)
      if (!segOp || segOp.kind !== 'segment') continue
      const fromId = refToId.get(segOp.from)
      const toId = refToId.get(segOp.to)
      if (!fromId || !toId) continue
      const result = addSegment(currentState, fromId, toId)
      currentState = result.state
      addedElements.push(result.segment)
      const newCands = findNewIntersections(
        currentState,
        result.segment,
        currentCandidates,
        extendSegments
      )
      currentCandidates = [...currentCandidates, ...newCands]
    }
  }

  return { state: currentState, candidates: currentCandidates, addedElements }
}

// ── applyTraceFacts ────────────────────────────────────────────────

/**
 * Walk recipe.facts[], resolve refs to point IDs, and call addFact on the fact store.
 *
 * When `conclusionOnly` is true (macro usage), only "conclusion" facts are pushed
 * to the fact store — those where all referenced points are public (inputs or exports).
 * Their citation is overridden to `{ type: 'prop', propId }` for cn1/cn3 citations,
 * matching the old behavior where a macro emits a single summary fact.
 *
 * When `conclusionOnly` is false (walkthrough/deriveConclusion), all facts are pushed.
 */
export function applyTraceFacts(
  recipe: ConstructionRecipe,
  factStore: FactStore,
  atStep: number,
  refToId: Map<Ref, string>,
  conclusionOnly: boolean = false
): EqualityFact[] {
  const allNewFacts: EqualityFact[] = []

  // Compute public refs (inputs + exported points) for conclusion filtering
  const publicRefs = new Set<Ref>()
  if (conclusionOnly) {
    for (const slot of recipe.inputSlots) publicRefs.add(slot.ref)
    for (const exp of recipe.exports) {
      if (exp.kind === 'point') publicRefs.add(exp.ref)
    }
  }

  // Resolve labels for template substitution
  const refToLabel = new Map<Ref, string>()
  for (const [ref, pid] of refToId.entries()) {
    // Extract label from point ID: 'pt-A' → 'A'
    refToLabel.set(ref, pid.startsWith('pt-') ? pid.slice(3) : pid)
  }

  for (const fact of recipe.facts) {
    if (fact.kind !== 'distance') continue

    // In conclusion-only mode, skip facts referencing internal points
    if (conclusionOnly) {
      const allPublic =
        publicRefs.has(fact.left.a) &&
        publicRefs.has(fact.left.b) &&
        publicRefs.has(fact.right.a) &&
        publicRefs.has(fact.right.b)
      if (!allPublic) continue
    }

    const leftA = refToId.get(fact.left.a)
    const leftB = refToId.get(fact.left.b)
    const rightA = refToId.get(fact.right.a)
    const rightB = refToId.get(fact.right.b)
    if (!leftA || !leftB || !rightA || !rightB) continue

    const left = distancePair(leftA, leftB)
    const right = distancePair(rightA, rightB)

    // Resolve citation — override transitive citations to 'prop' in conclusion-only mode
    let citation = resolveRecipeCitation(fact.citation, refToId)
    if (conclusionOnly && (fact.citation.type === 'cn1' || fact.citation.type === 'cn3')) {
      citation = { type: 'prop', propId: recipe.propId }
    }

    // Resolve templates
    const statement = resolveTemplate(fact.statementTemplate, refToLabel)
    const justification = resolveTemplate(fact.justificationTemplate, refToLabel)

    allNewFacts.push(...addFact(factStore, left, right, citation, statement, justification, atStep))
  }

  return allNewFacts
}

function resolveRecipeCitation(
  citation: RecipeFact['citation'],
  refToId: Map<Ref, string>
): import('../facts').Citation {
  switch (citation.type) {
    case 'def15':
      return { type: 'def15', circleId: `internal-cir-${citation.circleOpId}` }
    case 'cn1': {
      const viaA = refToId.get(citation.via.a) ?? citation.via.a
      const viaB = refToId.get(citation.via.b) ?? citation.via.b
      return { type: 'cn1', via: distancePair(viaA, viaB) }
    }
    case 'cn3': {
      const wholeA = refToId.get(citation.whole.a) ?? citation.whole.a
      const wholeB = refToId.get(citation.whole.b) ?? citation.whole.b
      const partA = refToId.get(citation.part.a) ?? citation.part.a
      const partB = refToId.get(citation.part.b) ?? citation.part.b
      return {
        type: 'cn3',
        whole: distancePair(wholeA, wholeB),
        part: distancePair(partA, partB),
      }
    }
    case 'prop':
      return { type: 'prop', propId: citation.propId }
  }
}

function resolveTemplate(template: string, refToLabel: Map<Ref, string>): string {
  return template.replace(/\{(\w+)\}/g, (_match, ref) => refToLabel.get(ref) ?? ref)
}

// ── recipeToConclusion ────────────────────────────────────────────

/**
 * Generate a deriveConclusion function from a ConstructionRecipe.
 *
 * Builds the ref→pointId map from inputSlots (givenId) and the standard
 * refToPointId convention for all other refs, then applies the recipe's
 * declarative fact chain. Facts already in the store (from Def.15 derivation
 * or sub-macro execution) are idempotent — only genuinely new facts are returned.
 */
export function recipeToConclusion(
  recipe: ConstructionRecipe
): (store: FactStore, state: import('../../types').ConstructionState, atStep: number) => EqualityFact[] {
  return (store, _state, atStep) => {
    const refToId = new Map<Ref, string>()
    for (const slot of recipe.inputSlots) {
      refToId.set(slot.ref, slot.givenId)
    }
    // Add all refs mentioned in facts using the standard convention
    for (const fact of recipe.facts) {
      if (fact.kind === 'distance') {
        for (const ref of [fact.left.a, fact.left.b, fact.right.a, fact.right.b]) {
          if (!refToId.has(ref)) refToId.set(ref, refToPointId(ref))
        }
      }
    }
    return applyTraceFacts(recipe, store, atStep, refToId, false)
  }
}

// ── Shared ghost element helpers ──────────────────────────────────

/**
 * Extract GhostElements from a sub-trace's exported points and segments.
 */
function collectSubTraceExportGhosts(
  subTrace: ConstructionTrace,
  labelFn: (ref: Ref) => string,
  colorFn: () => string
): GhostElement[] {
  const elements: GhostElement[] = []
  for (const exp of subTrace.recipe.exports) {
    if (exp.kind === 'point') {
      const pt = subTrace.pointMap.get(exp.ref)
      if (pt) {
        elements.push({ kind: 'point', x: pt.x, y: pt.y, label: labelFn(exp.ref), color: colorFn() })
      }
    } else if (exp.kind === 'segment') {
      const seg = subTrace.segmentMap.get(exp.ref)
      if (seg) {
        elements.push({
          kind: 'segment',
          x1: seg.from.x, y1: seg.from.y, x2: seg.to.x, y2: seg.to.y,
          color: colorFn(),
        })
      }
    }
  }
  return elements
}

/**
 * Extract GhostCircles from a sub-trace's non-export circle ops.
 */
function collectSubTraceCircles(
  subTrace: ConstructionTrace,
  colorFn: () => string
): { elements: GhostElement[]; opIds: string[] } {
  const elements: GhostElement[] = []
  const opIds: string[] = []
  for (const opTrace of subTrace.opTraces) {
    if (opTrace.kind === 'circle') {
      elements.push({
        kind: 'circle',
        cx: opTrace.center.x, cy: opTrace.center.y, r: opTrace.radius,
        color: colorFn(),
      })
      opIds.push(opTrace.opId)
    }
  }
  return { elements, opIds }
}

// ── traceToGhostLayers ─────────────────────────────────────────────

/**
 * Convert a ConstructionTrace into GhostLayer[] for the macro reveal ceremony.
 */
export function traceToGhostLayers(
  trace: ConstructionTrace,
  recipe: ConstructionRecipe,
  baseDepth: number,
  refToId: Map<Ref, string>,
  state: ConstructionState,
  inputPointIds: string[],
  outputLabels?: Record<string, string>
): GhostLayer[] {
  const ghostElements: GhostElement[] = []
  const childGhostLayers: GhostLayer[] = []
  let colorIndex = 0

  // Determine the active ops (handle degenerate case)
  const activeOps =
    trace.degenerate && recipe.degenerateCases?.[0] ? recipe.degenerateCases[0].ops : recipe.ops

  // Map op IDs to element indices for revealGroups
  const opIdToElementIndices = new Map<string, number[]>()

  for (const opTrace of trace.opTraces) {
    const startIdx = ghostElements.length

    switch (opTrace.kind) {
      case 'segment': {
        ghostElements.push({
          kind: 'segment',
          x1: opTrace.from.x,
          y1: opTrace.from.y,
          x2: opTrace.to.x,
          y2: opTrace.to.y,
          color: BYRNE_CYCLE[colorIndex++ % 3],
        })
        break
      }
      case 'circle': {
        ghostElements.push({
          kind: 'circle',
          cx: opTrace.center.x,
          cy: opTrace.center.y,
          r: opTrace.radius,
          color: BYRNE_CYCLE[colorIndex++ % 3],
        })
        break
      }
      case 'intersection': {
        ghostElements.push({
          kind: 'point',
          x: opTrace.point.x,
          y: opTrace.point.y,
          label: opTrace.outputRef,
          color: BYRNE_CYCLE[colorIndex++ % 3],
        })
        break
      }
      case 'produce': {
        // The production point
        ghostElements.push({
          kind: 'point',
          x: opTrace.point.x,
          y: opTrace.point.y,
          label: opTrace.outputRef,
          color: BYRNE_CYCLE[colorIndex++ % 3],
        })
        // Also show the production segment (extension from through to output)
        const throughPt = trace.pointMap.get(opTrace.throughRef)
        if (throughPt) {
          ghostElements.push({
            kind: 'segment',
            x1: throughPt.x,
            y1: throughPt.y,
            x2: opTrace.point.x,
            y2: opTrace.point.y,
            color: BYRNE_CYCLE[(colorIndex - 1) % 3],
            isProduction: true,
          })
        }
        break
      }
      case 'apply': {
        // Sub-trace exports become ghost elements at current depth
        const exportGhosts = collectSubTraceExportGhosts(
          opTrace.subTrace,
          (ref) => opTrace.outputMappings[ref] ?? ref,
          () => BYRNE_CYCLE[colorIndex++ % 3]
        )
        ghostElements.push(...exportGhosts)

        // Non-export elements from the sub-trace become child ghost layers
        const subGhosts = buildSubTraceGhostElements(opTrace.subTrace, colorIndex)
        colorIndex = subGhosts.nextColorIndex

        if (subGhosts.elements.length > 0) {
          childGhostLayers.push({
            propId: opTrace.subTrace.recipe.propId,
            depth: baseDepth + 1,
            atStep: 0,
            elements: subGhosts.elements,
            revealGroups: subGhosts.revealGroups.length > 0 ? subGhosts.revealGroups : undefined,
          })
        }

        // Recurse for nested apply ops within the sub-trace
        for (const subOpTrace of opTrace.subTrace.opTraces) {
          if (subOpTrace.kind === 'apply') {
            const nestedGhosts = buildSubTraceGhostElements(subOpTrace.subTrace, 0)
            if (nestedGhosts.elements.length > 0) {
              childGhostLayers.push({
                propId: subOpTrace.subTrace.recipe.propId,
                depth: baseDepth + 2,
                atStep: 0,
                elements: nestedGhosts.elements,
                revealGroups:
                  nestedGhosts.revealGroups.length > 0 ? nestedGhosts.revealGroups : undefined,
              })
            }
          }
        }
        break
      }
    }

    const endIdx = ghostElements.length
    const indices = []
    for (let i = startIdx; i < endIdx; i++) indices.push(i)
    if (indices.length > 0) {
      opIdToElementIndices.set(opTrace.opId, indices)
    }
  }

  // Build reveal groups from ceremony spec
  const activeCeremony =
    trace.degenerate && recipe.degenerateCases?.[0]?.ceremony
      ? recipe.degenerateCases[0].ceremony
      : recipe.ceremony
  const revealGroups: number[][] = []
  for (const group of activeCeremony.revealGroups) {
    const indices: number[] = []
    for (const opId of group) {
      const opIndices = opIdToElementIndices.get(opId)
      if (opIndices) indices.push(...opIndices)
    }
    if (indices.length > 0) revealGroups.push(indices)
  }

  // Resolve narration template
  const refToLabel = new Map<Ref, string>()
  for (const [ref, pid] of refToId.entries()) {
    refToLabel.set(ref, pid.startsWith('pt-') ? pid.slice(3) : pid)
  }
  const keyNarration = resolveTemplate(activeCeremony.narrationTemplate, refToLabel)

  const ghostLayers: GhostLayer[] = []
  if (ghostElements.length > 0) {
    ghostLayers.push({
      propId: recipe.propId,
      depth: baseDepth,
      atStep: 0,
      elements: ghostElements,
      revealGroups: revealGroups.length > 0 ? revealGroups : undefined,
      keyNarration,
    })
  }
  ghostLayers.push(...childGhostLayers)

  return ghostLayers
}

/**
 * Build ghost elements from a sub-trace's non-export ops (circles, segments).
 */
function buildSubTraceGhostElements(
  trace: ConstructionTrace,
  startColorIndex: number
): {
  elements: GhostElement[]
  revealGroups: number[][]
  nextColorIndex: number
} {
  let colorIndex = startColorIndex
  const { elements, opIds } = collectSubTraceCircles(
    trace,
    () => BYRNE_CYCLE[colorIndex++ % 3]
  )

  // Map op IDs to element indices for reveal groups
  const opIdToIndices = new Map<string, number[]>()
  opIds.forEach((id, i) => opIdToIndices.set(id, [i]))

  // Build reveal groups from the sub-trace's ceremony
  const revealGroups: number[][] = []
  for (const group of trace.recipe.ceremony.revealGroups) {
    const indices: number[] = []
    for (const opId of group) {
      const opIndices = opIdToIndices.get(opId)
      if (opIndices) indices.push(...opIndices)
    }
    if (indices.length > 0) revealGroups.push(indices)
  }

  return { elements, revealGroups, nextColorIndex: colorIndex }
}

// ── recipeToPreview ────────────────────────────────────────────────

/**
 * Generate a preview function from a ConstructionRecipe.
 */
export function recipeToPreview(
  recipe: ConstructionRecipe,
  registry: RecipeRegistry
): (inputs: Pt[]) => MacroPreviewResult | null {
  return (inputs: Pt[]): MacroPreviewResult | null => {
    if (inputs.length < recipe.inputSlots.length) return null

    // Reject degenerate input: any distinct-input pair that's actually coincident
    for (const [i, j] of recipe.distinctInputPairs) {
      const dx = inputs[i].x - inputs[j].x
      const dy = inputs[i].y - inputs[j].y
      if (Math.sqrt(dx * dx + dy * dy) < 1e-9) return null
    }

    const trace = evaluateRecipe(recipe, inputs, registry)
    if (!trace) return null

    const ghostElements: GhostElement[] = []
    const resultElements: GhostElement[] = []
    const exportRefs = new Set(recipe.exports.map((e) => e.ref))
    const exportSegIds = new Set(
      recipe.exports.filter((e) => e.kind === 'segment').map((e) => e.ref)
    )

    // Determine which ops produce result vs ghost elements
    for (const opTrace of trace.opTraces) {
      switch (opTrace.kind) {
        case 'circle': {
          ghostElements.push({
            kind: 'circle',
            cx: opTrace.center.x,
            cy: opTrace.center.y,
            r: opTrace.radius,
            color: BYRNE_CYCLE[ghostElements.length % 3],
          })
          break
        }
        case 'segment': {
          const isExport = exportSegIds.has(opTrace.opId)
          const target = isExport ? resultElements : ghostElements
          target.push({
            kind: 'segment',
            x1: opTrace.from.x,
            y1: opTrace.from.y,
            x2: opTrace.to.x,
            y2: opTrace.to.y,
            color: BYRNE_CYCLE[2],
          })
          break
        }
        case 'intersection':
        case 'produce': {
          const ref = opTrace.kind === 'intersection' ? opTrace.outputRef : opTrace.outputRef
          const isExport = exportRefs.has(ref)
          const target = isExport ? resultElements : ghostElements
          target.push({
            kind: 'point',
            x: opTrace.point.x,
            y: opTrace.point.y,
            label: '',
            color: BYRNE_CYCLE[2],
          })
          break
        }
        case 'apply': {
          // Sub-trace's circles → ghost elements
          const { elements: circleGhosts } = collectSubTraceCircles(
            opTrace.subTrace,
            () => BYRNE_CYCLE[ghostElements.length % 3]
          )
          ghostElements.push(...circleGhosts)
          // Sub-trace's exported points/segments → ghost at this level
          const exportGhosts = collectSubTraceExportGhosts(
            opTrace.subTrace,
            () => '',
            () => BYRNE_CYCLE[ghostElements.length % 3]
          )
          ghostElements.push(...exportGhosts)
          break
        }
      }
    }

    // For exports that are points, ensure they're in resultElements
    for (const exp of recipe.exports) {
      if (exp.kind === 'point') {
        const pt = trace.pointMap.get(exp.ref)
        if (pt) {
          // Check if already added
          const alreadyAdded = resultElements.some(
            (e) => e.kind === 'point' && Math.abs(e.x - pt.x) < 1e-9 && Math.abs(e.y - pt.y) < 1e-9
          )
          if (!alreadyAdded) {
            resultElements.push({
              kind: 'point',
              x: pt.x,
              y: pt.y,
              label: '',
              color: BYRNE_CYCLE[2],
            })
          }
        }
      }
    }

    if (ghostElements.length === 0 && resultElements.length === 0) return null
    return { ghostElements, resultElements }
  }
}
