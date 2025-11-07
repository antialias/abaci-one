import { z } from 'zod'
import { getProfileFromConfig } from './addition/difficultyProfiles'

/**
 * Versioned worksheet config schemas with type-safe validation and migration
 *
 * ADDING NEW VERSIONS:
 * 1. Create new schema (e.g., additionConfigV2Schema)
 * 2. Add migration function (e.g., migrateAdditionV1toV2)
 * 3. Update CURRENT_VERSION constant
 * 4. Add case to migrateAdditionConfig()
 *
 * ADDING NEW WORKSHEET TYPES:
 * 1. Create schema with version field
 * 2. Create migration function
 * 3. Export parseXXXConfig() helper
 */

// =============================================================================
// ADDITION WORKSHEETS
// =============================================================================

/** Current schema version for addition worksheets */
const ADDITION_CURRENT_VERSION = 2

/**
 * Addition worksheet config - Version 1
 * Initial schema with ten-frames support
 */
export const additionConfigV1Schema = z.object({
  version: z.literal(1),
  problemsPerPage: z.number().int().min(1).max(100),
  cols: z.number().int().min(1).max(10),
  pages: z.number().int().min(1).max(20),
  orientation: z.enum(['portrait', 'landscape']),
  name: z.string(),
  pAnyStart: z.number().min(0).max(1),
  pAllStart: z.number().min(0).max(1),
  interpolate: z.boolean(),
  showCarryBoxes: z.boolean(),
  showAnswerBoxes: z.boolean(),
  showPlaceValueColors: z.boolean(),
  showProblemNumbers: z.boolean(),
  showCellBorder: z.boolean(),
  showTenFrames: z.boolean(),
  showTenFramesForAll: z.boolean(),
  fontSize: z.number().int().min(8).max(32),
})

export type AdditionConfigV1 = z.infer<typeof additionConfigV1Schema>

/**
 * Addition worksheet config - Version 2
 * Smart difficulty system with conditional display rules
 */
export const additionConfigV2Schema = z.object({
  version: z.literal(2),
  problemsPerPage: z.number().int().min(1).max(100),
  cols: z.number().int().min(1).max(10),
  pages: z.number().int().min(1).max(20),
  orientation: z.enum(['portrait', 'landscape']),
  name: z.string(),
  pAnyStart: z.number().min(0).max(1),
  pAllStart: z.number().min(0).max(1),
  interpolate: z.boolean(),

  // V2: Display rules replace individual booleans
  displayRules: z.object({
    carryBoxes: z.enum([
      'always',
      'never',
      'whenRegrouping',
      'whenMultipleRegroups',
      'when3PlusDigits',
    ]),
    answerBoxes: z.enum([
      'always',
      'never',
      'whenRegrouping',
      'whenMultipleRegroups',
      'when3PlusDigits',
    ]),
    placeValueColors: z.enum([
      'always',
      'never',
      'whenRegrouping',
      'whenMultipleRegroups',
      'when3PlusDigits',
    ]),
    tenFrames: z.enum([
      'always',
      'never',
      'whenRegrouping',
      'whenMultipleRegroups',
      'when3PlusDigits',
    ]),
    problemNumbers: z.enum([
      'always',
      'never',
      'whenRegrouping',
      'whenMultipleRegroups',
      'when3PlusDigits',
    ]),
    cellBorders: z.enum([
      'always',
      'never',
      'whenRegrouping',
      'whenMultipleRegroups',
      'when3PlusDigits',
    ]),
  }),

  // V2: Track which difficulty profile is active
  difficultyProfile: z.string().optional(),

  // V2: Keep fontSize and showTenFramesForAll for now (may refactor later)
  fontSize: z.number().int().min(8).max(32),
  showTenFramesForAll: z.boolean(),
})

export type AdditionConfigV2 = z.infer<typeof additionConfigV2Schema>

/** Union of all addition config versions (add new versions here) */
export const additionConfigSchema = z.discriminatedUnion('version', [
  additionConfigV1Schema,
  additionConfigV2Schema,
])

export type AdditionConfig = z.infer<typeof additionConfigSchema>

/**
 * Default addition config (always latest version)
 */
export const defaultAdditionConfig: AdditionConfigV2 = {
  version: 2,
  problemsPerPage: 20,
  cols: 5,
  pages: 1,
  orientation: 'landscape',
  name: '',
  pAnyStart: 0.25,
  pAllStart: 0,
  interpolate: true,
  displayRules: {
    carryBoxes: 'whenRegrouping',
    answerBoxes: 'always',
    placeValueColors: 'always',
    tenFrames: 'whenRegrouping',
    problemNumbers: 'always',
    cellBorders: 'always',
  },
  difficultyProfile: 'earlyLearner',
  showTenFramesForAll: false,
  fontSize: 16,
}

/**
 * Migrate V1 config to V2
 * Converts boolean display flags to conditional display rules
 */
function migrateAdditionV1toV2(v1: AdditionConfigV1): AdditionConfigV2 {
  // Convert V1 boolean flags to V2 rule modes
  // V1 booleans were always on/off, so map true→'always', false→'never'
  const displayRules: AdditionConfigV2['displayRules'] = {
    carryBoxes: v1.showCarryBoxes ? 'always' : 'never',
    answerBoxes: v1.showAnswerBoxes ? 'always' : 'never',
    placeValueColors: v1.showPlaceValueColors ? 'always' : 'never',
    tenFrames: v1.showTenFrames ? 'always' : 'never',
    problemNumbers: v1.showProblemNumbers ? 'always' : 'never',
    cellBorders: v1.showCellBorder ? 'always' : 'never',
  }

  // Try to match config to a known profile
  const profileName = getProfileFromConfig(v1.pAllStart, v1.pAnyStart, displayRules)

  return {
    version: 2,
    problemsPerPage: v1.problemsPerPage,
    cols: v1.cols,
    pages: v1.pages,
    orientation: v1.orientation,
    name: v1.name,
    pAnyStart: v1.pAnyStart,
    pAllStart: v1.pAllStart,
    interpolate: v1.interpolate,
    displayRules,
    difficultyProfile: profileName === 'custom' ? undefined : profileName,
    showTenFramesForAll: v1.showTenFramesForAll,
    fontSize: v1.fontSize,
  }
}

/**
 * Migrate addition config from any version to latest
 * @throws {Error} if config is invalid or migration fails
 */
export function migrateAdditionConfig(rawConfig: unknown): AdditionConfigV2 {
  // First, try to parse as any known version
  const parsed = additionConfigSchema.safeParse(rawConfig)

  if (!parsed.success) {
    // If parsing fails completely, return defaults
    console.warn('Failed to parse addition config, using defaults:', parsed.error)
    return defaultAdditionConfig
  }

  const config = parsed.data

  // Migrate to latest version
  switch (config.version) {
    case 1:
      // Migrate V1 to V2
      return migrateAdditionV1toV2(config)

    case 2:
      // Already latest version
      return config

    // Future migrations:
    // case 3:
    //   return migrateAdditionV2toV3(config)

    default:
      // Unknown version, return defaults
      console.warn(`Unknown addition config version: ${(config as any).version}`)
      return defaultAdditionConfig
  }
}

/**
 * Parse and validate addition config from JSON string
 * Automatically migrates old versions to latest
 */
export function parseAdditionConfig(jsonString: string): AdditionConfigV2 {
  try {
    const raw = JSON.parse(jsonString)
    return migrateAdditionConfig(raw)
  } catch (error) {
    console.error('Failed to parse addition config JSON:', error)
    return defaultAdditionConfig
  }
}

/**
 * Serialize addition config to JSON string
 * Ensures version field is set to current version
 */
export function serializeAdditionConfig(config: Omit<AdditionConfigV2, 'version'>): string {
  const versioned: AdditionConfigV2 = {
    ...config,
    version: ADDITION_CURRENT_VERSION,
  }
  return JSON.stringify(versioned)
}

// =============================================================================
// FUTURE WORKSHEET TYPES (subtraction, multiplication, etc.)
// =============================================================================

// Example structure for future worksheet types:
//
// export const subtractionConfigV1Schema = z.object({
//   version: z.literal(1),
//   // ... fields specific to subtraction worksheets
// })
//
// export function parseSubtractionConfig(jsonString: string): SubtractionConfigV1 {
//   // ... similar to parseAdditionConfig
// }
