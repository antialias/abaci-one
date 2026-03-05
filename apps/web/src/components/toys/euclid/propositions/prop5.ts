import type {
  PropositionDef,
  ConstructionElement,
  ConstructionState,
  TutorialSubStep,
  ExpectedAction,
} from '../types'
import { BYRNE } from '../types'
import type { FactStore } from '../engine/factStore'
import type { ProofFact } from '../engine/facts'
import { distancePair, angleMeasure } from '../engine/facts'
import { addFact, addAngleFact } from '../engine/factStore'
import { getPoint } from '../engine/constructionState'

function getProp5Tutorial(isTouch: boolean): TutorialSubStep[][] {
  const tap = isTouch ? 'Tap' : 'Click'
  const tapHold = isTouch ? 'Tap and hold' : 'Click and hold'

  return [
    // ── Step 0: Extend AB beyond B to F ──
    [
      {
        instruction: `Drag from {pt:A} toward {pt:B}`,
        speech:
          "We have an isosceles triangle — AB equals AC. Let's prove the base angles are equal. First, we produce line AB past B. Drag from point A toward B.",
        hint: { type: 'arrow', fromId: 'pt-A', toId: 'pt-B' },
        advanceOn: { kind: 'extend-phase' as const, phase: 'extending' as const },
      },
      {
        instruction: `Continue past {pt:B} and release to place {pt:F}`,
        speech: 'Keep going past B and release to place point F.',
        hint: { type: 'none' as const },
        advanceOn: null,
      },
    ],
    // ── Step 1: Extend AC beyond C to E ──
    [
      {
        instruction: `Drag from {pt:A} toward {pt:C}`,
        speech: 'Now produce the other equal side — line AC past C. Drag from point A toward C.',
        hint: { type: 'arrow', fromId: 'pt-A', toId: 'pt-C' },
        advanceOn: { kind: 'extend-phase' as const, phase: 'extending' as const },
      },
      {
        instruction: `Continue past {pt:C} and release to place {pt:E}`,
        speech: 'Keep going past C and release to place point E.',
        hint: { type: 'none' as const },
        advanceOn: null,
      },
    ],
    // ── Step 2: I.3 macro — cut AG from AE equal to AF ──
    [
      {
        instruction: `${tap} point {pt:A}`,
        speech:
          'Now we use Proposition I.3 to cut off from AE a part equal to AF. This transfers the length AF onto line AE. Select point A — the start of the greater line.',
        hint: { type: 'point', pointId: 'pt-A' },
        advanceOn: { kind: 'macro-select' as const, index: 0 },
      },
      {
        instruction: `${tap} point {pt:E}`,
        speech: 'Select point E — the end of the greater line AE.',
        hint: { type: 'point', pointId: 'pt-E' },
        advanceOn: { kind: 'macro-select' as const, index: 1 },
      },
      {
        instruction: `${tap} point {pt:A}`,
        speech: 'Now select the segment to copy. Click A — the start of AF.',
        hint: { type: 'point', pointId: 'pt-A' },
        advanceOn: { kind: 'macro-select' as const, index: 2 },
      },
      {
        instruction: `${tap} point {pt:F}`,
        speech:
          'Click F to finish. Proposition I.3 places point G on AE where AG equals AF — cutting off from the greater a part equal to the less.',
        hint: { type: 'point', pointId: 'pt-F' },
        advanceOn: null,
      },
    ],
    // ── Step 3: Join F to C (straightedge) ──
    [
      {
        instruction: `${tapHold} point {pt:F}`,
        speech: isTouch
          ? 'Now join F to C. Press and hold on F and drag to C.'
          : 'Now join F to C. Click and hold on F and drag to C.',
        hint: { type: 'point', pointId: 'pt-F' },
        advanceOn: null,
      },
    ],
    // ── Step 4: Join G to B (straightedge) ──
    [
      {
        instruction: `${tapHold} point {pt:G}`,
        speech: isTouch
          ? 'Almost done! Join G to B — this gives us two cross-triangles to compare. Press and hold on G.'
          : 'Almost done! Join G to B — this gives us two cross-triangles to compare. Click and hold on G.',
        hint: { type: 'point', pointId: 'pt-G' },
        advanceOn: null,
      },
    ],
  ]
}

/** Helper: Euclidean distance between two points */
function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Derive I.5 conclusion: full 7-fact derivation chain (role-based).
 *
 * The proof is symmetric. Whether AE ≥ AF or AF > AE, the structure is identical —
 * only the point roles swap. We define:
 *   extShort / extLong  — the shorter/longer extension endpoint (F or E)
 *   baseShort / baseLong — the base vertex below the shorter/longer extension (B or C)
 *
 * Construction gives us:
 *   A-extShort = AG  (I.3: cut off from A-extLong a part equal to A-extShort)
 *   AB = AC  (given)
 *
 * Derivation:
 *   1. baseShort-extShort = baseLong-G  [C.N.3]
 *   2. extShort-baseLong = G-baseShort  [I.4: △A-extShort-baseLong ≅ △A-G-baseShort]
 *   3. ∠A-baseLong-extShort = ∠A-baseShort-G  [I.4 — vertex angles]
 *   4. ∠A-extShort-baseLong = ∠A-G-baseShort  [I.4 — vertex angles]
 *   5. ∠extShort-baseShort-baseLong = ∠G-baseLong-baseShort  [I.4 under-base]
 *   6. ∠baseShort-baseLong-extShort = ∠baseLong-baseShort-G  [I.4 remaining]
 *   7. ∠ABC = ∠ACB  [C.N.3]
 */
function deriveProp5Conclusion(
  store: FactStore,
  state: ConstructionState,
  atStep: number
): ProofFact[] {
  const allNewFacts: ProofFact[] = []

  const ptA = getPoint(state, 'pt-A')
  const ptF = getPoint(state, 'pt-F')
  const ptE = getPoint(state, 'pt-E')
  if (!ptA || !ptF || !ptE) return allNewFacts

  const ae = dist(ptA, ptE)
  const af = dist(ptA, ptF)
  const aeGreater = ae >= af

  // Role assignment based on which extension is longer
  const extShort = aeGreater ? 'pt-F' : 'pt-E' // shorter extension endpoint
  const extLong = aeGreater ? 'pt-E' : 'pt-F' // longer extension endpoint (G sits on this ray)
  const baseShort = aeGreater ? 'pt-B' : 'pt-C' // base vertex below shorter ext
  const baseLong = aeGreater ? 'pt-C' : 'pt-B' // base vertex below longer ext

  // Label helpers
  const lbl = (id: string) => id.replace('pt-', '')

  const dpBaseShortExtShort = distancePair(baseShort, extShort)
  const dpBaseLongG = distancePair(baseLong, 'pt-G')
  const dpAExtShort = distancePair('pt-A', extShort)
  const dpABaseShort = distancePair('pt-A', baseShort)

  // 1. C.N.3 — baseShort-extShort = baseLong-G
  allNewFacts.push(
    ...addFact(
      store,
      dpBaseShortExtShort,
      dpBaseLongG,
      { type: 'cn3', whole: dpAExtShort, part: dpABaseShort },
      `${lbl(baseShort)}${lbl(extShort)} = ${lbl(baseLong)}G`,
      `C.N.3: A${lbl(extShort)} − A${lbl(baseShort)} = AG − A${lbl(baseLong)} (since A${lbl(extShort)} = AG, A${lbl(baseShort)} = A${lbl(baseLong)})`,
      atStep
    )
  )

  // 2. I.4 (SAS) — extShort-baseLong = G-baseShort
  const dpExtShortBaseLong = distancePair(extShort, baseLong)
  const dpGBaseShort = distancePair('pt-G', baseShort)

  allNewFacts.push(
    ...addFact(
      store,
      dpExtShortBaseLong,
      dpGBaseShort,
      { type: 'prop', propId: 4 },
      `${lbl(extShort)}${lbl(baseLong)} = G${lbl(baseShort)}`,
      `I.4: △A${lbl(extShort)}${lbl(baseLong)} ≅ △AG${lbl(baseShort)} (A${lbl(extShort)} = AG, A${lbl(baseLong)} = A${lbl(baseShort)}, ∠${lbl(extShort)}A${lbl(baseLong)} = ∠GA${lbl(baseShort)})`,
      atStep
    )
  )

  // 3. ∠A-baseLong-extShort = ∠A-baseShort-G (I.4 vertex angles)
  const angABaseLongExtShort = angleMeasure(baseLong, 'pt-A', extShort)
  const angABaseShortG = angleMeasure(baseShort, 'pt-A', 'pt-G')
  allNewFacts.push(
    ...addAngleFact(
      store,
      angABaseLongExtShort,
      angABaseShortG,
      { type: 'prop', propId: 4 },
      `∠A${lbl(baseLong)}${lbl(extShort)} = ∠A${lbl(baseShort)}G`,
      `I.4: △A${lbl(extShort)}${lbl(baseLong)} ≅ △AG${lbl(baseShort)} — remaining angles`,
      atStep
    )
  )

  // 4. ∠A-extShort-baseLong = ∠A-G-baseShort (I.4 vertex angles)
  const angAExtShortBaseLong = angleMeasure(extShort, 'pt-A', baseLong)
  const angAGBaseShort = angleMeasure('pt-G', 'pt-A', baseShort)
  allNewFacts.push(
    ...addAngleFact(
      store,
      angAExtShortBaseLong,
      angAGBaseShort,
      { type: 'prop', propId: 4 },
      `∠A${lbl(extShort)}${lbl(baseLong)} = ∠AG${lbl(baseShort)}`,
      `I.4: △A${lbl(extShort)}${lbl(baseLong)} ≅ △AG${lbl(baseShort)} — remaining angles`,
      atStep
    )
  )

  // 5. ∠extShort-baseShort-baseLong = ∠G-baseLong-baseShort (I.4 under-base)
  const angExtShortBaseShortBaseLong = angleMeasure(baseShort, extShort, baseLong)
  const angGBaseLongBaseShort = angleMeasure(baseLong, 'pt-G', baseShort)
  allNewFacts.push(
    ...addAngleFact(
      store,
      angExtShortBaseShortBaseLong,
      angGBaseLongBaseShort,
      { type: 'prop', propId: 4 },
      `∠${lbl(extShort)}${lbl(baseShort)}${lbl(baseLong)} = ∠G${lbl(baseLong)}${lbl(baseShort)}`,
      `I.4: △${lbl(baseShort)}${lbl(extShort)}${lbl(baseLong)} ≅ △${lbl(baseLong)}G${lbl(baseShort)} — angles under the base`,
      atStep
    )
  )

  // 6. ∠baseShort-baseLong-extShort = ∠baseLong-baseShort-G (I.4 remaining)
  const angBaseShortBaseLongExtShort = angleMeasure(baseLong, baseShort, extShort)
  const angBaseLongBaseShortG = angleMeasure(baseShort, baseLong, 'pt-G')
  allNewFacts.push(
    ...addAngleFact(
      store,
      angBaseShortBaseLongExtShort,
      angBaseLongBaseShortG,
      { type: 'prop', propId: 4 },
      `∠${lbl(baseShort)}${lbl(baseLong)}${lbl(extShort)} = ∠${lbl(baseLong)}${lbl(baseShort)}G`,
      `I.4: △${lbl(baseShort)}${lbl(extShort)}${lbl(baseLong)} ≅ △${lbl(baseLong)}G${lbl(baseShort)} — remaining angles`,
      atStep
    )
  )

  // 7. ∠ABC = ∠ACB (C.N.3: ∠A-baseShort-G − ∠baseLong-baseShort-G = ∠A-baseLong-extShort − ∠baseShort-baseLong-extShort)
  const angABC = angleMeasure('pt-B', 'pt-A', 'pt-C')
  const angACB = angleMeasure('pt-C', 'pt-A', 'pt-B')
  allNewFacts.push(
    ...addAngleFact(
      store,
      angABC,
      angACB,
      { type: 'cn3-angle', whole: angABaseShortG, part: angBaseLongBaseShortG },
      '∠ABC = ∠ACB',
      `C.N.3: ∠A${lbl(baseShort)}G − ∠${lbl(baseLong)}${lbl(baseShort)}G = ∠A${lbl(baseLong)}${lbl(extShort)} − ∠${lbl(baseShort)}${lbl(baseLong)}${lbl(extShort)}`,
      atStep
    )
  )

  return allNewFacts
}

/**
 * Proposition I.5 — Pons Asinorum (Isosceles Base Angles)
 *
 * In isosceles triangles the base angles are equal to one another,
 * and if the equal straight lines are produced further, then the
 * angles under the base will also be equal.
 *
 * Given: Isosceles triangle ABC with AB = AC (A at apex, B/C at base).
 *
 * Construction (following Euclid's original, using I.3):
 * 0. Extend AB beyond B to F                          (Post.2)
 * 1. Extend AC beyond C to E                          (Post.2)
 * 2. Cut off AG from AE equal to AF                   (I.3)
 * 3. Join F to C                                       (Post.1)
 * 4. Join G to B                                       (Post.1)
 *
 * Proof chain:
 *   BF = CG       [C.N.3: AF − AB = AG − AC]
 *   △AFC ≅ △AGB   [I.4: AF = AG, AC = AB, ∠FAC = ∠GAB]
 *   △BFC ≅ △CGB   [I.4: BF = CG, FC = GB, ∠BFC = ∠CGB]
 *   ∠FBC = ∠GCB   [under-base angles equal]
 *   ∠ABC = ∠ACB   [C.N.3: ∠ABG − ∠CBG = ∠ACF − ∠BCF]
 */

// ── Default positions ──
const DEFAULT_A = { x: 0, y: 2 }
const DEFAULT_B = { x: -2, y: -1 }
const DEFAULT_C = { x: 2, y: -1 }

// ── Rotation angle from vector AB to vector AC ──
// Rot(ROTATION_ANGLE) * (B − A) = (C − A), preserving |AC| = |AB|
const ROTATION_ANGLE = Math.atan2(
  (DEFAULT_B.x - DEFAULT_A.x) * (DEFAULT_C.y - DEFAULT_A.y) -
    (DEFAULT_B.y - DEFAULT_A.y) * (DEFAULT_C.x - DEFAULT_A.x),
  (DEFAULT_B.x - DEFAULT_A.x) * (DEFAULT_C.x - DEFAULT_A.x) +
    (DEFAULT_B.y - DEFAULT_A.y) * (DEFAULT_C.y - DEFAULT_A.y)
)

/**
 * Recompute all given elements from current draggable point positions.
 * C is derived from A and B to maintain AB = AC and the apex angle:
 *   C = A + Rot(ROTATION_ANGLE) · (B − A)
 */
export function computeProp5GivenElements(
  positions: Map<string, { x: number; y: number }>
): ConstructionElement[] {
  const A = positions.get('pt-A') ?? DEFAULT_A
  const B = positions.get('pt-B') ?? DEFAULT_B

  // Derive C by rotating vector (B − A) by ROTATION_ANGLE
  const vx = B.x - A.x
  const vy = B.y - A.y
  const cosR = Math.cos(ROTATION_ANGLE)
  const sinR = Math.sin(ROTATION_ANGLE)
  const C = {
    x: A.x + cosR * vx - sinR * vy,
    y: A.y + sinR * vx + cosR * vy,
  }

  return [
    { kind: 'point', id: 'pt-A', x: A.x, y: A.y, label: 'A', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-B', x: B.x, y: B.y, label: 'B', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-C', x: C.x, y: C.y, label: 'C', color: BYRNE.given, origin: 'given' },
    {
      kind: 'segment',
      id: 'seg-AB',
      fromId: 'pt-A',
      toId: 'pt-B',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'segment',
      id: 'seg-AC',
      fromId: 'pt-A',
      toId: 'pt-C',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'segment',
      id: 'seg-BC',
      fromId: 'pt-B',
      toId: 'pt-C',
      color: BYRNE.given,
      origin: 'given',
    },
  ] as ConstructionElement[]
}

export const PROP_5: PropositionDef = {
  id: 5,
  title: 'In isosceles triangles the base angles are equal',
  kind: 'theorem',
  givenFacts: [
    {
      left: { a: 'pt-A', b: 'pt-B' },
      right: { a: 'pt-A', b: 'pt-C' },
      statement: 'AB = AC',
    },
  ],
  givenAngles: [
    // Base angles (blue) — always the same regardless of extend direction
    { spec: { vertex: 'pt-B', ray1End: 'pt-A', ray2End: 'pt-C' }, color: BYRNE.blue },
    { spec: { vertex: 'pt-C', ray1End: 'pt-A', ray2End: 'pt-B' }, color: BYRNE.blue },
  ],
  // Sub-base and derived angles come from deriveProp5Conclusion → fact store → dynamic arcs
  theoremConclusion: '∠ABC = ∠ACB\n∠FBC = ∠GCB',
  draggablePointIds: ['pt-A', 'pt-B'],
  computeGivenElements: computeProp5GivenElements,
  givenElements: [
    {
      kind: 'point',
      id: 'pt-A',
      x: DEFAULT_A.x,
      y: DEFAULT_A.y,
      label: 'A',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'point',
      id: 'pt-B',
      x: DEFAULT_B.x,
      y: DEFAULT_B.y,
      label: 'B',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'point',
      id: 'pt-C',
      x: DEFAULT_C.x,
      y: DEFAULT_C.y,
      label: 'C',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'segment',
      id: 'seg-AB',
      fromId: 'pt-A',
      toId: 'pt-B',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'segment',
      id: 'seg-AC',
      fromId: 'pt-A',
      toId: 'pt-C',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'segment',
      id: 'seg-BC',
      fromId: 'pt-B',
      toId: 'pt-C',
      color: BYRNE.given,
      origin: 'given',
    },
  ] as ConstructionElement[],
  steps: [
    // 0. Extend AB beyond B to F (free — user controls distance)
    {
      instruction: 'Produce {seg:AB} beyond {pt:B} to {pt:F}',
      expected: {
        type: 'extend',
        baseId: 'pt-A',
        throughId: 'pt-B',
        label: 'F',
      },
      highlightIds: ['pt-A', 'pt-B'],
      tool: 'straightedge',
      citation: 'Post.2',
    },
    // 1. Extend AC beyond C to E (free — user controls distance)
    {
      instruction: 'Produce {seg:AC} beyond {pt:C} to {pt:E}',
      expected: {
        type: 'extend',
        baseId: 'pt-A',
        throughId: 'pt-C',
        label: 'E',
      },
      highlightIds: ['pt-A', 'pt-C'],
      tool: 'straightedge',
      citation: 'Post.2',
    },
    // 2. Cut off AG from greater equal to lesser (I.3) — resolved dynamically
    {
      instruction: 'Cut off from {seg:AE} a part equal to {seg:AF} ({prop:3|I.3})',
      expected: {
        type: 'macro',
        propId: 3,
        inputPointIds: ['pt-A', 'pt-E', 'pt-A', 'pt-F'],
        outputLabels: { result: 'G' },
      },
      highlightIds: ['pt-A', 'pt-E', 'pt-F'],
      tool: 'macro',
      citation: 'I.3',
    },
    // 3. Join lesser endpoint to opposite base — resolved dynamically
    {
      instruction: 'Join {pt:F} to {pt:C}',
      expected: { type: 'straightedge', fromId: 'pt-F', toId: 'pt-C' },
      highlightIds: ['pt-F', 'pt-C'],
      tool: 'straightedge',
      citation: 'Post.1',
    },
    // 4. Join G to the other base — resolved dynamically
    {
      instruction: 'Join {pt:G} to {pt:B}',
      expected: { type: 'straightedge', fromId: 'pt-G', toId: 'pt-B' },
      highlightIds: ['pt-G', 'pt-B'],
      tool: 'straightedge',
      citation: 'Post.1',
    },
  ],
  resultSegments: [
    // Static fallback (AE ≥ AF case). computeResultSegments overrides at runtime.
    { fromId: 'pt-F', toId: 'pt-C' },
    { fromId: 'pt-G', toId: 'pt-B' },
    { fromId: 'pt-C', toId: 'pt-G' },
  ],
  computeResultSegments(state: ConstructionState) {
    const ptA = getPoint(state, 'pt-A')
    const ptF = getPoint(state, 'pt-F')
    const ptE = getPoint(state, 'pt-E')
    if (!ptA || !ptF || !ptE) {
      return [
        { fromId: 'pt-F', toId: 'pt-C' },
        { fromId: 'pt-G', toId: 'pt-B' },
        { fromId: 'pt-C', toId: 'pt-G' },
      ]
    }
    const ae = dist(ptA, ptE)
    const af = dist(ptA, ptF)
    const aeGreater = ae >= af
    // Cross-joins + the segment from the base vertex below extLong to G
    const extShort = aeGreater ? 'pt-F' : 'pt-E'
    const baseLong = aeGreater ? 'pt-C' : 'pt-B'
    const baseShort = aeGreater ? 'pt-B' : 'pt-C'
    return [
      { fromId: extShort, toId: baseLong }, // cross-join 1
      { fromId: 'pt-G', toId: baseShort }, // cross-join 2
      { fromId: baseLong, toId: 'pt-G' }, // baseLong-G distance
    ]
  },
  resolveStep(
    stepIndex: number,
    state: ConstructionState,
    _stepData: Map<number, Record<string, unknown>>
  ) {
    if (stepIndex < 2) return null
    const ptA = getPoint(state, 'pt-A')
    const ptF = getPoint(state, 'pt-F')
    const ptE = getPoint(state, 'pt-E')
    if (!ptA || !ptF || !ptE) return null

    const af = dist(ptA, ptF)
    const ae = dist(ptA, ptE)
    const aeGreater = ae >= af

    if (stepIndex === 2) {
      // I.3: cut from greater equal to lesser
      const [greater, lesser] = aeGreater ? ['pt-E', 'pt-F'] : ['pt-F', 'pt-E']
      const [gLabel, lLabel] = aeGreater ? ['E', 'F'] : ['F', 'E']
      return {
        expected: {
          type: 'macro',
          propId: 3,
          inputPointIds: ['pt-A', greater, 'pt-A', lesser],
          outputLabels: { result: 'G' },
        } as ExpectedAction,
        instruction: `Cut off from {seg:A${gLabel}} a part equal to {seg:A${lLabel}} ({prop:3|I.3})`,
        highlightIds: ['pt-A', greater, lesser],
      }
    }
    if (stepIndex === 3) {
      // Join lesser endpoint to opposite base
      const [lesserEnd, crossBase] = aeGreater ? ['pt-F', 'pt-C'] : ['pt-E', 'pt-B']
      const lbl = lesserEnd.replace('pt-', '')
      const bLbl = crossBase.replace('pt-', '')
      return {
        expected: { type: 'straightedge', fromId: lesserEnd, toId: crossBase } as ExpectedAction,
        instruction: `Join {pt:${lbl}} to {pt:${bLbl}}`,
        highlightIds: [lesserEnd, crossBase],
      }
    }
    if (stepIndex === 4) {
      // Join G to the other base
      const otherBase = aeGreater ? 'pt-B' : 'pt-C'
      const bLbl = otherBase.replace('pt-', '')
      return {
        expected: { type: 'straightedge', fromId: 'pt-G', toId: otherBase } as ExpectedAction,
        instruction: `Join {pt:G} to {pt:${bLbl}}`,
        highlightIds: ['pt-G', otherBase],
      }
    }
    return null
  },
  resolveTutorialStep(stepIndex: number, state: ConstructionState, isTouch: boolean) {
    if (stepIndex < 2) return null
    const ptA = getPoint(state, 'pt-A')
    const ptF = getPoint(state, 'pt-F')
    const ptE = getPoint(state, 'pt-E')
    if (!ptA || !ptF || !ptE) return null

    const af = dist(ptA, ptF)
    const ae = dist(ptA, ptE)
    const aeGreater = ae >= af

    const tap = isTouch ? 'Tap' : 'Click'
    const tapHold = isTouch ? 'Tap and hold' : 'Click and hold'

    // Role-resolved point IDs and labels
    const greaterEnd = aeGreater ? 'pt-E' : 'pt-F'
    const lesserEnd = aeGreater ? 'pt-F' : 'pt-E'
    const greaterLabel = greaterEnd.replace('pt-', '')
    const lesserLabel = lesserEnd.replace('pt-', '')
    const crossBase = aeGreater ? 'pt-C' : 'pt-B'
    const otherBase = aeGreater ? 'pt-B' : 'pt-C'
    const crossBaseLabel = crossBase.replace('pt-', '')
    const otherBaseLabel = otherBase.replace('pt-', '')

    if (stepIndex === 2) {
      // I.3: cut from greater equal to lesser
      return [
        {
          instruction: `${tap} point {pt:A}`,
          speech: `Now we use Proposition I.3 to cut off from A${greaterLabel} a part equal to A${lesserLabel}. Select point A — the start of the greater line.`,
          hint: { type: 'point' as const, pointId: 'pt-A' },
          advanceOn: { kind: 'macro-select' as const, index: 0 },
        },
        {
          instruction: `${tap} point {pt:${greaterLabel}}`,
          speech: `Select point ${greaterLabel} — the end of the greater line A${greaterLabel}.`,
          hint: { type: 'point' as const, pointId: greaterEnd },
          advanceOn: { kind: 'macro-select' as const, index: 1 },
        },
        {
          instruction: `${tap} point {pt:A}`,
          speech: `Now select the segment to copy. ${tap} A — the start of A${lesserLabel}.`,
          hint: { type: 'point' as const, pointId: 'pt-A' },
          advanceOn: { kind: 'macro-select' as const, index: 2 },
        },
        {
          instruction: `${tap} point {pt:${lesserLabel}}`,
          speech: `${tap} ${lesserLabel} to finish. Proposition I.3 places point G on A${greaterLabel} where AG equals A${lesserLabel} — cutting off from the greater a part equal to the less.`,
          hint: { type: 'point' as const, pointId: lesserEnd },
          advanceOn: null,
        },
      ]
    }

    if (stepIndex === 3) {
      // Join lesser endpoint to opposite base
      return [
        {
          instruction: `${tapHold} point {pt:${lesserLabel}}`,
          speech: isTouch
            ? `Now join ${lesserLabel} to ${crossBaseLabel}. Press and hold on ${lesserLabel} and drag to ${crossBaseLabel}.`
            : `Now join ${lesserLabel} to ${crossBaseLabel}. Click and hold on ${lesserLabel} and drag to ${crossBaseLabel}.`,
          hint: { type: 'point' as const, pointId: lesserEnd },
          advanceOn: null,
        },
      ]
    }

    if (stepIndex === 4) {
      // Join G to the other base
      return [
        {
          instruction: `${tapHold} point {pt:G}`,
          speech: isTouch
            ? `Almost done! Join G to ${otherBaseLabel} — this gives us two cross-triangles to compare. Press and hold on G.`
            : `Almost done! Join G to ${otherBaseLabel} — this gives us two cross-triangles to compare. Click and hold on G.`,
          hint: { type: 'point' as const, pointId: 'pt-G' },
          advanceOn: null,
        },
      ]
    }

    return null
  },
  getTutorial: getProp5Tutorial,
  explorationNarration: {
    introSpeech:
      'The Bridge of Asses! You proved that base angles of an isosceles triangle are always equal — and the angles under the base too. Proposition I.3 transferred the distance for us. Try dragging the points to see this hold for every shape.',
    pointTips: [
      {
        pointId: 'pt-A',
        speech:
          'See how the triangle changes shape but the base angles always stay equal? The I.3 construction adapts perfectly.',
      },
      {
        pointId: 'pt-B',
        speech: 'Watch how C follows to keep the triangle isosceles. The angles always match!',
      },
    ],
    breakdownTip:
      'The construction needs the extensions to satisfy I.3 — AE must exceed AF. Try moving the points closer together.',
  },
  deriveConclusion: deriveProp5Conclusion,
}
