/**
 * Registry of geometry voice configs, keyed by character ID.
 *
 * Supports a two-dimensional lookup: (characterId, attitudeId) → config.
 * Falls back to teacher attitude when attitude is omitted, and to Euclid
 * when characterId is unknown.
 */

import type { GeometryVoiceConfig, GeometryTeacherConfig } from '../GeometryTeacherConfig'
import type { AttitudeId } from '../voice/attitudes/types'
import { euclidConfig, getEuclidConfig } from './euclidConfig'
import { pappusConfig } from './pappusConfig'

/** Config resolvers keyed by character ID. */
const CONFIG_RESOLVERS: Record<string, (attitudeId?: AttitudeId) => GeometryVoiceConfig> = {
  euclid: getEuclidConfig,
  pappus: () => pappusConfig, // Pappus only has teacher for now
}

/** Flat map of default (teacher) configs for backward compat. */
export const GEOMETRY_TEACHER_CONFIGS: Record<string, GeometryTeacherConfig> = {
  euclid: euclidConfig,
  pappus: pappusConfig,
}

/** Look up a voice config by character ID and attitude, falling back to Euclid teacher. */
export function getTeacherConfig(
  characterId?: string,
  attitudeId?: AttitudeId
): GeometryVoiceConfig {
  const resolver = characterId ? CONFIG_RESOLVERS[characterId] : undefined
  if (resolver) return resolver(attitudeId)
  return getEuclidConfig(attitudeId)
}
