'use client'

import { stack } from '@styled/patterns'
import type { WorksheetFormState } from '@/app/create/worksheets/types'
import { defaultAdditionConfig } from '@/app/create/worksheets/config-schemas'
import { WorksheetConfigProvider } from './WorksheetConfigContext'
import { DifficultyMethodSelector } from './DifficultyMethodSelector'
import { StudentNameInput } from './config-panel/StudentNameInput'
import { OperatorSection } from './config-panel/OperatorSection'
import { ProgressiveDifficultyToggle } from './config-panel/ProgressiveDifficultyToggle'
import { SmartModeControls } from './config-panel/SmartModeControls'
import { MasteryModePanel } from './config-panel/MasteryModePanel'
import { DisplayControlsPanel } from './DisplayControlsPanel'

interface ConfigPanelProps {
  formState: WorksheetFormState
  onChange: (updates: Partial<WorksheetFormState>) => void
  isDark?: boolean
}

export function ConfigPanel({ formState, onChange, isDark = false }: ConfigPanelProps) {
  // Handler for difficulty method switching (smart vs mastery)
  const handleMethodChange = (newMethod: 'smart' | 'mastery') => {
    const currentMethod = formState.mode === 'mastery' ? 'mastery' : 'smart'
    if (currentMethod === newMethod) {
      return // No change needed
    }

    // Preserve displayRules when switching
    const displayRules = formState.displayRules ?? defaultAdditionConfig.displayRules

    if (newMethod === 'smart') {
      onChange({
        mode: 'smart',
        displayRules,
        difficultyProfile: 'earlyLearner',
      } as unknown as Partial<WorksheetFormState>)
    } else {
      onChange({
        mode: 'mastery',
        displayRules,
      } as unknown as Partial<WorksheetFormState>)
    }
  }

  // Determine current method for selector
  const currentMethod = formState.mode === 'mastery' ? 'mastery' : 'smart'

  return (
    <WorksheetConfigProvider formState={formState} onChange={onChange}>
      <div data-component="config-panel" className={stack({ gap: '3' })}>
        {/* Student Name */}
        <StudentNameInput
          value={formState.name}
          onChange={(name) => onChange({ name })}
          isDark={isDark}
        />

        {/* Operator Selector */}
        <OperatorSection
          operator={formState.operator}
          onChange={(operator) => onChange({ operator })}
          isDark={isDark}
        />

        {/* Progressive Difficulty Toggle */}
        <ProgressiveDifficultyToggle
          interpolate={formState.interpolate}
          onChange={(interpolate) => onChange({ interpolate })}
          isDark={isDark}
        />

        {/* Display Controls - Always visible for manual adjustment */}
        <DisplayControlsPanel formState={formState} onChange={onChange} isDark={isDark} />

        {/* Difficulty Method Selector (Smart vs Mastery) */}
        <DifficultyMethodSelector
          currentMethod={currentMethod}
          onChange={handleMethodChange}
          isDark={isDark}
        />

        {/* Method-specific preset controls */}
        {currentMethod === 'smart' && (
          <SmartModeControls formState={formState} onChange={onChange} />
        )}

        {currentMethod === 'mastery' && (
          <MasteryModePanel formState={formState} onChange={onChange} isDark={isDark} />
        )}
      </div>
    </WorksheetConfigProvider>
  )
}
