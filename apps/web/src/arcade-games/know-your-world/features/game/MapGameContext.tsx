/**
 * Map Game Context
 *
 * Provides game-specific state and utilities to child components,
 * avoiding deep prop drilling while maintaining type safety.
 *
 * This context consolidates game state that's needed by magnifier,
 * overlays, and other sub-components:
 * - Map data and regions
 * - Game progress (found regions, prompts)
 * - Celebration/give-up animations
 * - Hot/cold feedback state
 * - Debug settings
 * - Multiplayer state
 */

"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { MapData, MapRegion } from "../../types";
import type { BoundingBox } from "../../utils/adaptiveZoomSearch";
import type { CrosshairStyle } from "../magnifier/types";

// ============================================================================
// Types
// ============================================================================

export interface CelebrationState {
  regionId: string;
}

export interface GiveUpRevealState {
  regionId: string;
}

export interface MagnifierBorderStyle {
  border: string;
  glow: string;
  width: number;
}

// ============================================================================
// Context Value Type
// ============================================================================

export interface MapGameContextValue {
  // -------------------------------------------------------------------------
  // Map Data
  // -------------------------------------------------------------------------
  /** Full map data including regions and viewBox */
  mapData: MapData;
  /** Original viewBox string */
  displayViewBox: string;

  // -------------------------------------------------------------------------
  // Game Progress
  // -------------------------------------------------------------------------
  /** IDs of regions that have been found */
  regionsFound: string[];
  /** Currently hovered region ID */
  hoveredRegion: string | null;
  /** Set hovered region */
  setHoveredRegion: (regionId: string | null) => void;
  /** Current prompt (region to find) */
  currentPrompt: string | null;

  // -------------------------------------------------------------------------
  // Celebration & Give-up Animations
  // -------------------------------------------------------------------------
  /** Current celebration state */
  celebration: CelebrationState | null;
  /** Current give-up reveal state */
  giveUpReveal: GiveUpRevealState | null;
  /** Whether give-up animation is in progress */
  isGiveUpAnimating: boolean;
  /** Celebration flash progress (0-1) */
  celebrationFlashProgress: number;
  /** Give-up flash progress (0-1) */
  giveUpFlashProgress: number;

  // -------------------------------------------------------------------------
  // Hot/Cold Feedback
  // -------------------------------------------------------------------------
  /** Whether hot/cold feedback is enabled */
  effectiveHotColdEnabled: boolean;
  /** Current hot/cold feedback type */
  hotColdFeedbackType: string | null;
  /** Magnifier border style based on heat */
  magnifierBorderStyle: MagnifierBorderStyle;
  /** Crosshair style based on heat */
  crosshairHeatStyle: CrosshairStyle;

  // -------------------------------------------------------------------------
  // Debug
  // -------------------------------------------------------------------------
  /** Whether to show debug bounding boxes */
  effectiveShowDebugBoundingBoxes: boolean;
  /** Whether to show magnifier debug info */
  effectiveShowMagnifierDebugInfo: boolean;
  /** Debug bounding boxes for visualization */
  debugBoundingBoxes: BoundingBox[];

  // -------------------------------------------------------------------------
  // Multiplayer
  // -------------------------------------------------------------------------
  /** Game mode */
  gameMode?: "cooperative" | "race" | "turn-based";
  /** Current player (for turn-based) */
  currentPlayer?: string | null;
  /** Local player ID */
  localPlayerId?: string;

  // -------------------------------------------------------------------------
  // Callbacks
  // -------------------------------------------------------------------------
  /** Get player who found a region */
  getPlayerWhoFoundRegion: (regionId: string) => string | null;
  /** Whether to show outline for a region */
  showOutline: (region: MapRegion) => boolean;
  /** Handle region click with celebration */
  handleRegionClickWithCelebration: (
    regionId: string,
    regionName: string,
  ) => void;
  /** Select region at crosshairs (center of magnifier) */
  selectRegionAtCrosshairs: () => void;
  /** Request pointer lock for precision mode */
  requestPointerLock: () => void;
}

// ============================================================================
// Context Creation
// ============================================================================

const MapGameContext = createContext<MapGameContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

export interface MapGameProviderProps {
  children: ReactNode;
  value: MapGameContextValue;
}

/**
 * Provider for Map Game context.
 *
 * This provider should wrap components that need access to game state
 * without receiving it through props.
 *
 * @example
 * ```tsx
 * <MapGameProvider value={gameContextValue}>
 *   <MagnifierOverlay />
 *   <HotColdDebugPanel />
 * </MapGameProvider>
 * ```
 */
export function MapGameProvider({ children, value }: MapGameProviderProps) {
  // Memoize to prevent unnecessary re-renders
  const memoizedValue = useMemo(
    () => value,
    [
      // Map Data
      value.mapData,
      value.displayViewBox,
      // Game Progress
      value.regionsFound,
      value.hoveredRegion,
      value.setHoveredRegion,
      value.currentPrompt,
      // Animations
      value.celebration,
      value.giveUpReveal,
      value.isGiveUpAnimating,
      value.celebrationFlashProgress,
      value.giveUpFlashProgress,
      // Hot/Cold
      value.effectiveHotColdEnabled,
      value.hotColdFeedbackType,
      value.magnifierBorderStyle,
      value.crosshairHeatStyle,
      // Debug
      value.effectiveShowDebugBoundingBoxes,
      value.effectiveShowMagnifierDebugInfo,
      value.debugBoundingBoxes,
      // Multiplayer
      value.gameMode,
      value.currentPlayer,
      value.localPlayerId,
      // Callbacks
      value.getPlayerWhoFoundRegion,
      value.showOutline,
      value.handleRegionClickWithCelebration,
      value.selectRegionAtCrosshairs,
      value.requestPointerLock,
    ],
  );

  return (
    <MapGameContext.Provider value={memoizedValue}>
      {children}
    </MapGameContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Access Map Game context.
 *
 * @throws Error if used outside of MapGameProvider
 * @returns Map Game context value
 *
 * @example
 * ```tsx
 * function MagnifierRegions() {
 *   const { mapData, regionsFound, hoveredRegion } = useMapGameContext()
 *   // ...
 * }
 * ```
 */
export function useMapGameContext(): MapGameContextValue {
  const context = useContext(MapGameContext);

  if (!context) {
    throw new Error("useMapGameContext must be used within a MapGameProvider");
  }

  return context;
}

/**
 * Safely access Map Game context (returns null if not available).
 *
 * Useful for components that can optionally use the context.
 *
 * @returns Map Game context value or null
 */
export function useMapGameContextSafe(): MapGameContextValue | null {
  return useContext(MapGameContext);
}
