/**
 * Tau Demo Narration Segments
 *
 * Matches the tauDemo.ts animation: a circle with radius 1 (diameter 2)
 * is constructed on the number line, then rolls one full turn.
 * The distance it rolls is tau (2*pi ~ 6.283).
 *
 * Progress ranges from tauDemo.ts:
 *   CONSTRUCTION (0.00–0.30):
 *     Highlight  0.00–0.06  "1 to edge" glows on axis
 *     Pivot      0.06–0.15  segment swings to vertical
 *     Sweep      0.15–0.255 arc traces full circle (with compass arm)
 *     Treads     0.255–0.30 tire marks sprout
 *   ROLLING (0.30–0.92):
 *     Circle rolls rightward; pi halfway mark appears at t >= 0.5
 *   LABELS (0.92–1.00):
 *     "tau", "full turn", "C = tau*r" fade in
 */

import type { DemoNarrationSegment } from './useConstantDemoNarration'

/** Shared voice direction for the tau demo narrator. */
export const TAU_DEMO_TONE =
  'You are an excited, warm science teacher for a really smart 5-year-old. ' +
  'Use everyday objects like bicycle wheels, hula hoops, and merry-go-rounds. Be full of wonder.'

export const TAU_DEMO_SEGMENTS: DemoNarrationSegment[] = [
  // ── Construction ──────────────────────────────────────────────
  {
    // Seg 0: Highlight — the red "1 to edge" stick appears
    ttsText:
      'This time, the red stick goes from the middle of our wheel to the edge. ' +
      'That\'s called the radius — one unit from center to edge.',
    startProgress: 0.00,
    endProgress: 0.06,
    animationDurationMs: 5000,
  },
  {
    // Seg 1: Pivot — stick swings up to vertical
    ttsText:
      'Let\'s stand it up — whoosh! ' +
      'Now let\'s build a circle around it.',
    startProgress: 0.06,
    endProgress: 0.15,
    animationDurationMs: 3500,
  },
  {
    // Seg 2: Sweep — teal arc traces with compass arm
    ttsText:
      'See the compass spinning around? ' +
      'It\'s drawing a big circle — like tracing around a hula hoop! ' +
      'This circle is bigger than the pi one because its radius is the whole stick.',
    startProgress: 0.15,
    endProgress: 0.255,
    animationDurationMs: 5000,
  },
  {
    // Seg 3: Treads appear
    ttsText:
      'Tire bumps! This is a big wheel now — ready to roll!',
    startProgress: 0.255,
    endProgress: 0.30,
    animationDurationMs: 2500,
  },

  // ── Rolling ───────────────────────────────────────────────────
  {
    // Seg 4: First stretch of rolling, before pi mark
    ttsText:
      'And off it goes! This big wheel is rolling along the number line. ' +
      'Watch how much farther it goes than the little pi wheel!',
    startProgress: 0.30,
    endProgress: 0.55,
    animationDurationMs: 5500,
  },
  {
    // Seg 5: Passing the pi halfway mark
    ttsText:
      'Look! We just passed pi — but we\'re only halfway around! ' +
      'The wheel has so much more spinning to do.',
    startProgress: 0.55,
    endProgress: 0.72,
    animationDurationMs: 5000,
  },
  {
    // Seg 6: Final stretch of rolling
    ttsText:
      'Keep going, keep going... almost one full turn... ' +
      'past four, past five, past six...',
    startProgress: 0.72,
    endProgress: 0.92,
    animationDurationMs: 5000,
  },

  // ── Labels ────────────────────────────────────────────────────
  {
    // Seg 7: Final reveal
    ttsText:
      'There it is! That number is called tau. ' +
      'It\'s about six point two eight — exactly twice pi! ' +
      'Tau is the distance a wheel rolls in one full turn, ' +
      'measured from its center to its edge. ' +
      'One full spin, one tau — easy to remember!',
    startProgress: 0.92,
    endProgress: 1.00,
    animationDurationMs: 8000,
  },
]
