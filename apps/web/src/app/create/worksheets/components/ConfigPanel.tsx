'use client'

import { useEffect, useState } from 'react'
import { stack } from '@styled/patterns'
import { css } from '@styled/css'
import type { WorksheetFormState } from '@/app/create/worksheets/types'
import { defaultAdditionConfig } from '@/app/create/worksheets/config-schemas'
import { WorksheetConfigProvider } from './WorksheetConfigContext'
import { DifficultyMethodSelector } from './DifficultyMethodSelector'
import { StudentNameInput } from './config-panel/StudentNameInput'
import { OperatorSection } from './config-panel/OperatorSection'
import { ProgressiveDifficultyToggle } from './config-panel/ProgressiveDifficultyToggle'
import { CustomModeControls } from './config-panel/CustomModeControls'
import { MasteryModePanel } from './config-panel/MasteryModePanel'
import { DisplayControlsPanel } from './DisplayControlsPanel'
import { validateProblemSpace } from '@/app/create/worksheets/utils/validateProblemSpace'

interface ConfigPanelProps {
  formState: WorksheetFormState
  onChange: (updates: Partial<WorksheetFormState>) => void
  isDark?: boolean
}

export function ConfigPanel({ formState, onChange, isDark = false }: ConfigPanelProps) {
  const [warnings, setWarnings] = useState<string[]>([])

  // Validate problem space whenever relevant config changes
  useEffect(() => {
    const problemsPerPage = formState.problemsPerPage ?? 20
    const pages = formState.pages ?? 1
    const digitRange = formState.digitRange ?? { min: 2, max: 2 }
    const pAnyStart = formState.pAnyStart ?? 0
    const operator = formState.operator ?? 'addition'

    const validation = validateProblemSpace(problemsPerPage, pages, digitRange, pAnyStart, operator)

    console.log('[CONFIG PANEL] Problem space validation:', {
      problemsPerPage,
      pages,
      digitRange,
      pAnyStart,
      operator,
      estimatedSpace: validation.estimatedUniqueProblems,
      requested: validation.requestedProblems,
      risk: validation.duplicateRisk,
      warningCount: validation.warnings.length,
    })

    setWarnings(validation.warnings)
  }, [
    formState.problemsPerPage,
    formState.pages,
    formState.digitRange,
    formState.pAnyStart,
    formState.operator,
  ])

  // Handler for difficulty method switching (smart vs mastery)
  const handleMethodChange = (newMethod: 'custom' | 'mastery') => {
    const currentMethod = formState.mode === 'mastery' ? 'mastery' : 'custom'
    if (currentMethod === newMethod) {
      return // No change needed
    }

    // Preserve displayRules when switching
    const displayRules = formState.displayRules ?? defaultAdditionConfig.displayRules

    if (newMethod === 'custom') {
      onChange({
        mode: 'custom',
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
  const currentMethod = formState.mode === 'mastery' ? 'mastery' : 'custom'

  return (
    <WorksheetConfigProvider formState={formState} updateFormState={onChange}>
      <div data-component="config-panel" className={stack({ gap: '3' })}>
        {/* Problem Space Warnings */}
        {warnings.length > 0 && (
          <div
            data-element="problem-space-warning"
            className={css({
              bg: 'yellow.50',
              border: '1px solid',
              borderColor: 'yellow.200',
              rounded: 'md',
              p: '3',
              display: 'flex',
              flexDirection: 'column',
              gap: '2',
            })}
          >
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '2',
                fontWeight: 'semibold',
                fontSize: 'sm',
                color: 'yellow.800',
              })}
            >
              <span>⚠️</span>
              <span>Duplicate Problem Risk</span>
            </div>
            <div
              className={css({
                fontSize: 'xs',
                color: 'yellow.900',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.5',
              })}
            >
              {warnings.join('\n\n')}
            </div>
          </div>
        )}

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
        {currentMethod === 'custom' && (
          <CustomModeControls formState={formState} onChange={onChange} />
        )}

        {currentMethod === 'mastery' && (
          <MasteryModePanel formState={formState} onChange={onChange} isDark={isDark} />
        )}
      </div>
    </WorksheetConfigProvider>
  )
}
