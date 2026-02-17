import type { TutorialSubStep } from '../types'

/**
 * Tutorial sub-steps for Proposition I.1.
 * Each inner array corresponds to one proposition step (indices 0–4).
 * Sub-steps break the gesture into teachable micro-interactions.
 */
export function getProp1Tutorial(isTouch: boolean): TutorialSubStep[][] {
  const tap = isTouch ? 'Tap' : 'Click'
  const tapHold = isTouch ? 'Tap and hold' : 'Click and hold'
  const drag = isTouch ? 'Drag' : 'Drag'
  const sweep = isTouch ? 'Sweep your finger' : 'Move your mouse'
  const finger = isTouch ? 'finger' : 'mouse'

  return [
    // ── Step 0: Circle centered at A through B ──
    [
      {
        instruction: `${tapHold} point A`,
        speech: isTouch
          ? "Let's draw a circle! Press and hold on point A. That's where your compass goes."
          : "Let's draw a circle! Click and hold on point A. That's where your compass goes.",
        hint: { type: 'point', pointId: 'pt-A' },
        advanceOn: { kind: 'compass-phase', phase: 'center-set' },
      },
      {
        instruction: `${drag} to point B`,
        speech: isTouch
          ? 'Now drag your finger over to point B. This sets how big the circle will be.'
          : 'Now drag over to point B while holding the button. This sets the circle size.',
        hint: { type: 'arrow', fromId: 'pt-A', toId: 'pt-B' },
        advanceOn: { kind: 'compass-phase', phase: 'radius-set' },
      },
      {
        instruction: `${sweep} all the way around`,
        speech: isTouch
          ? 'Now sweep your finger all the way around to draw the circle. Just like a real compass!'
          : 'Now move your mouse all the way around in a big circle. Just like a real compass!',
        hint: { type: 'sweep', centerId: 'pt-A', radiusPointId: 'pt-B' },
        advanceOn: null,
      },
    ],

    // ── Step 1: Circle centered at B through A ──
    [
      {
        instruction: `${tapHold} point B`,
        speech: isTouch
          ? "Great! Now let's make another circle. This time, press and hold on point B."
          : "Great! Now let's make another circle. This time, click and hold on point B.",
        hint: { type: 'point', pointId: 'pt-B' },
        advanceOn: { kind: 'compass-phase', phase: 'center-set' },
      },
      {
        instruction: `${drag} to point A`,
        speech: isTouch
          ? 'Drag over to point A.'
          : 'Drag over to point A.',
        hint: { type: 'arrow', fromId: 'pt-B', toId: 'pt-A' },
        advanceOn: { kind: 'compass-phase', phase: 'radius-set' },
      },
      {
        instruction: `${sweep} around again`,
        speech: isTouch
          ? 'Sweep all the way around again!'
          : 'Move all the way around again!',
        hint: { type: 'sweep', centerId: 'pt-B', radiusPointId: 'pt-A' },
        advanceOn: null,
      },
    ],

    // ── Step 2: Mark intersection ──
    [
      {
        instruction: `${tap} where the circles cross`,
        speech: 'See where the two circles cross each other? Tap on that point to mark it.',
        hint: { type: 'candidates' },
        advanceOn: null,
      },
    ],

    // ── Step 3: Segment C → A ──
    [
      {
        instruction: `${drag} from C to A`,
        speech: isTouch
          ? "Now we'll draw straight lines to finish the triangle. Put your finger on point C and drag it to point A."
          : "Now we'll draw straight lines to finish the triangle. Click point C and drag to point A.",
        hint: { type: 'arrow', fromId: 'pt-C', toId: 'pt-A' },
        advanceOn: null,
      },
    ],

    // ── Step 4: Segment C → B ──
    [
      {
        instruction: `${drag} from C to B`,
        speech: isTouch
          ? 'One more line! Drag from C to B to complete the triangle.'
          : 'One more line! Click C and drag to B to finish.',
        hint: { type: 'arrow', fromId: 'pt-C', toId: 'pt-B' },
        advanceOn: null,
      },
    ],
  ]
}
