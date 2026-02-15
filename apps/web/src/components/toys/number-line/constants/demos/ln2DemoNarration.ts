/**
 * ln(2) Demo Narration Segments: "The Bouncing Ball"
 *
 * Pure data file — no React. Each segment maps a revealProgress range
 * to a TTS utterance and a minimum animation duration.
 *
 * Progress ranges are derived from ln2Demo.ts's phase constants:
 *
 *   Seg 0  0.00–0.08  Place — ball fades in at 0
 *   Seg 1  0.08–0.35  First bounces — bounces 1–4 with subdivision visual
 *   Seg 2  0.35–0.55  More bounces — bounces 5–12, faster
 *   Seg 3  0.55–0.72  Cascade — accelerating bounces
 *   Seg 4  0.72–0.86  Converge — spiral closes
 *   Seg 5  0.86–1.00  Reveal — star, label, celebration
 */

import type { DemoNarrationSegment } from './useConstantDemoNarration'

/** Shared voice direction for the ln(2) demo narrator. */
export const LN2_DEMO_TONE =
  'You are a warm, curious guide for a really smart 5-year-old. ' +
  'Help the child notice the PATTERN in the bouncing — each jump is ' +
  'a fraction of the first: the whole, then half, a third, a quarter. ' +
  'Build wonder about where the ball gets trapped. ' +
  'Connect to doubling: ln(2) is the special number hiding inside every time something doubles.'

export const LN2_DEMO_SEGMENTS: DemoNarrationSegment[] = [
  // ── Place ───────────────────────────────────────────────────────────
  {
    ttsText:
      "Look! Here comes a little ball. " +
      "It's sitting right on zero, ready to bounce!",
    startProgress: 0.00,
    endProgress: 0.08,
    animationDurationMs: 3500,
    scrubberLabel: 'The ball appears',
  },

  // ── First bounces ──────────────────────────────────────────────────
  {
    ttsText:
      "A big bounce to the right — all the way to ONE! " +
      "Now it bounces back, but only HALF as far. See? Half of the first jump. " +
      "Forward again — only a THIRD as far this time! " +
      "And back — just a QUARTER of the first jump. " +
      "The whole thing, then half, a third, a quarter... see the pattern?",
    startProgress: 0.08,
    endProgress: 0.35,
    animationDurationMs: 14000,
    scrubberLabel: 'The pattern',
  },

  // ── More bounces ───────────────────────────────────────────────────
  {
    ttsText:
      "A fifth, a sixth, a seventh — " +
      "the jumps keep following the same pattern, and each one is smaller! " +
      "Back and forth, tighter and tighter.",
    startProgress: 0.35,
    endProgress: 0.55,
    animationDurationMs: 8000,
    scrubberLabel: 'Tighter and tighter',
  },

  // ── Cascade ────────────────────────────────────────────────────────
  {
    ttsText:
      "The ball keeps overshooting and coming back, " +
      "but it's getting trapped — it can't escape! " +
      "Every bounce pulls it closer to one special spot.",
    startProgress: 0.55,
    endProgress: 0.72,
    animationDurationMs: 6000,
    scrubberLabel: 'Getting trapped',
  },

  // ── Converge ──────────────────────────────────────────────────────
  {
    ttsText:
      "Can you even see the bounces now? " +
      "The ball is spiraling in, faster and faster — " +
      "it can't go anywhere else!",
    startProgress: 0.72,
    endProgress: 0.86,
    animationDurationMs: 6000,
    scrubberLabel: 'Spiraling in',
  },

  // ── Reveal ─────────────────────────────────────────────────────────
  {
    ttsText:
      "That spot is called the natural log of two! " +
      "It's about zero point six nine three. " +
      "Whenever something DOUBLES — like one cookie becoming two — " +
      "this number is hiding inside, telling you how fast it grew.",
    startProgress: 0.86,
    endProgress: 1.00,
    animationDurationMs: 7000,
    scrubberLabel: 'Natural log of two',
  },
]
