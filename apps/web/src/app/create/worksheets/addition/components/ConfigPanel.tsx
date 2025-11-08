'use client'

import { stack } from '../../../../../../styled-system/patterns'
import type { WorksheetFormState } from '../types'
import { ModeSelector } from './ModeSelector'
import { StudentNameInput } from './config-panel/StudentNameInput'
import { DigitRangeSection } from './config-panel/DigitRangeSection'
import { OperatorSection } from './config-panel/OperatorSection'
import { ProgressiveDifficultyToggle } from './config-panel/ProgressiveDifficultyToggle'
import { SmartModeControls } from './config-panel/SmartModeControls'
import { ManualModeControls } from './config-panel/ManualModeControls'

interface ConfigPanelProps {
  formState: WorksheetFormState
  onChange: (updates: Partial<WorksheetFormState>) => void
}

export function ConfigPanel({ formState, onChange }: ConfigPanelProps) {
  // Helper to get default column count for a given problemsPerPage (user can override)
  const getDefaultColsForProblemsPerPage = (
    problemsPerPage: number,
    orientation: 'portrait' | 'landscape'
  ): number => {
    if (orientation === 'portrait') {
      // Portrait: prefer 2-3 columns
      if (problemsPerPage === 6) return 2
      if (problemsPerPage === 8) return 2
      if (problemsPerPage === 10) return 2
      if (problemsPerPage === 12) return 3
      if (problemsPerPage === 15) return 3
      return 2 // default
    } else {
      // Landscape: prefer 4-5 columns
      if (problemsPerPage === 8) return 4
      if (problemsPerPage === 10) return 5
      if (problemsPerPage === 12) return 4
      if (problemsPerPage === 15) return 5
      if (problemsPerPage === 16) return 4
      if (problemsPerPage === 20) return 5
      return 4 // default
    }
  }

  // Helper to calculate derived state (rows, total) from primary state (problemsPerPage, cols, pages)
  const calculateDerivedState = (problemsPerPage: number, cols: number, pages: number) => {
    const rowsPerPage = problemsPerPage / cols
    const rows = rowsPerPage * pages
    const total = problemsPerPage * pages
    return { rows, total }
  }

  // Get current primary state with defaults
  const currentOrientation = formState.orientation || 'portrait'
  const currentProblemsPerPage =
    formState.problemsPerPage || (currentOrientation === 'portrait' ? 15 : 20)
  const currentCols =
    formState.cols || getDefaultColsForProblemsPerPage(currentProblemsPerPage, currentOrientation)
  const currentPages = formState.pages || 1

  console.log('=== ConfigPanel Render ===')
  console.log('Primary state:', {
    problemsPerPage: currentProblemsPerPage,
    cols: currentCols,
    pages: currentPages,
    orientation: currentOrientation,
  })
  console.log(
    'Derived state:',
    calculateDerivedState(currentProblemsPerPage, currentCols, currentPages)
  )

  // Helper function to handle difficulty adjustments
  const handleDifficultyChange = (mode: DifficultyMode, direction: 'harder' | 'easier') => {
    // Defensive: Ensure all required fields are defined before calling makeHarder/makeEasier
    // This prevents "Cannot read properties of undefined" errors in production

    // Log warning if any fields are missing (helps debug production issues)
    if (!formState.displayRules || !formState.pAnyStart || !formState.pAllStart) {
      console.error('[ConfigPanel] Missing required fields for difficulty adjustment!', {
        hasDisplayRules: !!formState.displayRules,
        hasPAnyStart: formState.pAnyStart !== undefined,
        hasPAllStart: formState.pAllStart !== undefined,
        formState,
      })
    }

    const currentState = {
      pAnyStart: formState.pAnyStart ?? defaultAdditionConfig.pAnyStart,
      pAllStart: formState.pAllStart ?? defaultAdditionConfig.pAllStart,
      displayRules: formState.displayRules ?? defaultAdditionConfig.displayRules,
    }

    const result =
      direction === 'harder' ? makeHarder(currentState, mode) : makeEasier(currentState, mode)

    const beforeReg = calculateRegroupingIntensity(currentState.pAnyStart, currentState.pAllStart)
    const beforeScaf = calculateScaffoldingLevel(currentState.displayRules, beforeReg)
    const afterReg = calculateRegroupingIntensity(result.pAnyStart, result.pAllStart)
    const afterScaf = calculateScaffoldingLevel(result.displayRules, afterReg)

    console.log(`=== MAKE ${direction.toUpperCase()} (${mode}) ===`)
    console.log(
      `BEFORE: (${beforeReg.toFixed(2)}, ${beforeScaf.toFixed(2)}) | pAny=${(currentState.pAnyStart * 100).toFixed(0)}% pAll=${(currentState.pAllStart * 100).toFixed(0)}% | rules=${JSON.stringify(currentState.displayRules)}`
    )
    console.log(
      `AFTER:  (${afterReg.toFixed(2)}, ${afterScaf.toFixed(2)}) | pAny=${(result.pAnyStart * 100).toFixed(0)}% pAll=${(result.pAllStart * 100).toFixed(0)}% | rules=${JSON.stringify(result.displayRules)}`
    )
    console.log(
      `DELTA:  (${(afterReg - beforeReg).toFixed(2)}, ${(afterScaf - beforeScaf).toFixed(2)})`
    )
    console.log(`DESC:   ${result.changeDescription}`)
    console.log('==================')

    onChange({
      difficultyProfile: result.difficultyProfile,
      displayRules: result.displayRules,
      pAllStart: result.pAllStart,
      pAnyStart: result.pAnyStart,
    })
  }

  // Handler for mode switching
  const handleModeChange = (newMode: 'smart' | 'manual') => {
    if (formState.mode === newMode) {
      return // No change needed
    }

    if (newMode === 'smart') {
      // Switching to Smart mode
      // Use current displayRules if available, otherwise default to earlyLearner
      const displayRules = formState.displayRules ?? defaultAdditionConfig.displayRules
      onChange({
        mode: 'smart',
        displayRules,
        difficultyProfile: 'earlyLearner',
      } as unknown as Partial<WorksheetFormState>)
    } else {
      // Switching to Manual mode
      // Convert current displayRules to boolean flags if available
      let booleanFlags = {
        showCarryBoxes: true,
        showAnswerBoxes: true,
        showPlaceValueColors: true,
        showTenFrames: false,
        showProblemNumbers: true,
        showCellBorder: true,
        showTenFramesForAll: false,
      }

      if (formState.displayRules) {
        // Convert 'always' to true, everything else to false
        booleanFlags = {
          showCarryBoxes: formState.displayRules.carryBoxes === 'always',
          showAnswerBoxes: formState.displayRules.answerBoxes === 'always',
          showPlaceValueColors: formState.displayRules.placeValueColors === 'always',
          showTenFrames: formState.displayRules.tenFrames === 'always',
          showProblemNumbers: formState.displayRules.problemNumbers === 'always',
          showCellBorder: formState.displayRules.cellBorders === 'always',
          showTenFramesForAll: false,
        }
      }

      onChange({
        mode: 'manual',
        ...booleanFlags,
      } as unknown as Partial<WorksheetFormState>)
    }
  }

  return (
    <div data-component="config-panel" className={stack({ gap: '3' })}>
      {/* Student Name */}
      <StudentNameInput value={formState.name} onChange={(name) => onChange({ name })} />

      {/* Digit Range Selector */}
      <DigitRangeSection
        digitRange={formState.digitRange}
        onChange={(digitRange) => onChange({ digitRange })}
      />

      {/* Operator Selector */}
      <OperatorSection
        operator={formState.operator}
        onChange={(operator) => onChange({ operator })}
      />

      {/* Mode Selector */}
      <ModeSelector currentMode={formState.mode ?? 'smart'} onChange={handleModeChange} />

      {/* Progressive Difficulty Toggle - Available for both modes */}
      <ProgressiveDifficultyToggle
        interpolate={formState.interpolate}
        onChange={(interpolate) => onChange({ interpolate })}
      />

      {/* Smart Mode Controls */}
      {(!formState.mode || formState.mode === 'smart') && (
        <SmartModeControls formState={formState} onChange={onChange} />
      )}

      {/* Manual Mode Controls */}
      {formState.mode === 'manual' && (
        <ManualModeControls formState={formState} onChange={onChange} />
      )}
    </div>
  )
}
