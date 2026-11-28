/**
 * Presentations by id, across every registered kind (practice-kinds plan
 * §1.3, §3.1, K1b).
 *
 * A try's evidence names the presentation it was practiced in; the mastery
 * mode it counts toward is resolved here, at read time, never stamped (K2).
 * So "flash anzan counts toward visualization" will be one line in a
 * presentation list, with no backfill (D8).
 *
 * Built from the registry (`partKinds`, each kind's `presentations`, K3):
 * a kind's presentations are registered with the kind.
 *
 * Client-safe: pure, no kind vocabulary.
 */

import type { Presentation } from './kind'
import { partKinds } from './registry'

/**
 * Every registered presentation, in kind-registration order then the kind's
 * own. Read from the registry at each call, so a kind registered after this
 * module loaded (a test's stub kind) is seen.
 */
export function registeredPresentations(): Presentation[] {
  return [...partKinds.values()].flatMap((kind) => [...kind.presentations.values()])
}

/** A registered presentation, or undefined for an id no registry knows. */
export function findPresentation(id: string): Presentation | undefined {
  for (const kind of partKinds.values()) {
    const presentation = kind.presentations.get(id)
    if (presentation) return presentation
  }
  return undefined
}

/**
 * The mastery mode a presentation's evidence counts toward: the registered
 * presentation's `masteryMode` (null = not evidence), or, for an id no
 * registry knows (a newer image's presentation, read after a rollback), the
 * id itself: its own mode, recorded and reported, consulted by no decision
 * (§3.1).
 */
export function masteryModeOf(presentationId: string): string | null {
  const presentation = findPresentation(presentationId)
  return presentation ? presentation.masteryMode : presentationId
}
