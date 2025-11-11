// Manual mode presets for direct display control

export interface ManualModePreset {
  name: string
  label: string
  description: string
  showCarryBoxes: boolean
  showAnswerBoxes: boolean
  showPlaceValueColors: boolean
  showTenFrames: boolean
  showProblemNumbers: boolean
  showCellBorder: boolean
  showTenFramesForAll: boolean
}

/**
 * Pre-defined manual mode presets for common use cases
 * Unlike smart mode presets, these are simple on/off toggles
 */
export const MANUAL_MODE_PRESETS = {
  fullScaffolding: {
    name: 'fullScaffolding',
    label: 'Full Scaffolding',
    description: 'All visual aids enabled for maximum support',
    showCarryBoxes: true,
    showAnswerBoxes: true,
    showPlaceValueColors: true,
    showTenFrames: false, // Off by default, can enable separately
    showProblemNumbers: true,
    showCellBorder: true,
    showTenFramesForAll: false,
  },

  minimalScaffolding: {
    name: 'minimalScaffolding',
    label: 'Minimal Scaffolding',
    description: 'Basic structure only - for students building independence',
    showCarryBoxes: false,
    showAnswerBoxes: false,
    showPlaceValueColors: false,
    showTenFrames: false,
    showProblemNumbers: true,
    showCellBorder: true,
    showTenFramesForAll: false,
  },

  assessmentMode: {
    name: 'assessmentMode',
    label: 'Assessment Mode',
    description: 'Clean layout for testing - minimal visual aids',
    showCarryBoxes: false,
    showAnswerBoxes: false,
    showPlaceValueColors: false,
    showTenFrames: false,
    showProblemNumbers: true,
    showCellBorder: false,
    showTenFramesForAll: false,
  },

  tenFramesFocus: {
    name: 'tenFramesFocus',
    label: 'Ten-Frames Focus',
    description: 'All aids plus ten-frames for concrete visualization',
    showCarryBoxes: true,
    showAnswerBoxes: true,
    showPlaceValueColors: true,
    showTenFrames: true,
    showProblemNumbers: true,
    showCellBorder: true,
    showTenFramesForAll: false,
  },
} as const satisfies Record<string, ManualModePreset>

export type ManualModePresetName = keyof typeof MANUAL_MODE_PRESETS

/**
 * Check if manual display settings match a preset
 */
export function getManualPresetFromConfig(config: {
  showCarryBoxes: boolean
  showAnswerBoxes: boolean
  showPlaceValueColors: boolean
  showTenFrames: boolean
  showProblemNumbers: boolean
  showCellBorder: boolean
  showTenFramesForAll: boolean
}): ManualModePresetName | 'custom' {
  for (const [name, preset] of Object.entries(MANUAL_MODE_PRESETS)) {
    if (
      preset.showCarryBoxes === config.showCarryBoxes &&
      preset.showAnswerBoxes === config.showAnswerBoxes &&
      preset.showPlaceValueColors === config.showPlaceValueColors &&
      preset.showTenFrames === config.showTenFrames &&
      preset.showProblemNumbers === config.showProblemNumbers &&
      preset.showCellBorder === config.showCellBorder &&
      preset.showTenFramesForAll === config.showTenFramesForAll
    ) {
      return name as ManualModePresetName
    }
  }
  return 'custom'
}
