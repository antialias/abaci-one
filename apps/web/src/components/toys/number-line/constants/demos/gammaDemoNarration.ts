/**
 * γ Demo Narration Segments: "The Sharing Slide"
 *
 * Pure data file — no React. Each segment maps a revealProgress range
 * to a TTS utterance and a minimum animation duration.
 *
 * Progress ranges are derived from gammaDemo.ts's PHASE constants:
 *
 *   Seg 0  0.00–0.10  One friend, one whole cookie
 *   Seg 1  0.10–0.20  Two friends share
 *   Seg 2  0.20–0.34  Three friends + "what about in-between?"
 *   Seg 3  0.34–0.48  The sharing slide emerges
 *   Seg 4  0.48–0.57  Highlight the extra bits (crescents)
 *   Seg 5  0.57–0.65  Rapid cascade of more friends
 *   Seg 6  0.65–0.86  Collect the crescents into the gamma bar
 *   Seg 7  0.86–1.00  The reveal of gamma
 */

import type { DemoNarrationSegment } from './useConstantDemoNarration'

/** Shared voice direction for the γ demo narrator. */
export const GAMMA_DEMO_TONE =
  'You are a warm, playful math guide for a really smart 5-year-old. ' +
  'Ground everything in sharing cookies and playground slides. ' +
  'Build wonder gradually — start simple, let curiosity grow. ' +
  'Be genuinely amazed when the extras converge.'

export const GAMMA_DEMO_SEGMENTS: DemoNarrationSegment[] = [
  // ── One friend ──────────────────────────────────────────────────
  {
    ttsText:
      'Imagine sharing a yummy cookie! ' +
      'If there\'s just one friend, they get the whole thing. ' +
      'One friend, one whole cookie!',
    startProgress: 0.00,
    endProgress: 0.10,
    animationDurationMs: 5000,
  },

  // ── Two friends ─────────────────────────────────────────────────
  {
    ttsText:
      'Now two friends want to share. ' +
      'Each one gets half — see how the step is shorter? ' +
      'More friends means smaller pieces!',
    startProgress: 0.10,
    endProgress: 0.20,
    animationDurationMs: 5500,
  },

  // ── Three friends + the question ────────────────────────────────
  {
    ttsText:
      'With three friends, each gets a third. ' +
      'But wait — what about one-and-a-half friends? ' +
      'Or two-and-a-quarter? What if sharing could be perfectly smooth?',
    startProgress: 0.20,
    endProgress: 0.34,
    animationDurationMs: 7000,
  },

  // ── The slide emerges ───────────────────────────────────────────
  {
    ttsText:
      'This is the sharing slide! ' +
      'It shows the perfect share for any number of friends. ' +
      'Smooth and gentle, just like a playground slide — steep at the top, gentle at the bottom.',
    startProgress: 0.34,
    endProgress: 0.48,
    animationDurationMs: 7000,
  },

  // ── The extra bits ──────────────────────────────────────────────
  {
    ttsText:
      'See those golden bits? ' +
      'The blocky steps are always a teeny bit taller than the smooth slide. ' +
      'Each step pokes up just a little!',
    startProgress: 0.48,
    endProgress: 0.57,
    animationDurationMs: 5500,
  },

  // ── Rapid cascade ───────────────────────────────────────────────
  {
    ttsText:
      'More friends means tinier extras. ' +
      'Four friends, five, six, seven, eight, nine, ten! ' +
      'The extras get tinier and tinier.',
    startProgress: 0.57,
    endProgress: 0.65,
    animationDurationMs: 5000,
  },

  // ── Collection ──────────────────────────────────────────────────
  {
    ttsText:
      'Now let\'s collect all those little extra bits and line them up! ' +
      'The big ones go first, then the smaller ones. ' +
      'See how the bar grows fast at first, then slower and slower?',
    startProgress: 0.65,
    endProgress: 0.86,
    animationDurationMs: 8000,
  },

  // ── The reveal ──────────────────────────────────────────────────
  {
    ttsText:
      'All those tiny extras add up to a very special number. ' +
      'Mathematicians call it gamma! ' +
      'It\'s about zero point five seven seven, and it pops up all over mathematics — ' +
      'whenever sharing and smoothness play together.',
    startProgress: 0.86,
    endProgress: 1.00,
    animationDurationMs: 7000,
  },
]
