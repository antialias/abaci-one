import type { TutorialSubStep } from '../types'

/**
 * Tutorial sub-steps for Proposition I.4 (SAS Congruence).
 * One step → one sub-step array.
 */
export function getProp4Tutorial(isTouch: boolean): TutorialSubStep[][] {
  const tap = isTouch ? 'Tap' : 'Click'
  const tapHold = isTouch ? 'Tap and hold' : 'Click and hold'

  return [
    // ── Step 0: Draw segment EF (straightedge) ──
    [
      {
        instruction: `${tapHold} point E`,
        speech: isTouch
          ? "We're given two triangles with two sides and the included angle equal. Complete triangle DEF by pressing and holding on point E."
          : "We're given two triangles with two sides and the included angle equal. Complete triangle DEF by clicking and holding on point E.",
        hint: { type: 'point', pointId: 'pt-E' },
        advanceOn: null,
      },
    ],
  ]
}
