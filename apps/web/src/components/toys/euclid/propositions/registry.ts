import type { PropositionDef } from '../types'
import { PROP_1 } from './prop1'
import { PROP_2 } from './prop2'
import { PROP_3 } from './prop3'
import { PROP_4 } from './prop4'
import { PROP_5 } from './prop5'
import { PROP_6 } from './prop6'
import { PROP_7 } from './prop7'

/** Lookup table: propId → PropositionDef. */
export const PROP_REGISTRY: Record<number, PropositionDef> = {
  1: PROP_1,
  2: PROP_2,
  3: PROP_3,
  4: PROP_4,
  5: PROP_5,
  6: PROP_6,
  7: PROP_7,
}
