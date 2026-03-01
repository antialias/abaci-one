/**
 * Condensed Euclid's Elements Book I reference material for voice context.
 *
 * Kept concise — these are injected into the Realtime API instructions,
 * so we avoid the full markdown files and include only what Euclid
 * would naturally reference in conversation.
 */

export const POSTULATES = `\
Post.1 — To draw a straight line from any point to any point.
Post.2 — To produce a finite straight line continuously in a straight line.
Post.3 — To describe a circle with any center and radius.
Post.4 — All right angles equal one another.
Post.5 — If a line crossing two lines makes interior angles on one side less than two right angles, those lines meet on that side.`

export const COMMON_NOTIONS = `\
C.N.1 — Things equal to the same thing also equal one another.
C.N.2 — If equals are added to equals, the wholes are equal.
C.N.3 — If equals are subtracted from equals, the remainders are equal.
C.N.4 — Things which coincide with one another equal one another.
C.N.5 — The whole is greater than the part.`

export const KEY_DEFINITIONS = `\
Def.1 — A point is that which has no part.
Def.4 — A straight line lies evenly with the points on itself.
Def.10 — A right angle: when a line standing on another makes adjacent angles equal.
Def.15 — A circle: a plane figure where all lines from the center to the boundary are equal.
Def.20 — Equilateral triangle: three equal sides. Isosceles: two equal sides. Scalene: three unequal sides.
Def.23 — Parallel lines: lines in the same plane that never meet when produced indefinitely.`

export const PROPOSITION_SUMMARIES: Record<number, {
  statement: string
  type: string
  /** Edge cases where the construction degenerates or requires careful reasoning */
  degenerateCases?: string
}> = {
  1: {
    statement: 'Construct an equilateral triangle on a given finite straight line.',
    type: 'Construction',
    degenerateCases: `If the given line AB has zero length (A and B coincide), the two circles both collapse to a single point at that location, and the "triangle" degenerates to a point. The construction requires a FINITE straight line — meaning A and B must be distinct. This is a prerequisite, not a flaw in the proof.`,
  },
  2: {
    statement: 'Place at a given point a straight line equal to a given straight line.',
    type: 'Construction',
    degenerateCases: `If point A coincides with one endpoint of the given line BC, the equilateral triangle from I.1 degenerates (since one side has zero length). The construction still produces the correct result trivially — the answer is BC itself starting from A — but the intermediate triangle cannot be formed. If BC has zero length, the result is a zero-length segment at A, which is trivially correct. Note: the distance BC is FIXED regardless of where A is placed. Moving A does not change the length of BC.`,
  },
  3: {
    statement: 'Given two unequal lines, cut off from the greater a line equal to the less.',
    type: 'Construction',
    degenerateCases: `This proposition requires two UNEQUAL lines. If the lines are equal, the construction is trivial (the whole line is the answer). If point A (on the greater line) coincides with point C (endpoint of the lesser line), the equilateral triangle from I.1 on segment AC degenerates since AC has zero length. However, CD (the lesser line) retains its length — CD is the distance from C to D, which does NOT depend on where A is. The circle centered at D through C has radius DC regardless of A's position. The student may confuse "A coincides with C" with "CD becomes zero" — correct this firmly: CD is defined by the positions of C and D, not A.`,
  },
  4: {
    statement:
      'If two triangles have two sides equal and the angles between them equal, they are congruent (SAS).',
    type: 'Theorem',
    degenerateCases: `If any side has zero length, the triangle degenerates to a line segment or point. SAS requires proper triangles with three distinct vertices. If the included angle is zero or straight (180°), the triangle degenerates to a line. These are excluded by the requirement that the figures be triangles.`,
  },
  5: {
    statement:
      'In isosceles triangles, the base angles are equal (Pons Asinorum — Bridge of Asses).',
    type: 'Theorem',
    degenerateCases: `If the two equal sides are also equal to the base, the triangle is equilateral and ALL angles are equal — the theorem still holds but becomes a special case. If the apex angle approaches zero, the triangle becomes very "thin" but the base angles remain equal (both approaching 90°). The triangle degenerates only if vertices coincide.`,
  },
  6: {
    statement: 'If two angles of a triangle are equal, the opposite sides are also equal.',
    type: 'Theorem',
  },
  7: {
    statement:
      'Given a base and two side lengths, there is at most one triangle on each side of the base.',
    type: 'Theorem',
  },
}

/**
 * Build a concise reference block for injection into mode instructions.
 * Only includes propositions up to (but not including) the current one,
 * so Euclid never references results the student hasn't seen.
 */
export function buildReferenceContext(currentPropId: number): string {
  const lines = [
    '=== The Postulates ===',
    POSTULATES,
    '',
    '=== Common Notions ===',
    COMMON_NOTIONS,
    '',
    '=== Key Definitions ===',
    KEY_DEFINITIONS,
  ]

  const priorProps = Object.entries(PROPOSITION_SUMMARIES)
    .filter(([id]) => Number(id) < currentPropId)
    .map(([id, p]) => `Prop.I.${id} [${p.type}]: ${p.statement}`)

  if (priorProps.length > 0) {
    lines.push('', '=== Previously Proven Propositions ===')
    lines.push(...priorProps)
  }

  // Include degenerate cases for the current proposition (and any it depends on)
  const currentProp = PROPOSITION_SUMMARIES[currentPropId]
  if (currentProp?.degenerateCases) {
    lines.push('', '=== EDGE CASES & DEGENERATE SITUATIONS (for this proposition) ===')
    lines.push(`If the student asks about edge cases, boundary conditions, or what happens when points coincide, use this reasoning — do NOT improvise:`)
    lines.push(currentProp.degenerateCases)
  }

  // Also include degenerate cases for prior propositions used as dependencies
  const priorDegen = Object.entries(PROPOSITION_SUMMARIES)
    .filter(([id]) => Number(id) < currentPropId)
    .filter(([, p]) => p.degenerateCases)
    .map(([id, p]) => `Prop.I.${id}: ${p.degenerateCases}`)

  if (priorDegen.length > 0) {
    if (!currentProp?.degenerateCases) {
      lines.push('', '=== EDGE CASES & DEGENERATE SITUATIONS ===')
      lines.push(`If the student asks about edge cases of prior propositions used in this proof:`)
    } else {
      lines.push('')
      lines.push('Edge cases of prior propositions used in this proof:')
    }
    lines.push(...priorDegen)
  }

  return lines.join('\n')
}
