import type { WorksheetFormState } from '../types'

/**
 * Icons for different worksheet settings
 */
export const SETTING_ICONS = {
  operator: {
    addition: '➕',
    subtraction: '➖',
    multiplication: '✖️',
    division: '➗',
    mixed: '±',
  },
  difficulty: {
    smart: '🎯',
    manual: '🎚️',
    mastery: '⭐',
  },
  scaffolding: {
    tenFrames: '🎨',
    carryBoxes: '📦',
    placeValueColors: '🌈',
    answerBoxes: '✏️',
  },
  layout: {
    pages: '📄',
    columns: '📊',
    problems: '📝',
  },
  range: '🔢',
} as const

/**
 * Generate a human-readable summary of worksheet settings
 * for display on mobile settings button
 */
export function generateSettingsSummary(config: Partial<WorksheetFormState>): {
  lines: string[]
  icons: string[]
} {
  const lines: string[] = []
  const icons: string[] = []

  // Line 1: Operator and digit range
  if (config.operator) {
    const operatorIcon = SETTING_ICONS.operator[config.operator]
    const operatorName = config.operator.charAt(0).toUpperCase() + config.operator.slice(1)
    const digitRange = config.digitRange
      ? config.digitRange.min === config.digitRange.max
        ? `${config.digitRange.min}-digit`
        : `${config.digitRange.min}-${config.digitRange.max} digits`
      : ''
    lines.push(`${operatorIcon} ${operatorName}${digitRange ? ` • ${digitRange}` : ''}`)
    icons.push(operatorIcon)
  }

  // Line 2: Layout (problems per page, columns)
  if (config.problemsPerPage && config.cols) {
    const layoutLine = `📄 ${config.problemsPerPage} problems • ${config.cols} columns`
    lines.push(layoutLine)
    icons.push('📄')
  }

  // Line 3: Visual scaffolding (enabled features)
  const scaffolds: string[] = []
  if (config.displayRules) {
    if (config.displayRules.tenFrames === 'always') {
      scaffolds.push(`${SETTING_ICONS.scaffolding.tenFrames} Ten frames`)
      icons.push(SETTING_ICONS.scaffolding.tenFrames)
    }
    if (config.displayRules.carryBoxes === 'always') {
      scaffolds.push(`${SETTING_ICONS.scaffolding.carryBoxes} Carry boxes`)
      icons.push(SETTING_ICONS.scaffolding.carryBoxes)
    }
    if (config.displayRules.placeValueColors === 'always') {
      scaffolds.push(`${SETTING_ICONS.scaffolding.placeValueColors} Colors`)
      icons.push(SETTING_ICONS.scaffolding.placeValueColors)
    }
  }
  if (scaffolds.length > 0) {
    lines.push(scaffolds.join(' • '))
  }

  // Line 4: Difficulty mode
  if (config.mode) {
    const diffIcon = SETTING_ICONS.difficulty[config.mode as keyof typeof SETTING_ICONS.difficulty]
    const modeName =
      config.mode === 'smart'
        ? 'Smart difficulty'
        : config.mode === 'mastery'
          ? 'Mastery mode'
          : 'Manual mode'
    const pStart =
      config.mode === 'smart' && config.pAnyStart != null
        ? ` • ${Math.round(config.pAnyStart * 100)}% starts`
        : ''
    lines.push(`${diffIcon} ${modeName}${pStart}`)
    icons.push(diffIcon)
  }

  return { lines, icons }
}

/**
 * Generate a compact one-line summary for small spaces
 */
export function generateCompactSummary(config: Partial<WorksheetFormState>): string {
  const parts: string[] = []

  if (config.operator) {
    const icon = SETTING_ICONS.operator[config.operator]
    const name = config.operator.charAt(0).toUpperCase() + config.operator.slice(1)
    parts.push(`${icon} ${name}`)
  }

  if (config.digitRange) {
    const range =
      config.digitRange.min === config.digitRange.max
        ? `${config.digitRange.min}d`
        : `${config.digitRange.min}-${config.digitRange.max}d`
    parts.push(range)
  }

  if (config.problemsPerPage) {
    parts.push(`${config.problemsPerPage}p`)
  }

  return parts.join(' • ')
}
