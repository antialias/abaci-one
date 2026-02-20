/**
 * Ramanujan Demo Narration Segments: "The Ghost Note"
 *
 * Pure data file — no React. Each segment maps a revealProgress range
 * to a TTS utterance and a minimum animation duration.
 *
 * Progress ranges are derived from ramanujanDemo.ts's PHASE constants.
 * The demo visualises ζ(s) as a smooth curve that the kid builds up
 * from shrinking-and-adding experiments, then follows past the pole
 * to discover ζ(−1) = −1/12.
 *
 * PEDAGOGICAL APPROACH: Each segment teaches ONE concept and builds
 * on the previous. The ending ties all pieces together explicitly.
 *
 *   Seg 0   0.000–0.040  Question: what happens adding all numbers?
 *   Seg 1   0.040–0.070  Payoff: it zooms to infinity!
 *   Seg 2   0.070–0.100  Hook: a secret number is hiding inside
 *   Seg 3   0.100–0.150  Shrink attempt: 1+½+⅓+¼ still → ∞
 *   Seg 4   0.150–0.200  Shrink HARDER: square the bottoms → tiny!
 *   Seg 5   0.200–0.260  Convergence payoff: it settles to 1.645!
 *   Seg 6   0.260–0.320  Knob concept: different squishing → different answers
 *   Seg 7   0.320–0.370  Plot the points on a graph
 *   Seg 8   0.370–0.420  Connect the dots: smooth curve!
 *   Seg 9   0.420–0.470  Approaching the wall: knob slides toward 1
 *   Seg 10  0.470–0.520  The wall: s=1 is infinity again
 *   Seg 11  0.520–0.555  The track is perfectly smooth — how to get past?
 *   Seg 12  0.555–0.600  Failed attempts: sharp corner cracks, wiggly wobbles
 *   Seg 13  0.600–0.650  THE SEESAW: up on right → must plunge down on left
 *   Seg 14  0.650–0.700  Watch the flip: path starts negative, stays below
 *   Seg 15  0.700–0.760  The FLIPPER: negative exponent grows instead of shrinks
 *   Seg 16  0.760–0.810  CONNECTION: knob at −1 = our original question
 *   Seg 17  0.810–0.850  Volcano: sum explodes to infinity at s=−1
 *   Seg 18  0.850–0.895  WHY TRUST THE BRIDGE: built from real convergent answers
 *   Seg 19  0.895–0.940  THE REVEAL: bridge lands at −1/12!
 *   Seg 20  0.940–0.970  RECAP: putting all the pieces together
 *   Seg 21  0.970–1.000  Ramanujan's letter + the ghost note
 */

import type { DemoNarrationSegment } from './useConstantDemoNarration'

/** Shared voice direction for the Ramanujan demo narrator. */
export const RAMANUJAN_DEMO_TONE =
  'You are a warm, patient guide on a treasure hunt with a really smart 5-year-old. ' +
  'Explain each step simply and build understanding before moving on. ' +
  'Be genuinely amazed when the track reveals the impossible answer. ' +
  'At the end, tie all the pieces together so the child feels the whole journey.'

export const RAMANUJAN_DEMO_SEGMENTS: DemoNarrationSegment[] = [
  // ═══════════════════════════════════════════════════════════════════
  // ACT 1: DIVERGENCE + HOOK (0.00–0.10)
  // ═══════════════════════════════════════════════════════════════════

  // Seg 0: The question
  {
    ttsText:
      "Let's find out what happens when you add every number together. " +
      "One plus two plus three plus four — all of them, forever! Let's watch!",
    startProgress: 0.0,
    endProgress: 0.04,
    animationDurationMs: 4500,
    scrubberLabel: 'Add all numbers',
  },

  // Seg 1: Divergence payoff
  {
    ttsText:
      'Look at that! One, three, six, ten, fifteen — the pile gets bigger ' +
      "faster and faster! It zooms off to infinity. There's no stopping it!",
    startProgress: 0.04,
    endProgress: 0.07,
    animationDurationMs: 4500,
    scrubberLabel: 'Zooms to infinity!',
  },

  // Seg 2: The hook
  {
    ttsText:
      "But here's the wild part. Mathematicians found a secret number " +
      "hiding inside that crazy sum. Let's go on a treasure hunt to find it!",
    startProgress: 0.07,
    endProgress: 0.1,
    animationDurationMs: 5000,
    scrubberLabel: 'A secret hides',
  },

  // ═══════════════════════════════════════════════════════════════════
  // ACT 2: SHRINKING & CONVERGENCE (0.10–0.26)
  // ═══════════════════════════════════════════════════════════════════

  // Seg 3: Harmonic attempt (fails)
  {
    ttsText:
      'First, what if we shrink each number before adding? ' +
      'Take one, add a half, add a third, add a quarter. ' +
      'The pieces are small, but even those still pile up to infinity! ' +
      "Shrinking a little isn't enough.",
    startProgress: 0.1,
    endProgress: 0.15,
    animationDurationMs: 7000,
    scrubberLabel: 'Shrink a little',
  },

  // Seg 4: Square shrinking (works!)
  {
    ttsText:
      'We need to shrink HARDER! What if we square the bottom numbers? ' +
      'One over one is still one. But one over two-squared is just a quarter! ' +
      "One over three-squared is a ninth — that's tiny! One over four-squared " +
      'is a sixteenth. They get SO small, SO fast!',
    startProgress: 0.15,
    endProgress: 0.2,
    animationDurationMs: 7000,
    scrubberLabel: 'Shrink HARDER',
  },

  // Seg 5: Convergence payoff
  {
    ttsText:
      'And when you add all those tiny pieces together... watch the pile. ' +
      'It slows down... and stops growing! It settles to about one point six four five. ' +
      'Not infinity — a real, beautiful number!',
    startProgress: 0.2,
    endProgress: 0.26,
    animationDurationMs: 6500,
    scrubberLabel: 'It settles!',
  },

  // ═══════════════════════════════════════════════════════════════════
  // ACT 3: THE CURVE (0.26–0.42)
  // ═══════════════════════════════════════════════════════════════════

  // Seg 6: The knob concept
  {
    ttsText:
      'How much we squish is like a tuning knob. Knob at two means ' +
      "square the bottoms. Let's try other settings! Knob at three: " +
      'the pieces get even tinier! Knob at four: they practically vanish! ' +
      'Each setting gives a different answer.',
    startProgress: 0.26,
    endProgress: 0.32,
    animationDurationMs: 7000,
    scrubberLabel: 'The tuning knob',
  },

  // Seg 7: Plotting points
  {
    ttsText:
      "Each knob setting gives us a number. Let's mark them on a graph. " +
      'Knob two lands here... knob three over here... knob four right there.',
    startProgress: 0.32,
    endProgress: 0.37,
    animationDurationMs: 5500,
    scrubberLabel: 'Plot the points',
  },

  // Seg 8: The curve
  {
    ttsText:
      'Now connect the dots. See that? ' +
      'A smooth, beautiful curve — like a roller coaster track!',
    startProgress: 0.37,
    endProgress: 0.42,
    animationDurationMs: 5000,
    scrubberLabel: 'Connect the dots',
  },

  // ═══════════════════════════════════════════════════════════════════
  // ACT 4: THE WALL (0.42–0.52)
  // ═══════════════════════════════════════════════════════════════════

  // Seg 9: Approaching the wall
  {
    ttsText:
      'Now watch what happens when the knob slides toward one. ' +
      'The pieces barely shrink at all. ' +
      'The sum gets bigger... and bigger...',
    startProgress: 0.42,
    endProgress: 0.47,
    animationDurationMs: 5500,
    scrubberLabel: 'Approaching the wall',
  },

  // Seg 10: The wall
  {
    ttsText:
      "At knob one, it's one plus a half plus a third plus a quarter — " +
      "and THAT goes to infinity too! There's a wall in our track. " +
      "The roller coaster can't go there!",
    startProgress: 0.47,
    endProgress: 0.52,
    animationDurationMs: 6000,
    scrubberLabel: 'The wall!',
  },

  // ═══════════════════════════════════════════════════════════════════
  // ACT 5: THE BRIDGE (0.52–0.70)
  // ═══════════════════════════════════════════════════════════════════

  // Seg 11: Smooth track + how to get past?
  {
    ttsText:
      "But look at the track we've built on this side of the wall. " +
      "It's perfectly smooth — no bumps, no kinks. " +
      'But how do we get past the wall to the other side?',
    startProgress: 0.52,
    endProgress: 0.555,
    animationDurationMs: 5000,
    scrubberLabel: 'Smooth track',
  },

  // Seg 12: Failed attempts — SHOWING why only one works
  {
    ttsText:
      'What if the track makes a sharp turn? ' +
      "Nope — it cracks! Sharp corners aren't smooth. " +
      'What about a wiggly path? Too wobbly — that breaks too! ' +
      'Only a perfectly smooth path can survive.',
    startProgress: 0.555,
    endProgress: 0.6,
    animationDurationMs: 6500,
    scrubberLabel: 'Failed attempts',
  },

  // Seg 13: The seesaw — WHY the smooth path goes negative
  {
    ttsText:
      "Here's the secret. On our side of the wall, the track rockets UP to infinity. " +
      'But a smooth path has to reach the wall from both sides. ' +
      'And if it goes up on the right... the only smooth way is to plunge ' +
      'DOWN on the left! Like a seesaw — one side up, the other must go down.',
    startProgress: 0.6,
    endProgress: 0.65,
    animationDurationMs: 7000,
    scrubberLabel: 'The seesaw',
  },

  // Seg 14: Watch the flip happen
  {
    ttsText:
      'Watch! On the left side of the wall, the track starts way down below zero. ' +
      'Then it climbs... but stays negative! ' +
      'The wall flipped everything to the minus side. ' +
      'And the pencil draws the only smooth path, all by itself.',
    startProgress: 0.65,
    endProgress: 0.7,
    animationDurationMs: 6500,
    scrubberLabel: 'Below zero',
  },

  // ═══════════════════════════════════════════════════════════════════
  // ACT 6: THE FLIPPER + ANSWER (0.70–0.87)
  // ═══════════════════════════════════════════════════════════════════

  // Seg 15: The flipper — what does knob=-1 mean?
  {
    ttsText:
      'Now, what does a knob setting of negative one even mean? ' +
      'Remember, knob at two means one over n-squared — it squishes numbers small. ' +
      'But the minus sign is like a flipper! ' +
      'Instead of squishing numbers smaller, it flips them bigger!',
    startProgress: 0.7,
    endProgress: 0.76,
    animationDurationMs: 7500,
    scrubberLabel: 'The flipper',
  },

  // Seg 16: Flipper payoff — connecting back
  {
    ttsText:
      'One over four-squared is tiny — just a sixteenth. ' +
      'But four to the power of one is just... four! The minus sign flipped it back! ' +
      'So knob at negative one gives us back one plus two plus three plus four forever — ' +
      'our original question!',
    startProgress: 0.76,
    endProgress: 0.81,
    animationDurationMs: 7000,
    scrubberLabel: 'Our original question',
  },

  // Seg 17: Volcano — the sum explodes
  {
    ttsText:
      'At knob negative one, the actual sum — one plus two plus three plus four — ' +
      "it explodes to infinity! It's pure chaos at that spot. " +
      'Watch the numbers fly!',
    startProgress: 0.81,
    endProgress: 0.85,
    animationDurationMs: 5500,
    scrubberLabel: 'Volcano!',
  },

  // ═══════════════════════════════════════════════════════════════════
  // ACT 7: THE BRIDGE'S SECRET (0.85–1.00)
  // ═══════════════════════════════════════════════════════════════════

  // Seg 18: Why trust the bridge — built from real answers
  {
    ttsText:
      'But remember what our bridge is made of! ' +
      'At knob two, the sum really truly converges to one point six four five — ' +
      'and the bridge goes right through it. ' +
      'Knob three? Real answer. Bridge matches. ' +
      'Knob four? Real answer. Bridge matches. ' +
      'Every single point where the sum converges, the bridge nails the real answer. ' +
      'Because the bridge was BUILT from those real answers!',
    startProgress: 0.85,
    endProgress: 0.895,
    animationDurationMs: 9000,
    scrubberLabel: 'Trust the bridge',
  },

  // Seg 19: The reveal — −1/12
  {
    ttsText:
      'And this bridge — the one smooth path, built from real math, ' +
      "the only path that doesn't break — " +
      'it flies right over the chaos at knob negative one. ' +
      'And it says the height there is... negative one twelfth!',
    startProgress: 0.895,
    endProgress: 0.94,
    animationDurationMs: 7000,
    scrubberLabel: 'Negative one twelfth!',
  },

  // Seg 20: Recap — tying ALL pieces together
  {
    ttsText:
      'We squished numbers and found real answers. ' +
      'Those answers built the only smooth bridge. ' +
      'The bridge told us the pattern hidden inside one plus two plus three forever.',
    startProgress: 0.94,
    endProgress: 0.97,
    animationDurationMs: 6000,
    scrubberLabel: 'Putting it together',
  },

  // Seg 21: Ramanujan + ghost note
  {
    ttsText:
      'Over a hundred years ago, a genius named Ramanujan wrote this ' +
      'in a letter to a famous professor. ' +
      'One plus two plus three forever equals negative one twelfth. ' +
      'The smooth bridge proves he was right. ' +
      "It's the ghost note — hidden inside infinity.",
    startProgress: 0.97,
    endProgress: 1.0,
    animationDurationMs: 8000,
    scrubberLabel: "Ramanujan's letter",
  },
]
