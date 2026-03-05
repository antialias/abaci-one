/**
 * Attitude registry — maps attitude IDs to their definitions.
 */

export type { AttitudeDefinition, AttitudeId } from './types'
export type { CharacterAttitudePersonality } from '@/lib/character/types'
export { getAttitudePersonality } from './types'
export { teacherAttitude } from './teacher'
export { hecklerAttitude } from './heckler'
export { authorAttitude } from './author'

import type { AttitudeDefinition, AttitudeId } from './types'
import { teacherAttitude } from './teacher'
import { hecklerAttitude } from './heckler'
import { authorAttitude } from './author'

export const ATTITUDE_REGISTRY: Record<AttitudeId, AttitudeDefinition> = {
  teacher: teacherAttitude,
  heckler: hecklerAttitude,
  author: authorAttitude,
}

/** Look up an attitude definition, falling back to teacher. */
export function getAttitude(attitudeId?: AttitudeId): AttitudeDefinition {
  if (attitudeId && attitudeId in ATTITUDE_REGISTRY) {
    return ATTITUDE_REGISTRY[attitudeId]
  }
  return teacherAttitude
}
