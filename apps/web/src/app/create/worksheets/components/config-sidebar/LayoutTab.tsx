'use client'

import { defaultAdditionConfig } from '@/app/create/worksheets/config-schemas'
import { useTheme } from '@/contexts/ThemeContext'
import type { DisplayRules } from '../../displayRules'
import { calculateDerivedState } from '../../utils/layoutCalculations'
import { OrientationPanel } from '../OrientationPanel'
import { useWorksheetConfig } from '../WorksheetConfigContext'

export function LayoutTab() {
  const { formState, onChange } = useWorksheetConfig()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Orientation change handler with automatic problemsPerPage/cols updates
  const handleOrientationChange = (
    orientation: 'portrait' | 'landscape',
    problemsPerPage: number,
    cols: number
  ) => {
    const pages = formState.pages || 1
    const { rows, total } = calculateDerivedState(problemsPerPage, pages, cols)
    onChange({
      orientation,
      problemsPerPage,
      cols,
      pages,
      rows,
      total,
    })
  }

  // Problems per page change handler with automatic cols update
  const handleProblemsPerPageChange = (problemsPerPage: number, cols: number) => {
    const pages = formState.pages || 1
    const { rows, total } = calculateDerivedState(problemsPerPage, pages, cols)
    onChange({
      problemsPerPage,
      cols,
      pages,
      rows,
      total,
    })
  }

  // Pages change handler with derived state calculation
  const handlePagesChange = (pages: number) => {
    const problemsPerPage = formState.problemsPerPage || 15
    const cols = formState.cols || 3
    const { rows, total } = calculateDerivedState(problemsPerPage, pages, cols)
    onChange({
      pages,
      rows,
      total,
    })
  }

  return (
    <OrientationPanel
      orientation={formState.orientation || 'portrait'}
      problemsPerPage={formState.problemsPerPage || 15}
      pages={formState.pages || 1}
      cols={formState.cols || 3}
      onOrientationChange={handleOrientationChange}
      onProblemsPerPageChange={handleProblemsPerPageChange}
      onPagesChange={handlePagesChange}
      isDark={isDark}
      // Pass config for problem space validation
      digitRange={formState.digitRange || { min: 2, max: 2 }}
      pAnyStart={formState.pAnyStart ?? 0}
      operator={formState.operator || 'addition'}
      mode={formState.mode || 'smart'}
      problemNumbers={
        ((formState.displayRules ?? defaultAdditionConfig.displayRules).problemNumbers as
          | 'always'
          | 'never') || 'always'
      }
      cellBorders={
        ((formState.displayRules ?? defaultAdditionConfig.displayRules).cellBorders as
          | 'always'
          | 'never') || 'always'
      }
      onProblemNumbersChange={(value) => {
        const displayRules: DisplayRules =
          formState.displayRules ?? defaultAdditionConfig.displayRules
        onChange({
          displayRules: {
            ...displayRules,
            problemNumbers: value,
          },
        })
      }}
      onCellBordersChange={(value) => {
        const displayRules: DisplayRules =
          formState.displayRules ?? defaultAdditionConfig.displayRules
        onChange({
          displayRules: {
            ...displayRules,
            cellBorders: value,
          },
        })
      }}
    />
  )
}
