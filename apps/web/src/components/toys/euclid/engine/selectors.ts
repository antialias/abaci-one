import type {
  ConstructionState,
  ConstructionCircle,
  ConstructionSegment,
  ElementSelector,
} from '../types'

/**
 * Resolve an ElementSelector to its runtime element ID.
 *
 * - String selectors (point IDs like "pt-A") pass through directly.
 * - Circle selectors match by (centerId, radiusPointId).
 * - Segment selectors match by (fromId, toId), order-insensitive.
 *
 * Returns null if no matching element exists in state.
 */
export function resolveSelector(sel: ElementSelector, state: ConstructionState): string | null {
  if (typeof sel === 'string') return sel

  if (sel.kind === 'circle') {
    const match = state.elements.find(
      (e): e is ConstructionCircle =>
        e.kind === 'circle' && e.centerId === sel.centerId && e.radiusPointId === sel.radiusPointId
    )
    return match?.id ?? null
  }

  if (sel.kind === 'segment') {
    const match = state.elements.find(
      (e): e is ConstructionSegment =>
        e.kind === 'segment' &&
        ((e.fromId === sel.fromId && e.toId === sel.toId) ||
          (e.fromId === sel.toId && e.toId === sel.fromId))
    )
    return match?.id ?? null
  }

  return null
}
