"use client";

import { useMyAbacus } from "@/contexts/MyAbacusContext";
import { css } from "../../../styled-system/css";

interface VisionIndicatorProps {
  /** Size variant */
  size?: "small" | "medium";
  /** Position for absolute placement */
  position?: "top-left" | "bottom-right";
}

/**
 * Camera icon indicator for abacus vision mode
 *
 * Shows:
 * - 🔴 Red dot = not configured (no camera or no calibration)
 * - 🟢 Green dot = configured and enabled
 * - ⚪ Gray = configured but disabled
 *
 * Click behavior:
 * - If not configured: opens setup modal
 * - If configured: toggles vision on/off
 */
export function VisionIndicator({
  size = "medium",
  position = "bottom-right",
}: VisionIndicatorProps) {
  const { visionConfig, isVisionSetupComplete, openVisionSetup } =
    useMyAbacus();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Always open setup modal on click for now
    // This gives users easy access to vision settings
    openVisionSetup();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Right-click always opens setup
    openVisionSetup();
  };

  // Determine status indicator color
  const statusColor = !isVisionSetupComplete
    ? "red.500" // Not configured
    : visionConfig.enabled
      ? "green.500" // Enabled
      : "gray.400"; // Configured but disabled

  const statusLabel = !isVisionSetupComplete
    ? "Vision not configured"
    : visionConfig.enabled
      ? "Vision enabled"
      : "Vision disabled";

  const sizeStyles =
    size === "small"
      ? { w: "20px", h: "20px", fontSize: "10px" }
      : { w: "28px", h: "28px", fontSize: "14px" };

  const positionStyles =
    position === "top-left"
      ? { top: 0, left: 0, margin: "4px" }
      : { bottom: 0, right: 0, margin: "4px" };

  return (
    <button
      type="button"
      data-vision-status={
        !isVisionSetupComplete
          ? "not-configured"
          : visionConfig.enabled
            ? "enabled"
            : "disabled"
      }
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      title={`${statusLabel} (right-click for settings)`}
      style={{
        position: "absolute",
        ...positionStyles,
      }}
      className={css({
        ...sizeStyles,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bg: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(4px)",
        border: "1px solid rgba(255, 255, 255, 0.3)",
        borderRadius: "md",
        color: "white",
        cursor: "pointer",
        transition: "all 0.2s",
        zIndex: 10,
        opacity: 0.8,
        _hover: {
          bg: "rgba(0, 0, 0, 0.7)",
          opacity: 1,
          transform: "scale(1.1)",
        },
      })}
    >
      {/* Camera icon */}
      <span style={{ position: "relative" }}>
        📷{/* Status dot */}
        <span
          data-element="vision-status-dot"
          className={css({
            position: "absolute",
            top: "-2px",
            right: "-4px",
            w: "8px",
            h: "8px",
            borderRadius: "full",
            bg: statusColor,
            border: "1px solid white",
            boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
          })}
        />
      </span>
    </button>
  );
}
