/**
 * The part-kind registry (session architecture §1.2, Phase 2).
 *
 * Structural code finds a part's kind here, by `part.kind`; a part stored
 * before kinds existed has none and is arithmetic. A kind id this image does
 * not know (a part written by a newer image, read after a rollback) finds no
 * kind: its tries are not BKT evidence, the session is not auto-abandoned, and
 * recording a try into it fails (§10 P2-4).
 */

import { arithmeticKind } from './arithmetic/server'
import type { AnyPartKind, StoredPart } from './kind'

export const partKinds: ReadonlyMap<string, AnyPartKind> = new Map([
  [arithmeticKind.id, arithmeticKind as AnyPartKind],
])

/** The kind id of a stored part; absent = arithmetic (old plans). */
export function kindIdOf(part: Pick<StoredPart, 'kind'>): string {
  return part.kind ?? arithmeticKind.id
}

/** The part's kind, or undefined when this image does not know it. */
export function findPartKind(part: Pick<StoredPart, 'kind'>): AnyPartKind | undefined {
  return partKinds.get(kindIdOf(part))
}

/** The part's kind; throws for a kind this image does not know. */
export function partKindOf(part: Pick<StoredPart, 'kind'>): AnyPartKind {
  const kind = findPartKind(part)
  if (!kind) throw new Error(`Unknown part kind: ${String(part.kind).slice(0, 40)}`)
  return kind
}

/** Whether a stored part can be played; unknown kinds are not this image's to abandon. */
export function isPartPlayable(part: StoredPart): boolean {
  const kind = findPartKind(part)
  return kind ? kind.isPlayable(kind.contentOf(part)) : true
}

/** Items planned for a part (its `items()`); 0 for an unknown kind. */
export function plannedItemCount(part: StoredPart): number {
  const kind = findPartKind(part)
  if (!kind) return 0
  return kind.items(kind.contentOf(part)).length
}

/**
 * The item the kid is on in a part, as its kind shows it, with its id and
 * round (`itemPositionOf`, default the item's own `itemId`, round 0); null
 * when the part has nothing to show or its kind is unknown to this image.
 */
export function expectedItemOf(
  part: StoredPart,
  state: unknown
): { item: unknown; itemId: string; round: number } | null {
  const kind = findPartKind(part)
  if (!kind) return null
  const item = kind.expectedItem(kind.contentOf(part), state)
  if (item === null || item === undefined) return null
  const position = kind.itemPositionOf
    ? kind.itemPositionOf(item)
    : { itemId: (item as { itemId?: unknown }).itemId, round: 0 }
  return typeof position.itemId === 'string'
    ? { item, itemId: position.itemId, round: position.round }
    : null
}
