/**
 * ln(2) Demo Narration Segments: "The Bouncing Ball"
 *
 * Pure data file — no React. Each segment maps a revealProgress range
 * to a TTS utterance and a minimum animation duration.
 *
 * Progress ranges are derived from ln2Demo.ts's phase constants:
 *
 *   Seg 0  0.00–0.08  Place — ball fades in at 0
 *   Seg 1  0.08–0.35  First bounces — bounces 1–4 with piece visualization
 *   Seg 2  0.35–0.55  More bounces — bounces 5–12, faster
 *   Seg 3  0.55–0.72  Cascade — bounces 13–26, rapid
 *   Seg 4  0.72–0.86  Converge — bounces 27–40, impossibly tiny
 *   Seg 5  0.86–1.00  Reveal — star, label, celebration
 */

import type { DemoNarrationSegment } from './useConstantDemoNarration'

/** Shared voice direction for the ln(2) demo narrator. */
export const LN2_DEMO_TONE =
  'You are a warm, excited sports-commentator guide for a really smart 5-year-old. ' +
  'Focus on the bouncing ball — it\'s physical, concrete, fun. ' +
  'Explain fractions as "pieces" of the first big bounce. ' +
  'Build anticipation about where the ball will finally stop.'

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
      "A big bounce to the right — all the way to ONE! That's the whole jump. " +
      "Now let's cut that jump into two equal pieces. The ball bounces back just ONE piece! " +
      "Three equal pieces — forward one piece! " +
      "Four pieces — back one piece! " +
      "See how each bounce gets a little smaller?",
    startProgress: 0.08,
    endProgress: 0.35,
    animationDurationMs: 14000,
    scrubberLabel: 'First bounces',
  },

  // ── More bounces ───────────────────────────────────────────────────
  {
    ttsText:
      "The pieces keep getting smaller — five, six, seven, eight! " +
      "Back and forth, back and forth. " +
      "Each bounce is tinier than the last!",
    startProgress: 0.35,
    endProgress: 0.55,
    animationDurationMs: 8000,
    scrubberLabel: 'More bounces',
  },

  // ── Cascade ────────────────────────────────────────────────────────
  {
    ttsText:
      "Now the bounces are so tiny you can barely see them! " +
      "The ball is wiggling closer and closer to one special spot.",
    startProgress: 0.55,
    endProgress: 0.72,
    animationDurationMs: 6000,
    scrubberLabel: 'Tiny bounces',
  },

  // ── Converge ──────────────────────────────────────────────────────
  {
    ttsText:
      "Can you even see them now? " +
      "The bounces are getting impossibly small — " +
      "the ball is trapped right around one special spot!",
    startProgress: 0.72,
    endProgress: 0.86,
    animationDurationMs: 6000,
    scrubberLabel: 'Spiraling in',
  },

  // ── Reveal ─────────────────────────────────────────────────────────
  {
    ttsText:
      "That special spot is called the natural log of two! " +
      "It's about zero point six nine three — " +
      "and the ball found it just by bouncing smaller and smaller!",
    startProgress: 0.86,
    endProgress: 1.00,
    animationDurationMs: 6000,
    scrubberLabel: 'Natural log of two',
  },
]
