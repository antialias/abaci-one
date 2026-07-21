/**
 * The abacus identity triple — the shared vocabulary between the
 * player_abacus_identity table, its API route, and the studio UI.
 *
 * Deliberately framework- and drizzle-free so client components can import
 * the constants without dragging the DB schema into the bundle.
 */

export const ABACUS_COLOR_SCHEMES = [
  'monochrome',
  'place-value',
  'heaven-earth',
  'alternating',
] as const

export const ABACUS_COLOR_PALETTES = [
  'default',
  'colorblind',
  'mnemonic',
  'grayscale',
  'nature',
] as const

export type AbacusColorScheme = (typeof ABACUS_COLOR_SCHEMES)[number]
export type AbacusColorPalette = (typeof ABACUS_COLOR_PALETTES)[number]

/** The player-bound "my abacus": style (scheme + palette) and form (columns) */
export interface AbacusIdentity {
  colorScheme: AbacusColorScheme
  colorPalette: AbacusColorPalette
  columns: number
}

/** What a player without a saved row shows: the stock abacus */
export const DEFAULT_ABACUS_IDENTITY: AbacusIdentity = {
  colorScheme: 'place-value',
  colorPalette: 'default',
  columns: 4,
}

/** Runtime guard for API input and loose string fields (returns null on any mismatch) */
export function parseAbacusIdentity(input: unknown): AbacusIdentity | null {
  if (typeof input !== 'object' || input === null) return null
  const { colorScheme, colorPalette, columns } = input as Record<string, unknown>
  const scheme = ABACUS_COLOR_SCHEMES.find((s) => s === colorScheme)
  const palette = ABACUS_COLOR_PALETTES.find((p) => p === colorPalette)
  if (!scheme || !palette) return null
  if (typeof columns !== 'number' || !Number.isInteger(columns) || columns < 1 || columns > 21) {
    return null
  }
  return { colorScheme: scheme, colorPalette: palette, columns }
}
