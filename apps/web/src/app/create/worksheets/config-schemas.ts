import { z } from 'zod'

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
const ADDITION_CURRENT_VERSION = 1

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

/** Union of all addition config versions (add new versions here) */
export const additionConfigSchema = z.discriminatedUnion('version', [
  additionConfigV1Schema,
  // additionConfigV2Schema, // Future versions go here
])

export type AdditionConfig = z.infer<typeof additionConfigSchema>

/**
 * Default addition config (always latest version)
 */
export const defaultAdditionConfig: AdditionConfigV1 = {
  version: 1,
  problemsPerPage: 20,
  cols: 5,
  pages: 1,
  orientation: 'landscape',
  name: '',
  pAnyStart: 0.75,
  pAllStart: 0.25,
  interpolate: true,
  showCarryBoxes: true,
  showAnswerBoxes: true,
  showPlaceValueColors: true,
  showProblemNumbers: true,
  showCellBorder: true,
  showTenFrames: false,
  showTenFramesForAll: false,
  fontSize: 16,
}

/**
 * Migrate addition config from any version to latest
 * @throws {Error} if config is invalid or migration fails
 */
export function migrateAdditionConfig(rawConfig: unknown): AdditionConfigV1 {
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
      // Already latest version
      return config

    // Future migrations:
    // case 2:
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
export function parseAdditionConfig(jsonString: string): AdditionConfigV1 {
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
export function serializeAdditionConfig(config: Omit<AdditionConfigV1, 'version'>): string {
  const versioned: AdditionConfigV1 = {
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
