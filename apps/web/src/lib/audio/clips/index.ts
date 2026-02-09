// Barrel export — importing this module triggers all audioClip() registrations
export * from './numbers'
export * from './operators'
export * from './feedback'
export * from './tutorial'
export * from './assistance'
export * from './practice'

import {
  NUMBER_0, NUMBER_1, NUMBER_2, NUMBER_3, NUMBER_4,
  NUMBER_5, NUMBER_6, NUMBER_7, NUMBER_8, NUMBER_9, NUMBER_10,
} from './numbers'
import { PLUS, MINUS } from './operators'
import { CORRECT, GREAT_JOB, NICE_WORK, THE_ANSWER_IS, TRY_AGAIN } from './feedback'

/** Clip IDs to preload when audio help is first enabled */
export const PRELOAD_CLIP_IDS = [
  NUMBER_0, NUMBER_1, NUMBER_2, NUMBER_3, NUMBER_4,
  NUMBER_5, NUMBER_6, NUMBER_7, NUMBER_8, NUMBER_9, NUMBER_10,
  PLUS, MINUS,
  CORRECT, GREAT_JOB, NICE_WORK,
  THE_ANSWER_IS, TRY_AGAIN,
]
