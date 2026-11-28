/**
 * The browser-kind registry (practice-kinds plan §1.3, §4 K5a-3b): a part's
 * browser half, by `part.kind` (absent = arithmetic, as `registry.ts`). The
 * session shell reads every kind through here and never names one.
 *
 * Client-only: the kinds' views come with it.
 */

import type { AnySessionKind } from '@/components/practice/session/sessionKind'
import type { SessionPlan } from '@/db/schema/session-plans'
import { arithmeticSessionKind } from './arithmetic/browser'
import { arithmeticCursorLinearIndex } from './arithmetic/session-view'
import type { StoredPart } from './kind'
import { kindIdOf } from './registry'

const browserKinds: ReadonlyMap<string, AnySessionKind> = new Map([
  [arithmeticSessionKind.id, arithmeticSessionKind as AnySessionKind],
])

/** The part's browser half; undefined for a kind this image does not know (the shell shows loading). */
export function browserKindOf(
  part: Pick<StoredPart, 'kind'> | undefined
): AnySessionKind | undefined {
  return part ? browserKinds.get(kindIdOf(part)) : undefined
}

/**
 * The dots' index of the plan's cursor (the "Back to #N" number and the
 * browse start). Arithmetic's dots today; K5b draws the dots from `items()`.
 */
export function cursorDotsIndexOf(plan: SessionPlan): number {
  return arithmeticCursorLinearIndex(plan)
}
