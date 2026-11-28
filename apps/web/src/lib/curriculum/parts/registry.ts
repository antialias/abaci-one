/**
 * The part-kind registry (session architecture §1.2, Phase 2).
 *
 * Structural code finds a part's kind here, by `part.kind`; a part stored
 * before kinds existed has none and is arithmetic. A kind id this image does
 * not know (a part written by a newer image, read after a rollback) finds no
 * kind: its tries are not BKT evidence, the session is not auto-abandoned, and
 * recording a try into it fails (§10 P2-4).
 */

import type { SlotResult } from '@/db/schema/session-plans'
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

/**
 * One line naming what a stored try answered, by its part's kind
 * (`describe`), for the song, MCP and logs. A part this image does not know,
 * or a row with no part, is 'a problem'.
 */
export function describeTry(part: StoredPart | undefined, row: SlotResult): string {
  const kind = part ? findPartKind(part) : undefined
  if (!part || !kind) return 'a problem'
  return kind.describe(part, {
    result: row,
    outcome: row.outcome ?? 'answered',
    payload: kind.payloadOf(row),
  })
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

/**
 * Item `itemId` of a part, as its kind holds it (`itemOf`): a do-over's item.
 * Null when the part has no such item or its kind is unknown to this image.
 */
export function partItemOf(part: StoredPart, itemId: string): unknown | null {
  const kind = findPartKind(part)
  if (!kind) return null
  return kind.itemOf(kind.contentOf(part), itemId) ?? null
}

/**
 * The item after `itemId` in its part's order (`items()`), as its kind holds
 * it (`itemOf`): where a first-round try mid-part goes next. Null after the
 * last item, for an item the part does not have, or for an unknown kind.
 */
export function partItemAfter(
  part: StoredPart,
  itemId: string
): { item: unknown; itemId: string } | null {
  const kind = findPartKind(part)
  if (!kind) return null
  const content = kind.contentOf(part)
  const refs = kind.items(content)
  const index = refs.findIndex((ref) => ref.itemId === itemId)
  if (index < 0 || index + 1 >= refs.length) return null
  const next = refs[index + 1].itemId
  const item = kind.itemOf(content, next)
  return item === null || item === undefined ? null : { item, itemId: next }
}
