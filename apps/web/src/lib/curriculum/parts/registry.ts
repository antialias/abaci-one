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
import type { AnyPartKind, BktMode, StoredPart } from './kind'

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

/** Items planned for a part (its progress total at the start); 0 for an unknown kind. */
export function plannedItemCount(part: StoredPart): number {
  const kind = findPartKind(part)
  if (!kind) return 0
  const content = kind.contentOf(part)
  return kind.progress(content, kind.initialState(content), []).total
}

/** The BKT mode of a part's tries; null (not evidence) for an unknown kind. */
export function bktModeOf(part: StoredPart): BktMode | null {
  const kind = findPartKind(part)
  return kind ? kind.bktMode(part) : null
}
