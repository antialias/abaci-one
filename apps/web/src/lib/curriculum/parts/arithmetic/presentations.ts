/**
 * Arithmetic's presentations (practice-kinds plan §1.3, K1b): one kind,
 * arithmetic, shown three ways. Each counts toward its own mastery mode (the
 * id), which is how every BKT reader keyed the part's `type` before K1b.
 *
 * Registered here so K3 adds them to `arithmeticKind.presentations` without
 * reopening the file (R15). The part transition screen shows the label and
 * emoji (`arithmeticTransitionView` reads them). `needsPhysicalAbacus` is
 * §1.1's: linear follows the part's `useAbacus` (the ramp). The transition
 * view still asks `type === 'abacus'` until K3 makes it read this, since a
 * ramp part would newly prompt for the abacus (amendment A10).
 *
 * `axes` are each presentation's ledger axes as `arithmeticKind.presentationOf`
 * answers for a part of that type, except `abacusAvailable`, which a part
 * decides (a linear part on the ramp keeps the working abacus, `useAbacus`):
 * the adapter reads it from the part until K3 makes `presentationOf` return
 * the `Presentation`.
 *
 * Client-safe: data only.
 */

import type { SessionPart } from '@/db/schema/session-plans'
import type { Presentation } from '../kind'

const abacus: Presentation<SessionPart> = {
  id: 'abacus',
  label: 'Abacus',
  emoji: '🧮',
  masteryMode: 'abacus',
  axes: { layer: 'abacus', modality: 'visual', abacusAvailable: true, input: 'keypad' },
  needsPhysicalAbacus: () => true,
  autoPause: true,
}

const visualization: Presentation<SessionPart> = {
  id: 'visualization',
  label: 'Visualization',
  emoji: '🧠',
  masteryMode: 'visualization',
  axes: { layer: 'visualization', modality: 'visual', abacusAvailable: false, input: 'keypad' },
  needsPhysicalAbacus: () => false,
  autoPause: true,
}

const linear: Presentation<SessionPart> = {
  id: 'linear',
  label: 'Equations',
  emoji: '✏️',
  masteryMode: 'linear',
  axes: { layer: 'linear', modality: 'visual', abacusAvailable: false, input: 'keypad' },
  needsPhysicalAbacus: (part) => part.useAbacus === true,
  autoPause: true,
}

/** Arithmetic's presentations, in offer order (abacus, visualization, linear; `part-gating.ts`) */
export const arithmeticPresentations: ReadonlyMap<string, Presentation<SessionPart>> = new Map(
  [abacus, visualization, linear].map((p) => [p.id, p])
)
