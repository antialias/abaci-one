// Place value color definitions for Typst
// Light pastels - unique color per place value

/**
 * Generate Typst color variable definitions
 * These are used throughout the worksheet for place value visualization
 */
export function generatePlaceValueColors(): string {
  return `// Place value colors (light pastels) - unique color per place value
#let color-ones = rgb(227, 242, 253)      // Light blue (ones)
#let color-tens = rgb(232, 245, 233)      // Light green (tens)
#let color-hundreds = rgb(255, 249, 196)  // Light yellow (hundreds)
#let color-thousands = rgb(255, 228, 225) // Light pink/rose (thousands)
#let color-ten-thousands = rgb(243, 229, 245) // Light purple/lavender (ten-thousands)
#let color-hundred-thousands = rgb(255, 239, 213) // Light peach/orange (hundred-thousands)
#let color-none = white                   // No color
`
}

/**
 * Get ordered array of place value color names for use in Typst arrays
 */
export function getPlaceValueColorNames(): string[] {
  return [
    'color-ones',
    'color-tens',
    'color-hundreds',
    'color-thousands',
    'color-ten-thousands',
    'color-hundred-thousands',
  ]
}
