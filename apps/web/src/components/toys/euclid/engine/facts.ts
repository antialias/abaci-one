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

export type Citation =
  | { type: 'def15'; circleId: string }
  | { type: 'cn1'; via: DistancePair }     // transitivity through shared equal
  | { type: 'cn3'; whole: DistancePair; part: DistancePair }  // subtraction
  | { type: 'cn4' }                        // superposition (C.N.4)
  | { type: 'given' }                      // hypothesis / given fact
  | { type: 'prop'; propId: number }

export interface EqualityFact {
  readonly id: number
  readonly left: DistancePair
  readonly right: DistancePair
  readonly citation: Citation
  readonly statement: string       // "CA = AB"
  readonly justification: string   // "Def.15: C on circle centered at A through B"
  readonly atStep: number
}
