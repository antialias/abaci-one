import type { TutorialSubStep } from '../types'

/**
 * Tutorial sub-steps for Proposition I.2.
 * Each inner array corresponds to one proposition step (indices 0–9).
 *
 * I.2 is complex: it reuses I.1 to build an equilateral triangle, then
 * uses two more circles to transfer a distance. The tutorial walks the
 * student through every micro-gesture.
 */
export function getProp2Tutorial(isTouch: boolean): TutorialSubStep[][] {
  const tap = isTouch ? 'Tap' : 'Click'
  const tapHold = isTouch ? 'Tap and hold' : 'Click and hold'
  const drag = isTouch ? 'Drag' : 'Drag'
  const sweep = isTouch ? 'Sweep your finger' : 'Move your mouse'

  return [
    // ── Step 0: Join A to B ──
    [
      {
        instruction: `${drag} from A to B`,
        speech: isTouch
          ? "First, we need to connect point A to one end of the given line. Put your finger on A and drag it to B."
          : "First, we need to connect point A to one end of the given line. Click A and drag to B.",
        hint: { type: 'arrow', fromId: 'pt-A', toId: 'pt-B' },
        advanceOn: null,
      },
    ],

    // ── Step 1: Circle centered at A through B ──
    [
      {
        instruction: `${tapHold} point A`,
        speech: isTouch
          ? "Now we'll build an equilateral triangle on line AB — just like Proposition One! Press and hold on A."
          : "Now we'll build an equilateral triangle on line AB — just like Proposition One! Click and hold on A.",
        hint: { type: 'point', pointId: 'pt-A' },
        advanceOn: 'center-set',
      },
      {
        instruction: `${drag} to point B`,
        speech: isTouch
          ? 'Drag to B to set the radius.'
          : 'Drag to B to set the radius.',
        hint: { type: 'arrow', fromId: 'pt-A', toId: 'pt-B' },
        advanceOn: 'radius-set',
      },
      {
        instruction: `${sweep} all the way around`,
        speech: isTouch
          ? 'Sweep all the way around to draw the circle!'
          : 'Move all the way around to draw the circle!',
        hint: { type: 'sweep', centerId: 'pt-A', radiusPointId: 'pt-B' },
        advanceOn: null,
      },
    ],

    // ── Step 2: Circle centered at B through A ──
    [
      {
        instruction: `${tapHold} point B`,
        speech: isTouch
          ? 'Now the second circle. Press and hold on B.'
          : 'Now the second circle. Click and hold on B.',
        hint: { type: 'point', pointId: 'pt-B' },
        advanceOn: 'center-set',
      },
      {
        instruction: `${drag} to point A`,
        speech: isTouch
          ? 'Drag to A.'
          : 'Drag to A.',
        hint: { type: 'arrow', fromId: 'pt-B', toId: 'pt-A' },
        advanceOn: 'radius-set',
      },
      {
        instruction: `${sweep} around again`,
        speech: isTouch
          ? 'Sweep around again!'
          : 'Move around again!',
        hint: { type: 'sweep', centerId: 'pt-B', radiusPointId: 'pt-A' },
        advanceOn: null,
      },
    ],

    // ── Step 3: Mark intersection D ──
    [
      {
        instruction: `${tap} where the circles cross`,
        speech: "See where the two circles cross? Tap there to mark point D. That completes our equilateral triangle!",
        hint: { type: 'candidates', ofA: 'cir-1', ofB: 'cir-2' },
        advanceOn: null,
      },
    ],

    // ── Step 4: Segment D → A ──
    [
      {
        instruction: `${drag} from D to A`,
        speech: isTouch
          ? "Now draw a line from D down to A. This is one side of the triangle."
          : "Now draw a line from D to A. This is one side of the triangle.",
        hint: { type: 'arrow', fromId: 'pt-D', toId: 'pt-A' },
        advanceOn: null,
      },
    ],

    // ── Step 5: Segment D → B ──
    [
      {
        instruction: `${drag} from D to B`,
        speech: isTouch
          ? "And one more line from D to B. Now we have a complete triangle!"
          : "And one more from D to B. Triangle complete!",
        hint: { type: 'arrow', fromId: 'pt-D', toId: 'pt-B' },
        advanceOn: null,
      },
    ],

    // ── Step 6: Circle at B through C ──
    [
      {
        instruction: `${tapHold} point B`,
        speech: isTouch
          ? "Here's the clever part. We need to copy the length of line BC. Press and hold on B."
          : "Here's the clever part. We need to copy the length of line BC. Click and hold on B.",
        hint: { type: 'point', pointId: 'pt-B' },
        advanceOn: 'center-set',
      },
      {
        instruction: `${drag} to point C`,
        speech: isTouch
          ? 'Drag to C — this makes the circle the same size as the given line.'
          : 'Drag to C — this makes the circle match the given line.',
        hint: { type: 'arrow', fromId: 'pt-B', toId: 'pt-C' },
        advanceOn: 'radius-set',
      },
      {
        instruction: `${sweep} around`,
        speech: isTouch
          ? 'Sweep around to draw the circle!'
          : 'Move around to draw the circle!',
        hint: { type: 'sweep', centerId: 'pt-B', radiusPointId: 'pt-C' },
        advanceOn: null,
      },
    ],

    // ── Step 7: Mark intersection E (Euclid's G) ──
    [
      {
        instruction: `${tap} where the circle crosses line DB, past B`,
        speech:
          "See where the new circle crosses the line from D through B? Tap the point on the far side of B — past B, away from D. That intersection captures the length we want to transfer.",
        hint: { type: 'candidates', ofA: 'cir-3', ofB: 'seg-4', beyondId: 'pt-B' },
        advanceOn: null,
      },
    ],

    // ── Step 8: Circle at D through E ──
    [
      {
        instruction: `${tapHold} point D`,
        speech: isTouch
          ? "Almost there! Now we use point D as a compass center. Press and hold on D."
          : "Almost there! Now we use point D as a compass center. Click and hold on D.",
        hint: { type: 'point', pointId: 'pt-D' },
        advanceOn: 'center-set',
      },
      {
        instruction: `${drag} to point E`,
        speech: isTouch
          ? 'Drag to the point E we just marked.'
          : 'Drag to point E.',
        hint: { type: 'arrow', fromId: 'pt-D', toId: 'pt-E' },
        advanceOn: 'radius-set',
      },
      {
        instruction: `${sweep} around`,
        speech: isTouch
          ? "Sweep all the way around. This is the big circle that transfers the distance!"
          : "Move all the way around. This big circle transfers the distance!",
        hint: { type: 'sweep', centerId: 'pt-D', radiusPointId: 'pt-E' },
        advanceOn: null,
      },
    ],

    // ── Step 9: Mark intersection F (Euclid's L) ──
    [
      {
        instruction: `${tap} where the big circle crosses line DA, past A`,
        speech:
          "See where the big circle crosses the line from D through A? Tap the point past A — on the far side from D. The line from A to that new point is exactly the same length as BC!",
        hint: { type: 'candidates', ofA: 'cir-4', ofB: 'seg-3', beyondId: 'pt-A' },
        advanceOn: null,
      },
    ],
  ]
}
