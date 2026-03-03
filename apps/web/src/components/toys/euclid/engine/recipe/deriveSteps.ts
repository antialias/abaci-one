/**
 * Derive PropositionStep[] from a ConstructionRecipe + OpAnnotations.
 *
 * Ops without annotations are skipped (e.g., export-only segments).
 * The derived step order follows the recipe's op order, filtered to annotated ops only.
 */

import type { ConstructionRecipe, IntersectionSource, OpAnnotations, RecipeOp, Ref } from './types'
import { refToPointId } from './types'
import type { PropositionStep, ExpectedAction, ElementSelector } from '../../types'

/**
 * Derive PropositionStep[] from a recipe and its annotations.
 */
export function deriveSteps(
  recipe: ConstructionRecipe,
  annotations: OpAnnotations
): PropositionStep[] {
  const steps: PropositionStep[] = []

  for (const op of recipe.ops) {
    const annotation = annotations[op.id]
    if (!annotation) continue // Skip un-annotated ops

    steps.push({
      instruction: annotation.instruction,
      expected: annotation.expectedOverride ?? opToExpectedAction(op, recipe),
      highlightIds: annotation.highlightIds ?? [],
      tool: annotation.tool,
      citation: annotation.citation,
    })
  }

  return steps
}

/**
 * Convert a RecipeOp to the ExpectedAction that the student must perform.
 */
export function opToExpectedAction(op: RecipeOp, recipe: ConstructionRecipe): ExpectedAction {
  switch (op.kind) {
    case 'segment':
      return {
        type: 'straightedge',
        fromId: refToPointId(op.from),
        toId: refToPointId(op.to),
      }

    case 'circle':
      return {
        type: 'compass',
        centerId: refToPointId(op.center),
        radiusPointId: refToPointId(op.radiusPoint),
      }

    case 'intersection': {
      // Resolve the two element selectors from intersection sources
      const selA = sourceToSelector(op.of[0], recipe)
      const selB = sourceToSelector(op.of[1], recipe)
      return {
        type: 'intersection',
        ofA: selA,
        ofB: selB,
        label: op.output,
      }
    }

    case 'produce': {
      // A production is an intersection of the circle with the line extension
      const cirSelector = sourceToSelector(op.until, recipe)
      const segSelector = findSegmentForRefs(op.from, op.through, recipe)
      return {
        type: 'intersection',
        ofA: cirSelector,
        ofB: segSelector,
        beyondId: refToPointId(op.through),
        label: op.output,
      }
    }

    case 'apply': {
      // Invert the outputs map: sub-recipe ref → local ref label
      const outputLabels: Record<string, string> = {}
      for (const [subRef, localRef] of Object.entries(op.outputs)) {
        // Find which export key this sub-ref maps to
        const subRecipeExports = findSubRecipeExports(op.recipeId, recipe)
        for (const exp of subRecipeExports) {
          if (exp.ref === subRef && exp.outputLabelKey) {
            outputLabels[exp.outputLabelKey] = localRef
          }
        }
      }
      return {
        type: 'macro',
        propId: op.recipeId,
        inputPointIds: op.inputs.map(refToPointId),
        outputLabels: Object.keys(outputLabels).length > 0 ? outputLabels : undefined,
      }
    }
  }
}

/**
 * Convert an IntersectionSource to an ElementSelector.
 * Handles string op IDs (looked up in the recipe) and inline segment refs.
 */
function sourceToSelector(
  source: IntersectionSource,
  recipe: ConstructionRecipe
): ElementSelector | undefined {
  if (typeof source !== 'string') {
    // Inline segment defined by two point refs
    return {
      kind: 'segment',
      fromId: refToPointId(source.segmentRefs[0]),
      toId: refToPointId(source.segmentRefs[1]),
    }
  }
  const op = findOpById(source, recipe)
  if (!op) return undefined

  if (op.kind === 'circle') {
    return {
      kind: 'circle',
      centerId: refToPointId(op.center),
      radiusPointId: refToPointId(op.radiusPoint),
    }
  }
  if (op.kind === 'segment') {
    return {
      kind: 'segment',
      fromId: refToPointId(op.from),
      toId: refToPointId(op.to),
    }
  }
  return undefined
}

/**
 * Find a segment (or prior op) that connects two refs for use as a line selector.
 * Handles the case where the segment was created by an earlier op (e.g., part of a macro export).
 */
function findSegmentForRefs(
  from: Ref,
  through: Ref,
  recipe: ConstructionRecipe
): ElementSelector | undefined {
  // Look through all ops for a segment connecting these points (or their reversal)
  for (const op of recipe.ops) {
    if (op.kind === 'segment') {
      if ((op.from === from && op.to === through) || (op.from === through && op.to === from)) {
        return { kind: 'segment', fromId: refToPointId(op.from), toId: refToPointId(op.to) }
      }
    }
  }
  // Also check apply ops — the sub-recipe might have produced segments
  // In practice, for I.2 the segments DA and DB come from the I.1 macro
  // The existing code uses segment selectors like {fromId: 'pt-D', toId: 'pt-B'}
  return { kind: 'segment', fromId: refToPointId(from), toId: refToPointId(through) }
}

function findOpById(opId: string, recipe: ConstructionRecipe): RecipeOp | undefined {
  const found = recipe.ops.find((op) => op.id === opId)
  if (found) return found
  // Also check degenerate case ops
  if (recipe.degenerateCases) {
    for (const dc of recipe.degenerateCases) {
      const dcOp = dc.ops.find((op) => op.id === opId)
      if (dcOp) return dcOp
    }
  }
  return undefined
}

/**
 * Stub: find exports for a sub-recipe by propId.
 * In a real implementation this would look up the registry,
 * but since we only need I.1 and I.2 exports, we hardcode them.
 */
function findSubRecipeExports(
  propId: number,
  _parentRecipe: ConstructionRecipe
): Array<{ ref: Ref; kind: 'point' | 'segment'; outputLabelKey?: string }> {
  // I.1 exports: apex point with key 'apex'
  if (propId === 1) {
    return [{ ref: 'C', kind: 'point', outputLabelKey: 'apex' }]
  }
  // I.2 exports: result point with key 'result', and segment
  if (propId === 2) {
    return [
      { ref: 'F', kind: 'point', outputLabelKey: 'result' },
      { ref: 'seg-AF', kind: 'segment' },
    ]
  }
  return []
}
