/** Distance between two points (canonical: IDs sorted lexicographically) */
export interface DistancePair {
  readonly a: string
  readonly b: string
}

/** Create a canonical DistancePair (IDs sorted lexicographically) */
export function distancePair(p: string, q: string): DistancePair {
  return p <= q ? { a: p, b: q } : { a: q, b: p }
}

export function distancePairsEqual(x: DistancePair, y: DistancePair): boolean {
  return x.a === y.a && x.b === y.b
}

export function distancePairKey(dp: DistancePair): string {
  return `${dp.a}|${dp.b}`
}

// ── Angle measure ─────────────────────────────────────────────────

/** An angle defined by a vertex and two ray endpoints (canonical: ray endpoints sorted) */
export interface AngleMeasure {
  readonly vertex: string
  readonly ray1: string
  readonly ray2: string
}

/** Create a canonical AngleMeasure (ray endpoints sorted lexicographically) */
export function angleMeasure(vertex: string, r1: string, r2: string): AngleMeasure {
  return r1 <= r2 ? { vertex, ray1: r1, ray2: r2 } : { vertex, ray1: r2, ray2: r1 }
}

export function angleMeasureKey(am: AngleMeasure): string {
  return `∠${am.vertex}|${am.ray1}|${am.ray2}`
}

export function angleMeasuresEqual(x: AngleMeasure, y: AngleMeasure): boolean {
  return x.vertex === y.vertex && x.ray1 === y.ray1 && x.ray2 === y.ray2
}

// ── Citations ─────────────────────────────────────────────────────

export type Citation =
  | { type: 'def15'; circleId: string }
  | { type: 'cn1'; via: DistancePair }     // transitivity through shared equal
  | { type: 'cn3'; whole: DistancePair; part: DistancePair }  // subtraction
  | { type: 'cn3-angle'; whole: AngleMeasure; part: AngleMeasure }  // angle subtraction
  | { type: 'cn4' }                        // superposition (C.N.4)
  | { type: 'given' }                      // hypothesis / given fact
  | { type: 'prop'; propId: number }

// ── Equality facts ────────────────────────────────────────────────

export interface EqualityFact {
  readonly id: number
  readonly left: DistancePair
  readonly right: DistancePair
  readonly citation: Citation
  readonly statement: string       // "CA = AB"
  readonly justification: string   // "Def.15: C on circle centered at A through B"
  readonly atStep: number
}

export interface AngleEqualityFact {
  readonly id: number
  readonly left: AngleMeasure
  readonly right: AngleMeasure
  readonly citation: Citation
  readonly statement: string       // "∠ABC = ∠DEF"
  readonly justification: string
  readonly atStep: number
}

/** Union of all fact types in the proof engine */
export type ProofFact = EqualityFact | AngleEqualityFact

/** Type guard: true if the fact is an AngleEqualityFact */
export function isAngleFact(fact: ProofFact): fact is AngleEqualityFact {
  return 'vertex' in fact.left
}
