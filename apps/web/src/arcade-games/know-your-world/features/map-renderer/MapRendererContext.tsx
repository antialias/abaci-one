/**
 * MapRendererContext
 *
 * Provides shared state and refs to all child components within MapRenderer,
 * eliminating prop drilling for commonly-used values.
 *
 * Values in this context:
 * - Refs: containerRef, svgRef
 * - Computed: parsedViewBox, isDark
 * - Layout: safeZoneMargins
 * - State: pointerLocked, cursorPosition
 */

'use client'

import { createContext, type ReactNode, type RefObject, useContext, useMemo } from 'react'
import type { SafeZoneMargins } from '../../maps'

// ============================================================================
// Types
// ============================================================================

export interface ParsedViewBox {
  x: number
  y: number
  width: number
  height: number
}

export interface MapRendererContextValue {
  // Refs
  containerRef: RefObject<HTMLDivElement | null>
  svgRef: RefObject<SVGSVGElement | null>

  // Computed values
  parsedViewBox: ParsedViewBox

  // Theme
  isDark: boolean

  // Layout
  safeZoneMargins: SafeZoneMargins

  // State
  pointerLocked: boolean
  cursorPosition: { x: number; y: number } | null
}

export interface MapRendererProviderProps {
  children: ReactNode
  value: MapRendererContextValue
}

// ============================================================================
// Context
// ============================================================================

const MapRendererContext = createContext<MapRendererContextValue | null>(null)

// ============================================================================
// Provider
// ============================================================================

/**
 * Provider component for MapRendererContext.
 *
 * Wrap child components that need access to shared MapRenderer state.
 */
export function MapRendererProvider({ children, value }: MapRendererProviderProps) {
  // Memoize the context value to prevent unnecessary re-renders
  const memoizedValue = useMemo(
    () => value,
    [
      value.containerRef,
      value.svgRef,
      value.parsedViewBox,
      value.isDark,
      value.safeZoneMargins,
      value.pointerLocked,
      value.cursorPosition,
    ]
  )

  return <MapRendererContext.Provider value={memoizedValue}>{children}</MapRendererContext.Provider>
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to access MapRendererContext.
 * Throws if used outside of MapRendererProvider.
 */
export function useMapRendererContext(): MapRendererContextValue {
  const context = useContext(MapRendererContext)
  if (!context) {
    throw new Error('useMapRendererContext must be used within a MapRendererProvider')
  }
  return context
}

/**
 * Hook to safely access MapRendererContext.
 * Returns null if used outside of MapRendererProvider.
 */
export function useMapRendererContextSafe(): MapRendererContextValue | null {
  return useContext(MapRendererContext)
}

// ============================================================================
// Selector Hooks (for performance optimization)
// ============================================================================

/**
 * Hook to access only the refs from context.
 * Use this when you only need containerRef/svgRef to avoid re-renders.
 */
export function useMapRendererRefs() {
  const context = useMapRendererContext()
  return useMemo(
    () => ({
      containerRef: context.containerRef,
      svgRef: context.svgRef,
    }),
    [context.containerRef, context.svgRef]
  )
}

/**
 * Hook to access only the parsedViewBox from context.
 */
export function useParsedViewBox() {
  const context = useMapRendererContext()
  return context.parsedViewBox
}

/**
 * Hook to access theme state.
 */
export function useMapRendererTheme() {
  const context = useMapRendererContext()
  return context.isDark
}

/**
 * Hook to access layout values.
 */
export function useMapRendererLayout() {
  const context = useMapRendererContext()
  return useMemo(
    () => ({
      safeZoneMargins: context.safeZoneMargins,
      parsedViewBox: context.parsedViewBox,
    }),
    [context.safeZoneMargins, context.parsedViewBox]
  )
}
