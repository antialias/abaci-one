"use client";

import { useEffect, useRef, useState } from "react";
import { css } from "@styled/css";
import { useTheme } from "@/contexts/ThemeContext";
import { generateSettingsSummary } from "@/app/create/worksheets/utils/settingsSummary";
import type { WorksheetFormState } from "@/app/create/worksheets/types";

interface SharedSettingsButtonProps {
  config: WorksheetFormState;
  onClick: () => void;
}

const MARGIN = 16; // Safe margin from viewport edges
const STORAGE_KEY = "shared-settings-button-position";

/**
 * Floating button for mobile that shows worksheet settings summary
 * Opens the mobile drawer when tapped
 * Read-only version for shared worksheets
 */
export function SharedSettingsButton({
  config,
  onClick,
}: SharedSettingsButtonProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: MARGIN, y: 0 });
  const dragStart = useRef({ x: 0, y: 0, startX: 0, startY: 0 });

  // Load saved position from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPosition(constrainPosition(parsed.x, parsed.y));
      } catch {
        // Invalid saved position, use default
      }
    } else {
      // Default position: left side, below action buttons area
      setPosition(constrainPosition(MARGIN, 100));
    }
  }, []);

  // Constrain position within viewport bounds
  const constrainPosition = (x: number, y: number) => {
    if (!buttonRef.current) return { x, y };
    const rect = buttonRef.current.getBoundingClientRect();

    // Query actual action button position to calculate safe dragging bounds
    const actionButton = document.querySelector(
      '[data-action="download-shared-worksheet"]',
    );
    let actionButtonBottom = 0;

    if (actionButton) {
      const actionRect = actionButton.getBoundingClientRect();
      actionButtonBottom = actionRect.bottom + MARGIN;
    } else {
      // Fallback: estimate nav (60px) + action buttons area (80px)
      const navHeight = 60;
      const actionButtonArea = 80;
      actionButtonBottom = navHeight + actionButtonArea;
    }

    const minY = actionButtonBottom;
    const maxX = window.innerWidth - rect.width - MARGIN;
    const maxY = window.innerHeight - rect.height - MARGIN;

    return {
      x: Math.max(MARGIN, Math.min(x, maxX)),
      y: Math.max(minY, Math.min(y, maxY)),
    };
  };

  // Save position to localStorage
  const savePosition = (x: number, y: number) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y }));
  };

  // Pointer event handlers for dragging
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      startX: position.x,
      startY: position.y,
    };

    buttonRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    const newX = dragStart.current.startX + dx;
    const newY = dragStart.current.startY + dy;

    setPosition(constrainPosition(newX, newY));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;

    setIsDragging(false);
    buttonRef.current?.releasePointerCapture(e.pointerId);

    // Save final position
    savePosition(position.x, position.y);

    // If the button barely moved, treat as a click
    const dx = Math.abs(e.clientX - dragStart.current.x);
    const dy = Math.abs(e.clientY - dragStart.current.y);
    const dragThreshold = 5; // pixels

    if (dx < dragThreshold && dy < dragThreshold) {
      onClick();
    }
  };

  // Generate summary from config
  const { lines, icons } = generateSettingsSummary(config);

  return (
    <button
      ref={buttonRef}
      type="button"
      data-component="shared-settings-button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={css({
        position: "fixed",
        zIndex: 30,
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
        userSelect: "none",
        bg: isDark ? "rgba(31, 41, 55, 0.95)" : "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(12px)",
        border: "2px solid",
        borderColor: isDark ? "blue.500" : "blue.600",
        rounded: "xl",
        shadow: isDragging ? "2xl" : "lg",
        p: "3",
        display: "flex",
        flexDirection: "column",
        gap: "2",
        maxW: "80",
        transition: isDragging ? "none" : "box-shadow 0.2s",
      })}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {/* Header with icon and title */}
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "2",
          pb: "2",
          borderBottom: "1px solid",
          borderColor: isDark ? "gray.700" : "gray.200",
        })}
      >
        <span className={css({ fontSize: "lg" })}>⚙️</span>
        <span
          className={css({
            fontSize: "sm",
            fontWeight: "bold",
            color: isDark ? "gray.100" : "gray.900",
          })}
        >
          Worksheet Settings
        </span>
        <div
          className={css({
            ml: "auto",
            px: "2",
            py: "0.5",
            rounded: "md",
            bg: isDark ? "blue.700" : "blue.100",
            fontSize: "xs",
            fontWeight: "medium",
            color: isDark ? "blue.100" : "blue.800",
          })}
        >
          Read-Only
        </div>
      </div>

      {/* Settings summary */}
      <div
        className={css({ display: "flex", flexDirection: "column", gap: "1" })}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            className={css({
              fontSize: "xs",
              color: isDark ? "gray.300" : "gray.700",
              display: "flex",
              alignItems: "center",
              gap: "1",
            })}
          >
            {line}
          </div>
        ))}
      </div>

      {/* Tap hint */}
      <div
        className={css({
          fontSize: "xs",
          color: isDark ? "gray.500" : "gray.400",
          textAlign: "center",
          pt: "1",
          borderTop: "1px solid",
          borderColor: isDark ? "gray.700" : "gray.200",
          fontStyle: "italic",
        })}
      >
        Tap to view details
      </div>
    </button>
  );
}
