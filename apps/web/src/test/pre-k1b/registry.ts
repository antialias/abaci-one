/**
 * VERBATIM copy of `bktModeOf` of `src/lib/curriculum/parts/registry.ts` at 76b2cc46c (before practice-kinds K1b),
 * the "before" side of `try-readers-k1b-parity.test.ts`. Only imports
 * changed (paths repointed, `server-only` dropped). Never edit the logic: it is the old
 * reader the new one is compared against.
 */
import type { BktMode, StoredPart } from '@/lib/curriculum/parts/kind'
import { findPartKind } from '@/lib/curriculum/parts/registry'

/** The BKT mode of a part's tries; null (not evidence) for an unknown kind. */
export function bktModeOf(part: StoredPart): BktMode | null {
  const kind = findPartKind(part)
  return kind ? kind.bktMode(part) : null
}
