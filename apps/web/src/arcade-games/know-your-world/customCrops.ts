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
    oceania: '775.56 437.22 233.73 161.35',
  },
}

/**
 * Get custom crop viewBox for a map/continent combination
 * Returns null if no custom crop is defined
 */
export function getCustomCrop(mapId: string, continentId: string): string | null {
  return customCrops[mapId]?.[continentId] ?? null
}
