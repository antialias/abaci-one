export interface PointExplorationTip {
  pointId: string
  speech: string
}

export interface ExplorationNarration {
  /** Speech played once when the proposition is first completed */
  introSpeech: string
  /** Per-point tips played on first drag of each given point */
  pointTips: PointExplorationTip[]
  /** Speech played once when the construction breaks down during drag
   *  (e.g. a precondition is violated and intersections disappear) */
  breakdownTip?: string
}

/**
 * Exploration narration data for each proposition.
 * Keyed by proposition number (1-based).
 */
export const EXPLORATION_NARRATION: Record<number, ExplorationNarration> = {
  // ── Prop I.1: Equilateral triangle on a given line ──
  1: {
    introSpeech:
      'You built an equilateral triangle! Now try dragging point A or B to see that the construction always makes a perfect equilateral triangle, no matter where the points are.',
    pointTips: [
      {
        pointId: 'pt-A',
        speech:
          'See how all three sides stay equal? The triangle changes, but it always stays equilateral.',
      },
      {
        pointId: 'pt-B',
        speech:
          'Watch the triangle get bigger and smaller. It always stays equilateral!',
      },
    ],
  },

  // ── Prop I.2: Copy a segment to a point ──
  2: {
    introSpeech:
      'You copied a distance! Now drag the points around to prove this construction always works, no matter where the points are.',
    pointTips: [
      {
        pointId: 'pt-A',
        speech:
          'See how AF always equals BC? The copy works wherever A ends up.',
      },
      {
        pointId: 'pt-B',
        speech:
          'Watch the equilateral triangle and circles all shift. The copy still works!',
      },
      {
        pointId: 'pt-C',
        speech:
          'See AF changing to match? It always copies the exact length of BC.',
      },
    ],
  },

  // ── Prop I.3: Cut off equal segment ──
  3: {
    introSpeech:
      'You cut off an equal piece! Try dragging all four points to see how the construction adapts.',
    pointTips: [
      {
        pointId: 'pt-A',
        speech:
          'See how the cut-off piece still matches the shorter segment? It works wherever A goes.',
      },
      {
        pointId: 'pt-B',
        speech:
          'Watch what happens as AB changes length. What if it gets really short?',
      },
      {
        pointId: 'pt-C',
        speech:
          'See the cut adjusting? It always matches the shorter line exactly.',
      },
      {
        pointId: 'pt-D',
        speech:
          'Watch the circle adjust. The cut-off piece stays equal no matter what.',
      },
    ],
    breakdownTip:
      'Oh! The shorter line became longer than the other one. Euclid said we need to cut from the greater — when that rule breaks, the construction falls apart!',
  },

  // ── Prop I.4: SAS congruence theorem ──
  4: {
    introSpeech:
      'You proved two triangles are congruent! Now drag the points to test it with different triangles.',
    pointTips: [
      {
        pointId: 'pt-A',
        speech:
          'See how triangle DEF reshapes to keep matching? The congruence holds for any vertex position.',
      },
      {
        pointId: 'pt-B',
        speech:
          'Watch the matching side of DEF change too. Both triangles stay congruent!',
      },
      {
        pointId: 'pt-C',
        speech:
          'See how EF always equals BC? The third side always matches.',
      },
      {
        pointId: 'pt-D',
        speech:
          'Watch the congruence hold everywhere. It doesn\'t matter where the second triangle sits!',
      },
    ],
  },
}
