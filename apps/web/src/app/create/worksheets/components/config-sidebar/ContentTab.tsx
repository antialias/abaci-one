'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { OperatorSection } from '../config-panel/OperatorSection'
import { useWorksheetConfig } from '../WorksheetConfigContext'

export function ContentTab() {
  const { formState, onChange } = useWorksheetConfig()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <div data-component="operator-tab">
      {/* Operator Selector - First class, no container */}
      <OperatorSection
        operator={formState.operator}
        onChange={(operator) => {
          // If switching to 'mixed' while in mastery mode without both skill IDs,
          // automatically switch to smart mode to prevent errors
          const mode = formState.mode ?? 'custom'
          if (
            operator === 'mixed' &&
            mode === 'mastery' &&
            (!formState.currentAdditionSkillId || !formState.currentSubtractionSkillId)
          ) {
            onChange({ operator, mode: 'custom' })
          } else {
            onChange({ operator })
          }
        }}
        isDark={isDark}
      />
    </div>
  )
}
