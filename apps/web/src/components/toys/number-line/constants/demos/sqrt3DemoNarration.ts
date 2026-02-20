/**
 * √3 Demo Narration Segments: "The Tallest Triangle"
 *
 * Pure data file — no React. Each segment maps a revealProgress range
 * to a TTS utterance and a minimum animation duration.
 *
 * Progress ranges are derived from sqrt3Demo.ts's phase constants:
 *
 *   Seg 0  0.00–0.12  Base — highlight segment from −1 to 1
 *   Seg 1  0.12–0.30  Build — compass-swing equilateral triangle
 *   Seg 2  0.30–0.47  Height — dashed altitude drops from apex
 *   Seg 3  0.47–0.65  Rotate — compass swings height to number line
 *   Seg 4  0.65–0.80  Mystery — question mark at landing spot
 *   Seg 5  0.80–1.00  Reveal — star, label, celebration
 */

import type { DemoNarrationSegment } from './useConstantDemoNarration'

/** Shared voice direction for the √3 demo narrator. */
export const SQRT3_DEMO_TONE =
  'You are a warm, curious builder-guide for a really smart 5-year-old. ' +
  'Ground everything in building triangles and measuring heights. ' +
  'Build excitement about the mystery number. ' +
  'Be genuinely amazed when it never ends.'

export const SQRT3_DEMO_SEGMENTS: DemoNarrationSegment[] = [
  // ── Base ──────────────────────────────────────────────────────────
  {
    ttsText:
      "Let's build something! " +
      "Here's our base — a line from minus one to one. " +
      "That's two whole units long.",
    startProgress: 0.0,
    endProgress: 0.12,
    animationDurationMs: 4500,
    scrubberLabel: 'The base',
  },

  // ── Build ─────────────────────────────────────────────────────────
  {
    ttsText:
      "Now let's make a PERFECT triangle — one where every side is the SAME length as the base. " +
      "Watch — we'll swing a copy up from each end, just like a compass!",
    startProgress: 0.12,
    endProgress: 0.3,
    animationDurationMs: 6500,
    scrubberLabel: 'Building triangle',
  },

  // ── Height ────────────────────────────────────────────────────────
  {
    ttsText:
      'Beautiful! But how TALL is our triangle? ' +
      "Let's drop a line straight down from the tip. " +
      "That's the height! I wonder how long it is...",
    startProgress: 0.3,
    endProgress: 0.47,
    animationDurationMs: 6000,
    scrubberLabel: 'The height',
  },

  // ── Rotate ────────────────────────────────────────────────────────
  {
    ttsText:
      "Let's measure it! " +
      "We'll swing the height down onto the number line, like using a compass. " +
      'Watch it rotate...',
    startProgress: 0.47,
    endProgress: 0.65,
    animationDurationMs: 6000,
    scrubberLabel: 'Measuring it',
  },

  // ── Mystery ───────────────────────────────────────────────────────
  {
    ttsText: 'It landed past one but before two. ' + 'What IS this mystery number?',
    startProgress: 0.65,
    endProgress: 0.8,
    animationDurationMs: 5000,
    scrubberLabel: 'Mystery number',
  },

  // ── Reveal ────────────────────────────────────────────────────────
  {
    ttsText:
      'This is the square root of three! ' +
      "It's the height of every perfect triangle, " +
      'and it shows up in honeycombs, crystals, and nature everywhere!',
    startProgress: 0.8,
    endProgress: 1.0,
    animationDurationMs: 5500,
    scrubberLabel: 'Square root of three',
  },
]
