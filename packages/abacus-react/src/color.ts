// Canonical bead-color resolver — the single source of truth for what color a
// soroban bead is, shared by the on-screen abacus (AbacusReact) and the 3D-print
// studio's "my abacus" style projection (apps/web abacus-model / abacus-design).
//
// This module is deliberately React-free and dependency-free so the framework-free
// print path can import it via the `@soroban/abacus-react/color` subpath without
// pulling in the React-laden barrel. It captures a bead's INTRINSIC color for a
// given (placeValue, type) under a scheme+palette — i.e. the color a bead has when
// active, ignoring transient display state (highlight / inactive), which stays in
// AbacusReact's getBeadColor wrapper.

// The five named palettes. `place-value` schemes index these by place value.
export const BEAD_COLOR_PALETTES: Record<string, string[]> = {
  default: ['#2E86AB', '#A23B72', '#F18F01', '#6A994E', '#BC4B51'],
  colorblind: ['#0173B2', '#DE8F05', '#CC78BC', '#029E73', '#D55E00'],
  mnemonic: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'],
  grayscale: ['#000000', '#404040', '#808080', '#b0b0b0', '#d0d0d0'],
  nature: ['#4E79A7', '#F28E2C', '#E15759', '#76B7B2', '#59A14F'],
}

// A bead's intrinsic (active) color. `placeValue` is a plain number (0 = ones
// place) rather than a bounded type so wide physical abacuses (up to 21 columns,
// place value 0..20) resolve — index math wraps via `% length` / `% 2`.
export function beadColorActive(
  bead: { placeValue: number; type: 'heaven' | 'earth' },
  colorScheme: string,
  colorPalette: string,
): string {
  switch (colorScheme) {
    case 'place-value': {
      const colors = BEAD_COLOR_PALETTES[colorPalette] ?? BEAD_COLOR_PALETTES.default
      return colors[bead.placeValue % colors.length]
    }
    case 'alternating':
      return bead.placeValue % 2 === 0 ? '#1E88E5' : '#43A047'
    case 'heaven-earth':
      return bead.type === 'heaven' ? '#F18F01' : '#2E86AB' // exact Typst colors
    default:
      return '#000000'
  }
}
