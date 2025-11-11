// Validation logic for worksheet configuration

import type { WorksheetFormState, WorksheetConfig, ValidationResult } from './types'
import type { DisplayRules } from './displayRules'
import { getSkillById } from './skills'

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
 * Validate and create complete config from partial form state
 */
export function validateWorksheetConfig(formState: WorksheetFormState): ValidationResult {
  const errors: string[] = []

  // Validate total (must be positive, reasonable limit)
  const total = formState.total ?? 20
  if (total < 1 || total > 100) {
    errors.push('Total problems must be between 1 and 100')
  }

  // Validate cols and auto-calculate rows
  const cols = formState.cols ?? 4
  if (cols < 1 || cols > 10) {
    errors.push('Columns must be between 1 and 10')
  }

  // Auto-calculate rows to fit all problems
  const rows = Math.ceil(total / cols)

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
  if (fontSize < 8 || fontSize > 32) {
    errors.push('Font size must be between 8 and 32')
  }

  // V4: Validate digitRange (min and max must be 1-5, min <= max)
  // Note: Same range applies to both addition and subtraction
  const digitRange = formState.digitRange ?? { min: 2, max: 2 }
  if (!digitRange.min || digitRange.min < 1 || digitRange.min > 5) {
    errors.push('Digit range min must be between 1 and 5')
  }
  if (!digitRange.max || digitRange.max < 1 || digitRange.max > 5) {
    errors.push('Digit range max must be between 1 and 5')
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

  // Get primary state values
  const problemsPerPage = formState.problemsPerPage ?? total
  const pages = formState.pages ?? 1

  // Determine mode (default to 'smart' if not specified)
  const mode = formState.mode ?? 'smart'

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

    const displayRules: DisplayRules = {
      ...baseDisplayRules,
      ...((formState.displayRules as any) ?? {}), // Override with provided rules if any
    }

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
          // Merge user's displayRules with skill's recommended scaffolding
          // User's displayRules take precedence for problemNumbers and cellBorders (layout options)
          const userDisplayRules = formState.displayRules || {}

          config = {
            ...baseConfig,
            additionDisplayRules: {
              ...addSkill.recommendedScaffolding,
              // Override layout options with user's choices
              problemNumbers: userDisplayRules.problemNumbers ?? addSkill.recommendedScaffolding.problemNumbers,
              cellBorders: userDisplayRules.cellBorders ?? addSkill.recommendedScaffolding.cellBorders,
            },
            subtractionDisplayRules: {
              ...subSkill.recommendedScaffolding,
              // Override layout options with user's choices
              problemNumbers: userDisplayRules.problemNumbers ?? subSkill.recommendedScaffolding.problemNumbers,
              cellBorders: userDisplayRules.cellBorders ?? subSkill.recommendedScaffolding.cellBorders,
            },
          } as any
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
