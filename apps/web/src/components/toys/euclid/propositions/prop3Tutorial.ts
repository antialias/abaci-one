import type { TutorialSubStep } from '../types'

/**
 * Tutorial sub-steps for Proposition I.3.
 * Each inner array corresponds to one proposition step (indices 0–2).
 *
 * I.3 uses the I.2 macro to transfer the shorter segment's length to point A,
 * then uses a circle to cut off the equal length from the longer segment.
 */
export function getProp3Tutorial(isTouch: boolean): TutorialSubStep[][] {
  const tap = isTouch ? 'Tap' : 'Click'
  const tapHold = isTouch ? 'Tap and hold' : 'Click and hold'
  const drag = isTouch ? 'Drag' : 'Drag'
  const sweep = isTouch ? 'Sweep your finger' : 'Move your mouse'

  return [
    // ── Step 0: Place at A a line equal to CD (I.2 macro) ──
    [
      {
        instruction: `${tap} point A`,
        speech: isTouch
          ? "We need to copy the length of line CD to point A. We'll use Proposition Two to do this. Tap point A first — that's where the copy goes."
          : "We need to copy the length of line CD to point A. We'll use Proposition Two to do this. Click point A first — that's where the copy goes.",
        hint: { type: 'point', pointId: 'pt-A' },
        advanceOn: { kind: 'macro-select', index: 0 },
      },
      {
        instruction: `${tap} point C`,
        speech: isTouch
          ? 'Now tap point C — the start of the shorter line.'
          : 'Now click point C — the start of the shorter line.',
        hint: { type: 'point', pointId: 'pt-C' },
        advanceOn: { kind: 'macro-select', index: 1 },
      },
      {
        instruction: `${tap} point D`,
        speech: isTouch
          ? 'Now tap point D to finish. This tells Proposition Two which line to copy.'
          : 'Now click point D to finish. This tells Proposition Two which line to copy.',
        hint: { type: 'point', pointId: 'pt-D' },
        advanceOn: null,
      },
    ],

    // ── Step 1: Draw circle centered at A through E ──
    [
      {
        instruction: `${tapHold} point A`,
        speech: isTouch
          ? "Now we'll use the compass. The new point E is exactly as far from A as CD is long. Press and hold on A."
          : "Now we'll use the compass. Point E is exactly as far from A as CD is long. Click and hold on A.",
        hint: { type: 'point', pointId: 'pt-A' },
        advanceOn: { kind: 'compass-phase', phase: 'center-set' },
      },
      {
        instruction: `${drag} to point E`,
        speech: isTouch
          ? 'Drag to point E — this sets the compass to the length we copied.'
          : 'Drag to point E — this sets the compass to the copied length.',
        hint: { type: 'arrow', fromId: 'pt-A', toId: 'pt-E' },
        advanceOn: { kind: 'compass-phase', phase: 'radius-set' },
      },
      {
        instruction: `${sweep} around`,
        speech: isTouch
          ? 'Sweep around to draw the circle!'
          : 'Move around to draw the circle!',
        hint: { type: 'sweep', centerId: 'pt-A', radiusPointId: 'pt-E' },
        advanceOn: null,
      },
    ],

    // ── Step 2: Mark where circle crosses AB → pt-F ──
    [
      {
        instruction: `${tap} where the circle crosses line AB`,
        speech:
          "See where the circle crosses line AB? Tap that intersection point. The line from A to that point is exactly the same length as CD — that's what we wanted to cut off!",
        hint: {
          type: 'candidates',
          ofA: { kind: 'circle', centerId: 'pt-A', radiusPointId: 'pt-E' },
          ofB: { kind: 'segment', fromId: 'pt-A', toId: 'pt-B' },
        },
        advanceOn: null,
      },
    ],
  ]
}
