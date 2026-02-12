/**
 * Ramanujan Demo Narration Segments: "The Detective Mystery of −1/12"
 *
 * Pure data file — no React. Each segment maps a revealProgress range
 * to a TTS utterance and a minimum animation duration.
 *
 * Progress ranges are derived from ramanujanDemo.ts's PHASE constants:
 *
 *   Seg 0   0.00–0.10  S diverges — adding all numbers zooms to infinity
 *   Seg 1   0.10–0.18  Meet the Bouncy Team: +1,−1,+1,−1
 *   Seg 2   0.18–0.25  Middle of 0 and 1 is ½ — clue #1
 *   Seg 3   0.25–0.33  The Wobbly Team: +1,−2,+3,−4
 *   Seg 4   0.33–0.40  Write it twice, shifted — it's the Bouncy Team!
 *   Seg 5   0.40–0.45  2×Wobbly = Bouncy → Wobbly = ¼
 *   Seg 6   0.45–0.55  Subtract Wobbly from Marching
 *   Seg 7   0.55–0.63  Poof! 4! Poof! 8!
 *   Seg 8   0.63–0.70  4,8,12 = 4S, so S−¼ = 4S
 *   Seg 9   0.70–0.80  Wait… subtracting made it bigger?
 *   Seg 10  0.80–0.90  It was negative all along!
 *   Seg 11  0.90–1.00  −1/12! Case closed, detective!
 */

import type { DemoNarrationSegment } from './useConstantDemoNarration'

/** Shared voice direction for the Ramanujan demo narrator. */
export const RAMANUJAN_DEMO_TONE =
  'You are a warm, conspiratorial guide leading a really smart 5-year-old through a detective mystery. ' +
  'Build suspense with each clue. Use "we" and "detective" language. ' +
  'Be genuinely shocked at the twist ending.'

export const RAMANUJAN_DEMO_SEGMENTS: DemoNarrationSegment[] = [
  // ── Phase 0: S diverges ──────────────────────────────────────────
  {
    ttsText:
      'Detective, here\'s a mystery! What happens if we add up every number? ' +
      'One, plus two, plus three, plus four... ' +
      'Whoa! It zooms off to infinity! That\'s our suspect — let\'s call it S.',
    startProgress: 0.00,
    endProgress: 0.10,
    animationDurationMs: 6000,
  },

  // ── Phase 1: Grandi's series (bouncing) ──────────────────────────
  {
    ttsText:
      'But first, a clue! Meet the Bouncy Team. ' +
      'Plus one, minus one, plus one, minus one — forever! ' +
      'Watch it bounce between zero and one.',
    startProgress: 0.10,
    endProgress: 0.18,
    animationDurationMs: 5500,
  },

  {
    ttsText:
      'See how it can\'t decide? Zero... one... zero... one. ' +
      'Right in the middle is one half! ' +
      'That\'s our first clue, detective — the Bouncy Team equals a half.',
    startProgress: 0.18,
    endProgress: 0.25,
    animationDurationMs: 5500,
  },

  // ── Phase 2: Alternating series ──────────────────────────────────
  {
    ttsText:
      'Now meet the Wobbly Team! ' +
      'Plus one, minus two, plus three, minus four... ' +
      'Watch it wobble back and forth, getting bigger each time.',
    startProgress: 0.25,
    endProgress: 0.33,
    animationDurationMs: 5500,
  },

  {
    ttsText:
      'Here\'s a clever trick! Write the Wobbly Team twice, ' +
      'but shift the second copy over by one spot. ' +
      'Now add them together... it\'s the Bouncy Team!',
    startProgress: 0.33,
    endProgress: 0.40,
    animationDurationMs: 5500,
  },

  {
    ttsText:
      'Two Wobblies make one Bouncy! ' +
      'The Bouncy Team is a half, so the Wobbly Team must be a quarter. ' +
      'Clue number two!',
    startProgress: 0.40,
    endProgress: 0.45,
    animationDurationMs: 4500,
  },

  // ── Phase 3: Subtraction ─────────────────────────────────────────
  {
    ttsText:
      'Now for the big move! Let\'s subtract the Wobbly Team from our suspect S. ' +
      'Line them up — one minus one, two minus negative two, three minus three...',
    startProgress: 0.45,
    endProgress: 0.55,
    animationDurationMs: 6000,
  },

  {
    ttsText:
      'Look what happens! Poof — zero! Then four! ' +
      'Poof — zero! Then eight! Zero, twelve! ' +
      'The odd spots vanish and the even spots are huge!',
    startProgress: 0.55,
    endProgress: 0.63,
    animationDurationMs: 5500,
  },

  {
    ttsText:
      'Zero, four, zero, eight, zero, twelve... ' +
      'That\'s four times one, plus two, plus three — that\'s four times S! ' +
      'So S minus a quarter equals four S.',
    startProgress: 0.63,
    endProgress: 0.70,
    animationDurationMs: 5000,
  },

  // ── Phase 4: Revelation ──────────────────────────────────────────
  {
    ttsText:
      'Wait a second, detective. ' +
      'We subtracted something from S and got something four times bigger? ' +
      'How can taking away make it grow? Unless...',
    startProgress: 0.70,
    endProgress: 0.80,
    animationDurationMs: 6000,
  },

  {
    ttsText:
      'Unless S was negative all along! ' +
      'Negative a quarter equals three S. ' +
      'Divide both sides by three...',
    startProgress: 0.80,
    endProgress: 0.90,
    animationDurationMs: 5500,
  },

  {
    ttsText:
      'Negative one twelfth! ' +
      'Adding every number — one plus two plus three plus four forever — ' +
      'gives negative one twelfth! Case closed, detective! ' +
      'The brilliant Ramanujan discovered this over a hundred years ago.',
    startProgress: 0.90,
    endProgress: 1.00,
    animationDurationMs: 7000,
  },
]
