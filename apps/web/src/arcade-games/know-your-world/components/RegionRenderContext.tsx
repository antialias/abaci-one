/**
 * Region Render Context
 *
 * Provides global rendering state to RegionPath components.
 * This avoids passing the same props to every region instance.
 *
 * Only values that are the SAME for all regions go here.
 * Per-region state (isHovered, isCelebrating, etc.) should still be props.
 */

"use client";

import { createContext, type ReactNode, useContext } from "react";

// ============================================================================
// Types
// ============================================================================

export interface RegionRenderState {
  // -------------------------------------------------------------------------
  // Theme
  // -------------------------------------------------------------------------
  /** Whether dark mode is active */
  isDark: boolean;

  // -------------------------------------------------------------------------
  // Device Capabilities
  // -------------------------------------------------------------------------
  /** Whether pointer lock is active (disables native hover) */
  pointerLocked: boolean;
  /** Whether device has fine pointer (hides native cursor) */
  hasAnyFinePointer: boolean;

  // -------------------------------------------------------------------------
  // Animation Progress (0-1)
  // -------------------------------------------------------------------------
  /** Give-up reveal flash progress */
  giveUpFlashProgress: number;
  /** Hint animation flash progress */
  hintFlashProgress: number;
  /** Celebration flash progress */
  celebrationFlashProgress: number;
  /** Whether give-up animation is currently running (dims other regions) */
  isGiveUpAnimating: boolean;
  /** Whether celebration is in progress (disables clicks) */
  celebrationActive: boolean;
}

// ============================================================================
// Context
// ============================================================================

const RegionRenderContext = createContext<RegionRenderState | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface RegionRenderProviderProps extends RegionRenderState {
  children: ReactNode;
}

/**
 * Provider for global region rendering state.
 *
 * Wrap your region list with this provider to avoid passing
 * the same props to every RegionPath component.
 *
 * @example
 * ```tsx
 * <RegionRenderProvider
 *   isDark={isDark}
 *   pointerLocked={pointerLocked}
 *   hasAnyFinePointer={hasAnyFinePointer}
 *   giveUpFlashProgress={giveUpFlashProgress}
 *   hintFlashProgress={hintFlashProgress}
 *   celebrationFlashProgress={celebrationFlashProgress}
 *   isGiveUpAnimating={isGiveUpAnimating}
 *   celebrationActive={!!celebration}
 * >
 *   {regions.map(region => <RegionPath key={region.id} ... />)}
 * </RegionRenderProvider>
 * ```
 */
export function RegionRenderProvider({
  children,
  isDark,
  pointerLocked,
  hasAnyFinePointer,
  giveUpFlashProgress,
  hintFlashProgress,
  celebrationFlashProgress,
  isGiveUpAnimating,
  celebrationActive,
}: RegionRenderProviderProps) {
  const value: RegionRenderState = {
    isDark,
    pointerLocked,
    hasAnyFinePointer,
    giveUpFlashProgress,
    hintFlashProgress,
    celebrationFlashProgress,
    isGiveUpAnimating,
    celebrationActive,
  };

  return (
    <RegionRenderContext.Provider value={value}>
      {children}
    </RegionRenderContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Access global region rendering state.
 *
 * Must be used within a RegionRenderProvider.
 *
 * @throws Error if used outside of provider
 */
export function useRegionRenderState(): RegionRenderState {
  const context = useContext(RegionRenderContext);
  if (!context) {
    throw new Error(
      "useRegionRenderState must be used within a RegionRenderProvider",
    );
  }
  return context;
}
