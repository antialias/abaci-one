/**
 * Registry of geometry teacher configs, keyed by character ID.
 *
 * Used by API routes and admin providers to look up a character's
 * full config without hardcoded imports.
 */

import type { GeometryTeacherConfig } from '../GeometryTeacherConfig'
import { euclidConfig } from './euclidConfig'
import { pappusConfig } from './pappusConfig'

export const GEOMETRY_TEACHER_CONFIGS: Record<string, GeometryTeacherConfig> = {
  euclid: euclidConfig,
  pappus: pappusConfig,
}

/** Look up a teacher config by character ID, falling back to Euclid. */
export function getTeacherConfig(characterId?: string): GeometryTeacherConfig {
  if (characterId && characterId in GEOMETRY_TEACHER_CONFIGS) {
    return GEOMETRY_TEACHER_CONFIGS[characterId]
  }
  return euclidConfig
}
