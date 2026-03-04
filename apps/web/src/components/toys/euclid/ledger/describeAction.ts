/**
 * Pure description generator for the construction log.
 *
 * Maps PostCompletionActions and given ConstructionElements to display entries
 * with postulate/proposition citations and entity-marked descriptions.
 */

import type { PostCompletionAction } from '../engine/replayConstruction'
import type { ConstructionState, ConstructionElement } from '../types'
import { getPoint } from '../engine/constructionState'

export interface LedgerEntryDescriptor {
  /** Citation label: "Post.1", "Post.3", "I.1", or null */
  citation: string | null
  /** Description with entity markers: "Join {pt:A} to {pt:B}" */
  markedDescription: string
}

/** Resolve a point ID to its label, falling back to stripping the pt- prefix. */
function label(state: ConstructionState, id: string): string {
  return getPoint(state, id)?.label ?? id.replace(/^pt-/, '')
}

/** Generate a ledger entry descriptor for a post-completion action. */
export function describeAction(
  action: PostCompletionAction,
  state: ConstructionState
): LedgerEntryDescriptor {
  switch (action.type) {
    case 'segment': {
      const from = label(state, action.fromId)
      const to = label(state, action.toId)
      return {
        citation: 'Post.1',
        markedDescription: `Join {pt:${from}} to {pt:${to}}`,
      }
    }
    case 'extend': {
      const base = label(state, action.baseId)
      const through = label(state, action.throughId)
      const pt = label(state, action.pointId)
      return {
        citation: 'Post.2',
        markedDescription: `Produce {seg:${base}${through}} beyond {pt:${through}} to {pt:${pt}}`,
      }
    }
    case 'circle': {
      const center = label(state, action.centerId)
      const radius = label(state, action.radiusPointId)
      return {
        citation: 'Post.3',
        markedDescription: `Describe circle with center {pt:${center}} through {pt:${radius}}`,
      }
    }
    case 'intersection': {
      // Find the point that was created — it's the last point whose origin is 'intersection'
      // We can't easily know the exact point from the action alone, so we look for the
      // most recent intersection point in state
      const allPts = state.elements.filter(
        (e): e is Extract<typeof e, { kind: 'point' }> =>
          e.kind === 'point' && e.origin === 'intersection'
      )
      const pt = allPts[allPts.length - 1]
      const ptLabel = pt?.label ?? '?'
      return {
        citation: null,
        markedDescription: `Mark intersection point {pt:${ptLabel}}`,
      }
    }
    case 'macro': {
      // Resolve input points to labels
      const inputLabels = action.inputPointIds.map((id) => `{pt:${label(state, id)}}`)
      return {
        citation: `I.${action.propId}`,
        markedDescription: `Apply {prop:${action.propId}} to ${inputLabels.join(', ')}`,
      }
    }
    case 'free-point': {
      return {
        citation: null,
        markedDescription: `Place point {pt:${action.label}}`,
      }
    }
  }
}

/** Generate a ledger entry descriptor for a given (initial) element. */
export function describeGivenElement(el: ConstructionElement): LedgerEntryDescriptor {
  switch (el.kind) {
    case 'point':
      return {
        citation: 'Given',
        markedDescription: `Given: point {pt:${el.label}}`,
      }
    case 'segment':
      return {
        citation: 'Given',
        markedDescription: `Given: segment {seg:${el.fromId.replace(/^pt-/, '')}${el.toId.replace(/^pt-/, '')}}`,
      }
    case 'circle':
      return {
        citation: 'Given',
        markedDescription: `Given: circle with center ${el.centerId.replace(/^pt-/, '')} through ${el.radiusPointId.replace(/^pt-/, '')}`,
      }
  }
}
