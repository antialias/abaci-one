/**
 * Magnifier Context
 *
 * Provides magnifier state and utilities to child components,
 * avoiding deep prop drilling while maintaining type safety.
 *
 * This context consolidates:
 * - Magnifier visibility and expansion state
 * - Zoom state and animation
 * - Touch interaction state
 * - Viewport calculations
 */

'use client'

import { createContext, useContext, useMemo, type ReactNode, type RefObject } from 'react'

import type { UseMagnifierStateReturn } from './useMagnifierState'
import type { UseMagnifierZoomReturn } from '../../hooks/useMagnifierZoom'

// ============================================================================
// Context Value Type
// ============================================================================

export interface MagnifierContextValue {
  // -------------------------------------------------------------------------
  // State (from useMagnifierState)
  // -------------------------------------------------------------------------
  /** Magnifier state including visibility, expansion, and touch state */
  state: UseMagnifierStateReturn

  // -------------------------------------------------------------------------
  // Zoom (from useMagnifierZoom)
  // -------------------------------------------------------------------------
  /** Zoom state and controls */
  zoom: UseMagnifierZoomReturn

  // -------------------------------------------------------------------------
  // Refs
  // -------------------------------------------------------------------------
  /** Container element ref */
  containerRef: RefObject<HTMLDivElement>
  /** SVG element ref */
  svgRef: RefObject<SVGSVGElement>
  /** Magnifier element ref */
  magnifierRef: RefObject<HTMLDivElement>

  // -------------------------------------------------------------------------
  // Viewport
  // -------------------------------------------------------------------------
  /** Current cursor position in container coordinates */
  cursorPosition: { x: number; y: number } | null
  /** SVG viewBox string */
  viewBox: string

  // -------------------------------------------------------------------------
  // Theme
  // -------------------------------------------------------------------------
  /** Whether dark mode is active */
  isDark: boolean

  // -------------------------------------------------------------------------
  // Device Capabilities
  // -------------------------------------------------------------------------
  /** Whether device is touch-based */
  isTouchDevice: boolean
  /** Whether device supports precision mode (pointer lock) */
  canUsePrecisionMode: boolean
}

// ============================================================================
// Context Creation
// ============================================================================

const MagnifierContext = createContext<MagnifierContextValue | null>(null)

// ============================================================================
// Provider Component
// ============================================================================

export interface MagnifierProviderProps {
  children: ReactNode
  value: MagnifierContextValue
}

/**
 * Provider for Magnifier context.
 *
 * This provider should wrap the magnifier overlay and related components
 * to provide shared state without prop drilling.
 *
 * @example
 * ```tsx
 * <MagnifierProvider value={magnifierContextValue}>
 *   <MagnifierOverlay />
 * </MagnifierProvider>
 * ```
 */
export function MagnifierProvider({ children, value }: MagnifierProviderProps) {
  // Memoize the value to prevent unnecessary re-renders
  const memoizedValue = useMemo(
    () => value,
    [
      value.state,
      value.zoom,
      value.containerRef,
      value.svgRef,
      value.magnifierRef,
      value.cursorPosition,
      value.viewBox,
      value.isDark,
      value.isTouchDevice,
      value.canUsePrecisionMode,
    ]
  )

  return <MagnifierContext.Provider value={memoizedValue}>{children}</MagnifierContext.Provider>
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Access Magnifier context.
 *
 * @throws Error if used outside of MagnifierProvider
 * @returns Magnifier context value
 *
 * @example
 * ```tsx
 * function MagnifierControls() {
 *   const { state, zoom, isDark } = useMagnifierContext()
 *   // ...
 * }
 * ```
 */
export function useMagnifierContext(): MagnifierContextValue {
  const context = useContext(MagnifierContext)

  if (!context) {
    throw new Error('useMagnifierContext must be used within a MagnifierProvider')
  }

  return context
}

/**
 * Safely access Magnifier context (returns null if not available).
 *
 * Useful for components that can optionally use the context.
 *
 * @returns Magnifier context value or null
 */
export function useMagnifierContextSafe(): MagnifierContextValue | null {
  return useContext(MagnifierContext)
}
