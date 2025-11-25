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
    europe: '441.40 70.72 193.21 291.71'
  }
}

/**
 * Get custom crop viewBox for a map/continent combination
 * Returns null if no custom crop is defined
 */
export function getCustomCrop(mapId: string, continentId: string): string | null {
  return customCrops[mapId]?.[continentId] ?? null
}
