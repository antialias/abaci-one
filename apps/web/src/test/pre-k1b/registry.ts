/**
 * VERBATIM copy of `bktModeOf` of `src/lib/curriculum/parts/registry.ts` at 76b2cc46c (before practice-kinds K1b),
 * the "before" side of `try-readers-k1b-parity.test.ts`. Only imports
 * changed (paths repointed, `server-only` dropped). Never edit the logic: it is the old
 * reader the new one is compared against.
 *
 * K3 retired `PartKind.bktMode` and its `BktMode` type, so both are put back
 * here as the kinds had them before K3 (`k1bBktModeOf`): arithmetic's
 * `type`, else 'linear'; the stub kind's null. `bktModeOf` calls it where it called
 * `kind.bktMode(part)`; nothing else changed.
 */
import type { StoredPart } from '@/lib/curriculum/parts/kind'
import { findPartKind } from '@/lib/curriculum/parts/registry'

export type BktMode = 'abacus' | 'visualization' | 'linear'

/** `kind.bktMode(part)` before K3 (`parts/arithmetic/server.ts` at 0551921da; the stub kind: null). */
function k1bBktModeOf(kindId: string, part: StoredPart): BktMode | null {
  if (kindId !== 'arithmetic') return null
  const type: unknown = (part as { type?: unknown }).type
  // A part stored without a type (old or hand-made rows) is 'linear', main's
  // default for evidence; null stays reserved for "not evidence".
  return typeof type === 'string' ? (type as BktMode) : 'linear'
}

/** The BKT mode of a part's tries; null (not evidence) for an unknown kind. */
export function bktModeOf(part: StoredPart): BktMode | null {
  const kind = findPartKind(part)
  return kind ? k1bBktModeOf(kind.id, part) : null
}
