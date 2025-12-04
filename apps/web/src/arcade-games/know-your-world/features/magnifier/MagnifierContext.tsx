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
 * - Cursor position and viewport calculations
 * - Interaction state machine
 * - Springs and animations
 */

'use client'

import { createContext, useContext, useMemo, type ReactNode, type RefObject } from 'react'
import type { SpringValue } from '@react-spring/web'

import type { UseInteractionStateMachineReturn } from '../interaction'

// ============================================================================
// Types
// ============================================================================

export interface MagnifierSpring {
  top: SpringValue<number>
  left: SpringValue<number>
  opacity: SpringValue<number>
  movementMultiplier: SpringValue<number>
}

export interface ParsedViewBox {
  x: number
  y: number
  width: number
  height: number
}

export interface SafeZoneMargins {
  top: number
  right: number
  bottom: number
  left: number
}

export interface PrecisionCalculations {
  isAtThreshold: boolean
  screenPixelRatio: number
}

// ============================================================================
// Context Value Type
// ============================================================================

export interface MagnifierContextValue {
  // -------------------------------------------------------------------------
  // Refs
  // -------------------------------------------------------------------------
  /** Container element ref */
  containerRef: RefObject<HTMLDivElement>
  /** SVG element ref */
  svgRef: RefObject<SVGSVGElement>
  /** Magnifier element ref */
  magnifierRef: RefObject<HTMLDivElement>
  /** Cursor position ref (mutable) */
  cursorPositionRef: React.MutableRefObject<{ x: number; y: number } | null>

  // -------------------------------------------------------------------------
  // Position & Animation
  // -------------------------------------------------------------------------
  /** Current cursor position in container coordinates (from state machine) */
  cursorPosition: { x: number; y: number } | null
  // Note: setCursorPosition removed - dispatch to interaction state machine instead
  /** Zoom spring value */
  zoomSpring: SpringValue<number>
  /** Magnifier position/opacity springs */
  magnifierSpring: MagnifierSpring
  /** Parsed viewBox dimensions */
  parsedViewBox: ParsedViewBox
  /** Safe zone margins for UI elements */
  safeZoneMargins: SafeZoneMargins

  // -------------------------------------------------------------------------
  // Magnifier State
  // -------------------------------------------------------------------------
  /** Whether magnifier is visible */
  showMagnifier: boolean
  /** Set magnifier visibility */
  setShowMagnifier: (show: boolean) => void
  /** Whether magnifier is expanded (full size) */
  isMagnifierExpanded: boolean
  /** Set magnifier expansion */
  setIsMagnifierExpanded: (expanded: boolean) => void
  /** Target opacity for magnifier */
  targetOpacity: number
  /** Set target opacity */
  setTargetOpacity: (opacity: number) => void
  /** Target zoom level */
  targetZoom: number
  /** Set target zoom */
  setTargetZoom: (zoom: number) => void

  // -------------------------------------------------------------------------
  // Interaction State Machine
  // -------------------------------------------------------------------------
  /** Full interaction state machine return */
  interaction: UseInteractionStateMachineReturn

  // -------------------------------------------------------------------------
  // Derived Interaction State (convenience)
  // -------------------------------------------------------------------------
  /** Whether mobile map dragging triggered the magnifier */
  mobileMapDragTriggeredMagnifier: boolean
  /** Whether mobile map is being dragged */
  isMobileMapDragging: boolean
  /** Whether magnifier is being dragged */
  isMagnifierDragging: boolean
  /** Whether pointer is locked (precision mode) */
  pointerLocked: boolean

  // -------------------------------------------------------------------------
  // Device & Theme
  // -------------------------------------------------------------------------
  /** Whether dark mode is active */
  isDark: boolean
  /** Whether device is touch-based */
  isTouchDevice: boolean
  /** Whether device supports precision mode (pointer lock) */
  canUsePrecisionMode: boolean

  // -------------------------------------------------------------------------
  // Precision Mode
  // -------------------------------------------------------------------------
  /** Precision mode threshold */
  precisionModeThreshold: number
  /** Precision calculations */
  precisionCalcs: PrecisionCalculations

  // -------------------------------------------------------------------------
  // Zoom Controls
  // -------------------------------------------------------------------------
  /** Get current zoom level (from spring) */
  getCurrentZoom: () => number
  /** High zoom threshold for styling changes */
  highZoomThreshold: number
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
 *   <ZoomLinesOverlay />
 * </MagnifierProvider>
 * ```
 */
export function MagnifierProvider({ children, value }: MagnifierProviderProps) {
  // Memoize the value to prevent unnecessary re-renders
  // Only re-create when key values change
  const memoizedValue = useMemo(
    () => value,
    [
      // Refs (stable)
      value.containerRef,
      value.svgRef,
      value.magnifierRef,
      value.cursorPositionRef,
      // Position & Animation
      value.cursorPosition,
      value.zoomSpring,
      value.magnifierSpring,
      value.parsedViewBox,
      value.safeZoneMargins,
      // Magnifier State
      value.showMagnifier,
      value.setShowMagnifier,
      value.isMagnifierExpanded,
      value.setIsMagnifierExpanded,
      value.targetOpacity,
      value.setTargetOpacity,
      value.targetZoom,
      value.setTargetZoom,
      // Interaction State Machine
      value.interaction,
      // Derived State
      value.mobileMapDragTriggeredMagnifier,
      value.isMobileMapDragging,
      value.isMagnifierDragging,
      value.pointerLocked,
      // Device & Theme
      value.isDark,
      value.isTouchDevice,
      value.canUsePrecisionMode,
      // Precision Mode
      value.precisionModeThreshold,
      value.precisionCalcs,
      // Zoom
      value.getCurrentZoom,
      value.highZoomThreshold,
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
 *   const { showMagnifier, isMagnifierExpanded, isDark } = useMagnifierContext()
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
