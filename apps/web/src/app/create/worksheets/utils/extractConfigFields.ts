import type { AdditionConfigV4 } from '../config-schemas'
import type { WorksheetFormState } from '../types'

/**
 * Extract only the persisted config fields from formState
 *
 * ## Architecture: Blacklist Approach
 *
 * This function uses a **blacklist approach** to extract config fields:
 * - Automatically includes ALL fields from formState
 * - Only excludes specific derived/ephemeral fields: rows, total, date
 *
 * ### Why Blacklist Instead of Whitelist?
 *
 * **Previous approach (FRAGILE):**
 * - Manually listed every field to include
 * - Adding new config fields required updating this function
 * - Forgetting to update caused shared worksheets to break
 * - Multiple incidents where new fields weren't shared correctly
 *
 * **Current approach (ROBUST):**
 * - New config fields automatically work in shared worksheets
 * - Only need to update if adding new DERIVED fields
 * - Much harder to accidentally break sharing
 *
 * ### Field Categories
 *
 * **PRIMARY STATE** (persisted):
 * - problemsPerPage, cols, pages - define worksheet structure
 * - digitRange, operator - define problem space
 * - pAnyStart, pAllStart, interpolate - control regrouping distribution
 * - mode, displayRules, difficultyProfile, etc. - control display behavior
 * - seed, prngAlgorithm - ensure exact problem reproduction when shared
 *
 * **DERIVED STATE** (excluded):
 * - `total` = problemsPerPage × pages (recalculated on load)
 * - `rows` = Math.ceil((problemsPerPage / cols)) (recalculated on load)
 *
 * **EPHEMERAL STATE** (excluded):
 * - `date` - generated fresh at render time, not persisted
 *
 * ### Usage
 *
 * This function ensures consistent extraction across:
 * - Auto-save to localStorage (useWorksheetAutoSave hook)
 * - Share link creation (POST /api/worksheets/share)
 * - Settings persistence (POST /api/worksheets/settings)
 *
 * ### Critical for Sharing
 *
 * The `seed` and `prngAlgorithm` fields are CRITICAL - they ensure that
 * shared worksheets generate the exact same problems when opened by others.
 * Without these, each person would see different random problems.
 *
 * @param formState - The current form state (may be partial during editing)
 * @returns Clean config object ready for serialization (JSON.stringify)
 *
 * @example
 * // In ShareModal component
 * const config = extractConfigFields(formState)
 * await fetch('/api/worksheets/share', {
 *   method: 'POST',
 *   body: JSON.stringify({ worksheetType: 'addition', config })
 * })
 */
export function extractConfigFields(
  formState: WorksheetFormState
): Omit<AdditionConfigV4, 'version'> & { seed?: number; prngAlgorithm?: string } {
  // Blacklist approach: Exclude only derived/ephemeral fields
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { rows, total, date, ...persistedFields } = formState

  // Ensure prngAlgorithm has a default (critical for reproducibility)
  const config = {
    ...persistedFields,
    prngAlgorithm: persistedFields.prngAlgorithm ?? 'mulberry32',
  }

  console.log('[extractConfigFields] Extracted config:', {
    fieldCount: Object.keys(config).length,
    seed: config.seed,
    prngAlgorithm: config.prngAlgorithm,
    pages: config.pages,
    problemsPerPage: config.problemsPerPage,
    mode: (config as any).mode,
    operator: (config as any).operator,
    displayRules: (config as any).displayRules,
    additionDisplayRules: (config as any).additionDisplayRules,
    subtractionDisplayRules: (config as any).subtractionDisplayRules,
    excludedFields: ['rows', 'total', 'date'],
  })

  return config
}
