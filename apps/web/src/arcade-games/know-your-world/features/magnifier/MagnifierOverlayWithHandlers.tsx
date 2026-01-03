/**
 * Magnifier Overlay With Handlers
 *
 * A thin wrapper component that:
 * 1. Calls useMagnifierTouchHandlers hook (which consumes from context)
 * 2. Passes the handlers to MagnifierOverlay
 *
 * This component MUST be rendered inside MagnifierProvider and MapGameProvider
 * because it calls hooks that consume from those contexts.
 */

"use client";

import type { SpringValue } from "@react-spring/web";

import { MagnifierOverlay } from "./MagnifierOverlay";
import {
  type UseMagnifierTouchHandlersOptions,
  useMagnifierTouchHandlers,
} from "./useMagnifierTouchHandlers";

// ============================================================================
// Types
// ============================================================================

export interface MagnifierOverlayWithHandlersProps {
  /** Crosshair rotation angle spring */
  rotationAngle: SpringValue<number>;
  /** Options for touch handlers hook (the options that aren't from context) */
  touchHandlerOptions: UseMagnifierTouchHandlersOptions;
}

// ============================================================================
// Component
// ============================================================================

export function MagnifierOverlayWithHandlers({
  rotationAngle,
  touchHandlerOptions,
}: MagnifierOverlayWithHandlersProps) {
  // This hook consumes from MagnifierContext and MapGameContext
  const {
    handleMagnifierTouchStart,
    handleMagnifierTouchMove,
    handleMagnifierTouchEnd,
  } = useMagnifierTouchHandlers(touchHandlerOptions);

  return (
    <MagnifierOverlay
      rotationAngle={rotationAngle}
      handleMagnifierTouchStart={handleMagnifierTouchStart}
      handleMagnifierTouchMove={handleMagnifierTouchMove}
      handleMagnifierTouchEnd={handleMagnifierTouchEnd}
    />
  );
}
