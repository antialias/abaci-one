/**
 * Custom viewBox overrides for map/continent combinations
 *
 * This file is automatically updated by the DevCropTool (Ctrl+Shift+B in dev mode)
 *
 * Format: { [mapId]: { [continentId]: viewBox } }
 */

export interface CropOverrides {
  [mapId: string]: {
    [continentId: string]: string
  }
}

export const customCrops: CropOverrides = {
  world: {
    europe: '399.10 106.44 200.47 263.75',
    africa: '472.47 346.18 95.84 227.49',
    oceania: '785.47 464.88 216.32 133.43',
    asia: '614.40 274.09 199.15 221.23',
    'south-america': '245.77 421.34 65.74 234.48',
    'north-america': '125.87 157.73 150.14 292.92',
  },
}

/**
 * Get custom crop viewBox for a map/continent combination
 * Returns null if no custom crop is defined
 */
export function getCustomCrop(mapId: string, continentId: string): string | null {
  return customCrops[mapId]?.[continentId] ?? null
}
