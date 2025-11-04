/**
 * Server Component compatible exports
 * This entry point only exports components that work without "use client"
 */

export { AbacusStatic } from './AbacusStatic'
export type { AbacusStaticConfig } from './AbacusStatic'
export { AbacusStaticBead } from './AbacusStaticBead'
export type { StaticBeadProps } from './AbacusStaticBead'

// Re-export shared utilities that are safe for server components
export { numberToAbacusState, calculateAbacusDimensions } from './AbacusUtils'
export type {
  AbacusCustomStyles,
  BeadConfig,
  PlaceState,
  ValidPlaceValues,
} from './AbacusReact'
