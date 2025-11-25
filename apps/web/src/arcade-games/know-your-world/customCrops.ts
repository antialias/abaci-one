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
    'north-america': '-14.59 139.66 378.17 314.90',
  }
}

/**
 * Get custom crop viewBox for a map/continent combination
 * Returns null if no custom crop is defined
 */
export function getCustomCrop(mapId: string, continentId: string): string | null {
  return customCrops[mapId]?.[continentId] ?? null
}
