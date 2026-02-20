/**
 * √2 Demo Narration Segments: "The Magic Shortcut"
 *
 * Pure data file — no React. Each segment maps a revealProgress range
 * to a TTS utterance and a minimum animation duration.
 *
 * Progress ranges are derived from sqrt2Demo.ts's phase constants:
 *
 *   Seg 0  0.00–0.10  The journey starts — dot at zero
 *   Seg 1  0.10–0.25  The long path — draw the square, walk two sides
 *   Seg 2  0.25–0.35  The shortcut — diagonal appears
 *   Seg 3  0.35–0.50  Measuring — compass rotation to number line
 *   Seg 4  0.50–0.60  The mystery spot — lands between 1 and 2
 *   Seg 5  0.60–0.80  Why it's that long — area squares proof
 *   Seg 6  0.80–0.92  The never-ending number — zoom in on decimals
 *   Seg 7  0.92–1.00  The reveal — √2 label
 */

import type { DemoNarrationSegment } from './useConstantDemoNarration'

/** Shared voice direction for the √2 demo narrator. */
export const SQRT2_DEMO_TONE =
  'You are a warm, adventurous guide for a really smart 5-year-old. ' +
  'Ground everything in shortcuts, paths, and exploring squares. ' +
  'Build mystery and excitement about the diagonal. ' +
  'Be genuinely amazed when the number never ends.'

export const SQRT2_DEMO_SEGMENTS: DemoNarrationSegment[] = [
  // ── The journey starts ──────────────────────────────────────────
  {
    ttsText: "Let's go on a journey! " + 'We start right here, at zero on the number line.',
    startProgress: 0.0,
    endProgress: 0.1,
    animationDurationMs: 4000,
    scrubberLabel: 'Starting at zero',
  },

  // ── The long path ───────────────────────────────────────────────
  {
    ttsText:
      'To get to the far corner, we can take the long way. ' +
      'One step over... and one step up! ' +
      "That's two steps total.",
    startProgress: 0.1,
    endProgress: 0.25,
    animationDurationMs: 6000,
    scrubberLabel: 'The long way',
  },

  // ── The shortcut ────────────────────────────────────────────────
  {
    ttsText: 'But wait — what if we take a shortcut? ' + 'We can cut right across the middle!',
    startProgress: 0.25,
    endProgress: 0.35,
    animationDurationMs: 5000,
    scrubberLabel: 'The shortcut',
  },

  // ── Measuring the shortcut ──────────────────────────────────────
  {
    ttsText:
      "Let's see exactly how long the shortcut is. " +
      "We'll swing it down onto our number line, like a compass.",
    startProgress: 0.35,
    endProgress: 0.5,
    animationDurationMs: 6000,
    scrubberLabel: 'Measuring it',
  },

  // ── The mystery spot ────────────────────────────────────────────
  {
    ttsText:
      "It landed here! It's longer than one, but shorter than two. " +
      'What is this mystery number?',
    startProgress: 0.5,
    endProgress: 0.6,
    animationDurationMs: 5000,
    scrubberLabel: 'Mystery number',
  },

  // ── Why it's that long ──────────────────────────────────────────
  {
    ttsText:
      "Here's the magic! Each side of the square has a little box with an area of one. " +
      'The shortcut has a bigger box. And guess what? ' +
      'The two small boxes perfectly fill the big one! Its area is two!',
    startProgress: 0.6,
    endProgress: 0.8,
    animationDurationMs: 8000,
    scrubberLabel: 'Area proof',
  },

  // ── The never-ending number ─────────────────────────────────────
  {
    ttsText:
      "If we zoom in really close, it's past one point four. " +
      'Even closer — past one point four one four! ' +
      "The numbers keep going and never, ever stop. It's a truly special number!",
    startProgress: 0.8,
    endProgress: 0.92,
    animationDurationMs: 6000,
    scrubberLabel: 'Digits go forever',
  },

  // ── The reveal ──────────────────────────────────────────────────
  {
    ttsText:
      'This magic length is called the square root of two. ' +
      "It's the exact length of every square's shortcut, " +
      'and it shows up everywhere in math and nature!',
    startProgress: 0.92,
    endProgress: 1.0,
    animationDurationMs: 6000,
    scrubberLabel: 'Square root of two',
  },
]
