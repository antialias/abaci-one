import type { PropositionDef, ExpectedAction, ElementSelector } from '../types'

export interface ValidationError {
  stepIndex: number
  field: string
  pointId: string
  message: string
}

/**
 * Extract all point IDs referenced by an ElementSelector.
 * String selectors that look like point IDs ('pt-X') are included.
 * Structured selectors yield their defining point IDs.
 */
function pointIdsFromSelector(sel: ElementSelector): string[] {
  if (typeof sel === 'string') {
    return sel.startsWith('pt-') ? [sel] : []
  }
  if (sel.kind === 'circle') return [sel.centerId, sel.radiusPointId]
  if (sel.kind === 'segment') return [sel.fromId, sel.toId]
  return []
}

/**
 * Extract all point IDs referenced by an ExpectedAction.
 */
function referencedPointIds(expected: ExpectedAction): { field: string; pointId: string }[] {
  const refs: { field: string; pointId: string }[] = []

  switch (expected.type) {
    case 'compass':
      refs.push({ field: 'centerId', pointId: expected.centerId })
      refs.push({ field: 'radiusPointId', pointId: expected.radiusPointId })
      break

    case 'straightedge':
      refs.push({ field: 'fromId', pointId: expected.fromId })
      refs.push({ field: 'toId', pointId: expected.toId })
      break

    case 'intersection':
      if (expected.beyondId) {
        refs.push({ field: 'beyondId', pointId: expected.beyondId })
      }
      if (expected.ofA != null) {
        for (const id of pointIdsFromSelector(expected.ofA)) {
          refs.push({ field: 'ofA', pointId: id })
        }
      }
      if (expected.ofB != null) {
        for (const id of pointIdsFromSelector(expected.ofB)) {
          refs.push({ field: 'ofB', pointId: id })
        }
      }
      break

    case 'macro':
      for (const id of expected.inputPointIds) {
        refs.push({ field: 'inputPointIds', pointId: id })
      }
      break
  }

  return refs
}

/**
 * Determine what new point IDs a step introduces after it completes.
 */
function introducedPointIds(expected: ExpectedAction): string[] {
  if (expected.type === 'intersection' && expected.label) {
    return [`pt-${expected.label}`]
  }
  if (expected.type === 'macro' && expected.outputLabels) {
    return Object.values(expected.outputLabels).map((label) => `pt-${label}`)
  }
  return []
}

/**
 * Validate a PropositionDef by walking its steps in order and checking that
 * every referenced point ID is either given or introduced by a prior step.
 *
 * Returns an empty array if the definition is valid.
 */
export function validatePropositionDef(prop: PropositionDef): ValidationError[] {
  const errors: ValidationError[] = []

  // Collect initial point IDs from given elements
  const knownPoints = new Set<string>()
  for (const el of prop.givenElements) {
    if (el.kind === 'point') {
      knownPoints.add(el.id)
    }
  }

  // Also validate givenElements internal references (segment fromId/toId)
  for (const el of prop.givenElements) {
    if (el.kind === 'segment') {
      if (!knownPoints.has(el.fromId)) {
        errors.push({
          stepIndex: -1,
          field: 'givenElements.segment.fromId',
          pointId: el.fromId,
          message: `Given segment ${el.id} references unknown point '${el.fromId}'`,
        })
      }
      if (!knownPoints.has(el.toId)) {
        errors.push({
          stepIndex: -1,
          field: 'givenElements.segment.toId',
          pointId: el.toId,
          message: `Given segment ${el.id} references unknown point '${el.toId}'`,
        })
      }
    }
  }

  // Walk steps in order
  for (let i = 0; i < prop.steps.length; i++) {
    const step = prop.steps[i]
    const refs = referencedPointIds(step.expected)

    for (const ref of refs) {
      if (!knownPoints.has(ref.pointId)) {
        errors.push({
          stepIndex: i,
          field: ref.field,
          pointId: ref.pointId,
          message: `Step ${i} (${step.expected.type}) references unknown point '${ref.pointId}' in ${ref.field}`,
        })
      }
    }

    // Check highlightIds
    for (const id of step.highlightIds) {
      if (id.startsWith('pt-') && !knownPoints.has(id)) {
        errors.push({
          stepIndex: i,
          field: 'highlightIds',
          pointId: id,
          message: `Step ${i} highlightIds references unknown point '${id}'`,
        })
      }
    }

    // Add points introduced by this step
    for (const id of introducedPointIds(step.expected)) {
      knownPoints.add(id)
    }
  }

  // Validate resultSegments
  if (prop.resultSegments) {
    for (const seg of prop.resultSegments) {
      if (!knownPoints.has(seg.fromId)) {
        errors.push({
          stepIndex: -1,
          field: 'resultSegments.fromId',
          pointId: seg.fromId,
          message: `resultSegments references unknown point '${seg.fromId}'`,
        })
      }
      if (!knownPoints.has(seg.toId)) {
        errors.push({
          stepIndex: -1,
          field: 'resultSegments.toId',
          pointId: seg.toId,
          message: `resultSegments references unknown point '${seg.toId}'`,
        })
      }
    }
  }

  return errors
}
