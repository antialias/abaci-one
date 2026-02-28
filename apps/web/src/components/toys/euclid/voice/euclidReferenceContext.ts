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

export const PROPOSITION_SUMMARIES: Record<number, { statement: string; type: string }> = {
  1: {
    statement: 'Construct an equilateral triangle on a given finite straight line.',
    type: 'Construction',
  },
  2: {
    statement: 'Place at a given point a straight line equal to a given straight line.',
    type: 'Construction',
  },
  3: {
    statement: 'Given two unequal lines, cut off from the greater a line equal to the less.',
    type: 'Construction',
  },
  4: {
    statement:
      'If two triangles have two sides equal and the angles between them equal, they are congruent (SAS).',
    type: 'Theorem',
  },
  5: {
    statement:
      'In isosceles triangles, the base angles are equal (Pons Asinorum — Bridge of Asses).',
    type: 'Theorem',
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

  return lines.join('\n')
}
