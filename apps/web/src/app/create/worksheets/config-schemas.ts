import { z } from 'zod'
import { getProfileFromConfig } from './difficultyProfiles'
import { WORKSHEET_LIMITS } from './constants/validation'

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
const ADDITION_CURRENT_VERSION = 4

/**
 * Addition worksheet config - Version 1
 * Initial schema with ten-frames support
 */
export const additionConfigV1Schema = z.object({
  version: z.literal(1),
  problemsPerPage: z.number().int().min(1).max(WORKSHEET_LIMITS.MAX_PROBLEMS_PER_PAGE),
  cols: z.number().int().min(1).max(WORKSHEET_LIMITS.MAX_COLS),
  pages: z.number().int().min(1).max(WORKSHEET_LIMITS.MAX_PAGES),
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
  fontSize: z
    .number()
    .int()
    .min(WORKSHEET_LIMITS.FONT_SIZE.MIN)
    .max(WORKSHEET_LIMITS.FONT_SIZE.MAX),

  // Problem reproducibility (CRITICAL for sharing worksheets)
  seed: z.number().int().min(0).optional(),
  prngAlgorithm: z.string().optional(),
})

export type AdditionConfigV1 = z.infer<typeof additionConfigV1Schema>

/**
 * Addition worksheet config - Version 2
 * Smart difficulty system with conditional display rules
 */
export const additionConfigV2Schema = z.object({
  version: z.literal(2),
  problemsPerPage: z.number().int().min(1).max(WORKSHEET_LIMITS.MAX_PROBLEMS_PER_PAGE),
  cols: z.number().int().min(1).max(WORKSHEET_LIMITS.MAX_COLS),
  pages: z.number().int().min(1).max(WORKSHEET_LIMITS.MAX_PAGES),
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
    borrowNotation: z.enum([
      'always',
      'never',
      'whenRegrouping',
      'whenMultipleRegroups',
      'when3PlusDigits',
    ]),
    borrowingHints: z.enum([
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
  fontSize: z
    .number()
    .int()
    .min(WORKSHEET_LIMITS.FONT_SIZE.MIN)
    .max(WORKSHEET_LIMITS.FONT_SIZE.MAX),
  showTenFramesForAll: z.boolean(),

  // Problem reproducibility (CRITICAL for sharing worksheets)
  seed: z.number().int().min(0).optional(),
  prngAlgorithm: z.string().optional(),
})

export type AdditionConfigV2 = z.infer<typeof additionConfigV2Schema>

/**
 * Addition worksheet config - Version 3
 * Two-mode system: Smart Difficulty vs Manual Control
 */

// Shared base fields for both modes
const additionConfigV3BaseSchema = z.object({
  version: z.literal(3),

  // Core worksheet settings
  problemsPerPage: z.number().int().min(1).max(WORKSHEET_LIMITS.MAX_PROBLEMS_PER_PAGE),
  cols: z.number().int().min(1).max(WORKSHEET_LIMITS.MAX_COLS),
  pages: z.number().int().min(1).max(WORKSHEET_LIMITS.MAX_PAGES),
  orientation: z.enum(['portrait', 'landscape']),
  name: z.string(),
  fontSize: z
    .number()
    .int()
    .min(WORKSHEET_LIMITS.FONT_SIZE.MIN)
    .max(WORKSHEET_LIMITS.FONT_SIZE.MAX),

  // Regrouping probabilities (shared between modes)
  pAnyStart: z.number().min(0).max(1),
  pAllStart: z.number().min(0).max(1),
  interpolate: z.boolean(),

  // Problem reproducibility (CRITICAL for sharing worksheets)
  seed: z.number().int().min(0).optional(),
  prngAlgorithm: z.string().optional(),
})

// Smart Difficulty Mode
const additionConfigV3SmartSchema = additionConfigV3BaseSchema.extend({
  mode: z.literal('smart'),

  // Conditional display rules
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
    borrowNotation: z.enum([
      'always',
      'never',
      'whenRegrouping',
      'whenMultipleRegroups',
      'when3PlusDigits',
    ]),
    borrowingHints: z.enum([
      'always',
      'never',
      'whenRegrouping',
      'whenMultipleRegroups',
      'when3PlusDigits',
    ]),
  }),

  // Optional: Which smart difficulty profile is selected
  difficultyProfile: z.string().optional(),

  // showTenFramesForAll is deprecated in V3 smart mode
  // (controlled by displayRules.tenFrames)
})

// Manual Control Mode
const additionConfigV3ManualSchema = additionConfigV3BaseSchema.extend({
  mode: z.literal('manual'),

  // Simple boolean toggles
  showCarryBoxes: z.boolean(),
  showAnswerBoxes: z.boolean(),
  showPlaceValueColors: z.boolean(),
  showTenFrames: z.boolean(),
  showProblemNumbers: z.boolean(),
  showCellBorder: z.boolean(),
  showTenFramesForAll: z.boolean(),

  // Optional: Which manual preset is selected
  manualPreset: z.string().optional(),
})

// V3 uses discriminated union on 'mode'
export const additionConfigV3Schema = z.discriminatedUnion('mode', [
  additionConfigV3SmartSchema,
  additionConfigV3ManualSchema,
])

export type AdditionConfigV3 = z.infer<typeof additionConfigV3Schema>
export type AdditionConfigV3Smart = z.infer<typeof additionConfigV3SmartSchema>
export type AdditionConfigV3Manual = z.infer<typeof additionConfigV3ManualSchema>

/**
 * Addition worksheet config - Version 4
 * Adds support for variable digit ranges (1-5 digits per number)
 */

// Shared base fields for V4
const additionConfigV4BaseSchema = z.object({
  version: z.literal(4),

  // Core worksheet settings
  problemsPerPage: z.number().int().min(1).max(WORKSHEET_LIMITS.MAX_PROBLEMS_PER_PAGE),
  cols: z.number().int().min(1).max(WORKSHEET_LIMITS.MAX_COLS),
  pages: z.number().int().min(1).max(WORKSHEET_LIMITS.MAX_PAGES),
  orientation: z.enum(['portrait', 'landscape']),
  name: z.string(),
  fontSize: z
    .number()
    .int()
    .min(WORKSHEET_LIMITS.FONT_SIZE.MIN)
    .max(WORKSHEET_LIMITS.FONT_SIZE.MAX),

  // V4: Digit range for problem generation
  digitRange: z
    .object({
      min: z
        .number()
        .int()
        .min(WORKSHEET_LIMITS.DIGIT_RANGE.MIN)
        .max(WORKSHEET_LIMITS.DIGIT_RANGE.MAX),
      max: z
        .number()
        .int()
        .min(WORKSHEET_LIMITS.DIGIT_RANGE.MIN)
        .max(WORKSHEET_LIMITS.DIGIT_RANGE.MAX),
    })
    .refine((data) => data.min <= data.max, {
      message: 'min must be less than or equal to max',
    }),

  // V4: Operator selection (addition, subtraction, or mixed)
  operator: z.enum(['addition', 'subtraction', 'mixed']).default('addition'),

  // Regrouping probabilities (shared between modes)
  pAnyStart: z.number().min(0).max(1),
  pAllStart: z.number().min(0).max(1),
  interpolate: z.boolean(),

  // Problem reproducibility (CRITICAL for sharing worksheets)
  seed: z.number().int().min(0).optional(),
  prngAlgorithm: z.string().optional(),
})

// Smart Difficulty Mode for V4
const additionConfigV4SmartSchema = additionConfigV4BaseSchema.extend({
  mode: z.literal('smart'),

  // Conditional display rules
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
    borrowNotation: z.enum([
      'always',
      'never',
      'whenRegrouping',
      'whenMultipleRegroups',
      'when3PlusDigits',
    ]),
    borrowingHints: z.enum([
      'always',
      'never',
      'whenRegrouping',
      'whenMultipleRegroups',
      'when3PlusDigits',
    ]),
  }),

  // Optional: Which smart difficulty profile is selected
  difficultyProfile: z.string().optional(),
})

// Manual Control Mode for V4
// Now uses displayRules like Smart/Mastery modes for 1:1 correspondence
const additionConfigV4ManualSchema = additionConfigV4BaseSchema.extend({
  mode: z.literal('manual'),

  // Manual mode now uses conditional display rules (same as Smart/Mastery)
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
    borrowNotation: z.enum([
      'always',
      'never',
      'whenRegrouping',
      'whenMultipleRegroups',
      'when3PlusDigits',
    ]),
    borrowingHints: z.enum([
      'always',
      'never',
      'whenRegrouping',
      'whenMultipleRegroups',
      'when3PlusDigits',
    ]),
  }),

  // Optional: Which manual preset is selected
  manualPreset: z.string().optional(),
})

// Mastery Progression Mode for V4
const additionConfigV4MasterySchema = additionConfigV4BaseSchema.extend({
  mode: z.literal('mastery'),

  // Mastery mode uses displayRules like smart mode (conditional scaffolding)
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
    borrowNotation: z.enum([
      'always',
      'never',
      'whenRegrouping',
      'whenMultipleRegroups',
      'when3PlusDigits',
    ]),
    borrowingHints: z.enum([
      'always',
      'never',
      'whenRegrouping',
      'whenMultipleRegroups',
      'when3PlusDigits',
    ]),
  }),

  // Optional: Separate display rules for mixed mode (operator-specific scaffolding)
  // When operator='mixed', additionDisplayRules applies to addition problems,
  // subtractionDisplayRules applies to subtraction problems
  additionDisplayRules: z
    .object({
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
      borrowNotation: z.enum([
        'always',
        'never',
        'whenRegrouping',
        'whenMultipleRegroups',
        'when3PlusDigits',
      ]),
      borrowingHints: z.enum([
        'always',
        'never',
        'whenRegrouping',
        'whenMultipleRegroups',
        'when3PlusDigits',
      ]),
    })
    .optional(),
  subtractionDisplayRules: z
    .object({
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
      borrowNotation: z.enum([
        'always',
        'never',
        'whenRegrouping',
        'whenMultipleRegroups',
        'when3PlusDigits',
      ]),
      borrowingHints: z.enum([
        'always',
        'never',
        'whenRegrouping',
        'whenMultipleRegroups',
        'when3PlusDigits',
      ]),
    })
    .optional(),

  // Optional: Current step in mastery progression path
  currentStepId: z.string().optional(),

  // Optional: Current skills for mixed mode (operator-specific progression)
  currentAdditionSkillId: z.string().optional(),
  currentSubtractionSkillId: z.string().optional(),
})

// V4 uses discriminated union on 'mode'
export const additionConfigV4Schema = z.discriminatedUnion('mode', [
  additionConfigV4SmartSchema,
  additionConfigV4ManualSchema,
  additionConfigV4MasterySchema,
])

export type AdditionConfigV4 = z.infer<typeof additionConfigV4Schema>
export type AdditionConfigV4Smart = z.infer<typeof additionConfigV4SmartSchema>
export type AdditionConfigV4Manual = z.infer<typeof additionConfigV4ManualSchema>
export type AdditionConfigV4Mastery = z.infer<typeof additionConfigV4MasterySchema>

/** Union of all addition config versions (add new versions here) */
export const additionConfigSchema = z.discriminatedUnion('version', [
  additionConfigV1Schema,
  additionConfigV2Schema,
  additionConfigV3Schema,
  additionConfigV4Schema,
])

export type AdditionConfig = z.infer<typeof additionConfigSchema>

/**
 * Default addition config (always latest version - V4 Smart Mode)
 */
export const defaultAdditionConfig: AdditionConfigV4Smart = {
  version: 4,
  mode: 'smart',
  problemsPerPage: 20,
  cols: 5,
  pages: 1,
  orientation: 'landscape',
  name: '',
  digitRange: { min: 2, max: 2 }, // V4: Default to 2-digit problems (backward compatible)
  operator: 'addition',
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
    borrowNotation: 'whenRegrouping',
    borrowingHints: 'never',
  },
  difficultyProfile: 'earlyLearner',
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
    borrowNotation: 'whenRegrouping', // V1 didn't have this field, use reasonable default
    borrowingHints: 'never', // V1 didn't have this field, use reasonable default
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
 * Migrate V2 config to V3
 * Determines mode based on whether difficultyProfile is set
 */
function migrateAdditionV2toV3(v2: AdditionConfigV2): AdditionConfigV3 {
  // If user has a difficultyProfile set, they're using smart mode
  if (v2.difficultyProfile) {
    return {
      version: 3,
      mode: 'smart',
      problemsPerPage: v2.problemsPerPage,
      cols: v2.cols,
      pages: v2.pages,
      orientation: v2.orientation,
      name: v2.name,
      fontSize: v2.fontSize,
      pAnyStart: v2.pAnyStart,
      pAllStart: v2.pAllStart,
      interpolate: v2.interpolate,
      displayRules: v2.displayRules,
      difficultyProfile: v2.difficultyProfile,
      // CRITICAL: Preserve seed/prngAlgorithm for problem reproducibility
      seed: v2.seed,
      prngAlgorithm: v2.prngAlgorithm,
    }
  }

  // No preset → Manual mode
  // Convert displayRules to boolean flags
  return {
    version: 3,
    mode: 'manual',
    problemsPerPage: v2.problemsPerPage,
    cols: v2.cols,
    pages: v2.pages,
    orientation: v2.orientation,
    name: v2.name,
    fontSize: v2.fontSize,
    pAnyStart: v2.pAnyStart,
    pAllStart: v2.pAllStart,
    interpolate: v2.interpolate,
    showCarryBoxes: v2.displayRules.carryBoxes === 'always',
    showAnswerBoxes: v2.displayRules.answerBoxes === 'always',
    showPlaceValueColors: v2.displayRules.placeValueColors === 'always',
    showTenFrames: v2.displayRules.tenFrames === 'always',
    showProblemNumbers: v2.displayRules.problemNumbers === 'always',
    showCellBorder: v2.displayRules.cellBorders === 'always',
    showTenFramesForAll: v2.showTenFramesForAll,
    // CRITICAL: Preserve seed/prngAlgorithm for problem reproducibility
    seed: v2.seed,
    prngAlgorithm: v2.prngAlgorithm,
  }
}

/**
 * Migrate V3 config to V4
 * Adds digitRange field with default of { min: 2, max: 2 } for backward compatibility
 */
function migrateAdditionV3toV4(v3: AdditionConfigV3): AdditionConfigV4 {
  // V3 configs didn't have digitRange or operator, so default to 2-digit addition problems
  const baseFields = {
    version: 4 as const,
    problemsPerPage: v3.problemsPerPage,
    cols: v3.cols,
    pages: v3.pages,
    orientation: v3.orientation,
    name: v3.name,
    fontSize: v3.fontSize,
    digitRange: { min: 2, max: 2 }, // V4: Default to 2-digit for backward compatibility
    operator: 'addition' as const, // V4: Default to addition for backward compatibility
    pAnyStart: v3.pAnyStart,
    pAllStart: v3.pAllStart,
    interpolate: v3.interpolate,
    // CRITICAL: Preserve seed/prngAlgorithm for problem reproducibility
    seed: v3.seed,
    prngAlgorithm: v3.prngAlgorithm,
  }

  if (v3.mode === 'smart') {
    return {
      ...baseFields,
      mode: 'smart',
      displayRules: v3.displayRules,
      difficultyProfile: v3.difficultyProfile,
    }
  } else {
    // V3 Manual mode used boolean flags, V4 Manual mode uses displayRules
    // Convert boolean flags to displayRules (true → 'always', false → 'never')
    return {
      ...baseFields,
      mode: 'manual',
      displayRules: {
        carryBoxes: v3.showCarryBoxes ? 'always' : 'never',
        answerBoxes: v3.showAnswerBoxes ? 'always' : 'never',
        placeValueColors: v3.showPlaceValueColors ? 'always' : 'never',
        tenFrames: v3.showTenFrames ? 'always' : 'never',
        problemNumbers: v3.showProblemNumbers ? 'always' : 'never',
        cellBorders: v3.showCellBorder ? 'always' : 'never',
        borrowNotation: 'always', // V4: Default to 'always' for backward compatibility
        borrowingHints: 'never', // V4: Default to 'never' for backward compatibility
      },
      manualPreset: v3.manualPreset,
    }
  }
}

/**
 * Migrate addition config from any version to latest (V4)
 * @throws {Error} if config is invalid or migration fails
 */
export function migrateAdditionConfig(rawConfig: unknown): AdditionConfigV4 {
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
      // Migrate V1 → V2 → V3 → V4
      return migrateAdditionV3toV4(migrateAdditionV2toV3(migrateAdditionV1toV2(config)))

    case 2:
      // Migrate V2 → V3 → V4
      return migrateAdditionV3toV4(migrateAdditionV2toV3(config))

    case 3:
      // Migrate V3 → V4
      return migrateAdditionV3toV4(config)

    case 4:
      // Already latest version
      return config

    default:
      // Unknown version, return defaults
      console.warn(`Unknown addition config version: ${(config as any).version}`)
      return defaultAdditionConfig
  }
}

/**
 * Parse and validate addition config from JSON string
 * Automatically migrates old versions to latest (V4)
 */
export function parseAdditionConfig(jsonString: string): AdditionConfigV4 {
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
 * Ensures version field is set to current version (V4)
 */
export function serializeAdditionConfig(config: Omit<AdditionConfigV4, 'version'>): string {
  const versioned: AdditionConfigV4 = {
    ...config,
    version: ADDITION_CURRENT_VERSION,
  } as AdditionConfigV4
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
