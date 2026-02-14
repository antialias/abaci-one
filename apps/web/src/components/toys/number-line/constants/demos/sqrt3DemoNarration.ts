/**
 * √3 Demo Narration Segments: "The Tallest Triangle"
 *
 * Pure data file — no React. Each segment maps a revealProgress range
 * to a TTS utterance and a minimum animation duration.
 *
 * Progress ranges are derived from sqrt3Demo.ts's phase constants:
 *
 *   Seg 0  0.00–0.10  Base — highlight segment from −1 to 1
 *   Seg 1  0.10–0.25  Build — equilateral triangle grows
 *   Seg 2  0.25–0.40  Height — dashed altitude drops from apex
 *   Seg 3  0.40–0.55  Rotate — compass swings height to number line
 *   Seg 4  0.55–0.65  Mystery — question mark at landing spot
 *   Seg 5  0.65–0.80  Proof — split triangle, Pythagorean theorem
 *   Seg 6  0.80–0.92  Zoom — irrationality zoom on decimals
 *   Seg 7  0.92–1.00  Reveal — star, label, formula
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
    startProgress: 0.00,
    endProgress: 0.10,
    animationDurationMs: 4500,
    scrubberLabel: 'The base',
  },

  // ── Build ─────────────────────────────────────────────────────────
  {
    ttsText:
      "Now let's make a PERFECT triangle — one where every side is the same! " +
      'Watch the sides grow up... and meet at the very tip!',
    startProgress: 0.10,
    endProgress: 0.25,
    animationDurationMs: 6500,
    scrubberLabel: 'Building triangle',
  },

  // ── Height ────────────────────────────────────────────────────────
  {
    ttsText:
      'Beautiful! But how TALL is our triangle? ' +
      "Let's drop a line straight down from the tip. " +
      "That's the height! I wonder how long it is...",
    startProgress: 0.25,
    endProgress: 0.40,
    animationDurationMs: 6000,
    scrubberLabel: 'The height',
  },

  // ── Rotate ────────────────────────────────────────────────────────
  {
    ttsText:
      "Let's measure it! " +
      "We'll swing the height down onto the number line, like using a compass. " +
      'Watch it rotate...',
    startProgress: 0.40,
    endProgress: 0.55,
    animationDurationMs: 6000,
    scrubberLabel: 'Measuring it',
  },

  // ── Mystery ───────────────────────────────────────────────────────
  {
    ttsText:
      'It landed past one but before two. ' +
      'What IS this mystery number?',
    startProgress: 0.55,
    endProgress: 0.65,
    animationDurationMs: 5000,
    scrubberLabel: 'Mystery number',
  },

  // ── Proof ─────────────────────────────────────────────────────────
  {
    ttsText:
      "Here's the trick! Cut the triangle in half. " +
      'Now we have a right triangle — the bottom is one, the long side is two. ' +
      'One squared plus the height squared equals two squared. ' +
      'So the height squared is... three!',
    startProgress: 0.65,
    endProgress: 0.80,
    animationDurationMs: 8000,
    scrubberLabel: 'Pythagorean proof',
  },

  // ── Zoom ──────────────────────────────────────────────────────────
  {
    ttsText:
      "If we zoom way in, it's one point seven three two. " +
      "And the digits keep going forever and ever! " +
      "It never stops and never repeats.",
    startProgress: 0.80,
    endProgress: 0.92,
    animationDurationMs: 6000,
    scrubberLabel: 'Digits go forever',
  },

  // ── Reveal ────────────────────────────────────────────────────────
  {
    ttsText:
      'This is the square root of three! ' +
      "It's the height of every perfect triangle, " +
      'and it shows up in honeycombs, crystals, and nature everywhere!',
    startProgress: 0.92,
    endProgress: 1.00,
    animationDurationMs: 5500,
    scrubberLabel: 'Square root of three',
  },
]
