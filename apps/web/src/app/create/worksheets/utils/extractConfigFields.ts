import type { AdditionConfigV4 } from '../config-schemas'
import type { WorksheetFormState } from '../types'

/**
 * Extract only the persisted config fields from formState
 * Excludes derived state (rows, total, date, seed)
 *
 * This ensures consistent field extraction across:
 * - Auto-save (useWorksheetAutoSave)
 * - Share creation
 * - Settings API
 *
 * @param formState - The current form state (may be partial)
 * @returns Clean config object ready for serialization
 */
export function extractConfigFields(
  formState: WorksheetFormState
): Omit<AdditionConfigV4, 'version'> {
  return {
    problemsPerPage: formState.problemsPerPage!,
    cols: formState.cols!,
    pages: formState.pages!,
    orientation: formState.orientation!,
    name: formState.name!,
    digitRange: formState.digitRange!,
    operator: formState.operator!,
    pAnyStart: formState.pAnyStart!,
    pAllStart: formState.pAllStart!,
    interpolate: formState.interpolate!,
    showCarryBoxes: formState.showCarryBoxes,
    showAnswerBoxes: formState.showAnswerBoxes,
    showPlaceValueColors: formState.showPlaceValueColors,
    showProblemNumbers: formState.showProblemNumbers,
    showCellBorder: formState.showCellBorder,
    showTenFrames: formState.showTenFrames,
    showTenFramesForAll: formState.showTenFramesForAll,
    showBorrowNotation: formState.showBorrowNotation,
    showBorrowingHints: formState.showBorrowingHints,
    fontSize: formState.fontSize,
    mode: formState.mode!,
    difficultyProfile: formState.difficultyProfile,
    displayRules: formState.displayRules,
    manualPreset: formState.manualPreset,
    // Mastery mode fields (optional)
    currentStepId: formState.currentStepId,
    currentAdditionSkillId: formState.currentAdditionSkillId,
    currentSubtractionSkillId: formState.currentSubtractionSkillId,
  }
}
