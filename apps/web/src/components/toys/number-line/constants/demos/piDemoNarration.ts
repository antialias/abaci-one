/**
 * Pi Demo Narration Segments
 *
 * Matches the piDemo.ts animation: a circle with diameter 1 is
 * constructed on the number line, then rolls one full turn.
 * The distance it rolls is pi.
 *
 * Progress ranges from piDemo.ts:
 *   CONSTRUCTION (0.00–0.30):
 *     Highlight  0.00–0.06  "1 across" glows on axis
 *     Pivot      0.06–0.15  segment swings to vertical
 *     Sweep      0.15–0.255 arc traces full circle
 *     Treads     0.255–0.30 tire marks sprout
 *   ROLLING (0.30–0.82):
 *     Circle rolls rightward, circumference unrolls onto axis
 *   LABELS (0.82–0.90):
 *     "pi", "one turn", "C = pid" fade in
 *   ZOOM (0.90–1.00):
 *     Irrationality zoom — digits never end
 */

import type { DemoNarrationSegment } from './useConstantDemoNarration'

/** Shared voice direction for the pi demo narrator. */
export const PI_DEMO_TONE =
  'You are a playful, encouraging teacher for a really smart 5-year-old. ' +
  'Use everyday objects like cookies, wheels, and toys. Be amazed and delighted by everything.'

export const PI_DEMO_SEGMENTS: DemoNarrationSegment[] = [
  // ── Construction ──────────────────────────────────────────────
  {
    // Seg 0: Highlight — the red "1 across" stick appears
    ttsText:
      'See that red stick on the number line? ' +
      'It goes from zero all the way to one. ' +
      'That\'s exactly one unit long — like one cookie across!',
    startProgress: 0.00,
    endProgress: 0.06,
    animationDurationMs: 5000,
  },
  {
    // Seg 1: Pivot — stick swings up to become vertical diameter
    ttsText:
      'Now watch! Let\'s tip that stick straight up — boing! ' +
      'That stick is going to be the width of a wheel.',
    startProgress: 0.06,
    endProgress: 0.15,
    animationDurationMs: 4000,
  },
  {
    // Seg 2: Sweep — blue arc traces the full circle
    ttsText:
      'Let\'s trace around it and make a circle — ' +
      'like drawing around a cookie with a crayon! ' +
      'See? A perfect little wheel, one cookie wide.',
    startProgress: 0.15,
    endProgress: 0.255,
    animationDurationMs: 5000,
  },
  {
    // Seg 3: Treads appear
    ttsText:
      'And look — little bumps! ' +
      'Now it has tire treads, just like a real wheel. Ready to roll!',
    startProgress: 0.255,
    endProgress: 0.30,
    animationDurationMs: 3000,
  },

  // ── Rolling ───────────────────────────────────────────────────
  {
    // Seg 4: First half of roll
    ttsText:
      'Here it goes! The wheel is rolling along the number line. ' +
      'Watch the blue paint it leaves behind on the ground — ' +
      'that\'s how far it\'s traveled!',
    startProgress: 0.30,
    endProgress: 0.55,
    animationDurationMs: 6000,
  },
  {
    // Seg 5: Second half of roll, approaching pi
    ttsText:
      'Keep rolling, keep rolling... almost done with one full spin. ' +
      'Where will it stop? ' +
      'A little bit past three!',
    startProgress: 0.55,
    endProgress: 0.82,
    animationDurationMs: 6000,
  },

  // ── Labels ────────────────────────────────────────────────────
  {
    // Seg 6: Pi reveal
    ttsText:
      'Three and a little bit more! That special number is called pi. ' +
      'Whenever a wheel makes one full turn, it rolls exactly pi times its width. ' +
      'Every wheel in the whole world follows that rule!',
    startProgress: 0.82,
    endProgress: 0.90,
    animationDurationMs: 7000,
  },

  // ── Irrationality zoom ────────────────────────────────────────
  {
    // Seg 7: Zoom in on the digits
    ttsText:
      'But here\'s the really amazing thing. ' +
      'If we zoom in close, pi is past three point one four. ' +
      'Even closer — past three point one four one five nine! ' +
      'The numbers keep going and never, ever stop. ' +
      'Pi is a truly special number that goes on forever!',
    startProgress: 0.90,
    endProgress: 1.00,
    animationDurationMs: 7000,
  },
]
