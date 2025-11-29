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
    africa: '472.47 346.18 95.84 227.49',
    oceania: '785.47 464.88 216.32 133.43',
    'south-america': '204.64 424.60 185.09 230.17',
    'north-america': '-17.45 150.31 444.57 299.97',
    europe: '399.21 102.01 198.44 266.44',
    asia: '537.52 271.25 368.29 239.28',
  }
}

/**
 * Runtime crop overrides (for dev mode live updates without page reload)
 * These take precedence over the static customCrops above
 */
const runtimeCropOverrides: CropOverrides = {}

/**
 * Custom event name for crop updates
 */
export const CROP_UPDATE_EVENT = 'dev-crop-update'

/**
 * Custom event name for crop mode state changes
 */
export const CROP_MODE_EVENT = 'dev-crop-mode'

/**
 * Event detail type for crop updates
 */
export interface CropUpdateEventDetail {
  mapId: string
  continentId: string
  viewBox: string | null // null means crop was reset/deleted
}

/**
 * Event detail type for crop mode state
 */
export interface CropModeEventDetail {
  active: boolean
}

/**
 * Dispatch crop mode state change event
 */
export function setCropModeActive(active: boolean): void {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent<CropModeEventDetail>(CROP_MODE_EVENT, {
      detail: { active },
    })
    window.dispatchEvent(event)
    console.log(`[customCrops] Crop mode ${active ? 'activated' : 'deactivated'}`)
  }
}

/**
 * Update a crop at runtime (dev mode only)
 * This immediately makes the new crop available via getCustomCrop()
 * and dispatches an event so components can react
 */
export function setRuntimeCrop(
  mapId: string,
  continentId: string,
  viewBox: string | null
): void {
  console.log(`[customCrops] setRuntimeCrop: ${mapId}/${continentId} = ${viewBox}`)

  if (viewBox === null) {
    // Delete the runtime override
    if (runtimeCropOverrides[mapId]) {
      delete runtimeCropOverrides[mapId][continentId]
      if (Object.keys(runtimeCropOverrides[mapId]).length === 0) {
        delete runtimeCropOverrides[mapId]
      }
    }
  } else {
    // Set the runtime override
    if (!runtimeCropOverrides[mapId]) {
      runtimeCropOverrides[mapId] = {}
    }
    runtimeCropOverrides[mapId][continentId] = viewBox
  }

  // Dispatch event for live updates
  if (typeof window !== 'undefined') {
    const event = new CustomEvent<CropUpdateEventDetail>(CROP_UPDATE_EVENT, {
      detail: { mapId, continentId, viewBox },
    })
    window.dispatchEvent(event)
    console.log(`[customCrops] Dispatched ${CROP_UPDATE_EVENT} event`)
  }
}

/**
 * Get custom crop viewBox for a map/continent combination
 * Returns null if no custom crop is defined
 * Checks runtime overrides first (for dev mode live updates), then static crops
 */
export function getCustomCrop(mapId: string, continentId: string): string | null {
  // Check runtime overrides first (for dev mode live updates)
  const runtimeCrop = runtimeCropOverrides[mapId]?.[continentId]
  if (runtimeCrop !== undefined) {
    console.log(`[customCrops] getCustomCrop: ${mapId}/${continentId} = ${runtimeCrop} (runtime override)`)
    return runtimeCrop
  }

  // Fall back to static crops
  const staticCrop = customCrops[mapId]?.[continentId] ?? null
  console.log(`[customCrops] getCustomCrop: ${mapId}/${continentId} = ${staticCrop} (static)`)
  return staticCrop
}
