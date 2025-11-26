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
    europe: '452.55 262.61 31.33 38.61',
  }
}

/**
 * Get custom crop viewBox for a map/continent combination
 * Returns null if no custom crop is defined
 */
export function getCustomCrop(mapId: string, continentId: string): string | null {
  return customCrops[mapId]?.[continentId] ?? null
}
