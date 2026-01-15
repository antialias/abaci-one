/**
 * Configuration for NumericKeypad (react-simple-keyboard)
 * Separated to avoid Panda CSS parser warnings for special key patterns
 */

// Special key identifiers for react-simple-keyboard
export const BKSP_KEY = '{bksp}'
export const ENTER_KEY = '{enter}'

/**
 * Portrait layout: single row at bottom
 */
export function getPortraitLayout(showSubmitButton: boolean) {
  return {
    default: showSubmitButton
      ? [`1 2 3 4 5 6 7 8 9 0 ${BKSP_KEY} ${ENTER_KEY}`]
      : [`1 2 3 4 5 6 7 8 9 0 ${BKSP_KEY}`],
  }
}

/**
 * Landscape layout: two columns on right
 */
export function getLandscapeLayout(showSubmitButton: boolean) {
  return {
    default: showSubmitButton
      ? ['1 6', '2 7', '3 8', '4 9', '5 0', `${BKSP_KEY} ${ENTER_KEY}`]
      : ['1 6', '2 7', '3 8', '4 9', '5 0', BKSP_KEY],
  }
}

/**
 * Display mapping for special keys
 */
export const keypadDisplay = {
  [BKSP_KEY]: '⌫',
  [ENTER_KEY]: '✓',
}
