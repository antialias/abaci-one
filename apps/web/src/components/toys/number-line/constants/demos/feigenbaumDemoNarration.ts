/**
 * Feigenbaum (delta) Demo V2 Narration: "The Dot That Learned to Juggle"
 *
 * Pure data file — no React. Each segment maps a revealProgress range
 * to a TTS utterance and a minimum animation duration.
 *
 * 13 segments matching feigenbaumDemo.ts phase constants:
 *
 *   Seg  0a   0.000–0.025  Dot splash (silent)
 *   Seg  0b   0.025–0.060  Meet the dot
 *   Seg  1    0.060–0.140  The rule
 *   Seg  2    0.140–0.200  Turn up the dial
 *   Seg  3    0.200–0.300  First split!
 *   Seg  4    0.300–0.370  Why it splits
 *   Seg  5    0.370–0.450  Four!
 *   Seg  6    0.450–0.560  The cascade
 *   Seg  7    0.560–0.640  The full picture
 *   Seg  8    0.640–0.730  Measuring gaps
 *   Seg  9    0.730–0.820  The magic ratio
 *   Seg 10a   0.820–0.910  Zoom into the fractal
 *   Seg 10b   0.910–1.000  Delta
 */

import type { DemoNarrationSegment } from './useConstantDemoNarration'

/** Shared voice direction for the Feigenbaum demo narrator. */
export const FEIGENBAUM_DEMO_TONE =
  'You are a warm, curious guide helping a really smart 5-year-old discover something amazing. ' +
  'Build understanding step by step — the child should feel like THEY discovered the pattern, ' +
  'not that you told them about it. Be genuinely astonished at the universality reveal.'

export const FEIGENBAUM_DEMO_SEGMENTS: DemoNarrationSegment[] = [
  // ── Seg 0a: Dot splashes into existence (silent animation) ────────
  {
    ttsText: '',
    startProgress: 0.0,
    endProgress: 0.025,
    animationDurationMs: 1500,
    scrubberLabel: 'Meet the dot',
  },

  // ── Seg 0b: Narrator introduces the dot and its rule ────────────
  {
    ttsText:
      'See that little dot? It lives on a track from zero at the bottom to one at the top. ' +
      'It has a simple rule: take your number, and take how far you still have to go to reach one. ' +
      "Multiply those together, then the dial stretches the answer. That's where you jump next!",
    startProgress: 0.025,
    endProgress: 0.06,
    animationDurationMs: 5000,
    scrubberLabel: 'Meet the dot',
  },

  // ── Seg 1: The rule ───────────────────────────────────────────────
  {
    ttsText:
      "Watch! The dot is near zero — it's got almost all the way to one still to go. " +
      'Big number times big distance — big jump! ' +
      "Now it's closer to one — not as far to go — smaller jump. " +
      'Each bounce gets tinier until... it settles! One cozy home.',
    startProgress: 0.06,
    endProgress: 0.14,
    animationDurationMs: 7000,
    scrubberLabel: 'The rule',
  },

  // ── Seg 2: Turn the dial ──────────────────────────────────────────
  {
    ttsText:
      "This number line is like a dial. Let's turn it up! " +
      'A little higher... the dot still settles, but it wobbles more. ' +
      "A little more... still finds its home, but see how hard it's bouncing?",
    startProgress: 0.14,
    endProgress: 0.2,
    animationDurationMs: 5000,
    scrubberLabel: 'Turn the dial',
  },

  // ── Seg 3: First split! ──────────────────────────────────────────
  {
    ttsText:
      'Keep going... wobbling harder... and — WHOA! ' +
      "The dot can't find ONE home anymore! It's stuck bouncing between TWO spots! " +
      'Back and forth, back and forth, forever! Two homes instead of one!',
    startProgress: 0.2,
    endProgress: 0.3,
    animationDurationMs: 7000,
    scrubberLabel: 'First split!',
  },

  // ── Seg 4: Why it splits ─────────────────────────────────────────
  {
    ttsText:
      "You know what's happening? The dot tries to go home, but the rule pushes it TOO FAR! " +
      'It zooms right past! Then it tries to come back and overshoots again! ' +
      'Like a swing that can never stop swinging!',
    startProgress: 0.3,
    endProgress: 0.37,
    animationDurationMs: 6000,
    scrubberLabel: 'Why it splits',
  },

  // ── Seg 5: Four! ─────────────────────────────────────────────────
  {
    ttsText:
      "Turn the dial higher — the dot can't even juggle two spots anymore! " +
      'Now it bounces between FOUR! One, two, three, four, then back to one! ' +
      'The split has SPLIT!',
    startProgress: 0.37,
    endProgress: 0.45,
    animationDurationMs: 6000,
    scrubberLabel: 'Four!',
  },

  // ── Seg 6: The cascade ───────────────────────────────────────────
  {
    ttsText:
      "And it doesn't stop! Crank the dial a TINY bit more and four becomes EIGHT! " +
      'See those dots bouncing between eight different spots? ' +
      'A teeny bit more — SIXTEEN! The splits come faster and FASTER, closer and CLOSER together!',
    startProgress: 0.45,
    endProgress: 0.56,
    animationDurationMs: 7000,
    scrubberLabel: 'The cascade',
  },

  // ── Seg 7: The full picture ──────────────────────────────────────
  {
    ttsText:
      "Now watch THIS. Let's try EVERY dial setting at once, sweeping from left to right. " +
      "See the dot bouncing? At each spot on the dial it's hopping between its homes — " +
      'one home... two homes... four... and then — WHOA! ' +
      'So many homes it looks like a tree with branches splitting and splitting!',
    startProgress: 0.56,
    endProgress: 0.64,
    animationDurationMs: 7000,
    scrubberLabel: 'Full picture',
  },

  // ── Seg 8: Measuring gaps ────────────────────────────────────────
  {
    ttsText:
      'See the gap between the first split and the second? That big green space? ' +
      'And THIS much smaller blue gap between the second and the third? ' +
      'I wonder — how many little blue pieces fit inside the big green one? ' +
      "Let's find out! Slide it across... one... two... three... four... and a little bit left over! " +
      'About four and a half! Remember that number!',
    startProgress: 0.64,
    endProgress: 0.73,
    animationDurationMs: 9000,
    scrubberLabel: 'Measuring gaps',
  },

  // ── Seg 9: The magic ratio ───────────────────────────────────────
  {
    ttsText:
      "Now let's zoom in! The blue gap is the big one this time. And see this teeny tiny pink gap? " +
      'Same question — how many pink pieces fit inside the blue one? ' +
      'One... two... three... four... and a little bit left over! ' +
      "Wait — FOUR AND A HALF AGAIN?! It's the same! " +
      'Every time we zoom in, the big piece always holds about four and a half of the little piece!',
    startProgress: 0.73,
    endProgress: 0.82,
    animationDurationMs: 10000,
    scrubberLabel: 'Same trick, smaller!',
  },

  // ── Seg 10a: Zoom into the fractal ──────────────────────────────
  {
    ttsText:
      "Now let's zoom in to where it gets REALLY wild. " +
      'See how the splits are piling up closer and closer together? ' +
      'Four homes, eight, sixteen, thirty-two — ' +
      'each split happens FASTER than the one before, ' +
      "and they're all crammed into a tinier and tinier space. " +
      "It's like a fractal — the same pattern, repeating forever, smaller and smaller!",
    startProgress: 0.82,
    endProgress: 0.91,
    animationDurationMs: 10000,
    scrubberLabel: 'Zoom in!',
  },

  // ── Seg 10b: Delta ──────────────────────────────────────────────
  {
    ttsText:
      'That number — four point six six nine — is called delta, the Feigenbaum constant. ' +
      'Whenever ANYTHING in nature starts splitting faster and faster — ' +
      'dripping faucets, heartbeats, lasers, even electrical circuits — ' +
      'delta is hiding inside, counting the rhythm of the chaos.',
    startProgress: 0.91,
    endProgress: 1.0,
    animationDurationMs: 8000,
    scrubberLabel: 'Delta',
  },
]
