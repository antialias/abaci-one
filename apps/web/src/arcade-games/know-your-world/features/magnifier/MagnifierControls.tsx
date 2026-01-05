/**
 * Magnifier Controls Component
 *
 * Mobile control buttons for the magnifier overlay:
 * - Select button: Selects the region under the crosshairs
 * - Close button: Dismisses the magnifier entirely
 * - Expand/Collapse button: Toggles between normal and expanded size
 */

"use client";

import { animated, useSpring } from "@react-spring/web";
import {
  memo,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";

// ============================================================================
// Types
// ============================================================================

export interface MagnifierControlsProps {
  /** Whether device is touch-based */
  isTouchDevice: boolean;
  /** Whether magnifier was triggered by mobile drag (shows Select button) */
  showSelectButton: boolean;
  /** Whether magnifier is expanded to fill space */
  isExpanded: boolean;
  /** Whether Select button should be disabled (no region or already found) */
  isSelectDisabled: boolean;
  /** Whether dark mode is active */
  isDark: boolean;
  /** Whether pointer is locked (hides expand button when true) */
  pointerLocked?: boolean;
  /** Whether to hide all controls except zoom label (during panning) */
  hideControls?: boolean;
  /** Called when Select button is pressed */
  onSelect: () => void;
  /** Called when exiting expanded mode back to regular magnifier size */
  onExitExpanded: () => void;
  /** Called when Expand button is pressed */
  onExpand: () => void;
  /** Called when Close button is pressed (dismiss magnifier entirely) */
  onClose: () => void;
}

// ============================================================================
// Sub-components
// ============================================================================

interface ControlButtonProps {
  position: "top-right" | "bottom-right" | "bottom-left";
  disabled?: boolean;
  visible?: boolean;
  style?: "select" | "secondary" | "icon";
  onClick: () => void;
  children: React.ReactNode;
}

/**
 * Base button component for magnifier controls with animated opacity
 */
function ControlButton({
  position,
  disabled = false,
  visible = true,
  style = "secondary",
  onClick,
  children,
}: ControlButtonProps) {
  const handleTouchStart = (e: ReactTouchEvent) => {
    e.stopPropagation();
  };

  const handleTouchEnd = (e: ReactTouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!disabled && visible) onClick();
  };

  const handleClick = (e: ReactMouseEvent) => {
    e.stopPropagation();
    if (!disabled && visible) onClick();
  };

  // Animate opacity based on visibility
  const springProps = useSpring({
    opacity: visible ? (disabled ? 0.7 : 1) : 0,
    config: { tension: 300, friction: 20 },
  });

  // Position styles
  const positionStyles: Record<string, React.CSSProperties> = {
    "top-right": { top: "8px", right: "8px" },
    "bottom-right": { bottom: 0, right: 0 },
    "bottom-left": { bottom: 0, left: 0 },
  };

  // Border radius based on position
  const borderRadiusStyles: Record<string, React.CSSProperties> = {
    "top-right": { borderRadius: "6px" },
    "bottom-right": {
      borderTopLeftRadius: "12px",
      borderBottomRightRadius: "10px",
    },
    "bottom-left": {
      borderTopRightRadius: "12px",
      borderBottomLeftRadius: "10px",
    },
  };

  // Style-specific colors and backgrounds
  const styleVariants = {
    select: {
      enabled: {
        background: "linear-gradient(135deg, #22c55e, #16a34a)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)",
      },
      disabled: {
        background: "linear-gradient(135deg, #9ca3af, #6b7280)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
      },
    },
    secondary: {
      enabled: {
        background: "linear-gradient(135deg, #6b7280, #4b5563)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
      },
      disabled: {
        background: "linear-gradient(135deg, #9ca3af, #6b7280)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
      },
    },
    icon: {
      enabled: {
        background: "rgba(31, 41, 55, 0.9)",
        boxShadow: "none",
      },
      disabled: {
        background: "rgba(31, 41, 55, 0.9)",
        boxShadow: "none",
      },
    },
  };

  const variantStyle = disabled
    ? styleVariants[style].disabled
    : styleVariants[style].enabled;

  return (
    <animated.button
      type="button"
      disabled={disabled || !visible}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      style={{
        position: "absolute",
        ...positionStyles[position],
        ...borderRadiusStyles[position],
        padding: style === "icon" ? 0 : "10px 20px",
        width: style === "icon" ? "28px" : undefined,
        height: style === "icon" ? "28px" : undefined,
        display: style === "icon" ? "flex" : undefined,
        alignItems: style === "icon" ? "center" : undefined,
        justifyContent: style === "icon" ? "center" : undefined,
        ...variantStyle,
        border: "none",
        color: "white",
        fontSize: "14px",
        fontWeight: "bold",
        cursor: disabled || !visible ? "not-allowed" : "pointer",
        touchAction: "none",
        pointerEvents: visible ? "auto" : "none",
        opacity: springProps.opacity,
      }}
    >
      {children}
    </animated.button>
  );
}

// ============================================================================
// Icons
// ============================================================================

/** Expand icon - arrows pointing outward (fullscreen) */
function ExpandIcon({ isDark }: { isDark: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={isDark ? "#60a5fa" : "#3b82f6"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

/** Collapse icon - arrows pointing inward (exit fullscreen) */
function CollapseIcon({ isDark }: { isDark: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={isDark ? "#60a5fa" : "#3b82f6"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

/** Close icon - X mark */
function CloseIcon({ isDark }: { isDark: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={isDark ? "#f87171" : "#ef4444"}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Magnifier control buttons for touch devices.
 *
 * Layout when NOT expanded:
 * - Expand button (fullscreen icon): bottom-right
 * - Select button: bottom-left (when visible)
 *
 * Layout when expanded:
 * - Close button (X icon): top-right
 * - Collapse button (exit fullscreen icon): bottom-right
 * - Select button: bottom-left (when visible)
 */
export const MagnifierControls = memo(function MagnifierControls({
  isTouchDevice,
  showSelectButton,
  isExpanded,
  isSelectDisabled,
  isDark,
  pointerLocked = false,
  hideControls = false,
  onSelect,
  onExitExpanded,
  onExpand,
  onClose,
}: MagnifierControlsProps) {
  // Only render on touch devices
  if (!isTouchDevice) {
    return null;
  }

  return (
    <>
      {/* Close button (X) - top-right corner - dismisses magnifier entirely */}
      <ControlButton
        position="top-right"
        style="icon"
        visible={!hideControls}
        onClick={onClose}
      >
        <CloseIcon isDark={isDark} />
      </ControlButton>

      {/* Expand button - bottom-right corner (when not expanded and not pointer locked) */}
      <ControlButton
        position="bottom-right"
        style="icon"
        visible={!hideControls && !isExpanded && !pointerLocked}
        onClick={onExpand}
      >
        <ExpandIcon isDark={isDark} />
      </ControlButton>

      {/* Collapse button - bottom-right corner (when expanded) - shrinks to regular size */}
      <ControlButton
        position="bottom-right"
        style="icon"
        visible={!hideControls && isExpanded}
        onClick={onExitExpanded}
      >
        <CollapseIcon isDark={isDark} />
      </ControlButton>

      {/* Select button - bottom-left corner (when triggered by drag) */}
      <ControlButton
        position="bottom-left"
        style="select"
        visible={showSelectButton}
        disabled={isSelectDisabled}
        onClick={onSelect}
      >
        Select
      </ControlButton>
    </>
  );
});
