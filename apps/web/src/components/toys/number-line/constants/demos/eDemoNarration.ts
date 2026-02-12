/**
 * e Demo Narration Segments
 *
 * Pure data file — no React. Each segment maps a revealProgress range
 * to a TTS utterance and a minimum animation duration. The narration
 * hook sweeps revealProgress from startProgress to endProgress over
 * animationDurationMs, gated by TTS completion at each boundary.
 *
 * Progress ranges are derived from eDemo.ts's LEVELS and phase constants:
 *
 *   LEVELS[0]  n=1    0.06–0.14   Day 1
 *   LEVELS[1]  n=2    0.14–0.40   Day 2 (centerpiece — 5 fine-grained segments)
 *   LEVELS[2]  n=3    0.40–0.47   Day 3
 *   LEVELS[3]  n=4    0.47–0.53   Day 4
 *   LEVELS[4-5] n=6,8 0.53–0.61   Days 5–6
 *   LEVELS[6-9] n=12+ 0.61–0.73   Days 7–10
 *   SMOOTH          0.73–0.83   Continuous growth
 *   CONVERGE        0.83–0.92   Convergence to e
 *   LABELS          0.92–1.00   Final reveal
 */

export interface EDemoNarrationSegment {
  /** Text sent to TTS for this segment */
  ttsText: string
  /** TTS tone override — falls back to E_DEMO_TONE */
  ttsTone?: string
  /** revealProgress value at which this segment starts */
  startProgress: number
  /** revealProgress value at which this segment ends */
  endProgress: number
  /** Minimum wall-clock time (ms) to sweep from start to end */
  animationDurationMs: number
}

/** Shared voice direction for the e demo narrator. */
export const E_DEMO_TONE =
  'You are a warm, delighted nature guide for a really smart 5-year-old. ' +
  'Ground everything in growing plants and sharing cookies. Be full of wonder and encouragement.'

export const E_DEMO_SEGMENTS: EDemoNarrationSegment[] = [
  // ── Seed vine + Day 1 ──────────────────────────────────────────
  {
    // Seg 0: Seed vine appears (0.00–0.06) + Day 1 single hop (0.06–0.14)
    ttsText:
      'Look! A tiny vine is growing on the number line. ' +
      'It starts at zero and stretches all the way to one. ' +
      'On Day One, the vine takes one big leap and doubles in size!',
    startProgress: 0.00,
    endProgress: 0.14,
    animationDurationMs: 7000,
  },

  // ── Day 2: compound growth explanation (5 segments) ────────────
  {
    // Seg 1: Day 2 retract + intro — vine shrinks back to 1
    ttsText:
      'Now let\'s try something different. ' +
      'On Day Two, instead of one big hop, ' +
      'we split the vine into two equal pieces.',
    startProgress: 0.14,
    endProgress: 0.21,
    animationDurationMs: 5000,
  },
  {
    // Seg 2: Day 2 hop 1 — first piece grows
    ttsText:
      'Each piece grows by half its size. ' +
      'Watch the first piece make a hop!',
    startProgress: 0.21,
    endProgress: 0.27,
    animationDurationMs: 4000,
  },
  {
    // Seg 3: Day 2 rest — explain compound growth insight
    ttsText:
      'Now here\'s the magic part. The vine is bigger now! ' +
      'So when we split it into pieces again, each piece is bigger too.',
    startProgress: 0.27,
    endProgress: 0.32,
    animationDurationMs: 5000,
  },
  {
    // Seg 4: Day 2 hop 2 — second piece grows (bigger hop!)
    ttsText:
      'And a bigger piece means a bigger hop! ' +
      'See? The second hop went farther than the first one!',
    startProgress: 0.32,
    endProgress: 0.37,
    animationDurationMs: 4500,
  },
  {
    // Seg 5: Day 2 result
    ttsText:
      'Two hops, and the vine grew more than it did with just one big leap. ' +
      'Sharing the work made the vine bigger!',
    startProgress: 0.37,
    endProgress: 0.40,
    animationDurationMs: 4500,
  },

  // ── Days 3–4 ──────────────────────────────────────────────────
  {
    // Seg 6: Day 3 (n=3)
    ttsText:
      'Day Three — three helpers this time! ' +
      'More helpers means more chances to grow. The vine keeps getting bigger.',
    startProgress: 0.40,
    endProgress: 0.47,
    animationDurationMs: 5000,
  },
  {
    // Seg 7: Day 4 (n=4)
    ttsText:
      'Day Four — four helpers! ' +
      'See how each day, the vine gets just a little bit longer?',
    startProgress: 0.47,
    endProgress: 0.53,
    animationDurationMs: 4500,
  },

  // ── Days 5–6 (grouped) ────────────────────────────────────────
  {
    // Seg 8: Days 5–6 (n=6, n=8)
    ttsText:
      'More and more helpers join in! ' +
      'Six helpers, then eight — the vine is creeping closer and closer to the star.',
    startProgress: 0.53,
    endProgress: 0.61,
    animationDurationMs: 5000,
  },

  // ── Days 7–10 (grouped) ───────────────────────────────────────
  {
    // Seg 9: Days 7–10 (n=12, 20, 50, 100)
    ttsText:
      'Now it\'s getting fast! Twelve helpers, twenty, fifty, a hundred! ' +
      'With so many tiny helpers, the vine barely has to slow down between hops.',
    startProgress: 0.61,
    endProgress: 0.73,
    animationDurationMs: 5500,
  },

  // ── Smooth growth (n → ∞) ─────────────────────────────────────
  {
    // Seg 10: Continuous growth — all pieces grow together
    ttsText:
      'And now — imagine infinite helpers, all growing together at the same time. ' +
      'The vine doesn\'t hop anymore. It just flows, smooth and steady.',
    startProgress: 0.73,
    endProgress: 0.83,
    animationDurationMs: 6000,
  },

  // ── Convergence ───────────────────────────────────────────────
  {
    // Seg 11: All the results converge to one point
    ttsText:
      'Look at where all those vines ended up. ' +
      'Each day, the vine got a tiny bit closer to that star. ' +
      'It gets closer and closer but never quite reaches it.',
    startProgress: 0.83,
    endProgress: 0.92,
    animationDurationMs: 6000,
  },

  // ── Final reveal ──────────────────────────────────────────────
  {
    // Seg 12: The number e revealed
    ttsText:
      'That spot, right there, is the perfect growth number. ' +
      'Mathematicians call it "e." ' +
      'It\'s about two point seven one eight, and it shows up everywhere in nature — ' +
      'in how plants grow, how populations spread, even how your savings account works!',
    startProgress: 0.92,
    endProgress: 1.00,
    animationDurationMs: 8000,
  },
]
