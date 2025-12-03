/**
 * MapRenderer Context
 *
 * Provides shared state and utilities to extracted feature components,
 * avoiding deep prop drilling while maintaining type safety.
 *
 * This context is designed to be lightweight - it provides read-only
 * access to commonly needed values. Actions are passed as props to
 * components that need them, keeping the data flow explicit.
 */

'use client'

import { createContext, useContext, useMemo, type ReactNode, type RefObject } from 'react'

import type { CursorPosition, Dimensions, GameStateSlice } from './types'

// ============================================================================
// Context Value Type
// ============================================================================

export interface MapRendererContextValue {
  // -------------------------------------------------------------------------
  // Refs
  // -------------------------------------------------------------------------
  /** Container element ref */
  containerRef: RefObject<HTMLDivElement>
  /** SVG element ref */
  svgRef: RefObject<SVGSVGElement>

  // -------------------------------------------------------------------------
  // Viewport
  // -------------------------------------------------------------------------
  /** SVG viewBox string (e.g., "0 0 1000 500") */
  viewBox: string
  /** Container dimensions in pixels */
  containerDimensions: Dimensions | null

  // -------------------------------------------------------------------------
  // Cursor State
  // -------------------------------------------------------------------------
  /** Current cursor position in container coordinates */
  cursorPosition: CursorPosition | null
  /** Persistent cursor position ref (for reading in callbacks) */
  cursorPositionRef: RefObject<CursorPosition | null>

  // -------------------------------------------------------------------------
  // Theme
  // -------------------------------------------------------------------------
  /** Whether dark mode is active */
  isDark: boolean

  // -------------------------------------------------------------------------
  // Game State (Read-Only Slice)
  // -------------------------------------------------------------------------
  /** Minimal game state needed by visual features */
  gameState: GameStateSlice
}

// ============================================================================
// Context Creation
// ============================================================================

const MapRendererContext = createContext<MapRendererContextValue | null>(null)

// ============================================================================
// Provider Component
// ============================================================================

export interface MapRendererProviderProps {
  children: ReactNode
  value: MapRendererContextValue
}

/**
 * Provider for MapRenderer context.
 *
 * This provider should wrap components that need access to shared
 * MapRenderer state. It's designed to be placed inside MapRenderer
 * to provide state to extracted child components.
 *
 * @example
 * ```tsx
 * <MapRendererProvider value={contextValue}>
 *   <MagnifierOverlay />
 *   <LabelLayer />
 * </MapRendererProvider>
 * ```
 */
export function MapRendererProvider({ children, value }: MapRendererProviderProps) {
  // Memoize the value to prevent unnecessary re-renders
  const memoizedValue = useMemo(
    () => value,
    [
      value.containerRef,
      value.svgRef,
      value.viewBox,
      value.containerDimensions,
      value.cursorPosition,
      value.cursorPositionRef,
      value.isDark,
      value.gameState,
    ]
  )

  return (
    <MapRendererContext.Provider value={memoizedValue}>{children}</MapRendererContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Access MapRenderer context.
 *
 * @throws Error if used outside of MapRendererProvider
 * @returns MapRenderer context value
 *
 * @example
 * ```tsx
 * function MagnifierOverlay() {
 *   const { cursorPosition, isDark, gameState } = useMapRendererContext()
 *   // ...
 * }
 * ```
 */
export function useMapRendererContext(): MapRendererContextValue {
  const context = useContext(MapRendererContext)

  if (!context) {
    throw new Error('useMapRendererContext must be used within a MapRendererProvider')
  }

  return context
}

/**
 * Safely access MapRenderer context (returns null if not available).
 *
 * Useful for components that can optionally use the context.
 *
 * @returns MapRenderer context value or null
 */
export function useMapRendererContextSafe(): MapRendererContextValue | null {
  return useContext(MapRendererContext)
}
