/**
 * Feigenbaum (delta) Demo V2 Narration: "The Dot That Learned to Juggle"
 *
 * Pure data file — no React. Each segment maps a revealProgress range
 * to a TTS utterance and a minimum animation duration.
 *
 * 12 segments matching feigenbaumDemo.ts phase constants:
 *
 *   Seg  0  0.000–0.060  Meet the dot
 *   Seg  1  0.060–0.140  The rule
 *   Seg  2  0.140–0.200  Turn up the dial
 *   Seg  3  0.200–0.300  First split!
 *   Seg  4  0.300–0.370  Why it splits
 *   Seg  5  0.370–0.450  Four!
 *   Seg  6  0.450–0.560  The cascade
 *   Seg  7  0.560–0.640  The full picture
 *   Seg  8  0.640–0.730  Measuring gaps
 *   Seg  9  0.730–0.820  The magic ratio
 *   Seg 10  0.820–0.910  It's always the same!
 *   Seg 11  0.910–1.000  Delta
 */

import type { DemoNarrationSegment } from './useConstantDemoNarration'

/** Shared voice direction for the Feigenbaum demo narrator. */
export const FEIGENBAUM_DEMO_TONE =
  'You are a warm, curious guide helping a really smart 5-year-old discover something amazing. ' +
  'Build understanding step by step — the child should feel like THEY discovered the pattern, ' +
  'not that you told them about it. Be genuinely astonished at the universality reveal.'

export const FEIGENBAUM_DEMO_SEGMENTS: DemoNarrationSegment[] = [
  // ── Seg 0: Meet the dot ───────────────────────────────────────────
  {
    ttsText:
      "Look! Here's a little dot, sitting on a track from zero to one. " +
      "It has a rule: look at where you are, and look at the space LEFT above you. " +
      "Multiply those two together, then the dial stretches the answer. That's where you jump next!",
    startProgress: 0.000,
    endProgress: 0.060,
    animationDurationMs: 5000,
    scrubberLabel: 'Meet the dot',
  },

  // ── Seg 1: The rule ───────────────────────────────────────────────
  {
    ttsText:
      "Watch the rule in action! The dot is low, so there's lots of space above — big jump! " +
      "Now it's higher, less room — smaller jump. " +
      "Each time it bounces, the jumps get tinier until... it settles! One cozy home.",
    startProgress: 0.060,
    endProgress: 0.140,
    animationDurationMs: 7000,
    scrubberLabel: 'The rule',
  },

  // ── Seg 2: Turn the dial ──────────────────────────────────────────
  {
    ttsText:
      "This number line is like a dial. Let's turn it up! " +
      "A little higher... the dot still settles, but it wobbles more. " +
      "A little more... still finds its home, but see how hard it's bouncing?",
    startProgress: 0.140,
    endProgress: 0.200,
    animationDurationMs: 5000,
    scrubberLabel: 'Turn the dial',
  },

  // ── Seg 3: First split! ──────────────────────────────────────────
  {
    ttsText:
      "Keep going... wobbling harder... and — WHOA! " +
      "The dot can't find ONE home anymore! It's stuck bouncing between TWO spots! " +
      "Back and forth, back and forth, forever! Two homes instead of one!",
    startProgress: 0.200,
    endProgress: 0.300,
    animationDurationMs: 7000,
    scrubberLabel: 'First split!',
  },

  // ── Seg 4: Why it splits ─────────────────────────────────────────
  {
    ttsText:
      "You know what's happening? The dot tries to go home, but the rule pushes it TOO FAR! " +
      "It zooms right past! Then it tries to come back and overshoots again! " +
      "Like a swing that can never stop swinging!",
    startProgress: 0.300,
    endProgress: 0.370,
    animationDurationMs: 6000,
    scrubberLabel: 'Why it splits',
  },

  // ── Seg 5: Four! ─────────────────────────────────────────────────
  {
    ttsText:
      "Turn the dial higher — the dot can't even juggle two spots anymore! " +
      "Now it bounces between FOUR! One, two, three, four, then back to one! " +
      "The split has SPLIT!",
    startProgress: 0.370,
    endProgress: 0.450,
    animationDurationMs: 6000,
    scrubberLabel: 'Four!',
  },

  // ── Seg 6: The cascade ───────────────────────────────────────────
  {
    ttsText:
      "And it doesn't stop! Four becomes EIGHT! Then SIXTEEN! " +
      "The splits come faster and FASTER! " +
      "Look how close together the split points are getting!",
    startProgress: 0.450,
    endProgress: 0.560,
    animationDurationMs: 7000,
    scrubberLabel: 'The cascade',
  },

  // ── Seg 7: The full picture ──────────────────────────────────────
  {
    ttsText:
      "Now let's see the whole picture at once. At every spot on the dial, the dot tries to settle. " +
      "One home... two homes... four... and then — total wildness! " +
      "But look at the branches. There's a pattern in the splitting!",
    startProgress: 0.560,
    endProgress: 0.640,
    animationDurationMs: 7000,
    scrubberLabel: 'Full picture',
  },

  // ── Seg 8: Measuring gaps ────────────────────────────────────────
  {
    ttsText:
      "Let's measure the gaps between the splits. " +
      "The first gap is THIS wide. The second? MUCH smaller! " +
      "The third? Tiny! Each gap shrinks — but by exactly how much?",
    startProgress: 0.640,
    endProgress: 0.730,
    animationDurationMs: 7000,
    scrubberLabel: 'Measuring gaps',
  },

  // ── Seg 9: The magic ratio ───────────────────────────────────────
  {
    ttsText:
      "Divide the first gap by the second — about four point seven five. " +
      "The second by the third — four point six six. " +
      "Almost the SAME! The more splits we measure, the closer we get to one special number: " +
      "four point six six nine!",
    startProgress: 0.730,
    endProgress: 0.820,
    animationDurationMs: 8000,
    scrubberLabel: 'The magic ratio',
  },

  // ── Seg 10: It's always the same! ────────────────────────────────
  {
    ttsText:
      "But HERE'S the really wild part. Try a completely DIFFERENT rule — " +
      "different numbers, different branches. Measure the gaps and divide? " +
      "SAME NUMBER! Four point six six nine! " +
      "It doesn't matter what rule you use. " +
      "Whenever things split faster and faster, this number is ALWAYS there!",
    startProgress: 0.820,
    endProgress: 0.910,
    animationDurationMs: 9000,
    scrubberLabel: 'Always the same!',
  },

  // ── Seg 11: Delta ────────────────────────────────────────────────
  {
    ttsText:
      "That number is called delta, the Feigenbaum constant. About four point six six nine. " +
      "Whenever anything in nature starts splitting faster and faster — " +
      "dripping faucets, heartbeats, lasers — " +
      "delta is hiding inside, counting the rhythm of the chaos.",
    startProgress: 0.910,
    endProgress: 1.000,
    animationDurationMs: 8000,
    scrubberLabel: 'Delta',
  },
]
