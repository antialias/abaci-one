'use client'

import { stack } from '../../../../../../styled-system/patterns'
import type { WorksheetFormState } from '../types'
import { defaultAdditionConfig } from '@/app/create/worksheets/config-schemas'
import { ModeSelector } from './ModeSelector'
import { StudentNameInput } from './config-panel/StudentNameInput'
import { DigitRangeSection } from './config-panel/DigitRangeSection'
import { OperatorSection } from './config-panel/OperatorSection'
import { ProgressiveDifficultyToggle } from './config-panel/ProgressiveDifficultyToggle'
import { SmartModeControls } from './config-panel/SmartModeControls'
import { ManualModeControls } from './config-panel/ManualModeControls'
import { MasteryModePanel } from './config-panel/MasteryModePanel'

interface ConfigPanelProps {
  formState: WorksheetFormState
  onChange: (updates: Partial<WorksheetFormState>) => void
  isDark?: boolean
}

export function ConfigPanel({ formState, onChange, isDark = false }: ConfigPanelProps) {
  // Handler for mode switching
  const handleModeChange = (newMode: 'smart' | 'manual' | 'mastery') => {
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
    } else if (newMode === 'manual') {
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
    } else {
      // Switching to Mastery mode
      // Mastery mode uses Smart mode under the hood with skill-based configuration
      const displayRules = formState.displayRules ?? defaultAdditionConfig.displayRules
      onChange({
        mode: 'mastery',
        displayRules,
      } as unknown as Partial<WorksheetFormState>)
    }
  }

  return (
    <div data-component="config-panel" className={stack({ gap: '3' })}>
      {/* Student Name */}
      <StudentNameInput
        value={formState.name}
        onChange={(name) => onChange({ name })}
        isDark={isDark}
      />

      {/* Digit Range Selector */}
      <DigitRangeSection
        digitRange={formState.digitRange}
        onChange={(digitRange) => onChange({ digitRange })}
        isDark={isDark}
      />

      {/* Operator Selector */}
      <OperatorSection
        operator={formState.operator}
        onChange={(operator) => onChange({ operator })}
        isDark={isDark}
      />

      {/* Progressive Difficulty Toggle - Available for all modes */}
      <ProgressiveDifficultyToggle
        interpolate={formState.interpolate}
        onChange={(interpolate) => onChange({ interpolate })}
        isDark={isDark}
      />

      {/* Mode Selector */}
      <ModeSelector
        currentMode={formState.mode ?? 'smart'}
        onChange={handleModeChange}
        isDark={isDark}
      />

      {/* Smart Mode Controls */}
      {(!formState.mode || formState.mode === 'smart') && (
        <SmartModeControls formState={formState} onChange={onChange} isDark={isDark} />
      )}

      {/* Manual Mode Controls */}
      {formState.mode === 'manual' && (
        <ManualModeControls formState={formState} onChange={onChange} isDark={isDark} />
      )}

      {/* Mastery Mode Controls */}
      {formState.mode === 'mastery' && (
        <MasteryModePanel formState={formState} onChange={onChange} isDark={isDark} />
      )}
    </div>
  )
}
