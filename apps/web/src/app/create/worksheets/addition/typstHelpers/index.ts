// Modular typstHelpers - Main entry point
// Re-exports all components for backward compatibility

// Shared components
export { generatePlaceValueColors, getPlaceValueColorNames } from './shared/colors'
export { generateTypstHelpers } from './shared/helpers'
export type { DisplayOptions, CellDimensions, TypstConstants } from './shared/types'
export { TYPST_CONSTANTS } from './shared/types'

// Subtraction components
export { generateBorrowBoxesRow } from './subtraction/borrowBoxes'
export { generateMinuendRow } from './subtraction/minuendRow'
export { generateSubtrahendRow } from './subtraction/subtrahendRow'
export {
  generateLineRow,
  generateTenFramesRow,
  generateAnswerBoxesRow,
} from './subtraction/answerRow'
export { generateSubtractionProblemStackFunction } from './subtraction/problemStack'

// Addition components (TODO: extract in future phase)
// export { generateCarryBoxesRow } from './addition/carryBoxes'
// export { generateAddendsRow } from './addition/addendRows'
// export { generateProblemStackFunction } from './addition/problemStack'
