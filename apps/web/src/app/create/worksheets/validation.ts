// Validation logic for worksheet configuration

import type {
  WorksheetFormState,
  WorksheetConfig,
  ValidationResult,
} from '@/app/create/worksheets/types'
import type { DisplayRules } from './displayRules'
import { getSkillById } from './skills'
import { WORKSHEET_LIMITS } from './constants/validation'

/**
 * Get current date formatted as "Month Day, Year"
 */
function getDefaultDate(): string {
  const now = new Date()
  return now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Merge user display rules with skill recommendations, resolving "auto" values
 *
 * For each display rule field:
 * - If user value is "auto" → use skill's recommendation
 * - If user value is undefined → use skill's recommendation
 * - Otherwise → use user's explicit value (manual override)
 *
 * @param skillRules - The skill's recommended scaffolding settings
 * @param userRules - The user's custom scaffolding settings (may contain "auto")
 * @returns Fully resolved display rules with no "auto" values
 */
function mergeDisplayRulesWithAuto(
  skillRules: DisplayRules,
  userRules: Partial<DisplayRules>
): DisplayRules {
  const result: Record<string, any> = {}

  for (const key of Object.keys(skillRules) as Array<keyof DisplayRules>) {
    const userValue = userRules[key]
    // If user value is "auto" or undefined, use skill's recommendation
    // Otherwise, use user's explicit value (manual override)
    result[key] = userValue === 'auto' || userValue === undefined ? skillRules[key] : userValue
  }

  return result as DisplayRules
}

/**
 * Validate and create complete config from partial form state
 */
export function validateWorksheetConfig(formState: WorksheetFormState): ValidationResult {
  const errors: string[] = []

  // Validate cols first (needed for rows calculation)
  const cols = formState.cols ?? 4
  if (cols < 1 || cols > WORKSHEET_LIMITS.MAX_COLS) {
    errors.push(`Columns must be between 1 and ${WORKSHEET_LIMITS.MAX_COLS}`)
  }

  // ========================================
  // PRIMARY STATE → DERIVED STATE
  // ========================================
  //
  // This section demonstrates the core principle of our config persistence:
  //
  // PRIMARY STATE (saved, source of truth):
  //   - problemsPerPage: How many problems per page (e.g., 20)
  //   - pages: How many pages (e.g., 5)
  //
  // DERIVED STATE (calculated, never saved):
  //   - total = problemsPerPage × pages (e.g., 100)
  //   - rows = Math.ceil(problemsPerPage / cols) (e.g., 5)
  //
  // Why this matters:
  //   - When sharing worksheets, we only save PRIMARY state
  //   - When loading shared worksheets, we MUST calculate DERIVED state
  //   - Never use formState.total as fallback - it may be missing for shared worksheets!
  //   - See .claude/WORKSHEET_CONFIG_PERSISTENCE.md for full architecture
  //
  // Example bug that was fixed (2025-01):
  //   - Shared 100-page worksheet
  //   - formState.total was missing (correctly excluded from share)
  //   - Old code: total = formState.total ?? 20 (WRONG!)
  //   - Result: Generated only 20 problems → 1 page instead of 100
  //   - Fix: total = problemsPerPage × pages (from PRIMARY state)
  //

  // Get primary state values (source of truth for calculation)
  const problemsPerPage = formState.problemsPerPage ?? formState.total ?? 20
  const pages = formState.pages ?? 1

  // Calculate derived state: total = problemsPerPage × pages
  // DO NOT use formState.total as source of truth - it may be missing!
  const total = problemsPerPage * pages

  console.log('[validateWorksheetConfig] PRIMARY → DERIVED state:', {
    // Primary (source of truth)
    problemsPerPage,
    pages,
    // Derived (calculated)
    total,
    // Debug: check if formState had these values
    hadTotal: formState.total !== undefined,
    totalMatches: formState.total === total,
  })

  if (total < 1 || total > WORKSHEET_LIMITS.MAX_TOTAL_PROBLEMS) {
    errors.push(`Total problems must be between 1 and ${WORKSHEET_LIMITS.MAX_TOTAL_PROBLEMS}`)
  }

  // Calculate derived state: rows based on problemsPerPage and cols
  const rows = Math.ceil(problemsPerPage / cols)

  // Validate probabilities (0-1 range)
  // CRITICAL: Must check for undefined/null explicitly, not use ?? operator
  // because 0 is a valid value (e.g., "no regrouping" skills set pAnyStart=0)
  const pAnyStart =
    formState.pAnyStart !== undefined && formState.pAnyStart !== null ? formState.pAnyStart : 0.75
  const pAllStart =
    formState.pAllStart !== undefined && formState.pAllStart !== null ? formState.pAllStart : 0.25
  if (pAnyStart < 0 || pAnyStart > 1) {
    errors.push('pAnyStart must be between 0 and 1')
  }
  if (pAllStart < 0 || pAllStart > 1) {
    errors.push('pAllStart must be between 0 and 1')
  }
  if (pAllStart > pAnyStart) {
    errors.push('pAllStart cannot be greater than pAnyStart')
  }

  // Validate fontSize
  const fontSize = formState.fontSize ?? 16
  if (fontSize < WORKSHEET_LIMITS.FONT_SIZE.MIN || fontSize > WORKSHEET_LIMITS.FONT_SIZE.MAX) {
    errors.push(
      `Font size must be between ${WORKSHEET_LIMITS.FONT_SIZE.MIN} and ${WORKSHEET_LIMITS.FONT_SIZE.MAX}`
    )
  }

  // V4: Validate digitRange (min and max must be 1-5, min <= max)
  // Note: Same range applies to both addition and subtraction
  const digitRange = formState.digitRange ?? { min: 2, max: 2 }
  if (
    !digitRange.min ||
    digitRange.min < WORKSHEET_LIMITS.DIGIT_RANGE.MIN ||
    digitRange.min > WORKSHEET_LIMITS.DIGIT_RANGE.MAX
  ) {
    errors.push(
      `Digit range min must be between ${WORKSHEET_LIMITS.DIGIT_RANGE.MIN} and ${WORKSHEET_LIMITS.DIGIT_RANGE.MAX}`
    )
  }
  if (
    !digitRange.max ||
    digitRange.max < WORKSHEET_LIMITS.DIGIT_RANGE.MIN ||
    digitRange.max > WORKSHEET_LIMITS.DIGIT_RANGE.MAX
  ) {
    errors.push(
      `Digit range max must be between ${WORKSHEET_LIMITS.DIGIT_RANGE.MIN} and ${WORKSHEET_LIMITS.DIGIT_RANGE.MAX}`
    )
  }
  if (digitRange.min > digitRange.max) {
    errors.push('Digit range min cannot be greater than max')
  }

  // V4: Validate operator (addition, subtraction, or mixed)
  const operator = formState.operator ?? 'addition'
  if (!['addition', 'subtraction', 'mixed'].includes(operator)) {
    errors.push('Operator must be "addition", "subtraction", or "mixed"')
  }

  // Validate seed (must be positive integer)
  const seed = formState.seed ?? Date.now() % 2147483647
  if (!Number.isInteger(seed) || seed < 0) {
    errors.push('Seed must be a non-negative integer')
  }

  if (errors.length > 0) {
    return { isValid: false, errors }
  }

  // Determine orientation based on columns (portrait = 2-3 cols, landscape = 4-5 cols)
  const orientation = formState.orientation || (cols <= 3 ? 'portrait' : 'landscape')

  // Determine mode (default to 'smart' if not specified)
  const mode: 'smart' | 'manual' | 'mastery' = formState.mode ?? 'smart'

  // Shared fields for both modes
  const sharedFields = {
    // Primary state
    problemsPerPage,
    cols,
    pages,
    orientation,

    // Derived state
    total,
    rows,

    // Other fields
    name: formState.name?.trim() || 'Student',
    date: formState.date?.trim() || getDefaultDate(),
    pAnyStart,
    pAllStart,
    // Default interpolate based on mode: true for smart/manual, false for mastery
    interpolate:
      formState.interpolate !== undefined
        ? formState.interpolate
        : mode === 'mastery'
          ? false
          : true,

    // V4: Digit range for problem generation
    digitRange,

    // V4: Operator selection (addition, subtraction, or mixed)
    operator: formState.operator ?? 'addition',

    // Layout
    page: {
      wIn: orientation === 'portrait' ? 8.5 : 11,
      hIn: orientation === 'portrait' ? 11 : 8.5,
    },
    margins: {
      left: 0.6,
      right: 0.6,
      top: 1.1,
      bottom: 0.7,
    },

    fontSize,
    seed,
    prngAlgorithm: formState.prngAlgorithm ?? 'mulberry32',
  }

  // Build mode-specific config
  let config: WorksheetConfig

  if (mode === 'smart' || mode === 'mastery') {
    // Smart & Mastery modes: Use displayRules for conditional scaffolding

    // Default display rules
    let baseDisplayRules: DisplayRules = {
      carryBoxes: 'whenRegrouping',
      answerBoxes: 'always',
      placeValueColors: 'always',
      tenFrames: 'whenRegrouping',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'whenRegrouping', // Subtraction: show when borrowing
      borrowingHints: 'never', // Subtraction: no hints by default
    }

    // Mastery mode: Apply recommendedScaffolding from current skill(s)
    if (mode === 'mastery') {
      const operator = formState.operator ?? 'addition'

      if (operator === 'mixed') {
        // Mixed mode: Store SEPARATE display rules for each operator
        // The typstGenerator will choose which rules to apply per-problem
        const addSkillId = formState.currentAdditionSkillId
        const subSkillId = formState.currentSubtractionSkillId

        if (addSkillId && subSkillId) {
          const addSkill = getSkillById(addSkillId as any)
          const subSkill = getSkillById(subSkillId as any)

          if (addSkill?.recommendedScaffolding && subSkill?.recommendedScaffolding) {
            // Store both separately - will be used per-problem in typstGenerator
            // Note: This will be added to the config below as additionDisplayRules/subtractionDisplayRules
          }
        }
      } else {
        // Single operator: Use its recommendedScaffolding
        const skillId =
          operator === 'addition'
            ? formState.currentAdditionSkillId
            : formState.currentSubtractionSkillId

        if (skillId) {
          const skill = getSkillById(skillId as any)
          if (skill?.recommendedScaffolding) {
            baseDisplayRules = { ...skill.recommendedScaffolding }
          }
        }
      }
    }

    // Merge user's display rules with skill recommendations, resolving "auto" values
    const userDisplayRules = (formState.displayRules as any) ?? {}
    const displayRules: DisplayRules =
      mode === 'mastery'
        ? mergeDisplayRulesWithAuto(baseDisplayRules, userDisplayRules)
        : {
            ...baseDisplayRules,
            ...userDisplayRules, // Smart mode: direct override (no "auto" resolution)
          }

    console.log('[MASTERY MODE] Display rules resolved:', {
      mode,
      baseDisplayRules,
      userDisplayRules,
      resolvedDisplayRules: displayRules,
    })

    // Build config with operator-specific display rules for mixed mode
    const operator = formState.operator ?? 'addition'
    const baseConfig = {
      version: 4,
      mode: mode as 'smart' | 'mastery', // Preserve the actual mode
      displayRules,
      difficultyProfile: formState.difficultyProfile,
      currentStepId: formState.currentStepId, // Mastery progression tracking
      ...sharedFields,
    }

    // Add operator-specific display rules for mastery+mixed mode
    if (mode === 'mastery' && operator === 'mixed') {
      const addSkillId = formState.currentAdditionSkillId
      const subSkillId = formState.currentSubtractionSkillId

      if (addSkillId && subSkillId) {
        const addSkill = getSkillById(addSkillId as any)
        const subSkill = getSkillById(subSkillId as any)

        if (addSkill?.recommendedScaffolding && subSkill?.recommendedScaffolding) {
          // Merge user's operator-specific displayRules with skill's recommended scaffolding
          // Resolves "auto" values to skill recommendations
          // Falls back to general displayRules if operator-specific rules don't exist
          const userAdditionRules: Partial<DisplayRules> =
            (formState as any).additionDisplayRules || formState.displayRules || {}
          const userSubtractionRules: Partial<DisplayRules> =
            (formState as any).subtractionDisplayRules || formState.displayRules || {}

          console.log('[MIXED MODE SCAFFOLDING] User rules (may contain "auto"):', {
            additionRules: userAdditionRules,
            subtractionRules: userSubtractionRules,
            generalRules: formState.displayRules,
          })

          // Resolve "auto" values to skill recommendations
          const resolvedAdditionRules = mergeDisplayRulesWithAuto(
            addSkill.recommendedScaffolding,
            userAdditionRules
          )
          const resolvedSubtractionRules = mergeDisplayRulesWithAuto(
            subSkill.recommendedScaffolding,
            userSubtractionRules
          )

          config = {
            ...baseConfig,
            additionDisplayRules: resolvedAdditionRules,
            subtractionDisplayRules: resolvedSubtractionRules,
          } as any

          console.log('[MIXED MODE SCAFFOLDING] Final config (after resolving "auto"):', {
            additionDisplayRules: config.additionDisplayRules,
            subtractionDisplayRules: config.subtractionDisplayRules,
          })
        } else {
          console.log('[MIXED MODE SCAFFOLDING] Missing recommendedScaffolding', {
            addSkill: addSkill?.name,
            hasAddScaffolding: !!addSkill?.recommendedScaffolding,
            subSkill: subSkill?.name,
            hasSubScaffolding: !!subSkill?.recommendedScaffolding,
          })
          config = baseConfig as any
        }
      } else {
        config = baseConfig as any
      }
    } else {
      config = baseConfig as any
    }
  } else {
    // Manual mode: Use displayRules (same as Smart/Mastery)
    const displayRules: DisplayRules = formState.displayRules ?? {
      carryBoxes: 'always',
      answerBoxes: 'always',
      placeValueColors: 'always',
      tenFrames: 'never',
      problemNumbers: 'always',
      cellBorders: 'always',
      borrowNotation: 'always',
      borrowingHints: 'never',
    }

    config = {
      version: 4,
      mode: 'manual',
      displayRules,
      manualPreset: formState.manualPreset,
      ...sharedFields,
    }
  }

  return { isValid: true, config }
}
