/**
 * Presentations by id, across every registered kind (practice-kinds plan
 * §1.3, §3.1, K1b).
 *
 * A try's evidence names the presentation it was practiced in; the mastery
 * mode it counts toward is resolved here, at read time, never stamped (K2).
 * So "flash anzan counts toward visualization" will be one line in a
 * presentation list, with no backfill (D8).
 *
 * K3 builds this from `partKinds` (each kind's `presentations`); until then
 * it lists arithmetic's, the only kind with presentations.
 *
 * Client-safe: pure, no kind vocabulary.
 */

import { arithmeticPresentations } from './arithmetic/presentations'
import type { Presentation } from './kind'

const presentationLists: readonly ReadonlyMap<string, Presentation>[] = [arithmeticPresentations]

/** Every registered presentation, in kind-registration order then the kind's own */
export const registeredPresentations: readonly Presentation[] = presentationLists.flatMap(
  (list) => [...list.values()]
)

const byId = new Map(registeredPresentations.map((p) => [p.id, p]))

/** A registered presentation, or undefined for an id no registry knows. */
export function findPresentation(id: string): Presentation | undefined {
  return byId.get(id)
}

/**
 * The mastery mode a presentation's evidence counts toward: the registered
 * presentation's `masteryMode` (null = not evidence), or, for an id no
 * registry knows (a newer image's presentation, read after a rollback), the
 * id itself: its own mode, recorded and reported, consulted by no decision
 * (§3.1).
 */
export function masteryModeOf(presentationId: string): string | null {
  const presentation = byId.get(presentationId)
  return presentation ? presentation.masteryMode : presentationId
}
