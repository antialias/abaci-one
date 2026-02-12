/**
 * Phi (Golden Ratio) Demo Narration Segments
 *
 * Matches goldenRatioDemo.ts: a Fibonacci golden-rectangle spiral
 * is built inside-out. A compass arm sweeps 90-degree arcs, adding
 * progressively larger squares. The rectangle's aspect ratio converges
 * toward phi (~1.618).
 *
 * The demo has NO on-screen text labels — narration carries all the
 * explanation.
 *
 * Progress distribution (exponential decay = 0.8):
 *   Steps 0–2   ~0.00–0.15  Innermost squares, rapid spiral
 *   Steps 3–5   ~0.15–0.35  Early growth, squares getting bigger
 *   Steps 6–9   ~0.35–0.55  Middle growth, pattern becoming clear
 *   Steps 10–20 ~0.55–0.80  Outer squares, settling down
 *   Steps 21–50 ~0.80–1.00  Final convergence, very fast
 *
 * NUM_LEVELS = 50 total arc steps.
 */

import type { DemoNarrationSegment } from './useConstantDemoNarration'

/** Shared voice direction for the golden ratio demo narrator. */
export const PHI_DEMO_TONE =
  'You are a gentle, amazed nature guide for a really smart 5-year-old. ' +
  'Connect everything to shells, flowers, and art. Speak with quiet wonder, like discovering a treasure.'

export const PHI_DEMO_SEGMENTS: DemoNarrationSegment[] = [
  // ── Inner spiral beginning ────────────────────────────────────
  {
    // Seg 0: First arcs — the compass starts spinning
    ttsText:
      'Watch this magic compass! It\'s drawing a spiral, ' +
      'spinning round and round. ' +
      'See how it starts really tiny in the middle?',
    startProgress: 0.00,
    endProgress: 0.12,
    animationDurationMs: 5000,
  },
  {
    // Seg 1: More inner arcs, colored frames appearing
    ttsText:
      'Each time it turns, it adds a new square — ' +
      'and each square is a little bigger than the last one! ' +
      'See the colored boxes growing outward?',
    startProgress: 0.12,
    endProgress: 0.28,
    animationDurationMs: 5500,
  },

  // ── Growth becoming visible ───────────────────────────────────
  {
    // Seg 2: Pattern becoming clear
    ttsText:
      'It\'s building a special rectangle. ' +
      'This spiral follows a secret recipe — ' +
      'each new piece is the two before it added together! ' +
      'One, one, two, three, five, eight...',
    startProgress: 0.28,
    endProgress: 0.45,
    animationDurationMs: 6000,
  },
  {
    // Seg 3: Mid-spiral, shape settling
    ttsText:
      'Look at the shape of the box. ' +
      'It\'s getting more and more... perfect. ' +
      'Not too long, not too wide — just right.',
    startProgress: 0.45,
    endProgress: 0.60,
    animationDurationMs: 5000,
  },

  // ── Outer squares, convergence ────────────────────────────────
  {
    // Seg 4: Connection to nature
    ttsText:
      'You know what? This spiral shows up everywhere in nature! ' +
      'Snail shells curl this way. Sunflower seeds swirl this way. ' +
      'Even hurricanes spin in this same special shape!',
    startProgress: 0.60,
    endProgress: 0.78,
    animationDurationMs: 6500,
  },
  {
    // Seg 5: Final convergence — arcs fly by
    ttsText:
      'Now it\'s going faster and faster — but the rectangle ' +
      'has already found its perfect shape. ' +
      'No matter how many squares we add, it barely changes anymore.',
    startProgress: 0.78,
    endProgress: 0.92,
    animationDurationMs: 5000,
  },

  // ── Reveal ────────────────────────────────────────────────────
  {
    // Seg 6: The golden ratio revealed
    ttsText:
      'That perfect shape is the golden ratio — about one point six one eight. ' +
      'People call it phi. ' +
      'Artists use it to make beautiful paintings, ' +
      'architects use it to build beautiful buildings, ' +
      'and nature uses it to grow beautiful shells and flowers. ' +
      'It\'s the universe\'s favorite shape!',
    startProgress: 0.92,
    endProgress: 1.00,
    animationDurationMs: 9000,
  },
]
